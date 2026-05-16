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

// V26.3.0 — Walk recursivo pra pegar .md em subpastas (knowledge-base/revops/*.md, etc.)
// Ignora .example.md, README.md, e qualquer pasta começando com ponto.
function _walkKb(dir, relPath = '') {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const fullPath = path.join(dir, ent.name);
    const rel = relPath ? `${relPath}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      out.push(..._walkKb(fullPath, rel));
    } else if (ent.isFile() && ent.name.endsWith('.md') && !ent.name.endsWith('.example.md') && ent.name !== 'README.md') {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        out.push({ path: rel, content });
      } catch (_) {}
    }
  }
  return out;
}

function loadKnowledgeBase() {
  if (_KB_CACHE !== null) return _KB_CACHE;
  const kbDir = path.join(__dirname, '..', 'knowledge-base');
  if (!fs.existsSync(kbDir)) {
    _KB_CACHE = '';
    return _KB_CACHE;
  }
  const files = _walkKb(kbDir);
  _KB_CACHE = files.map(f => `# Arquivo: ${f.path}\n${f.content}`).join('\n\n---\n\n');
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
  },
  // V26.2.0 — WRITE tools: criam entidades direto no journey_state.
  // Sem confirmação prévia pra criação (1 entidade nova não machuca).
  // Para destrutivas (delete/sobrescrever) — peça confirmação ANTES.
  {
    name: 'create_product',
    description: 'Cria um produto novo. Chame quando o user disser "cria produto" ou similar. Apenas name é obrigatório.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome do produto' },
        priceValue: { type: 'number', description: 'Valor numérico (ex: 497)' },
        ticket: { type: 'string', enum: ['Baixo', 'Médio', 'Alto'], description: 'Tier de ticket' },
        description: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_campaign',
    description: 'Cria uma campanha vinculada a um produto. Use list_state primeiro pra pegar productId se o user só deu o nome do produto.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da campanha' },
        productId: { type: 'number', description: 'ID do produto vinculado' },
        status: { type: 'string', enum: ['Ativa', 'Pausada', 'Em planejamento', 'Concluída'], description: 'Default: Em planejamento' },
        description: { type: 'string' }
      },
      required: ['name', 'productId']
    }
  },
  {
    name: 'create_action',
    description: 'Cria uma ação dentro de uma campanha. Channel, actionType, sector, funnel devem usar valores da KB (data-model.md).',
    input_schema: {
      type: 'object',
      properties: {
        campaignId: { type: 'number' },
        name: { type: 'string' },
        channel: { type: 'string', description: 'RD Station, Instagram Orgânico, Email, SDR, etc' },
        actionType: { type: 'string', description: 'Post, Nutrição, Webinar, LP, etc' },
        sector: { type: 'string', enum: ['Marketing', 'Vendas', 'CS'] },
        funnel: { type: 'string', enum: ['TOF', 'MOF', 'BOF'] },
        objective: { type: 'string' }
      },
      required: ['campaignId', 'name', 'channel', 'actionType', 'sector', 'funnel']
    }
  },
  {
    name: 'list_leads_filtered',
    description: 'Lista leads que casam com filtros estruturados. Use quando user pedir "lista homens de SP", "leads quentes em MOF", etc. Retorna até 50 leads com nome, email, idade, estado, score, temperature, tags.',
    input_schema: {
      type: 'object',
      properties: {
        sexo: { type: 'string', enum: ['feminino', 'masculino'] },
        idade_min: { type: 'number' },
        idade_max: { type: 'number' },
        estado: { type: 'string', description: 'Estado normalizado: "sao paulo", "rio de janeiro", etc' },
        score_min: { type: 'number' },
        temperatura: { type: 'string', enum: ['Quente', 'Morno', 'Frio'] },
        tag: { type: 'string', description: 'Tag comportamental tipo "#cta", "#open"' },
        has_email: { type: 'boolean' },
        has_phone: { type: 'boolean' },
        limit: { type: 'number', description: 'Default 20, máx 50' }
      },
      required: []
    }
  },
  {
    name: 'read_source_file',
    description: 'Lê um arquivo de código do sistema. Use APENAS quando user perguntar como algo funciona internamente. Limitado a src/* e api/*. Retorna no máximo 3000 caracteres (trunca se maior).',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Caminho relativo. Ex: "src/core/state.js" ou "api/djow-chat.js"' } },
      required: ['path']
    }
  }
];

