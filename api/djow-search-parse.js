// V26.1.0 — Djow Search Parse: usa Claude pra converter query em linguagem
// natural ("mulheres jovens de SP com alta intenção") em um array de filtros
// estruturados compatível com ProfileFinder.applyFilters do LeadJourney.
//
// Foco: rápido, barato (Sonnet 4.6), retorna SÓ JSON. Sem tools, sem KB.
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SYSTEM_PROMPT = `Você é um parser de busca de leads do LeadJourney. Receba uma query em português brasileiro e retorne APENAS um JSON válido (sem markdown, sem prefixos, sem explicação) com filtros estruturados.

## Tipos de filtro disponíveis

\`\`\`
{ "type": "sexo", "value": "feminino"|"masculino", "label": "Sexo: ..." }
{ "type": "idade_exact", "field": "idade", "value": N, "label": "Idade: N anos" }
{ "type": "idade_range", "field": "idade", "min": N, "max": M, "label": "Idade: N a M anos" }
{ "type": "idade_min", "field": "idade", "min": N, "label": "Idade: >= N" }
{ "type": "idade_max", "field": "idade", "max": N, "label": "Idade: <= N" }
{ "type": "local", "field": "local", "value": "<estado_normalizado>", "aliases": ["<sigla>", "<nome>"], "label": "Local: <estado>" }
{ "type": "temperatura", "value": "Quente"|"Morno"|"Frio", "label": "Temperatura: ..." }
{ "type": "score_min", "field": "score", "min": N, "label": "Score: >= N" }
{ "type": "score_max", "field": "score", "max": N, "label": "Score: <= N" }
{ "type": "estado_civil", "value": "solteiro"|"casado"|"divorciado"|"viuvo"|"uniao estavel", "label": "Estado civil: ..." }
{ "type": "tag", "field": "tag", "value": "#open"|"#read"|"#cta"|"#lp"|"#whatsapp", "label": "Tag: ..." }
{ "type": "has_email", "label": "Tem email" }
{ "type": "has_phone", "label": "Tem telefone" }
{ "type": "canal", "value": "<nome do canal>", "label": "Canal: ..." }
{ "type": "text", "field": "text", "value": ["termo1", "termo2"], "label": "Busca livre: ..." }
\`\`\`

## Estados brasileiros (use valor normalizado em minúsculo, sem acento)
acre, alagoas, amapa, amazonas, bahia, ceara, distrito federal, espirito santo, goias, maranhao, mato grosso, mato grosso do sul, minas gerais, para, paraiba, parana, pernambuco, piaui, rio de janeiro, rio grande do norte, rio grande do sul, rondonia, roraima, santa catarina, sao paulo, sergipe, tocantins.

Para "local", inclua aliases: sigla (ex: "sp") + nome normalizado (ex: "sao paulo") + opcionalmente capitais (ex: "florianopolis" pra Santa Catarina).

## Tags conhecidas e sinônimos
- "#open" = abriu email, abertura, abriram
- "#read" = leu, leram, consumiu
- "#cta" = clicou, clique, cta
- "#lp" = landing page, visitou lp
- "#whatsapp" = whatsapp, zap, respondeu wpp

## Temperatura
- "Quente" = quente, hot, alta intenção
- "Morno" = morno, warm, média intenção
- "Frio" = frio, cold, baixa intenção

## Mapeamento de "jovem" / "adulto" / "idoso"
- "jovens" → idade_range 18 a 30
- "adultos" → idade_range 30 a 50
- "idosos" → idade_min 60

## REGRAS CRÍTICAS
1. Retorne EXATAMENTE: \`{"filters": [...]}\` — sem texto extra, sem \`\`\`json\`\`\` blocos
2. Se a query não tem filtros estruturados claros, retorne com um único filtro \`text\` contendo os termos relevantes
3. Múltiplos critérios = múltiplos filtros no array (AND lógico)
4. NÃO invente tipos de filtro fora da lista acima
5. Cada filtro DEVE ter "label" descritivo em português

## Exemplos

Query: "mulheres jovens de SP com alta intenção"
\`\`\`json
{"filters":[
  {"type":"sexo","value":"feminino","label":"Sexo: Feminino"},
  {"type":"idade_range","field":"idade","min":18,"max":30,"label":"Idade: 18 a 30 anos"},
  {"type":"local","field":"local","value":"sao paulo","aliases":["sp","sao paulo"],"label":"Local: São Paulo"},
  {"type":"temperatura","value":"Quente","label":"Temperatura: Quente"}
]}
\`\`\`

Query: "leads que clicaram no cta e tem email"
\`\`\`json
{"filters":[
  {"type":"tag","field":"tag","value":"#cta","label":"Tag: #cta"},
  {"type":"has_email","label":"Tem email"}
]}
\`\`\`

Query: "todos com score acima de 70"
\`\`\`json
{"filters":[
  {"type":"score_min","field":"score","min":70,"label":"Score: >= 70"}
]}
\`\`\`
`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) return res.status(500).json({ ok: false, message: 'ANTHROPIC_API_KEY ausente no Railway.' });

  const query = String(req.body?.query || '').trim();
  if (!query) return res.status(400).json({ ok: false, message: 'query obrigatória.' });
  if (query.length > 500) return res.status(400).json({ ok: false, message: 'query muito longa (max 500).' });

  // Sonnet 4.6 — barato e suficiente pra parse estruturado.
  const model = 'claude-sonnet-4-6';
  try {
    const r = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Query: "${query}"` }]
      })
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
    if (!r.ok) {
      return res.status(502).json({ ok: false, message: data?.error?.message || `HTTP ${r.status}` });
    }
    // Extrai texto da resposta (Claude retorna content array)
    const responseText = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    // Tenta parsear o JSON. Tolera markdown fence se Claude desobedecer.
    const stripped = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(stripped); } catch (err) {
      return res.status(500).json({
        ok: false,
        message: 'Claude retornou JSON inválido.',
        raw: stripped.slice(0, 300)
      });
    }
    if (!parsed || !Array.isArray(parsed.filters)) {
      return res.status(500).json({ ok: false, message: 'Resposta sem array filters.', raw: parsed });
    }
    // Validação básica: cada filter tem `type` válido
    const validTypes = new Set([
      'sexo','idade_exact','idade_range','idade_min','idade_max','local',
      'temperatura','score_exact','score_min','score_max','estado_civil',
      'tag','has_email','has_phone','canal','text'
    ]);
    const filters = parsed.filters.filter(f => f && validTypes.has(f.type));
    return res.status(200).json({
      ok: true,
      filters,
      usage: data.usage || null,
      query
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err?.message || 'Erro inesperado.' });
  }
};
