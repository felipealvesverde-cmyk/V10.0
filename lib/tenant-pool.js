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
const crypto = require('./clickup-crypto');

// Map<tenantId, { pool, connectionStringHash }>
// connectionStringHash é guardado pra detectar trocas (se admin re-cadastra
// connection string, o pool antigo é dropped e refeito na próxima chamada).
const pools = new Map();

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
