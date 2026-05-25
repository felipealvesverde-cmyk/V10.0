// V33.0.0 — Onda 2.1: config Hotmart por user (HOTTOK + mappings).
//
// GET    /api/hotmart-config       → { ok, configured, hottokMasked?, productMappings? }
// POST   /api/hotmart-config       → body { hottok, webhookSecret?, productMappings? }
// DELETE /api/hotmart-config       → remove config

const { encrypt, decrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!isEncryptionReady()) return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada.' });

  const userId = req.user.sub;

  if (req.method === 'GET') {
    try {
      const r = await req.tenantDb.query(
        `SELECT hottok_enc, product_mappings, connected_at, updated_at
         FROM hotmart_config WHERE user_id = $1`,
        [userId]
      );
      if (r.rows.length === 0) return res.status(200).json({ ok: true, configured: false });
      const row = r.rows[0];
      let hottokMasked = null;
      try {
        const hottok = decrypt(row.hottok_enc);
        if (hottok && hottok.length > 8) hottokMasked = `${hottok.slice(0, 4)}…${hottok.slice(-4)}`;
      } catch (_) { /* corrupt */ }
      return res.status(200).json({
        ok: true,
        configured: true,
        hottokMasked,
        productMappings: row.product_mappings || {},
        connectedAt: row.connected_at,
        updatedAt: row.updated_at
      });
    } catch (err) {
      console.error('[hotmart-config GET]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    const hottok = String(body.hottok || '').trim();
    const webhookSecret = String(body.webhookSecret || '').trim();
    const productMappings = body.productMappings && typeof body.productMappings === 'object' ? body.productMappings : {};
    if (!hottok) return res.status(400).json({ ok: false, message: 'HOTTOK obrigatório.' });

    try {
      const hottokEnc = encrypt(hottok);
      const secretEnc = webhookSecret ? encrypt(webhookSecret) : null;
      await req.tenantDb.query(
        `INSERT INTO hotmart_config (user_id, hottok_enc, webhook_secret_enc, product_mappings, connected_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           hottok_enc = EXCLUDED.hottok_enc,
           webhook_secret_enc = COALESCE(EXCLUDED.webhook_secret_enc, hotmart_config.webhook_secret_enc),
           product_mappings = EXCLUDED.product_mappings,
           updated_at = NOW()`,
        [userId, hottokEnc, secretEnc, JSON.stringify(productMappings)]
      );
      return res.status(200).json({ ok: true, message: 'Hotmart conectado.' });
    } catch (err) {
      console.error('[hotmart-config POST]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await req.tenantDb.query(`DELETE FROM hotmart_config WHERE user_id = $1`, [userId]);
      return res.status(200).json({ ok: true, message: 'Hotmart desconectado.' });
    } catch (err) {
      console.error('[hotmart-config DELETE]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET, POST ou DELETE.' });
};
