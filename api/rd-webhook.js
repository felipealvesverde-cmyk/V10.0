// V24.0.0 — Endpoint serverless de ingestão de webhooks do RD Station.
//
// O RD POSTa eventos (contact_changed, tag_added, stage_changed, deal_won...)
// pra este endpoint quando configurado em RD CRM → Integrações → Webhooks.
//
// EVIDÊNCIA DE DESIGN:
//   - Endpoint público (não exige JWT do Journey). RD não tem nosso token.
//   - Validação opcional via HMAC se RD_WEBHOOK_SECRET estiver setado.
//   - Buffer em memória (ring de 500). Frontend faz pull via /api/rd-events-fetch.
//   - NÃO mutamos state do Journey aqui: deixamos pro frontend rotear via
//     RdCrmEventIngestor (que já existe e sabe fazer LeadBase/Score/Tag bridges).
//
// V34.6.c — quando webhook é registrado com ?user_id=X na URL, este endpoint
// AGORA também escreve direto em lj_visitor_tags do tenant correspondente
// quando o evento é tag_added/tag_removed. Resolve user → tenant via control
// plane (users.default_tenant_id) e usa tenant-pool pro DB do tenant.
// Idempotente: ON CONFLICT DO NOTHING em INSERT, DELETE idempotente.
const crypto = require('crypto');
const tenantPoolHelper = require('../lib/tenant-pool');

const RING_BUFFER_LIMIT = 500;
const memoryBuffer = global.__JOURNEY_RD_WEBHOOK_BUFFER__ || [];
global.__JOURNEY_RD_WEBHOOK_BUFFER__ = memoryBuffer;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RD-Signature');
}

function verifyHmac(rawBody, signature, secret) {
  if (!secret) return true; // sem secret configurado, aceita tudo
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (_) { return false; }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST.' });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    const secret = process.env.RD_WEBHOOK_SECRET || '';
    if (secret) {
      const signature = req.headers['x-rd-signature'] || req.headers['x-hub-signature-256'] || '';
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (!verifyHmac(rawBody, signature, secret)) {
        res.status(401).json({ ok: false, message: 'Assinatura HMAC inválida.' });
        return;
      }
    }
    if (!body || typeof body !== 'object') {
      res.status(400).json({ ok: false, message: 'Body inválido.' });
      return;
    }
    const entry = {
      id: `rd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: new Date().toISOString(),
      eventType: body.event_type || body.type || 'unknown',
      contactId: body.entity_id || body.contact_id || body.payload?.contact_id || null,
      payload: body.payload || body
    };
    memoryBuffer.push(entry);
    if (memoryBuffer.length > RING_BUFFER_LIMIT) memoryBuffer.shift();

    // V34.6.c — Tag sync ao vivo (só se webhook URL inclui ?user_id=X).
    // Roda em background sem await — não bloqueia resposta ao RD (<100ms).
    const userId = Number(req.query?.user_id || 0);
    if (userId > 0) {
      handleTagSync(req.db, userId, entry).catch(err => {
        console.error('[rd-webhook tag-sync]', err?.message || err);
      });
    }

    res.status(200).json({ ok: true, id: entry.id });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Erro inesperado.' });
  }
};

// V34.6.c — Resolve tenant DB do user_id e aplica tag.added / tag.removed em
// lj_visitor_tags + audit em lj_tag_audit_log.
//
// Eventos tratados:
//   - tag_added | contact_tagged → INSERT (idempotente)
//   - tag_removed | contact_untagged → DELETE
//
// Payload esperado (formato flexível, varia entre versions do RD):
//   { tags: [...] } OU { tag: 'x' } OU { added_tags: [...] } OU { removed_tags: [...] }
//   Com entity_id / contact_id / contact.uuid identificando o contato RD.
async function handleTagSync(controlPlaneDb, userId, entry) {
  const evt = String(entry.eventType || '').toLowerCase().replace(/-/g, '_');
  const isAdded = evt === 'tag_added' || evt === 'contact_tagged';
  const isRemoved = evt === 'tag_removed' || evt === 'contact_untagged';
  if (!isAdded && !isRemoved) return;

  const p = entry.payload || {};
  const rdContactId = String(
    entry.contactId ||
    p.contact_id ||
    p.entity_id ||
    p.contact?.id ||
    p.contact?.uuid ||
    p.entity?.id ||
    ''
  ).trim();
  if (!rdContactId) return;

  // Coleta tags do payload (vários formatos possíveis)
  let tags = [];
  if (Array.isArray(p.tags)) tags = p.tags;
  else if (Array.isArray(p.added_tags) && isAdded) tags = p.added_tags;
  else if (Array.isArray(p.removed_tags) && isRemoved) tags = p.removed_tags;
  else if (Array.isArray(p.contact?.tags)) tags = p.contact.tags;
  else if (p.tag) tags = [p.tag];
  tags = tags.map(t => String(t || '').trim()).filter(Boolean);
  if (!tags.length) return;

  // Resolve tenant DB pelo user_id
  let tenantDb = null;
  try {
    const userRow = await controlPlaneDb.query(
      'SELECT default_tenant_id FROM users WHERE id = $1',
      [userId]
    );
    if (!userRow.rows.length) return;
    const tenantId = userRow.rows[0].default_tenant_id;
    if (!tenantId) {
      // Master sem default tenant → usa control plane (fallback)
      tenantDb = controlPlaneDb;
    } else {
      const pool = await tenantPoolHelper.getTenantPool(controlPlaneDb, tenantId);
      tenantDb = pool || controlPlaneDb;
    }
  } catch (err) {
    console.error('[rd-webhook tag-sync] resolve tenant err:', err.message);
    return;
  }

  // Acha visitor por external_rd_contact_id
  let ljVisitorId = null;
  try {
    const r = await tenantDb.query(
      `SELECT lj_visitor_id FROM lj_visitors
         WHERE user_id = $1 AND external_rd_contact_id = $2 LIMIT 1`,
      [userId, rdContactId]
    );
    if (r.rows.length) ljVisitorId = r.rows[0].lj_visitor_id;
  } catch (err) {
    console.error('[rd-webhook tag-sync] visitor lookup err:', err.message);
    return;
  }
  if (!ljVisitorId) return; // visitor ainda não conhecido no LJ; pull diário (V34.6.d) reconcilia

  // Aplica add/remove em batch
  for (const tag of tags) {
    if (tag.startsWith('lj-')) continue; // namespace protegido, RD nunca grava lj-*
    try {
      if (isAdded) {
        await tenantDb.query(
          `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category)
             VALUES ($1, $2, $3, 'rd-webhook', 'rd-auto')
           ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
          [userId, ljVisitorId, tag]
        );
        await tenantDb.query(
          `INSERT INTO lj_tag_audit_log (user_id, lj_visitor_id, tag, action, source)
             VALUES ($1, $2, $3, 'added', 'rd-webhook')`,
          [userId, ljVisitorId, tag]
        );
      } else if (isRemoved) {
        const del = await tenantDb.query(
          `DELETE FROM lj_visitor_tags
             WHERE user_id = $1 AND lj_visitor_id = $2 AND tag = $3
             RETURNING tag`,
          [userId, ljVisitorId, tag]
        );
        if (del.rows.length) {
          await tenantDb.query(
            `INSERT INTO lj_tag_audit_log (user_id, lj_visitor_id, tag, action, source)
               VALUES ($1, $2, $3, 'removed', 'rd-webhook')`,
            [userId, ljVisitorId, tag]
          );
        }
      }
    } catch (err) {
      console.error('[rd-webhook tag-sync] tag op err:', err.message);
    }
  }
}
