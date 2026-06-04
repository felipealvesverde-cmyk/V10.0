// V35.14.7 — POST /api/admin-migrate-schema
//
// Roda o arquivo lib/tenant-db-schema.sql contra o banco do tenant (ou control
// plane do master) — idempotente (CREATE TABLE IF NOT EXISTS, ALTER TABLE IF
// NOT EXISTS, etc). Não destrói dados.
//
// Pra que serve:
//   - Cliente plugou DB próprio antes da V35.14 e quer aplicar as novas
//     tabelas GA4 (lj_ga4_config, lj_ga4_reports_daily) sem mexer no psql.
//   - Master quer rodar contra o control plane pra liberar a feature
//     pra todo mundo que ainda usa o banco compartilhado.
//
// Permissão: master OR user com tenant próprio. Usuários sandbox/demo são
// barrados (não deveriam migrar schema).
//
// Resposta:
//   { ok: true, durationMs, message, schemaVersion } em caso de sucesso
//   { ok: false, message, errorAt } em caso de falha (com posição aproximada
//     do erro no SQL, pra debug).
//
// Não retorna o conteúdo do SQL inteiro por questão de tamanho. Caller pode
// usar /api/admin-migrate-schema/preview (GET) pra ver o que vai rodar.

const fs = require('fs');
const path = require('path');

function loadSchemaSql() {
  const filePath = path.join(__dirname, '..', 'lib', 'tenant-db-schema.sql');
  return fs.readFileSync(filePath, 'utf8');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  // Permission gate: bloqueia sandbox e demo (não fazem sentido aqui).
  const mode = String(req.user.mode || 'sandbox');
  const isMaster = Boolean(req.user.isMaster);
  if (!isMaster && (mode === 'sandbox' || mode === 'demo')) {
    return res.status(403).json({ ok: false, message: 'Apenas master ou tenants próprios podem rodar migrate.' });
  }

  // GET — preview do schema sem rodar
  if (req.method === 'GET') {
    try {
      const sql = loadSchemaSql();
      return res.status(200).json({
        ok: true,
        sqlLength: sql.length,
        sqlLines: sql.split('\n').length,
        firstLines: sql.split('\n').slice(0, 30).join('\n'),
        schemaFilePath: 'lib/tenant-db-schema.sql'
      });
    } catch (err) {
      return res.status(500).json({ ok: false, message: `Não consegui ler o schema: ${err.message}` });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use GET (preview) ou POST (rodar).' });

  const db = req.tenantDb || req.db;
  if (!db) return res.status(503).json({ ok: false, message: 'Banco indisponível.' });

  let sql;
  try {
    sql = loadSchemaSql();
  } catch (err) {
    return res.status(500).json({ ok: false, message: `Não consegui ler o schema: ${err.message}` });
  }

  const t0 = Date.now();
  try {
    await db.query(sql);
    const durationMs = Date.now() - t0;
    // Lê schema_version pra confirmar.
    let schemaVersion = null;
    try {
      const r = await db.query(`SELECT value FROM tenant_schema_meta WHERE key = 'schema_version'`);
      if (r.rows.length) schemaVersion = r.rows[0].value;
    } catch (_) { /* tabela meta pode não ter sido criada ainda em DB legado */ }
    return res.status(200).json({
      ok: true,
      durationMs,
      schemaVersion,
      message: schemaVersion
        ? `Schema aplicado em ${durationMs}ms. Versão atual: ${schemaVersion}.`
        : `Schema aplicado em ${durationMs}ms.`
    });
  } catch (err) {
    const durationMs = Date.now() - t0;
    // Postgres erro tem campo "position" (offset no SQL) que ajuda debug.
    const position = err.position ? Number(err.position) : null;
    let errorContext = null;
    if (position) {
      const before = sql.slice(Math.max(0, position - 80), position);
      const after = sql.slice(position, Math.min(sql.length, position + 80));
      errorContext = `…${before}❗${after}…`;
    }
    console.error('[admin-migrate-schema]', err);
    return res.status(500).json({
      ok: false,
      durationMs,
      message: err.message,
      errorAt: position,
      errorContext
    });
  }
};
