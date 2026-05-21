// V32.0.15 — POST /api/execution-connect
// Body: { provider, fields, meta? }
//   provider: 'trello' | 'monday' | 'jira' | 'notion' | 'clickup'
//   fields:   objeto com campos sensíveis (apiKey, token, etc — variável por provider)
//   meta:     objeto com metadata pra UI (account_name, workspace, etc) — opcional
//
// Encripta fields, grava em execution_credentials (tenant plane). Idempotente:
// re-chamar atualiza fields_enc.
//
// NÃO testa a conexão — só salva. Test fica em /api/execution-test (futuro)
// ou implícito no /api/<provider>-create-task quando a task tentar criar.
const { saveCredentials, VALID_PROVIDERS } = require('../lib/execution-credentials');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const provider = String(req.body?.provider || '').trim();
  const fields = req.body?.fields;
  const meta = req.body?.meta || {};

  if (!VALID_PROVIDERS.has(provider)) {
    return res.status(400).json({ ok: false, message: `provider inválido. Use: ${[...VALID_PROVIDERS].join(', ')}` });
  }
  if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
    return res.status(400).json({ ok: false, message: 'fields obrigatório (objeto não-vazio com os campos sensíveis do provider).' });
  }
  if (typeof meta !== 'object') {
    return res.status(400).json({ ok: false, message: 'meta deve ser objeto.' });
  }

  try {
    await saveCredentials(req.tenantDb, req.user.sub, provider, fields, meta);
    return res.status(200).json({ ok: true, provider, message: `Provider ${provider} conectado.` });
  } catch (err) {
    console.error('[execution-connect]', err);
    if (err.message?.includes('ENCRYPTION_KEY')) {
      return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
};
