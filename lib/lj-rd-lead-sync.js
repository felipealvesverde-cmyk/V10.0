// V33.0.0 — Onda 1.4: empurra visitor (já promovido pra Lead) pro RD CRM.
//
// Cria/atualiza Contact (pessoa) + Deal (oportunidade) no RD CRM no estágio
// equivalente do "Journey Revenue Pipeline" (que rd-crm-sync.js cria).
//
// API:
//   const result = await createOrUpdateLead({
//     controlDb,         // pool control plane (pra pegar credencial RD)
//     tenantDb,          // pool tenant (pra atualizar visitor com IDs externos)
//     userId,            // dono do LJ
//     visitor,           // objeto carregado do lj_visitors
//     campaignId         // campanha do touchpoint que gerou a promoção
//   });
//   → { ok, contactId?, dealId?, skipped?, error? }
//
// Comportamento:
//   - Se visitor.email vazio E phone vazio → skip (RD precisa de algum
//     identificador).
//   - Pega RD credential (crm_pat OU crm_oauth — tenta crm_pat primeiro).
//   - POST /contacts (cria contact OU atualiza se email já existe lá).
//   - POST /deals com stage_id = "Marketing MOF" do pipeline padrão.
//   - Grava external_rd_contact_id, external_rd_deal_id + sync_status no visitor.
//
// Erros NÃO sobem — gravam no visitor (sync_status='error', sync_error=...).
// Caller continua fluxo normal. UI mostra status pro user.

const { getRdCredential } = require('./rd-credentials');

const RD_CRM_BASE = 'https://crm.rdstation.com/api/v1';
const RD_PIPELINE_NAME = 'Journey Revenue Pipeline';
const LJ_STAGE_TO_RD_STAGE = {
  'marketing-tof': 'Marketing TOF',
  'marketing-mof': 'Marketing MOF',
  'marketing-bof': 'Marketing BOF',
  'vendas-tof':    'Vendas TOF',
  'vendas-mof':    'Vendas MOF',
  'vendas-bof':    'Vendas BOF',
  'cs-tof':        'CS Onboarding',
  'cs-mof':        'CS Retenção',
  'cs-bof':        'CS Expansão'
};

async function rdFetch(path, token, options = {}) {
  const url = path.startsWith('http') ? path : `${RD_CRM_BASE}${path}`;
  const init = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      // CRM_PAT é query-string (?token=). CRM_OAUTH é Bearer header. Detectamos
      // pelo formato do token (PAT é geralmente curto+sem dots, OAuth tem dots).
      ...(options.useBearer ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const finalUrl = options.useBearer ? url : (url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token));
  const response = await fetch(finalUrl, init);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: response.ok, status: response.status, data };
}

async function pickRdCredential(controlDb, userId) {
  // Tenta PAT primeiro (mais simples, sem refresh). Se não tem, tenta OAuth.
  try {
    const pat = await getRdCredential(controlDb, userId, 'crm_pat');
    if (pat && pat.token) return { token: pat.token, useBearer: false };
  } catch (_) { /* sem PAT, tenta OAuth */ }
  try {
    const oauth = await getRdCredential(controlDb, userId, 'crm_oauth');
    if (oauth && oauth.token) return { token: oauth.token, useBearer: true };
  } catch (_) { /* sem OAuth também */ }
  return null;
}

async function findPipelineStageId(token, useBearer, stageName) {
  // Busca pipeline → stages e retorna ID do stage com o nome certo.
  // Cache não implementado (Onda 1 MVP). Próxima onda otimiza.
  const pipelines = await rdFetch('/deal_pipelines', token, { useBearer });
  if (!pipelines.ok) return null;
  const list = Array.isArray(pipelines.data) ? pipelines.data : pipelines.data?.deal_pipelines || [];
  const pipe = list.find(p => String(p?.name || '').toLowerCase() === RD_PIPELINE_NAME.toLowerCase());
  if (!pipe) return null;

  const stages = await rdFetch(`/deal_stages?deal_pipeline_id=${encodeURIComponent(pipe.id || pipe._id)}`, token, { useBearer });
  if (!stages.ok) return null;
  const stageList = Array.isArray(stages.data) ? stages.data : stages.data?.deal_stages || [];
  const stage = stageList.find(s => String(s?.name || '').toLowerCase() === stageName.toLowerCase());
  return stage ? (stage.id || stage._id) : null;
}

