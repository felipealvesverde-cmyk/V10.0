// V36.6.0 — Auto-refresh do RD Marketing OAuth token.
//
// O RD Station Marketing OAuth tem access_token com TTL ~24h. Antes da V36.6.0
// o LJ salvava o refresh_token mas nunca usava ele pra renovar — cliente tinha
// que refazer OAuth manualmente todo dia. Felipe reportou (2026-06-08).
//
// POST /api/rd-marketing-refresh
// Body: { force?: boolean }  — force=true ignora TTL check e renova sempre
//
// Returns:
//   { ok: true, refreshed: true, expires_at, expires_in_minutes }
//   { ok: true, refreshed: false, reason: 'still-valid', expires_in_minutes }
//   { ok: false, message: 'detalhe do erro' }
//
// Estratégia:
//   1. Lê credenciais marketing_oauth do tenant DB (client_id, secret, refresh_token, expires_at)
//   2. Se expires_at > 10 min de margem E !force: retorna 'still-valid'
//   3. POST https://api.rd.services/auth/token com grant_type=refresh_token
//   4. Salva novo access_token + refresh_token (se RD trocou) + expires_at no DB
//   5. Retorna sucesso

const { encrypt, decrypt } = require('../lib/clickup-crypto');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

const RD_TOKEN_URL = 'https://api.rd.services/auth/token';
const REFRESH_MARGIN_MS = 10 * 60 * 1000; // renova se faltar menos de 10 min

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Credenciais RD vivem na linha do OWNER do tenant.
  const userId = Number(await resolveCredentialOwnerId(req));
  const force = Boolean(req.body?.force);

  try {
    const r = await req.tenantDb.query(
      `SELECT access_token_enc, refresh_token_enc, client_id_enc, client_secret_enc, expires_at
         FROM rd_credentials WHERE user_id = $1 AND token_type = 'marketing_oauth'`,
      [userId]
    );
    if (!r.rows.length) {
      return res.status(404).json({ ok: false, message: 'RD Marketing não conectado.' });
    }
    const row = r.rows[0];

    const refresh = row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null;
    const clientId = row.client_id_enc ? decrypt(row.client_id_enc) : null;
    const clientSecret = row.client_secret_enc ? decrypt(row.client_secret_enc) : null;
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;

    if (!refresh || !clientId || !clientSecret) {
      return res.status(400).json({
        ok: false,
        message: 'Credenciais incompletas (faltam refresh_token, client_id ou client_secret). Reconecte o OAuth.'
      });
    }

    // Checagem de margem — se ainda tem mais de REFRESH_MARGIN_MS de vida, skip.
    if (!force && expiresAt) {
      const msToExpiry = expiresAt.getTime() - Date.now();
      if (msToExpiry > REFRESH_MARGIN_MS) {
        return res.status(200).json({
          ok: true,
          refreshed: false,
          reason: 'still-valid',
          expires_at: expiresAt.toISOString(),
          expires_in_minutes: Math.round(msToExpiry / 60000)
        });
      }
    }

    // Bate na API do RD pra renovar.
    const tokenRes = await fetch(RD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refresh
      })
    });

    const tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok) {
      // Erros comuns:
      // - 400 invalid_grant: refresh_token expirou ou foi revogado → precisa OAuth de novo
      // - 401 invalid_client: client_id/secret errados
      const isInvalidGrant = String(tokenData.error || '').toLowerCase().includes('invalid_grant');
      return res.status(isInvalidGrant ? 410 : tokenRes.status).json({
        ok: false,
        message: isInvalidGrant
          ? 'Refresh token expirou ou foi revogado pelo RD. Reconecte o OAuth Marketing em Configurações.'
          : `RD retornou ${tokenRes.status}: ${tokenData.error_description || tokenData.error || 'falha'}`,
        rd_error: tokenData
      });
    }

    const newAccess = tokenData.access_token;
    const newRefresh = tokenData.refresh_token || refresh; // RD pode ou não rotacionar
    const expiresIn = Number(tokenData.expires_in || 86400); // default 24h
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    if (!newAccess) {
      return res.status(502).json({
        ok: false,
        message: 'RD respondeu sem access_token.',
        rd_response: tokenData
      });
    }

    // Salva no DB
    await req.tenantDb.query(
      `UPDATE rd_credentials
          SET access_token_enc = $1,
              refresh_token_enc = $2,
              expires_at = $3,
              status = 'connected',
              updated_at = NOW()
        WHERE user_id = $4 AND token_type = 'marketing_oauth'`,
      [encrypt(newAccess), encrypt(newRefresh), newExpiresAt.toISOString(), userId]
    );

    return res.status(200).json({
      ok: true,
      refreshed: true,
      expires_at: newExpiresAt.toISOString(),
      expires_in_minutes: Math.round(expiresIn / 60),
      refresh_token_rotated: newRefresh !== refresh
    });
  } catch (err) {
    console.error('[rd-marketing-refresh]', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno.' });
  }
};
