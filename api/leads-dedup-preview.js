// V35.3.7 — POST /api/leads-dedup-preview
// Step 3 do Lead Import Wizard: descobre quantos emails/phones do CSV
// já existem na base do tenant antes de confirmar o import.
//
// Body: { emails: string[], phones: string[], bank_id?: number }
//   bank_id é opcional — quando setado, filtra por banco específico.
//   Sem bank_id, considera a base inteira do tenant.
//
// Volume guard: max 50k entradas combinadas. Acima disso, retorna 413
// (caller já bloqueou no front via regra de Felipe, mas é defensa).

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

const MAX_TOTAL = 50000;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Dedup preview vive na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const emails = Array.isArray(body.emails)
    ? [...new Set(body.emails.map(e => String(e || '').toLowerCase().trim()).filter(Boolean))]
    : [];
  const phones = Array.isArray(body.phones)
    ? [...new Set(body.phones.map(p => String(p || '').replace(/\D/g, '')).filter(p => p.length >= 8))]
    : [];

  if (emails.length + phones.length > MAX_TOTAL) {
    return res.status(413).json({ ok: false, message: `Volume acima de ${MAX_TOTAL}. Quebre em lotes menores.` });
  }
  if (!emails.length && !phones.length) {
    return res.status(200).json({ ok: true, duplicateEmails: 0, duplicatePhones: 0 });
  }

  const bankId = Number(body.bank_id) || null;

  try {
    let duplicateEmails = 0, duplicatePhones = 0;

    if (emails.length) {
      const params = [userId, emails];
      let q = `SELECT COUNT(DISTINCT LOWER(email)) AS c FROM lj_visitors
               WHERE user_id = $1 AND LOWER(email) = ANY($2::text[])`;
      if (bankId) {
        q += ` AND lj_visitor_id IN (SELECT lj_visitor_id FROM lj_visitor_bank_membership WHERE user_id = $1 AND bank_id = $3)`;
        params.push(bankId);
      }
      const r = await req.tenantDb.query(q, params);
      duplicateEmails = Number(r.rows[0]?.c || 0);
    }

    if (phones.length) {
      const params = [userId, phones];
      let q = `SELECT COUNT(DISTINCT REGEXP_REPLACE(phone, '\\D', '', 'g')) AS c FROM lj_visitors
               WHERE user_id = $1 AND REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') = ANY($2::text[])`;
      if (bankId) {
        q += ` AND lj_visitor_id IN (SELECT lj_visitor_id FROM lj_visitor_bank_membership WHERE user_id = $1 AND bank_id = $3)`;
        params.push(bankId);
      }
      const r = await req.tenantDb.query(q, params);
      duplicatePhones = Number(r.rows[0]?.c || 0);
    }

    return res.status(200).json({ ok: true, duplicateEmails, duplicatePhones });
  } catch (err) {
    console.error('[leads-dedup-preview]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
