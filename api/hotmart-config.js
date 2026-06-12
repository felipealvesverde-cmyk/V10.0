// V33.0.0 — Onda 2.1: config Hotmart por user (HOTTOK + mappings).
//
// GET    /api/hotmart-config       → { ok, configured, hottokMasked?, productMappings? }
// POST   /api/hotmart-config       → body { hottok, webhookSecret?, productMappings? }
// DELETE /api/hotmart-config       → remove config

const { encrypt, decrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');
const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!isEncryptionReady()) return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada.' });

  // V37.4.34 — Credenciais Hotmart vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  if (req.method === 'GET') {
    try {
      const r = await req.tenantDb.query(
        `SELECT hottok_enc, client_id_enc, client_secret_enc, sync_window_days,
                last_sync_at, last_sync_result, product_mappings, connected_at, updated_at
         FROM hotmart_config WHERE user_id = $1`,
        [userId]
      );
      if (r.rows.length === 0) return res.status(200).json({ ok: true, configured: false });
      const row = r.rows[0];
      let hottokMasked = null, clientIdMasked = null;
      try {
        const hottok = decrypt(row.hottok_enc);
        if (hottok && hottok.length > 8) hottokMasked = `${hottok.slice(0, 4)}…${hottok.slice(-4)}`;
      } catch (_) {}
      try {
        if (row.client_id_enc) {
          const cid = decrypt(row.client_id_enc);
          if (cid && cid.length > 8) clientIdMasked = `${cid.slice(0, 4)}…${cid.slice(-4)}`;
        }
      } catch (_) {}
      return res.status(200).json({
        ok: true,
        configured: true,
        hottokMasked,
        oauthConfigured: Boolean(row.client_id_enc && row.client_secret_enc),
        clientIdMasked,
        syncWindowDays: Number(row.sync_window_days || 90),
        lastSyncAt: row.last_sync_at,
        lastSyncResult: row.last_sync_result || null,
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
    try { await assertCanWriteCredentials(req); }
    catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    const hottok = String(body.hottok || '').trim();
    const webhookSecret = String(body.webhookSecret || '').trim();
    // V35.1.0 — OAuth opcional
    const clientId = String(body.clientId || '').trim();
    const clientSecret = String(body.clientSecret || '').trim();
    const syncWindowDays = [90, 180, 365].includes(Number(body.syncWindowDays))
      ? Number(body.syncWindowDays) : 90;
    const productMappings = body.productMappings && typeof body.productMappings === 'object' ? body.productMappings : {};
    if (!hottok) return res.status(400).json({ ok: false, message: 'HOTTOK obrigatório.' });

    try {
      const hottokEnc = encrypt(hottok);
      const secretEnc = webhookSecret ? encrypt(webhookSecret) : null;
      const clientIdEnc = clientId ? encrypt(clientId) : null;
      const clientSecretEnc = clientSecret ? encrypt(clientSecret) : null;
      await req.tenantDb.query(
        `INSERT INTO hotmart_config
           (user_id, hottok_enc, webhook_secret_enc, client_id_enc, client_secret_enc,
            sync_window_days, product_mappings, connected_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           hottok_enc = EXCLUDED.hottok_enc,
           webhook_secret_enc = COALESCE(EXCLUDED.webhook_secret_enc, hotmart_config.webhook_secret_enc),
           client_id_enc = COALESCE(EXCLUDED.client_id_enc, hotmart_config.client_id_enc),
           client_secret_enc = COALESCE(EXCLUDED.client_secret_enc, hotmart_config.client_secret_enc),
           sync_window_days = EXCLUDED.sync_window_days,
           product_mappings = EXCLUDED.product_mappings,
           updated_at = NOW()`,
        [userId, hottokEnc, secretEnc, clientIdEnc, clientSecretEnc, syncWindowDays, JSON.stringify(productMappings)]
      );
      return res.status(200).json({ ok: true, message: 'Hotmart conectado.' });
    } catch (err) {
      console.error('[hotmart-config POST]', err);
      return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
    }
  }

  if (req.method === 'DELETE') {
    try { await assertCanWriteCredentials(req); }
    catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
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
