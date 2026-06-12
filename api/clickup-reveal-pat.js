// V32.4.3 — GET /api/clickup-reveal-pat
// Revela o Personal API Token do ClickUp do user logado (descriptografa
// `access_token_enc` da tabela `clickup_credentials`).
//
// Use case: user já colou o PAT antes no LJ + perdeu acesso ao token original
// (ClickUp esconde após copiar uma vez). Em vez de regenerar (que invalidaria
// outras integrações usando o mesmo PAT), recupera o atual.
//
// Segurança:
//   - Auth: user logado (req.user.sub).
//   - Token retornado pertence AO PRÓPRIO user — não a outros tenants.
//   - HTTPS-only (cookie/Authorization Bearer já é).
//   - User já tem o secret no DB dele — não há novo "exposure", só formato visual.
const { decrypt, isConfigured } = require('../lib/clickup-crypto');
const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco do tenant não configurado.' });
  if (!isConfigured()) return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });

  // V37.4.34 — Manager/user comum NÃO pode ver o token do owner em texto cru.
  // O endpoint é read-only no DB mas o output é sensível (token funcional).
  try { await assertCanWriteCredentials(req); }
  catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }

  const userId = await resolveCredentialOwnerId(req);

  try {
    const r = await req.tenantDb.query(
      'SELECT access_token_enc, token_type, workspace_name FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!r.rows.length) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado ainda. Conecte primeiro pra ter token salvo.' });
    }
    const row = r.rows[0];
    let token;
    try {
      token = decrypt(row.access_token_enc);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: `Falha ao descriptografar token. ENCRYPTION_KEY pode ter mudado desde o save. Detalhe: ${err.message}`
      });
    }
    return res.status(200).json({
      ok: true,
      token,
      tokenType: row.token_type || 'pat',
      workspaceName: row.workspace_name || null
    });
  } catch (err) {
    console.error('[clickup-reveal-pat]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
