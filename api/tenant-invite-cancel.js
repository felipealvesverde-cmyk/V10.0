// V37.4.27 — POST /api/tenant-invite-cancel
// Cancela (deleta) um convite pendente. Só Master ou owner do tenant.
//
// Body: { inviteId } OU { token }
//
// Idempotente: se já foi cancelado/aceito, devolve ok=true com action='noop'.

const { normalizeRole } = require('../lib/permission-engine');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const inviteId = req.body?.inviteId ? Number(req.body.inviteId) : null;
  const token = req.body?.token ? String(req.body.token).trim() : null;
  if (!inviteId && !token) {
    return res.status(400).json({ ok: false, message: 'inviteId ou token obrigatório.' });
  }

  try {
    const where = inviteId ? 'id = $1' : 'token = $1';
    const param = inviteId || token;
    const lookup = await req.db.query(
      `SELECT id, tenant_id, invitee_email, accepted_at FROM tenant_invites WHERE ${where}`,
      [param]
    );
    if (!lookup.rows.length) {
      return res.status(200).json({ ok: true, action: 'noop', message: 'Convite não existe (já cancelado).' });
    }
    const invite = lookup.rows[0];

    if (invite.accepted_at) {
      return res.status(409).json({
        ok: false,
        message: 'Esse convite já foi aceito — o usuário já é membro. Remova pelo painel de Membros.'
      });
    }

    if (!req.user.isMaster) {
      const m = await req.db.query(
        'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [invite.tenant_id, req.user.sub]
      );
      if (!m.rows.length || normalizeRole(m.rows[0].role) !== 'owner') {
        return res.status(403).json({ ok: false, message: 'Apenas Master ou Admin Master do tenant.' });
      }
    }

    await req.db.query('DELETE FROM tenant_invites WHERE id = $1', [invite.id]);

    return res.status(200).json({
      ok: true,
      action: 'deleted',
      email: invite.invitee_email,
      message: `Convite pra ${invite.invitee_email} cancelado.`
    });
  } catch (err) {
    console.error('[tenant-invite-cancel]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
