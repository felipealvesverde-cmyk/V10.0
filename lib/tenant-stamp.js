// V41.0.11 — Helper de stamp + validação de _originTenantId nas entidades
// que vivem dentro do journey_state. Reusado por:
//   - api/state-sync.js (POST normal — auto-save do client)
//   - api/admin-import-tenant-state.js (import JSON de backup)
//   - api/admin-restore-tenant-snapshot.js (restore de snapshot)
//
// Coleções estampadas: produtos, campanhas, ações + execuções, leads e
// manualLeads (cobertura completa V41.0.11; antes só as 3 primeiras em
// V41.0.10).
//
// Comportamento:
//   - Entidade sem _originTenantId ganha stamp = expectedTenantId (legacy
//     backward compat).
//   - Entidade com _originTenantId divergente vai pra errors[] e o caller
//     decide bloquear ou forçar restamp.
//   - Stamping é IN-PLACE (muta o state) — caller persiste depois.

const STAMPED_COLLECTIONS = ['products', 'campaigns', 'actions', 'executions', 'leads', 'manualLeads'];

function stampAndValidateState(state, expectedTenantId) {
  const errors = [];
  let stamped = 0;
  const expected = Number(expectedTenantId);
  STAMPED_COLLECTIONS.forEach(key => {
    const list = state?.[key];
    if (!Array.isArray(list)) return;
    list.forEach(entity => {
      if (!entity || typeof entity !== 'object') return;
      if (entity._originTenantId == null) {
        entity._originTenantId = expected;
        stamped++;
      } else if (Number(entity._originTenantId) !== expected) {
        errors.push({
          key,
          id: entity.id,
          name: entity.name || null,
          stampedTenant: Number(entity._originTenantId),
          expected
        });
      }
    });
  });
  return { errors, stamped };
}

// Re-stamp forçado: sobrescreve _originTenantId de TODAS as entidades pro
// expectedTenantId. Usado quando master importa snapshot de outro tenant
// pra um tenant diferente (recovery) e quer aceitar conscientemente.
function forceRestampState(state, expectedTenantId) {
  let restamped = 0;
  const expected = Number(expectedTenantId);
  STAMPED_COLLECTIONS.forEach(key => {
    const list = state?.[key];
    if (!Array.isArray(list)) return;
    list.forEach(entity => {
      if (!entity || typeof entity !== 'object') return;
      if (entity._originTenantId !== expected) {
        entity._originTenantId = expected;
        restamped++;
      }
    });
  });
  return { restamped };
}

module.exports = { stampAndValidateState, forceRestampState, STAMPED_COLLECTIONS };
