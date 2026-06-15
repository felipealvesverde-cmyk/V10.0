// V38.1.0 — POST /api/djow-health-analysis
//
// Endpoint dedicado pro Djow analisar Saúde de um produto. Não usa o loop
// completo do djow-chat — recebe contexto pré-computado pelo frontend e
// chama Claude API com prompt focado, retornando JSON estruturado.
//
// Body:
//   { productId, productName, productType, revenueModel, score, tier,
//     gargalo, fatores: { eficacia, cobertura, krs, resultado } }
//
// Resposta:
//   { ok, byDimension: { eficacia, cobertura, krs, resultado }, verdict }

const { resolveAnthropicKey } = require('../lib/ai-resolver');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-6';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const body = req.body || {};
  if (!body.productId || !body.fatores) {
    return res.status(400).json({ ok: false, message: 'productId + fatores obrigatórios.' });
  }

  let apiKey;
  try {
    apiKey = await resolveAnthropicKey(req);
  } catch (err) {
    return res.status(402).json({ ok: false, message: `IA não disponível: ${err.message}` });
  }
  if (!apiKey) return res.status(402).json({ ok: false, message: 'Sem chave Anthropic disponível.' });

  const systemPrompt = `Você é Djow, mentor RevOps do LeadJourney. Tom: direto, sem rodeio, mentor exigente — NÃO diplomático. Quando algo está ruim, fala que está ruim. Identifica o gargalo central e cobra ação acionável.

Sobre Saúde do Produto: é um score 0-100 que combina 4 dimensões:
- Eficácia (E, peso 40%): % de tasks concluídas sobre tasks vinculadas a ações
- Cobertura (C, peso 40%): das 3 áreas comerciais (Marketing/Vendas/CS), quantas têm KR confirmado
- KRs (K, MULTIPLICADOR): média ponderada do status dos KRs confirmados. Sem KR confirmado, Saúde = 0.
- Resultado (R, peso 20%): vendas realizadas / meta consolidada das ofertas

Fórmula: Saúde = K × (0.4 × E + 0.4 × C + 0.2 × R) × 100

Conceitos importantes:
- "Dinheiro na mesa": quando o produto vende bem mas não executa tudo, ou cobre só 1 das 3 áreas. Tá ganhando, podia ganhar muito mais.
- "Estratégia ruim": executa tudo, KRs em dia, mas não vende. Operação OK mas a aposta está errada.
- "Plano só no papel": tem KR cadastrado mas ninguém persegue.

Tarefa: dado o contexto JSON abaixo, retorne APENAS um JSON puro (sem markdown, sem texto antes/depois) com a estrutura:
{
  "byDimension": {
    "eficacia": "Análise da Eficácia, 2-3 linhas",
    "cobertura": "Análise da Cobertura, 2-3 linhas",
    "krs": "Análise dos KRs, 2-3 linhas",
    "resultado": "Análise do Resultado, 2-3 linhas"
  },
  "verdict": "Veredito final: 1 parágrafo de diagnóstico DIRETO + lista numerada com 3-4 ações pros próximos 7 dias. Tom giro de faca."
}

Não invente dados. Use SÓ o que está no contexto JSON. Se algo estiver zerado, fale o porquê e o que fazer pra subir.`;

  const userMessage = `Analise a Saúde do produto "${body.productName}".

Contexto:
${JSON.stringify({
  product: { name: body.productName, type: body.productType, revenueModel: body.revenueModel },
  score: body.score,
  tier: body.tier,
  gargalo: body.gargalo,
  fatores: body.fatores
}, null, 2)}

Retorne o JSON estruturado conforme instruído. Direto e sem rodeios.`;

  try {
    const apiRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const apiData = await apiRes.json();
    if (!apiRes.ok) {
      console.error('[djow-health-analysis] Anthropic erro', apiData);
      return res.status(502).json({ ok: false, message: apiData.error?.message || 'Falha na chamada Claude.' });
    }
    const text = apiData.content?.find(c => c.type === 'text')?.text || '';
    // Extrai JSON (modelo às vezes envolve em ```json ... ```)
    let jsonStr = text.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1];
    let parsed;
    try { parsed = JSON.parse(jsonStr); }
    catch (parseErr) {
      console.error('[djow-health-analysis] JSON parse falhou. Resposta:', text);
      return res.status(502).json({ ok: false, message: 'Djow respondeu fora do formato esperado. Tente de novo.' });
    }
    return res.status(200).json({
      ok: true,
      byDimension: parsed.byDimension || {},
      verdict: parsed.verdict || ''
    });
  } catch (err) {
    console.error('[djow-health-analysis]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
