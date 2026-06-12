// V37.4.38 — POST /api/pin-edit
// Body: { id, text?, audienceUserIds? }
// Só o creator pode editar. Não muda anchor (posição é imutável após cravar).

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  const id = Number(req.body?.id);
  if (!id) return res.status(400).json({ ok: false, message: 'id obrigatório.' });
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  const text = req.body?.text != null ? String(req.body.text).trim().slice(0, 400) : null;
  const audience = Array.isArray(req.body?.audienceUserIds)
    ? req.body.audienceUserIds.map(Number).filter(Boolean)
    : null;

  if (text === '' || (audience && !audience.length)) {
    return res.status(400).json({ ok: false, message: 'text e audienceUserIds não podem ficar vazios.' });
  }
  if (text === null && audience === null) {
    return res.status(400).json({ ok: false, message: 'Nada pra editar.' });
  }

  try {
    const r = await req.tenantDb.query(
      'SELECT creator_user_id FROM pins WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL',
      [id, tenantId]
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Pin não encontrado.' });
    if (r.rows[0].creator_user_id !== userId) {
      return res.status(403).json({ ok: false, message: 'Só o criador do pin pode editar.' });
    }

    const sets = [];
    const params = [id];
    if (text !== null) { params.push(text); sets.push(`text = $${params.length}`); }
    if (audience !== null) { params.push(audience); sets.push(`audience_user_ids = $${params.length}`); }

    await req.tenantDb.query(
      `UPDATE pins SET ${sets.join(', ')} WHERE id = $1`,
      params
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[pin-edit]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
