// V34.7.a — Worker que processa visitors com external_rd_sync_status =
// 'pending-contact-update' e empurra PATCH /contacts/{id} pro RD CRM.
//
// POST /api/rd-contact-sync-run
// Auth: master JWT OR X-Cron-Token
// Body: { user_id?, max_visitors? = 50, dry_run? }
//
// Trigger normal: cron diário OU clique manual no sininho ("Sincronizar agora").

const { getRdCredential } = require('../lib/rd-credentials');
const { runBatch } = require('../lib/rd-contact-sync-engine');

function authorize(req) {
  if (req.user?.isMaster) return { ok: true, source: 'master' };
  const cronToken = process.env.CRON_RECONCILE_TOKEN;
  if (cronToken) {
    const provided = req.headers['x-cron-token'] || req.query?.cron_token;
    if (provided && String(provided) === cronToken) return { ok: true, source: 'cron-token' };
  }
  return { ok: false };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const scopeUserId = Number(body.user_id || req.user?.sub || 0);
  if (!scopeUserId) return res.status(400).json({ ok: false, message: 'user_id obrigatório (ou JWT autenticado).' });
  const maxVisitors = Number(body.max_visitors || 50);
  const dryRun = Boolean(body.dry_run);

  // Lê crm_pat
  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, scopeUserId, 'crm_pat');
    token = cred?.token;
  } catch (err) {
    return res.status(400).json({ ok: false, message: `RD CRM não conectado: ${err.message}` });
  }
  if (!token) return res.status(400).json({ ok: false, message: 'crm_pat sem access_token.' });

  try {
    const result = await runBatch(req.tenantDb, scopeUserId, token, { maxVisitors, dryRun });
    return res.status(200).json({ ...result, triggeredBy: auth.source });
  } catch (err) {
    console.error('[rd-contact-sync-run]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
