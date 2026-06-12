// V34.0.0 — V34.6.a: Funde 2 visitors do MESMO tenant num só.
//
// POST /api/visitors-merge
// Body: {
//   survivor_id: 'imp_aaa',  // OPCIONAL — força survivor; default = mais antigo
//   visitor_ids: ['imp_aaa', 'lj_bbb'],  // 2+ IDs (faz N-1 merges em cadeia)
//   match_signal: 'email-exact' | 'phone-exact' | 'manual',
//   source_reason: 'find-duplicates' | 'import-batch' | 'rd-webhook' | 'manual-ui'
// }
//
// Comportamento:
//   - Se survivor_id passado: força esse como sobrevivente
//   - Senão: pickSurvivor escolhe o mais antigo (first_seen_at)
//   - Pra 3+ visitor_ids, funde par a par em cascata mantendo o survivor
//
// Resposta:
//   { ok, survivorId, mergedCount, audit: [{ survivor, deleted, signal }] }

const { mergeVisitors } = require('../lib/visitor-merge');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  // V37.4.34 — Visitors vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const survivorIdHint = body.survivor_id ? String(body.survivor_id) : null;
  const visitorIds = Array.isArray(body.visitor_ids) ? body.visitor_ids.map(String).filter(Boolean) : [];
  const matchSignal = String(body.match_signal || 'manual');
  const sourceReason = String(body.source_reason || 'manual-ui');

  if (visitorIds.length < 2) return res.status(400).json({ ok: false, message: 'Mínimo 2 visitor_ids.' });
  // Dedup
  const ids = [...new Set(visitorIds)];
  if (ids.length < 2) return res.status(400).json({ ok: false, message: 'visitor_ids precisam ser distintos.' });

  // Define o survivor (mais antigo ou passado)
  let survivorId = survivorIdHint;
  if (!survivorId) {
    // Busca first_seen_at de todos pra escolher o mais antigo
    const r = await req.tenantDb.query(
      `SELECT lj_visitor_id, first_seen_at FROM lj_visitors
        WHERE user_id = $1 AND lj_visitor_id = ANY($2::varchar[])`,
      [userId, ids]
    );
    if (r.rows.length !== ids.length) {
      return res.status(404).json({ ok: false, message: 'Algum visitor não foi encontrado.' });
    }
    const sorted = r.rows.slice().sort((a, b) => {
      const ta = new Date(a.first_seen_at || 0).getTime();
      const tb = new Date(b.first_seen_at || 0).getTime();
      return ta - tb;
    });
    survivorId = sorted[0].lj_visitor_id;
  } else if (!ids.includes(survivorId)) {
    return res.status(400).json({ ok: false, message: 'survivor_id deve estar em visitor_ids.' });
  }

  // Para cada outro id, funde com o survivor (em cadeia)
  const toMerge = ids.filter(id => id !== survivorId);
  const audit = [];
  for (const otherId of toMerge) {
    try {
      const r = await mergeVisitors(req.tenantDb, userId, survivorId, otherId, {
        matchSignal,
        sourceReason,
        survivorVisitorId: survivorId
      });
      audit.push({ survivor: r.survivorId, deleted: r.deletedId, signal: matchSignal });
    } catch (err) {
      console.error(`[visitors-merge] ${otherId} → ${survivorId} falhou:`, err);
      return res.status(500).json({
        ok: false,
        message: `Merge falhou em ${otherId}: ${err.message}`,
        partialAudit: audit
      });
    }
  }

  return res.status(200).json({
    ok: true,
    survivorId,
    mergedCount: audit.length,
    audit
  });
};
