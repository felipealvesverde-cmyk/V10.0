// V40.7.5 — Endpoint admin que ADICIONA 2 produtos novos (Cerveja Weiss +
// Chopp de Vinho) ao state do demo@leadjourney.app sem destruir nada do que
// já existe (Cerveja Pilsen, configs do user, etc).
//
// Diferente de admin-reseed-demo (que SUBSTITUI o state inteiro), este endpoint:
//   1. Lê journey_state atual do demo user
//   2. Merge: anexa novos produtos/campanhas/ações/execuções aos arrays existentes
//   3. Salva
//
// Idempotente: se já achou produto id 5001 no state, pula (já aplicado).
//
// POST /api/admin-add-demo-products
// Body: {} (vazio) ou { force: true } pra reaplicar mesmo se já estiver
// Resposta: { ok, applied, addonVersion, counts, demoUserId }
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode aplicar.' });

  try {
    const { buildWeissChoppAddon, ADDON_VERSION } = require('../scripts/demo-add-weiss-chopp');
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const force = req.body && req.body.force === true;

    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe ainda.' });

    const existingRow = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existingRow.rowCount === 0) {
      return res.status(409).json({ ok: false, message: 'Demo user não tem state ainda. Crie a Cerveja Pilsen ou rode admin-reseed-demo primeiro.' });
    }

    const state = existingRow.rows[0].state_json || {};
    const products = Array.isArray(state.products) ? state.products : [];
    const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    const actions = Array.isArray(state.actions) ? state.actions : [];
    const executionTasks = Array.isArray(state.executionTasks) ? state.executionTasks : [];

    // Idempotência: checa se já foi aplicado (produto 5001 ou meta).
    const alreadyApplied = products.some(p => Number(p?.id) === 5001) || (state.__demoAddons || []).includes(ADDON_VERSION);
    if (alreadyApplied && !force) {
      return res.status(200).json({
        ok: true,
        applied: false,
        reason: 'Já aplicado anteriormente. Use { "force": true } pra reaplicar.',
        addonVersion: ADDON_VERSION,
        demoUserId,
        currentCounts: {
          products: products.length,
          campaigns: campaigns.length,
          actions: actions.length,
          executionTasks: executionTasks.length
        }
      });
    }

    const addon = buildWeissChoppAddon();

    // Se force=true, remove os IDs antigos do addon antes de re-inserir (evita duplicação).
    const addonProductIds = new Set(addon.products.map(p => Number(p.id)));
    const addonCampaignIds = new Set(addon.campaigns.map(c => Number(c.id)));
    const addonActionIds = new Set(addon.actions.map(a => Number(a.id)));
    const addonTaskIds = new Set(addon.executionTasks.map(t => String(t.task_id)));

    const cleanProducts = force ? products.filter(p => !addonProductIds.has(Number(p?.id))) : products;
    const cleanCampaigns = force ? campaigns.filter(c => !addonCampaignIds.has(Number(c?.id))) : campaigns;
    const cleanActions = force ? actions.filter(a => !addonActionIds.has(Number(a?.id))) : actions;
    const cleanTasks = force ? executionTasks.filter(t => !addonTaskIds.has(String(t?.task_id))) : executionTasks;

    const newState = {
      ...state,
      products: [...cleanProducts, ...addon.products],
      campaigns: [...cleanCampaigns, ...addon.campaigns],
      actions: [...cleanActions, ...addon.actions],
      executionTasks: [...cleanTasks, ...addon.executionTasks],
      __demoAddons: Array.from(new Set([...(state.__demoAddons || []), ADDON_VERSION])),
      lastSavedAt: new Date().toISOString()
    };

    await req.db.query(
      `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2 WHERE user_id = $2`,
      [newState, demoUserId]
    );

    return res.status(200).json({
      ok: true,
      applied: true,
      addonVersion: ADDON_VERSION,
      demoUserId,
      added: addon.meta.counts,
      newTotals: {
        products: newState.products.length,
        campaigns: newState.campaigns.length,
        actions: newState.actions.length,
        executionTasks: newState.executionTasks.length
      }
    });
  } catch (err) {
    console.error('[admin-add-demo-products]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
