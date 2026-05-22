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

  // V32.6.0 — usa lj_root_id/kind (com fallback lj_space_id pra cliente pré-V32.6.0).
  const credRow = await req.tenantDb.query(
    'SELECT lj_space_id, lj_root_id, lj_root_kind, mirror_enabled, write_enabled FROM clickup_credentials WHERE user_id = $1',
    [userId]
  );
  if (!credRow.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
  const cred = credRow.rows[0];
  const rootId = cred.lj_root_id || cred.lj_space_id || null;
  const rootKind = cred.lj_root_kind || (cred.lj_space_id ? 'space' : null);

  if (!rootId || !rootKind) {
    return res.status(400).json({ ok: false, code: 'no_root', message: 'Configure a raiz LJ antes de migrar (Configurações → ClickUp → Configurar Space).' });
  }
  if (cred.write_enabled === false) {
    return res.status(403).json({ ok: false, code: 'read_only', message: 'ClickUp em modo somente-leitura. Reative em Configurações.' });
  }
  if (cred.mirror_enabled === false) {
    return res.status(400).json({ ok: false, code: 'mirror_disabled', message: 'Reative modo espelhado antes de migrar.' });
  }

  // Modo flat (raiz=List): nada a pré-criar — tasks viram Tasks na list direto
  // quando criadas. "Migrar tudo" não faz sentido aqui.
  if (rootKind === 'list') {
    return res.status(200).json({
      ok: true,
      foldersCreated: 0, listsCreated: 0, taskParentsCreated: 0, errors: [],
      message: 'Modo achatado (raiz=List): não há estrutura pra pré-criar. Tarefas viram Tasks diretamente ao serem criadas no LJ.'
    });
  }

  const products = Array.isArray(req.body?.products) ? req.body.products : [];
  if (!products.length) return res.status(400).json({ ok: false, message: 'products array obrigatório.' });

  const stats = { foldersCreated: 0, listsCreated: 0, taskParentsCreated: 0, errors: [] };

  for (const product of products) {
    if (!product?.id || !product?.name) continue;
    try {
      // Em modo space: cria Folder(Produto) abaixo da raiz; em modo folder:
      // pula Folder(Produto), Campanha já vira List dentro da raiz Folder.
      let parentForCampaigns;
      if (rootKind === 'folder') {
        parentForCampaigns = rootId;
      } else {
        const folderRes = await mirror.ensureProductFolder(req.tenantDb, userId, rootId, product.id, product.name);
        if (folderRes.created) stats.foldersCreated++;
        parentForCampaigns = folderRes.clickupId;
      }

      for (const campaign of (product.campaigns || [])) {
        if (!campaign?.id || !campaign?.name) continue;
        try {
          const listRes = await mirror.ensureCampaignList(req.tenantDb, userId, parentForCampaigns, campaign.id, campaign.name);
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
