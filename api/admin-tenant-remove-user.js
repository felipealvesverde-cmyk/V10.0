// V40.4.0 — POST /api/admin-tenant-remove-user (operador LJ only)
// Remove um usuário do tenant (apaga registro em tenant_members). NÃO deleta
// o user — ele pode continuar existindo solto ou em outro tenant. Se era o
// default_tenant_id do user, zera essa coluna.
//
// Body: { tenantId, userId }
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const tenantId = Number(req.body?.tenantId);
  const userId = Number(req.body?.userId);
  if (!tenantId || !userId) return res.status(400).json({ ok: false, message: 'tenantId e userId obrigatórios.' });

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');
    const memberCheck = await client.query(
      'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
    if (!memberCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Usuário não é membro deste tenant.' });
    }
    // Bloqueia remoção do último owner — força promover outro primeiro.
    if (memberCheck.rows[0].role === 'owner') {
      const otherOwners = await client.query(
        `SELECT COUNT(*)::int AS n FROM tenant_members
         WHERE tenant_id = $1 AND role = 'owner' AND user_id <> $2`,
        [tenantId, userId]
      );
      if (Number(otherOwners.rows[0].n) === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          ok: false,
          message: 'É o único owner. Promova outro membro antes de remover.'
        });
      }
    }
    await client.query(
      'DELETE FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
    await client.query(
      `UPDATE users SET default_tenant_id = NULL
       WHERE id = $1 AND default_tenant_id = $2`,
      [userId, tenantId]
    );
    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Usuário removido do tenant.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin-tenant-remove-user]', err);
    return res.status(500).json({ ok: false, message: err.message });
  } finally {
    client.release();
  }
};