// V26.2.0 — Lista de campos sigilosos no state que NUNCA podem ser expostos.
// Aplicado em execTool antes de retornar dados de state pra Claude.
const SECRET_PATHS = [
  'integrations.rd.crmPersonalToken',
  'integrations.rd.accessToken',
  'integrations.rd.refreshToken',
  'integrations.rd.clientSecret',
  'integrations.rd.crmOauth.accessToken',
  'integrations.rd.crmOauth.refreshToken',
  'integrations.rd.crmOauth.clientSecret'
];

function redactSecrets(obj, path = '') {
  if (obj == null) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item, i) => redactSecrets(item, `${path}.${i}`));
  const out = {};
  for (const key of Object.keys(obj)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (SECRET_PATHS.some(p => fullPath === p || fullPath.endsWith(p))) {
      out[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      out[key] = redactSecrets(obj[key], fullPath);
    } else {
      out[key] = obj[key];
    }
  }
  return out;
}

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

// V26.2.0 — Path normalizer pra read_source_file. Bloqueia ../, paths absolutos,
// e qualquer coisa fora de src/* ou api/*.
function safeReadSourcePath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return null;
  const cleaned = rawPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (cleaned.includes('..')) return null;
  if (!cleaned.startsWith('src/') && !cleaned.startsWith('api/') && !cleaned.startsWith('knowledge-base/')) return null;
  if (cleaned.includes('node_modules') || cleaned.startsWith('.env') || cleaned.includes('.git/')) return null;
  return path.join(__dirname, '..', cleaned);
}

