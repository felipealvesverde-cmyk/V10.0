// V40.7.15 — Endpoint admin que injeta Mapa da Receita + Audiência composicional
// + ~150 leads fictícios no journey_state do demo, distribuídos pelos 3 produtos.
//
// POST /api/admin-add-demo-mapa-audiencia-leads
// Body: {} ou { force: true }
// Resposta: { ok, applied, addonVersion, meta, newState }
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  try {
    const { buildMapaAudienciaLeadsAddon, ADDON_VERSION } = require('../scripts/demo-mapa-audiencia-leads');
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const force = req.body && req.body.force === true;

    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existing.rowCount === 0) return res.status(409).json({ ok: false, message: 'Demo user sem state.' });

    const state = existing.rows[0].state_json || {};
    const addons = state.__demoAddons || [];
    if (addons.includes(ADDON_VERSION) && !force) {
      return res.status(200).json({
        ok: true,
        applied: false,
        reason: 'Já aplicado. Use { "force": true } pra reaplicar.',
        addonVersion: ADDON_VERSION
      });
    }

    const addon = buildMapaAudienciaLeadsAddon(state);

    const existingStrategicMaps = state.strategicMaps && typeof state.strategicMaps === 'object' ? state.strategicMaps : {};
    const existingManualLeads = Array.isArray(state.manualLeads) ? state.manualLeads : [];

    const newState = {
      ...state,
      products: addon.products,                   // produtos com audience preenchida
      actions: addon.actions,                     // ações com leads preenchidas
      strategicMaps: { ...existingStrategicMaps, ...addon.strategicMaps }, // mescla
      manualLeads: force
        ? addon.manualLeads
        : [...existingManualLeads, ...addon.manualLeads],
      __demoAddons: Array.from(new Set([...addons, ADDON_VERSION])),
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
      meta: addon.meta,
      newState
    });
  } catch (err) {
    console.error('[admin-add-demo-mapa-audiencia-leads]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
