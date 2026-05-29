// V35.1.1 — POST /api/djow-checkout-chat
// Djow assistant pra Tab Checkout. 3 ações:
//
//   action='summary'    → 2-3 frases sobre a operação atual
//   action='suggestions' → 1-2 perguntas contextuais (anomalias detectadas)
//   action='ask'        → resposta a uma pergunta livre
//
// Contexto enviado: agregados + top 10 transações + top 10 produtos (médio).
// Cliente envia: { action, context, question?, history? }
//
// Fresh por sessão — o frontend mantém o histórico em state e envia em cada turno.
// Não persiste em DB.

const { resolveAnthropicKey } = require('../lib/ai-resolver');

const MODEL = 'claude-haiku-4-5-20251001'; // econômico, latência baixa, OK pra resumo + Q&A simples
const MAX_TOKENS = 600;

function buildSystemPrompt() {
  return `Você é o Djow, assistente operacional do LeadJourney especializado em checkout/vendas Hotmart.

Seu papel:
- Responder em português, conciso, objetivo, ZERO marketing fluff.
- Olhar os dados de transações que recebeu e tirar inferências úteis pra operação.
- Sinalizar anomalias (chargeback alto, queda de conversão, ticket médio caindo, etc).
- Sugerir ações práticas quando perguntado, sem inventar dados que não estão no contexto.
- Se a pergunta não for sobre checkout/vendas, redirecione com elegância: "Sou especialista em checkout, te ajudo melhor se a pergunta for sobre vendas, produtos ou clientes."

Tom: frio-analítico, como Geraldo (UX ops) cruzado com Leo (precisão). Sem exclamações, sem emojis. Frases curtas.
Nunca finja saber dado que não está no contexto. Se faltar, peça.`;
}

function compactContext(ctx = {}) {
  const k = ctx.kpis || {};
  const fmtBRL = c => 'R$ ' + (Number(c || 0) / 100).toLocaleString('pt-BR');
  const lines = [
    `Período: últimos ${ctx.period?.days || 30} dias`,
    `Sub-tab ativa: ${ctx.activeSubTab === 'all' ? 'Todos produtos' : `Produto ${ctx.activeSubTab}`}`,
    '',
    'KPIs:',
    `- Receita: ${fmtBRL(k.totalRevenueCents)}`,
    `- Vendas aprovadas: ${k.approvedCount || 0}`,
    `- Ticket médio: ${fmtBRL(k.avgTicketCents)}`,
    `- Comissão paga: ${fmtBRL(k.totalCommissionCents)}`,
    `- Boletos pendentes: ${k.billetCount || 0}`,
    `- Reembolsadas: ${k.refundedCount || 0}`,
    `- Chargebacks: ${k.chargebackCount || 0}`,
    `- Canceladas: ${k.canceledCount || 0}`
  ];

  const top = (ctx.products || []).slice(0, 10);
  if (top.length) {
    lines.push('', 'Top produtos por volume:');
    for (const p of top) {
      lines.push(`- ${p.productName}: ${p.purchaseCount} venda(s), ${fmtBRL(p.revenueCents)}`);
    }
  }

  const tx = (ctx.transactions || []).slice(0, 10);
  if (tx.length) {
    lines.push('', 'Últimas transações (amostra):');
    for (const t of tx) {
      const value = fmtBRL(t.transaction_value_cents);
      const date = t.occurred_at ? new Date(t.occurred_at).toLocaleDateString('pt-BR') : '?';
      lines.push(`- ${date} · ${value} · ${t.purchase_status} · ${t.product_name || '?'}`);
    }
  }

  const series = (ctx.series || []).slice(-7);
  if (series.length) {
    lines.push('', 'Últimos 7 dias (data → vendas, receita):');
    for (const s of series) {
      lines.push(`- ${s.day}: ${s.approved} vendas, ${fmtBRL(s.revenueCents)}`);
    }
  }

  return lines.join('\n');
}

function buildUserPrompt(action, ctx, question, history) {
  const contextBlock = compactContext(ctx);

  if (action === 'summary') {
    return `${contextBlock}

Dado o cenário acima, escreva um resumo de 2-3 frases sobre a operação. Aponte a tendência geral e 1 destaque (positivo ou negativo). Sem marketing, direto ao ponto.`;
  }

  if (action === 'suggestions') {
    return `${contextBlock}

Dado o cenário acima, gere 2 perguntas curtas (até 8 palavras cada) que o operador deveria estar se perguntando AGORA, baseado em anomalias ou pontos de atenção que você detecta. Retorne SOMENTE as 2 perguntas, uma por linha, sem numeração nem prefixo.`;
  }

  // action === 'ask'
  let convo = '';
  if (Array.isArray(history) && history.length) {
    convo = '\n\nConversa anterior:\n' + history.slice(-6).map(m => `${m.role === 'user' ? 'Operador' : 'Djow'}: ${m.text}`).join('\n');
  }
  return `${contextBlock}${convo}

Operador pergunta: ${question}

Responda de forma direta. Se os dados não permitirem responder com certeza, diga.`;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const action = String(body.action || 'summary').toLowerCase();
  if (!['summary', 'suggestions', 'ask'].includes(action)) {
    return res.status(400).json({ ok: false, message: 'action deve ser summary|suggestions|ask.' });
  }
  const question = String(body.question || '').trim();
  if (action === 'ask' && !question) {
    return res.status(400).json({ ok: false, message: 'question obrigatória pra ask.' });
  }

  // Resolve chave Anthropic
  const userInfo = { id: Number(req.user.sub || req.user.id), isMaster: Boolean(req.user.isMaster) };
  const keyRes = await resolveAnthropicKey(req.db, userInfo);
  if (!keyRes.ok) return res.status(402).json({ ok: false, message: keyRes.message });

  const userPrompt = buildUserPrompt(action, body.context || {}, question, body.history);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': keyRes.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(),
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[djow-checkout-chat] anthropic error:', data?.error?.message || r.status);
      return res.status(502).json({ ok: false, message: data?.error?.message || `Anthropic ${r.status}` });
    }
    const text = (data?.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();

    // Pra suggestions, parse linha por linha
    if (action === 'suggestions') {
      const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l && l.length < 100).slice(0, 2);
      return res.status(200).json({ ok: true, action, suggestions: lines });
    }
    return res.status(200).json({ ok: true, action, text });
  } catch (err) {
    console.error('[djow-checkout-chat]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
