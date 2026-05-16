// V26.0.0 — Djow Chat API.
// Endpoint principal do assistente AI. Recebe mensagem do user → chama Claude
// API com tools + knowledge base → executa tools no servidor → devolve resposta.
//
// FLUXO:
//   1. Auth gate (master-only por enquanto)
//   2. Carrega/cria conversa
//   3. Carrega histórico
//   4. Monta system prompt: identidade + KB + contexto do user
//   5. Loop Claude API + tool execution até stop_reason !== 'tool_use'
//   6. Salva tudo no Postgres
//   7. Retorna resposta final
//
// Tools implementadas (server-side): get_revenue_summary, list_campaigns,
//   get_campaign, get_funnel_health, get_top_leads, list_pending_tasks,
//   query_state, search_kb.
//
// Modelo padrão: claude-sonnet-4-6 (configurável por user).
// API key: process.env.ANTHROPIC_API_KEY (env var Railway).
const fs = require('fs');
const path = require('path');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// V26.0.0 — Carrega knowledge base no startup (cache em memória).
// Lê todos os .md de /knowledge-base/ ignorando .example.md.
let _KB_CACHE = null;
function loadKnowledgeBase() {
  if (_KB_CACHE !== null) return _KB_CACHE;
  const kbDir = path.join(__dirname, '..', 'knowledge-base');
  if (!fs.existsSync(kbDir)) {
    _KB_CACHE = '';
    return _KB_CACHE;
  }
  const files = fs.readdirSync(kbDir)
    .filter(f => f.endsWith('.md') && !f.endsWith('.example.md') && f !== 'README.md');
  const parts = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(kbDir, file), 'utf8');
      parts.push(`# Arquivo: ${file}\n${content}`);
    } catch (_) {}
  }
  _KB_CACHE = parts.join('\n\n---\n\n');
  return _KB_CACHE;
}

// V26.0.0 — Tools definition (Anthropic format).
const TOOLS = [
  {
    name: 'get_revenue_summary',
    description: 'Retorna resumo de receita da operação: total leads, campanhas ativas, receita prevista total, ticket médio. Chame quando o user pedir uma visão geral financeira.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'list_campaigns',
    description: 'Lista todas as campanhas do user com nome, status e produto vinculado. Para detalhe de uma específica, use get_campaign.',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', description: 'Filtrar por status (opcional)' } },
      required: []
    }
  },
  {
    name: 'get_campaign',
    description: 'Retorna detalhe completo de uma campanha: ações, leads vinculados, conversões, KRs.',
    input_schema: {
      type: 'object',
      properties: { campaign_id: { type: 'number', description: 'ID da campanha' } },
      required: ['campaign_id']
    }
  },
  {
    name: 'get_funnel_health',
    description: 'Retorna saúde do funil: distribuição de leads por estágio (mkt_tof, mkt_mof, ..., cs_expansao) + % conversão entre estágios.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_top_leads',
    description: 'Retorna top N leads ordenados por score. Use pra responder "quais leads estão quentes" ou similar.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Quantos leads retornar (max 20)' },
        min_score: { type: 'number', description: 'Score mínimo (opcional)' }
      },
      required: []
    }
  },
  {
    name: 'list_pending_tasks',
    description: 'Lista tarefas pendentes no gestor de projeto configurado (ClickUp/Trello/Jira/etc).',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'query_state',
    description: 'Consulta genérica ao state da operação. Use APENAS quando uma tool específica não cobrir. Ex: path="products" retorna lista de produtos. Path com pontos pra ir fundo: "campaigns.0.actions".',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Caminho dot-notation no App.state. Ex: "products", "campaigns", "leads", "scores"' } },
      required: ['path']
    }
  },
  {
    name: 'search_kb',
    description: 'Busca na knowledge base de RevOps/CX/domínio. Use pra responder perguntas conceituais ou recomendações.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Termos de busca' } },
      required: ['query']
    }
  }
];

// V26.0.0 — Pega state mais recente do user (do Postgres journey_state).
async function getUserState(db) {
  if (!db) return {};
  try {
    const result = await db.query('SELECT state_json FROM journey_state WHERE id = 1 LIMIT 1');
    return result.rows[0]?.state_json || {};
  } catch (_) {
    return {};
  }
}

