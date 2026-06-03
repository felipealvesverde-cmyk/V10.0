// V24.0.0 — Endpoint serverless de ingestão de webhooks do RD Station.
//
// O RD POSTa eventos (contact_changed, tag_added, stage_changed, deal_won,
// crm_contact_created/updated/deleted...) pra este endpoint quando configurado
// em RD CRM → Integrações → Webhooks.
//
// EVIDÊNCIA DE DESIGN:
//   - Endpoint público (não exige JWT do Journey). RD não tem nosso token.
//   - Validação opcional via HMAC se RD_WEBHOOK_SECRET estiver setado.
//   - Buffer em memória (ring de 500). Frontend faz pull via /api/rd-events-fetch.
//   - Para mutar state via tags, já roteamos pro tenant via ?user_id=X.
//
// V34.6.c — Tags ao vivo em lj_visitor_tags (handleTagSync).
//
// V35.11.0 — Caminho principal de atualização RD↔LJ via webhook.
//   - handleContactSync: trata crm_contact_created/updated/deleted (upsert em lj_visitors).
//   - Toda recepção (ok ou erro) loga em lj_rd_webhook_log pra audit + agregação
//     no sininho. Cliente vê no Configurações > Meu Banco > Log de Erros.
//   - Falhas agregam até cliente marcar como visto (POST /api/rd-webhook-failures-summary).
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
  const t0 = Date.now();
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

    // V34.6.c + V35.11.0 — Quando webhook é registrado com ?user_id=X na URL,
    // resolve tenant e processa em background (tags + contatos).
    // Log sempre acontece, mesmo sem ?user_id (vira "skipped" no log).
    const userId = Number(req.query?.user_id || 0);
    if (userId > 0) {
      processWebhookInTenant(req.db, userId, entry, t0).catch(err => {
        console.error('[rd-webhook process]', err?.message || err);
      });
    }

    res.status(200).json({ ok: true, id: entry.id });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Erro inesperado.' });
  }
};

// V35.11.0 — Pipeline único por webhook:
//   1. Resolve tenantDb a partir do user_id (control plane → tenant pool)
//   2. Despacha pro handler certo (tags ou contacts)
//   3. Loga resultado em lj_rd_webhook_log (sempre — ok ou erro)
async function processWebhookInTenant(controlPlaneDb, userId, entry, t0) {
  let tenantDb = null;
  let logRow = {
    userId,
    eventType: entry.eventType,
    rdContactId: entry.contactId ? String(entry.contactId).slice(0, 64) : null,
    status: 'ok',
    errorCategory: null,
    errorMessage: null,
    payloadExcerpt: extractPayloadExcerpt(entry.payload)
  };

  try {
    tenantDb = await resolveTenantDb(controlPlaneDb, userId);
  } catch (err) {
    logRow.status = 'error';
    logRow.errorCategory = 'tenant-resolve';
    logRow.errorMessage = err?.message || 'Falha ao resolver tenant.';
    // Não tem tenantDb → não dá nem pra logar. Loga no console + sai.
    console.error('[rd-webhook tenant-resolve]', logRow.errorMessage);
    return;
  }

  // Despacha por tipo de evento (cada handler retorna { handled, error? }).
  const evt = String(entry.eventType || '').toLowerCase().replace(/-/g, '_');
  let dispatch = { handled: false };
  try {
    if (isTagEvent(evt)) {
      dispatch = await handleTagSync(controlPlaneDb, tenantDb, userId, entry);
    } else if (isContactEvent(evt)) {
      dispatch = await handleContactSync(tenantDb, userId, entry);
    } else {
      // Evento desconhecido (ex: deal_won, stage_changed). Loga como OK
      // mas sem ação — frontend ainda pode consumir via /api/rd-events-fetch.
      dispatch = { handled: false, skipped: true };
    }
  } catch (err) {
    dispatch = {
      handled: false,
      error: { category: classifyError(err), message: err?.message || String(err) }
    };
  }

  if (dispatch.error) {
    logRow.status = 'error';
    logRow.errorCategory = dispatch.error.category;
    logRow.errorMessage = (dispatch.error.message || '').slice(0, 500);
  }

  await writeWebhookLog(tenantDb, logRow, Date.now() - t0).catch(err => {
    console.error('[rd-webhook log write]', err?.message);
  });
}

