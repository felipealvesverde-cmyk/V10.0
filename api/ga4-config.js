// V35.14.0 — CRUD do GA4 config por user.
//
// GET    → status + máscaras (sem expor secrets) + setup do wizard
// POST   → upsert client_id, client_secret, selected_property_id, business_profile,
//          selected_packs[], custom_settings{}, sync_frequency_per_day, backfill_days
// DELETE → remove tudo (incluindo refresh_token)
//
// Permissão: qualquer user autenticado (self-scope).
// Espelho de api/google-ads-config.js V35.5.0.

const { encrypt, decrypt } = require('../lib/clickup-crypto');
const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Credenciais GA4 vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  try {
    if (req.method === 'GET') {
      // V35.14.0 — schemaMissing fallback: se a tabela ainda não existe (control
      // plane sem o schema rodado), responde 200 com configured=false em vez de
      // 500. Mesmo padrão usado em rd-webhook-failures-summary.
      let r;
      try {
        r = await req.tenantDb.query(
          `SELECT client_id_enc, client_secret_enc,
                  refresh_token_enc, selected_property_id, property_display_name,
                  business_profile, selected_packs, custom_settings,
                  available_customs, last_metadata_at,
                  sync_frequency_per_day, backfill_days,
                  connected_at, last_sync_at, last_sync_result, updated_at
             FROM lj_ga4_config WHERE user_id = $1`,
          [userId]
        );
      } catch (err) {
        if (/relation .* does not exist/i.test(err.message || '')) {
          return res.status(200).json({ ok: true, configured: false, schemaMissing: true });
        }
        throw err;
      }
      if (!r.rows.length) return res.status(200).json({ ok: true, configured: false });
      const row = r.rows[0];

      const mask = (encStr) => {
        if (!encStr) return null;
        try {
          const v = decrypt(encStr);
          if (v.length <= 8) return `***${v.slice(-3)}`;
          return `${v.slice(0, 4)}…${v.slice(-4)}`;
        } catch (_) { return '****'; }
      };

      return res.status(200).json({
        ok: true,
        configured: true,
        clientIdMasked: mask(row.client_id_enc),
        clientSecretMasked: mask(row.client_secret_enc),
        selectedPropertyId: row.selected_property_id || null,
        propertyDisplayName: row.property_display_name || null,
        businessProfile: row.business_profile || null,
        selectedPacks: Array.isArray(row.selected_packs) ? row.selected_packs : [],
        customSettings: row.custom_settings && typeof row.custom_settings === 'object' ? row.custom_settings : {},
        availableCustoms: Array.isArray(row.available_customs) ? row.available_customs : [],
        lastMetadataAt: row.last_metadata_at,
        syncFrequencyPerDay: Number(row.sync_frequency_per_day || 2),
        backfillDays: Number(row.backfill_days || 30),
        oauthCompleted: Boolean(row.refresh_token_enc),
        connectedAt: row.connected_at,
        lastSyncAt: row.last_sync_at,
        lastSyncResult: row.last_sync_result || null,
        updatedAt: row.updated_at
      });
    }

    if (req.method === 'POST') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};

      const clientId = String(body.clientId || '').trim();
      const clientSecret = String(body.clientSecret || '').trim();
      const selectedPropertyId = body.selectedPropertyId ? String(body.selectedPropertyId).slice(0, 64) : null;
      const propertyDisplayName = body.propertyDisplayName ? String(body.propertyDisplayName).slice(0, 255) : null;
      const businessProfile = body.businessProfile ? String(body.businessProfile).slice(0, 32) : null;
      const selectedPacks = Array.isArray(body.selectedPacks)
        ? body.selectedPacks.filter(p => typeof p === 'string').slice(0, 20)
        : null;
      const customSettings = body.customSettings && typeof body.customSettings === 'object'
        ? body.customSettings
        : null;
      const syncFrequencyPerDay = body.syncFrequencyPerDay != null
        ? Math.max(0, Math.min(24, Number(body.syncFrequencyPerDay) || 2))
        : null;
      const backfillDays = body.backfillDays != null
        ? Math.max(1, Math.min(365, Number(body.backfillDays) || 30))
        : null;

      // Permite update parcial — campos não enviados mantêm o valor anterior.
      const existing = await req.tenantDb.query(
        `SELECT client_id_enc, client_secret_enc FROM lj_ga4_config WHERE user_id = $1`,
        [userId]
      );
      const has = existing.rows.length;

      const clientIdEnc = clientId ? encrypt(clientId) : (has ? existing.rows[0].client_id_enc : null);
      const clientSecretEnc = clientSecret ? encrypt(clientSecret) : (has ? existing.rows[0].client_secret_enc : null);

      await req.tenantDb.query(
        `INSERT INTO lj_ga4_config
           (user_id, client_id_enc, client_secret_enc,
            selected_property_id, property_display_name, business_profile,
            selected_packs, custom_settings,
            sync_frequency_per_day, backfill_days, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           client_id_enc = COALESCE(EXCLUDED.client_id_enc, lj_ga4_config.client_id_enc),
           client_secret_enc = COALESCE(EXCLUDED.client_secret_enc, lj_ga4_config.client_secret_enc),
           selected_property_id = COALESCE(EXCLUDED.selected_property_id, lj_ga4_config.selected_property_id),
           property_display_name = COALESCE(EXCLUDED.property_display_name, lj_ga4_config.property_display_name),
           business_profile = COALESCE(EXCLUDED.business_profile, lj_ga4_config.business_profile),
           selected_packs = COALESCE(EXCLUDED.selected_packs, lj_ga4_config.selected_packs),
           custom_settings = COALESCE(EXCLUDED.custom_settings, lj_ga4_config.custom_settings),
           sync_frequency_per_day = COALESCE(EXCLUDED.sync_frequency_per_day, lj_ga4_config.sync_frequency_per_day),
           backfill_days = COALESCE(EXCLUDED.backfill_days, lj_ga4_config.backfill_days),
           updated_at = NOW()`,
        [
          userId, clientIdEnc, clientSecretEnc,
          selectedPropertyId, propertyDisplayName, businessProfile,
          selectedPacks ? JSON.stringify(selectedPacks) : null,
          customSettings ? JSON.stringify(customSettings) : null,
          syncFrequencyPerDay, backfillDays
        ]
      );

      return res.status(200).json({ ok: true, message: 'Configuração salva.' });
    }

    if (req.method === 'DELETE') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      await req.tenantDb.query(`DELETE FROM lj_ga4_config WHERE user_id = $1`, [userId]);
      return res.status(200).json({ ok: true, message: 'GA4 desconectado.' });
    }

    return res.status(405).json({ ok: false, message: 'Use GET / POST / DELETE.' });
  } catch (err) {
    console.error('[ga4-config]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
