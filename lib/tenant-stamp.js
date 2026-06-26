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

// Coleções tipo array (cada item é uma entidade individual com _originTenantId).
const STAMPED_COLLECTIONS = ['products', 'campaigns', 'actions', 'executions', 'leads', 'manualLeads'];

// V41.0.12 — Coleções tipo objeto-keyed-por-id (revopsFinanceV2[productId]={...}).
// Cada VALOR ganha _originTenantId. A chave (productId) por si só não vaza
// dados — o que importa é o conteúdo do valor.
const STAMPED_KEYED_COLLECTIONS = ['revopsFinanceV2', 'revopsFinance', 'strategicMaps', 'strategicCampaignMaps', 'metasResultado'];

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
  // V41.0.12 — keyed collections (objetos {id: data}).
  STAMPED_KEYED_COLLECTIONS.forEach(key => {
    const obj = state?.[key];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.entries(obj).forEach(([itemKey, value]) => {
      if (!value || typeof value !== 'object') return;
      if (value._originTenantId == null) {
        value._originTenantId = expected;
        stamped++;
      } else if (Number(value._originTenantId) !== expected) {
        errors.push({
          key,
          id: itemKey,
          name: null,
          stampedTenant: Number(value._originTenantId),
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
  STAMPED_KEYED_COLLECTIONS.forEach(key => {
    const obj = state?.[key];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    Object.values(obj).forEach(value => {
      if (!value || typeof value !== 'object') return;
      if (value._originTenantId !== expected) {
        value._originTenantId = expected;
        restamped++;
      }
    });
  });
  return { restamped };
}

// V41.0.12 — Filtra entidades com _originTenantId divergente, retornando
// um state limpo + relatório. Read-side defense: GET state-sync usa pra
// nunca entregar lixo pro client mesmo se o banco estiver legacy/contaminado.
function filterAlienEntities(state, expectedTenantId) {
  const removed = { byKey: {}, total: 0 };
  const expected = Number(expectedTenantId);
  const clean = { ...state };
  STAMPED_COLLECTIONS.forEach(key => {
    const list = state?.[key];
    if (!Array.isArray(list)) return;
    const kept = [];
    let droppedHere = 0;
    list.forEach(entity => {
      if (!entity || typeof entity !== 'object') { kept.push(entity); return; }
      if (entity._originTenantId != null && Number(entity._originTenantId) !== expected) {
        droppedHere++;
        removed.total++;
        return;
      }
      kept.push(entity);
    });
    if (droppedHere > 0) {
      removed.byKey[key] = droppedHere;
      clean[key] = kept;
    }
  });
  STAMPED_KEYED_COLLECTIONS.forEach(key => {
    const obj = state?.[key];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    const kept = {};
    let droppedHere = 0;
    Object.entries(obj).forEach(([k, v]) => {
      if (!v || typeof v !== 'object') { kept[k] = v; return; }
      if (v._originTenantId != null && Number(v._originTenantId) !== expected) {
        droppedHere++;
        removed.total++;
        return;
      }
      kept[k] = v;
    });
    if (droppedHere > 0) {
      removed.byKey[key] = droppedHere;
      clean[key] = kept;
    }
  });
  return { clean, removed };
}

// V41.0.12 — Audit log de operações cross-tenant.
// Tabela vive no control plane (req.db, não tenant pool).
async function logTenantAudit(db, { actor_user_id, endpoint, target_tenant_id, target_user_id, force_restamp, entities_affected, details }) {
  if (!db) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tenant_audit_log (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        actor_user_id INT NOT NULL,
        endpoint TEXT NOT NULL,
        target_tenant_id INT,
        target_user_id INT,
        force_restamp BOOLEAN DEFAULT FALSE,
        entities_affected INT DEFAULT 0,
        details JSONB
      )
    `);
    await db.query(`
      INSERT INTO tenant_audit_log (actor_user_id, endpoint, target_tenant_id, target_user_id, force_restamp, entities_affected, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [actor_user_id, endpoint, target_tenant_id ?? null, target_user_id ?? null, !!force_restamp, entities_affected || 0, details ? JSON.stringify(details) : null]);
  } catch (err) {
    console.warn('[tenant-audit] log falhou:', err.message);
  }
}

module.exports = {
  stampAndValidateState,
  forceRestampState,
  filterAlienEntities,
  logTenantAudit,
  STAMPED_COLLECTIONS,
  STAMPED_KEYED_COLLECTIONS
};
