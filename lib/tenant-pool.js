// V32.0.0 — Global Mode: pool de Postgres por tenant.
//
// Cada tenant tem o próprio DB (db_connection_string_enc na tabela `tenants`).
// Aqui mantemos um Map<tenantId, Pool> cacheado, com lazy init na primeira
// request por tenant. Connection string é descriptografada via ENCRYPTION_KEY
// (mesma chave usada por ClickUp/RD).
//
// Uso esperado (V32.0.2+):
//   const { getTenantPool } = require('./lib/tenant-pool');
//   const pool = await getTenantPool(controlPlanePool, tenantId);
//   if (!pool) { ...usa req.db (control plane) como fallback... }
//   await pool.query('SELECT ...');
//
// Enquanto db_connection_string_enc IS NULL (tenant ainda não migrado),
// getTenantPool retorna null — caller usa control plane como fallback. Isso
// permite migração tenant-por-tenant sem big-bang.
//
// Cleanup: closeTenantPool(tenantId) força destruição do pool (útil em
// hot-reload de connection string). closeAll() é chamado no graceful shutdown.

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('./clickup-crypto');

// Map<tenantId, { pool, connectionStringHash }>
// connectionStringHash é guardado pra detectar trocas (se admin re-cadastra
// connection string, o pool antigo é dropped e refeito na próxima chamada).
const pools = new Map();

// V32.6.2 — Promise por tenantId pra fazer schema-sync UMA vez por process.
// Múltiplas requests simultâneas que tocam o mesmo tenant compartilham a mesma
// Promise (in-flight) — só 1 query SQL roda, todas esperam o mesmo terminar.
const schemaSyncPromises = new Map();  // Map<tenantId, Promise<void>>
let _cachedSchemaSql = null;
function loadTenantSchemaSql() {
  if (_cachedSchemaSql !== null) return _cachedSchemaSql;
  try {
    _cachedSchemaSql = fs.readFileSync(path.join(__dirname, 'tenant-db-schema.sql'), 'utf8');
  } catch (err) {
    console.error('[tenant-pool] não consegui ler tenant-db-schema.sql:', err.message);
    _cachedSchemaSql = '';
  }
  return _cachedSchemaSql;
}

// Cache do row do tenant pra evitar SELECT a cada request. TTL curto.
// Map<tenantId, { row, fetchedAt }>
const tenantCache = new Map();
const TENANT_CACHE_TTL_MS = 30 * 1000;

function hashString(s) {
  return require('crypto').createHash('sha1').update(s || '').digest('hex').slice(0, 16);
}

async function fetchTenantRow(controlPlanePool, tenantId) {
  const cached = tenantCache.get(tenantId);
  if (cached && (Date.now() - cached.fetchedAt) < TENANT_CACHE_TTL_MS) {
    return cached.row;
  }
  const result = await controlPlanePool.query(
    'SELECT id, slug, name, status, plan, db_connection_string_enc FROM tenants WHERE id = $1',
    [tenantId]
  );
  const row = result.rows[0] || null;
  tenantCache.set(tenantId, { row, fetchedAt: Date.now() });
  return row;
}

// V32.0.7 — Versão pública (segura) do fetch. Não inclui db_connection_string_enc
// pra evitar vazar pra middleware/handlers — só metadata.
async function getTenant(controlPlanePool, tenantId) {
  const row = await fetchTenantRow(controlPlanePool, tenantId);
  if (!row) return null;
  // eslint-disable-next-line no-unused-vars
  const { db_connection_string_enc, ...safe } = row;
  return safe;
}

function invalidateTenantCache(tenantId) {
  if (tenantId == null) tenantCache.clear();
  else tenantCache.delete(tenantId);
}

// Retorna o Pool do tenant, OU null se tenant ainda não tem DB próprio
// (db_connection_string_enc IS NULL). Caller decide o fallback.
//
// Lança erro se tenant não existe / status='suspended' / ENCRYPTION_KEY ausente.
async function getTenantPool(controlPlanePool, tenantId) {
  if (!tenantId) throw new Error('getTenantPool: tenantId obrigatório.');
  if (!controlPlanePool) throw new Error('getTenantPool: controlPlanePool obrigatório.');

  const row = await fetchTenantRow(controlPlanePool, tenantId);
  if (!row) throw new Error(`Tenant ${tenantId} não encontrado.`);
  if (row.status === 'suspended') throw new Error(`Tenant ${tenantId} suspenso.`);

  // Sem DB próprio ainda — caller usa control plane como fallback.
  if (!row.db_connection_string_enc) return null;

  const connStr = crypto.decrypt(row.db_connection_string_enc);
  const connHash = hashString(connStr);

  const existing = pools.get(tenantId);
  if (existing && existing.connectionStringHash === connHash) {
    return existing.pool;
  }
  if (existing && existing.connectionStringHash !== connHash) {
    // Connection string trocou — destrói pool antigo.
    try { await existing.pool.end(); } catch (_) {}
    pools.delete(tenantId);
  }

  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000
  });

  pool.on('error', (err) => {
    console.error(`[tenant-pool ${tenantId}] erro no pool:`, err.message);
  });

  pools.set(tenantId, { pool, connectionStringHash: connHash });

  // V32.6.2 — Schema sync idempotente AGUARDADO na primeira request por tenant.
  // Roda tenant-db-schema.sql contra o pool novo pra garantir que tenants
  // antigos (plugados antes de migrations recentes) ganhem colunas novas
  // (ALTER TABLE IF NOT EXISTS). Resolve schema drift automaticamente.
  //
  // Múltiplas requests simultâneas compartilham a mesma Promise — só 1 SQL
  // roda, todas esperam o mesmo terminar. Após primeira execução com sucesso,
  // Promise resolvida fica cacheada (próximas requests não rodam SQL de novo).
  let syncPromise = schemaSyncPromises.get(tenantId);
  if (!syncPromise) {
    const schemaSql = loadTenantSchemaSql();
    if (schemaSql) {
      syncPromise = pool.query(schemaSql).then(() => {
        console.log(`[tenant-pool ${tenantId}] schema sync ok.`);
      }).catch(err => {
        // Falhou → remove Promise pra tentar de novo na próxima request.
        schemaSyncPromises.delete(tenantId);
        console.error(`[tenant-pool ${tenantId}] schema sync falhou:`, err.message);
        throw err;
      });
      schemaSyncPromises.set(tenantId, syncPromise);
    }
  }
  if (syncPromise) {
    try { await syncPromise; } catch (_) { /* falha já logada — caller segue, query subsequente vai falhar com mensagem útil */ }
  }

  return pool;
}

async function closeTenantPool(tenantId) {
  const entry = pools.get(tenantId);
  if (!entry) return;
  try { await entry.pool.end(); } catch (_) {}
  pools.delete(tenantId);
  tenantCache.delete(tenantId);
}

async function closeAll() {
  const entries = Array.from(pools.values());
  pools.clear();
  tenantCache.clear();
  await Promise.all(entries.map(e => e.pool.end().catch(() => {})));
}

function stats() {
  return {
    tenantsCached: tenantCache.size,
    poolsOpen: pools.size,
    tenantIds: Array.from(pools.keys())
  };
}

module.exports = {
  getTenant,
  getTenantPool,
  closeTenantPool,
  closeAll,
  invalidateTenantCache,
  stats
};
