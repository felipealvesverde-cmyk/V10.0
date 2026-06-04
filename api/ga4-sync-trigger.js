// V35.14.1 — POST /api/ga4-sync-trigger
// Dispara sync manual: chama runReport com os packs selecionados, faz UPSERT
// em lj_ga4_reports_daily. Usado pelo botão "Atualizar agora" no card de
// integração + pelo cron 2x/dia (futuro).
//
// Body:
//   { days?: number, dryRun?: bool }
//
// Response:
//   { ok: true, result: { rowsUpserted, chunks, perChunk: [...], packsResolved } }

const { syncProperty } = require('../lib/ga4-sync');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const days = body.days != null ? Number(body.days) : null;
  const dryRun = Boolean(body.dryRun);

  try {
    const result = await syncProperty(req.tenantDb, userId, { days: days || undefined, dryRun });
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    const msg = err?.message || String(err);
    if (/não conectado|refresh_token|não configurado|Property não selecionada|Wizard não fechou/i.test(msg)) {
      return res.status(400).json({ ok: false, message: msg });
    }
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(503).json({ ok: false, message: 'Schema GA4 ainda não rodou no banco.', schemaMissing: true });
    }
    console.error('[ga4-sync-trigger]', err);
    return res.status(500).json({ ok: false, message: msg });
  }
};
