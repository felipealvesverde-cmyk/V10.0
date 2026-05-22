// V32.2.3 — GET /api/clickup-test-space
// Verifica se o Space "LeadJourney" ainda está acessível com PAT atual.
// Útil pra detectar PAT revogado / permissions removidas / Space deletado
// ANTES da primeira task falhar.
//
// Retorna { ok: true, accessible: bool, message, spaceName? }.
const { clickupFetch } = require('../lib/clickup-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;

  try {
    const credRow = await req.tenantDb.query(
      'SELECT lj_space_id FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!credRow.rows.length) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
    }
    const ljSpaceId = credRow.rows[0].lj_space_id;
    if (!ljSpaceId) {
      return res.status(200).json({
        ok: true,
        accessible: false,
        message: 'Space LeadJourney não inicializado. Clique em "Inicializar Space" no card de Hierarquia.'
      });
    }

    // Faz GET /space/{id} pra confirmar que o Space existe + PAT pode lê-lo.
    const r = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${ljSpaceId}`);
    if (!r.ok) {
      return res.status(200).json({
        ok: true,
        accessible: false,
        spaceId: ljSpaceId,
        statusCode: r.status,
        message: r.status === 404
          ? 'Space "LeadJourney" não existe mais no ClickUp (deletado ou inacessível). Re-inicialize.'
          : r.status === 401 || r.status === 403
          ? 'PAT sem permissão pra ler o Space. Token pode ter sido revogado/rotacionado no ClickUp.'
          : `ClickUp respondeu ${r.status}.`
      });
    }
    return res.status(200).json({
      ok: true,
      accessible: true,
      spaceId: ljSpaceId,
      spaceName: r.data?.name || 'LeadJourney',
      message: `✓ Space "${r.data?.name || 'LeadJourney'}" acessível.`
    });
  } catch (err) {
    console.error('[clickup-test-space]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
