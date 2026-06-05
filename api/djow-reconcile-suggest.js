// V36.2.0 — Djow Conciliador: sugere reconciliationRule pra KR multi-source.
//
// POST /api/djow-reconcile-suggest
// Body: {
//   krName: string,
//   krUnit: 'reais'|'percentual'|'quantidade'|'numero'|'pontuacao',
//   krDirection: 'higher'|'lower',
//   sources: [{ id, integration_id, field, label }]
// }
//
// Retorna: {
//   ok: true,
//   mode: 'sum'|'primary'|'first-available'|'avg'|'max'|'min',
//   primarySourceId?: string,
//   fallbackSourceIds?: string[],
//   contextSourceIds?: string[],
//   reasoning: string,           // explicação humana pro cliente entender
//   usedLLM: boolean             // foi heurística ou LLM
// }
//
// Estratégia: heurística primeiro (grátis, instantâneo). LLM só quando a
// heurística não tem confiança ou quando o caso é ambíguo (>3 fontes, ou
// 2 fontes que conceitualmente brigam).

const aiResolver = require('../lib/ai-resolver');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const { krName, krUnit, krDirection, sources } = req.body || {};
  const list = Array.isArray(sources) ? sources.filter(s => s && s.id) : [];
  if (!list.length) return res.status(400).json({ ok: false, message: 'sources vazio.' });

  // --- Heurística ---
  const heuristic = _suggestHeuristic({ krName, krUnit, krDirection, sources: list });
  if (heuristic.confident) {
    return res.json({ ok: true, ...heuristic.rule, usedLLM: false });
  }

  // --- LLM fallback ---
  let anthropicKey = null;
  try {
    const masterDb = req.app?.get?.('pgPool') || req.db;
    const keyResult = await aiResolver.resolveAnthropicKey(masterDb, {
      id: Number(req.user.sub || req.user.id),
      isMaster: Boolean(req.user.isMaster)
    });
    if (keyResult.ok) anthropicKey = keyResult.apiKey;
  } catch (_) { /* sem chave — devolve heurística menos confiante */ }

  if (!anthropicKey) {
    return res.json({ ok: true, ...heuristic.rule, usedLLM: false, llmUnavailable: true });
  }

  try {
    const llmRule = await _suggestWithLLM({ krName, krUnit, krDirection, sources: list }, anthropicKey);
    return res.json({ ok: true, ...llmRule, usedLLM: true });
  } catch (err) {
    console.warn('[djow-reconcile-suggest] LLM falhou, devolvendo heurística:', err.message);
    return res.json({ ok: true, ...heuristic.rule, usedLLM: false, llmFailed: true });
  }
};

// ===== HEURÍSTICA =====

function _suggestHeuristic({ krName, krUnit, krDirection, sources }) {
  const n = sources.length;

  // 1 fonte: trivial — primary sem fallback
  if (n === 1) {
    return {
      confident: true,
      rule: {
        mode: 'primary',
        primarySourceId: sources[0].id,
        fallbackSourceIds: [],
        contextSourceIds: [],
        reasoning: `Só uma fonte (${sources[0].label}). Uso ela direto.`
      }
    };
  }

  // 2 fontes com integration overlap em métrica conceitualmente equivalente
  // → primary com a "fonte de verdade" (Google Ads > GA4 > RD > Hotmart > ClickUp)
  // → outras como fallback
  if (n === 2) {
    const conceptOverlap = _checkConceptOverlap(sources);
    if (conceptOverlap) {
      const ordered = _orderByTruthPriority(sources);
      return {
        confident: true,
        rule: {
          mode: 'primary',
          primarySourceId: ordered[0].id,
          fallbackSourceIds: [ordered[1].id],
          contextSourceIds: [],
          reasoning: `Ambas medem o mesmo conceito (${conceptOverlap}). Uso ${ordered[0].label} como verdade; ${ordered[1].label} entra se a primeira ficar fora do ar.`
        }
      };
    }
    // Fontes diferentes conceitualmente → soma
    return {
      confident: true,
      rule: {
        mode: 'sum',
        primarySourceId: null,
        fallbackSourceIds: [],
        contextSourceIds: [],
        reasoning: `Duas fontes complementares — somo as duas pra ter o total.`
      }
    };
  }

  // 3+ fontes: caso ambíguo — devolve sum como default mas não confiante
  // (deixa LLM refinar se possível)
  return {
    confident: false,
    rule: {
      mode: 'sum',
      primarySourceId: null,
      fallbackSourceIds: [],
      contextSourceIds: [],
      reasoning: `${n} fontes — somo todas por default. Confirme se quer outra combinação.`
    }
  };
}

