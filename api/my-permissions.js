// V37.3.4 — GET /api/my-permissions
// Retorna as permissões efetivas do user logado no tenant ativo.
// Frontend carrega isso após login + popula App.state.userPermissions.

const { resolveUserPermissions } = require('../lib/permission-check');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  try {
    const perms = await resolveUserPermissions(req);
    if (!perms) {
      // Sem tenant ativo OU não é membro. Retorna estrutura mínima — frontend
      // trata como "sem permissões" e pode renderizar tela bloqueada.
      return res.status(200).json({
        ok: true,
        permissions: {
          role: null,
          overrides: {},
          effective: {},
          isMaster: Boolean(req.user.isMaster)
        }
      });
    }
    return res.status(200).json({
      ok: true,
      permissions: {
        role: perms.role,
        overrides: perms.overrides,
        effective: perms.effective,
        isMaster: perms.isMaster
      }
    });
  } catch (err) {
    console.error('[my-permissions]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
