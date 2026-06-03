// V35.8.0-alpha2 — Engine do Djow pra criação de KR.
//
// Fluxo determinístico em 6 etapas (invisível pro cliente):
//   1. start          - cria sessão, recebe setor, carrega contexto do tenant
//   2. classify+name  - recebe nome, classifica atomic/derived/manual,
//                       gera fala + layer de opções
//   3. select-source  - cliente selecionou; valida, gera comentário, libera nums
//   4. submit-numbers - cliente preencheu atual + metas; valida coerência
//   5. confirm        - finaliza sessão, retorna estrutura pronta pra salvar
//
// Heurística primeiro (catálogo), LLM apenas como fallback quando nome é
// criativo demais pra match direto. Custo controlado.

const crypto = require('crypto');
const { NATURES, findByName: findNatureByName } = require('./kr-natures-catalog');
const { FORMULAS, findByName: findFormulaByName } = require('./kr-formulas-catalog');
const { listActiveIntegrations } = require('./tenant-integrations-lookup');

// ============================================================
// SESSÃO — utilidades de leitura/escrita
// ============================================================

async function _createSession(tenantDb, userId, { setor }) {
  const sessionId = crypto.randomUUID();
  await tenantDb.query(
    `INSERT INTO djow_kr_sessions (session_id, user_id, setor, step, data)
     VALUES ($1, $2, $3, 'started', '{}')`,
    [sessionId, userId, String(setor || '').toLowerCase()]
  );
  return sessionId;
}

async function _loadSession(tenantDb, sessionId, userId) {
  const r = await tenantDb.query(
    `SELECT * FROM djow_kr_sessions
       WHERE session_id = $1 AND user_id = $2 AND expires_at > NOW()`,
    [sessionId, userId]
  );
  return r.rows[0] || null;
}

async function _updateSession(tenantDb, sessionId, { step, data }) {
  await tenantDb.query(
    `UPDATE djow_kr_sessions SET step = $2, data = $3, expires_at = NOW() + INTERVAL '30 minutes'
       WHERE session_id = $1`,
    [sessionId, step, JSON.stringify(data)]
  );
}

// ============================================================
// HEURÍSTICA: detecta direção pelo verbo no nome
// ============================================================

function _inferDirection(nome) {
  const n = String(nome || '').toLowerCase();
  if (/\b(reduzir|diminuir|baixar|cortar)\b/.test(n)) return 'lower';
  if (/\b(aumentar|crescer|subir|maximizar|elevar)\b/.test(n)) return 'higher';
  return null;            // sem pista — usa default da natureza
}

// ============================================================
// ETAPA 1 — start
// ============================================================

/**
 * Cria sessão nova. Carrega integrações ativas e KRs já existentes
 * pra Djow ter contexto.
 */
async function startSession(tenantDb, userId, { setor, productId }) {
  const setorNorm = String(setor || '').toLowerCase();
  if (!['marketing', 'vendas', 'cs', 'governanca', 'governança'].includes(setorNorm)) {
    return { ok: false, error: `Setor desconhecido: "${setor}".` };
  }
  const sessionId = await _createSession(tenantDb, userId, { setor: setorNorm });
  const integrations = await listActiveIntegrations(tenantDb, userId);
  const data = {
    setor: setorNorm,
    productId: productId || null,
    integrations,                  // snapshot pra próximas etapas
    fala_history: []               // monólogo cumulativo
  };
  await _updateSession(tenantDb, sessionId, { step: 'started', data });
  return { ok: true, sessionId, integrations };
}

// ============================================================
// ETAPA 2 — classify + name (heurística → fallback LLM)
// ============================================================

/**
 * Recebe nome do KR. Classifica (atomic/derived/manual) e gera fala +
 * layer de opções de fontes.
 */
