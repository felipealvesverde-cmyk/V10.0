// V35.14.1 — GET /api/ga4-list-properties
// Lista propriedades GA4 acessíveis pelo refresh_token do user.
// Usado no wizard pra cliente escolher qual property conectar.
//
// Response:
//   { ok: true, properties: [{ propertyId, displayName, accountName, propertyType }] }

const { listAccessibleProperties } = require('../lib/ga4-oauth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  try {
    const properties = await listAccessibleProperties(req.tenantDb, userId);
    return res.status(200).json({ ok: true, properties });
  } catch (err) {
    // Erros típicos: 'GA4 não conectado' (sem refresh_token) → 400 amigável
    const msg = err?.message || String(err);
    if (/não conectado|refresh_token/i.test(msg)) {
      return res.status(400).json({ ok: false, message: msg });
    }
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(503).json({ ok: false, message: 'Schema GA4 ainda não rodou no banco.', schemaMissing: true });
    }
    console.error('[ga4-list-properties]', err);
    return res.status(500).json({ ok: false, message: msg });
  }
};