// V26.0.0 — Implementação das tools (server-side).
function execTool(name, input, state) {
  try {
    switch (name) {
      case 'get_revenue_summary': {
        const products = state.products || [];
        const campaigns = state.campaigns || [];
        const actions = state.actions || [];
        const allLeads = (state.globalLeads || []).concat(
          actions.flatMap(a => a.leads || [])
        );
        const totalRevenue = products.reduce((s, p) => s + Number(p.priceValue || 0), 0);
        return {
          total_products: products.length,
          total_campaigns: campaigns.length,
          active_campaigns: campaigns.filter(c => (c.status || '').toLowerCase().includes('ativ')).length,
          total_actions: actions.length,
          total_leads: allLeads.length,
          total_revenue_brl: totalRevenue,
          avg_ticket: products.length ? totalRevenue / products.length : 0
        };
      }
      case 'list_campaigns': {
        const campaigns = state.campaigns || [];
        const filtered = input.status
          ? campaigns.filter(c => (c.status || '').toLowerCase().includes(input.status.toLowerCase()))
          : campaigns;
        return filtered.slice(0, 30).map(c => ({
          id: c.id, name: c.name, status: c.status, productId: c.productId,
          actionsCount: (state.actions || []).filter(a => Number(a.campaignId) === Number(c.id)).length
        }));
      }
      case 'get_campaign': {
        const c = (state.campaigns || []).find(x => Number(x.id) === Number(input.campaign_id));
        if (!c) return { error: 'Campanha não encontrada' };
        const actions = (state.actions || []).filter(a => Number(a.campaignId) === Number(c.id));
        return { campaign: c, actions: actions.slice(0, 20) };
      }
      case 'get_funnel_health': {
        const actions = state.actions || [];
        const stages = ['mkt_tof','mkt_mof','mkt_bof','vnd_tof','vnd_mof','vnd_bof','cs_onboarding','cs_retencao','cs_expansao'];
        const distribution = {};
        for (const s of stages) distribution[s] = 0;
        for (const a of actions) {
          const leads = a.leads || [];
          const stage = a.flow?.startStage || 'mkt_tof';
          distribution[stage] = (distribution[stage] || 0) + leads.length;
        }
        return { distribution, total_leads_in_funnel: Object.values(distribution).reduce((s, n) => s + n, 0) };
      }
      case 'get_top_leads': {
        const limit = Math.min(Number(input.limit) || 10, 20);
        const minScore = Number(input.min_score) || 0;
        const allLeads = (state.actions || []).flatMap(a => a.leads || []);
        const sorted = allLeads
          .filter(l => Number(l.globalScore || l.score || 0) >= minScore)
          .sort((a, b) => Number(b.globalScore || b.score || 0) - Number(a.globalScore || a.score || 0))
          .slice(0, limit);
        return sorted.map(l => ({
          name: l.name, email: l.email, score: l.globalScore || l.score, temperature: l.temperature
        }));
      }
      case 'list_pending_tasks': {
        const tasks = state.executionTasks || state.tasks || [];
        return tasks.filter(t => !['done','completed','closed'].includes((t.status || '').toLowerCase())).slice(0, 20);
      }
      case 'query_state': {
        const parts = String(input.path || '').split('.').filter(Boolean);
        let cur = state;
        for (const p of parts) {
          if (cur == null) return { error: 'path inválido' };
          cur = cur[p];
        }
        // Limita tamanho da resposta
        const json = JSON.stringify(cur);
        if (json && json.length > 8000) {
          return { truncated: true, sample: json.slice(0, 8000) + '...', full_length: json.length };
        }
        return cur;
      }
      case 'search_kb': {
        const kb = loadKnowledgeBase();
        const query = String(input.query || '').toLowerCase();
        const lines = kb.split('\n');
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query)) {
            const context = lines.slice(Math.max(0, i - 2), i + 5).join('\n');
            matches.push(context);
            if (matches.length >= 5) break;
          }
        }
        return { matches: matches.length ? matches : ['Nenhuma menção direta. KB completa já está no system prompt — releia.'] };
      }
      default:
        return { error: `Tool desconhecida: ${name}` };
    }
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

// V26.0.0 — Chama Anthropic API (não-streaming por simplicidade no MVP).
async function callClaude({ apiKey, model, system, messages, tools }) {
  const body = {
    model,
    max_tokens: 4096,
    system,
    messages,
    tools
  };
  const r = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
  if (!r.ok) {
    return { ok: false, status: r.status, error: data?.error?.message || data?.raw || `HTTP ${r.status}` };
  }
  return { ok: true, data };
}

