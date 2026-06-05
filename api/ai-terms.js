// V36.1.0 — GET /api/ai-terms
//
// Retorna conteúdo dos termos da versão atual + status de aceite do user.
// Frontend usa pra renderizar markdown + decidir se mostra checkbox ou
// já está aceito.
//
// Response:
//   { ok, version, content, accepted, acceptedAt, applicable }
//   - content: markdown completo
//   - accepted: bool — aceitou a versão atual?
//   - applicable: bool — termos se aplicam pra este user?
//     (false se source='master' ou 'master-shared' — saldo do LJ não precisa)

const { AI_TERMS_CURRENT_VERSION, loadTermsMarkdown, checkAcceptance } = require('../lib/ai-terms');
const { checkAvailability } = require('../lib/ai-resolver');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = Number(req.user.sub || req.user.id);
  const content = loadTermsMarkdown(AI_TERMS_CURRENT_VERSION);
  if (!content) {
    return res.status(500).json({ ok: false, message: 'Termos indisponíveis no servidor.' });
  }

  try {
    // Status de aceite
    const acceptance = await checkAcceptance(req.db, userId);

    // Aplicabilidade: se source seria master/master-shared, termos NÃO se aplicam.
    // (cliente está usando saldo do LJ — coberto pelo termo do admin)
    let applicable = true;
    try {
      const av = await checkAvailability(req.db, { id: userId, isMaster: Boolean(req.user.isMaster) });
      if (av.source === 'master' || av.source === 'master-shared') {
        applicable = false;
      }
    } catch (_) { /* falha defensiva — assume aplicável */ }

    return res.status(200).json({
      ok: true,
      version: AI_TERMS_CURRENT_VERSION,
      content,
      accepted: acceptance.accepted,
      acceptedAt: acceptance.acceptedAt,
      acceptedVersion: acceptance.version,
      applicable
    });
  } catch (err) {
    console.error('[ai-terms]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
