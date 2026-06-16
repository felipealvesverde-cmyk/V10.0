// V38.1.46 — POST /api/djow-audience-collect-hint
//
// Djow recebe contexto de um grupo de campos faltando e a estratégia
// associada, e devolve uma sugestão PERSONALIZADA pro tenant — em vez
// da sugestão estática hardcoded no AudienceCollectionAdvisor.
//
// Body: {
//   strategyKey,    // 'formulario_rd' | 'tag_manual' | 'webhook_produto' | etc
//   fields: [{key, label, type}],
//   productName,
//   modeloNegocio, modeloOperacional,
//   tenantContext?: { hasRdForms: bool, hasTagsActive: bool, leadsSample: string }
// }
//
// Response: { ok, hint, model, tokens_in, tokens_out }

const fs = require('fs');
const path = require('path');
const aiResolver = require('../lib/ai-resolver');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';

let _KB_AUDIENCE_CACHE = null;
function loadAudienceKb() {
  if (_KB_AUDIENCE_CACHE !== null) return _KB_AUDIENCE_CACHE;
  const dir = path.join(__dirname, '..', 'knowledge-base', 'djow');
  const out = { carta: '', composicional: '' };
  try { out.carta = fs.readFileSync(path.join(dir, 'audiencia-carta-dominio.md'), 'utf8'); } catch (_) {}
  try { out.composicional = fs.readFileSync(path.join(dir, 'audiencia-kb-composicional.md'), 'utf8'); } catch (_) {}
  _KB_AUDIENCE_CACHE = out;
  return _KB_AUDIENCE_CACHE;
}

const STRATEGY_DESCRIPTIONS = {
  formulario_rd:   'pergunta extra no formulário de captura do RD Station',
  tag_manual:      'tag aplicada pelo time comercial durante interação com o lead',
  qualificacao_rd: 'qualificação manual do lead no RD (MQL/SQL/Oportunidade)',
  webhook_produto: 'webhook do produto do cliente disparando evento pro RD',
  enrichment:      'enrichment externo via Apollo/Clearbit (ainda não ativo no LJ)',
  comportamento:   'tracker LJ + eventHistory (dado comportamental)',
  automatico:      'campo populado automaticamente pelo RD'
};

const SYSTEM = `Você é o **Djow**, agente de Audiência do LeadJourney. Neste momento você está dando uma SUGESTÃO DE COLETA — o cliente acabou de ver no drill-down do ICP que vários campos do quadro estão faltando, e quer saber COMO COLETAR esses dados.

Sua tarefa: receber 1 estratégia de coleta + lista de campos afetados + contexto do tenant, e devolver uma sugestão DIRETA E ACIONÁVEL em prosa.

Formato:
- 3 a 5 frases, prosa, sem bullets, sem markdown.
- Frase 1: nomeie a estratégia em linguagem humana e o que ela resolve aqui.
- Frase 2-3: dê o artefato concreto. Se for formulário, escreva as PERGUNTAS exatas. Se for tag manual, escreva o SCRIPT do SDR. Se for webhook, indique O QUE deve disparar o evento (sem código — só conceito).
- Frase 4: uma ressalva ou cuidado (custo, risco, dependência).
- Frase 5 (opcional): próximo passo concreto que o cliente pode dar HOJE.

Regras:
- Não use jargão técnico de schema. Cite o nome humano dos campos.
- Mencione a combinação Negócio × Operacional pra contextualizar.
- Lembre o cliente: ausência de dado raramente significa "público ruim" — é falta de coleta.
- Tom: consultor sênior de RevOps, sem floreio, sem "olá".`;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = Number(req.user.sub || req.user.id);
  const body = req.body || {};
  const strategyKey = String(body.strategyKey || '').trim();
  const fields = Array.isArray(body.fields) ? body.fields.slice(0, 15) : [];
  const productName = String(body.productName || '').trim() || 'Produto';
  const modeloNegocio = String(body.modeloNegocio || '').toLowerCase();
  const modeloOperacional = String(body.modeloOperacional || '').toLowerCase();

  if (!strategyKey) return res.status(400).json({ ok: false, message: 'strategyKey obrigatório.' });
  if (!fields.length) return res.status(400).json({ ok: false, message: 'fields obrigatório.' });

  let apiKey = null;
  try {
    const masterDb = req.app?.get?.('pgPool') || req.db;
    const keyResult = await aiResolver.resolveAnthropicKey(masterDb, {
      id: userId,
      isMaster: Boolean(req.user.isMaster)
    });
    if (!keyResult.ok) {
      const status = keyResult.requiresTermsAcceptance ? 402 : 503;
      return res.status(status).json({ ok: false, message: keyResult.message || 'Sem chave Anthropic.', requiresTermsAcceptance: keyResult.requiresTermsAcceptance });
    }
    apiKey = keyResult.apiKey;
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Erro ao resolver chave Anthropic.' });
  }

  const kb = loadAudienceKb();
  const fieldsList = fields.map(f => `- ${f.label || f.key} (${f.type === 'fit' ? 'precisa bater critério' : 'basta existir'})`).join('\n');
  const userMessage = `# Contexto

Produto: **${productName}**
Combinação: ${modeloNegocio.toUpperCase()} × ${modeloOperacional.toUpperCase()}
Estratégia de coleta: **${STRATEGY_DESCRIPTIONS[strategyKey] || strategyKey}**

# Campos afetados (${fields.length})

${fieldsList}

# Sua tarefa

Comente em 3-5 frases (prosa, sem bullets) COMO coletar esses dados via essa estratégia, gerando um artefato pronto (pergunta exata pro formulário, script do SDR, ou conceito do evento do webhook). Use a Carta de domínio e a KB composicional pra ancorar a fala — sem citar nome técnico de campo.`;

  try {
    const r = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': 'prompt-caching-2024-07-31'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: [
          { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `# Carta de domínio (intuição da fusão)\n\n${kb.carta}`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `# KB composicional (estrutura dos átomos + motor de fusão)\n\n${kb.composicional}`, cache_control: { type: 'ephemeral' } }
        ],
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ ok: false, message: data?.error?.message || `HTTP ${r.status}` });
    }
    const text = (data.content || []).map(c => c.text || '').join('').trim();
    return res.status(200).json({
      ok: true,
      hint: text || 'Sem sugestão dessa vez — tente novamente.',
      model: data.model || MODEL,
      tokens_in: data.usage?.input_tokens || 0,
      tokens_out: data.usage?.output_tokens || 0,
      cache_read_tokens: data.usage?.cache_read_input_tokens || 0
    });
  } catch (err) {
    console.error('[djow-audience-collect-hint]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