function buildSystemPrompt(kb, user, state) {
  const accountSummary = state.products?.length
    ? `Operação atual: ${state.products.length} produto(s), ${(state.campaigns || []).length} campanha(s), ${(state.actions || []).length} ação(ões).`
    : 'Operação atual: ainda sem produtos cadastrados.';
  return `Você é o **Djow**, assistente AI do LeadJourney — um Revenue Operating System.

## Sua função
Ajudar o user a entender a operação dele (campanhas, leads, receita, funil) e dar insights de RevOps + CX baseados em dados reais + boas práticas.

## Sua personalidade
Direto, prático, sem floreio. Fala em português brasileiro casual mas técnico. Não puxa saco. Quando vê algo problemático, fala. Quando não tem certeza, admite.

## Contexto do user
- Username: ${user?.username || 'desconhecido'}
- Master: ${user?.isMaster ? 'sim' : 'não'}
- ${accountSummary}

## Acesso aos dados
Você tem ferramentas (tools) pra ler dados da operação dele. Use-as quando precisar de dado concreto. NÃO invente números — se não tem a info, chame a tool ou diga que não sabe.

## Conhecimento de domínio (RevOps/CX)
${kb || '_Knowledge base vazia. Sem conhecimento de domínio carregado._'}

## Regras
- Respostas em markdown
- Máximo 400 palavras por resposta (a não ser que o user peça mais)
- Quando recomendar ações, seja específico (qual campanha, qual ajuste)
- Quando não souber, peça pra esclarecer ou chame uma tool
`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  // V26.0.0 — Auth: só master por enquanto (flag pra abrir depois).
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  // TODO V26.x: ler `state.djowConfig.allowedRoles` ['master', 'production', 'all']
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Djow restrito ao master no momento.' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      message: 'ANTHROPIC_API_KEY não configurada no Railway. Configure em Settings → Variables.'
    });
  }

  const body = req.body || {};
  const message = String(body.message || '').trim();
  let conversationId = body.conversationId ? Number(body.conversationId) : null;
  if (!message) return res.status(400).json({ ok: false, message: 'message obrigatório.' });

  // Carrega state do user (pra contexto + tools)
  const state = await getUserState(req.db);
  const djowCfg = state.djowConfig || {};
  const model = djowCfg.model || 'claude-sonnet-4-6';

  const kb = loadKnowledgeBase();
  const systemPrompt = buildSystemPrompt(kb, req.user, state);

  // Carrega/cria conversa
  let conv;
  if (conversationId) {
    const r = await req.db.query('SELECT * FROM djow_conversations WHERE id = $1 AND user_id = $2', [conversationId, req.user.id]);
    conv = r.rows[0];
    if (!conv) conversationId = null;
  }
  if (!conv) {
    const r = await req.db.query(
      'INSERT INTO djow_conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [req.user.id, message.slice(0, 80)]
    );
    conv = r.rows[0];
    conversationId = conv.id;
  }

  // Carrega histórico (últimas 20 msgs)
  const histR = await req.db.query(
    'SELECT role, content FROM djow_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 40',
    [conversationId]
  );
  const messages = histR.rows.map(m => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: message });

  // Salva mensagem do user
  await req.db.query(
    'INSERT INTO djow_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
    [conversationId, 'user', JSON.stringify(message)]
  );

  // Loop Claude + tools
  let finalText = '';
  let totalTokensIn = 0, totalTokensOut = 0;
  const maxIterations = 8;
  for (let iter = 0; iter < maxIterations; iter++) {
    const claudeRes = await callClaude({ apiKey, model, system: systemPrompt, messages, tools: TOOLS });
    if (!claudeRes.ok) {
      return res.status(502).json({ ok: false, message: `Erro Claude: ${claudeRes.error}`, conversationId });
    }
    const resp = claudeRes.data;
    totalTokensIn += resp.usage?.input_tokens || 0;
    totalTokensOut += resp.usage?.output_tokens || 0;

    // Verifica se Claude quer usar tool
    const toolUses = (resp.content || []).filter(c => c.type === 'tool_use');
    const textBlocks = (resp.content || []).filter(c => c.type === 'text');

    if (toolUses.length === 0) {
      // Resposta final
      finalText = textBlocks.map(b => b.text).join('\n');
      messages.push({ role: 'assistant', content: resp.content });
      break;
    }

    // Executa todas as tools
    messages.push({ role: 'assistant', content: resp.content });
    const toolResults = toolUses.map(tu => ({
      type: 'tool_result',
      tool_use_id: tu.id,
      content: JSON.stringify(execTool(tu.name, tu.input || {}, state))
    }));
    messages.push({ role: 'user', content: toolResults });
  }

  // Custo aproximado (Sonnet 4.6: $3/1M in, $15/1M out)
  const costPerInTokenSonnet = 3 / 1_000_000;
  const costPerOutTokenSonnet = 15 / 1_000_000;
  const costUsd = (totalTokensIn * costPerInTokenSonnet) + (totalTokensOut * costPerOutTokenSonnet);

  // Salva resposta
  await req.db.query(
    'INSERT INTO djow_messages (conversation_id, role, content, tokens_in, tokens_out, cost_usd) VALUES ($1, $2, $3, $4, $5, $6)',
    [conversationId, 'assistant', JSON.stringify(finalText), totalTokensIn, totalTokensOut, costUsd]
  );
  await req.db.query('UPDATE djow_conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

  res.status(200).json({
    ok: true,
    conversationId,
    message: finalText,
    usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut, costUsd: costUsd.toFixed(4) }
  });
};
