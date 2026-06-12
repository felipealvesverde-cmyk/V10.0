// V35.5.0 — CRUD do Google Ads config por user.
//
// GET    → status + máscaras (sem expor secrets)
// POST   → upsert client_id, client_secret, developer_token, login_customer_id, selected_customer_id
// DELETE → remove tudo (incluindo refresh_token)
//
// Permissão: qualquer user autenticado (self-scope).

const { encrypt, decrypt } = require('../lib/clickup-crypto');
const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Credenciais Google Ads vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  try {
    if (req.method === 'GET') {
      const r = await req.tenantDb.query(
        `SELECT client_id_enc, client_secret_enc, developer_token_enc,
                login_customer_id, selected_customer_id,
                refresh_token_enc, account_descriptive_name,
                connected_at, last_sync_at, last_sync_result, updated_at
           FROM lj_google_ads_config WHERE user_id = $1`,
        [userId]
      );
      if (!r.rows.length) return res.status(200).json({ ok: true, configured: false });
      const row = r.rows[0];

      const mask = (encStr) => {
        if (!encStr) return null;
        try {
          const v = decrypt(encStr);
          if (v.length <= 8) return `***${v.slice(-3)}`;
          return `${v.slice(0, 4)}…${v.slice(-4)}`;
        } catch (_) { return '****'; }
      };

      return res.status(200).json({
        ok: true,
        configured: true,
        clientIdMasked: mask(row.client_id_enc),
        clientSecretMasked: mask(row.client_secret_enc),
        developerTokenMasked: mask(row.developer_token_enc),
        loginCustomerId: row.login_customer_id || null,
        selectedCustomerId: row.selected_customer_id || null,
        accountDescriptiveName: row.account_descriptive_name || null,
        oauthCompleted: Boolean(row.refresh_token_enc),
        connectedAt: row.connected_at,
        lastSyncAt: row.last_sync_at,
        lastSyncResult: row.last_sync_result || null,
        updatedAt: row.updated_at
      });
    }

    if (req.method === 'POST') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};

      const clientId = String(body.clientId || '').trim();
      const clientSecret = String(body.clientSecret || '').trim();
      const developerToken = String(body.developerToken || '').trim();
      const loginCustomerId = body.loginCustomerId ? String(body.loginCustomerId).replace(/\D/g, '').slice(0, 20) : null;
      const selectedCustomerId = body.selectedCustomerId ? String(body.selectedCustomerId).replace(/\D/g, '').slice(0, 20) : null;
      const accountDescriptiveName = body.accountDescriptiveName ? String(body.accountDescriptiveName).slice(0, 255) : null;

      // Permite update parcial — se algum campo não vier, mantém o anterior
      const existing = await req.tenantDb.query(
        `SELECT client_id_enc, client_secret_enc, developer_token_enc FROM lj_google_ads_config WHERE user_id = $1`,
        [userId]
      );
      const has = existing.rows.length;

      const clientIdEnc = clientId ? encrypt(clientId) : (has ? existing.rows[0].client_id_enc : null);
      const clientSecretEnc = clientSecret ? encrypt(clientSecret) : (has ? existing.rows[0].client_secret_enc : null);
      const developerTokenEnc = developerToken ? encrypt(developerToken) : (has ? existing.rows[0].developer_token_enc : null);

      await req.tenantDb.query(
        `INSERT INTO lj_google_ads_config
           (user_id, client_id_enc, client_secret_enc, developer_token_enc,
            login_customer_id, selected_customer_id, account_descriptive_name, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           client_id_enc = COALESCE(EXCLUDED.client_id_enc, lj_google_ads_config.client_id_enc),
           client_secret_enc = COALESCE(EXCLUDED.client_secret_enc, lj_google_ads_config.client_secret_enc),
           developer_token_enc = COALESCE(EXCLUDED.developer_token_enc, lj_google_ads_config.developer_token_enc),
           login_customer_id = COALESCE(EXCLUDED.login_customer_id, lj_google_ads_config.login_customer_id),
           selected_customer_id = COALESCE(EXCLUDED.selected_customer_id, lj_google_ads_config.selected_customer_id),
           account_descriptive_name = COALESCE(EXCLUDED.account_descriptive_name, lj_google_ads_config.account_descriptive_name),
           updated_at = NOW()`,
        [userId, clientIdEnc, clientSecretEnc, developerTokenEnc,
         loginCustomerId, selectedCustomerId, accountDescriptiveName]
      );

      return res.status(200).json({ ok: true, message: 'Configuração salva.' });
    }

    if (req.method === 'DELETE') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      await req.tenantDb.query(`DELETE FROM lj_google_ads_config WHERE user_id = $1`, [userId]);
      return res.status(200).json({ ok: true, message: 'Google Ads desconectado.' });
    }

    return res.status(405).json({ ok: false, message: 'Use GET / POST / DELETE.' });
  } catch (err) {
    console.error('[google-ads-config]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
