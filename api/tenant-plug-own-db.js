// V32.1.1 — POST /api/tenant-plug-own-db
// Self-service: cliente loga e pluga próprio Postgres no tenant DELE.
// Diferente do /api/tenants-plug-db (master-only): aqui o user só pode mexer
// no PRÓPRIO tenant (lookup via req.tenantId do JWT).
//
// Body: { connection_string }
//
// Fluxo:
//   1. Valida que user tem default_tenant_id (sem tenant não dá pra plugar)
//   2. Testa conexão (SELECT 1) contra a URL fornecida
//   3. Roda lib/tenant-db-schema.sql contra o banco novo (criando tabelas)
//   4. Encripta + salva connection_string em tenants.db_connection_string_enc
//   5. Invalida pool cache pra próxima request criar pool novo
//
// Segurança: só plugaa no req.user.tenantId (do JWT). User não consegue
// mexer no tenant alheio mesmo se passar tenant_id no body — ignorado.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { encrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');
const tenantPoolHelper = require('../lib/tenant-pool');

function loadSchemaSql() {
  return fs.readFileSync(path.join(__dirname, '..', 'lib', 'tenant-db-schema.sql'), 'utf8');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!isEncryptionReady()) return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });

  // V32.1.1 — Tenant id vem SEMPRE do JWT (req.user.tenantId), NUNCA do body.
  // Isso impede user de plugar banco em tenant alheio.
  const tenantId = req.user.tenantId;
  if (!tenantId) {
    return res.status(400).json({
      ok: false,
      message: 'Você não está associado a um tenant. Master/admin global não usa este endpoint — use /api/tenants-plug-db.'
    });
  }

  const connStr = String(req.body?.connection_string || '').trim();
  if (!connStr) return res.status(400).json({ ok: false, message: 'connection_string obrigatória.' });
  if (!connStr.startsWith('postgres://') && !connStr.startsWith('postgresql://')) {
    return res.status(400).json({ ok: false, message: 'connection_string precisa começar com postgres:// ou postgresql://' });
  }

  // Confirma que tenant existe + pega slug pra logging
  const tenantRow = await req.db.query('SELECT id, slug, name FROM tenants WHERE id = $1', [tenantId]);
  if (!tenantRow.rows.length) {
    return res.status(404).json({ ok: false, message: 'Tenant não encontrado no control plane (inconsistência rara).' });
  }
  const tenant = tenantRow.rows[0];

  // Passo 1: testa conexão SELECT 1 (com pool descartável)
  let testPool;
  try {
    testPool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 1,
      connectionTimeoutMillis: 10000
    });
    const t = await testPool.query('SELECT 1 AS ok');
    if (t.rows[0]?.ok !== 1) throw new Error('SELECT 1 retornou inesperado.');
  } catch (err) {
    if (testPool) await testPool.end().catch(() => {});
    return res.status(400).json({
      ok: false,
      step: 'test_connection',
      message: `Conexão recusada pelo Postgres: ${err.message || err}. Confere se a URL está correta e o banco aceita conexões externas.`
    });
  }

  // Passo 2: roda lib/tenant-db-schema.sql contra o banco novo
  // O schema é idempotente (CREATE TABLE IF NOT EXISTS) — re-execução é safe.
  try {
    const schemaSql = loadSchemaSql();
    await testPool.query(schemaSql);
  } catch (err) {
    await testPool.end().catch(() => {});
    return res.status(500).json({
      ok: false,
      step: 'apply_schema',
      message: `Falha ao criar schema no banco fornecido: ${err.message}. Verifique se o usuário do banco tem permissão CREATE TABLE.`
    });
  }

  // Passo 3: encripta e salva connection_string em tenants
  try {
    const enc = encrypt(connStr);
    await req.db.query(
      `UPDATE tenants
       SET db_connection_string_enc = $1,
           migrated_at = COALESCE(migrated_at, NOW()),
           updated_at = NOW()
       WHERE id = $2`,
      [enc, tenantId]
    );
  } catch (err) {
    await testPool.end().catch(() => {});
    return res.status(500).json({
      ok: false,
      step: 'save_credentials',
      message: `Schema aplicado, mas falha ao gravar connection string criptografada: ${err.message}`
    });
  }

  // Passo 4: invalida cache + pool (próxima request cria pool novo apontando pro banco do user)
  tenantPoolHelper.invalidateTenantCache(tenantId);
  await tenantPoolHelper.closeTenantPool(tenantId);
  await testPool.end().catch(() => {});

  return res.status(200).json({
    ok: true,
    tenant_id: tenantId,
    tenant_slug: tenant.slug,
    message: `Banco plugado pro tenant ${tenant.name}. Próximas requests vão pro Postgres que você configurou.`
  });
};
