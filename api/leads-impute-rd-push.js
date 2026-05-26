// V34.0.0 — V34.5.b: Push pro RD CRM dos leads imputados em campanha LJ.
//
// Chamado após /api/leads-impute-to-campaign ter feito a parte DB.
// Resolve pipeline RD por nome EXATO (case-insensitive trim) da campanha LJ;
// pra cada visitor, faz upsert de contato + cria deal no primeiro estágio
// do pipeline (idempotente: pula visitor que já tem external_rd_deal_id).
//
// POST /api/leads-impute-rd-push
// Body: { campaign_id: 5, visitor_ids: ['imp_xxx', ...] }
//
// Resposta:
//   {
//     ok,
//     pipelineMatched: bool,
//     pipelineName, pipelineId, firstStageName, firstStageId,
//     rdPushed, rdSkipped, rdAlready, rdErrors: [...]
//   }
//
// Comportamento por visitor:
//   - Sem email NEM phone → rdSkipped (não dá pra upsert)
//   - Visitor já tem external_rd_deal_id E pipeline match → rdAlready
//   - Upsert contact (busca por email; cria se não existe)
//   - Cria deal no primeiro estágio do pipeline
//   - Salva external_rd_contact_id + external_rd_deal_id em lj_visitors

const { getRdCredential } = require('../lib/rd-credentials');

const RD_API_BASE = 'https://api.rd.services/crm/v1';

async function rdFetch(path, token, options = {}) {
  const url = `${RD_API_BASE}${path}`;
  const init = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  };
  if (options.body !== undefined) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: response.ok, status: response.status, data };
}

