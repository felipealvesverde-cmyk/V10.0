// V40.7.6 — Endpoint admin pra IMPUTAR um state JSON no journey_state do
// demo@leadjourney.app. Usado quando Felipe tem um snapshot local que precisa
// virar o estado do tenant demo (porque o fluxo natural de restore exige
// snapshotId existente no banco — aqui aceita JSON direto).
//
// Body: { state: <object>, applyAddon?: boolean }
//   - state: o objeto state_json completo a gravar
//   - applyAddon: se true, JÁ injeta os 2 produtos addon (Weiss + Chopp)
//                 logo após restaurar a Pilsen — 1 chamada faz tudo.
//
// Resposta: { ok, demoUserId, addonApplied, totals }
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  // V40.7.9 — Aceita master global OU o próprio user demo (admin do tenant engenho-norte).
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  try {
    const state = req.body?.state;
    const applyAddon = req.body?.applyAddon === true;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, message: 'Body precisa de { state: <object> }.' });
    }

    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    let finalState = state;

    if (applyAddon) {
      const { buildWeissChoppAddon, ADDON_VERSION } = require('../scripts/demo-add-weiss-chopp');
      const addon = buildWeissChoppAddon();
      const products = Array.isArray(state.products) ? state.products : [];
      const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
      const actions = Array.isArray(state.actions) ? state.actions : [];
      const executionTasks = Array.isArray(state.executionTasks) ? state.executionTasks : [];

      finalState = {
        ...state,
        products: [...products, ...addon.products],
        campaigns: [...campaigns, ...addon.campaigns],
        actions: [...actions, ...addon.actions],
        executionTasks: [...executionTasks, ...addon.executionTasks],
        __demoAddons: Array.from(new Set([...(state.__demoAddons || []), ADDON_VERSION])),
        lastSavedAt: new Date().toISOString()
      };
    }

    await req.db.query(
      `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
       VALUES ($1, $2, NOW(), $1)
       ON CONFLICT (user_id) DO UPDATE SET
         state_json = EXCLUDED.state_json,
         updated_at = NOW(),
         updated_by_user_id = EXCLUDED.updated_by_user_id`,
      [demoUserId, finalState]
    );

    return res.status(200).json({
      ok: true,
      demoUserId,
      addonApplied: applyAddon,
      totals: {
        products: (finalState.products || []).length,
        campaigns: (finalState.campaigns || []).length,
        actions: (finalState.actions || []).length,
        executionTasks: (finalState.executionTasks || []).length
      }
    });
  } catch (err) {
    console.error('[admin-restore-demo-state]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
