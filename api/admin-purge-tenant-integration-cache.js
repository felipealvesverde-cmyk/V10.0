// V41.0.6 — POST /api/admin-purge-tenant-integration-cache
//
// Master OU membro do tenant. Zera os 5 campos de status de integração no
// state_json do owner do tenant:
//   - clickupStatus
//   - googleAdsStatus
//   - ga4Status
//   - hotmartStatus
//   - rdConnectionStatus
//
// Caso de uso: cliente vê "X desconectou" mas servidor está conectado.
// É cache stale do client. Zerar esses campos no banco força o cliente a
// re-fetchar do servidor no próximo F5 (boot chama loadClickupStatus etc.
// que populam o state com valor fresco).
//
// Body: { tenant_slug }
// Retorna: { ok, purgedUsers: [user_id], fieldsZeroed: [...] }

const FIELDS_TO_PURGE = [
  'clickupStatus',
  'googleAdsStatus',
  'ga4Status',
  'hotmartStatus',
  'rdConnectionStatus'
];

const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane não configurado.' });

  const tenantSlug = String(req.body?.tenant_slug || '').trim().toLowerCase();
  if (!tenantSlug) return res.status(400).json({ ok: false, message: 'tenant_slug obrigatório.' });

  try {
    const tenantRes = await req.db.query(
      'SELECT id, slug, name, owner_user_id FROM tenants WHERE LOWER(slug) = $1 LIMIT 1',
      [tenantSlug]
    );
    if (!tenantRes.rows.length) return res.status(404).json({ ok: false, message: `Tenant "${tenantSlug}" não encontrado.` });
    const tenant = tenantRes.rows[0];

    // Master sempre passa; non-master só passa se for membro do tenant.
    if (!req.user.isMaster && Number(req.user.tenantId) !== Number(tenant.id)) {
      return res.status(403).json({ ok: false, message: 'Apenas master ou membro do tenant.' });
    }

    let tenantPool;
    try {
      tenantPool = await tenantPoolHelper.getTenantPool(req.db, tenant.id);
      if (!tenantPool) tenantPool = req.db;
    } catch (err) {
      return res.status(500).json({ ok: false, message: `Falha pool: ${err.message}` });
    }

    // Zera os 5 campos no state_json de TODOS os users com journey_state nesse
    // tenant (geralmente só o owner — mas se houver members com state próprio,
    // limpa todos). jsonb_set com path de cada campo seria verboso; usamos `-`
    // (delete key) pra cada campo. Operador `#-` aceita só path único, então
    // 5 calls em chain via subquery seria menos legível que loop em JS.
    const purgedUsers = [];
    const usersRes = await tenantPool.query('SELECT user_id, state_json FROM journey_state');
    for (const row of usersRes.rows) {
      const state = row.state_json || {};
      let changed = false;
      for (const f of FIELDS_TO_PURGE) {
        if (Object.prototype.hasOwnProperty.call(state, f)) {
          delete state[f];
          changed = true;
        }
      }
      if (changed) {
        await tenantPool.query(
          `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2
           WHERE user_id = $3`,
          [state, req.user.sub, row.user_id]
        );
        purgedUsers.push(row.user_id);
      }
    }

    return res.status(200).json({
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      purgedUsers,
      fieldsZeroed: FIELDS_TO_PURGE,
      message: purgedUsers.length
        ? `Cache zerado pra ${purgedUsers.length} user(s). Peça pro cliente fazer F5 — o boot vai re-fetchar status fresco do servidor.`
        : 'Nenhum cache stale encontrado (todos os users já estavam limpos).'
    });
  } catch (err) {
    console.error('[admin-purge-tenant-integration-cache]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
