// V37.4.6 — GET/POST /api/notification-preferences
// GET: retorna prefs do user logado por categoria + opt-in digest semanal
// POST: salva (body: { category, inApp?, email? } OU { weeklyDigest: bool })

const CATEGORIES = ['handoff', 'event', 'state', 'operational', 'integration', 'health'];

// Defaults: tudo no sininho (in_app), nada no email exceto handoff/integration crítico
const DEFAULT_PREFS = {
  handoff:     { inApp: true,  email: true  },
  event:       { inApp: true,  email: false },
  state:       { inApp: true,  email: false },
  operational: { inApp: true,  email: false },
  integration: { inApp: true,  email: true  },
  health:      { inApp: true,  email: true  }
};

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  try {
    if (req.method === 'GET') {
      const [prefRows, digestRow] = await Promise.all([
        req.tenantDb.query(
          'SELECT category, in_app, email FROM notification_preferences WHERE tenant_id = $1 AND user_id = $2',
          [tenantId, userId]
        ),
        req.tenantDb.query(
          'SELECT weekly_digest, last_digest_sent_at FROM notification_digest_optins WHERE tenant_id = $1 AND user_id = $2',
          [tenantId, userId]
        )
      ]);

      // Merge: defaults + stored overrides
      const prefs = {};
      for (const cat of CATEGORIES) {
        prefs[cat] = { ...DEFAULT_PREFS[cat] };
      }
      for (const r of prefRows.rows) {
        if (prefs[r.category]) {
          prefs[r.category].inApp = Boolean(r.in_app);
          prefs[r.category].email = Boolean(r.email);
        }
      }
      const digest = digestRow.rows[0] || { weekly_digest: false, last_digest_sent_at: null };

      return res.status(200).json({
        ok: true,
        preferences: prefs,
        weeklyDigest: Boolean(digest.weekly_digest),
        lastDigestSentAt: digest.last_digest_sent_at
      });
    }

    if (req.method === 'POST') {
      const { category, inApp, email, weeklyDigest } = req.body || {};

      // Digest opt-in
      if (typeof weeklyDigest === 'boolean') {
        await req.tenantDb.query(`
          INSERT INTO notification_digest_optins (tenant_id, user_id, weekly_digest, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (tenant_id, user_id) DO UPDATE SET weekly_digest = $3, updated_at = NOW()
        `, [tenantId, userId, weeklyDigest]);
        return res.status(200).json({ ok: true });
      }

      // Category pref
      if (category && CATEGORIES.includes(category)) {
        const cur = await req.tenantDb.query(
          'SELECT in_app, email FROM notification_preferences WHERE tenant_id = $1 AND user_id = $2 AND category = $3',
          [tenantId, userId, category]
        );
        const existing = cur.rows[0] || DEFAULT_PREFS[category];
        const newInApp = typeof inApp === 'boolean' ? inApp : Boolean(existing.in_app ?? existing.inApp);
        const newEmail = typeof email === 'boolean' ? email : Boolean(existing.email);

        await req.tenantDb.query(`
          INSERT INTO notification_preferences (tenant_id, user_id, category, in_app, email, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (tenant_id, user_id, category) DO UPDATE
            SET in_app = $4, email = $5, updated_at = NOW()
        `, [tenantId, userId, category, newInApp, newEmail]);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, message: 'Body inválido.' });
    }

    return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
  } catch (err) {
    console.error('[notification-preferences]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
