// V32.6.0 — POST /api/clickup-setup-space
// Configura a raiz LJ no ClickUp. A raiz pode ser:
//   - Space  → cliente quer mirror cascado completo (Folder=Produto, List=Campanha, ...)
//   - Folder → mirror cascado parcial (List=Campanha, ...). Produto vira metadado LJ.
//   - List   → mirror achatado: toda Tarefa LJ vira Task na List. Produto/Campanha/Ação ficam só no LJ.
//
// Princípio (V32.5.9 → V32.6.0): LJ NÃO cria nada autonomamente. Cliente escolhe
// um nó EXISTENTE da árvore do workspace dele OU pede pra criar um Space novo.
//
// Body (3 modos):
//   - Adopt nó existente: { root_id: '12345', root_kind: 'space'|'folder'|'list' }
//   - Adopt legacy Space (compat): { space_id: '12345' }  ← V32.5.9, vira root_kind='space'
//   - Create Space novo:  { space_name: 'LeadJourney' }   ← cria Space no workspace
//
// Idempotente: se já tem lj_root_id válido + nada vier no body, retorna o atual.
const { clickupFetch } = require('../lib/clickup-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const adoptRootId = String(req.body?.root_id || req.body?.space_id || '').trim();
  const adoptRootKind = String(req.body?.root_kind || (req.body?.space_id ? 'space' : '')).trim().toLowerCase();
  const spaceName = String(req.body?.space_name || 'LeadJourney').trim().slice(0, 64);

  // Valida root_kind se veio
  if (adoptRootId && !['space', 'folder', 'list'].includes(adoptRootKind)) {
    return res.status(400).json({ ok: false, message: `root_kind inválido: "${adoptRootKind}". Use space, folder ou list.` });
  }

  try {
    const credRow = await req.tenantDb.query(
      'SELECT workspace_id, workspace_name, lj_root_id, lj_root_kind, lj_root_name FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!credRow.rows.length) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado. Conecte primeiro.' });
    }
    const cred = credRow.rows[0];
    if (!cred.workspace_id) {
      return res.status(400).json({ ok: false, message: 'workspace_id não definido — reconecte ClickUp.' });
    }

    // MODO ADOPT — cliente escolheu nó existente (space/folder/list).
    if (adoptRootId) {
      const path = adoptRootKind === 'space'  ? `/space/${adoptRootId}`
                 : adoptRootKind === 'folder' ? `/folder/${adoptRootId}`
                 :                              `/list/${adoptRootId}`;
      const checkRes = await clickupFetch(req.tenantDb, userId, 'GET', path);
      if (!checkRes.ok) {
        return res.status(400).json({
          ok: false,
          step: 'verify_node',
          message: `${adoptRootKind} ${adoptRootId} não acessível (${checkRes.status}). Token sem permissão ou nó não existe.`,
          details: checkRes.data
        });
      }
      const verifiedName = String(checkRes.data?.name || '').slice(0, 255) || null;

      // Persiste. lj_space_id mantido em sincronia quando kind='space' (compat
      // c/ código V32.2.x-V32.5.x que ainda lê lj_space_id direto).
      // V32.6.4 — cast explícito $2::text pra evitar "inconsistent types
      // deduced for parameter $2" do Postgres quando o mesmo placeholder é
      // usado em UPDATE col=$2 E em comparação string WHEN $2 = 'space'.
      await req.tenantDb.query(
        `UPDATE clickup_credentials
            SET lj_root_id = $1, lj_root_kind = $2::text, lj_root_name = $3,
                lj_space_id = CASE WHEN $2::text = 'space' THEN $1::text ELSE lj_space_id END
          WHERE user_id = $4`,
        [adoptRootId, adoptRootKind, verifiedName, userId]
      );

      return res.status(200).json({
        ok: true,
        rootId: adoptRootId,
        rootKind: adoptRootKind,
        rootName: verifiedName,
        created: false,
        adopted: true,
        message: `${labelFor(adoptRootKind)} "${verifiedName}" adotado como raiz do LJ.`
      });
    }

    // MODO CREATE — cria Space novo no workspace.
    // Reuso idempotente: se já tem root configurado E body não pediu nada novo,
    // mantém o atual.
    if (cred.lj_root_id && cred.lj_root_kind) {
      const path = cred.lj_root_kind === 'space'  ? `/space/${cred.lj_root_id}`
                 : cred.lj_root_kind === 'folder' ? `/folder/${cred.lj_root_id}`
                 :                                  `/list/${cred.lj_root_id}`;
      const checkRes = await clickupFetch(req.tenantDb, userId, 'GET', path).catch(() => ({ ok: false }));
      if (checkRes.ok && spaceName === 'LeadJourney') {
        return res.status(200).json({
          ok: true,
          rootId: cred.lj_root_id,
          rootKind: cred.lj_root_kind,
          rootName: checkRes.data?.name || cred.lj_root_name || spaceName,
          created: false,
          message: 'Raiz LJ já configurada — mantendo a atual.'
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
    const createdName = String(createRes.data.name || spaceName).slice(0, 255);

    await req.tenantDb.query(
      `UPDATE clickup_credentials
          SET lj_root_id = $1, lj_root_kind = 'space', lj_root_name = $2,
              lj_space_id = $1
        WHERE user_id = $3`,
      [spaceId, createdName, userId]
    );

    return res.status(200).json({
      ok: true,
      rootId: spaceId,
      rootKind: 'space',
      rootName: createdName,
      created: true,
      message: `Space "${createdName}" criado no workspace ${cred.workspace_name || cred.workspace_id}.`
    });
  } catch (err) {
    console.error('[clickup-setup-space]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};

function labelFor(kind) {
  return kind === 'space' ? 'Space' : kind === 'folder' ? 'Folder' : kind === 'list' ? 'List' : 'Nó';
}
