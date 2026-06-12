// V34.7.h.7 — POST /api/visitors-update
// Persiste edição manual de lead no lj_visitors + marca pending-contact-update
// se o visitor tem espelho no RD CRM (external_rd_contact_id).
//
// Body: { email, name?, phone?, idade?, sexo?, estado?, cidade?, estadoCivil?, faixaSalarial? }
//
// Estratégia:
//   1. Resolve visitor por (user_id, email).
//      Email é a chave canônica (case-insensitive) que aparece tanto no
//      estado legacy (App.state.actions[].leads) quanto no lj_visitors.
//   2. Aplica UPDATE só nos campos enviados (omit undefined).
//   3. Se mudou name/phone/email AND tem external_rd_contact_id → markForSync.
//   4. Retorna { ok, visitor, markedForRdSync }.

const { markForSync } = require('../lib/rd-contact-sync-engine');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

// Campos editáveis que existem no lj_visitors. Outros (idade, sexo, cidade...)
// ainda vivem só no journey_state legacy — não tem coluna pra eles.
// Quando V34 adicionar essas colunas no lj_visitors, ampliar este map.
const EDITABLE_COLS = {
  name: 'name',
  phone: 'phone'
  // email é a chave de lookup, não é editável aqui (pra evitar mover identidade)
};

// Campos cuja mudança justifica re-sync com RD CRM.
const RD_RELEVANT_COLS = new Set(['name', 'phone']);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  // V37.4.34 — Visitor vive na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);
  const email = String(body.email || '').toLowerCase().trim();
  if (!userId) return res.status(401).json({ ok: false, message: 'JWT sem user id.' });
  if (!email) return res.status(400).json({ ok: false, message: 'email obrigatório (chave de lookup).' });

  try {
    // Resolve visitor
    const lookup = await req.tenantDb.query(
      `SELECT lj_visitor_id, name, phone, external_rd_contact_id
         FROM lj_visitors
        WHERE user_id = $1 AND LOWER(email) = $2
        LIMIT 1`,
      [userId, email]
    );
    if (!lookup.rows.length) {
      return res.status(404).json({ ok: false, message: `Visitor não encontrado (email=${email}).` });
    }
    const visitor = lookup.rows[0];

    // Monta UPDATE só com campos enviados que são editáveis
    const sets = [];
    const params = [userId, visitor.lj_visitor_id];
    let paramIdx = 3;
    const changedRdRelevant = [];
    for (const [bodyKey, dbCol] of Object.entries(EDITABLE_COLS)) {
      if (body[bodyKey] === undefined || body[bodyKey] === null) continue;
      const newValue = String(body[bodyKey] || '').trim();
      const oldValue = String(visitor[dbCol] || '').trim();
      if (newValue === oldValue) continue;
      sets.push(`${dbCol} = $${paramIdx++}`);
      params.push(newValue);
      if (RD_RELEVANT_COLS.has(dbCol)) changedRdRelevant.push(dbCol);
    }

    if (!sets.length) {
      return res.status(200).json({ ok: true, message: 'Nada a atualizar (sem mudança).', visitor: { lj_visitor_id: visitor.lj_visitor_id }, markedForRdSync: false });
    }

    sets.push(`updated_at = NOW()`);
    await req.tenantDb.query(
      `UPDATE lj_visitors SET ${sets.join(', ')} WHERE user_id = $1 AND lj_visitor_id = $2`,
      params
    );

    let markedForRdSync = false;
    if (changedRdRelevant.length && visitor.external_rd_contact_id) {
      try {
        await markForSync(req.tenantDb, userId, visitor.lj_visitor_id, `manual-edit:${changedRdRelevant.join(',')}`);
        markedForRdSync = true;
      } catch (err) {
        console.warn('[visitors-update] markForSync falhou:', err.message);
      }
    }

    return res.status(200).json({
      ok: true,
      visitor: { lj_visitor_id: visitor.lj_visitor_id, email, changed: changedRdRelevant },
      markedForRdSync
    });
  } catch (err) {
    console.error('[visitors-update]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