// V26.0.0 — Implementação das tools (server-side).
// V26.2.0 — Adicionado suporte a write tools (create_*) que mutam Postgres.
// Retorna { result, stateMutation? }. stateMutation diz se tool modificou state.
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
      // V26.2.0 — WRITE tools: criam entidades. NÃO mutam state direto aqui —
      // retornam um descritor `_pendingWrite` que o handler aplica via Postgres update.
      case 'create_product': {
        const name = String(input.name || '').trim();
        if (!name) return { error: 'name é obrigatório' };
        const product = {
          id: Date.now() + Math.floor(Math.random() * 100),
          name,
          priceValue: Number(input.priceValue) || 0,
          price: input.price || `R$ ${(Number(input.priceValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          ticket: input.ticket || 'Médio',
          description: input.description || '',
          channels: [], okrs: [], kpis: [], flow: {},
          createdAt: new Date().toISOString()
        };
        return { _pendingWrite: { kind: 'create_product', payload: product }, created: product };
      }
      case 'create_campaign': {
        const name = String(input.name || '').trim();
        const productId = Number(input.productId);
        if (!name) return { error: 'name é obrigatório' };
        if (!productId) return { error: 'productId é obrigatório' };
        const product = (state.products || []).find(p => Number(p.id) === productId);
        if (!product) return { error: `Produto id=${productId} não existe. Use list/get pra ver IDs válidos.` };
        const campaign = {
          id: Date.now() + Math.floor(Math.random() * 100),
          name,
          productId,
          status: input.status || 'Em planejamento',
          description: input.description || '',
          startDate: '', endDate: '',
          okrs: [], kpis: [],
          createdAt: new Date().toISOString()
        };
        return { _pendingWrite: { kind: 'create_campaign', payload: campaign }, created: campaign };
      }
      case 'create_action': {
        const required = ['campaignId', 'name', 'channel', 'actionType', 'sector', 'funnel'];
        for (const f of required) {
          if (input[f] === undefined || input[f] === null || input[f] === '') {
            return { error: `Campo "${f}" é obrigatório` };
          }
        }
        const campaign = (state.campaigns || []).find(c => Number(c.id) === Number(input.campaignId));
        if (!campaign) return { error: `Campanha id=${input.campaignId} não existe.` };
        const action = {
          id: Date.now() + Math.floor(Math.random() * 100),
          campaignId: Number(input.campaignId),
          name: input.name,
          channel: input.channel,
          actionType: input.actionType,
          sector: input.sector,
          funnel: input.funnel,
          originSector: input.sector,
          originFunnel: input.funnel,
          destinationSector: input.sector,
          destinationFunnel: input.funnel,
          objective: input.objective || '',
          conversionObjective: '',
          expectedConversion: 25,
          mailingDefined: false,
          okrs: [], kpis: [], leads: [],
          flow: null, flowPath: [],
          scoreId: state.scores?.[0]?.id || 1,
          connected: false,
          connectionStatus: 'ready',
          status: 'Pronta para conectar',
          createdAt: new Date().toISOString()
        };
        return { _pendingWrite: { kind: 'create_action', payload: action }, created: action };
      }
      case 'list_leads_filtered': {
        const allLeads = (state.globalLeads || []).concat(
          (state.actions || []).flatMap(a => (a.leads || []).map(l => ({ ...l, _actionId: a.id })))
        );
        const filtered = allLeads.filter(l => {
          if (input.sexo && String(l.sexo || l.genero || '').toLowerCase() !== input.sexo) return false;
          if (input.idade_min != null && Number(l.idade || 0) < input.idade_min) return false;
          if (input.idade_max != null && Number(l.idade || 0) > input.idade_max) return false;
          if (input.estado) {
            const est = String(l.estado || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (!est.includes(input.estado.toLowerCase())) return false;
          }
          if (input.score_min != null && Number(l.globalScore || l.score || 0) < input.score_min) return false;
          if (input.temperatura && l.temperature !== input.temperatura) return false;
          if (input.tag) {
            const tags = [...(l.tags || []), ...(l.behaviorTags || [])];
            if (!tags.some(t => String(t).toLowerCase().includes(input.tag.toLowerCase().replace(/^#/, '')))) return false;
          }
          if (input.has_email && !l.email) return false;
          if (input.has_phone && !l.phone) return false;
          return true;
        }).slice(0, Math.min(input.limit || 20, 50));
        // Devolve dados mínimos pra Djow citar
        return {
          count: filtered.length,
          leads: filtered.map(l => ({
            name: l.name, email: l.email, idade: l.idade, estado: l.estado,
            sexo: l.sexo, score: l.globalScore || l.score,
            temperature: l.temperature, tags: (l.tags || []).slice(0, 6)
          }))
        };
      }
      case 'read_source_file': {
        const target = safeReadSourcePath(input.path);
        if (!target) return { error: 'Caminho não permitido. Use src/*, api/* ou knowledge-base/*.' };
        if (!fs.existsSync(target)) return { error: 'Arquivo não encontrado.' };
        try {
          const content = fs.readFileSync(target, 'utf8');
          if (content.length > 3000) {
            return { truncated: true, content: content.slice(0, 3000) + '\n... [truncado, total ' + content.length + ' chars]' };
          }
          return { content };
        } catch (err) {
          return { error: err.message };
        }
      }
      default:
        return { error: `Tool desconhecida: ${name}` };
    }
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

// V26.2.0 — Aplica um pending write no Postgres journey_state.
// Faz read-modify-write pra evitar perda de campos. Retorna ok bool.
async function applyStateWrite(db, userId, pendingWrite) {
  if (!db || !pendingWrite) return { ok: false };
  const { kind, payload } = pendingWrite;
  try {
    const r = await db.query('SELECT state_json FROM journey_state WHERE id = 1 LIMIT 1');
    const state = r.rows[0]?.state_json || {};
    if (kind === 'create_product') {
      state.products = Array.isArray(state.products) ? state.products : [];
      state.products.push(payload);
    } else if (kind === 'create_campaign') {
      state.campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
      state.campaigns.push(payload);
    } else if (kind === 'create_action') {
      state.actions = Array.isArray(state.actions) ? state.actions : [];
      state.actions.push(payload);
    } else {
      return { ok: false, message: 'kind desconhecido: ' + kind };
    }
    await db.query(
      'INSERT INTO journey_state (id, state_json, updated_at, updated_by_user_id) VALUES (1, $1, NOW(), $2) ON CONFLICT (id) DO UPDATE SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2',
      [state, userId]
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err.message };
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
  return `Você é o **Djow**, **Chief Revenue Operations** do LeadJourney.

## Sua identidade (V26.3.0)
Você não é um chatbot genérico. Você é um **CRO virtual** com domínio profundo de:
- Marketing Ops (demand gen, funil, attribution, lead scoring)
- Sales Ops (qualificação, forecasting, pipeline coverage, velocity)
- CS Ops (NRR, health score, lifecycle, churn analysis)
- Financial Ops (CAC, LTV, payback, burn, rule of 40)

Quando o user te procurar, ele espera **insight de operador**, não tutorial de Wikipedia. Use os frameworks da sua KB (\`revops/*.md\`) ativamente. Cite framework pelo nome quando aplicar.

## Sua função (V26.2.0 + V26.3.0)
Motor universal do LeadJourney pra qualquer operação que envolve:
- **Buscar** (filtros, queries de leads/campanhas/ações)
- **Editar/Criar** (produtos, campanhas, ações via tools de escrita)
- **Configurar** (settings de integrações)
- **Executar** (disparar, mover leads)
- **Gerir/Insights** (RevOps, CX, gargalos, recomendações)
- **Estratégia** (decisões de pricing, posicionamento, allocations entre canais, prioridades)

## Como criar entidades (Djow é a porta de criação)
Quando o user disser "cria produto X", "nova campanha pra Y", "adiciona ação Z", use as tools de escrita:
- \`create_product\`, \`create_campaign\`, \`create_action\`

REGRAS DE EXTRAÇÃO (CRÍTICAS pra economizar tokens):
1. Tente extrair TODOS os campos obrigatórios da mensagem do user em uma única passada.
2. Se FALTAR algum campo obrigatório, pergunte TODOS os faltantes de uma vez (não 1-a-1).
   Exemplo: "Pra criar a campanha preciso de: produto vinculado, nome. Manda os 2."
3. Para criação, **NÃO peça confirmação prévia** — execute direto. 1 entidade nova não machuca.
4. Para destrutivas (deletar, sobrescrever, reset): SEMPRE pergunte "Confirma X? (sim/não)" e espere a resposta.

## Sua personalidade
Direto, prático, sem floreio. Fala em português brasileiro casual mas técnico. Não puxa saco. Quando vê algo problemático, fala. Quando não tem certeza, admite.

**Como CRO experiente, vc DEVE**:
- Fazer perguntas de diagnóstico antes de dar recomendação simplista
- Citar números/benchmarks (não "muito" ou "pouco")
- Apontar trade-offs em decisões (raramente existe "a resposta certa")
- Conectar dados da operação (use \`get_*\`/\`list_*\` tools) com frameworks da KB
- Quando o user tá indo numa direção contra-intuitiva, **discorda com base**

## Contexto do user
- Username: ${user?.username || 'desconhecido'}
- Master: ${user?.isMaster ? 'sim' : 'não'}
- ${accountSummary}

## ⚠️ Informações SIGILOSAS (NUNCA expor)
Se o user pedir, responda educadamente: **"Não posso te mostrar essa informação — é sigilosa do sistema."** Itens proibidos:
- Senhas de qualquer usuário (password_hash, plain)
- Env vars: ANTHROPIC_API_KEY, JWT_SECRET, MASTER_PASSWORD, DATABASE_URL, RD_WEBHOOK_SECRET
- Tokens em integrations.rd: crmPersonalToken, accessToken, refreshToken, clientSecret (também em crmOauth.*)
- Código que vc sabe ser sensível (chave privada inline, JWT secret hardcoded, etc.)

Códigos de business logic do sistema (src/*, api/*) PODEM ser lidos via tool \`read_source_file\` quando o user perguntar como algo funciona.

## ⚠️ NÃO faz
- Editar código-fonte do sistema (você não tem permissão de escrita em src/* ou api/*)
- Coisas fora do escopo do LeadJourney (gerar imagens, executar comandos no SO, etc.)
- Expor dados sigilosos (ver lista acima)

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
  let stateModified = false; // V26.2.0 — vira true se alguma write tool rodou
  const entitiesCreated = []; // V26.2.0 — descrição pro toast frontend
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

    // V26.2.0 — Executa tools + aplica pending writes ao Postgres
    messages.push({ role: 'assistant', content: resp.content });
    const toolResults = [];
    for (const tu of toolUses) {
      const result = execTool(tu.name, tu.input || {}, state);
      // Se tool retornou _pendingWrite, aplica no Postgres e atualiza state local
      if (result && result._pendingWrite) {
        const writeRes = await applyStateWrite(req.db, req.user.id, result._pendingWrite);
        if (writeRes.ok) {
          stateModified = true;
          entitiesCreated.push({ kind: result._pendingWrite.kind, payload: result.created });
          // Atualiza state local em memória pra próximas tools verem o novo registro
          if (result._pendingWrite.kind === 'create_product') {
            state.products = state.products || [];
            state.products.push(result.created);
          } else if (result._pendingWrite.kind === 'create_campaign') {
            state.campaigns = state.campaigns || [];
            state.campaigns.push(result.created);
          } else if (result._pendingWrite.kind === 'create_action') {
            state.actions = state.actions || [];
            state.actions.push(result.created);
          }
          // Substitui o resultado por algo limpo (sem _pendingWrite) pra mandar pra Claude
          result.persisted = true;
        } else {
          result.persisted = false;
          result.persistError = writeRes.message || 'erro ao salvar';
        }
        delete result._pendingWrite;
      }
      // V26.2.0 — Redact segredos antes de mandar dados pra Claude
      const safeResult = redactSecrets(result);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(safeResult)
      });
    }
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
    stateModified,           // V26.2.0 — frontend faz pull do state remoto
    entitiesCreated,         // V26.2.0 — pro toast informativo
    usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut, costUsd: costUsd.toFixed(4) }
  });
};
