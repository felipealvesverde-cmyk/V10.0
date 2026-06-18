// V40.4.0 — POST /api/admin-tenant-set-owner (operador LJ only)
// Promove um usuário a OWNER do tenant. Se já tinha outro owner, ele vira
// 'manager' (preserva acesso administrativo mas devolve o leme).
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
    // Rebaixa owner atual (se houver) pra manager.
    await client.query(
      `UPDATE tenant_members SET role = 'manager'
       WHERE tenant_id = $1 AND role = 'owner' AND user_id <> $2`,
      [tenantId, userId]
    );
    // Promove alvo.
    await client.query(
      `UPDATE tenant_members SET role = 'owner' WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId]
    );
    await client.query('COMMIT');
    return res.status(200).json({ ok: true, message: 'Owner atualizado.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[admin-tenant-set-owner]', err);
    return res.status(500).json({ ok: false, message: err.message });
  } finally {
    client.release();
  }
};
