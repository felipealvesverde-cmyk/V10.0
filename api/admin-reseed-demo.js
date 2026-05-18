// V31.0.10 — Endpoint admin pra FORÇAR re-seed da empresa demo (Engenho Norte).
// Só master pode chamar. Útil quando o auto-seed no startup do server falha
// silenciosamente e o user demo fica com state antigo (v1, v2, ...).
//
// POST /api/admin-reseed-demo
// Body: {} (vazio)
// Resposta: { ok, applied, oldVersion, newVersion, demoUserId }
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode forçar re-seed.' });

  try {
    const { buildEngenhoNorteState, DEMO_SEED_VERSION } = require('../scripts/seed-demo-engenho-norte');
    const DEMO_USERNAME = 'demo@leadjourney.app';

    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe ainda.' });

    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    const oldVersion = existing.rows[0]?.state_json?.__demoSeed || null;

    const seedState = buildEngenhoNorteState();
    await req.db.query(
      `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
       VALUES ($1, $2, NOW(), $1)
       ON CONFLICT (user_id) DO UPDATE SET
         state_json = EXCLUDED.state_json,
         updated_at = NOW(),
         updated_by_user_id = EXCLUDED.updated_by_user_id`,
      [demoUserId, seedState]
    );

    return res.status(200).json({
      ok: true,
      applied: true,
      oldVersion,
      newVersion: DEMO_SEED_VERSION,
      demoUserId
    });
  } catch (err) {
    console.error('[admin-reseed-demo]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
