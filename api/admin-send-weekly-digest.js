// V37.4.6 — POST /api/admin-send-weekly-digest
// Envia digest semanal por email pra todos users do tenant com weekly_digest=true.
//
// Master roda manualmente ou via cron externo (ex: GitHub Actions toda segunda 9h).
// Body opcional: { tenantId } pra restringir ao tenant ativo do master.

const { sendEmail, isConfigured } = require('../lib/email-client');
const { shellHtml } = require('../lib/email-templates'); // não exportado mas vamos inline o digest

const COLORS = {
  primary: '#7c3aed',
  bg: '#fafaf9',
  card: '#ffffff',
  border: '#e7e5e4',
  text: '#1c1917',
  muted: '#78716c'
};

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function digestHtml({ userName, weekStart, weekEnd, overall, byCategory, highlights }) {
  const catLabels = {
    handoff: 'Handoffs pra você',
    event: 'Eventos no tenant',
    state: 'Mudanças de estado',
    operational: 'Alertas operacionais',
    integration: 'Questões de integração',
    health: 'Eventos de saúde'
  };
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,sans-serif;color:${COLORS.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:${COLORS.bg};">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid ${COLORS.border};">
          <div style="font-weight:900;font-size:18px;color:${COLORS.primary};">LeadJourney</div>
          <div style="font-size:10px;font-weight:700;color:${COLORS.muted};letter-spacing:0.18em;text-transform:uppercase;margin-top:2px;">Digest semanal</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;">Resumo da semana, ${escapeHtml(userName)}</h1>
          <p style="margin:0 0 16px;font-size:13px;color:${COLORS.muted};">${weekStart} → ${weekEnd}</p>
          <div style="background:${COLORS.bg};border-radius:12px;padding:16px;margin-bottom:20px;">
            <p style="margin:0;font-size:14px;"><strong>${overall.total}</strong> notificações no período</p>
            <p style="margin:6px 0 0;font-size:12px;color:${COLORS.muted};">
              ${overall.critical} crítico · ${overall.warning} atenção · ${overall.info} info
            </p>
          </div>
          ${byCategory.length > 0 ? `
            <p style="margin:0 0 8px;font-size:11px;font-weight:900;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.08em;">Por categoria</p>
            <ul style="margin:0 0 20px;padding:0 0 0 16px;font-size:13px;line-height:1.8;">
              ${byCategory.map(c => `<li><strong>${c.count}</strong> ${catLabels[c.category] || c.category}</li>`).join('')}
            </ul>
          ` : ''}
          ${highlights.length > 0 ? `
            <p style="margin:0 0 8px;font-size:11px;font-weight:900;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.08em;">Pra você olhar</p>
            ${highlights.map(h => `
              <div style="border-left:3px solid ${h.severity === 'critical' ? '#ef4444' : '#f59e0b'};padding:8px 12px;margin-bottom:8px;background:${COLORS.bg};border-radius:6px;">
                <p style="margin:0;font-size:13px;">${escapeHtml(h.title || h.kind)}</p>
              </div>
            `).join('')}
          ` : ''}
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid ${COLORS.border};background:${COLORS.bg};">
          <p style="margin:0;font-size:11px;color:${COLORS.muted};">
            Você está recebendo este resumo porque ativou o digest semanal nas suas preferências de notificação.
            Pode desativar a qualquer momento em Configurações → Notificações.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas Master LJ.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  if (!isConfigured()) {
    return res.status(503).json({ ok: false, message: 'SMTP não configurado (RESEND_API_KEY ausente).' });
  }

  try {
    // Lista users opted-in
    const optins = await req.tenantDb.query(`
      SELECT do.user_id, um.email, um.username
      FROM notification_digest_optins do
      JOIN tenant_users_mirror um ON um.user_id = do.user_id
      WHERE do.tenant_id = $1 AND do.weekly_digest = TRUE
    `, [tenantId]);

    if (!optins.rows.length) {
      return res.status(200).json({ ok: true, message: 'Nenhum user opt-in.', sent: 0 });
    }

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const weekStart = since.toLocaleDateString('pt-BR');
    const weekEnd = new Date().toLocaleDateString('pt-BR');

    let sent = 0;
    let failed = 0;
    for (const u of optins.rows) {
      try {
        const overall = await req.tenantDb.query(`
          SELECT COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
                 COUNT(*) FILTER (WHERE severity = 'warning') AS warning,
                 COUNT(*) FILTER (WHERE severity = 'info') AS info
          FROM notifications
          WHERE tenant_id = $1 AND user_id = $2 AND created_at > $3
        `, [tenantId, u.user_id, since.toISOString()]);
        const byCategory = await req.tenantDb.query(`
          SELECT category, COUNT(*) AS count
          FROM notifications
          WHERE tenant_id = $1 AND user_id = $2 AND created_at > $3
          GROUP BY category ORDER BY count DESC
        `, [tenantId, u.user_id, since.toISOString()]);
        const highlights = await req.tenantDb.query(`
          SELECT id, kind, severity, title FROM notifications
          WHERE tenant_id = $1 AND user_id = $2 AND created_at > $3
            AND severity IN ('critical', 'warning')
          ORDER BY (severity = 'critical') DESC, created_at DESC LIMIT 3
        `, [tenantId, u.user_id, since.toISOString()]);

        const html = digestHtml({
          userName: u.username || u.email.split('@')[0],
          weekStart, weekEnd,
          overall: {
            total: Number(overall.rows[0]?.total || 0),
            critical: Number(overall.rows[0]?.critical || 0),
            warning: Number(overall.rows[0]?.warning || 0),
            info: Number(overall.rows[0]?.info || 0)
          },
          byCategory: byCategory.rows.map(r => ({ category: r.category, count: Number(r.count) })),
          highlights: highlights.rows
        });

        const r = await sendEmail({
          to: u.email,
          subject: `LeadJourney — Seu resumo semanal (${weekStart} → ${weekEnd})`,
          html,
          text: `Resumo semanal LeadJourney. ${overall.rows[0]?.total || 0} notificações na semana.`
        });

        if (r.ok && !r.simulated) sent++;
        else failed++;

        await req.tenantDb.query(`
          UPDATE notification_digest_optins SET last_digest_sent_at = NOW()
          WHERE tenant_id = $1 AND user_id = $2
        `, [tenantId, u.user_id]);
      } catch (err) {
        console.error('[admin-send-weekly-digest user]', u.email, err.message);
        failed++;
      }
    }

    return res.status(200).json({ ok: true, sent, failed, totalOptins: optins.rows.length });
  } catch (err) {
    console.error('[admin-send-weekly-digest]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
