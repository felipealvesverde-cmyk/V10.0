// V35.5.0 — GET /api/google-ads-oauth-callback?code=...&state=...
//
// Endpoint público (sem JWT) que recebe o callback do Google após autorização.
// Valida state CSRF (achando o user dono daquele state), troca code por tokens,
// salva refresh_token criptografado. Retorna HTML que comunica com a janela
// pai (window.opener.postMessage) e fecha sozinha.
//
// Rota é PÚBLICA porque Google redireciona o browser do usuário pra cá sem
// JWT. Segurança vem do state CSRF (32 bytes random gerados no init).

const { encrypt } = require('../lib/clickup-crypto');
const { decrypt } = require('../lib/clickup-crypto');
const { exchangeCodeForTokens } = require('../lib/google-ads-oauth');

function htmlPage({ ok, message }) {
  const safe = (s) => String(s || '').replace(/[<>&"]/g, '');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Google Ads — ${ok ? 'Conectado' : 'Erro'}</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f1f5f9;
         display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1rem; }
  .card { max-width: 480px; padding: 2rem; border-radius: 1rem;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          text-align: center; }
  h1 { margin: 0 0 .5rem; font-size: 1.5rem; color: ${ok ? '#34d399' : '#f87171'}; }
  p { margin: 0 0 1rem; font-size: .95rem; color: #cbd5e1; }
  .x { font-size: 4rem; line-height: 1; }
</style></head>
<body>
  <div class="card">
    <div class="x">${ok ? '✓' : '⚠'}</div>
    <h1>${ok ? 'Google Ads conectado!' : 'Erro na autorização'}</h1>
    <p>${safe(message)}</p>
    <p style="font-size:.8rem;color:#64748b;">Esta janela vai fechar em 3 segundos.</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'google-ads-oauth', ok: ${ok}, message: ${JSON.stringify(message || '')} }, '*');
      }
    } catch (_) {}
    setTimeout(() => { try { window.close(); } catch (_) {} }, 3000);
  </script>
</body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Use GET.');
    return;
  }
  // Tenant DB resolve via state (vamos achar qual user é dono desse state).
  // Mas o pool master tá em req.db sempre — precisamos do tenantDb pra escrever
  // refresh_token. Usamos pgPool global aqui (vamos achar tenantDb via lookup).
  // Atalho: usar req.db (master pool) pra achar user_id, depois resolver tenantDb.

  const code = req.query?.code ? String(req.query.code) : null;
  const state = req.query?.state ? String(req.query.state) : null;
  const errorParam = req.query?.error ? String(req.query.error) : null;

  if (errorParam) {
    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlPage({ ok: false, message: `Google retornou erro: ${errorParam}` }));
  }
  if (!code || !state) {
    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlPage({ ok: false, message: 'Parâmetros code/state ausentes.' }));
  }

  // O middleware multi-tenant deve ter populado req.tenantDb se houver tenant
  // resolvível. Como este endpoint é público, talvez não tenha — vamos buscar
  // em qualquer pool disponível por enquanto. Em prod multi-DB, isso requer
  // resolução por state→user→tenant.
  const db = req.tenantDb || req.db;
  if (!db) {
    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlPage({ ok: false, message: 'Banco indisponível.' }));
  }

  try {
    // Acha config com esse state CSRF (válido)
    const r = await db.query(
      `SELECT user_id, client_id_enc, client_secret_enc, oauth_state_expires_at
         FROM lj_google_ads_config
        WHERE oauth_state_token = $1`,
      [state]
    );
    if (!r.rows.length) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(htmlPage({ ok: false, message: 'State CSRF inválido ou já usado. Recomeçe a autorização.' }));
    }
    const row = r.rows[0];
    const exp = row.oauth_state_expires_at ? new Date(row.oauth_state_expires_at) : null;
    if (exp && exp.getTime() < Date.now()) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(htmlPage({ ok: false, message: 'Autorização expirou (10 min). Tente de novo.' }));
    }

    const clientId = decrypt(row.client_id_enc);
    const clientSecret = decrypt(row.client_secret_enc);

    // Reconstrói redirect_uri (precisa ser EXATAMENTE o que foi usado no init)
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${proto}://${host}/api/google-ads-oauth-callback`;

    const tokens = await exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri });

    const expiresAt = new Date(Date.now() + tokens.expiresInSec * 1000);
    await db.query(
      `UPDATE lj_google_ads_config
          SET refresh_token_enc = $1,
              access_token_cache_enc = $2,
              access_token_expires_at = $3,
              connected_at = NOW(),
              oauth_state_token = NULL,
              oauth_state_expires_at = NULL,
              updated_at = NOW()
        WHERE user_id = $4`,
      [encrypt(tokens.refreshToken), encrypt(tokens.accessToken), expiresAt.toISOString(), row.user_id]
    );

    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlPage({ ok: true, message: 'Você já pode voltar pro LJ — a conexão está ativa.' }));
  } catch (err) {
    console.error('[google-ads-oauth-callback]', err);
    res.setHeader('Content-Type', 'text/html');
    return res.send(htmlPage({ ok: false, message: err.message || 'Falha na troca de tokens.' }));
  }
};
