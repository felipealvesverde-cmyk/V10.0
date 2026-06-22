// V40.11.23 — Ajusta composição de custos do produto demo (revopsFinanceV2[productId].groups).
// Aceita { bucket, label, items: [{name, value}] } e substitui o group daquele bucket
// pelos items fornecidos. Endpoint genérico — serve pra calibrar S&M (bucket='acquisition'),
// G&A (bucket='fixed'), variáveis (bucket='variable'), etc.
//
// Body:
//   {
//     productId: 1781869701831,
//     bucket: 'acquisition',
//     label: 'S&M (Comercial)',
//     items: [
//       { name: 'Time comercial + Marketing + Ads', value: 268000 }
//     ]
//   }
//
// Retorna delta: { ok, productFinance } (apenas revopsFinanceV2[productId]).
// Caller faz patch cirúrgico: App.state.revopsFinanceV2[productId] = data.productFinance.

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  const { productId, bucket, label, items } = req.body || {};
  if (!productId) return res.status(400).json({ ok: false, message: 'productId obrigatório.' });
  if (!bucket || !['fixed', 'acquisition', 'variable', 'custom'].includes(bucket)) {
    return res.status(400).json({ ok: false, message: 'bucket inválido (fixed|acquisition|variable|custom).' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ ok: false, message: 'items obrigatório (array).' });
  }

  try {
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existing.rowCount === 0) return res.status(409).json({ ok: false, message: 'Demo sem state.' });

    const state = existing.rows[0].state_json || {};
    state.revopsFinanceV2 = state.revopsFinanceV2 || {};
    state.revopsFinanceV2[productId] = state.revopsFinanceV2[productId] || { groups: [] };

    const pfin = state.revopsFinanceV2[productId];
    pfin.groups = Array.isArray(pfin.groups) ? pfin.groups : [];

    // Acha (ou cria) group do bucket especificado
    let g = pfin.groups.find(gr => gr.bucket === bucket);
    const ts = Date.now().toString(36);
    if (!g) {
      g = {
        id: `g_${bucket}_${ts}`,
        label: label || (bucket === 'acquisition' ? 'S&M' : bucket === 'fixed' ? 'Fixos' : bucket),
        bucket,
        items: []
      };
      pfin.groups.push(g);
    } else if (label) {
      g.label = label;
    }

    // Substitui items
    g.items = items.map((it, idx) => ({
      id: `item_${bucket}_${ts}_${idx}`,
      name: String(it.name || `Item ${idx + 1}`),
      calc: { mode: 'fixed', value: Number(it.value) || 0 }
    }));

    const newState = {
      ...state,
      revopsFinanceV2: state.revopsFinanceV2,
      lastSavedAt: new Date().toISOString()
    };

    await req.db.query(
      `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2 WHERE user_id = $2`,
      [newState, demoUserId]
    );

    // Retorna apenas o delta (revopsFinanceV2[productId]) pra patch cirúrgico — achado #15
    return res.status(200).json({
      ok: true,
      applied: true,
      productId,
      bucket,
      groupId: g.id,
      itemsCount: g.items.length,
      productFinance: pfin
    });
  } catch (err) {
    console.error('[admin-set-demo-composition]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
