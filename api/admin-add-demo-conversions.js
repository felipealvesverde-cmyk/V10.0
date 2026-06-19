// V40.7.13 — Endpoint admin que distribui as vendas realizadas do demo
// nas ações dos 3 produtos. O Resultado Consolidado lê "Vendas Reais
// (convertidas)" via FlowResolutionEngine.buildActionFlow(action).converted,
// que depende de flowConfig[última_etapa].manualConverted estar setado.
//
// Distribuição:
//   - Pilsen (id 1781869701831): 9.600 vendas → distribuídas nas ações
//   - Weiss (5001):              3.600 vendas
//   - Chopp Vinho (5002):          960 vendas
//
// Por ação: setor BOF/Vendas pega mais peso; TOF/Marketing pega menos.
// Retorna newState pra evitar race com auto-save (mesmo padrão V40.7.10).

const VOLUMES = {
  1781869701831: 9600,
  5001:          3600,
  5002:           960
};

// Peso por setor — Vendas converte mais, depois CS, depois Marketing.
const SECTOR_WEIGHT = { sales: 4, cs: 2, marketing: 1 };
const FUNNEL_WEIGHT = { BOF: 3, MOF: 2, TOF: 1 };

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  try {
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existing.rowCount === 0) return res.status(409).json({ ok: false, message: 'Demo sem state.' });

    const state = existing.rows[0].state_json || {};
    const products = Array.isArray(state.products) ? state.products : [];
    const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    const actions = Array.isArray(state.actions) ? state.actions : [];

    // Agrupa ações por produto via campaign.productId
    const campaignToProduct = new Map();
    for (const c of campaigns) campaignToProduct.set(Number(c.id), Number(c.productId));

    const actionsByProduct = new Map();
    for (const a of actions) {
      const pid = campaignToProduct.get(Number(a.campaignId));
      if (!pid) continue;
      if (!actionsByProduct.has(pid)) actionsByProduct.set(pid, []);
      actionsByProduct.get(pid).push(a);
    }

    const summary = {};
    const updatedActionIds = new Set();

    for (const [productIdStr, totalConverted] of Object.entries(VOLUMES)) {
      const productId = Number(productIdStr);
      const productActions = actionsByProduct.get(productId) || [];
      if (!productActions.length) { summary[productId] = { actions: 0, totalDistributed: 0 }; continue; }

      // Peso = sector × funnel
      const weights = productActions.map(a => {
        const sec = String(a.sector || a.originSector || '').toLowerCase();
        const fun = String(a.funnel || a.originFunnel || '').toUpperCase();
        const sw = SECTOR_WEIGHT[sec] || 1;
        const fw = FUNNEL_WEIGHT[fun] || 1;
        return sw * fw;
      });
      const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

      let distributedSoFar = 0;
      productActions.forEach((a, idx) => {
        const isLast = idx === productActions.length - 1;
        let converted;
        if (isLast) {
          // Última ação pega o resto pra fechar exato
          converted = totalConverted - distributedSoFar;
        } else {
          converted = Math.round((weights[idx] / totalWeight) * totalConverted);
          distributedSoFar += converted;
        }
        if (converted < 0) converted = 0;

        // Pega o flowConfig atual ou cria um básico a partir do flowPath
        let flowConfig = Array.isArray(a.flowConfig) && a.flowConfig.length
          ? a.flowConfig.map(c => ({ ...c }))
          : (Array.isArray(a.flowPath) ? a.flowPath.map(stageId => ({
              stageId, enabled: true, channelName: '', manualConverted: null
            })) : []);

        if (flowConfig.length) {
          // Última etapa do flow recebe o manualConverted
          flowConfig[flowConfig.length - 1].manualConverted = converted;
          a.flowConfig = flowConfig;
          updatedActionIds.add(a.id);
        }
      });

      summary[productId] = {
        actions: productActions.length,
        totalDistributed: totalConverted
      };
    }

    const newState = {
      ...state,
      actions, // já mutado in-place
      __demoAddons: Array.from(new Set([...(state.__demoAddons || []), 'demo-conversions-v1'])),
      lastSavedAt: new Date().toISOString()
    };

    await req.db.query(
      `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2 WHERE user_id = $2`,
      [newState, demoUserId]
    );

    return res.status(200).json({
      ok: true,
      applied: true,
      demoUserId,
      updatedActionsCount: updatedActionIds.size,
      summary,
      newState
    });
  } catch (err) {
    console.error('[admin-add-demo-conversions]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
