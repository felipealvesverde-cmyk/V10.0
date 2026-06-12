// V30.0.0 — Salva/lê OAuth App credentials do user (client_id + client_secret).
// Ambos criptografados via lib/clickup-crypto.
//
// GET: retorna { ok, configured: bool, connected: bool, workspaceName?, encryptionReady: bool }
// POST: body { client_id, client_secret } — salva criptografado
// DELETE: remove config (e desconecta — também remove credentials)
const { encrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');
const { resolveCredentialOwnerId, assertCanWriteCredentials, CredentialPermissionError } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  // V37.4.34 — Credenciais ClickUp vivem na linha do OWNER do tenant.
  // Qualquer membro do tenant resolve pro mesmo user_id.
  const userId = await resolveCredentialOwnerId(req);

  if (req.method === 'GET') {
    try {
      // V32.0.9 — dados ClickUp vivem no tenant plane.
      // V32.1.3 — Retorna também list info salva pra UI mostrar status sem
      // novo fetch (defaultListId/Name/SpaceId, definidos pelo /api/clickup-set-list).
      const cfg = await req.tenantDb.query('SELECT 1 FROM clickup_config WHERE user_id = $1', [userId]);
      // V32.1.4-1.6 — settings de marcação + status_map + write_enabled.
      // V32.2.0 — também lj_space_id + mirror_enabled (hierarquia espelhada).
      const cred = await req.tenantDb.query(
        `SELECT workspace_name, default_list_id, default_list_name, default_space_id,
                lj_tag_name, task_prefix, status_map_json, write_enabled,
                lj_space_id, mirror_enabled,
                token_type,
                lj_root_id, lj_root_kind, lj_root_name
         FROM clickup_credentials WHERE user_id = $1`,
        [userId]
      );
      const row = cred.rows[0] || {};
      let statusMap = null;
      try { statusMap = row.status_map_json ? JSON.parse(row.status_map_json) : null; } catch (_) { statusMap = null; }
      return res.status(200).json({
        ok: true,
        configured: cfg.rows.length > 0,
        connected: cred.rows.length > 0,
        workspaceName: row.workspace_name || null,
        // V32.5.6 — tokenType ('oauth' | 'pat') diferencia método de conexão
        // pra UI mostrar badge correto e habilitar/desabilitar "Revelar PAT".
        tokenType: row.token_type || null,
        defaultListId: row.default_list_id || null,
        defaultListName: row.default_list_name || null,
        defaultSpaceId: row.default_space_id || null,
        ljTagName: row.lj_tag_name || null,
        taskPrefix: row.task_prefix || null,
        statusMap,
        writeEnabled: row.write_enabled !== false,
        // V32.2.0 — hierarquia espelhada (back-compat, sinônimo de root quando kind=space)
        ljSpaceId: row.lj_space_id || null,
        mirrorEnabled: row.mirror_enabled !== false,
        // V32.6.0 — raiz flexível (space|folder|list)
        rootId: row.lj_root_id || null,
        rootKind: row.lj_root_kind || null,
        rootName: row.lj_root_name || null,
        encryptionReady: isEncryptionReady()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    try { await assertCanWriteCredentials(req); }
    catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
    if (!isEncryptionReady()) {
      return res.status(503).json({
        ok: false,
        message: 'ENCRYPTION_KEY não configurada no servidor. Veja README ou peça pro admin adicionar no Railway → Variables.'
      });
    }
    const { client_id, client_secret } = req.body || {};
    if (!client_id || !client_secret) {
      return res.status(400).json({ ok: false, message: 'client_id e client_secret são obrigatórios.' });
    }
    try {
      const idEnc = encrypt(String(client_id).trim());
      const secretEnc = encrypt(String(client_secret).trim());
      // V32.0.9 — dados ClickUp vivem no tenant plane.
      await req.tenantDb.query(
        `INSERT INTO clickup_config (user_id, client_id_enc, client_secret_enc, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET client_id_enc = $2, client_secret_enc = $3, updated_at = NOW()`,
        [userId, idEnc, secretEnc]
      );
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try { await assertCanWriteCredentials(req); }
    catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
    try {
      // V32.0.9 — dados ClickUp vivem no tenant plane.
      await req.tenantDb.query('DELETE FROM clickup_credentials WHERE user_id = $1', [userId]);
      await req.tenantDb.query('DELETE FROM clickup_config WHERE user_id = $1', [userId]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET, POST ou DELETE.' });
};
