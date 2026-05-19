// V30.0.0 — Proxy genérico pra chamadas ClickUp API.
// Frontend usa pra listar spaces/lists/users sem expor token.
// Body: { method, path, body? } onde path começa com '/' (relativo à api.clickup.com/api/v2).
const { clickupFetch } = require('../lib/clickup-client');

// Whitelist de paths permitidos (evita usar proxy pra coisas fora de escopo).
const ALLOWED_PATH_PATTERNS = [
  /^\/team$/,                                  // lista workspaces
  /^\/team\/[^/]+\/space$/,                     // lista spaces de workspace
  /^\/team\/[^/]+\/member$/,                    // lista members de workspace
  /^\/space\/[^/]+\/folder$/,                   // lista folders de space
  /^\/space\/[^/]+\/list$/,                     // lista lists folderless
  /^\/folder\/[^/]+\/list$/,                    // lista lists de folder
  /^\/list\/[^/]+$/,                             // get list detail
  /^\/list\/[^/]+\/task(\?.*)?$/,                // GET tasks de list ou POST create task
  /^\/task\/[^/]+(\?.*)?$/,                      // GET/PUT/DELETE task
];

function isPathAllowed(path) {
  return ALLOWED_PATH_PATTERNS.some(re => re.test(path));
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const { method, path, body } = req.body || {};
  if (!method || !path) return res.status(400).json({ ok: false, message: 'method e path obrigatórios.' });
  if (!isPathAllowed(String(path))) return res.status(403).json({ ok: false, message: `Path não permitido: ${path}` });

  try {
    const result = await clickupFetch(req.db, req.user.sub, method.toUpperCase(), path, body);
    return res.status(200).json({ ok: result.ok, status: result.status, data: result.data });
  } catch (err) {
    // V31.2.35 — Mensagem clara quando ENCRYPTION_KEY some/quebra em vez de 500 mudo.
    if (err.message?.includes('ENCRYPTION_KEY')) {
      return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY ausente ou inválida no servidor. Admin precisa configurar Railway → Variables.' });
    }
    if (err.message?.includes('ClickUp não conectado')) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado. Vá em Configurações → Integrações pra reconectar.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
};
