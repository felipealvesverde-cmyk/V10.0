// V32.10.6 — GET /api/admin-tenant-snapshots?tenant_slug=X
// Master-only. Lista snapshots de um tenant escolhido com PREVIEW de conteúdo
// (não só label/timestamp). Permite identificar qual snapshot tem dados RevOps
// completos antes de restaurar.
//
// Resposta:
//   {
//     ok: true,
//     tenant: { id, slug, name },
//     users: [{ user_id, username }],
//     snapshots: [{
//       id, label, created_at, triggered_by_user_id,
//       owner_user_id,
//       preview: {
//         products, campaigns, actions, leads,
//         revopsGroups, revopsItems, revopsOffers, revopsCustomKpis,
//         revopsHasOverrides, totalKb
//       }
//     }]
//   }
//
// Usado pelo painel admin pra recuperar dados perdidos sem precisar do cliente
// final entrar no LJ (incidente Sansone V32.10.x).

const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane não configurado.' });

  const tenantSlug = String(req.query?.tenant_slug || '').trim().toLowerCase();
  if (!tenantSlug) return res.status(400).json({ ok: false, message: 'tenant_slug obrigatório.' });

  try {
    // 1. Localiza o tenant
    const tenantRes = await req.db.query(
      'SELECT id, slug, name, status FROM tenants WHERE LOWER(slug) = $1 LIMIT 1',
      [tenantSlug]
    );
    if (!tenantRes.rows.length) return res.status(404).json({ ok: false, message: `Tenant "${tenantSlug}" não encontrado.` });
    const tenant = tenantRes.rows[0];

    // 2. Abre pool do tenant (ou control plane se ainda não migrado)
    let tenantPool;
    try {
      tenantPool = await tenantPoolHelper.getTenantPool(req.db, tenant.id);
      if (!tenantPool) tenantPool = req.db;
    } catch (err) {
      return res.status(500).json({ ok: false, message: `Falha ao abrir pool do tenant: ${err.message}` });
    }

    // 3. Lista usuários COM journey_state (cobre tenants multi-user)
    let users = [];
    try {
      const usersRes = await req.db.query(
        'SELECT id, username, email FROM users WHERE tenant_id = $1 ORDER BY id',
        [tenant.id]
      );
      users = usersRes.rows;
    } catch (_) { users = []; }

    // 4. Lista snapshots do tenant (todos os owners)
    const snapsRes = await tenantPool.query(
      `SELECT id, label, created_at, triggered_by_user_id, owner_user_id, state_json
       FROM journey_snapshots
       ORDER BY created_at DESC
       LIMIT 100`
    );
    const snapshots = snapsRes.rows.map(s => {
      const state = s.state_json || {};
      // Compute preview rico — usado pra identificar qual snapshot tem dados RevOps
      const revopsV2 = state.revopsFinanceV2 || {};
      const revopsLegacy = state.revopsFinance || {};
      let revopsGroups = 0, revopsItems = 0, revopsOffers = 0, revopsCustomKpis = 0;
      // V2 (formato novo whitelabel)
      for (const cfg of Object.values(revopsV2)) {
        if (!cfg) continue;
        revopsGroups += (cfg.groups || []).length;
        revopsItems += (cfg.groups || []).reduce((sum, g) => sum + ((g.items || []).length), 0);
        revopsOffers += (cfg.offers || []).length;
        revopsCustomKpis += (cfg.customKpis || []).length;
      }
      // Legacy V14 (formato antigo)
      let revopsLegacyHasData = false;
      for (const cfg of Object.values(revopsLegacy)) {
        if (!cfg) continue;
        const fcCount = ['software', 'people', 'structure', 'others']
          .reduce((sum, key) => sum + ((cfg.fixedCosts?.[key]?.items || []).length), 0);
        const acqCount = (cfg.acquisitionCosts?.items || []).length;
        const vcCount = (cfg.variableCosts || []).length;
        const offersCount = (cfg.offers || []).length;
        if (fcCount + acqCount + vcCount + offersCount > 0) revopsLegacyHasData = true;
      }
      const totalKb = Math.round(JSON.stringify(state).length / 1024);
      return {
        id: s.id,
        label: s.label,
        created_at: s.created_at,
        triggered_by_user_id: s.triggered_by_user_id,
        owner_user_id: s.owner_user_id,
        preview: {
          products: (state.products || []).length,
          campaigns: (state.campaigns || []).length,
          actions: (state.actions || []).length,
          leads: (state.globalLeads || []).length,
          revopsGroups, revopsItems, revopsOffers, revopsCustomKpis,
          revopsLegacyHasData,
          revopsHasOverrides: Object.keys(state.revopsKpiOverrides || {}).length > 0,
          totalKb
        }
      };
    });

    return res.status(200).json({
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status },
      users,
      snapshots
    });
  } catch (err) {
    console.error('[admin-tenant-snapshots]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
