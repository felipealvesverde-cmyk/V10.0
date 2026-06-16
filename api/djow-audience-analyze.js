// V38.1.40 — POST /api/djow-audience-analyze
//
// Djow analisa o quadro de audiência (Step 3 do wizard) e devolve um
// comentário em prosa de consultor RevOps + opcionalmente sinaliza
// dados faltantes / dores típicas da combinação escolhida.
//
// Body: { productName, productDescription?, modeloNegocio, modeloOperacional,
//         schemaSummary, leadsSummary? }
//   schemaSummary é montado no frontend a partir do AudienceFusionEngine
//   pra reduzir tokens (lista compacta dos campos por camada).
//   leadsSummary é uma amostra AGREGADA, sem PII — null/empty se o produto
//   ainda não importou leads.
//
// Resposta: { ok: true, analise: string, model, tokens_in, tokens_out }
//
// Modelo: Haiku 4.5 (rápido, barato). A KB de audiência é embedded em
// 2 blocos cacheados via Anthropic Prompt Caching.

const fs = require('fs');
const path = require('path');
const aiResolver = require('../lib/ai-resolver');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';

// Cache em memória da KB (lê do disco no startup).
let _KB_AUDIENCE_CACHE = null;
function loadAudienceKb() {
  if (_KB_AUDIENCE_CACHE !== null) return _KB_AUDIENCE_CACHE;
  const dir = path.join(__dirname, '..', 'knowledge-base', 'djow');
  const out = { carta: '', composicional: '' };
  try {
    out.carta = fs.readFileSync(path.join(dir, 'audiencia-carta-dominio.md'), 'utf8');
  } catch (_) {}
  try {
    out.composicional = fs.readFileSync(path.join(dir, 'audiencia-kb-composicional.md'), 'utf8');
  } catch (_) {}
  _KB_AUDIENCE_CACHE = out;
  return _KB_AUDIENCE_CACHE;
}

const SYSTEM_IDENTITY = `Você é o **Djow**, **Revenue Operations Chief Architect** do LeadJourney.

Neste momento você está atuando como **agente de Audiência** dentro do wizard "Definir Audiência" que o cliente está preenchendo pra cadastrar um produto. Você acabou de receber o quadro PA/ICP/BP fundido a partir do modelo de Negócio e do modelo Operacional que ele escolheu. Sua missão aqui é comentar esse quadro em linguagem de consultor sênior de RevOps falando com um gestor de PME.

Você NUNCA cita nome técnico de campo, ID, tag interna, schema ou qualquer engrenagem do LJ. Fala em padrão agregado, nunca expõe dado de lead nominal. Tom: direto, sistêmico, sem floreio, sem "vamos lá", sem "olá".

Princípio: a ausência de um sinal quase nunca significa "público ruim" — significa "ainda não coletamos esse dado". Quando algo estiver faltando, aponte a origem do dado faltante.

Formato da resposta (rigoroso):
- 3 a 5 frases corridas, em prosa. Não use bullets, não use markdown. Não use emojis.
- Frase 1: resuma a combinação escolhida explicando o que ela implica (espinha + pele) em 1 linha.
- Frase 2: aponte O CAMPO MAIS DECISIVO desse quadro pra essa combinação e por quê.
- Frase 3-4: comente UMA tensão, risco ou tipo de erro clássico dessa combinação. Se a combinação for rara, avise e peça confirmação. Se vier amostra de leads, comente padrão observado em padrão agregado.
- Frase 5 (opcional): sugira UM próximo passo concreto pra coletar dado faltante ou refinar o quadro.

Pragmatismo absoluto: nada de "considere", "talvez seria interessante". Aponte UM insight central. Cite o nome humano dos campos quando relevante (ex: "cargo decisor", "geo entregável"), não os identificadores em yaml.`;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = Number(req.user.sub || req.user.id);
  const body = req.body || {};
  const productName = String(body.productName || '').trim();
  const productDescription = String(body.productDescription || '').trim();
  const modeloNegocio = String(body.modeloNegocio || '').trim().toLowerCase();
  const modeloOperacional = String(body.modeloOperacional || '').trim().toLowerCase();
  const schemaSummary = String(body.schemaSummary || '').trim();
  const leadsSummary = String(body.leadsSummary || '').trim();

  if (!productName) return res.status(400).json({ ok: false, message: 'productName obrigatório.' });
  if (!modeloNegocio || !modeloOperacional) return res.status(400).json({ ok: false, message: 'Modelo de negócio e operacional obrigatórios.' });
  if (!schemaSummary) return res.status(400).json({ ok: false, message: 'schemaSummary obrigatório.' });

  // Resolve key Anthropic (regra ai-resolver dual-path)
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
    console.error('[djow-audience-analyze] ai-resolver fail:', err.message);
    return res.status(500).json({ ok: false, message: 'Erro ao resolver chave Anthropic.' });
  }

  const kb = loadAudienceKb();
  const userMessage = `# Contexto do produto

- **Nome do produto:** ${productName}
${productDescription ? `- **Descrição:** ${productDescription}\n` : ''}
- **Modelo de negócio escolhido:** ${modeloNegocio.toUpperCase()}
- **Modelo operacional escolhido:** ${modeloOperacional.toUpperCase()}

# Quadro fundido (resumo do que o motor montou)

${schemaSummary.slice(0, 3000)}

# Amostra agregada de leads do RD (sem PII)

${leadsSummary ? leadsSummary.slice(0, 1500) : '(o cliente ainda não importou leads do RD para este produto)'}

# Sua tarefa

Comente o quadro acima seguindo o formato definido no system prompt (3 a 5 frases, prosa, sem bullets, sem markdown). Use o contexto da carta e da KB composicional pra ancorar a fala. Cite o nome humano dos campos quando relevante.`;

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
          { type: 'text', text: SYSTEM_IDENTITY, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `# Carta de domínio (intuição da fusão)\n\n${kb.carta}`, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `# KB composicional (estrutura dos átomos + motor de fusão)\n\n${kb.composicional}`, cache_control: { type: 'ephemeral' } }
        ],
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[djow-audience-analyze] Claude error:', data);
      return res.status(502).json({ ok: false, message: data?.error?.message || `HTTP ${r.status}` });
    }
    const text = (data.content || []).map(c => c.text || '').join('').trim();
    return res.status(200).json({
      ok: true,
      analise: text || 'Sem análise dessa vez. Tente revisar a combinação escolhida.',
      model: data.model || MODEL,
      tokens_in: data.usage?.input_tokens || 0,
      tokens_out: data.usage?.output_tokens || 0,
      cache_read_tokens: data.usage?.cache_read_input_tokens || 0
    });
  } catch (err) {
    console.error('[djow-audience-analyze]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