async function resolveTenantDb(controlPlaneDb, userId) {
  const userRow = await controlPlaneDb.query(
    'SELECT default_tenant_id FROM users WHERE id = $1',
    [userId]
  );
  if (!userRow.rows.length) throw new Error('User não encontrado no control plane.');
  const tenantId = userRow.rows[0].default_tenant_id;
  if (!tenantId) return controlPlaneDb; // master sem tenant → control plane
  const pool = await tenantPoolHelper.getTenantPool(controlPlaneDb, tenantId);
  return pool || controlPlaneDb;
}

function extractPayloadExcerpt(payload) {
  if (!payload || typeof payload !== 'object') return null;
  // Mantém só campos chave (não payload inteiro — pode ser pesado)
  const pick = {};
  ['contact_id', 'entity_id', 'email', 'name', 'phone', 'event_identifier',
   'event_type', 'tag', 'tags', 'added_tags', 'removed_tags', 'stage', 'pipeline',
   'updated_at', 'created_at'].forEach(k => {
    if (payload[k] != null) pick[k] = payload[k];
  });
  if (payload.contact && typeof payload.contact === 'object') {
    pick.contact = {};
    ['id', 'uuid', 'email', 'name', 'phone'].forEach(k => {
      if (payload.contact[k] != null) pick.contact[k] = payload.contact[k];
    });
  }
  return Object.keys(pick).length ? pick : null;
}

function classifyError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('email') && (msg.includes('inv') || msg.includes('format'))) return 'validation';
  if (msg.includes('null value') || msg.includes('not-null')) return 'validation';
  if (msg.includes('connect') || msg.includes('timeout') || msg.includes('econnrefused')) return 'db';
  if (msg.includes('relation') || msg.includes('does not exist')) return 'db';
  if (msg.includes('duplicate') || msg.includes('conflict')) return 'validation';
  return 'unknown';
}

