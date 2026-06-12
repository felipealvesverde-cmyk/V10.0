// V37.3.4 — Permission client (frontend).
//
// LJCan(key) — função canônica pra checar permissões na UI.
//   - Master LJ → sempre true
//   - Sem userPermissions carregado → fallback permissivo (assume true até carregar)
//     pra não quebrar tela ANTES do /api/my-permissions responder
//   - Carregado → checa effective[key]
//
// Uso em templates:
//   ${window.LJCan('edit.mapa') ? '<button>Editar</button>' : ''}
//
// Uso em handlers (defensivo):
//   if (!window.LJCan('ops.integracoes')) return Utils.toast('Sem permissão.');
//
// Carga inicial: Actions.loadMyPermissions() chamado no boot do app
// (depois de auth-me retornar user válido).

window.LJCan = function(key) {
  const perms = window.App?.state?.userPermissions;
  if (!perms) {
    // V37.3.4 — fallback permissivo enquanto não carregou. Evita "flash"
    // de UI bloqueada antes do /api/my-permissions retornar.
    return true;
  }
  if (perms.isMaster) return true;
  return Boolean(perms.effective?.[key]);
};

window.LJRole = function() {
  const perms = window.App?.state?.userPermissions;
  if (!perms) return null;
  if (perms.isMaster) return 'master';
  return perms.role || null;
};

window.LJIsMaster = function() {
  return Boolean(window.App?.state?.userPermissions?.isMaster);
};
