const STATE_ALIASES = {
  'acre': ['ac', 'acre'],
  'alagoas': ['al', 'alagoas'],
  'amapa': ['ap', 'amapa', 'amapá'],
  'amazonas': ['am', 'amazonas'],
  'bahia': ['ba', 'bahia'],
  'ceara': ['ce', 'ceara', 'ceará'],
  'distrito federal': ['df', 'distrito federal', 'brasilia', 'brasília'],
  'espirito santo': ['es', 'espirito santo', 'espírito santo'],
  'goias': ['go', 'goias', 'goiás'],
  'maranhao': ['ma', 'maranhao', 'maranhão'],
  'mato grosso': ['mt', 'mato grosso'],
  'mato grosso do sul': ['ms', 'mato grosso do sul'],
  'minas gerais': ['mg', 'minas gerais'],
  'para': ['pa', 'para', 'pará'],
  'paraiba': ['pb', 'paraiba', 'paraíba'],
  'parana': ['pr', 'parana', 'paraná'],
  'pernambuco': ['pe', 'pernambuco'],
  'piaui': ['pi', 'piaui', 'piauí'],
  'rio de janeiro': ['rj', 'rio de janeiro'],
  'rio grande do norte': ['rn', 'rio grande do norte'],
  'rio grande do sul': ['rs', 'rio grande do sul'],
  'rondonia': ['ro', 'rondonia', 'rondônia'],
  'roraima': ['rr', 'roraima'],
  'santa catarina': ['sc', 'santa catarina', 'florianopolis', 'florianópolis'],
  'sao paulo': ['sp', 'sao paulo', 'são paulo'],
  'sergipe': ['se', 'sergipe'],
  'tocantins': ['to', 'tocantins']
};

const CHANNELS = ['RD Station', 'Meta Ads', 'WhatsApp', 'Google Ads', 'LinkedIn', 'Webhook', 'Outro'];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function localFilter(value) {
  const normalized = normalize(value);
  let aliases = null;
  let stateName = normalized;
  for (const [name, list] of Object.entries(STATE_ALIASES)) {
    if (name === normalized || list.map(normalize).includes(normalized)) {
      stateName = name;
      aliases = list.map(normalize);
      break;
    }
  }
  return { type: 'local', field: 'local', value: stateName, aliases: aliases || [normalized], label: `Local: ${stateName}` };
}

