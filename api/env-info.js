// V32.0.13 — GET /api/env-info (rota pública)
// Retorna info do ambiente pro frontend identificar staging × produção
// e renderizar banner amarelo "🚧 STAGING" quando aplicável.
//
// Por que rota pública: a tela de login (antes de auth) também precisa
// mostrar o banner, pra Felipe não confundir qual ambiente tá olhando.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  res.status(200).json({
    ok: true,
    environment: process.env.ENVIRONMENT || 'production',
    version: 'V32.0.13'
  });
};
