// V34.8.2 — POST /api/reconciliation-trigger
// Dispara o motor de conciliação RD↔LJ pra o user logado (self-only).
// Diferente do /api/cron-rd-pull que aceita master/cron-token e itera todos users,
// este endpoint roda APENAS pro próprio user. Usado pelo botão "Conciliar" do UI.

const { runReconciliation } = require('../lib/rd-reconciliation-engine');
const { getRdCredential } = require('../lib/rd-credentials');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Master DB não configurado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  if (!userId) return res.status(401).json({ ok: false, message: 'JWT sem user id.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const maxPullPages = Math.min(Number(body.max_pull_pages || 10), 20);
  const maxOrphans = Math.min(Number(body.max_orphans || 50), 200);

  // Token RD CRM do user
  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_pat');
    token = cred?.token;
  } catch (err) {
    return res.status(400).json({ ok: false, message: `RD CRM não conectado: ${err.message}` });
  }
  if (!token) return res.status(400).json({ ok: false, message: 'crm_pat sem access_token. Conecte o RD CRM em Configurações.' });

  try {
    const result = await runReconciliation(req.db, req.tenantDb, userId, token, { maxPullPages, maxOrphans });
    return res.status(200).json({ ...result, triggeredBy: 'user' });
  } catch (err) {
    console.error('[reconciliation-trigger]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
