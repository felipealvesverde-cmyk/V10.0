// V32.2.0 — POST /api/clickup-rename-mirror
// Sync automático quando user renomeia entity NO LJ (produto, campanha, ação).
// LJ dispara este endpoint pra propagar o nome novo pro ClickUp (folder, list,
// task pai correspondente).
//
// Body: { lj_kind, lj_id, new_name }
//   lj_kind: 'product' | 'campaign' | 'action'
//   lj_id:   ID interno do LJ (number)
//   new_name: novo nome
//
// Não-bloqueante pra o user: se ClickUp falhar, retorna erro mas frontend
// já salvou a mudança local. UI mostra toast com warning.
//
// Idempotente: se entity não tá mapeada no ClickUp ainda, retorna ok + skipped.
const { renameMirroredEntity } = require('../lib/clickup-mirror');
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
  const newName = String(req.body?.new_name || '').trim();

  if (!['product', 'campaign', 'action'].includes(ljKind)) {
    return res.status(400).json({ ok: false, message: `lj_kind inválido: ${ljKind}. Use product/campaign/action.` });
  }
  if (!ljId) return res.status(400).json({ ok: false, message: 'lj_id obrigatório.' });
  if (!newName) return res.status(400).json({ ok: false, message: 'new_name obrigatório.' });

  // Pré-check: user tem ClickUp + mirror habilitado?
  const credRow = await req.tenantDb.query(
    'SELECT mirror_enabled, lj_space_id, write_enabled FROM clickup_credentials WHERE user_id = $1',
    [userId]
  );
  if (!credRow.rows.length) {
    return res.status(200).json({ ok: true, skipped: 'no_clickup', message: 'ClickUp não conectado — sync pulado.' });
  }
  const cred = credRow.rows[0];
  if (cred.mirror_enabled === false) {
    return res.status(200).json({ ok: true, skipped: 'mirror_disabled' });
  }
  if (!cred.lj_space_id) {
    return res.status(200).json({ ok: true, skipped: 'no_lj_space' });
  }
  if (cred.write_enabled === false) {
    return res.status(200).json({ ok: true, skipped: 'read_only' });
  }

  try {
    const result = await renameMirroredEntity(req.tenantDb, userId, ljKind, ljId, newName);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[clickup-rename-mirror]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
