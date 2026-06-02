// V35.7.0-alpha4 — Trigger manual de sync Google Ads.
//
// POST /api/google-ads-sync-trigger
//
// Roda a query GAQL + UPSERT pra user autenticado. Retorna { ok, rowsUpserted,
// errors }. Em release futura, cron 1x/dia chamará essa lib direto sem
// passar por endpoint (server.js setInterval).

const { syncForUser } = require('../lib/google-ads-sync');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  try {
    const result = await syncForUser(req.tenantDb, userId);
    // Marca last_sync_at e last_sync_result em lj_google_ads_config.
    try {
      await req.tenantDb.query(
        `UPDATE lj_google_ads_config
            SET last_sync_at = NOW(),
                last_sync_result = $2
          WHERE user_id = $1`,
        [userId, JSON.stringify({
          ok: result.ok,
          rowsUpserted: result.rowsUpserted || 0,
          error: result.error || null,
          at: new Date().toISOString()
        })]
      );
    } catch (_) {/* config ainda pode não existir — ignora */}
    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (err) {
    console.error('[google-ads-sync-trigger] erro:', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno.' });
  }
};
