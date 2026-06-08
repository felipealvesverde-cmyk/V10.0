// V36.8.0 — POST /api/tenant-create (master only)
//
// Cria um novo cliente (tenant) com:
//   1. Tenant row (status=active, plan=starter, db_connection_string_enc=NULL — modo setup)
//   2. User master do cliente (role=owner)
//   3. Users da equipe (role=member) — opcional
//   4. Tenant_members linkando todos ao tenant
//
// Cada user nasce com senha random gerada (12 chars, alfanumérico + 1 símbolo).
// Master copia as senhas geradas e entrega pros usuários por canal seguro
// (não tem SMTP no LJ ainda).
//
// Tenant nasce SEM banco plugado — cliente vai ser guiado pelo sininho
// pra plugar o banco dele depois (Railway/Neon/Supabase/próprio Postgres).
// Enquanto sem banco, integrações ficam bloqueadas.
//
// Body: {
//   slug: "atira-pro",                       // 3-30 chars lowercase + hífen
//   name: "Atira.Pro",                       // nome exibição
//   masterEmail: "thiago@atira.pro",         // email do owner
//   teamEmails: ["joao@atira.pro", ...]      // emails membros (opcional)
// }
//
// Returns: {
//   ok: true,
//   tenant: { id, slug, name, status },
//   credentials: [
//     { email, initialPassword, role: 'owner' },
//     { email, initialPassword, role: 'member' },
//     ...
//   ]
// }

const bcrypt = require('bcryptjs');

function generatePassword(length = 12) {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = lower + upper + digits + symbols;
  // Garantir pelo menos 1 de cada categoria
  let pwd = [
    lower[Math.floor(Math.random() * lower.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];
  for (let i = pwd.length; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Shuffle
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }
  return pwd.join('');
}

function validateEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

function validateSlug(s) {
  return typeof s === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length >= 3 && s.length <= 30;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode criar tenants.' });

  const slug = String(req.body?.slug || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim();
  const masterEmail = String(req.body?.masterEmail || '').trim().toLowerCase();
  const teamEmails = Array.isArray(req.body?.teamEmails)
    ? req.body.teamEmails.map(e => String(e || '').trim().toLowerCase()).filter(Boolean)
    : [];

  if (!validateSlug(slug)) {
    return res.status(400).json({ ok: false, message: 'slug inválido. Use 3-30 chars: lowercase, números, hífens (sem hífen no início/fim).' });
  }
  if (!name || name.length < 2) {
    return res.status(400).json({ ok: false, message: 'name obrigatório (mín. 2 chars).' });
  }
  if (!validateEmail(masterEmail)) {
    return res.status(400).json({ ok: false, message: 'masterEmail inválido.' });
  }
  for (const e of teamEmails) {
    if (!validateEmail(e)) {
      return res.status(400).json({ ok: false, message: `Email da equipe inválido: ${e}` });
    }
  }
  const allEmails = [masterEmail, ...teamEmails];
  const uniqueEmails = new Set(allEmails);
  if (uniqueEmails.size !== allEmails.length) {
    return res.status(400).json({ ok: false, message: 'Emails duplicados na lista.' });
  }

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');

    const slugCheck = await client.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, message: `slug "${slug}" já existe.` });
    }

    const placeholders = allEmails.map((_, i) => `$${i + 1}`).join(',');
    const emailCheck = await client.query(`SELECT username FROM users WHERE username IN (${placeholders})`, allEmails);
    if (emailCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        ok: false,
        message: `Emails já existem no sistema: ${emailCheck.rows.map(r => r.username).join(', ')}`
      });
    }

    const tenantRes = await client.query(
      `INSERT INTO tenants (slug, name, status, plan, created_at, updated_at)
       VALUES ($1, $2, 'active', 'starter', NOW(), NOW())
       RETURNING id, slug, name, status`,
      [slug, name]
    );
    const tenant = tenantRes.rows[0];

    const credentials = [];
    let ownerUserId = null;

    for (let i = 0; i < allEmails.length; i++) {
      const email = allEmails[i];
      const role = i === 0 ? 'owner' : 'member';
      const password = generatePassword(12);
      const passwordHash = await bcrypt.hash(password, 10);

      const userRes = await client.query(
        `INSERT INTO users (
          username, email, password_hash, is_master, is_approved, mode,
          display_name, default_tenant_id, created_at
        )
        VALUES ($1, $1, $2, FALSE, TRUE, 'production', $3, $4, NOW())
        RETURNING id`,
        [email, passwordHash, email.split('@')[0], tenant.id]
      );
      const userId = userRes.rows[0].id;
      if (role === 'owner') ownerUserId = userId;

      await client.query(
        `INSERT INTO tenant_members (tenant_id, user_id, role, invited_at, joined_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [tenant.id, userId, role]
      );

      credentials.push({ email, initialPassword: password, role });
    }

    await client.query(
      `UPDATE tenants SET owner_user_id = $1, updated_at = NOW() WHERE id = $2`,
      [ownerUserId, tenant.id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      ok: true,
      tenant,
      credentials,
      message: `Tenant "${name}" criado com ${credentials.length} usuário(s). Anote as senhas — elas não ficam salvas.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[tenant-create]', err);
    return res.status(500).json({ ok: false, message: err.message });
  } finally {
    client.release();
  }
};
