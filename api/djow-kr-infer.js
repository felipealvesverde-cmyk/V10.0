// V35.8.0-alpha2 — Endpoint do Djow pra criação de KR.
//
// POST /api/djow-kr-infer
// Body: { step: 'start' | 'name' | 'select-source' | 'numbers' | 'confirm',
//         ...payload-do-step }
//
// Despacha pra função correspondente do engine (lib/djow-kr-engine).
// Resolve chave Anthropic via ai-resolver pra etapas que precisam de LLM.

const engine = require('../lib/djow-kr-engine');
const aiResolver = require('../lib/ai-resolver');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const { step, ...payload } = req.body || {};

  try {
    switch (step) {
      case 'start': {
        const result = await engine.startSession(req.tenantDb, userId, payload);
        return res.json(result);
      }
      case 'name': {
        // Resolve chave Anthropic (fallback LLM quando heurística não basta)
        let anthropicKey = null;
        try {
          const masterDb = req.app?.get?.('pgPool') || req.db;
          const keyResult = await aiResolver.resolveAnthropicKey(masterDb, {
            id: userId,
            isMaster: Boolean(req.user.isMaster)
          });
          if (keyResult.ok) anthropicKey = keyResult.apiKey;
        } catch (_) { /* sem chave — heurística-only */ }

        const result = await engine.processName(req.tenantDb, userId, {
          ...payload,
          anthropicKey
        });
        return res.json(result);
      }
      case 'select-source': {
        const result = await engine.selectSource(req.tenantDb, userId, payload);
        return res.json(result);
      }
      case 'numbers': {
        const result = await engine.submitNumbers(req.tenantDb, userId, payload);
        return res.json(result);
      }
      case 'confirm': {
        const result = await engine.confirmSession(req.tenantDb, userId, payload);
        return res.json(result);
      }
      default:
        return res.status(400).json({ ok: false, message: `Step desconhecido: "${step}".` });
    }
  } catch (err) {
    console.error('[djow-kr-infer]', step, err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno.' });
  }
};