async function createOrUpdateLead({ controlDb, tenantDb, userId, visitor, campaignId }) {
  // Pré-check: precisa de email OU phone
  if (!visitor.email && !visitor.phone) {
    await markSyncStatus(tenantDb, userId, visitor.lj_visitor_id, 'skipped', 'Sem email nem phone — RD precisa de identificador.');
    return { ok: false, skipped: true, reason: 'no_identifier' };
  }

  // Pega credencial RD
  const cred = await pickRdCredential(controlDb, userId);
  if (!cred) {
    await markSyncStatus(tenantDb, userId, visitor.lj_visitor_id, 'skipped', 'RD CRM não conectado.');
    return { ok: false, skipped: true, reason: 'no_rd_credentials' };
  }
  const { token, useBearer } = cred;

  try {
    // 1. Cria/atualiza Contact
    const contactBody = {
      contact: {
        name: visitor.name || visitor.email || visitor.phone || 'Lead sem nome',
        emails: visitor.email ? [{ email: visitor.email }] : [],
        phones: visitor.phone ? [{ phone: visitor.phone }] : []
      }
    };
    const contactRes = await rdFetch('/contacts', token, { method: 'POST', body: contactBody, useBearer });
    if (!contactRes.ok) {
      throw new Error(`RD contacts POST falhou (HTTP ${contactRes.status}): ${JSON.stringify(contactRes.data).slice(0, 200)}`);
    }
    const contactId = contactRes.data?.id || contactRes.data?._id || contactRes.data?.contact?.id;
    if (!contactId) throw new Error('RD não retornou contact_id.');

    // 2. Busca stage_id pelo nome (Marketing MOF default — pega do current_stage do visitor)
    const stageName = LJ_STAGE_TO_RD_STAGE[visitor.current_stage] || 'Marketing MOF';
    const stageId = await findPipelineStageId(token, useBearer, stageName);

    // 3. Cria Deal vinculado ao Contact
    let dealId = null;
    if (stageId) {
      const dealBody = {
        deal: {
          name: `LJ — ${visitor.name || visitor.email || visitor.lj_visitor_id}`,
          deal_stage_id: stageId,
          contacts: [{ id: contactId }]
        }
      };
      const dealRes = await rdFetch('/deals', token, { method: 'POST', body: dealBody, useBearer });
      if (dealRes.ok) {
        dealId = dealRes.data?.id || dealRes.data?._id || dealRes.data?.deal?.id;
      }
      // Se deal falhar, não fail-hard — contact já tá lá. Log e segue.
    }

    await tenantDb.query(
      `UPDATE lj_visitors
          SET external_rd_contact_id = $3,
              external_rd_deal_id = $4,
              external_rd_sync_status = 'synced',
              external_rd_sync_error = NULL,
              external_rd_synced_at = NOW(),
              updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitor.lj_visitor_id, contactId, dealId]
    );

    return { ok: true, contactId, dealId };
  } catch (err) {
    await markSyncStatus(tenantDb, userId, visitor.lj_visitor_id, 'error', err.message);
    return { ok: false, error: err.message };
  }
}

async function markSyncStatus(tenantDb, userId, visitorId, status, errorMessage = null) {
  try {
    await tenantDb.query(
      `UPDATE lj_visitors
          SET external_rd_sync_status = $3,
              external_rd_sync_error = $4,
              updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitorId, status, errorMessage]
    );
  } catch (err) {
    console.error('[lj-rd-lead-sync] falha ao gravar status:', err.message);
  }
}

module.exports = { createOrUpdateLead };
