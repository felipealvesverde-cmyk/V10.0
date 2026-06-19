// V40.7.8 — Endpoint admin que injeta RevOps & Governança populado pros 3
// produtos do tenant demo (Pilsen, Weiss, Chopp de Vinho).
//
// Funcionamento: lê journey_state do demo@leadjourney.app, mescla os 3 configs
// em state.revopsFinanceV2 (sobrescrevendo SÓ os 3 productIds; outros produtos
// que algum dia tiverem RevOps configurado ficam intocados), salva.
//
// POST /api/admin-add-demo-revops
// Body: {} ou { force: true }
// Resposta: { ok, applied, addonVersion, configuredProductIds, totals }
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode aplicar.' });

  try {
    const { buildRevopsFinanceV2, REVOPS_ADDON_VERSION } = require('../scripts/demo-revops-3-products');
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const force = req.body && req.body.force === true;

    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existing.rowCount === 0) {
      return res.status(409).json({ ok: false, message: 'Demo user não tem state. Imputa Pilsen+Weiss+Chopp primeiro (V40.7.6).' });
    }

    const state = existing.rows[0].state_json || {};
    const currentRevopsV2 = (state.revopsFinanceV2 && typeof state.revopsFinanceV2 === 'object') ? state.revopsFinanceV2 : {};

    const addons = (state.__demoAddons || []).slice();
    const alreadyApplied = addons.includes(REVOPS_ADDON_VERSION);
    if (alreadyApplied && !force) {
      return res.status(200).json({
        ok: true,
        applied: false,
        reason: 'Já aplicado. Use { "force": true } pra reaplicar.',
        addonVersion: REVOPS_ADDON_VERSION
      });
    }

    const addon = buildRevopsFinanceV2();
    const newRevopsV2 = { ...currentRevopsV2, ...addon };

    const newState = {
      ...state,
      revopsFinanceV2: newRevopsV2,
      __demoAddons: Array.from(new Set([...addons, REVOPS_ADDON_VERSION])),
      lastSavedAt: new Date().toISOString()
    };

    await req.db.query(
      `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2 WHERE user_id = $2`,
      [newState, demoUserId]
    );

    return res.status(200).json({
      ok: true,
      applied: true,
      addonVersion: REVOPS_ADDON_VERSION,
      demoUserId,
      configuredProductIds: Object.keys(addon),
      totals: {
        groupsPerProduct: Object.fromEntries(
          Object.entries(addon).map(([pid, cfg]) => [pid, (cfg.groups || []).length])
        ),
        kpisPerProduct: Object.fromEntries(
          Object.entries(addon).map(([pid, cfg]) => [pid, (cfg.customKpis || []).length])
        )
      }
    });
  } catch (err) {
    console.error('[admin-add-demo-revops]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
