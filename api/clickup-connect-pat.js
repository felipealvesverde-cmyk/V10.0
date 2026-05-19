// V31.2.29 — Conexão ClickUp via Personal API Token (PAT).
// User cola pk_xxx no frontend, backend valida chamando /team, salva
// criptografado em clickup_credentials com token_type='pat'.
//
// POST: body { pat } -> valida + salva + retorna { ok, workspaceName, workspaceId }
const { encrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!isEncryptionReady()) {
    return res.status(503).json({
      ok: false,
      message: 'ENCRYPTION_KEY não configurada no servidor. Peça pro admin adicionar no Railway → Variables.'
    });
  }

  const { pat } = req.body || {};
  const token = String(pat || '').trim();
  if (!token) return res.status(400).json({ ok: false, message: 'Token vazio.' });
  if (!token.startsWith('pk_')) {
    return res.status(400).json({ ok: false, message: 'Personal API Token do ClickUp começa com "pk_". Confira se copiou o token correto.' });
  }

  try {
    // Valida o PAT chamando /team. PATs usam header Authorization direto, sem Bearer.
    const teamsRes = await fetch('https://api.clickup.com/api/v2/team', { headers: { Authorization: token } });
    const teamsData = await teamsRes.json().catch(() => ({}));
    if (!teamsRes.ok) {
      return res.status(401).json({ ok: false, message: `Token inválido ou sem permissão. ClickUp respondeu ${teamsRes.status}.`, details: teamsData });
    }
    const teams = Array.isArray(teamsData.teams) ? teamsData.teams : [];
    if (!teams.length) {
      return res.status(400).json({ ok: false, message: 'Token válido mas sem workspaces acessíveis.' });
    }
    const workspaceId = String(teams[0].id);
    const workspaceName = teams[0].name || null;

    const tokenEnc = encrypt(token);
    await req.db.query(
      `INSERT INTO clickup_credentials (user_id, access_token_enc, workspace_id, workspace_name, token_type, connected_at)
       VALUES ($1, $2, $3, $4, 'pat', NOW())
       ON CONFLICT (user_id) DO UPDATE SET access_token_enc = $2, workspace_id = $3, workspace_name = $4, token_type = 'pat', connected_at = NOW()`,
      [req.user.id, tokenEnc, workspaceId, workspaceName]
    );

    return res.status(200).json({ ok: true, workspaceName, workspaceId, teams: teams.map(t => ({ id: String(t.id), name: t.name })) });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
