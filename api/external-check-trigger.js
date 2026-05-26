// V34.0.0 — V34.6.j.A: Trigger manual do externalIntegrationCheck.
//
// Endpoint pra Felipe testar o pattern antes do webhook do ClickUp existir
// (V34.6.j.B). Roda síncrono e retorna resultado imediato. Master-only.
//
// POST /api/external-check-trigger
// Body: {
//   provider: 'rd-crm' | 'rd-marketing' | 'google-ads' | ...,
//   resource_kind: 'pipeline' | 'deal' | 'campaign' | 'list' | ...,
//   expected_name: 'Black Friday 2026',
//   action_id: optional bigint
// }
//
// Resposta:
//   { ok, jobId, result: { status, matchType, externalId, externalName,
//     confidence, reasoning, candidatesCount, topCandidates? } }

const engine = require('../lib/external-check-engine');
const rdCrmAdapter = require('../lib/external-check-adapters/rd-crm');

// Registra adapters disponíveis na V34.6.j.A. Próximas ondas adicionam mais.
engine.registerAdapter('rd-crm', rdCrmAdapter);

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const provider = String(body.provider || '').trim();
  const resourceKind = String(body.resource_kind || '').trim();
  const expectedName = String(body.expected_name || '').trim();
  const actionId = body.action_id ? Number(body.action_id) : null;

  if (!provider) return res.status(400).json({ ok: false, message: 'provider obrigatório.' });
  if (!resourceKind) return res.status(400).json({ ok: false, message: 'resource_kind obrigatório.' });
  if (!expectedName) return res.status(400).json({ ok: false, message: 'expected_name obrigatório.' });

  const jobInput = {
    user_id: req.user.sub,
    action_id: actionId,
    clickup_task_id: null,
    provider,
    resource_kind: resourceKind,
    expected_name: expectedName,
    triggered_by: 'manual'
  };

  try {
    const result = await engine.runCheck(req.tenantDb, jobInput);
    const jobId = await engine.persistResult(req.tenantDb, jobInput, result);
    return res.status(200).json({ ok: true, jobId, result });
  } catch (err) {
    console.error('[external-check-trigger]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
