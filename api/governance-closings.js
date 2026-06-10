// V37.0.2 — CRUD de snapshots imutáveis da governança RevOps.
//
// Quatro tipos de snapshot coexistem (ver lib/tenant-db-schema.sql:
// lj_governance_closings):
//   • product_auto         (cron mensal cria, imutável)
//   • product_custom       (cliente cria refechando, imutável)
//   • consolidated_monthly (cron cria status=partial → cliente associa → complete)
//   • consolidated_custom  (cliente cria livremente)
//
// Endpoints:
//   GET  /api/governance-closings?period=YYYY-MM&kind=...&product_id=...
//     Lista snapshots do user. Filtros opcionais.
//
//   POST /api/governance-closings
//     Body: { kind, period, product_ids[], name?, intentionally_empty? }
//     Cria snapshot manual (product_custom ou consolidated_custom).
//     Lê journey_state do user, congela a governança no momento.
//
//   PATCH /api/governance-closings/:id
//     Body: { action: 'reopen' | 'associate', product_ids?, reason? }
//     • reopen: marca snapshot atual como superseded, devolve estado live (na
//       prática só registra o ato — cliente cria um custom novo pra refletir
//       o ajuste).
//     • associate: pra consolidated_monthly partial → vira complete com os
//       product_ids escolhidos. snapshot_json é recomposto.

const VALID_KINDS = ['product_auto', 'product_custom', 'consolidated_monthly', 'consolidated_custom'];

// Compõe snapshot de UM produto a partir do state_json do journey_state.
// Snapshot conserva os INPUTS da governança — frontend re-roda engine quando
// renderiza o snapshot (engine vive 100% no front).
function composeProductSnapshot(stateJson, productId, period) {
  const product = (stateJson.products || []).find(p => String(p.id) === String(productId));
  if (!product) return null;
  const meta = stateJson.metasResultado && stateJson.metasResultado[productId]
    ? stateJson.metasResultado[productId][period] || { vendas: 0, cac: 0 }
    : { vendas: 0, cac: 0 };
  return {
    schemaVersion: 'v37.0.2',
    capturedAt: new Date().toISOString(),
    period,
    productId: product.id,
    productName: product.name || null,
    revopsConfig: product.revopsConfig || null,
    salesProjection: Number(product.salesProjection) || 0,
    metas: { vendas: Number(meta.vendas) || 0, cac: Number(meta.cac) || 0 }
  };
}

function composeConsolidatedSnapshot(stateJson, productIds, period) {
  const ids = Array.isArray(productIds) ? productIds : [];
  const productSnapshots = ids.map(pid => composeProductSnapshot(stateJson, pid, period)).filter(Boolean);
  return {
    schemaVersion: 'v37.0.2',
    capturedAt: new Date().toISOString(),
    period,
    productIds: ids,
    productCount: productSnapshots.length,
    products: productSnapshots
  };
}

