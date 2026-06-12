// V37.4.30 — GET /api/debug-tenant-state
// Mostra o que o backend vê em tenant_state pelo MESMO caminho que state-sync.
// Pra rastrear por que state-sync cai em fallback journey_state_legacy.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  let resolvedTenantId = req.user.tenantId || null;
  let resolvedFrom = 'jwt';
  if (!resolvedTenantId) {
    try {
      const u = await req.db.query('SELECT default_tenant_id FROM users WHERE id = $1', [userId]);
      resolvedTenantId = u.rows[0]?.default_tenant_id || null;
      resolvedFrom = 'users.default_tenant_id';
    } catch (_) { resolvedFrom = 'fallback_failed'; }
  }

  const out = {
    ok: true,
    backendVersion: 'V37.4.30',
    jwt: {
      sub: userId,
      tenantIdInJwt: req.user.tenantId || null,
      isMaster: Boolean(req.user.isMaster)
    },
    resolvedTenantId,
    resolvedFrom,
    tenantDbIsControlPlane: req.tenantDb === req.db,
    tenantStateRows: null,
    journeyStateRowsForOwner: null,
    error: null
  };

  // Lista TODAS as rows de tenant_state no req.tenantDb.
  try {
    const r = await req.tenantDb.query(
      `SELECT tenant_id, last_writer_user_id, updated_at,
              jsonb_array_length(state_json->'products') AS products_count,
              jsonb_array_length(state_json->'campaigns') AS campaigns_count,
              jsonb_array_length(state_json->'actions') AS actions_count
       FROM tenant_state ORDER BY updated_at DESC`
    );
    out.tenantStateRows = r.rows.map(row => ({
      tenant_id: row.tenant_id,
      last_writer_user_id: row.last_writer_user_id,
      updated_at: row.updated_at,
      products_count: row.products_count,
      campaigns_count: row.campaigns_count,
      actions_count: row.actions_count
    }));
  } catch (err) {
    out.error = `tenant_state read falhou: ${err.message}`;
  }

  // Mesmo diagnóstico no journey_state — confere consistência.
  try {
    if (resolvedTenantId) {
      const ownerRow = await req.db.query(
        `SELECT user_id FROM tenant_members WHERE tenant_id = $1 AND LOWER(role) = 'owner' LIMIT 1`,
        [resolvedTenantId]
      );
      const ownerUserId = ownerRow.rows[0]?.user_id;
      if (ownerUserId) {
        const j = await req.tenantDb.query(
          `SELECT user_id, updated_at,
                  jsonb_array_length(state_json->'products') AS products_count,
                  jsonb_array_length(state_json->'campaigns') AS campaigns_count
           FROM journey_state WHERE user_id = $1`,
          [ownerUserId]
        );
        out.journeyStateRowsForOwner = {
          ownerUserId,
          row: j.rows[0] || null
        };
      }
    }
  } catch (err) {
    out.error = (out.error ? out.error + ' | ' : '') + `journey_state read falhou: ${err.message}`;
  }

  // Veredito.
  if (!resolvedTenantId) {
    out.verdict = 'no_tenant_id_resolved';
  } else if (!out.tenantStateRows) {
    out.verdict = 'tenant_state_table_or_query_failed';
  } else if (out.tenantStateRows.length === 0) {
    out.verdict = 'tenant_state_table_empty';
  } else if (!out.tenantStateRows.find(r => Number(r.tenant_id) === Number(resolvedTenantId))) {
    out.verdict = 'tenant_state_has_rows_but_not_for_this_tenant_id';
    out.tenantIdMismatch = {
      resolverExpects: resolvedTenantId,
      actualInDb: out.tenantStateRows.map(r => r.tenant_id)
    };
  } else {
    out.verdict = 'should_work_check_state-sync_code';
  }

  return res.status(200).json(out);
};
