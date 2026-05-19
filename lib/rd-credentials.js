// V31.2.37 — Backend helper pra ler tokens RD criptografados do DB.
// Usado por /api/rd-proxy, /api/rd-refresh-token e qualquer endpoint que precise
// chamar RD sem receber token via body (mais seguro).
const { decrypt } = require('./clickup-crypto'); // mesmo helper AES-256-GCM

const VALID_TYPES = new Set(['crm_pat', 'marketing_oauth', 'crm_oauth']);

// Retorna { token, refresh, clientId, clientSecret, expiresAt } pro tokenType.
// Throw se não encontrado ou ENCRYPTION_KEY inválida.
async function getRdCredential(db, userId, tokenType) {
  if (!VALID_TYPES.has(tokenType)) throw new Error(`token_type inválido: ${tokenType}`);
  const r = await db.query('SELECT * FROM rd_credentials WHERE user_id = $1 AND token_type = $2', [userId, tokenType]);
  if (!r.rows.length) throw new Error(`RD ${tokenType} não conectado.`);
  const row = r.rows[0];
  return {
    token: row.access_token_enc ? decrypt(row.access_token_enc) : null,
    refresh: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
    clientId: row.client_id_enc ? decrypt(row.client_id_enc) : null,
    clientSecret: row.client_secret_enc ? decrypt(row.client_secret_enc) : null,
    redirectUri: row.redirect_uri || null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    accountName: row.account_name || null,
    workspaceId: row.workspace_id || null,
    status: row.status || null
  };
}

module.exports = { getRdCredential };