async function writeWebhookLog(tenantDb, log, processingMs) {
  if (!tenantDb) return;
  try {
    await tenantDb.query(
      `INSERT INTO lj_rd_webhook_log
         (user_id, event_type, status, error_category, error_message,
          rd_contact_id, payload_excerpt, processing_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        log.userId,
        (log.eventType || '').slice(0, 64),
        log.status,
        log.errorCategory,
        log.errorMessage,
        log.rdContactId,
        log.payloadExcerpt ? JSON.stringify(log.payloadExcerpt) : null,
        processingMs
      ]
    );
  } catch (err) {
    // Não propaga — log falhar não pode quebrar webhook
    console.error('[rd-webhook log]', err?.message);
  }
}

function isTagEvent(evt) {
  return evt === 'tag_added' || evt === 'contact_tagged'
      || evt === 'tag_removed' || evt === 'contact_untagged';
}

function isContactEvent(evt) {
  return evt === 'crm_contact_created' || evt === 'crm_contact_updated' || evt === 'crm_contact_deleted'
      || evt === 'contact_created' || evt === 'contact_updated' || evt === 'contact_deleted'
      || evt === 'contact_changed';
}

// V34.6.c — Tag sync ao vivo (assinatura ajustada na V35.11.0: agora recebe
// tenantDb resolvido pelo pipeline acima, em vez de resolver de novo).
async function handleTagSync(controlPlaneDb, tenantDb, userId, entry) {
  const evt = String(entry.eventType || '').toLowerCase().replace(/-/g, '_');
  const isAdded = evt === 'tag_added' || evt === 'contact_tagged';
  const isRemoved = evt === 'tag_removed' || evt === 'contact_untagged';
  if (!isAdded && !isRemoved) return { handled: false };

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
  if (!rdContactId) {
    throw Object.assign(new Error('Payload sem contact_id.'), { _category: 'validation' });
  }

  let tags = [];
  if (Array.isArray(p.tags)) tags = p.tags;
  else if (Array.isArray(p.added_tags) && isAdded) tags = p.added_tags;
  else if (Array.isArray(p.removed_tags) && isRemoved) tags = p.removed_tags;
  else if (Array.isArray(p.contact?.tags)) tags = p.contact.tags;
  else if (p.tag) tags = [p.tag];
  tags = tags.map(t => String(t || '').trim()).filter(Boolean);
  if (!tags.length) return { handled: false };

  let ljVisitorId = null;
  const r = await tenantDb.query(
    `SELECT lj_visitor_id FROM lj_visitors
       WHERE user_id = $1 AND external_rd_contact_id = $2 LIMIT 1`,
    [userId, rdContactId]
  );
  if (r.rows.length) ljVisitorId = r.rows[0].lj_visitor_id;
  if (!ljVisitorId) return { handled: false, skipped: true };

  for (const tag of tags) {
    if (tag.startsWith('lj-')) continue;
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
  }

  try {
    const { applyEvent } = require('../lib/score-engine');
    await applyEvent(tenantDb, userId, ljVisitorId, { source: 'rd-webhook', isAdded, isRemoved }, { masterDb: controlPlaneDb });
  } catch (err) {
    console.warn('[rd-webhook tag-sync] applyEvent score err:', err.message);
  }

  return { handled: true };
}

// V35.11.0 — Sync de contato. RD envia crm_contact_created/updated/deleted
// com payload.contact (ou raiz). Atualizamos lj_visitors do tenant baseado
// no external_rd_contact_id. Idempotente.
//
// Estratégia:
//   - created/updated: upsert por (user_id, external_rd_contact_id).
//     Atualiza email/name/phone, last_seen_at, marca external_rd_sync_status='synced'.
//   - deleted: NÃO apaga visitor (audit). Marca external_rd_sync_status='deleted-in-rd'.
async function handleContactSync(tenantDb, userId, entry) {
  const evt = String(entry.eventType || '').toLowerCase().replace(/-/g, '_');
  const isDeleted = evt === 'crm_contact_deleted' || evt === 'contact_deleted';

  const p = entry.payload || {};
  const contact = (p.contact && typeof p.contact === 'object') ? p.contact : p;
  const rdContactId = String(
    entry.contactId || contact.id || contact.uuid || p.contact_id || p.entity_id || ''
  ).trim();
  if (!rdContactId) {
    throw Object.assign(new Error('Payload sem contact_id.'), { _category: 'validation' });
  }

  if (isDeleted) {
    await tenantDb.query(
      `UPDATE lj_visitors
          SET external_rd_sync_status = 'deleted-in-rd',
              external_rd_synced_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1 AND external_rd_contact_id = $2`,
      [userId, rdContactId]
    );
    return { handled: true };
  }

  const email = sanitizeStr(contact.email || p.email, 255);
  const name = sanitizeStr(contact.name || p.name, 255);
  const phone = sanitizeStr(contact.phone || contact.mobile_phone || p.phone, 64);

  // Tenta achar visitor existente — primeiro por external_rd_contact_id,
  // depois por email (link automático).
  let existing = await tenantDb.query(
    `SELECT lj_visitor_id, email, name, phone
       FROM lj_visitors
      WHERE user_id = $1 AND external_rd_contact_id = $2 LIMIT 1`,
    [userId, rdContactId]
  );
  if (!existing.rows.length && email) {
    existing = await tenantDb.query(
      `SELECT lj_visitor_id, email, name, phone
         FROM lj_visitors
        WHERE user_id = $1 AND email = $2 AND external_rd_contact_id IS NULL
        LIMIT 1`,
      [userId, email]
    );
  }

  if (existing.rows.length) {
    const visitorId = existing.rows[0].lj_visitor_id;
    await tenantDb.query(
      `UPDATE lj_visitors
          SET email = COALESCE($3, email),
              name = COALESCE($4, name),
              phone = COALESCE($5, phone),
              external_rd_contact_id = $2,
              external_rd_sync_status = 'synced',
              external_rd_synced_at = NOW(),
              last_seen_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $6`,
      [userId, rdContactId, email, name, phone, visitorId]
    );
    return { handled: true };
  }

  // INSERT novo visitor (created ou updated sem match)
  const newVisitorId = `rd_${rdContactId}`;
  await tenantDb.query(
    `INSERT INTO lj_visitors
       (lj_visitor_id, user_id, entity_type, current_stage, email, name, phone,
        external_rd_contact_id, external_rd_sync_status, external_rd_synced_at,
        first_seen_at, last_seen_at)
     VALUES ($1, $2, 'suspect', 'marketing-tof', $3, $4, $5, $6, 'synced', NOW(), NOW(), NOW())
     ON CONFLICT (user_id, lj_visitor_id) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, lj_visitors.email),
           name  = COALESCE(EXCLUDED.name, lj_visitors.name),
           phone = COALESCE(EXCLUDED.phone, lj_visitors.phone),
           external_rd_sync_status = 'synced',
           external_rd_synced_at = NOW(),
           last_seen_at = NOW(),
           updated_at = NOW()`,
    [newVisitorId, userId, email, name, phone, rdContactId]
  );
  return { handled: true };
}

function sanitizeStr(s, maxLen) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}
