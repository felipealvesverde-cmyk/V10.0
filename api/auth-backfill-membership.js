// V37.4.20 — POST /api/auth-backfill-membership
//
// Self-healing pra users pré-V37.3 que vivem em `users` com
// `default_tenant_id` apontando pro tenant deles, mas não têm row em
// `tenant_members`. Esse era o estado normal de Sansone, Felipe master,
// e qualquer tenant criado em V32-V36 antes de membership virar tabela.
//
// Decisão de role:
//   - Se NENHUM outro user é 'owner' do tenant ainda → vira owner (era o dono)
//   - Senão → vira 'user' (caminho conservador; owner existente promove depois)
//
// Idempotente: se já existe row em tenant_members pro (tenant, user), retorna
// existing sem mexer.

const { ROLES } = require('../lib/permission-engine');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const tenantIdFromJwt = req.user.tenantId || null;

  try {
    // Pega o default_tenant_id atualizado do DB (não confia só no JWT — pode estar stale).
    const u = await req.db.query('SELECT id, default_tenant_id FROM users WHERE id = $1', [userId]);
    if (!u.rows.length) return res.status(404).json({ ok: false, message: 'User não encontrado.' });
    const tenantId = u.rows[0].default_tenant_id || tenantIdFromJwt;
    if (!tenantId) return res.status(400).json({ ok: false, message: 'Usuário sem tenant default. Nada pra backfill.' });

    // Já membro? Retorna sem mexer.
    const existing = await req.db.query(
      'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
    if (existing.rows.length) {
      return res.status(200).json({
        ok: true,
        action: 'noop',
        role: String(existing.rows[0].role).toLowerCase(),
        message: 'Já é membro do tenant.'
      });
    }

    // Existe outro owner desse tenant?
    const otherOwner = await req.db.query(
      `SELECT user_id FROM tenant_members WHERE tenant_id = $1 AND LOWER(role) = 'owner' LIMIT 1`,
      [tenantId]
    );
    const role = otherOwner.rows.length ? 'user' : 'owner';

    await req.db.query(
      `INSERT INTO tenant_members (tenant_id, user_id, role, permissions_overrides, invited_at, joined_at)
       VALUES ($1, $2, $3, '{}'::jsonb, NOW(), NOW())
       ON CONFLICT (tenant_id, user_id) DO NOTHING`,
      [tenantId, userId, role]
    );

    return res.status(200).json({
      ok: true,
      action: 'inserted',
      role,
      tenantId,
      message: role === 'owner'
        ? 'Membership criado como Admin Master (não havia outro owner).'
        : 'Membership criado como Usuário (já existe Admin Master do tenant — peça promoção a ele).'
    });
  } catch (err) {
    console.error('[auth-backfill-membership]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
