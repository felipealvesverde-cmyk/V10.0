// V37.3.1 — Permission engine.
// Define 3 templates de role (owner / manager / user) + overrides granulares.
// hasPermission(role, overrides, key) é a função canônica usada por
// middleware e UI.
//
// Filosofia:
//   - role determina o template base
//   - permissions_overrides (JSONB no tenant_members) sobrepõe chaves
//     específicas. Ex: { 'view.dre': true } pra um Usuário libera DRE
//     individualmente sem promover ele a Gerente.
//
// Master global (users.is_master=true) bypassa TUDO. Hierarquia:
//   Master LJ (felipealvesverde@) > Tenant Owner > Manager > User.

const ROLES = ['owner', 'manager', 'user'];

const PERMISSION_KEYS = [
  // Visualização
  'view.dashboard',
  'view.mapa',
  'view.dre',
  'view.revops',
  'view.financeiro',
  'view.score',
  'view.leads',
  'view.checkout',
  'view.tarefas',
  // Edição
  'edit.mapa',
  'edit.campanha',
  'edit.acao',
  'edit.produto',
  'edit.score',
  'edit.kpi',
  'edit.kr',
  // Operações
  'ops.integracoes',
  'ops.lead_import',
  'ops.lead_export',
  'ops.rd_sync',
  'ops.tasks',
  // Administração (só Owner)
  'admin.convidar_membro',
  'admin.editar_role',
  'admin.remover_membro',
  'admin.editar_billing',
  'admin.editar_db_tenant',
  // Djow (ilimitado pra todos)
  'djow'
];

const ROLE_TEMPLATES = {
  owner: {
    'view.dashboard': true, 'view.mapa': true, 'view.dre': true,
    'view.revops': true, 'view.financeiro': true, 'view.score': true,
    'view.leads': true, 'view.checkout': true, 'view.tarefas': true,
    'edit.mapa': true, 'edit.campanha': true, 'edit.acao': true,
    'edit.produto': true, 'edit.score': true, 'edit.kpi': true, 'edit.kr': true,
    'ops.integracoes': true, 'ops.lead_import': true, 'ops.lead_export': true,
    'ops.rd_sync': true, 'ops.tasks': true,
    'admin.convidar_membro': true, 'admin.editar_role': true,
    'admin.remover_membro': true, 'admin.editar_billing': true,
    'admin.editar_db_tenant': true,
    'djow': true
  },
  manager: {
    'view.dashboard': true, 'view.mapa': true, 'view.dre': true,
    'view.revops': true, 'view.financeiro': true, 'view.score': true,
    'view.leads': true, 'view.checkout': true, 'view.tarefas': true,
    'edit.mapa': true, 'edit.campanha': true, 'edit.acao': true,
    'edit.produto': true,
    'edit.score': false,          // Gerente NÃO mexe em Score Engine (Felipe 2026-06-12)
    'edit.kpi': true, 'edit.kr': true,
    'ops.integracoes': false,     // Gerente NÃO mexe em integrações (Felipe 2026-06-12)
    'ops.lead_import': true, 'ops.lead_export': true,
    'ops.rd_sync': true, 'ops.tasks': true,
    'admin.convidar_membro': false, 'admin.editar_role': false,
    'admin.remover_membro': false, 'admin.editar_billing': false,
    'admin.editar_db_tenant': false,
    'djow': true
  },
  user: {
    'view.dashboard': true,
    'view.mapa': true,            // Usuário vê o Mapa mas em modo leitura
    'view.dre': false,
    'view.revops': false,
    'view.financeiro': false,
    'view.score': false,
    'view.leads': false,
    'view.checkout': false,
    'view.tarefas': true,
    'edit.mapa': false,           // Usuário SÓ LÊ o Mapa (Felipe 2026-06-12)
    'edit.campanha': false, 'edit.acao': false, 'edit.produto': false,
    'edit.score': false, 'edit.kpi': false, 'edit.kr': false,
    'ops.integracoes': false, 'ops.lead_import': false, 'ops.lead_export': false,
    'ops.rd_sync': false,
    'ops.tasks': true,            // Usuário edita só tasks atribuídas a ele
    'admin.convidar_membro': false, 'admin.editar_role': false,
    'admin.remover_membro': false, 'admin.editar_billing': false,
    'admin.editar_db_tenant': false,
    'djow': true                  // Djow é ilimitado pra todos (Felipe 2026-06-12)
  }
};

function normalizeRole(role) {
  const r = String(role || '').toLowerCase().trim();
  return ROLES.includes(r) ? r : 'user';
}

function effectivePermissions(role, overrides) {
  const base = ROLE_TEMPLATES[normalizeRole(role)];
  const out = { ...base };
  if (overrides && typeof overrides === 'object') {
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === 'boolean' && PERMISSION_KEYS.includes(key)) {
        out[key] = value;
      }
    }
  }
  return out;
}

function hasPermission(role, overrides, key) {
  const perms = effectivePermissions(role, overrides);
  return Boolean(perms[key]);
}

function permissionLabel(key) {
  const LABELS = {
    'view.dashboard': 'Ver Dashboard',
    'view.mapa': 'Ver Mapa da Receita',
    'view.dre': 'Ver DRE',
    'view.revops': 'Ver RevOps',
    'view.financeiro': 'Ver Financeiro',
    'view.score': 'Ver Score Engine',
    'view.leads': 'Ver Leads / Buscador',
    'view.checkout': 'Ver Checkout',
    'view.tarefas': 'Ver Tarefas',
    'edit.mapa': 'Editar Mapa da Receita',
    'edit.campanha': 'Criar / editar Campanhas',
    'edit.acao': 'Criar / editar Ações',
    'edit.produto': 'Criar / editar Produtos',
    'edit.score': 'Configurar Score Engine',
    'edit.kpi': 'Editar KPIs',
    'edit.kr': 'Editar KRs',
    'ops.integracoes': 'Configurar Integrações (ClickUp/RD/GA4/Hotmart)',
    'ops.lead_import': 'Importar Leads',
    'ops.lead_export': 'Exportar Leads',
    'ops.rd_sync': 'Rodar sync RD',
    'ops.tasks': 'Operar tarefas',
    'admin.convidar_membro': 'Convidar membros',
    'admin.editar_role': 'Editar role de membros',
    'admin.remover_membro': 'Remover membros',
    'admin.editar_billing': 'Editar billing',
    'admin.editar_db_tenant': 'Plugar/trocar tenant DB',
    'djow': 'Usar o Djow'
  };
  return LABELS[key] || key;
}

function permissionGroup(key) {
  if (key.startsWith('view.')) return 'Visualização';
  if (key.startsWith('edit.')) return 'Edição';
  if (key.startsWith('ops.')) return 'Operações';
  if (key.startsWith('admin.')) return 'Administração';
  return 'Outros';
}

module.exports = {
  ROLES,
  ROLE_TEMPLATES,
  PERMISSION_KEYS,
  normalizeRole,
  effectivePermissions,
  hasPermission,
  permissionLabel,
  permissionGroup
};
