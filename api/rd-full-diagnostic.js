// V34.8.9 — Diagnóstico unificado RD↔LJ pra o user logado.
// Retorna num único JSON tudo que preciso pra entender o estado:
//   - LJ side: totals, distribuição por status, ponte ou não, recentEnriched
//   - RD side: total contatos, sample do response cru
//   - Cursor: last_rd_pull_at + diff em segundos
//   - Pull dry-run: simula sem gravar (force_full pra evitar cursor podre)
//
// Master pode passar ?user_id=X pra inspecionar outro tenant.

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');
const { pullUpdatedContacts, resolveLjVisitor } = require('../lib/rd-reconciliation-engine');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db || !req.tenantDb) return res.status(503).json({ ok: false, message: 'DB não configurado.' });

  const myId = Number(req.user.sub || req.user.id);
  const userId = (req.user.isMaster && req.query?.user_id) ? Number(req.query.user_id) : myId;

  const report = { userId, sections: {} };

  // 1) LJ totals
  try {
    const t = await req.tenantDb.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE external_rd_contact_id IS NOT NULL)::int AS com_contact_id,
         COUNT(*) FILTER (WHERE external_rd_contact_id IS NULL)::int AS sem_contact_id,
         COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '')::int AS com_email
       FROM lj_visitors WHERE user_id = $1`,
      [userId]
    );
    report.sections.ljTotals = t.rows[0];
  } catch (err) { report.sections.ljTotals = { error: err.message }; }

  // 2) Distribuição por status
  try {
    const s = await req.tenantDb.query(
      `SELECT COALESCE(external_rd_sync_status, '(null)') AS status, COUNT(*)::int AS c
         FROM lj_visitors WHERE user_id = $1
         GROUP BY 1 ORDER BY 2 DESC`,
      [userId]
    );
    report.sections.byStatus = s.rows;
  } catch (err) { report.sections.byStatus = { error: err.message }; }

  // 3) Sample dos enriquecidos
  try {
    const e = await req.tenantDb.query(
      `SELECT lj_visitor_id, name, email, external_rd_contact_id,
              external_rd_sync_status, external_rd_sync_error, updated_at
         FROM lj_visitors
        WHERE user_id = $1
          AND lj_visitor_id IN (SELECT lj_visitor_id FROM lj_visitor_tags WHERE user_id = $1 AND tag LIKE 'lj-enriched-%')
        ORDER BY updated_at DESC LIMIT 5`,
      [userId]
    );
    report.sections.recentEnriched = e.rows;
  } catch (err) { report.sections.recentEnriched = { error: err.message }; }

  // 4) Cursor last_rd_pull_at
  try {
    const u = await req.db.query('SELECT last_rd_pull_at FROM users WHERE id = $1', [userId]);
    const ts = u.rows[0]?.last_rd_pull_at || null;
    report.sections.cursor = {
      last_rd_pull_at: ts,
      ageSeconds: ts ? Math.round((Date.now() - new Date(ts).getTime()) / 1000) : null
    };
  } catch (err) { report.sections.cursor = { error: err.message }; }

  // 5) Token RD CRM
  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_pat');
    token = cred?.token;
    report.sections.rdToken = { configured: Boolean(token), preview: token ? token.slice(0, 6) + '…' : null };
  } catch (err) { report.sections.rdToken = { error: err.message }; }

  // 6) RD CRM stats: GET /contacts (sample + total via has_more)
  if (token) {
    try {
      const r = await rdFetch('/contacts?limit=10&page=1', token, { method: 'GET' });
      report.sections.rdContacts = {
        httpStatus: r.status,
        ok: r.ok,
        total: r.data?.total ?? null,
        has_more: r.data?.has_more ?? null,
        contactsInPage: Array.isArray(r.data?.contacts) ? r.data.contacts.length : 0,
        sample: Array.isArray(r.data?.contacts) ? r.data.contacts.slice(0, 3).map(c => ({
          id: c.id, name: c.name, email: c.emails?.[0]?.email, updated_at: c.updated_at
        })) : null,
        error: r.error || null
      };
    } catch (err) { report.sections.rdContacts = { error: err.message }; }
  }

  // 7) Pull dry-run com force_full: simula reconciliação sem gravar
  if (token) {
    try {
      const pull = await pullUpdatedContacts(token, null, { maxPages: 3, limit: 50 });
      // Pra cada contato pulled, tenta resolver no LJ (não grava)
      let matchedByContactId = 0, matchedByEmail = 0, unmatched = 0;
      const sample = [];
      for (const c of (pull.contacts || []).slice(0, 100)) {
        const visitor = await resolveLjVisitor(req.tenantDb, userId, c);
        if (!visitor) { unmatched++; continue; }
        const byContact = visitor.external_rd_contact_id === String(c.id);
        if (byContact) matchedByContactId++; else matchedByEmail++;
        if (sample.length < 3) {
          sample.push({
            rd_id: c.id,
            rd_name: c.name,
            rd_email: c.emails?.[0]?.email,
            lj_name: visitor.name,
            lj_email: visitor.email,
            lj_external_rd_contact_id: visitor.external_rd_contact_id,
            matched_by: byContact ? 'contact_id' : 'email'
          });
        }
      }
      report.sections.pullDryRun = {
        pull_ok: pull.ok,
        pull_error: pull.error || null,
        pulled: pull.contacts?.length || 0,
        matchedByContactId, matchedByEmail, unmatched,
        sample
      };
    } catch (err) { report.sections.pullDryRun = { error: err.message }; }
  }

  return res.status(200).json({ ok: true, ...report });
};
