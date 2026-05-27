// V34.7.h — /api/user-ai-config
// Cliente (JWT comum) configura própria API key Anthropic.
//
//   GET  → retorna { configured, provider, masterEnabled, source, updatedAt }
//          (nunca retorna a key crua — só o status)
//   POST → body { provider, api_key } salva criptografada
//   DELETE → remove a key
//
// Master também pode chamar (apenas pra inspecionar próprio); o source da UI
// dele continua sendo 'master' (env var ANTHROPIC_API_KEY).

const { encrypt, isConfigured: isEncryptConfigured } = require('../lib/clickup-crypto');

function validateAnthropicKey(k) {
  if (!k || typeof k !== 'string') return false;
  const s = k.trim();
  if (s.length < 20) return false;
  return /^sk-ant-/.test(s);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = Number(req.user.sub || req.user.id);
  if (!userId) return res.status(401).json({ ok: false, message: 'JWT sem user id.' });

  try {
    if (req.method === 'GET') {
      const r = await req.db.query(
        `SELECT u.master_ai_enabled, c.provider, c.updated_at
           FROM users u
           LEFT JOIN user_ai_credentials c ON c.user_id = u.id
          WHERE u.id = $1`,
        [userId]
      );
      const row = r.rows[0] || {};
      const configured = Boolean(row.provider);
      const masterEnabled = Boolean(row.master_ai_enabled);
      // source efetivo (igual ai-resolver):
      // - master JWT → 'master'
      // - master_ai_enabled=true → 'master-shared'
      // - tem key própria → 'user'
      // - senão → null
      let source = null;
      if (req.user.isMaster) source = 'master';
      else if (masterEnabled) source = 'master-shared';
      else if (configured) source = 'user';
      return res.status(200).json({
        ok: true,
        configured,
        masterEnabled,
        source,
        provider: row.provider || null,
        updatedAt: row.updated_at || null
      });
    }

    if (req.method === 'POST') {
      if (!isEncryptConfigured()) {
        return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });
      }
      const provider = String(req.body?.provider || 'anthropic').toLowerCase();
      const apiKey = String(req.body?.api_key || '').trim();
      if (provider !== 'anthropic') {
        return res.status(400).json({ ok: false, message: 'Apenas provider=anthropic suportado nesta versão.' });
      }
      if (!validateAnthropicKey(apiKey)) {
        return res.status(400).json({ ok: false, message: 'Chave Anthropic inválida (deve começar com sk-ant-).' });
      }
      const enc = encrypt(apiKey);
      await req.db.query(
        `INSERT INTO user_ai_credentials (user_id, provider, api_key_enc, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id) DO UPDATE
             SET provider = EXCLUDED.provider,
                 api_key_enc = EXCLUDED.api_key_enc,
                 updated_at = NOW()`,
        [userId, provider, enc]
      );
      return res.status(200).json({ ok: true, message: 'Chave Anthropic salva.', provider });
    }

    if (req.method === 'DELETE') {
      await req.db.query('DELETE FROM user_ai_credentials WHERE user_id = $1', [userId]);
      return res.status(200).json({ ok: true, message: 'Chave removida.' });
    }

    return res.status(405).json({ ok: false, message: 'Use GET, POST ou DELETE.' });
  } catch (err) {
    console.error('[user-ai-config]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