async function processName(tenantDb, userId, { sessionId, nome, anthropicKey }) {
  const sess = await _loadSession(tenantDb, sessionId, userId);
  if (!sess) return { ok: false, error: 'Sessão expirada ou não encontrada.' };

  const sessData = sess.data || {};
  const integrations = sessData.integrations || [];
  const integrationIds = new Set(integrations.map(i => i.id));
  const nomeRaw = String(nome || '').trim();
  if (!nomeRaw) return { ok: false, error: 'Nome vazio.' };

  // ----- Heurística 1: é derivado? (catálogo de fórmulas)
  const formula = findFormulaByName(nomeRaw);
  if (formula) {
    return _buildDerivedResponse(tenantDb, sessionId, sessData, nomeRaw, formula);
  }

  // ----- Heurística 2: é atômico? (catálogo de naturezas)
  const nature = findNatureByName(nomeRaw);
  if (nature) {
    return _buildAtomicResponse(tenantDb, sessionId, sessData, nomeRaw, nature, integrationIds);
  }

  // ----- Fallback: chama LLM pra desambiguar (só se chave disponível)
  if (!anthropicKey) {
    return _buildManualResponse(tenantDb, sessionId, sessData, nomeRaw, []);
  }
  try {
    const llmResult = await _classifyWithLLM(nomeRaw, sessData.setor, integrations, anthropicKey);
    if (llmResult.type === 'derived') {
      const f = findFormulaByName(llmResult.match_id) || formula;
      if (f) return _buildDerivedResponse(tenantDb, sessionId, sessData, nomeRaw, f);
    }
    if (llmResult.type === 'atomic') {
      const n = NATURES.find(x => x.id === llmResult.match_id);
      if (n) return _buildAtomicResponse(tenantDb, sessionId, sessData, nomeRaw, n, integrationIds);
    }
    // LLM disse manual ou não confiou
    return _buildManualResponse(tenantDb, sessionId, sessData, nomeRaw, llmResult.suggested_tools || []);
  } catch (_) {
    // LLM falhou — fallback pra manual
    return _buildManualResponse(tenantDb, sessionId, sessData, nomeRaw, []);
  }
}

// ============================================================
// BUILDERS DE RESPOSTA POR TIPO
// ============================================================

async function _buildAtomicResponse(tenantDb, sessionId, sessData, nomeRaw, nature, integrationIds) {
  // Filtra mapping da natureza pelas integrações que o tenant TEM
  const availableMappings = Object.entries(nature.mapping || {})
    .filter(([integId]) => integrationIds.has(integId));

  if (!availableMappings.length) {
    // Natureza conhecida mas tenant não tem integração — vira manual com sugestão
    const fala = `Reconheço "${nomeRaw}" como ${nature.label}. Mas você não tem fonte conectada pra puxar automaticamente. Vou criar como número manual — você atualiza quando quiser.`;
    const layer_options = [];
    return _saveAndReturn(tenantDb, sessionId, sessData, {
      step: 'named',
      classification: 'manual',
      nature_id: nature.id,
      fala,
      layer_options,
      kr_meta: {
        nome: nomeRaw,
        unit: nature.default_unit,
        direction: _inferDirection(nomeRaw) || nature.default_direction,
        type: 'manual'
      },
      suggested_tools: nature.suggested_tools || []
    });
  }

  // Tem fontes — gera layer de opções
  const layer_options = availableMappings.map(([integId, m]) => ({
    id: `${integId}::${m.field || m.formula || 'auto'}`,
    label: _humanLabelForSource(integId, m, nature),
    integration_id: integId,
    field: m.field || null,
    aggregation: m.aggregation || 'sum'
  }));
  // + sempre Manual como opção
  layer_options.push({
    id: 'manual::',
    label: 'Manual (você atualiza o valor)',
    integration_id: null,
    field: null,
    aggregation: null
  });

  const integLabels = availableMappings.map(([id]) => {
    return (sessData.integrations || []).find(i => i.id === id)?.label || id;
  });
  const fala = `Reconheci "${nomeRaw}" como ${nature.label}. Você tem ${integLabels.join(' e ')} conectado — vou propor puxar daí. Escolhe a opção que faz mais sentido pro seu caso.`;

  return _saveAndReturn(tenantDb, sessionId, sessData, {
    step: 'named',
    classification: 'atomic',
    nature_id: nature.id,
    fala,
    layer_options,
    kr_meta: {
      nome: nomeRaw,
      unit: nature.default_unit,
      direction: _inferDirection(nomeRaw) || nature.default_direction,
      type: 'atomic'
    }
  });
}

