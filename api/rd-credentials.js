// V31.2.36 — RD credentials persistente criptografada.
// Write-through: frontend salva aqui SEM substituir o fluxo existente (state
// continua sendo a fonte de leitura interna). DB vira safety net.
//
// GET    → { ok, credentials: { crm_pat?, marketing_oauth?, crm_oauth? } }
//   Cada entry tem campos decriptados pro frontend mergear em App.state.integrations.rd
//
// POST   body { token_type, access_token?, refresh_token?, client_id?, client_secret?,
//               redirect_uri?, expires_at?, account_name?, workspace_id?, status? }
//   Upsert em (user_id, token_type). Campos null/undefined preservam valor antigo.
//
// DELETE query ?token_type=X (ou sem param pra apagar todos do user)
const { encrypt, decrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');

const VALID_TYPES = new Set(['crm_pat', 'marketing_oauth', 'crm_oauth']);

function decryptCol(value) {
  if (!value) return null;
  try { return decrypt(value); } catch (_) { return null; }
}

function rowToCred(row) {
  return {
    token_type: row.token_type,
    access_token: decryptCol(row.access_token_enc),
    refresh_token: decryptCol(row.refresh_token_enc),
    client_id: decryptCol(row.client_id_enc),
    client_secret: decryptCol(row.client_secret_enc),
    redirect_uri: row.redirect_uri || null,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    account_name: row.account_name || null,
    workspace_id: row.workspace_id || null,
    status: row.status || null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const userId = req.user.sub;

  if (req.method === 'GET') {
    try {
      const r = await req.db.query('SELECT * FROM rd_credentials WHERE user_id = $1', [userId]);
      const credentials = {};
      r.rows.forEach(row => { credentials[row.token_type] = rowToCred(row); });
      return res.status(200).json({ ok: true, credentials });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!isEncryptionReady()) {
      return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY ausente no servidor.' });
    }
    const body = req.body || {};
    const tokenType = String(body.token_type || '');
    if (!VALID_TYPES.has(tokenType)) {
      return res.status(400).json({ ok: false, message: `token_type inválido. Use: ${[...VALID_TYPES].join(', ')}` });
    }
    try {
      // Carrega valor existente pra preservar campos não enviados
      const existingRes = await req.db.query('SELECT * FROM rd_credentials WHERE user_id = $1 AND token_type = $2', [userId, tokenType]);
      const existing = existingRes.rows[0];

      // Helper: usa novo valor se enviado (mesmo string vazia = apagar), senão preserva o antigo
      const useNewEnc = (newVal, oldEnc) => {
        if (newVal === undefined) return oldEnc || null;
        if (newVal === null || newVal === '') return null;
        return encrypt(String(newVal));
      };
      const useNewPlain = (newVal, oldVal) => {
        if (newVal === undefined) return oldVal || null;
        if (newVal === null || newVal === '') return null;
        return String(newVal);
      };

      const access_token_enc = useNewEnc(body.access_token, existing?.access_token_enc);
      const refresh_token_enc = useNewEnc(body.refresh_token, existing?.refresh_token_enc);
      const client_id_enc = useNewEnc(body.client_id, existing?.client_id_enc);
      const client_secret_enc = useNewEnc(body.client_secret, existing?.client_secret_enc);
      const redirect_uri = useNewPlain(body.redirect_uri, existing?.redirect_uri);
      const expires_at = body.expires_at === undefined ? existing?.expires_at : (body.expires_at ? new Date(body.expires_at) : null);
      const account_name = useNewPlain(body.account_name, existing?.account_name);
      const workspace_id = useNewPlain(body.workspace_id, existing?.workspace_id);
      const status = useNewPlain(body.status, existing?.status);

      await req.db.query(
        `INSERT INTO rd_credentials (user_id, token_type, access_token_enc, refresh_token_enc, client_id_enc, client_secret_enc, redirect_uri, expires_at, account_name, workspace_id, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (user_id, token_type) DO UPDATE SET
           access_token_enc = $3, refresh_token_enc = $4,
           client_id_enc = $5, client_secret_enc = $6,
           redirect_uri = $7, expires_at = $8,
           account_name = $9, workspace_id = $10, status = $11,
           updated_at = NOW()`,
        [userId, tokenType, access_token_enc, refresh_token_enc, client_id_enc, client_secret_enc, redirect_uri, expires_at, account_name, workspace_id, status]
      );
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const tokenType = String(req.query?.token_type || '');
    try {
      if (tokenType && VALID_TYPES.has(tokenType)) {
        await req.db.query('DELETE FROM rd_credentials WHERE user_id = $1 AND token_type = $2', [userId, tokenType]);
      } else {
        await req.db.query('DELETE FROM rd_credentials WHERE user_id = $1', [userId]);
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET, POST ou DELETE.' });
};
