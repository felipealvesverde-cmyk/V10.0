// V32.2.5 (Geraldo A12) — POST /api/clickup-migrate-to-mirror
// Migra cliente do modo legado (default_list_id + tag) pro modo mirror
// (Space LeadJourney + hierarquia Produto>Campanha>Ação).
//
// Body: { products: [{ id, name, campaigns: [{ id, name, actions: [{ id, name }] }] }] }
//   Cliente envia árvore do LJ que quer pré-espelhar. Tasks existentes na
//   default_list ficam onde estão (não move) — só cria a estrutura nova
//   adiante.
//
// Pré-requisito: lj_space_id já configurado (cliente clicou "Inicializar Space").
//
// Comportamento:
//   - Cria folder por produto, list por campanha, task pai por ação (find-or-create)
//   - Tasks já existentes na default_list NÃO movem (cliente faz isso manual no ClickUp
//     ou deixa coexistir — produto operacional decide depois)
//   - Retorna contagem: { foldersCreated, listsCreated, taskParentsCreated }
const mirror = require('../lib/clickup-mirror');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;

  const credRow = await req.tenantDb.query(
    'SELECT lj_space_id, mirror_enabled, write_enabled FROM clickup_credentials WHERE user_id = $1',
    [userId]
  );
  if (!credRow.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
  const cred = credRow.rows[0];

  if (!cred.lj_space_id) {
    return res.status(400).json({ ok: false, code: 'no_space', message: 'Inicialize o Space LeadJourney antes de migrar.' });
  }
  if (cred.write_enabled === false) {
    return res.status(403).json({ ok: false, code: 'read_only', message: 'ClickUp em modo somente-leitura. Reative em Configurações.' });
  }
  if (cred.mirror_enabled === false) {
    return res.status(400).json({ ok: false, code: 'mirror_disabled', message: 'Reative modo espelhado antes de migrar.' });
  }

  const products = Array.isArray(req.body?.products) ? req.body.products : [];
  if (!products.length) return res.status(400).json({ ok: false, message: 'products array obrigatório.' });

  const stats = { foldersCreated: 0, listsCreated: 0, taskParentsCreated: 0, errors: [] };

  for (const product of products) {
    if (!product?.id || !product?.name) continue;
    try {
      const folderRes = await mirror.ensureProductFolder(req.tenantDb, userId, cred.lj_space_id, product.id, product.name);
      if (folderRes.created) stats.foldersCreated++;

      for (const campaign of (product.campaigns || [])) {
        if (!campaign?.id || !campaign?.name) continue;
        try {
          const listRes = await mirror.ensureCampaignList(req.tenantDb, userId, folderRes.clickupId, campaign.id, campaign.name);
          if (listRes.created) stats.listsCreated++;

          for (const action of (campaign.actions || [])) {
            if (!action?.id || !action?.name) continue;
            try {
              const taskRes = await mirror.ensureActionParentTask(req.tenantDb, userId, listRes.clickupId, action.id, action.name);
              if (taskRes.created) stats.taskParentsCreated++;
            } catch (err) {
              stats.errors.push(`action #${action.id}: ${err.message}`);
            }
          }
        } catch (err) {
          stats.errors.push(`campaign #${campaign.id}: ${err.message}`);
        }
      }
    } catch (err) {
      stats.errors.push(`product #${product.id}: ${err.message}`);
    }
  }

  return res.status(200).json({
    ok: true,
    ...stats,
    message: `Migração concluída: ${stats.foldersCreated} folder(s), ${stats.listsCreated} list(s), ${stats.taskParentsCreated} task(s) pai criadas no ClickUp.`
  });
};
