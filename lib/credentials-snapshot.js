// V41.0.2 — Snapshot completo de credentials por user.
//
// Restore via admin-restore-tenant-snapshot só recupera journey_state (operacional).
// Tabelas de credentials (5) vivem em paralelo e antes ficavam de fora — restore
// devolvia produtos+campanhas+actions mas usuário aparecia "ClickUp/Google Ads/
// GA4/Hotmart/RD desconectado". Esta lib serializa/aplica essas 5 tabelas pra
// que o snapshot vire de fato completo.
//
// Segurança: tokens já vêm criptografados na linha (_enc fields). Dump preserva
// a string criptografada. Restore só funciona NA MESMA INSTÂNCIA RAILWAY (mesma
// ENCRYPTION_KEY). Em outra instância, tokens ficariam ilegíveis — mas o restore
// completaria, e ao primeiro uso, o erro de descriptografia obrigaria reconectar.
//
// Tabelas serializadas:
//   - clickup_credentials (PK user_id)
//   - clickup_config (PK user_id) — OAuth App credentials
//   - lj_google_ads_config (PK user_id) — credentials + cache de token
//   - lj_ga4_config (PK user_id)
//   - hotmart_config (PK user_id)
//   - rd_credentials (PK user_id + token_type composite — pode ter N linhas)

// Cada SELECT é envolvido em try/catch: se a tabela não existir em algum
// tenant (schema desatualizado), dump segue sem aquela entrada.
async function dumpCredentialsForUser(pool, userId) {
  const out = {};

  async function safeOne(label, sql) {
    try {
      const r = await pool.query(sql, [userId]);
      if (r.rows[0]) out[label] = r.rows[0];
    } catch (_) { /* tabela ausente neste tenant — segue */ }
  }
  async function safeMany(label, sql) {
    try {
      const r = await pool.query(sql, [userId]);
      if (r.rows.length) out[label] = r.rows;
    } catch (_) { /* tabela ausente neste tenant — segue */ }
  }

  await safeOne('clickup_credentials', 'SELECT * FROM clickup_credentials WHERE user_id = $1');
  await safeOne('clickup_config', 'SELECT * FROM clickup_config WHERE user_id = $1');
  await safeOne('lj_google_ads_config', 'SELECT * FROM lj_google_ads_config WHERE user_id = $1');
  await safeOne('lj_ga4_config', 'SELECT * FROM lj_ga4_config WHERE user_id = $1');
  await safeOne('hotmart_config', 'SELECT * FROM hotmart_config WHERE user_id = $1');
  await safeMany('rd_credentials', 'SELECT * FROM rd_credentials WHERE user_id = $1');

  return Object.keys(out).length ? out : null;
}

async function restoreCredentialsForUser(pool, userId, credentialsJson) {
  if (!credentialsJson || typeof credentialsJson !== 'object') return { tables: 0, rows: 0, skipped: 0 };

  const stats = { tables: 0, rows: 0, skipped: 0 };

  async function upsertOne(label, table, row, conflictCols) {
    if (!row) return;
    try {
      const keys = Object.keys(row).filter(k => row[k] !== undefined);
      if (!keys.length) return;
      const values = keys.map(k => row[k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const cols = keys.map(k => `"${k}"`).join(',');
      const updates = keys.filter(k => !conflictCols.includes(k))
        .map(k => `"${k}" = EXCLUDED."${k}"`).join(',');
      const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})
                   ON CONFLICT (${conflictCols.join(',')}) DO UPDATE SET ${updates || `"${conflictCols[0]}" = EXCLUDED."${conflictCols[0]}"`}`;
      await pool.query(sql, values);
      stats.tables++;
      stats.rows++;
    } catch (err) {
      stats.skipped++;
      console.warn(`[restore-credentials] ${label} falhou:`, err.message);
    }
  }

  async function replaceMany(label, table, rows, pk) {
    if (!Array.isArray(rows) || !rows.length) return;
    try {
      // Pra rd_credentials (PK composta user_id+token_type), wipe os existentes
      // do user e re-inserir o set do snapshot.
      await pool.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      for (const row of rows) {
        const keys = Object.keys(row).filter(k => row[k] !== undefined);
        if (!keys.length) continue;
        const values = keys.map(k => row[k]);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
        const cols = keys.map(k => `"${k}"`).join(',');
        await pool.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
        stats.rows++;
      }
      stats.tables++;
    } catch (err) {
      stats.skipped++;
      console.warn(`[restore-credentials] ${label} falhou:`, err.message);
    }
  }

  await upsertOne('clickup_credentials', 'clickup_credentials', credentialsJson.clickup_credentials, ['user_id']);
  await upsertOne('clickup_config', 'clickup_config', credentialsJson.clickup_config, ['user_id']);
  await upsertOne('lj_google_ads_config', 'lj_google_ads_config', credentialsJson.lj_google_ads_config, ['user_id']);
  await upsertOne('lj_ga4_config', 'lj_ga4_config', credentialsJson.lj_ga4_config, ['user_id']);
  await upsertOne('hotmart_config', 'hotmart_config', credentialsJson.hotmart_config, ['user_id']);
  await replaceMany('rd_credentials', 'rd_credentials', credentialsJson.rd_credentials, ['user_id', 'token_type']);

  return stats;
}

// Idempotente: adiciona a coluna credentials_json se ainda não existir.
// Chamado uma vez por execução de admin-deploy-snapshot e admin-restore.
async function ensureCredentialsColumn(pool) {
  try {
    await pool.query(`ALTER TABLE journey_snapshots ADD COLUMN IF NOT EXISTS credentials_json JSONB`);
  } catch (_) { /* tabela ausente — fallback control plane sem snapshots */ }
}

module.exports = { dumpCredentialsForUser, restoreCredentialsForUser, ensureCredentialsColumn };