async function _buildDerivedResponse(tenantDb, sessionId, sessData, nomeRaw, formula) {
  // Pra cada input da fórmula, mostra como opção configurável
  const layer_options = formula.inputs.map(input => ({
    id: `input::${input.id}`,
    label: input.label,
    input_id: input.id,
    nature_id: input.nature_id,
    allow_kr_reference: input.allow_kr_reference,
    has_default: input.default !== undefined,
    default: input.default,
    default_label: input.default_label || null
  }));
  const fala = `"${nomeRaw}" é um número derivado — vou calcular pela fórmula: ${formula.formula_display}. Preciso plugar ${formula.inputs.length} insumos. Te mostro as opções abaixo.`;
  return _saveAndReturn(tenantDb, sessionId, sessData, {
    step: 'named',
    classification: 'derived',
    formula_id: formula.id,
    fala,
    layer_options,
    kr_meta: {
      nome: nomeRaw,
      unit: formula.default_unit,
      direction: _inferDirection(nomeRaw) || formula.default_direction,
      type: 'derived',
      formula_display: formula.formula_display,
      formula_symbolic: formula.formula_symbolic
    }
  });
}

async function _buildManualResponse(tenantDb, sessionId, sessData, nomeRaw, suggestedTools) {
  const toolsText = suggestedTools.length
    ? ` Geralmente vem de ferramentas tipo ${suggestedTools.slice(0, 3).join(', ')}. Você não tem nenhuma conectada agora.`
    : '';
  const fala = `Não consegui mapear "${nomeRaw}" em fonte automática.${toolsText} Vou criar como número manual — você atualiza o valor periodicamente.`;
  return _saveAndReturn(tenantDb, sessionId, sessData, {
    step: 'named',
    classification: 'manual',
    fala,
    layer_options: [],
    kr_meta: {
      nome: nomeRaw,
      unit: 'numero',
      direction: _inferDirection(nomeRaw) || 'higher',
      type: 'manual'
    },
    suggested_tools: suggestedTools
  });
}

// ============================================================
// HELPERS
// ============================================================

function _humanLabelForSource(integId, mapping, nature) {
  const m = mapping.field || mapping.formula || '';
  if (integId === 'google_ads') {
    if (m.includes('impressions')) return `Google Ads — impressões`;
    if (m.includes('clicks')) return `Google Ads — cliques`;
    if (m.includes('conversions') && m.includes('value')) return `Google Ads — receita das conversões`;
    if (m.includes('conversions')) return `Google Ads — conversões`;
    if (m.includes('cost')) return `Google Ads — gasto`;
    if (m.includes('ctr')) return `Google Ads — CTR`;
    if (m.includes('cpc')) return `Google Ads — CPC médio`;
    return `Google Ads — ${nature.label}`;
  }
  if (integId === 'rd_station') {
    if (m.includes('MQL')) return `RD Station — contatos no estágio MQL`;
    if (m.includes('SQL')) return `RD Station — contatos no estágio SQL`;
    if (m.includes('deals.won')) return `RD Station — deals ganhos`;
    if (m.includes('contacts.created')) return `RD Station — novos contatos`;
    return `RD Station — ${nature.label}`;
  }
  if (integId === 'hotmart') {
    if (m.includes('PURCHASE_APPROVED.value')) return `Hotmart — receita de vendas aprovadas`;
    if (m.includes('PURCHASE_APPROVED')) return `Hotmart — vendas aprovadas`;
    if (m.includes('SHOPPING_CART')) return `Hotmart — carrinhos abandonados`;
    if (m.includes('REFUND')) return `Hotmart — reembolsos`;
    return `Hotmart — ${nature.label}`;
  }
  if (integId === 'clickup') {
    return `ClickUp — ${nature.label}`;
  }
  return `${integId} — ${nature.label}`;
}

async function _saveAndReturn(tenantDb, sessionId, sessData, result) {
  // Acumula no histórico de falas (monólogo)
  const fala_history = Array.isArray(sessData.fala_history) ? sessData.fala_history : [];
  fala_history.push({ at: new Date().toISOString(), text: result.fala });

  const newData = {
    ...sessData,
    classification: result.classification,
    nature_id: result.nature_id || null,
    formula_id: result.formula_id || null,
    kr_meta: result.kr_meta,
    layer_options: result.layer_options,
    suggested_tools: result.suggested_tools || [],
    fala_history
  };
  await _updateSession(tenantDb, sessionId, { step: result.step, data: newData });
  return {
    ok: true,
    sessionId,
    classification: result.classification,
    fala: result.fala,
    fala_history,
    layer_options: result.layer_options,
    kr_meta: result.kr_meta,
    suggested_tools: result.suggested_tools || []
  };
}

