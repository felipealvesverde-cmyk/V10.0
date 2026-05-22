// V32.5.9 — POST /api/clickup-setup-space
// Setup wizard: adopta um Space EXISTENTE do workspace OU cria um novo
// pra ser raiz da hierarquia espelhada Produto>Campanha>Ação>Tarefa.
//
// Body (2 modos):
//   - Adopt: { space_id: '12345' }  ← cliente escolheu Space existente
//   - Create: { space_name: 'LeadJourney' }  ← cria novo no workspace
//
// Princípio (V32.5.9): LJ NÃO cria Space autonomamente. Cliente sempre
// escolhe entre Spaces existentes do workspace dele ou pede pra criar
// um novo com nome customizado — soberania do workspace.
//
// Idempotente: se lj_space_id já tá salvo + Space ainda existe no ClickUp,
// retorna o existente sem mudar nada (modo legacy/refresh).
const { clickupFetch } = require('../lib/clickup-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const adoptSpaceId = String(req.body?.space_id || '').trim();
  const spaceName = String(req.body?.space_name || 'LeadJourney').trim().slice(0, 64);

  try {
    // 1. Pega credenciais + workspace_id + lj_space_id atual
    const credRow = await req.tenantDb.query(
      'SELECT workspace_id, workspace_name, lj_space_id FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!credRow.rows.length) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado. Conecte primeiro.' });
    }
    const cred = credRow.rows[0];
    if (!cred.workspace_id) {
      return res.status(400).json({ ok: false, message: 'workspace_id não definido — reconecte ClickUp.' });
    }

    // 2. MODO ADOPT — cliente escolheu Space existente.
    if (adoptSpaceId) {
      // Valida que o Space existe + token consegue lê-lo.
      const checkRes = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${adoptSpaceId}`);
      if (!checkRes.ok) {
        return res.status(400).json({
          ok: false,
          step: 'verify_space',
          message: `Space ${adoptSpaceId} não acessível (${checkRes.status}). Token sem permissão ou Space não existe.`,
          details: checkRes.data
        });
      }
      const verifiedName = checkRes.data?.name || null;

      // Persiste como lj_space_id (substitui se já tinha outro).
      await req.tenantDb.query(
        'UPDATE clickup_credentials SET lj_space_id = $1 WHERE user_id = $2',
        [adoptSpaceId, userId]
      );

      return res.status(200).json({
        ok: true,
        spaceId: adoptSpaceId,
        spaceName: verifiedName || spaceName,
        created: false,
        adopted: true,
        message: `Space "${verifiedName}" adotado como raiz da hierarquia LJ.`
      });
    }

    // 3. MODO CREATE — cria Space novo no workspace (cliente pediu explicitamente).
    // Reuso idempotente: se já tem lj_space_id válido E cliente não passou novo nome,
    // mantém o atual (evita criar duplicado em refreshes acidentais).
    if (cred.lj_space_id && spaceName === 'LeadJourney') {
      const checkRes = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${cred.lj_space_id}`).catch(() => ({ ok: false }));
      if (checkRes.ok) {
        return res.status(200).json({
          ok: true,
          spaceId: cred.lj_space_id,
          spaceName: checkRes.data?.name || spaceName,
          created: false,
          message: 'Space já configurado — mantendo o atual.'
        });
      }
    }

    const createRes = await clickupFetch(req.tenantDb, userId, 'POST', `/team/${cred.workspace_id}/space`, {
      name: spaceName,
      multiple_assignees: true,
      features: {
        due_dates: { enabled: true, start_date: true, remap_due_dates: false, remap_closed_due_date: false },
        time_tracking: { enabled: false },
        tags: { enabled: true },
        time_estimates: { enabled: true },
        checklists: { enabled: true },
        custom_fields: { enabled: true },
        remap_dependencies: { enabled: true },
        dependency_warning: { enabled: true },
        portfolios: { enabled: false }
      }
    });

    if (!createRes.ok || !createRes.data?.id) {
      return res.status(502).json({
        ok: false,
        step: 'create_space',
        message: `ClickUp recusou criar Space (${createRes.status}). Token precisa de permissão pra criar Space no workspace.`,
        details: createRes.data
      });
    }

    const spaceId = String(createRes.data.id);

    await req.tenantDb.query(
      'UPDATE clickup_credentials SET lj_space_id = $1 WHERE user_id = $2',
      [spaceId, userId]
    );

    return res.status(200).json({
      ok: true,
      spaceId,
      spaceName: createRes.data.name || spaceName,
      created: true,
      message: `Space "${createRes.data.name}" criado no workspace ${cred.workspace_name || cred.workspace_id}.`
    });
  } catch (err) {
    console.error('[clickup-setup-space]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
