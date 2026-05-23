// V32.8.3 — POST /api/djow-revops-suggest
// One-shot Djow contextual à tab do RevOps Whitelabel. Versão enxuta do
// djow-chat.js: sem tools, sem histórico, sem chat — só uma análise crua
// da configuração do RevOps + métricas, retornando 1 insight acionável.
//
// Body: { product_id, tab_id, summary }
//   summary é montado no frontend (com cfg + métricas) pra reduzir tokens
//   trafegados — backend não precisa puxar state do DB.
//
// Resposta: { ok: true, suggestion: string, model, tokens_used? }
//
// Custo: Haiku 4.5 (mais barato, ~3s). Cliente clica explicitamente "Pedir
// análise" — não dispara automático em todo render.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';

const TAB_PROMPTS = {
  costs: 'A tab atual é CUSTOS. Olhe os grupos e itens cadastrados. Aponte: (a) qual gasto chama atenção pelo tamanho relativo; (b) o que está faltando que você esperaria ver pra esse modelo de negócio; (c) qualquer custo "vazio" ou suspeito (item sem dono, R$0, nome genérico).',
  offers: 'A tab atual é OFERTAS. Olhe ofertas + ticket médio. Aponte: (a) se há diversificação saudável de ofertas ou um único ponto único de falha; (b) se o ticket parece coerente com o segmento; (c) sugestão de oferta complementar pra subir TM.',
  result: 'A tab atual é RESULTADO. Compare previsto × real. Aponte: (a) gap entre previsão e execução; (b) CAC × Ticket — se CAC se aproxima do ticket, alerta vermelho; (c) próxima alavanca pra ajustar.',
  revops: 'A tab atual é REVOPS KPIs. Olhe MCU, MSU (breakeven), KPIs custom. Aponte: (a) se o MSU é viável dado o pipeline atual; (b) margem de contribuição saudável ou apertada; (c) sugestão de 1 KPI custom que valeria a pena criar pra essa operação.',
  dre:    'A tab atual é DRE. Olhe o cascateamento Bruto → EBITDA. Aponte: (a) qual linha (Variáveis, G&A, Aquisição) está pesando mais; (b) margem EBITDA dentro/fora do saudável (>25%); (c) cirurgia recomendada.'
};

const SYSTEM = `Você é o **Djow**, **Revenue Operations Chief Architect** do LeadJourney.

Você não é um chatbot. Você é um operador sistêmico de receita que olha pra uma operação real e diz o que FAZ continuidade ou QUEBRA continuidade.

REGRAS DESTE PROMPT (one-shot, sem chat):
- Resposta TÊM 3 a 5 frases. Nem mais, nem menos.
- PT-BR técnico, direto, sem floreio. Não puxe saco. Não comece com "Olá" / "Vamos lá".
- Aponte UM insight acionável principal — não liste 5 coisas genéricas.
- Cite NÚMEROS específicos da configuração quando relevante (R$ X, Y%, etc.).
- Se a operação está bem configurada pra essa tab, fale isso e sugira o próximo passo lógico.
- Se vê algo "vazio" (item sem valor, KR sem ação, custo sem dono), aponte como "no-empty-task violation".

Princípios cravados (sempre presentes):
- Receita nasce da continuidade operacional, não de marketing/vendas isolados.
- Todo número/custo/KPI precisa ter: dono, operação, continuidade, impacto financeiro.
- CAC sem contexto operacional é número morto.
- Forecast = leitura operacional, não chute.
- Margem EBITDA saudável: >25%.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return res.status(503).json({ ok: false, message: 'ANTHROPIC_API_KEY não configurada no Railway.' });
  }

  const tabId = String(req.body?.tab_id || '').toLowerCase();
  const summary = String(req.body?.summary || '').trim();
  if (!summary) return res.status(400).json({ ok: false, message: 'summary obrigatório.' });
  const tabPrompt = TAB_PROMPTS[tabId];
  if (!tabPrompt) return res.status(400).json({ ok: false, message: `tab_id inválido: ${tabId}` });

  const userMessage = `${tabPrompt}\n\nResumo do RevOps deste produto:\n\`\`\`\n${summary.slice(0, 4000)}\n\`\`\`\n\nDê seu insight de 3-5 frases.`;

  try {
    const r = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[djow-revops-suggest] Claude error:', data);
      return res.status(502).json({ ok: false, message: data?.error?.message || `HTTP ${r.status}` });
    }
    const text = (data.content || []).map(c => c.text || '').join('').trim();
    return res.status(200).json({
      ok: true,
      suggestion: text || 'Sem sugestão dessa vez — tente reformular ou cadastrar mais dados.',
      model: data.model || MODEL,
      tokens_in: data.usage?.input_tokens || 0,
      tokens_out: data.usage?.output_tokens || 0
    });
  } catch (err) {
    console.error('[djow-revops-suggest]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
