// V37.5.0 — POST /api/pin-action
// Body: { id, action: 'mark_seen' | 'archive' }
// User pode:
//   mark_seen — adiciona user_id ao seen_by_user_ids (idempotente)
//   archive   — arquiva (criador OU audience podem)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  const id = Number(req.body?.id);
  const action = String(req.body?.action || '');

  if (!id || !action) return res.status(400).json({ ok: false, message: 'id + action obrigatórios.' });

  try {
    const pin = await req.tenantDb.query(`
      SELECT id, creator_user_id, audience_user_ids
      FROM pins
      WHERE id = $1 AND tenant_id = $2 AND archived_at IS NULL
    `, [id, tenantId]);
    if (!pin.rows.length) return res.status(404).json({ ok: false, message: 'Pin não encontrado.' });
    const p = pin.rows[0];
    const canTouch = p.creator_user_id === userId || (p.audience_user_ids || []).includes(userId);
    if (!canTouch) return res.status(403).json({ ok: false, message: 'Sem permissão.' });

    if (action === 'mark_seen') {
      await req.tenantDb.query(`
        UPDATE pins
        SET seen_by_user_ids = (
          CASE WHEN $1 = ANY(seen_by_user_ids) THEN seen_by_user_ids
               ELSE array_append(seen_by_user_ids, $1)
          END
        )
        WHERE id = $2
      `, [userId, id]);
    } else if (action === 'archive') {
      await req.tenantDb.query(`
        UPDATE pins SET archived_at = NOW() WHERE id = $1
      `, [id]);
    } else {
      return res.status(400).json({ ok: false, message: `Action inválida: ${action}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[pin-action]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
