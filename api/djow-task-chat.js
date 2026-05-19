// V31.2.34 — Djow chat focado em ajudar o user a montar uma task pro ClickUp.
// Diferente do /api/djow-chat genérico (que tem muitas tools de write em LJ),
// este aqui só ajuda a ESCREVER o draft. Não cria nada — só propõe.
//
// POST: { actionId, messages: [{ role, content }] }
// Retorna: { ok, reply: string, draft?: {name, description, priority, due_date,
//   start_date, status, tags, time_estimate_hours, points, assignees_hints} }
//
// Não acessa DB pra escrever. Sem ações destrutivas — só lê contexto e propõe.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

async function callClaude({ apiKey, model, system, messages, tools }) {
  const r = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages, tools })
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
  if (!r.ok) return { ok: false, status: r.status, error: data?.error?.message || data?.raw || `HTTP ${r.status}` };
  return { ok: true, data };
}

const PROPOSE_DRAFT_TOOL = {
  name: 'propose_task_draft',
  description: 'Propor um draft completo (ou parcial) pra uma task no ClickUp. O usuário vai revisar antes de criar. NUNCA chame essa tool sem ter pelo menos name + description claros baseados no que o user pediu.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Título curto da task (máx 80 chars)' },
      description: { type: 'string', description: 'Descrição em texto simples com critério de pronto' },
      priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low', ''], description: 'Prioridade. Use "normal" quando não houver sinal claro.' },
      due_date_days_from_now: { type: 'integer', description: 'Dias a partir de hoje pra due_date. Omita se não souber.' },
      start_date_days_from_now: { type: 'integer', description: 'Dias a partir de hoje pra start_date. Omita se não souber.' },
      status: { type: 'string', description: 'Status da list (ex: "to do", "in progress"). Omita pra usar default.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags sugeridas (precisam existir no space pra funcionar)' },
      time_estimate_hours: { type: 'number', description: 'Estimativa em horas' },
      points: { type: 'integer', description: 'Sprint points' },
      assignees_hints: { type: 'array', items: { type: 'string' }, description: 'Nomes/emails de usuários sugeridos. O frontend tenta matchar com os members reais.' },
      reasoning: { type: 'string', description: 'Por que esse draft (1-2 frases). Aparece pro user antes do botão "Aplicar".' }
    },
    required: ['name', 'description']
  }
};

function buildSystemPrompt(action, campaign, productInfo) {
  return `Você é o Djow, assistente do LeadJourney. O usuário está convertendo uma ação estratégica em uma task no ClickUp e quer sua ajuda.

# Contexto da ação operacional
- **Nome da ação**: ${action.name}
- **Canal**: ${action.channel || '—'}
- **Travessia**: ${action.originSector || '—'} ${action.originFunnel || ''} → ${action.destinationSector || '—'} ${action.destinationFunnel || ''}
- **Tipo**: ${action.actionType || '—'}
- **Status estratégico**: ${action.strategicStatus || 'planned'}
- **Campanha vinculada**: ${campaign?.name || '—'}
- **Produto**: ${productInfo?.name || '—'}
${action.strategicDescription && action.strategicDescription !== 'Ação custom criada via engine' ? `- **Descrição existente**: ${action.strategicDescription}` : ''}

# Sua função
Ajudar o user a escrever uma task CLARA, ACIONÁVEL e ESPECÍFICA pra equipe operacional executar no ClickUp.

# Regras
1. NÃO crie a task. Você só propõe drafts via a tool propose_task_draft.
2. Conversação primeiro: tente entender o que o user quer (escopo, prazo, prioridade) antes de propor o draft.
3. Quando tiver informação suficiente, chame propose_task_draft com o draft completo.
4. Depois disso, espere o user pedir ajustes.
5. NÃO sugira ações destrutivas (deletar tasks, links, users).
6. Em português brasileiro, tom direto e profissional.

# Quando propor o draft
- Se o user disse claramente o que quer, chame propose_task_draft direto na primeira resposta.
- Se o user foi vago ("não sei", "me ajuda"), faça 1-2 perguntas antes de propor.
- Sempre que propor, explique brevemente as escolhas no campo "reasoning".`;
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return res.status(503).json({ ok: false, message: 'ANTHROPIC_API_KEY não configurada no servidor.' });
  }

  const { actionId, messages } = req.body || {};
  if (!actionId) return res.status(400).json({ ok: false, message: 'actionId obrigatório.' });
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ ok: false, message: 'messages array obrigatório.' });

  try {
    // Carrega contexto da ação do journey_state do user (não do body — server trusted).
    const stateRow = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [req.user.sub]);
    const state = stateRow.rows[0]?.state_json || {};
    const action = (state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return res.status(404).json({ ok: false, message: 'Ação não encontrada no state do user.' });
    const campaign = (state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const product = (state.products || []).find(p => Number(p.id) === Number(campaign?.productId));

    const system = buildSystemPrompt(action, campaign, product);
    // Sanitiza mensagens: aceita só role/content válidos
    const cleanMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && (typeof m.content === 'string' || Array.isArray(m.content)))
      .map(m => ({ role: m.role, content: m.content }));

    const claudeRes = await callClaude({
      apiKey,
      model: 'claude-sonnet-4-6',
      system,
      messages: cleanMessages,
      tools: [PROPOSE_DRAFT_TOOL]
    });
    if (!claudeRes.ok) return res.status(502).json({ ok: false, message: `Claude: ${claudeRes.error}` });

    const resp = claudeRes.data;
    const textBlocks = (resp.content || []).filter(c => c.type === 'text').map(b => b.text);
    const toolUses = (resp.content || []).filter(c => c.type === 'tool_use' && c.name === 'propose_task_draft');
    const reply = textBlocks.join('\n').trim();
    let draft = null;
    if (toolUses.length) {
      const input = toolUses[0].input || {};
      // Converte days_from_now em ISO strings que o frontend manda direto pra ClickUp.
      const today = new Date();
      const toIso = (days) => {
        const d = new Date(today.getTime() + Number(days) * 24 * 3600 * 1000);
        return d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm" pro datetime-local
      };
      draft = {
        name: input.name || null,
        description: input.description || null,
        priority: input.priority || null,
        status: input.status || null,
        tags: Array.isArray(input.tags) ? input.tags : null,
        time_estimate_hours: Number.isFinite(input.time_estimate_hours) ? input.time_estimate_hours : null,
        points: Number.isFinite(input.points) ? input.points : null,
        assignees_hints: Array.isArray(input.assignees_hints) ? input.assignees_hints : null,
        reasoning: input.reasoning || null
      };
      if (Number.isFinite(input.due_date_days_from_now)) draft.due_date = toIso(input.due_date_days_from_now);
      if (Number.isFinite(input.start_date_days_from_now)) draft.start_date = toIso(input.start_date_days_from_now);
    }

    return res.status(200).json({
      ok: true,
      reply: reply || (draft ? 'Aqui está o draft sugerido. Revisa e me diz se ajusta algo.' : '...'),
      draft,
      usage: resp.usage || null
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
