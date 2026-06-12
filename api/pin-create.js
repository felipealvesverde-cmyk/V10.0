// V37.5.0 — POST /api/pin-create
// Body: { targetUrl, anchorXPct, anchorYPct, text, audienceUserIds: [int] }
// Cria pin + dispara notifications handoff/pin_mentioned pra audience.

const { emit } = require('../lib/emit-notification');

const PIN_TTL_DAYS = 7;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const creatorId = req.user.sub;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  const { targetUrl, anchorXPct, anchorYPct, text, audienceUserIds } = req.body || {};
  if (!targetUrl || typeof targetUrl !== 'string') return res.status(400).json({ ok: false, message: 'targetUrl obrigatório.' });
  if (typeof anchorXPct !== 'number' || typeof anchorYPct !== 'number') return res.status(400).json({ ok: false, message: 'anchorXPct + anchorYPct obrigatórios (number).' });
  if (anchorXPct < 0 || anchorXPct > 100 || anchorYPct < 0 || anchorYPct > 100) return res.status(400).json({ ok: false, message: 'Coords inválidas (0-100).' });
  const t = String(text || '').trim().slice(0, 400);
  if (!t) return res.status(400).json({ ok: false, message: 'text obrigatório (1-400 chars).' });
  const audience = Array.isArray(audienceUserIds) ? audienceUserIds.map(Number).filter(Boolean) : [];
  if (!audience.length) return res.status(400).json({ ok: false, message: 'audienceUserIds obrigatório (1+ user).' });

  const expiresAt = new Date(Date.now() + PIN_TTL_DAYS * 24 * 3600 * 1000);

  try {
    const r = await req.tenantDb.query(`
      INSERT INTO pins (tenant_id, creator_user_id, target_url, anchor_x_pct, anchor_y_pct, text, audience_user_ids, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at
    `, [tenantId, creatorId, targetUrl, anchorXPct, anchorYPct, t, audience, expiresAt]);
    const pin = r.rows[0];

    // Notifica audience
    try {
      await emit(req, {
        audience,
        kind: 'handoff.pin_mentioned',
        category: 'handoff',
        severity: 'warning',
        title: `Pin cravado pra você`,
        body: t.length > 80 ? t.slice(0, 80) + '...' : t,
        data: { pinId: pin.id, targetUrl, anchorXPct, anchorYPct, text: t, creatorUserId: creatorId },
        entityKind: 'pin',
        entityId: String(pin.id),
        expiresAt: expiresAt.toISOString()
      });
    } catch (err) {
      console.warn('[pin-create emit]', err.message);
    }

    return res.status(200).json({
      ok: true,
      pin: { id: pin.id, createdAt: pin.created_at, expiresAt }
    });
  } catch (err) {
    console.error('[pin-create]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
