// V37.3.3 — GET /api/tenant-invite-info?token=xxx
// Endpoint PÚBLICO (não exige JWT) — retorna info do convite pra página
// accept-invite.html montar o form.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const token = String(req.query?.token || '').trim();
  if (!token || token.length < 16) return res.status(400).json({ ok: false, message: 'Token inválido.' });

  try {
    const r = await req.db.query(`
      SELECT i.id, i.invitee_email, i.role, i.permissions_overrides, i.expires_at, i.accepted_at,
             t.name AS tenant_name, t.slug AS tenant_slug,
             u.display_name AS inviter_name, u.username AS inviter_username
      FROM tenant_invites i
      JOIN tenants t ON t.id = i.tenant_id
      JOIN users u ON u.id = i.inviter_user_id
      WHERE i.token = $1
    `, [token]);

    if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Convite não encontrado.' });

    const row = r.rows[0];

    if (row.accepted_at) {
      return res.status(410).json({ ok: false, message: 'Convite já aceito.', status: 'accepted' });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ ok: false, message: 'Convite expirado.', status: 'expired' });
    }

    return res.status(200).json({
      ok: true,
      invite: {
        email: row.invitee_email,
        role: row.role,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        inviterName: row.inviter_name || row.inviter_username,
        expiresAt: row.expires_at
      }
    });
  } catch (err) {
    console.error('[tenant-invite-info]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
