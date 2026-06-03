// V35.8.0-alpha1 — Lookup de Integrações Ativas por Tenant.
//
// Inspeciona o DB do tenant e retorna quais integrações estão conectadas
// e prontas pra fornecer dados. Usado pelo Djow no fluxo determinístico:
//
//   - Etapa 1: ao receber o input do modal de KR, listamos as integrações
//     ativas pra que o Djow saiba o que pode propor.
//   - Etapa 3a (atomic): valida que a fonte sugerida realmente existe.
//   - Etapa 3b (derived): valida que cada insumo da fórmula tem fonte
//     disponível (ou aceita default).
//
// Cada integração tem um detector próprio. Quando uma nova integração
// (Meta Ads, Stripe, GA4) virar real, adiciona-se aqui sem mudar o resto.

/**
 * Lista todas as integrações ATIVAS pra um tenant.
 *
 * Cada item: {
 *   id: 'google_ads' | 'rd_station' | 'clickup' | 'hotmart',
 *   label: 'Google Ads' (humano, pro Djow falar),
 *   status: 'connected' | 'partial',
 *   metadata: { ... }  (specifics úteis pro Djow, ex: workspace name)
 * }
 *
 * Retorna [] em caso de erro (não derruba o caller — Djow só não terá
 * integrações pra propor e cairá pra Manual).
 */
async function listActiveIntegrations(tenantDb, userId) {
  if (!tenantDb || !userId) return [];
  const integrations = [];
  await _checkGoogleAds(tenantDb, userId, integrations);
  await _checkRdStation(tenantDb, userId, integrations);
  await _checkClickup(tenantDb, userId, integrations);
  await _checkHotmart(tenantDb, userId, integrations);
  return integrations;
}

/**
 * Verifica se uma integração específica está ativa. Retorna boolean.
 * Atalho pra quando o Djow só precisa saber "tem X conectado?".
 */
async function isIntegrationActive(tenantDb, userId, integrationId) {
  const all = await listActiveIntegrations(tenantDb, userId);
  return all.some(i => i.id === integrationId);
}

// ============================================================
// Detectores específicos por integração
// ============================================================

async function _checkGoogleAds(tenantDb, userId, out) {
  try {
    const r = await tenantDb.query(
      `SELECT selected_customer_id, account_descriptive_name, refresh_token_enc, last_sync_at
         FROM lj_google_ads_config WHERE user_id = $1`,
      [userId]
    );
    const row = r.rows[0];
    if (!row) return;
    const isConnected = Boolean(row.selected_customer_id && row.refresh_token_enc);
    if (!isConnected) return;
    out.push({
      id: 'google_ads',
      label: 'Google Ads',
      status: row.last_sync_at ? 'connected' : 'partial',
      metadata: {
        customer_id: row.selected_customer_id,
        account_name: row.account_descriptive_name || null,
        last_sync_at: row.last_sync_at || null
      }
    });
  } catch (_) { /* tabela não existe ou erro — ignora silencioso */ }
}

async function _checkRdStation(tenantDb, userId, out) {
  try {
    // V31.x — credenciais RD em rd_credentials (PAT + 2 OAuths)
    const r = await tenantDb.query(
      `SELECT crm_pat_token_enc, crm_oauth_access_enc, marketing_oauth_access_enc, account_name
         FROM rd_credentials WHERE user_id = $1`,
      [userId]
    );
    const row = r.rows[0];
    if (!row) return;
    const hasAny = row.crm_pat_token_enc || row.crm_oauth_access_enc || row.marketing_oauth_access_enc;
    if (!hasAny) return;
    out.push({
      id: 'rd_station',
      label: 'RD Station',
      status: 'connected',
      metadata: {
        account_name: row.account_name || null,
        has_crm_pat: Boolean(row.crm_pat_token_enc),
        has_crm_oauth: Boolean(row.crm_oauth_access_enc),
        has_marketing: Boolean(row.marketing_oauth_access_enc)
      }
    });
  } catch (_) {}
}

async function _checkClickup(tenantDb, userId, out) {
  try {
    const r = await tenantDb.query(
      `SELECT access_token_enc, workspace_name, root_id, write_enabled
         FROM clickup_credentials WHERE user_id = $1`,
      [userId]
    );
    const row = r.rows[0];
    if (!row?.access_token_enc) return;
    out.push({
      id: 'clickup',
      label: 'ClickUp',
      status: row.root_id ? 'connected' : 'partial',     // raiz configurada = pleno
      metadata: {
        workspace_name: row.workspace_name || null,
        write_enabled: row.write_enabled !== false
      }
    });
  } catch (_) {}
}

async function _checkHotmart(tenantDb, userId, out) {
  try {
    const r = await tenantDb.query(
      `SELECT hottok_enc, client_id_enc, oauth_access_token_enc, last_event_at
         FROM hotmart_config WHERE user_id = $1`,
      [userId]
    );
    const row = r.rows[0];
    if (!row?.hottok_enc) return;
    out.push({
      id: 'hotmart',
      label: 'Hotmart',
      status: row.last_event_at ? 'connected' : 'partial',  // recebendo eventos = pleno
      metadata: {
        oauth_configured: Boolean(row.client_id_enc && row.oauth_access_token_enc),
        last_event_at: row.last_event_at || null
      }
    });
  } catch (_) {}
}

module.exports = {
  listActiveIntegrations,
  isIntegrationActive
};