function unique(filters) {
  const seen = new Set();
  return filters.filter(filter => {
    const key = JSON.stringify({ type: filter.type, value: filter.value, min: filter.min, max: filter.max, label: filter.label });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filtersFromObject(obj = {}) {
  const filters = [];
  const sexos = Array.isArray(obj.sexo) ? obj.sexo : [];
  sexos.forEach(value => {
    if (value === 'feminino' || value === 'masculino') filters.push({ type: 'sexo', field: 'sexo', value, label: `Sexo: ${value === 'feminino' ? 'Feminino' : 'Masculino'}` });
  });

  if (Number.isFinite(obj.idade_min) && Number.isFinite(obj.idade_max) && obj.idade_min === obj.idade_max) {
    filters.push({ type: 'idade_exact', field: 'idade', value: obj.idade_min, label: `Idade: ${obj.idade_min} anos` });
  } else if (Number.isFinite(obj.idade_min) && Number.isFinite(obj.idade_max)) {
    filters.push({ type: 'idade_range', field: 'idade', min: obj.idade_min, max: obj.idade_max, label: `Idade: ${obj.idade_min} a ${obj.idade_max} anos` });
  } else if (Number.isFinite(obj.idade_min)) {
    filters.push({ type: 'idade_min', field: 'idade', min: obj.idade_min, label: `Idade: >= ${obj.idade_min}` });
  } else if (Number.isFinite(obj.idade_max)) {
    filters.push({ type: 'idade_max', field: 'idade', max: obj.idade_max, label: `Idade: <= ${obj.idade_max}` });
  }

  if (Number.isFinite(obj.score_min) && Number.isFinite(obj.score_max) && obj.score_min === obj.score_max) {
    filters.push({ type: 'score_exact', field: 'score', value: obj.score_min, label: `Score: ${obj.score_min}` });
  } else if (Number.isFinite(obj.score_min) && Number.isFinite(obj.score_max)) {
    filters.push({ type: 'score_min', field: 'score', min: obj.score_min, label: `Score: >= ${obj.score_min}` });
    filters.push({ type: 'score_max', field: 'score', max: obj.score_max, label: `Score: <= ${obj.score_max}` });
  } else if (Number.isFinite(obj.score_min)) {
    filters.push({ type: 'score_min', field: 'score', min: obj.score_min, label: `Score: >= ${obj.score_min}` });
  } else if (Number.isFinite(obj.score_max)) {
    filters.push({ type: 'score_max', field: 'score', max: obj.score_max, label: `Score: <= ${obj.score_max}` });
  }

  (Array.isArray(obj.locais) ? obj.locais : []).filter(Boolean).forEach(value => filters.push(localFilter(value)));
  (Array.isArray(obj.temperaturas) ? obj.temperaturas : []).filter(Boolean).forEach(value => filters.push({ type: 'temperatura', field: 'temperatura', value, label: `Temperatura: ${value}` }));
  (Array.isArray(obj.estado_civil) ? obj.estado_civil : []).filter(Boolean).forEach(value => filters.push({ type: 'estado_civil', field: 'estado_civil', value: normalize(value), label: `Estado civil: ${value}` }));
  (Array.isArray(obj.tags) ? obj.tags : []).filter(Boolean).forEach(value => {
    const tag = String(value).startsWith('#') ? String(value) : `#${value}`;
    filters.push({ type: 'tag', field: 'tag', value: normalize(tag), label: `Tag: ${tag}` });
  });
  (Array.isArray(obj.canais) ? obj.canais : []).filter(Boolean).forEach(value => filters.push({ type: 'canal', field: 'canal', value, label: `Canal: ${value}` }));
  if (obj.has_email === true) filters.push({ type: 'has_email', field: 'has_email', label: 'Tem e-mail' });
  if (obj.has_phone === true) filters.push({ type: 'has_phone', field: 'has_phone', label: 'Tem telefone' });
  const textTerms = Array.isArray(obj.text_terms) ? obj.text_terms.map(normalize).filter(Boolean) : [];
  if (textTerms.length) filters.push({ type: 'text', field: 'text', value: textTerms, label: `Busca: ${textTerms.join(' ')}` });
  return unique(filters);
}

function toFrontendFilters(payload) {
  const globalFilters = filtersFromObject(payload.global || {});
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const nonEmptyGroups = groups.map(filtersFromObject).filter(group => group.length);

  if (nonEmptyGroups.length > 1) {
    return [{
      type: 'or_segments',
      field: 'segmentos',
      segments: nonEmptyGroups.map(group => unique([...group, ...globalFilters])),
      label: `Clusters somados: ${nonEmptyGroups.map(group => group.map(f => f.label).join(' + ')).join(' | ')}`,
      marketingLogic: 'E soma clusters de público; cada cluster mantém seus próprios critérios.'
    }];
  }

  if (nonEmptyGroups.length === 1) return unique([...nonEmptyGroups[0], ...globalFilters]);
  return unique(globalFilters);
}

const filterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sexo', 'idade_min', 'idade_max', 'score_min', 'score_max', 'locais', 'temperaturas', 'estado_civil', 'tags', 'canais', 'has_email', 'has_phone', 'text_terms'],
  properties: {
    sexo: { type: 'array', items: { type: 'string', enum: ['feminino', 'masculino'] } },
    idade_min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    idade_max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    score_min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    score_max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    locais: { type: 'array', items: { type: 'string' } },
    temperaturas: { type: 'array', items: { type: 'string', enum: ['Quente', 'Morno', 'Frio'] } },
    estado_civil: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    canais: { type: 'array', items: { type: 'string' } },
    has_email: { type: 'boolean' },
    has_phone: { type: 'boolean' },
    text_terms: { type: 'array', items: { type: 'string' } }
  }
};

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['groups', 'global', 'warnings', 'explanation', 'confidence'],
  properties: {
    groups: { type: 'array', items: filterSchema },
    global: filterSchema,
    warnings: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    confidence: { type: 'number' }
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(501).json({ error: 'OPENAI_API_KEY não configurada.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const query = String(body?.query || '').trim();
    if (!query) return res.status(400).json({ error: 'Busca vazia.' });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SEARCH_MODEL || 'gpt-5-mini',
        input: [
          {
            role: 'system',
            content: [
              'Você é um interpretador de buscas de segmentação de marketing para um app de LeadScore.',
              'Transforme a frase em filtros estruturados. Não busque dados; só interprete.',
              'Regra de marketing: "e" pode somar clusters de público. Ex.: "homens de 20 a 30 e mulheres de 30 a 40" deve virar dois groups.',
              'Filtros globais, como local, tags e score, podem ir em global quando se aplicam a todos os groups.',
              'Se o usuário usa "ou", execute a interpretação, mas adicione warning dizendo que OU amplia a segmentação e reduz precisão.',
              'Use locais como texto natural: São Paulo pode ser cidade ou estado; retorne em locais.',
              'Tags comportamentais: abriu email => #open; leu => #read; clicou CTA => #cta; visitou LP => #lp; whatsapp => #whatsapp.',
              `Canais possíveis: ${CHANNELS.join(', ')}.`
            ].join('\n')
          },
          { role: 'user', content: query }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'lead_search_interpretation',
            strict: true,
            schema
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Erro na OpenAI.' });
    }

    const outputText = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
    if (!outputText) return res.status(502).json({ error: 'A IA não retornou texto estruturado.' });

    const parsed = JSON.parse(outputText);
    const filters = toFrontendFilters(parsed);
    return res.status(200).json({
      source: 'openai',
      query,
      filters,
      warnings: parsed.warnings || [],
      messages: [parsed.explanation, ...filters.map(filter => filter.label || filter.type)],
      confidence: parsed.confidence || 0.8,
      raw: parsed
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' });
  }
};
