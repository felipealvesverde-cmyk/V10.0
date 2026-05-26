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

// V34.6.x — RD CRM API legacy base com ?token=X query param.
const RD_API_BASE = 'https://crm.rdstation.com/api/v1';
const RD_CALL_TIMEOUT_MS = 5000;

// V34.6.y — Cache global de pipeline+stages por (userId, campaignName).
// Antes: cada chunk de 10 visitors buscava pipelines + stages denovo, gastando
// 2 calls × N chunks que batiam rate limit 429 do RD. Agora cache vive 10min
// in-memory entre requests.
const pipelineCache = new Map(); // Map<`${userId}::${campaignName}`, { pipelineId, firstStageId, firstStageName, pipelineName, cachedAt }>
const PIPELINE_CACHE_TTL_MS = 10 * 60 * 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function rdFetch(path, token, options = {}) {
  // V34.6.y — Retry com backoff em 429 (rate limit RD). Até 2 retries: 1s, 2s.
  const maxAttempts = options.skipRetry ? 1 : 3;
  let lastResp = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${RD_API_BASE}${path}${sep}token=${encodeURIComponent(token)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RD_CALL_TIMEOUT_MS);
    const startMs = Date.now();
    try {
      const init = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal
      };
      if (options.body !== undefined) {
        init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }
      const response = await fetch(url, init);
      const text = await response.text();
      const elapsedMs = Date.now() - startMs;
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
      lastResp = { ok: response.ok, status: response.status, data, elapsedMs };
      // V34.6.y — Retry em 429 (rate limit). Backoff: 1s, 2s.
      if (response.status === 429 && attempt < maxAttempts) {
        const backoffMs = attempt * 1000;
        console.warn(`[rdFetch] ${init.method} ${path} → 429 (rate limit, retry em ${backoffMs}ms · tentativa ${attempt}/${maxAttempts})`);
        clearTimeout(timer);
        await sleep(backoffMs);
        continue;
      }
      console.log(`[rdFetch] ${init.method} ${path} → ${response.status} (${elapsedMs}ms${attempt > 1 ? ` · tent ${attempt}` : ''})`);
      return lastResp;
    } catch (err) {
      const elapsedMs = Date.now() - startMs;
      if (err.name === 'AbortError') {
        console.warn(`[rdFetch] TIMEOUT após ${elapsedMs}ms em ${path}`);
        lastResp = { ok: false, status: 408, data: null, error: `timeout ${RD_CALL_TIMEOUT_MS}ms`, elapsedMs };
        // Não retry em timeout (já demoramos demais)
        return lastResp;
      }
      console.error(`[rdFetch] ERR ${path}: ${err.message} (${elapsedMs}ms)`);
      lastResp = { ok: false, status: 0, data: null, error: err.message, elapsedMs };
      return lastResp;
    } finally {
      clearTimeout(timer);
    }
  }
  return lastResp;
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
  const handlerStartMs = Date.now(); // V34.6.v — diagnose timing total do handler
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });
  if (!visitorIds.length) return res.status(400).json({ ok: false, message: 'Nenhum visitor pra push.' });
  // V34.6.x — chunk=10 paralelizado limit 3 (problema antes era URL errada,
  // não timeout). Volta a config razoável agora que URL está correta.
  if (visitorIds.length > 10) {
    return res.status(400).json({
      ok: false,
      message: `Batch grande demais (${visitorIds.length} visitors). Limite: 10 por request.`
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

  // V34.6.y — Cache de pipeline+stages global (in-memory). Antes cada chunk
  // buscava de novo → ratelimit 429. Agora 1 busca per user+campanha em 10min.
  const cacheKey = `${userId}::${campaignName}`;
  let cached = pipelineCache.get(cacheKey);
  if (cached && (Date.now() - cached.cachedAt) > PIPELINE_CACHE_TTL_MS) {
    cached = null;
    pipelineCache.delete(cacheKey);
  }

  let pipelineId, firstStageId, firstStageName, resolvedPipelineName;

  if (cached) {
    pipelineId = cached.pipelineId;
    firstStageId = cached.firstStageId;
    firstStageName = cached.firstStageName;
    resolvedPipelineName = cached.pipelineName;
    console.log(`[leads-impute-rd-push] cache HIT pipeline ${cached.pipelineName} (id ${pipelineId})`);
  } else {
    // 3. Acha pipeline RD por nome exato (case-insensitive trim)
    const pipelinesRes = await rdFetch('/deal_pipelines', token);
    if (!pipelinesRes.ok) {
      // V34.6.y — 429 vira ok:true com retry=true (não 502). Frontend pode retentar.
      const isRateLimit = pipelinesRes.status === 429;
      return res.status(isRateLimit ? 200 : 502).json({
        ok: false,
        rateLimit: isRateLimit,
        retryable: isRateLimit,
        message: isRateLimit
          ? `RD rate limit (429). Aguarde 30s e tente de novo.`
          : `Falha ao listar pipelines RD (HTTP ${pipelinesRes.status}).`,
        raw: pipelinesRes.data
      });
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
    pipelineId = pipeline.id || pipeline._id;
    resolvedPipelineName = pipeline.name;

    // 4. Lista estágios do pipeline + acha o primeiro (menor nr)
    const stagesRes = await rdFetch(`/deal_stages?deal_pipeline_id=${encodeURIComponent(pipelineId)}`, token);
    if (!stagesRes.ok) {
      const isRateLimit = stagesRes.status === 429;
      return res.status(isRateLimit ? 200 : 502).json({
        ok: false,
        rateLimit: isRateLimit,
        retryable: isRateLimit,
        message: isRateLimit
          ? `RD rate limit (429) ao buscar stages. Aguarde 30s.`
          : `Falha ao listar stages (HTTP ${stagesRes.status}).`
      });
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
    firstStageId = firstStage.id || firstStage._id;
    firstStageName = firstStage.name;

    // Cacheia
    pipelineCache.set(cacheKey, {
      pipelineId, firstStageId, firstStageName,
      pipelineName: resolvedPipelineName,
      cachedAt: Date.now()
    });
    console.log(`[leads-impute-rd-push] cache SET pipeline ${resolvedPipelineName} (id ${pipelineId})`);
  }

  // 5. Loop nos visitors
  let rdPushed = 0, rdSkipped = 0, rdAlready = 0;
  const rdErrors = [];

  // V34.6.r — Processa N visitors EM PARALELO. Cada visitor roda suas 2-3
  // chamadas RD serial (lookup → upsert → create deal), mas os visitors do
  // mesmo chunk não esperam uns aos outros.
  // V34.6.z — Skips agora persistem em lj_visitors (status='failed', error msg)
  // pra UI mostrar backlog "não entrou no RD" + botão retry.
  async function persistFailure(visitorId, reason) {
    try {
      await req.tenantDb.query(
        `UPDATE lj_visitors SET
           external_rd_sync_status = 'failed',
           external_rd_sync_error = $3,
           external_rd_synced_at = NOW()
         WHERE user_id = $1 AND lj_visitor_id = $2`,
        [userId, visitorId, String(reason || 'unknown').slice(0, 500)]
      );
    } catch (_) { /* silent */ }
  }

  async function processOneVisitor(visitorId) {
    try {
      const vRes = await req.tenantDb.query(
        `SELECT lj_visitor_id, email, phone, name, external_rd_contact_id, external_rd_deal_id
           FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2 LIMIT 1`,
        [userId, visitorId]
      );
      if (!vRes.rows.length) {
        return { status: 'skipped', error: 'visitor não encontrado' };
      }
      const v = vRes.rows[0];
      if (!v.email && !v.phone) {
        await persistFailure(visitorId, 'sem email/phone');
        return { status: 'skipped', error: 'sem email/phone' };
      }
      if (v.external_rd_deal_id) return { status: 'already' };

      let rdContactId = v.external_rd_contact_id || null;
      if (!rdContactId && v.email) {
        const search = await rdFetch(`/contacts?email=${encodeURIComponent(v.email)}`, token);
        if (search.ok) {
          const contacts = Array.isArray(search.data) ? search.data : (search.data?.contacts || search.data?.data || []);
          if (contacts.length) rdContactId = contacts[0].id || contacts[0]._id;
        }
      }
      if (!rdContactId) {
        const createBody = { contact: { name: v.name || 'Lead LJ' } };
        if (v.email) createBody.contact.emails = [{ email: v.email }];
        if (v.phone) createBody.contact.phones = [{ phone: v.phone, type: 'cellphone' }];
        const cr = await rdFetch('/contacts', token, { method: 'POST', body: createBody });
        if (!cr.ok) {
          const errMsg = `criar contact HTTP ${cr.status}`;
          await persistFailure(visitorId, errMsg);
          return { status: 'skipped', error: errMsg };
        }
        const created = cr.data?.contact || cr.data;
        rdContactId = created?.id || created?._id;
        if (!rdContactId) {
          await persistFailure(visitorId, 'contact sem id');
          return { status: 'skipped', error: 'contact sem id' };
        }
      }

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
        const errMsg = `criar deal HTTP ${dr.status}: ${JSON.stringify(dr.data).slice(0, 200)}`;
        await persistFailure(visitorId, errMsg);
        return { status: 'skipped', error: errMsg };
      }
      const dealData = dr.data?.deal || dr.data;
      const rdDealId = dealData?.id || dealData?._id;
      if (!rdDealId) {
        await persistFailure(visitorId, 'deal sem id');
        return { status: 'skipped', error: 'deal sem id' };
      }

      await req.tenantDb.query(
        `UPDATE lj_visitors SET
           external_rd_contact_id = $3, external_rd_deal_id = $4,
           external_rd_sync_status = 'synced', external_rd_synced_at = NOW(),
           external_rd_sync_error = NULL
         WHERE user_id = $1 AND lj_visitor_id = $2`,
        [userId, visitorId, String(rdContactId), String(rdDealId)]
      );
      return { status: 'pushed' };
    } catch (err) {
      console.error('[leads-impute-rd-push] visitor err:', err);
      return { status: 'skipped', error: err.message };
    }
  }

  // V34.6.x — PARALLEL_LIMIT=3 (volta agora que URL está certa).
  // 10 visitors / 3 paralelos = 4 sub-batches × ~2s = ~8s wall-clock.
  const PARALLEL_LIMIT = 3;
  const allResults = [];
  for (let i = 0; i < visitorIds.length; i += PARALLEL_LIMIT) {
    const slice = visitorIds.slice(i, i + PARALLEL_LIMIT);
    const sliceResults = await Promise.allSettled(slice.map(processOneVisitor));
    allResults.push(...sliceResults);
  }
  for (let i = 0; i < allResults.length; i++) {
    const r = allResults[i];
    if (r.status === 'fulfilled') {
      const val = r.value;
      if (val.status === 'pushed') rdPushed++;
      else if (val.status === 'already') rdAlready++;
      else { rdSkipped++; if (val.error) rdErrors.push({ visitor_id: visitorIds[i], error: val.error }); }
    } else {
      rdSkipped++;
      rdErrors.push({ visitor_id: visitorIds[i], error: r.reason?.message || String(r.reason) });
    }
  }

  const totalElapsedMs = Date.now() - handlerStartMs;
  console.log(`[leads-impute-rd-push] ${visitorIds.length} visitors processados em ${totalElapsedMs}ms (pushed=${rdPushed}, already=${rdAlready}, skipped=${rdSkipped})`);
  return res.status(200).json({
    ok: true,
    pipelineMatched: true,
    pipelineName: resolvedPipelineName,
    pipelineId,
    firstStageName,
    firstStageId,
    rdPushed,
    rdSkipped,
    rdAlready,
    elapsedMs: totalElapsedMs,
    rdErrors: rdErrors.slice(0, 10)
  });
};
