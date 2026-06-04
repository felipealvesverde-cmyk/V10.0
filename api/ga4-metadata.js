// V35.14.1 — GET /api/ga4-metadata
// Descobre dimensions/metrics disponíveis na property do user (incluindo
// custom dimensions/metrics que o cliente criou no GA4 dele).
//
// Endpoint Data API: GET /properties/<id>/metadata
//
// Response da API tem:
//   { dimensions: [{ apiName, uiName, description, customDefinition, category }],
//     metrics: [{ apiName, uiName, description, type, customDefinition, category }] }
//
// Aqui a gente filtra customs (customDefinition=true) e atualiza o cache
// available_customs + last_metadata_at no lj_ga4_config.

const { getMetadata, readConfig } = require('../lib/ga4-oauth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const propertyIdFromQuery = req.query?.propertyId ? String(req.query.propertyId) : null;

  try {
    const cfg = await readConfig(req.tenantDb, userId);
    if (!cfg) return res.status(400).json({ ok: false, message: 'GA4 não configurado.' });
    const propertyId = propertyIdFromQuery || cfg.selectedPropertyId;
    if (!propertyId) {
      return res.status(400).json({ ok: false, message: 'Property não escolhida (passe ?propertyId=... ou complete o wizard).' });
    }

    const meta = await getMetadata(req.tenantDb, userId, propertyId);

    // Lista TUDO (pra modo Custom) e filtra customs (pra Tela 7 do wizard).
    const allDimensions = (meta.dimensions || []).map(d => ({
      apiName: d.apiName,
      uiName: d.uiName,
      description: d.description || '',
      category: d.category || null,
      customDefinition: Boolean(d.customDefinition)
    }));
    const allMetrics = (meta.metrics || []).map(m => ({
      apiName: m.apiName,
      uiName: m.uiName,
      description: m.description || '',
      category: m.category || null,
      type: m.type || null,
      customDefinition: Boolean(m.customDefinition)
    }));

    const customs = [
      ...allDimensions.filter(d => d.customDefinition).map(d => ({ ...d, kind: 'dimension' })),
      ...allMetrics.filter(m => m.customDefinition).map(m => ({ ...m, kind: 'metric' }))
    ];

    // Cacheia customs no DB (frontend usa pra Tela 7 sem re-chamar API).
    await req.tenantDb.query(
      `UPDATE lj_ga4_config
          SET available_customs = $1::jsonb,
              last_metadata_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $2`,
      [JSON.stringify(customs), userId]
    );

    return res.status(200).json({
      ok: true,
      propertyId,
      counts: {
        dimensions: allDimensions.length,
        metrics: allMetrics.length,
        customs: customs.length
      },
      customs,
      allDimensions,
      allMetrics
    });
  } catch (err) {
    const msg = err?.message || String(err);
    if (/não conectado|refresh_token|não configurado/i.test(msg)) {
      return res.status(400).json({ ok: false, message: msg });
    }
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(503).json({ ok: false, message: 'Schema GA4 ainda não rodou no banco.', schemaMissing: true });
    }
    console.error('[ga4-metadata]', err);
    return res.status(500).json({ ok: false, message: msg });
  }
};
