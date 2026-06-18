// V40.0.0 — POST /api/admin-create-tenant-user (operador LJ only)
// Cria um usuário avulso pra tenant existente. Útil quando o cliente compra LJ
// e a equipe dele cresce, e o operador precisa criar acessos novos sem
// recriar o tenant inteiro.
// Body: { tenantId, email, role ('owner'|'manager'|'user'), displayName?, initialPassword? }
// Se initialPassword vazio, gera aleatório e devolve no response (operador
// repassa pro cliente fora-de-banda).
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function randomPassword(len = 14) {
  return crypto.randomBytes(len).toString('base64').slice(0, len);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const { tenantId, email, role, displayName, initialPassword } = req.body || {};
  if (!tenantId || !email) {
    return res.status(400).json({ ok: false, message: 'tenantId e email obrigatórios.' });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanRole = ['owner', 'manager', 'user'].includes(String(role)) ? String(role) : 'user';
  const password = String(initialPassword || randomPassword());

  try {
    const tenant = await req.db.query(
      `SELECT id, slug, name FROM tenants WHERE id = $1`,
      [Number(tenantId)]
    );
    if (!tenant.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });

    const existing = await req.db.query(
      `SELECT id FROM users WHERE LOWER(username) = $1`,
      [cleanEmail]
    );
    if (existing.rows.length) {
      return res.status(409).json({ ok: false, message: 'Já existe usuário com este email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await req.db.query(
      `INSERT INTO users (
        username, email, password_hash, is_master, is_approved, mode,
        display_name, default_tenant_id, created_at
      )
      VALUES ($1, $1, $2, FALSE, TRUE, 'production', $3, $4, NOW())
      RETURNING id, username`,
      [cleanEmail, passwordHash, String(displayName || cleanEmail.split('@')[0]), Number(tenantId)]
    );
    const userId = userRes.rows[0].id;

    await req.db.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role, invited_at, joined_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [Number(tenantId), userId, cleanRole]
    );

    return res.status(200).json({
      ok: true,
      user: { id: userId, email: cleanEmail, role: cleanRole },
      initialPassword: password, // operador repassa fora-de-banda
      tenant: tenant.rows[0]
    });
  } catch (err) {
    console.error('[admin-create-tenant-user]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