// ============================================================
// FALLBACK LLM
// ============================================================

async function _classifyWithLLM(nome, setor, integrations, anthropicKey) {
  const natureList = NATURES.map(n => `- ${n.id}: ${n.label} (aliases: ${(n.aliases || []).join(', ')})`).join('\n');
  const formulaList = FORMULAS.map(f => `- ${f.id}: ${f.label} (aliases: ${(f.aliases || []).join(', ')})`).join('\n');
  const intList = integrations.map(i => `- ${i.id} (${i.label}): ${i.status}`).join('\n');

  const prompt = `Você é um classificador de KRs. Dado o nome de um KR criado por um usuário, classifique como 'atomic', 'derived' ou 'manual'.

ATOMIC = vem direto de um campo de fonte/API.
DERIVED = calculado por fórmula a partir de outros.
MANUAL = não há fonte e não é fórmula conhecida.

Catálogo de naturezas atômicas conhecidas:
${natureList}

Catálogo de fórmulas derivadas conhecidas:
${formulaList}

Integrações ativas do tenant:
${intList}

Setor do KR: ${setor}
Nome do KR: "${nome}"

Responda APENAS em JSON válido com este formato:
{"type":"atomic|derived|manual","match_id":"id do catálogo se reconheceu","confidence":0.0-1.0,"suggested_tools":["..."]}

Não inclua texto fora do JSON.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',         // modelo leve, rápido, barato
      max_tokens: 200,
      system: 'Você responde apenas com JSON válido, sem markdown nem texto adicional.',
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const responseText = data?.content?.[0]?.text || '';

  // Parse defensivo — extrai JSON mesmo se Claude wrap com markdown
  const jsonMatch = String(responseText).match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM não retornou JSON válido.');
  const parsed = JSON.parse(jsonMatch[0]);
  const type = ['atomic', 'derived', 'manual'].includes(parsed.type) ? parsed.type : 'manual';
  return {
    type,
    match_id: parsed.match_id || null,
    confidence: Number(parsed.confidence || 0),
    suggested_tools: Array.isArray(parsed.suggested_tools) ? parsed.suggested_tools : []
  };
}

// ============================================================
// ETAPA 3 — select-source
// ============================================================

async function selectSource(tenantDb, userId, { sessionId, selected_ids }) {
  const sess = await _loadSession(tenantDb, sessionId, userId);
  if (!sess) return { ok: false, error: 'Sessão expirada.' };
  const sessData = sess.data || {};
  const layerOptions = sessData.layer_options || [];

  const ids = Array.isArray(selected_ids) ? selected_ids : [];
  const selected = layerOptions.filter(o => ids.includes(o.id));
  if (!selected.length && sessData.classification !== 'manual') {
    return { ok: false, error: 'Selecione pelo menos uma fonte.' };
  }

  // Sabedoria nos alertas
  const alerts = [];
  if (sessData.classification === 'atomic' && selected.length > 1) {
    alerts.push('Você marcou mais de uma fonte pra um KR atômico — vou somar os valores.');
  }
  if (sessData.classification === 'derived') {
    const requiredInputs = (sessData.layer_options || []).filter(o => !o.has_default);
    const selectedInputIds = selected.map(s => s.input_id);
    const missing = requiredInputs.filter(r => !selectedInputIds.includes(r.input_id));
    if (missing.length) {
      alerts.push(`Faltam definir: ${missing.map(m => m.label).join(', ')}. Vou usar valores padrão se não der pra plugar.`);
    }
  }

  const fala = selected.length
    ? `Boa escolha. ${alerts.length ? alerts.join(' ') + ' ' : ''}Agora libere os números abaixo — atual, meta segura e meta avançada.`
    : 'Sem fonte automática — vou criar como manual. Preencha os números abaixo.';

  const fala_history = [...(sessData.fala_history || []), { at: new Date().toISOString(), text: fala }];
  const newData = { ...sessData, selected_sources: selected, fala_history, alerts };
  await _updateSession(tenantDb, sessionId, { step: 'source_selected', data: newData });

  return {
    ok: true,
    sessionId,
    fala,
    fala_history,
    alerts,
    unlock_numbers: true
  };
}

// ============================================================
// ETAPA 4 — submit-numbers (validação determinística)
// ============================================================

async function submitNumbers(tenantDb, userId, { sessionId, atual, segura, avancada }) {
  const sess = await _loadSession(tenantDb, sessionId, userId);
  if (!sess) return { ok: false, error: 'Sessão expirada.' };
  const sessData = sess.data || {};
  const direction = sessData.kr_meta?.direction || 'higher';

  const a = Number(atual);
  const s = Number(segura);
  const v = Number(avancada);
  const alerts = [];

  if (isNaN(a) || isNaN(s) || isNaN(v)) {
    return { ok: false, error: 'Preencha todos os 3 números.' };
  }

  // Validações coerentes com direção
  if (direction === 'higher') {
    if (s <= a) alerts.push('Sua meta segura tá no nível do atual ou abaixo — sem desafio. Quer ousar mais?');
    if (v <= s) alerts.push('Meta avançada deveria ser maior que segura. Quer trocar?');
  } else if (direction === 'lower') {
    if (s >= a) alerts.push('Sua meta segura tá no nível do atual ou acima — sem desafio de redução. Quer ousar mais?');
    if (v >= s) alerts.push('Meta avançada deveria ser menor que segura. Quer trocar?');
  }

  const fala = alerts.length
    ? `Vi seus números. ${alerts.join(' ')} Se tiver certeza, pode confirmar.`
    : `Números coerentes. Atual ${a}, meta segura ${s}, meta avançada ${v}. Vou parabenizar você e passar o bastão pro LJ.`;

  const fala_history = [...(sessData.fala_history || []), { at: new Date().toISOString(), text: fala }];
  const newData = { ...sessData, numbers: { atual: a, segura: s, avancada: v }, fala_history, validation_alerts: alerts };
  await _updateSession(tenantDb, sessionId, { step: 'numbers_provided', data: newData });

  return {
    ok: true,
    sessionId,
    fala,
    fala_history,
    alerts,
    can_confirm: true
  };
}

// ============================================================
// ETAPA 5 — confirm
// ============================================================

async function confirmSession(tenantDb, userId, { sessionId }) {
  const sess = await _loadSession(tenantDb, sessionId, userId);
  if (!sess) return { ok: false, error: 'Sessão expirada.' };
  const sessData = sess.data || {};
  if (!sessData.numbers) return { ok: false, error: 'Falta preencher os números.' };

  const fala = `Tá feito. Passei o bastão pro LJ — vou plugar esse KR ${sessData.classification === 'manual' ? 'como manual' : 'na fonte que você escolheu'} e começar a alimentar.`;
  const fala_history = [...(sessData.fala_history || []), { at: new Date().toISOString(), text: fala }];

  // Monta payload final pra UI salvar
  const kr_payload = {
    nome: sessData.kr_meta?.nome,
    setor: sessData.setor,
    productId: sessData.productId,
    unit: sessData.kr_meta?.unit,
    direction: sessData.kr_meta?.direction,
    type: sessData.kr_meta?.type,
    nature_id: sessData.nature_id || null,
    formula_id: sessData.formula_id || null,
    formula_display: sessData.kr_meta?.formula_display || null,
    formula_symbolic: sessData.kr_meta?.formula_symbolic || null,
    selected_sources: sessData.selected_sources || [],
    atual: sessData.numbers.atual,
    meta_segura: sessData.numbers.segura,
    meta_avancada: sessData.numbers.avancada,
    created_by_djow_session: sessionId
  };

  await _updateSession(tenantDb, sessionId, { step: 'confirmed', data: { ...sessData, fala_history, kr_payload } });

  return { ok: true, sessionId, fala, fala_history, kr_payload };
}

module.exports = {
  startSession,
  processName,
  selectSource,
  submitNumbers,
  confirmSession
};
