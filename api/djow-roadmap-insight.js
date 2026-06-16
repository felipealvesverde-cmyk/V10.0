// V38.1.51 — POST /api/djow-roadmap-insight
//
// Djow lê a lista de ações da campanha (com fluxo + taxa de cada etapa)
// e devolve 4-6 frases pragmáticas em prosa, ação por ação, apontando
// pontos de atenção (handoffs perdidos, ações ofuscadas, gargalo de etapa).
//
// Body: { campaignName, campaignStatus, productName, actionsCount, actionsSummary }
//   actionsSummary é uma lista compacta de strings no formato:
//     "- <nome> | canal: <X> | fluxo: <setor TOF> (X/Y, Z%) → ... | conversão final: W%"
//
// Resposta: { ok: true, insight: string, model, tokens_in, tokens_out }

const aiResolver = require('../lib/ai-resolver');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_IDENTITY = `Você é o **Djow**, **Revenue Operations Chief Architect** do LeadJourney.

Neste momento você está atuando como **agente de Roadmap de Campanha**. O usuário está olhando o quadro de ações de uma campanha (cada ação atravessando setores Marketing → Vendas → CS pelos funis TOF/MOF/BOF) e quer um insight pragmático sobre o que está rolando.

Você lê ação por ação e aponta pontos de atenção concretos: gargalo de etapa, handoff entre setores que está derrubando volume, ação ofuscada que poderia estar performando melhor, ou um padrão que se repete entre ações.

Você NUNCA cita ID interno, IDs de stage no formato "marketing-tof", schema, ou qualquer engrenagem do LJ. Fala em padrão de gestor de RevOps falando com gestor de PME. Tom: direto, sistêmico, sem floreio, sem "vamos lá", sem "olá".

Formato da resposta (rigoroso):
- 4 a 6 frases corridas em prosa. Sem bullets, sem markdown, sem emojis.
- Comece SEMPRE pela ação ou par origem→destino mais crítico (menor taxa ou maior perda absoluta).
- Cite ao menos UMA ação pelo nome (entre aspas) — não fale só em abstrato.
- Aponte UM padrão entre as ações se houver (ex: "as duas ações de Vendas BOF estão presas no mesmo gargalo de proposta").
- Encerre com UM próximo passo concreto, pragmático (ex: "vale revisar a abordagem de SDR na transição Marketing BOF → Vendas TOF, onde X de cada Y leads desistem").

Pragmatismo absoluto: nada de "considere", "talvez seria interessante". Aponte pontos concretos. Cite números absolutos quando ajudar.`;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = Number(req.user.sub || req.user.id);
  const body = req.body || {};
  const campaignName = String(body.campaignName || '').trim();
  const campaignStatus = String(body.campaignStatus || 'Ativa').trim();
  const productName = String(body.productName || '').trim();
  const actionsCount = Number(body.actionsCount || 0);
  const actionsSummary = String(body.actionsSummary || '').trim();

  if (!campaignName) return res.status(400).json({ ok: false, message: 'campaignName obrigatório.' });
  if (!actionsSummary) return res.status(400).json({ ok: false, message: 'actionsSummary obrigatório.' });

  let apiKey = null;
  try {
    const masterDb = req.app?.get?.('pgPool') || req.db;
    const keyResult = await aiResolver.resolveAnthropicKey(masterDb, {
      id: userId,
      isMaster: Boolean(req.user.isMaster)
    });
    if (!keyResult.ok) {
      const status = keyResult.requiresTermsAcceptance ? 402 : 503;
      return res.status(status).json({ ok: false, message: keyResult.message || 'Sem chave Anthropic configurada.', requiresTermsAcceptance: keyResult.requiresTermsAcceptance });
    }
    apiKey = keyResult.apiKey;
  } catch (err) {
    console.error('[djow-roadmap-insight] ai-resolver fail:', err.message);
    return res.status(500).json({ ok: false, message: 'Erro ao resolver chave Anthropic.' });
  }

  const userMessage = `# Campanha sob análise

- **Nome:** ${campaignName}
- **Status:** ${campaignStatus}
${productName ? `- **Produto vinculado:** ${productName}\n` : ''}- **Total de ações:** ${actionsCount}

# Ações da campanha (fluxo + taxa por etapa)

${actionsSummary.slice(0, 4000)}

# Como ler o fluxo

Cada ação é uma sequência de etapas no formato "<setor> <funil> (convertidos/impactados, taxa%)". As setas separam etapas. A "conversão final" é a taxa fim-a-fim da ação (do impacto inicial até o destino).

Quando uma etapa tem taxa baixa, ela é um gargalo. Quando a transição de um setor pra outro perde muito (ex: Marketing BOF → Vendas TOF com queda grande), é um handoff crítico.

# Sua tarefa

Comente o quadro de ações no formato definido no system prompt (4 a 6 frases, prosa, sem bullets, sem markdown). Foque no que pesa mais e proponha 1 próximo passo concreto.`;

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
        max_tokens: 600,
        system: [
          { type: 'text', text: SYSTEM_IDENTITY, cache_control: { type: 'ephemeral' } }
        ],
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[djow-roadmap-insight] Claude error:', data);
      return res.status(502).json({ ok: false, message: data?.error?.message || `HTTP ${r.status}` });
    }
    const text = (data.content || []).map(c => c.text || '').join('').trim();
    return res.status(200).json({
      ok: true,
      insight: text || 'Sem insight dessa vez. Tente revisar as ações da campanha.',
      model: data.model || MODEL,
      tokens_in: data.usage?.input_tokens || 0,
      tokens_out: data.usage?.output_tokens || 0
    });
  } catch (err) {
    console.error('[djow-roadmap-insight]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