async function loadStateJson(db, userId) {
  const r = await db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [userId]);
  return r.rows[0]?.state_json || {};
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco do tenant indisponível.' });

  const userId = req.user.sub;
  const db = req.tenantDb;

  // ============================================================
  // GET — lista snapshots
  // ============================================================
  if (req.method === 'GET') {
    const period = req.query?.period ? String(req.query.period) : null;
    const kind = req.query?.kind ? String(req.query.kind) : null;
    const productId = req.query?.product_id ? String(req.query.product_id) : null;
    const filters = ['user_id = $1'];
    const params = [userId];
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      filters.push(`period = $${params.length + 1}`);
      params.push(period);
    }
    if (kind && VALID_KINDS.includes(kind)) {
      filters.push(`kind = $${params.length + 1}`);
      params.push(kind);
    }
    if (productId) {
      filters.push(`product_ids @> $${params.length + 1}::jsonb`);
      params.push(JSON.stringify([productId]));
    }
    try {
      const r = await db.query(
        `SELECT id, period, kind, product_ids, name, status, intentionally_empty,
                snapshot_json, source, closed_at, completed_at, reopens_log
         FROM lj_governance_closings
         WHERE ${filters.join(' AND ')}
         ORDER BY period DESC, closed_at DESC
         LIMIT 500`,
        params
      );
      return res.status(200).json({ ok: true, closings: r.rows });
    } catch (err) {
      console.error('[governance-closings GET]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  // ============================================================
  // POST — cria snapshot manual (product_custom ou consolidated_custom)
  // ============================================================
  if (req.method === 'POST') {
    const body = req.body || {};
    const kind = String(body.kind || '');
    const period = String(body.period || '');
    const productIds = Array.isArray(body.product_ids) ? body.product_ids.map(String) : [];
    const name = body.name ? String(body.name).slice(0, 200) : null;

    if (!VALID_KINDS.includes(kind)) {
      return res.status(400).json({ ok: false, message: 'kind inválido.' });
    }
    if (kind === 'product_auto' || kind === 'consolidated_monthly') {
      return res.status(400).json({ ok: false, message: 'Esses tipos só são criados pelo cron mensal.' });
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ ok: false, message: 'period deve ser YYYY-MM.' });
    }
    if (!productIds.length) {
      return res.status(400).json({ ok: false, message: 'product_ids vazio.' });
    }
    if (kind === 'product_custom' && productIds.length !== 1) {
      return res.status(400).json({ ok: false, message: 'product_custom precisa de exatamente 1 produto.' });
    }

    try {
      const stateJson = await loadStateJson(db, userId);
      const snapshot = kind === 'product_custom'
        ? composeProductSnapshot(stateJson, productIds[0], period)
        : composeConsolidatedSnapshot(stateJson, productIds, period);
      if (!snapshot) {
        return res.status(404).json({ ok: false, message: 'Produto não encontrado no state.' });
      }
      const r = await db.query(
        `INSERT INTO lj_governance_closings
           (user_id, period, kind, product_ids, name, status, snapshot_json, source, closed_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, 'complete', $6::jsonb, 'manual', NOW())
         RETURNING id, period, kind, product_ids, name, status, snapshot_json, source, closed_at`,
        [userId, period, kind, JSON.stringify(productIds), name, JSON.stringify(snapshot)]
      );
      return res.status(201).json({ ok: true, closing: r.rows[0] });
    } catch (err) {
      console.error('[governance-closings POST]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  // ============================================================
  // PATCH — reabrir / associar
  // ============================================================
  if (req.method === 'PATCH') {
    const closingId = Number(req.query?.id || (req.body && req.body.id));
    if (!closingId) return res.status(400).json({ ok: false, message: 'id obrigatório.' });
    const body = req.body || {};
    const action = String(body.action || '');

    try {
      const existing = await db.query(
        'SELECT id, kind, period, status, product_ids, reopens_log FROM lj_governance_closings WHERE id = $1 AND user_id = $2',
        [closingId, userId]
      );
      if (!existing.rows.length) return res.status(404).json({ ok: false, message: 'Snapshot não encontrado.' });
      const row = existing.rows[0];

      if (action === 'associate') {
        if (row.kind !== 'consolidated_monthly') {
          return res.status(400).json({ ok: false, message: 'associate só vale pra consolidated_monthly.' });
        }
        const productIds = Array.isArray(body.product_ids) ? body.product_ids.map(String) : [];
        const intentionallyEmpty = productIds.length === 0;
        const stateJson = await loadStateJson(db, userId);
        const snapshot = composeConsolidatedSnapshot(stateJson, productIds, row.period);
        const r = await db.query(
          `UPDATE lj_governance_closings
             SET product_ids = $1::jsonb,
                 status = 'complete',
                 intentionally_empty = $2,
                 snapshot_json = $3::jsonb,
                 completed_at = NOW()
           WHERE id = $4 AND user_id = $5
           RETURNING id, period, kind, product_ids, status, intentionally_empty, snapshot_json, completed_at`,
          [JSON.stringify(productIds), intentionallyEmpty, JSON.stringify(snapshot), closingId, userId]
        );
        return res.status(200).json({ ok: true, closing: r.rows[0] });
      }

      if (action === 'reopen') {
        const reason = body.reason ? String(body.reason).slice(0, 500) : null;
        const log = Array.isArray(row.reopens_log) ? row.reopens_log : [];
        log.push({ at: new Date().toISOString(), by_user_id: userId, reason });
        // Reabrir consolidated_monthly volta status pra partial.
        const newStatus = row.kind === 'consolidated_monthly' ? 'partial' : row.status;
        const r = await db.query(
          `UPDATE lj_governance_closings
             SET reopens_log = $1::jsonb,
                 status = $2,
                 completed_at = NULL
           WHERE id = $3 AND user_id = $4
           RETURNING id, period, kind, status, reopens_log`,
          [JSON.stringify(log), newStatus, closingId, userId]
        );
        return res.status(200).json({ ok: true, closing: r.rows[0] });
      }

      return res.status(400).json({ ok: false, message: 'action inválido. Use "reopen" ou "associate".' });
    } catch (err) {
      console.error('[governance-closings PATCH]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Método não suportado.' });
};

// Expostos pra reuso pelo cron-monthly-closing.
module.exports.composeProductSnapshot = composeProductSnapshot;
module.exports.composeConsolidatedSnapshot = composeConsolidatedSnapshot;
module.exports.loadStateJson = loadStateJson;
