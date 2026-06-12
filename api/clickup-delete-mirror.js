// V32.2.5 (Geraldo A15) — POST /api/clickup-delete-mirror
// Sync de DELETE quando user remove entity no LJ. Propaga delete pro
// ClickUp (folder/list/task pai correspondente) e remove o mapping.
//
// Body: { lj_kind, lj_id }
//   lj_kind: 'product' | 'campaign' | 'action'
//   lj_id:   ID interno
//
// Comportamento:
//   - Sem mapping → skip silencioso (entity nunca foi espelhada)
//   - Com mapping → DELETE no ClickUp + remove mapping
//   - Read-only → skip
//   - Mirror disabled → skip
//
// IMPORTANTE: delete no ClickUp é IRREVERSÍVEL pelo lado do LJ. Cliente
// que deletar produto no LJ vai perder TODAS as tasks pai/subtasks ligadas
// àquele produto no ClickUp também. Frontend deve confirmar antes.
const { getMapping, deleteMapping } = require('../lib/clickup-mirror');
const { clickupFetch } = require('../lib/clickup-client');
const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  try { await assertCanWriteCredentials(req); }
  catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }

  const userId = await resolveCredentialOwnerId(req);
  const ljKind = String(req.body?.lj_kind || '').trim();
  const ljId = Number(req.body?.lj_id);

  if (!['product', 'campaign', 'action'].includes(ljKind)) {
    return res.status(400).json({ ok: false, message: `lj_kind inválido: ${ljKind}.` });
  }
  if (!ljId) return res.status(400).json({ ok: false, message: 'lj_id obrigatório.' });

  const credRow = await req.tenantDb.query(
    'SELECT mirror_enabled, write_enabled FROM clickup_credentials WHERE user_id = $1',
    [userId]
  );
  if (!credRow.rows.length) {
    return res.status(200).json({ ok: true, skipped: 'no_clickup' });
  }
  const cred = credRow.rows[0];
  if (cred.mirror_enabled === false) return res.status(200).json({ ok: true, skipped: 'mirror_disabled' });
  if (cred.write_enabled === false) return res.status(200).json({ ok: true, skipped: 'read_only' });

  try {
    const mapping = await getMapping(req.tenantDb, userId, ljKind, ljId);
    if (!mapping) {
      return res.status(200).json({ ok: true, skipped: 'no_mapping' });
    }

    const path = mapping.clickup_kind === 'folder' ? `/folder/${mapping.clickup_id}`
               : mapping.clickup_kind === 'list'   ? `/list/${mapping.clickup_id}`
               : mapping.clickup_kind === 'task'   ? `/task/${mapping.clickup_id}`
               : null;
    if (!path) return res.status(500).json({ ok: false, message: `kind desconhecido: ${mapping.clickup_kind}` });

    const r = await clickupFetch(req.tenantDb, userId, 'DELETE', path);
    if (!r.ok && r.status !== 404) {
      // 404 é OK — entity já foi deletada (idempotente). Outros erros logam mas
      // ainda removemos mapping (entity vai estar inacessível de qualquer jeito).
      console.warn(`[clickup-delete-mirror] ClickUp delete ${path} retornou ${r.status}, removendo mapping mesmo assim.`);
    }
    await deleteMapping(req.tenantDb, userId, ljKind, ljId);

    return res.status(200).json({
      ok: true,
      clickupId: mapping.clickup_id,
      kind: mapping.clickup_kind,
      message: `${mapping.clickup_kind} ${mapping.clickup_id} removido do ClickUp.`
    });
  } catch (err) {
    console.error('[clickup-delete-mirror]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
