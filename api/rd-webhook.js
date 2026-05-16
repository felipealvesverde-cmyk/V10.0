// V24.0.0 — Endpoint serverless de ingestão de webhooks do RD Station.
//
// O RD POSTa eventos (contact_changed, tag_added, stage_changed, deal_won...)
// pra este endpoint quando configurado em RD CRM → Integrações → Webhooks.
//
// EVIDÊNCIA DE DESIGN:
//   - Endpoint público (não exige JWT do Journey). RD não tem nosso token.
//   - Validação opcional via HMAC se RD_WEBHOOK_SECRET estiver setado.
//   - Buffer em memória (ring de 500). Frontend faz pull via /api/rd-events-fetch.
//   - NÃO mutamos state do Journey aqui: deixamos pro frontend rotear via
//     RdCrmEventIngestor (que já existe e sabe fazer LeadBase/Score/Tag bridges).
//
// Por que buffer em memória e não tabela Postgres:
//   - Mantém o endpoint stateless e rápido (responder em <100ms ao RD).
//   - O frontend tem polling de 5min via RdCrmLiveSyncEngine — não precisa
//     de persistência forte. Se cold start descartar, o sync_engine reconcilia.
//   - Postgres entra na V24.1+ se webhook volume justificar.
const crypto = require('crypto');

const RING_BUFFER_LIMIT = 500;
const memoryBuffer = global.__JOURNEY_RD_WEBHOOK_BUFFER__ || [];
global.__JOURNEY_RD_WEBHOOK_BUFFER__ = memoryBuffer;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RD-Signature');
}

function verifyHmac(rawBody, signature, secret) {
  if (!secret) return true; // sem secret configurado, aceita tudo
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (_) { return false; }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST.' });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    const secret = process.env.RD_WEBHOOK_SECRET || '';
    if (secret) {
      const signature = req.headers['x-rd-signature'] || req.headers['x-hub-signature-256'] || '';
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (!verifyHmac(rawBody, signature, secret)) {
        res.status(401).json({ ok: false, message: 'Assinatura HMAC inválida.' });
        return;
      }
    }
    if (!body || typeof body !== 'object') {
      res.status(400).json({ ok: false, message: 'Body inválido.' });
      return;
    }
    const entry = {
      id: `rd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: new Date().toISOString(),
      eventType: body.event_type || body.type || 'unknown',
      contactId: body.entity_id || body.contact_id || body.payload?.contact_id || null,
      payload: body.payload || body
    };
    memoryBuffer.push(entry);
    if (memoryBuffer.length > RING_BUFFER_LIMIT) memoryBuffer.shift();
    res.status(200).json({ ok: true, id: entry.id });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Erro inesperado.' });
  }
};
