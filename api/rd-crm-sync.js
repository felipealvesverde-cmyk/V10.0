// V15 — Endpoint serverless para sync RD CRM via cron externo.
// Compatível com Vercel/Netlify functions.
//
// USO:
// POST /api/rd-crm-sync
// Headers:
//   Authorization: Bearer <RD_CRM_SYNC_TOKEN>   (segredo opcional para autorizar o cron)
// Body:
//   {
//     "accessToken": "<RD Marketing OAuth access_token>",
//     "pipelineName": "Journey Revenue Pipeline",   // opcional
//     "stages": [ { "code": "mkt_tof", "label": "Marketing TOF", "order": 1 }, ... ]
//   }
//
// O endpoint:
//   1. Lista pipelines no RD CRM
//   2. Cria o pipeline padrão Journey se ele não existir
//   3. Cria as 9 etapas padrão se faltarem
//   4. Retorna stageMap (code → rdStageId) para o cron persistir ou logar
//
// Configurar cron externo (ex.: cron-job.org, GitHub Actions schedule) para
// bater nesse endpoint a cada 5 minutos passando o access token.

const RD_API_BASE = 'https://api.rd.services/crm/v1';
const DEFAULT_PIPELINE = 'Journey Revenue Pipeline';
const DEFAULT_STAGES = [
  { code: 'mkt_tof', label: 'Marketing TOF', order: 1 },
  { code: 'mkt_mof', label: 'Marketing MOF', order: 2 },
  { code: 'mkt_bof', label: 'Marketing BOF', order: 3 },
  { code: 'vnd_tof', label: 'Vendas TOF', order: 4 },
  { code: 'vnd_mof', label: 'Vendas MOF', order: 5 },
  { code: 'vnd_bof', label: 'Vendas BOF', order: 6 },
  { code: 'cs_onboarding', label: 'CS Onboarding', order: 7 },
  { code: 'cs_retention', label: 'CS Retenção', order: 8 },
  { code: 'cs_expansion', label: 'CS Expansão', order: 9 }
];

async function rdFetch(path, token, options = {}) {
  const url = path.startsWith('http') ? path : `${RD_API_BASE}${path}`;
  const init = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  };
  if (options.body !== undefined) init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: response.ok, status: response.status, data };
}

async function ensureJourneyPipeline(token, name) {
  const list = await rdFetch('/deal_pipelines', token);
  if (!list.ok) return { ok: false, message: `Falha ao listar pipelines (HTTP ${list.status}).` };
  const pipelines = Array.isArray(list.data) ? list.data : list.data?.deal_pipelines || list.data?.data || [];
  const found = pipelines.find(p => String(p?.name || '').trim().toLowerCase() === name.toLowerCase());
  if (found) return { ok: true, pipeline: found, created: false };
  const created = await rdFetch('/deal_pipelines', token, { method: 'POST', body: { name } });
  if (!created.ok) return { ok: false, message: `Falha ao criar pipeline (HTTP ${created.status}).` };
  return { ok: true, pipeline: created.data?.deal_pipeline || created.data, created: true };
}

async function ensureJourneyStages(token, pipelineId, stages) {
  const list = await rdFetch(`/deal_stages?deal_pipeline_id=${encodeURIComponent(pipelineId)}`, token);
  if (!list.ok) return { ok: false, message: `Falha ao listar etapas (HTTP ${list.status}).` };
  const remote = Array.isArray(list.data) ? list.data : list.data?.deal_stages || list.data?.data || [];
  const remoteByName = new Map(remote.map(s => [String(s?.name || '').trim().toLowerCase(), s]));
  const stageMap = {};
  const created = [];
  for (const def of stages) {
    const key = def.label.toLowerCase();
    const existing = remoteByName.get(key);
    if (existing) {
      stageMap[def.code] = { rdStageId: existing.id || existing._id, label: def.label, order: def.order };
      continue;
    }
    const result = await rdFetch('/deal_stages', token, {
      method: 'POST',
      body: { name: def.label, deal_pipeline_id: pipelineId, order: def.order }
    });
    if (!result.ok) return { ok: false, message: `Falha ao criar etapa "${def.label}" (HTTP ${result.status}).` };
    const id = result.data?.deal_stage?.id || result.data?.id || '';
    stageMap[def.code] = { rdStageId: id, label: def.label, order: def.order };
    created.push(def.label);
  }
  return { ok: true, stageMap, created };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST.' });
    return;
  }

  const guardToken = process.env.RD_CRM_SYNC_TOKEN;
  if (guardToken) {
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (provided !== guardToken) {
      res.status(401).json({ ok: false, message: 'Token de autorização inválido.' });
      return;
    }
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const accessToken = body.accessToken;
  if (!accessToken) {
    res.status(400).json({ ok: false, message: 'Informe accessToken do RD.' });
    return;
  }
  const pipelineName = String(body.pipelineName || DEFAULT_PIPELINE);
  const stages = Array.isArray(body.stages) && body.stages.length ? body.stages : DEFAULT_STAGES;

  try {
    const pipelineResult = await ensureJourneyPipeline(accessToken, pipelineName);
    if (!pipelineResult.ok) {
      res.status(502).json({ ok: false, step: 'pipeline', ...pipelineResult });
      return;
    }
    const pipelineId = pipelineResult.pipeline?.id || pipelineResult.pipeline?._id;
    const stagesResult = await ensureJourneyStages(accessToken, pipelineId, stages);
    if (!stagesResult.ok) {
      res.status(502).json({ ok: false, step: 'stages', ...stagesResult, pipelineId });
      return;
    }
    res.status(200).json({
      ok: true,
      pipelineId,
      pipelineName: pipelineResult.pipeline?.name || pipelineName,
      pipelineCreated: Boolean(pipelineResult.created),
      stageMap: stagesResult.stageMap,
      stagesCreated: stagesResult.created,
      syncedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Erro inesperado.' });
  }
};
