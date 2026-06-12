// V37.3.1 — Helper de checagem de permissão pra endpoints API.
// Substitui middleware Express (LJ usa handlers diretos).
//
// Uso:
//   const { checkPermission } = require('../lib/permission-check');
//   module.exports = async function handler(req, res) {
//     if (!await checkPermission(req, res, 'ops.integracoes')) return;
//     // ... endpoint logic
//   };
//
// Comportamento:
//   - Sem JWT → 401
//   - Master LJ (is_master=true) → bypass total, sempre passa
//   - Sem tenantId → 403
//   - Sem membership no tenant → 403
//   - Permissão não concedida → 403
//   - OK → retorna true, popula req.tenantRole + req.tenantPermissions

const { hasPermission, effectivePermissions, normalizeRole } = require('./permission-engine');

async function checkPermission(req, res, key) {
  if (!req.user) {
    res.status(401).json({ ok: false, message: 'Não autenticado.' });
    return false;
  }

  // Master LJ (felipealvesverde@) bypassa TUDO.
  if (req.user.isMaster) {
    req.tenantRole = 'owner';
    req.tenantPermissions = {};
    return true;
  }

  if (!req.db) {
    res.status(503).json({ ok: false, message: 'Banco não configurado.' });
    return false;
  }

  // V37.4.21 — JWT pré-V37 pode não carregar tenantId. Cai em
  // users.default_tenant_id antes de desistir.
  let tenantId = req.user.tenantId || null;
  if (!tenantId) {
    const u = await req.db.query('SELECT default_tenant_id FROM users WHERE id = $1', [req.user.sub]);
    tenantId = u.rows[0]?.default_tenant_id || null;
  }
  if (!tenantId) {
    res.status(403).json({ ok: false, message: 'Sem tenant ativo.' });
    return false;
  }

  try {
    const r = await req.db.query(
      'SELECT role, permissions_overrides FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, req.user.sub]
    );
    if (!r.rows.length) {
      res.status(403).json({ ok: false, message: 'Sem acesso a este tenant.' });
      return false;
    }
    const { role, permissions_overrides } = r.rows[0];
    const normalizedRole = normalizeRole(role);
    const overrides = permissions_overrides || {};

    if (!hasPermission(normalizedRole, overrides, key)) {
      res.status(403).json({ ok: false, message: `Sem permissão pra "${key}".`, role: normalizedRole });
      return false;
    }

    req.tenantRole = normalizedRole;
    req.tenantPermissions = overrides;
    return true;
  } catch (err) {
    console.error('[permission-check]', err);
    res.status(500).json({ ok: false, message: 'Erro ao verificar permissão.' });
    return false;
  }
}

// Versão non-throwing pra UI/info — só retorna o resolved perms do user atual.
async function resolveUserPermissions(req) {
  if (!req.user) return null;
  if (req.user.isMaster) {
    // Master tem todas
    const all = effectivePermissions('owner', {});
    return { role: 'owner', overrides: {}, effective: all, isMaster: true };
  }
  if (!req.db) return null;

  try {
    // V37.4.21 — JWT pré-V37 pode não carregar tenantId. Cai em
    // users.default_tenant_id como fallback antes de desistir. Resolve o caso
    // do Sansone: JWT antigo sem tenantId mas users.default_tenant_id setado.
    let tenantId = req.user.tenantId || null;
    if (!tenantId) {
      const u = await req.db.query('SELECT default_tenant_id FROM users WHERE id = $1', [req.user.sub]);
      tenantId = u.rows[0]?.default_tenant_id || null;
    }
    if (!tenantId) return null;

    const r = await req.db.query(
      'SELECT role, permissions_overrides FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, req.user.sub]
    );
    if (!r.rows.length) return null;
    const { role, permissions_overrides } = r.rows[0];
    const normalizedRole = normalizeRole(role);
    const overrides = permissions_overrides || {};
    return {
      role: normalizedRole,
      overrides,
      effective: effectivePermissions(normalizedRole, overrides),
      isMaster: false
    };
  } catch (err) {
    console.error('[permission-check resolveUserPermissions]', err);
    return null;
  }
}

module.exports = { checkPermission, resolveUserPermissions };
