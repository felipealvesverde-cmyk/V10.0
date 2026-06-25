// V41.0.3 — GET /api/admin-debug-tenant-credentials?tenant_slug=<slug>
//
// Diagnóstico read-only: lista, pro owner do tenant, qual o estado das 5
// tabelas de credentials (clickup, google_ads, ga4, hotmart, rd). Retorna SÓ
// metadata não-sensível (workspace_name, configured, oauth_completed,
// last_sync_at, etc) — NUNCA campos _enc nem tokens em claro.
//
// V41.0.4 — Aceita master OU owner do próprio tenant (pra cliente conseguir
// diagnosticar a si mesmo sem precisar do master).
//
// Cenário: cliente perdeu credentials e queremos saber se Client ID/Secret
// ainda existem criptografados no banco (clickup_config tem linha mas
// clickup_credentials não) — nesse caso basta refazer a autorização sem criar
// app novo no ClickUp.

const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane não configurado.' });

  const tenantSlug = String(req.query?.tenant_slug || '').trim().toLowerCase();
  if (!tenantSlug) return res.status(400).json({ ok: false, message: 'tenant_slug obrigatório (?tenant_slug=sansone).' });

  try {
    const tenantRes = await req.db.query(
      'SELECT id, slug, name, owner_user_id FROM tenants WHERE LOWER(slug) = $1 LIMIT 1',
      [tenantSlug]
    );
    if (!tenantRes.rows.length) return res.status(404).json({ ok: false, message: `Tenant "${tenantSlug}" não encontrado.` });
    const tenant = tenantRes.rows[0];

    // V41.0.4 — autorização: master sempre passa; non-master só passa se for
    // membro do tenant pedido (req.user.tenantId === tenant.id).
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

    // Lista TODOS os user_ids que têm linha em journey_state nesse tenant
    // (geralmente só 1 — o owner). Pra cada, levanta diagnóstico de cada
    // tabela de credentials.
    const usersRes = await tenantPool.query('SELECT user_id FROM journey_state ORDER BY user_id');
    const users = usersRes.rows.map(r => r.user_id);

    async function safeOne(sql, params) {
      try {
        const r = await tenantPool.query(sql, params);
        return r.rows[0] || null;
      } catch (_) { return null; }
    }
    async function safeCount(sql, params) {
      try {
        const r = await tenantPool.query(sql, params);
        return Number(r.rows[0]?.c || 0);
      } catch (_) { return 0; }
    }

    const diagnostics = [];
    for (const userId of users) {
      const entry = { userId };

      // ClickUp
      const cuConfig = await safeOne(
        'SELECT (client_id_enc IS NOT NULL) AS has_id, (client_secret_enc IS NOT NULL) AS has_secret, updated_at FROM clickup_config WHERE user_id = $1',
        [userId]
      );
      const cuCred = await safeOne(
        'SELECT workspace_name, workspace_id, token_type, default_list_name, lj_root_name, connected_at FROM clickup_credentials WHERE user_id = $1',
        [userId]
      );
      entry.clickup = {
        oauthAppCadastrado: !!cuConfig?.has_id && !!cuConfig?.has_secret,
        oauthAppUpdatedAt: cuConfig?.updated_at || null,
        conectado: !!cuCred,
        workspaceName: cuCred?.workspace_name || null,
        workspaceId: cuCred?.workspace_id || null,
        tokenType: cuCred?.token_type || null,
        defaultListName: cuCred?.default_list_name || null,
        rootName: cuCred?.lj_root_name || null,
        connectedAt: cuCred?.connected_at || null
      };

      // Google Ads
      const gaCfg = await safeOne(
        `SELECT (client_id_enc IS NOT NULL) AS has_id,
                (client_secret_enc IS NOT NULL) AS has_secret,
                (developer_token_enc IS NOT NULL) AS has_dev_token,
                (refresh_token_enc IS NOT NULL) AS has_refresh,
                login_customer_id, selected_customer_id, account_descriptive_name,
                connected_at, last_sync_at
         FROM lj_google_ads_config WHERE user_id = $1`,
        [userId]
      );
      entry.googleAds = gaCfg ? {
        credentialsCadastradas: !!gaCfg.has_id && !!gaCfg.has_secret && !!gaCfg.has_dev_token,
        oauthCompletado: !!gaCfg.has_refresh,
        mccId: gaCfg.login_customer_id,
        customerId: gaCfg.selected_customer_id,
        accountName: gaCfg.account_descriptive_name,
        connectedAt: gaCfg.connected_at,
        lastSyncAt: gaCfg.last_sync_at
      } : { credentialsCadastradas: false };

      // GA4
      const ga4Cfg = await safeOne(
        `SELECT (client_id_enc IS NOT NULL) AS has_id,
                (client_secret_enc IS NOT NULL) AS has_secret,
                (refresh_token_enc IS NOT NULL) AS has_refresh,
                selected_property_id, property_display_name, business_profile,
                connected_at, last_sync_at
         FROM lj_ga4_config WHERE user_id = $1`,
        [userId]
      );
      entry.ga4 = ga4Cfg ? {
        credentialsCadastradas: !!ga4Cfg.has_id && !!ga4Cfg.has_secret,
        oauthCompletado: !!ga4Cfg.has_refresh,
        propertyId: ga4Cfg.selected_property_id,
        propertyName: ga4Cfg.property_display_name,
        businessProfile: ga4Cfg.business_profile,
        connectedAt: ga4Cfg.connected_at,
        lastSyncAt: ga4Cfg.last_sync_at
      } : { credentialsCadastradas: false };

      // Hotmart
      const hmCfg = await safeOne(
        `SELECT (hottok_enc IS NOT NULL) AS has_hottok,
                (client_id_enc IS NOT NULL) AS has_id,
                (client_secret_enc IS NOT NULL) AS has_secret,
                (oauth_token_cache_enc IS NOT NULL) AS has_oauth_cache,
                sync_window_days, connected_at, last_sync_at
         FROM hotmart_config WHERE user_id = $1`,
        [userId]
      );
      entry.hotmart = hmCfg ? {
        hottokCadastrado: !!hmCfg.has_hottok,
        oauthOpcionalConfigurado: !!hmCfg.has_id && !!hmCfg.has_secret,
        oauthCacheAtivo: !!hmCfg.has_oauth_cache,
        syncWindowDays: hmCfg.sync_window_days,
        connectedAt: hmCfg.connected_at,
        lastSyncAt: hmCfg.last_sync_at
      } : { hottokCadastrado: false };

      // RD (multi-linha por token_type)
      let rdRows = [];
      try {
        const r = await tenantPool.query(
          `SELECT token_type, account_name, workspace_id, status, expires_at, updated_at,
                  (access_token_enc IS NOT NULL) AS has_access,
                  (refresh_token_enc IS NOT NULL) AS has_refresh,
                  (client_id_enc IS NOT NULL) AS has_client
           FROM rd_credentials WHERE user_id = $1
           ORDER BY token_type`,
          [userId]
        );
        rdRows = r.rows;
      } catch (_) { /* tabela ausente */ }
      entry.rd = {
        tokens: rdRows.map(r => ({
          tokenType: r.token_type,
          accountName: r.account_name,
          workspaceId: r.workspace_id,
          status: r.status,
          expiresAt: r.expires_at,
          updatedAt: r.updated_at,
          hasAccess: !!r.has_access,
          hasRefresh: !!r.has_refresh,
          hasClient: !!r.has_client
        }))
      };

      diagnostics.push(entry);
    }

    // Sumário human-readable
    const summary = diagnostics.map(d => {
      const lines = [];
      lines.push(`USER ${d.userId}`);
      lines.push(`  ClickUp: ${d.clickup.conectado ? `CONECTADO (${d.clickup.workspaceName}, ${d.clickup.tokenType})` : (d.clickup.oauthAppCadastrado ? 'Client ID/Secret PRESERVADOS - so refazer autorizacao' : 'sem nada')}`);
      lines.push(`  Google Ads: ${d.googleAds.oauthCompletado ? `CONECTADO (${d.googleAds.accountName})` : (d.googleAds.credentialsCadastradas ? 'Credentials PRESERVADAS - so refazer OAuth' : 'sem nada')}`);
      lines.push(`  GA4: ${d.ga4.oauthCompletado ? `CONECTADO (${d.ga4.propertyName})` : (d.ga4.credentialsCadastradas ? 'Credentials PRESERVADAS - so refazer OAuth' : 'sem nada')}`);
      lines.push(`  Hotmart: ${d.hotmart.hottokCadastrado ? 'HOTTOK PRESERVADO' : 'sem hottok'}`);
      lines.push(`  RD: ${d.rd.tokens.length ? d.rd.tokens.map(t => `${t.tokenType}=${t.status || 'salvo'}`).join(', ') : 'sem tokens'}`);
      return lines.join('\n');
    }).join('\n\n');

    return res.status(200).json({
      ok: true,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, ownerUserId: tenant.owner_user_id },
      diagnostics,
      summary
    });
  } catch (err) {
    console.error('[admin-debug-tenant-credentials]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
