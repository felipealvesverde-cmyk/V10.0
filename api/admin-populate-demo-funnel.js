// V40.11.18 — Popula funil 9 etapas das actions do produto demo com shape
// customizado. Diferente do admin-add-demo-conversions (que seta o MESMO
// manualConverted em todas as stages como workaround V40.7.14), aqui aceita
// 9 valores específicos — um por etapa — pra modelar funis com taxas
// decrescentes realistas (Cenário A "Massa": 875k → 350k → 175k → ... → 117k).
//
// Distribui o funil shape entre as actions do produto proporcionalmente ao
// peso natural (sector × funnel da action). Cada action recebe sua fatia do
// shape — soma cross-actions = funnelShape total.
//
// Body:
//   {
//     productId: 1781869701831,
//     funnelShape: {
//       'marketing-tof': 875000,
//       'marketing-mof': 350000,
//       'marketing-bof': 175000,
//       'vendas-tof':    140000,
//       'vendas-mof':    126000,
//       'vendas-bof':    122000,
//       'cs-tof':        120000,
//       'cs-mof':        118000,
//       'cs-bof':        117000
//     }
//   }
//
// Retorna newState pra evitar race com auto-save (padrão V40.7.10).

const STAGE_ORDER = ['marketing-tof','marketing-mof','marketing-bof','vendas-tof','vendas-mof','vendas-bof','cs-tof','cs-mof','cs-bof'];

const SECTOR_WEIGHT = { sales: 4, cs: 2, marketing: 1 };
const FUNNEL_WEIGHT = { BOF: 3, MOF: 2, TOF: 1 };

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  const { productId, funnelShape } = req.body || {};
  if (!productId) return res.status(400).json({ ok: false, message: 'productId obrigatório.' });
  if (!funnelShape || typeof funnelShape !== 'object') return res.status(400).json({ ok: false, message: 'funnelShape obrigatório.' });

  // Valida shape: cada stage do STAGE_ORDER deve ter valor numérico
  for (const stage of STAGE_ORDER) {
    if (funnelShape[stage] === undefined || funnelShape[stage] === null) {
      return res.status(400).json({ ok: false, message: `funnelShape['${stage}'] obrigatório.` });
    }
    if (typeof funnelShape[stage] !== 'number' || funnelShape[stage] < 0) {
      return res.status(400).json({ ok: false, message: `funnelShape['${stage}'] inválido.` });
    }
  }

  try {
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existing.rowCount === 0) return res.status(409).json({ ok: false, message: 'Demo sem state.' });

    const state = existing.rows[0].state_json || {};
    const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    const actions = Array.isArray(state.actions) ? state.actions : [];

    const campaignToProduct = new Map();
    for (const c of campaigns) campaignToProduct.set(Number(c.id), Number(c.productId));

    const productActions = actions.filter(a => {
      const pid = campaignToProduct.get(Number(a.campaignId));
      return Number(pid) === Number(productId);
    });

    if (!productActions.length) {
      return res.status(404).json({ ok: false, message: `Nenhuma action vinculada ao produto ${productId}.` });
    }

    // Peso por action (sector × funnel)
    const weights = productActions.map(a => {
      const sec = String(a.sector || a.originSector || '').toLowerCase();
      const fun = String(a.funnel || a.originFunnel || '').toUpperCase();
      const sw = SECTOR_WEIGHT[sec] || 1;
      const fw = FUNNEL_WEIGHT[fun] || 1;
      return sw * fw;
    });
    const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

    // Distribui cada stage do shape entre as actions proporcionalmente.
    // Última action pega o resto pra fechar exato em cada stage.
    const stageDistribution = {};
    for (const stage of STAGE_ORDER) {
      const total = Number(funnelShape[stage]);
      stageDistribution[stage] = [];
      let distributed = 0;
      productActions.forEach((a, idx) => {
        const isLast = idx === productActions.length - 1;
        let value;
        if (isLast) {
          value = total - distributed;
        } else {
          value = Math.round((weights[idx] / totalWeight) * total);
          distributed += value;
        }
        if (value < 0) value = 0;
        stageDistribution[stage].push(value);
      });
    }

    // Aplica nas actions
    const updatedActionIds = new Set();
    productActions.forEach((a, idx) => {
      let flowConfig = Array.isArray(a.flowConfig) && a.flowConfig.length
        ? a.flowConfig.map(c => ({ ...c }))
        : (Array.isArray(a.flowPath) ? a.flowPath.map(stageId => ({
            stageId, enabled: true, channelName: '', manualConverted: null
          })) : []);

      if (!flowConfig.length) {
        // Cria flowConfig completo com 9 stages se não existir
        flowConfig = STAGE_ORDER.map(stageId => ({
          stageId, enabled: true, channelName: '', manualConverted: null
        }));
      }

      // Garante que TODAS as 9 stages estão presentes e enabled
      const byStage = new Map(flowConfig.map(c => [c.stageId, c]));
      const completeFlowConfig = STAGE_ORDER.map(stageId => {
        const existing = byStage.get(stageId);
        if (existing) return { ...existing, enabled: true, manualConverted: stageDistribution[stageId][idx] };
        return { stageId, enabled: true, channelName: '', manualConverted: stageDistribution[stageId][idx] };
      });

      a.flowConfig = completeFlowConfig;
      a.flowPath = STAGE_ORDER.slice();
      updatedActionIds.add(a.id);
    });

    const newState = {
      ...state,
      actions,
      __demoAddons: Array.from(new Set([...(state.__demoAddons || []), `demo-funnel-${productId}`])),
      lastSavedAt: new Date().toISOString()
    };

    await req.db.query(
      `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2 WHERE user_id = $2`,
      [newState, demoUserId]
    );

    // V40.11.19 — Retorna APENAS o delta (actions), não o state inteiro.
    // Caller faz patch cirúrgico (App.state.actions = data.actions) preservando
    // caches voláteis (pipelineVelocityCache, etc) que State.normalize zeraria.
    // Achado #15 do inventário cobre o débito do padrão antigo.
    return res.status(200).json({
      ok: true,
      applied: true,
      productId,
      actionsUpdated: updatedActionIds.size,
      stageDistribution,
      actions
    });
  } catch (err) {
    console.error('[admin-populate-demo-funnel]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
