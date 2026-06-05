// V36.1.0 — POST /api/ai-terms-accept
//
// Registra aceite do user na versão atual dos termos.
// Body opcional: { revoke: true } pra revogar aceite.
//
// Response: { ok, accepted, acceptedAt, version }

const { AI_TERMS_CURRENT_VERSION, recordAcceptance, revokeAcceptance } = require('../lib/ai-terms');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = Number(req.user.sub || req.user.id);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  try {
    let result;
    if (body.revoke === true) {
      result = await revokeAcceptance(req.db, userId);
      return res.status(200).json({
        ok: true,
        revoked: true,
        accepted: false,
        message: 'Aceite revogado. O Djow para de funcionar com sua chave própria.'
      });
    }
    result = await recordAcceptance(req.db, userId);
    return res.status(200).json({
      ok: true,
      accepted: true,
      acceptedAt: result.acceptedAt,
      version: result.version
    });
  } catch (err) {
    console.error('[ai-terms-accept]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