// Detecta se 2 fontes medem o mesmo conceito (sessions, conversions, revenue,
// clicks). Retorna o nome do conceito ou null.
function _checkConceptOverlap(sources) {
  if (sources.length !== 2) return null;
  const [a, b] = sources;
  const labelA = String(a.label || '').toLowerCase();
  const labelB = String(b.label || '').toLowerCase();
  const fieldA = String(a.field || '').toLowerCase();
  const fieldB = String(b.field || '').toLowerCase();

  const concepts = [
    { name: 'sessões/usuários', terms: ['session', 'user', 'usuário', 'sessão', 'visitante'] },
    { name: 'cliques', terms: ['click', 'cliques'] },
    { name: 'conversões', terms: ['conversion', 'conversão'] },
    { name: 'receita', terms: ['revenue', 'receita', 'value', 'faturamento'] },
    { name: 'impressões/alcance', terms: ['impression', 'alcance', 'reach'] },
    { name: 'leads/contatos', terms: ['lead', 'contato', 'contact', 'mql', 'sql'] }
  ];

  for (const c of concepts) {
    const aHas = c.terms.some(t => labelA.includes(t) || fieldA.includes(t));
    const bHas = c.terms.some(t => labelB.includes(t) || fieldB.includes(t));
    if (aHas && bHas) return c.name;
  }
  return null;
}

// Prioridade de "verdade" entre integrações. Google Ads ganha de GA4 pra
// métricas de mídia paga (gasto, cliques, conversões diretas), GA4 ganha
// pra métricas de tráfego/comportamento, etc.
function _orderByTruthPriority(sources) {
  // Score maior = mais confiável como fonte primary
  const priority = {
    'google_ads': 100,    // métricas de paid (cost, clicks, conversions atribuídas)
    'hotmart': 90,        // métricas de venda real (revenue, customers)
    'rd_station': 80,     // CRM (deals, contatos qualificados)
    'ga4': 70,            // analytics agnóstico, bom fallback
    'clickup': 60,        // gestão de tarefas
  };
  return [...sources].sort((a, b) => {
    const pa = priority[a.integration_id] || 50;
    const pb = priority[b.integration_id] || 50;
    return pb - pa;
  });
}

// ===== LLM =====

async function _suggestWithLLM({ krName, krUnit, krDirection, sources }, anthropicKey) {
  const sourcesText = sources
    .map((s, i) => `  ${i + 1}. id="${s.id}" — ${s.label} (integração: ${s.integration_id || 'desconhecida'}, campo: ${s.field || '—'})`)
    .join('\n');

  const prompt = `Você é especialista em RevOps. Um KR tem múltiplas fontes de dados. Sugira a melhor regra de conciliação.

KR:
  nome: "${krName || '?'}"
  unidade: ${krUnit || '?'}
  direção: ${krDirection || '?'} (higher=mais é melhor, lower=menos é melhor)

Fontes:
${sourcesText}

Regras possíveis:
- sum               = soma todas (fontes complementares, ex: lead Hotmart + lead RD)
- primary           = uma fonte é VERDADE, outras são fallback se primary cair
- first-available   = pega a primeira que tiver valor > 0
- avg / max / min   = média / máximo / mínimo das fontes
- contextSourceIds  = fontes que aparecem só pra contexto (não entram no cálculo)

Heurísticas:
- Mesma métrica conceitual em 2 ferramentas → mode=primary (Google Ads > GA4 pra paid; Hotmart > RD pra revenue)
- Métricas complementares (alcance Meta + alcance Google) → mode=sum
- Quando alguma fonte é qualitativa (ex: NPS manual) ao lado de números → ela vira contextSourceIds

Responda APENAS em JSON válido (sem markdown):
{
  "mode": "sum|primary|first-available|avg|max|min",
  "primarySourceId": "id ou null",
  "fallbackSourceIds": ["..."],
  "contextSourceIds": ["..."],
  "reasoning": "1-2 frases explicando pra quem não é dev"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
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
  const jsonMatch = String(responseText).match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM não retornou JSON válido.');
  const parsed = JSON.parse(jsonMatch[0]);

  const validModes = ['sum', 'primary', 'first-available', 'avg', 'max', 'min'];
  const mode = validModes.includes(parsed.mode) ? parsed.mode : 'sum';
  const sourceIds = new Set(sources.map(s => s.id));
  const filterValid = (arr) => Array.isArray(arr) ? arr.filter(id => sourceIds.has(id)) : [];

  return {
    mode,
    primarySourceId: sourceIds.has(parsed.primarySourceId) ? parsed.primarySourceId : null,
    fallbackSourceIds: filterValid(parsed.fallbackSourceIds),
    contextSourceIds: filterValid(parsed.contextSourceIds),
    reasoning: String(parsed.reasoning || '').slice(0, 500) || 'Regra sugerida pela IA do Djow.'
  };
}
