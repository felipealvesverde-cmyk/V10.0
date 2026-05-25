// V33.0.0 — Onda 2: webhook do Hotmart. PÚBLICO (sem JWT).
//
// URL pra o cliente colar no Hotmart:
//   https://<lj-host>/api/hotmart-webhook?tenant_id=<TENANT_ID>
//
// Body (Hotmart POST):
//   { event, data, hottok, ... }
//
// Auth: HOTTOK do body é comparado com hottok_enc de hotmart_config do tenant.
//   Sem match → 403. Com match → processa via lj-hotmart-service.

const { decrypt } = require('../lib/clickup-crypto');
const tenantPoolHelper = require('../lib/tenant-pool');
const hotmartService = require('../lib/lj-hotmart-service');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  // tenant_id pode vir via query ou body
  const tenantId = Number(req.query?.tenant_id || req.body?.tenant_id || 0);
  if (!tenantId) return res.status(400).json({ ok: false, message: 'tenant_id obrigatório na query.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, message: 'Body inválido.' });

  const hottokReceived = String(body.hottok || '').trim();
  if (!hottokReceived) return res.status(400).json({ ok: false, message: 'hottok ausente no body.' });

  // Resolve tenant pool
  let tenantDb;
  try {
    tenantDb = await tenantPoolHelper.getTenantPool(req.db, tenantId);
  } catch (err) {
    return res.status(500).json({ ok: false, message: `Falha ao acessar tenant DB: ${err.message}` });
  }
  if (!tenantDb) tenantDb = req.db; // fallback control plane

  // Acha config Hotmart deste tenant (testa contra TODOS os users — Hotmart
  // não sabe qual user_id, só o HOTTOK do produto). Match O(N) por tenant.
  let userIdMatched = null;
  let productMappings = {};
  try {
    const configs = await tenantDb.query(
      `SELECT user_id, hottok_enc, product_mappings FROM hotmart_config`
    );
    for (const row of configs.rows) {
      try {
        const hottokStored = decrypt(row.hottok_enc);
        if (hottokStored === hottokReceived) {
          userIdMatched = Number(row.user_id);
          productMappings = row.product_mappings || {};
          break;
        }
      } catch (_) { /* corrupt config, tenta próximo */ }
    }
  } catch (err) {
    console.error('[hotmart-webhook] erro buscando config:', err);
    return res.status(500).json({ ok: false, message: 'Falha ao validar config.' });
  }

  if (!userIdMatched) {
    return res.status(403).json({ ok: false, message: 'HOTTOK não reconhecido neste tenant.' });
  }

  try {
    const result = await hotmartService.processWebhook({
      tenantDb,
      userId: userIdMatched,
      payload: body,
      productMappings
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[hotmart-webhook] processWebhook err:', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
