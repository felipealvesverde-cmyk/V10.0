// V35.1.0 — POST /api/hotmart-sync-history
// Dispara reconciliação manual (botão "Sincronizar agora" no wizard/dashboard).
// Body opcional: { window_days: 90|180|365 }
//
// Cron paralelo pode bater no engine direto. Esta rota é só pra UI.

const engine = require('../lib/hotmart-reconciliation-engine');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const windowDays = body?.window_days ? Number(body.window_days) : null;

  try {
    const result = await engine.reconcileUser(req.tenantDb, userId, windowDays ? { windowDays } : {});
    return res.status(200).json(result);
  } catch (err) {
    console.error('[hotmart-sync-history]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
