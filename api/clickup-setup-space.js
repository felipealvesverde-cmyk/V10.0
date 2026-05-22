// V32.2.0 — POST /api/clickup-setup-space
// Setup wizard: cria o Space "LeadJourney" no ClickUp do user pra ser
// raiz da hierarquia espelhada Produto>Campanha>Ação>Tarefa.
//
// Body: { space_name?: string }  (default 'LeadJourney')
//
// Idempotente: se lj_space_id já tá salvo + Space ainda existe no ClickUp,
// retorna o existente sem criar duplicado. Se foi deletado pelo cliente,
// re-cria silenciosamente.
const { clickupFetch } = require('../lib/clickup-client');
const { verifyClickupEntity } = require('../lib/clickup-mirror');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const spaceName = String(req.body?.space_name || 'LeadJourney').trim().slice(0, 64);

  try {
    // 1. Pega credenciais + workspace_id + lj_space_id atual
    const credRow = await req.tenantDb.query(
      'SELECT workspace_id, workspace_name, lj_space_id FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!credRow.rows.length) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado. Conecte o PAT primeiro.' });
    }
    const cred = credRow.rows[0];
    if (!cred.workspace_id) {
      return res.status(400).json({ ok: false, message: 'workspace_id não definido nas credenciais — reconecte ClickUp.' });
    }

    // 2. Se já tem lj_space_id, verifica se ainda existe no ClickUp
    if (cred.lj_space_id) {
      // Space é tipo especial — não cabe em verifyClickupEntity (kind = folder/list/task).
      // Faz check direto via /space/{id}.
      const checkRes = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${cred.lj_space_id}`).catch(() => ({ ok: false }));
      if (checkRes.ok) {
        return res.status(200).json({
          ok: true,
          spaceId: cred.lj_space_id,
          spaceName: checkRes.data?.name || spaceName,
          created: false,
          message: 'Space LeadJourney já existe — reusando.'
        });
      }
      // Existia mas foi deletado pelo cliente → re-cria abaixo
    }

    // 3. Cria Space novo no workspace do user
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
        message: `ClickUp recusou criar Space (${createRes.status}). User do PAT precisa de permissão pra criar Space no workspace.`,
        details: createRes.data
      });
    }

    const spaceId = String(createRes.data.id);

    // 4. Salva lj_space_id nas credenciais
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
