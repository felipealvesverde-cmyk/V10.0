// V37.3.3 — POST /api/tenant-invite-accept
// Body: { token, username, password, displayName? }
// Endpoint PÚBLICO (não exige JWT — é a aceitação inicial).
//
// Fluxo:
//   1. Valida token (existe + não expirado + não aceito)
//   2. Cria user na tabela users (is_approved=true, mode='production')
//      ou reusa user existente se email já cadastrado
//   3. Insere em tenant_members com role + permissions_overrides do convite
//   4. Marca invite como accepted_at + accepted_user_id
//   5. Retorna JWT pro login automático

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const token = String(req.body?.token || '').trim();
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim();

  if (!token || token.length < 16) return res.status(400).json({ ok: false, message: 'Token inválido.' });
  if (!password || password.length < 8) return res.status(400).json({ ok: false, message: 'Senha mínima 8 caracteres.' });
  if (!username || username.length < 3) return res.status(400).json({ ok: false, message: 'Username obrigatório (3+ chars).' });

  const client = await req.db.connect();

  try {
    await client.query('BEGIN');

    const inv = await client.query(`
      SELECT id, tenant_id, invitee_email, role, permissions_overrides, expires_at, accepted_at
      FROM tenant_invites WHERE token = $1
      FOR UPDATE
    `, [token]);

    if (!inv.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, message: 'Convite não encontrado.' });
    }
    const invite = inv.rows[0];
    if (invite.accepted_at) {
      await client.query('ROLLBACK');
      return res.status(410).json({ ok: false, message: 'Convite já foi aceito.' });
    }
    if (new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(410).json({ ok: false, message: 'Convite expirado.' });
    }

    const email = invite.invitee_email;

    // Verifica se já existe user com esse email.
    const existing = await client.query(
      'SELECT id, is_approved, password_hash FROM users WHERE LOWER(email) = $1',
      [email]
    );

    let userId;
    let alreadyHadAccount = false;

    if (existing.rows.length) {
      // Reusa user existente (não duplica conta). Se ainda não tinha senha,
      // seta agora. Se tem senha, exige login normal antes (não dá pra
      // resetar via convite).
      const u = existing.rows[0];
      if (u.password_hash && u.password_hash.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          ok: false,
          message: 'Esta conta já tem senha. Faça login com sua senha atual em vez de aceitar o convite.',
          requiresLogin: true
        });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      await client.query(`
        UPDATE users
          SET password_hash = $1, is_approved = TRUE, mode = COALESCE(NULLIF(mode, ''), 'production'),
              display_name = COALESCE(NULLIF(display_name, ''), $2),
              default_tenant_id = COALESCE(default_tenant_id, $3)
          WHERE id = $4
      `, [passwordHash, displayName || username, invite.tenant_id, u.id]);
      userId = u.id;
      alreadyHadAccount = true;
    } else {
      // Cria user novo.
      // Verifica unicidade do username.
      const u2 = await client.query('SELECT id FROM users WHERE LOWER(username) = $1', [username]);
      if (u2.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ ok: false, message: 'Username já em uso. Escolha outro.' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const created = await client.query(`
        INSERT INTO users (username, email, password_hash, is_master, is_approved, mode, display_name, default_tenant_id, created_at)
        VALUES ($1, $2, $3, FALSE, TRUE, 'production', $4, $5, NOW())
        RETURNING id
      `, [username, email, passwordHash, displayName || username, invite.tenant_id]);
      userId = created.rows[0].id;
    }

    // Adiciona em tenant_members (idempotent — se já era membro, atualiza só role/overrides)
    await client.query(`
      INSERT INTO tenant_members (tenant_id, user_id, role, permissions_overrides, invited_at, joined_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (tenant_id, user_id) DO UPDATE
        SET role = EXCLUDED.role,
            permissions_overrides = EXCLUDED.permissions_overrides,
            joined_at = COALESCE(tenant_members.joined_at, NOW())
    `, [invite.tenant_id, userId, invite.role, JSON.stringify(invite.permissions_overrides || {})]);

    // Marca convite aceito
    await client.query(`
      UPDATE tenant_invites
        SET accepted_at = NOW(), accepted_user_id = $1
      WHERE id = $2
    `, [userId, invite.id]);

    await client.query('COMMIT');

    // Emite JWT pra login automático
    const userRow = await req.db.query(`
      SELECT id, username, email, is_master, mode, default_tenant_id, display_name
      FROM users WHERE id = $1
    `, [userId]);
    const u = userRow.rows[0];

    const payload = {
      sub: u.id,
      username: u.username,
      email: u.email,
      isMaster: u.is_master,
      mode: u.mode,
      tenantId: u.default_tenant_id
    };
    const tokenJwt = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      ok: true,
      message: alreadyHadAccount ? 'Acesso ao tenant ativado.' : 'Conta criada e convite aceito.',
      jwt: tokenJwt,
      user: {
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.display_name,
        isMaster: u.is_master,
        tenantId: u.default_tenant_id
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[tenant-invite-accept]', err);
    return res.status(500).json({ ok: false, message: err.message });
  } finally {
    client.release();
  }
};