function normName(s) { return String(s || '').trim().toLowerCase(); }

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const userId = req.user.sub;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const campaignId = Number(body.campaign_id || 0);
  const visitorIds = Array.isArray(body.visitor_ids) ? body.visitor_ids.map(String).filter(Boolean) : [];
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });
  if (!visitorIds.length) return res.status(400).json({ ok: false, message: 'Nenhum visitor pra push.' });
  // V34.6.k — hard limit 25 visitors/req. RD CRM faz 2-3 chamadas API por visitor
  // (lookup + upsert contact + create deal), cada uma ~200-500ms. 25 leads = 50-90s,
  // dentro da margem do timeout Railway. Frontend chunka em 25.
  if (visitorIds.length > 25) {
    return res.status(400).json({
      ok: false,
      message: `Batch grande demais (${visitorIds.length} visitors). Limite: 25 por request pro RD CRM. Frontend deve fazer chunking.`
    });
  }

  // 1. Lê crm_pat
  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_pat');
    token = cred.token;
  } catch (err) {
    return res.status(400).json({ ok: false, message: `RD CRM não conectado: ${err.message}` });
  }
  if (!token) return res.status(400).json({ ok: false, message: 'crm_pat sem access_token.' });

  // 2. Lê nome da campanha
  let campaignName = null;
  try {
    const st = await req.tenantDb.query('SELECT state_json FROM journey_state WHERE user_id = $1 LIMIT 1', [userId]);
    if (st.rows.length) {
      const sj = st.rows[0].state_json || {};
      const campaigns = Array.isArray(sj.campaigns) ? sj.campaigns : [];
      const found = campaigns.find(c => Number(c.id) === campaignId);
      if (found) campaignName = String(found.name || '').trim();
    }
  } catch (err) {
    console.error('[leads-impute-rd-push] journey_state err:', err);
  }
  if (!campaignName) return res.status(404).json({ ok: false, message: 'Campanha LJ não encontrada.' });

  // 3. Acha pipeline RD por nome exato (case-insensitive trim)
  const pipelinesRes = await rdFetch('/deal_pipelines', token);
  if (!pipelinesRes.ok) {
    return res.status(502).json({ ok: false, message: `Falha ao listar pipelines RD (HTTP ${pipelinesRes.status}).`, raw: pipelinesRes.data });
  }
  const pipelines = Array.isArray(pipelinesRes.data)
    ? pipelinesRes.data
    : (pipelinesRes.data?.deal_pipelines || pipelinesRes.data?.data || []);
  const wantName = normName(campaignName);
  const pipeline = pipelines.find(p => normName(p?.name) === wantName);
  if (!pipeline) {
    return res.status(200).json({
      ok: true,
      pipelineMatched: false,
      pipelineName: campaignName,
      pipelineId: null,
      message: `RD pipeline "${campaignName}" não encontrado. Crie no RD primeiro com esse nome exato.`,
      rdPushed: 0,
      rdSkipped: 0,
      rdAlready: 0,
      rdErrors: []
    });
  }
  const pipelineId = pipeline.id || pipeline._id;

  // 4. Lista estágios do pipeline + acha o primeiro (menor nr)
  const stagesRes = await rdFetch(`/deal_stages?deal_pipeline_id=${encodeURIComponent(pipelineId)}`, token);
  if (!stagesRes.ok) {
    return res.status(502).json({ ok: false, message: `Falha ao listar stages (HTTP ${stagesRes.status}).` });
  }
  const stages = Array.isArray(stagesRes.data)
    ? stagesRes.data
    : (stagesRes.data?.deal_stages || stagesRes.data?.data || []);
  if (!stages.length) {
    return res.status(200).json({
      ok: true,
      pipelineMatched: true,
      pipelineName: pipeline.name,
      pipelineId,
      message: `Pipeline "${pipeline.name}" sem estágios. Configure no RD.`,
      rdPushed: 0, rdSkipped: 0, rdAlready: 0, rdErrors: []
    });
  }
  const sorted = stages.slice().sort((a, b) => (Number(a.nr) || 0) - (Number(b.nr) || 0));
  const firstStage = sorted[0];
  const firstStageId = firstStage.id || firstStage._id;

  // 5. Loop nos visitors
  let rdPushed = 0, rdSkipped = 0, rdAlready = 0;
  const rdErrors = [];

  for (const visitorId of visitorIds) {
    try {
      const vRes = await req.tenantDb.query(
        `SELECT lj_visitor_id, email, phone, name, external_rd_contact_id, external_rd_deal_id
           FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2 LIMIT 1`,
        [userId, visitorId]
      );
      if (!vRes.rows.length) { rdSkipped++; rdErrors.push({ visitor_id: visitorId, error: 'visitor não encontrado' }); continue; }
      const v = vRes.rows[0];
      if (!v.email && !v.phone) { rdSkipped++; continue; }

      // Idempotência: se já tem deal_id pra esse pipeline, pula. (Refinável: hoje
      // não cruzamos se o deal anterior está NESTE pipeline ou em outro — mas o
      // external_rd_deal_id é único por visitor, então skip total é razoável.)
      if (v.external_rd_deal_id) {
        rdAlready++;
        continue;
      }

      // Upsert contact: busca por email primeiro
      let rdContactId = v.external_rd_contact_id || null;
      if (!rdContactId && v.email) {
        const search = await rdFetch(`/contacts?email=${encodeURIComponent(v.email)}`, token);
        if (search.ok) {
          const contacts = Array.isArray(search.data) ? search.data : (search.data?.contacts || search.data?.data || []);
          if (contacts.length) rdContactId = contacts[0].id || contacts[0]._id;
        }
      }
      if (!rdContactId) {
        // Cria contato novo
        const createBody = { contact: { name: v.name || 'Lead LJ' } };
        if (v.email) createBody.contact.emails = [{ email: v.email }];
        if (v.phone) createBody.contact.phones = [{ phone: v.phone, type: 'cellphone' }];
        const cr = await rdFetch('/contacts', token, { method: 'POST', body: createBody });
        if (!cr.ok) {
          rdErrors.push({ visitor_id: visitorId, error: `criar contact HTTP ${cr.status}` });
          rdSkipped++;
          continue;
        }
        const created = cr.data?.contact || cr.data;
        rdContactId = created?.id || created?._id;
        if (!rdContactId) { rdErrors.push({ visitor_id: visitorId, error: 'contact sem id retornado' }); rdSkipped++; continue; }
      }

      // Cria deal
      const dealBody = {
        deal: {
          name: `${v.name || v.email || visitorId} — ${campaignName}`.slice(0, 200),
          deal_stage_id: firstStageId,
          deal_pipeline_id: pipelineId
        },
        contacts: [{ id: rdContactId }]
      };
      const dr = await rdFetch('/deals', token, { method: 'POST', body: dealBody });
      if (!dr.ok) {
        rdErrors.push({ visitor_id: visitorId, error: `criar deal HTTP ${dr.status}: ${JSON.stringify(dr.data).slice(0, 200)}` });
        rdSkipped++;
        continue;
      }
      const dealData = dr.data?.deal || dr.data;
      const rdDealId = dealData?.id || dealData?._id;
      if (!rdDealId) { rdErrors.push({ visitor_id: visitorId, error: 'deal sem id retornado' }); rdSkipped++; continue; }

      // Persiste IDs no lj_visitors
      await req.tenantDb.query(
        `UPDATE lj_visitors SET
           external_rd_contact_id = $3,
           external_rd_deal_id = $4,
           external_rd_sync_status = 'synced',
           external_rd_synced_at = NOW(),
           external_rd_sync_error = NULL
         WHERE user_id = $1 AND lj_visitor_id = $2`,
        [userId, visitorId, String(rdContactId), String(rdDealId)]
      );

      rdPushed++;
    } catch (err) {
      console.error('[leads-impute-rd-push] visitor err:', err);
      rdSkipped++;
      rdErrors.push({ visitor_id: visitorId, error: err.message });
    }
  }

  return res.status(200).json({
    ok: true,
    pipelineMatched: true,
    pipelineName: pipeline.name,
    pipelineId,
    firstStageName: firstStage.name,
    firstStageId,
    rdPushed,
    rdSkipped,
    rdAlready,
    rdErrors: rdErrors.slice(0, 10)
  });
};
