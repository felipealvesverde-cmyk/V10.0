// V35.14.1 — GA4 sync helper.
//
// 1. Lê config do user (packs + customs + property + backfill_days).
// 2. Resolve a lista de dimensions+metrics via lib/ga4-packs.
// 3. Quebra em chunks que cabem no limite da API (9 dims + 10 metrics).
// 4. Pra cada chunk, chama runReport e faz UPSERT em lj_ga4_reports_daily.
// 5. Atualiza last_sync_at + last_sync_result no lj_ga4_config.
//
// Idempotente: re-rodar pro mesmo dia atualiza rows (não duplica).

const { readConfig, runReport } = require('./ga4-oauth');
const { resolvePacksToFields, chunkFieldsForApi } = require('./ga4-packs');

// Constrói chave canônica das dimensions pra PK estável.
// Pares ordenados alfabeticamente por dim name, separados por "|".
// Ex: { country: "BR", deviceCategory: "mobile" } → "country:BR|deviceCategory:mobile"
function buildDimensionsKey(dimsObj) {
  const keys = Object.keys(dimsObj || {}).sort();
  return keys.map(k => `${k}:${dimsObj[k] == null ? '' : String(dimsObj[k])}`).join('|');
}

// Converte response da Data API em rows planos.
// Response shape:
//   { dimensionHeaders: [{ name }], metricHeaders: [{ name, type }], rows: [{ dimensionValues, metricValues }] }
// Cada row vira: { date, dimensions: {dim1: val, dim2: val}, metrics: {met1: val, met2: val} }
function parseRunReportResponse(response) {
  const dimHeaders = (response?.dimensionHeaders || []).map(h => h.name);
  const metHeaders = (response?.metricHeaders || []).map(h => h.name);
  const rows = response?.rows || [];
  const out = [];
  for (const r of rows) {
    const dimValues = (r.dimensionValues || []).map(v => v.value);
    const metValues = (r.metricValues || []).map(v => {
      // Tenta converter pra número (a API retorna como string)
      const n = Number(v.value);
      return Number.isFinite(n) ? n : v.value;
    });
    const dimensions = {};
    let date = null;
    dimHeaders.forEach((name, i) => {
      const val = dimValues[i];
      if (name === 'date') {
        // date vem como "YYYYMMDD" — converte pra YYYY-MM-DD
        const s = String(val || '');
        date = s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
      } else {
        dimensions[name] = val;
      }
    });
    const metrics = {};
    metHeaders.forEach((name, i) => { metrics[name] = metValues[i]; });
    if (!date) continue; // skip rows sem date
    out.push({ date, dimensions, metrics });
  }
  return out;
}

// UPSERT em lj_ga4_reports_daily. Se a chave já existir, faz merge de
// metrics (preserva métricas de outro chunk pra mesma combinação) e
// substitui dimensions (que devem ser idênticas pra mesma chave).
async function upsertRows(tenantDb, userId, propertyId, rows) {
  let upserted = 0;
  for (const row of rows) {
    const dimensionsKey = buildDimensionsKey(row.dimensions);
    await tenantDb.query(
      `INSERT INTO lj_ga4_reports_daily
         (user_id, property_id, date, dimensions_key, dimensions, metrics, synced_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
       ON CONFLICT (user_id, property_id, date, dimensions_key) DO UPDATE SET
         dimensions = EXCLUDED.dimensions,
         metrics = lj_ga4_reports_daily.metrics || EXCLUDED.metrics,
         synced_at = NOW()`,
      [
        userId, propertyId, row.date, dimensionsKey,
        JSON.stringify(row.dimensions),
        JSON.stringify(row.metrics)
      ]
    );
    upserted += 1;
  }
  return upserted;
}

// Sync principal — chama múltiplos runReport (1 por chunk de fields).
// Opções:
//   days: número de dias pra trás (default = backfill_days do config)
//   dryRun: se true, não faz UPSERT (só retorna preview)
async function syncProperty(tenantDb, userId, opts) {
  const options = opts || {};
  const cfg = await readConfig(tenantDb, userId);
  if (!cfg) throw new Error('GA4 não configurado.');
  if (!cfg.refreshToken) throw new Error('GA4 não conectado (sem refresh_token). Autorize antes.');
  if (!cfg.selectedPropertyId) throw new Error('Property não selecionada. Escolha no wizard.');

  const { dimensions, metrics, packsResolved } = resolvePacksToFields(cfg.selectedPacks, cfg.customSettings);
  if (!dimensions.length || !metrics.length) {
    throw new Error('Wizard não fechou: sem dimensions/metrics selecionados.');
  }

  const days = Math.max(1, Math.min(365, Number(options.days || cfg.backfillDays || 30)));
  const dateRange = { startDate: `${days}daysAgo`, endDate: 'today' };

  const chunks = chunkFieldsForApi(dimensions, metrics);
  const result = {
    propertyId: cfg.selectedPropertyId,
    days,
    chunks: chunks.length,
    packsResolved,
    rowsUpserted: 0,
    perChunk: []
  };

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const body = {
      dimensions: chunk.dimensions.map(name => ({ name })),
      metrics: chunk.metrics.map(name => ({ name })),
      dateRanges: [dateRange],
      limit: '10000'
    };
    let response;
    try {
      response = await runReport(tenantDb, userId, cfg.selectedPropertyId, body);
    } catch (err) {
      result.perChunk.push({
        chunkIndex: i,
        dimensions: chunk.dimensions,
        metrics: chunk.metrics,
        error: err.message
      });
      continue; // não derruba sync inteiro se 1 chunk falha
    }
    const rows = parseRunReportResponse(response);
    let upserted = 0;
    if (!options.dryRun) {
      upserted = await upsertRows(tenantDb, userId, cfg.selectedPropertyId, rows);
    }
    result.rowsUpserted += upserted;
    result.perChunk.push({
      chunkIndex: i,
      dimensions: chunk.dimensions,
      metrics: chunk.metrics,
      rowsReturned: rows.length,
      rowsUpserted: upserted,
      rowCount: response?.rowCount || rows.length
    });
  }

  // Marca last_sync_at + last_sync_result no config (só se não foi dryRun).
  if (!options.dryRun) {
    await tenantDb.query(
      `UPDATE lj_ga4_config
          SET last_sync_at = NOW(),
              last_sync_result = $1::jsonb,
              updated_at = NOW()
        WHERE user_id = $2`,
      [JSON.stringify(result), userId]
    );
  }

  return result;
}

module.exports = {
  syncProperty,
  buildDimensionsKey,
  parseRunReportResponse,
  upsertRows
};
