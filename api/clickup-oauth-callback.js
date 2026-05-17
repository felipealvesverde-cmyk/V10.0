// V30.0.0 — Callback OAuth ClickUp.
// ClickUp redireciona aqui com ?code=xxx&state=base64.
// Decodificamos state pra pegar user_id, trocamos o code por access_token via
// ClickUp API, salvamos criptografado, e renderizamos página simples que fecha
// a janela / redireciona pro app.
const { encrypt, decrypt, isConfigured } = require('../lib/clickup-crypto');

const CLICKUP_TOKEN_URL = 'https://api.clickup.com/api/v2/oauth/token';

function html(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:system-ui;padding:40px;background:#0f172a;color:#e2e8f0;max-width:600px;margin:auto}
  h1{font-size:1.4rem}p{line-height:1.6}a{color:#a78bfa}.ok{color:#10b981}.err{color:#ef4444}</style>
  </head><body>${body}</body></html>`;
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).send(html('Erro', '<h1 class="err">Banco não configurado.</h1>'));
  if (!isConfigured()) return res.status(503).send(html('Erro', '<h1 class="err">ENCRYPTION_KEY não configurada.</h1>'));

  const { code, state, error } = req.query || {};

  if (error) {
    return res.status(400).send(html('Autorização negada', `<h1 class="err">Você cancelou ou negou a autorização.</h1><p>${error}</p><p><a href="/">Voltar ao app</a></p>`));
  }
  if (!code || !state) {
    return res.status(400).send(html('Erro', '<h1 class="err">Parâmetros ausentes (code/state).</h1>'));
  }

  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
  } catch (e) {
    return res.status(400).send(html('Erro', '<h1 class="err">State inválido.</h1>'));
  }
  const userId = Number(stateData.u);
  if (!userId) return res.status(400).send(html('Erro', '<h1 class="err">user_id não encontrado no state.</h1>'));

  try {
    // Pega credenciais OAuth do user
    const cfg = await req.db.query('SELECT client_id_enc, client_secret_enc FROM clickup_config WHERE user_id = $1', [userId]);
    if (!cfg.rows.length) return res.status(404).send(html('Erro', '<h1 class="err">OAuth config não encontrada pro user.</h1>'));
    const clientId = decrypt(cfg.rows[0].client_id_enc);
    const clientSecret = decrypt(cfg.rows[0].client_secret_enc);

    // Troca code por access_token
    const tokenRes = await fetch(`${CLICKUP_TOKEN_URL}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&code=${encodeURIComponent(code)}`, {
      method: 'POST'
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(500).send(html('Erro', `<h1 class="err">Falha ao trocar code por token.</h1><pre>${JSON.stringify(tokenData, null, 2)}</pre>`));
    }
    const accessToken = tokenData.access_token;

    // Pega info do user (workspace name) pra exibir
    let workspaceName = null;
    let workspaceId = null;
    try {
      const teamsRes = await fetch('https://api.clickup.com/api/v2/team', { headers: { Authorization: accessToken } });
      const teamsData = await teamsRes.json();
      if (teamsRes.ok && Array.isArray(teamsData.teams) && teamsData.teams.length) {
        // Pega o primeiro workspace (user pode trocar depois nas Settings se tiver mais)
        workspaceId = String(teamsData.teams[0].id);
        workspaceName = teamsData.teams[0].name;
      }
    } catch (_) {}

    // Salva criptografado
    const tokenEnc = encrypt(accessToken);
    await req.db.query(
      `INSERT INTO clickup_credentials (user_id, access_token_enc, workspace_id, workspace_name, connected_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET access_token_enc = $2, workspace_id = $3, workspace_name = $4, connected_at = NOW()`,
      [userId, tokenEnc, workspaceId, workspaceName]
    );

    return res.status(200).send(html('ClickUp conectado',
      `<h1 class="ok">✓ ClickUp conectado!</h1>
       <p>Workspace: <b>${workspaceName || '—'}</b></p>
       <p>Pode fechar esta aba e voltar ao LeadJourney.</p>
       <script>setTimeout(() => { window.close(); window.location.href = '/'; }, 1500);</script>`));
  } catch (err) {
    return res.status(500).send(html('Erro', `<h1 class="err">Erro: ${err.message}</h1>`));
  }
};
