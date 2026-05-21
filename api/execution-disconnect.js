// V32.0.15 — POST /api/execution-disconnect
// Body: { provider }
//
// Deleta credenciais de um provider do user (tenant plane). Cascade-safe:
// se for o defaultProvider em executionConfig, frontend deve detectar e
// resetar pra 'manual' (UI responsibility, V32.0.16+).
//
// Method = POST (não DELETE) pra compatibilidade com clients HTTP que não
// suportam body em DELETE (alguns proxies/CDNs strippam).
const { deleteCredentials, VALID_PROVIDERS } = require('../lib/execution-credentials');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const provider = String(req.body?.provider || '').trim();
  if (!VALID_PROVIDERS.has(provider)) {
    return res.status(400).json({ ok: false, message: `provider inválido. Use: ${[...VALID_PROVIDERS].join(', ')}` });
  }

  try {
    await deleteCredentials(req.tenantDb, req.user.sub, provider);
    return res.status(200).json({ ok: true, provider, message: `Provider ${provider} desconectado.` });
  } catch (err) {
    console.error('[execution-disconnect]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
