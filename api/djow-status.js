// V26.0.0 — Djow Status endpoint.
// GET retorna: { configured, model, kbFiles, kbChars, allowedRoles, totalCostUsd }
// Usado pela UI de Settings → Agentes Externos → Djow + Home pra saber se
// o Djow tá pronto pra responder.
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const configured = Boolean(apiKey);

  // KB info
  const kbDir = path.join(__dirname, '..', 'knowledge-base');
  let kbFiles = [];
  let kbChars = 0;
  if (fs.existsSync(kbDir)) {
    try {
      const files = fs.readdirSync(kbDir)
        .filter(f => f.endsWith('.md') && !f.endsWith('.example.md') && f !== 'README.md');
      for (const f of files) {
        const content = fs.readFileSync(path.join(kbDir, f), 'utf8');
        kbFiles.push({ name: f, chars: content.length });
        kbChars += content.length;
      }
    } catch (_) {}
  }

  // State Djow config
  let model = 'claude-sonnet-4-6';
  let allowedRoles = ['master'];
  try {
    // V32.0.11 — Dados Djow (journey_state, djow_*) vivem no tenant plane.
    // Nota: query WHERE id = 1 é bug legado (id column foi removida em V31).
    // Mantida intocada — fix fica pra outro momento.
    const r = await req.tenantDb.query('SELECT state_json FROM journey_state WHERE id = 1 LIMIT 1');
    const state = r.rows[0]?.state_json || {};
    const cfg = state.djowConfig || {};
    model = cfg.model || model;
    allowedRoles = cfg.allowedRoles || allowedRoles;
  } catch (_) {}

  // Stats: custo total + #conversas
  let totalCostUsd = 0;
  let conversationCount = 0;
  try {
    const r = await req.tenantDb.query(
      'SELECT COALESCE(SUM(cost_usd), 0)::numeric AS total FROM djow_messages WHERE conversation_id IN (SELECT id FROM djow_conversations WHERE user_id = $1)',
      [req.user.sub]
    );
    totalCostUsd = Number(r.rows[0]?.total || 0);
    const c = await req.tenantDb.query('SELECT COUNT(*)::int AS n FROM djow_conversations WHERE user_id = $1', [req.user.sub]);
    conversationCount = c.rows[0]?.n || 0;
  } catch (_) {}

  res.status(200).json({
    ok: true,
    configured,
    model,
    allowedRoles,
    kbFiles,
    kbChars,
    canUse: req.user.isMaster || allowedRoles.includes('all') || (allowedRoles.includes('production') && req.user.mode === 'production'),
    stats: { totalCostUsd: Number(totalCostUsd.toFixed(4)), conversationCount }
  });
};
