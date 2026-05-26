// V34.0.0 — V34.6.j.A: Engine de externalIntegrationCheck.
//
// Quando uma ação LJ é fechada no ClickUp (ou via trigger manual), o engine:
//   1. Resolve o adapter pelo provider
//   2. Adapter retorna lista de candidates do provider externo
//   3. Tenta match LITERAL (case-insensitive trim)
//   4. Se miss, fallback Djow SEMANTIC (Claude Sonnet com lista de candidates)
//   5. Persiste resultado em lj_external_matches + atualiza job em lj_external_check_jobs
//   6. Retorna { status, matched, confidence, ... }
//
// Match thresholds:
//   - confidence >= 0.8 → auto-link, status='matched', match_type='semantic'|'literal'
//   - 0.5 <= confidence < 0.8 → status='gap', sininho com candidates pra cliente confirmar
//   - confidence < 0.5 → status='gap', cliente vê "nenhum match plausível"
//
// Retry: caller decide. Engine não retry sozinho. Worker (V34.6.j.B) cuida.

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const SEMANTIC_MODEL = 'claude-sonnet-4-6';

// Registry de adapters. Cada adapter exporta:
//   listCandidates(db, userId, resourceKind) → Promise<[{ id, name, ... }]>
const adapters = {};

function registerAdapter(provider, adapter) {
  adapters[provider] = adapter;
}

function normName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// CAMADA 1 — match literal: case-insensitive, accent-insensitive, trim.
function findLiteralMatch(expectedName, candidates) {
  const target = normName(expectedName);
  if (!target) return null;
  for (const c of candidates) {
    if (normName(c.name) === target) return c;
  }
  return null;
}

// CAMADA 2 — match semântico via Djow (Claude Sonnet).
// Retorna { match: candidate|null, confidence: 0-1, reasoning: string }
async function findSemanticMatch(expectedName, candidates, provider, resourceKind) {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return { match: null, confidence: 0, reasoning: 'ANTHROPIC_API_KEY ausente.' };
  }
  if (!candidates.length) {
    return { match: null, confidence: 0, reasoning: 'Sem candidates.' };
  }

  const candidatesList = candidates.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
  const systemPrompt = `Você é o Djow, motor de matching semântico do LeadJourney.

Dado um nome de tarefa do LJ/ClickUp e uma lista de recursos externos (${provider} ${resourceKind}s),
identifique qual recurso externo provavelmente corresponde à tarefa.

Considere:
- Abreviações ("sextaM" → "Sexta Mágica" → "S. Mágica")
- Ordem de palavras invertida
- Sigla vs nome completo
- Acentos e variações de caso
- Sinônimos óbvios do contexto de marketing/vendas

Responda APENAS JSON válido (sem markdown fence):
{
  "match_index": <número 1-N, ou null se nenhum>,
  "confidence": <0.0 a 1.0>,
  "reasoning": "<frase curta justificando>"
}

Use confidence:
- 0.9-1.0: tem certeza
- 0.7-0.9: provável
- 0.5-0.7: possível mas duvidoso
- < 0.5: improvável (use null em match_index)`;

  const userMessage = `Tarefa LJ: "${expectedName}"

Recursos externos disponíveis no ${provider}:
${candidatesList}

Qual recurso corresponde à tarefa?`;

  try {
    const r = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: SEMANTIC_MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      return { match: null, confidence: 0, reasoning: `Claude HTTP ${r.status}` };
    }
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(stripped); } catch (_) {
      return { match: null, confidence: 0, reasoning: 'Djow JSON inválido.' };
    }
    const idx = Number(parsed.match_index);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const reasoning = String(parsed.reasoning || '').slice(0, 500);
    if (!idx || idx < 1 || idx > candidates.length) {
      return { match: null, confidence, reasoning };
    }
    return { match: candidates[idx - 1], confidence, reasoning };
  } catch (err) {
    return { match: null, confidence: 0, reasoning: `Erro Djow: ${err.message}` };
  }
}

// Função principal: executa um job de check.
// jobInput: { user_id, action_id, clickup_task_id, provider, resource_kind, expected_name }
// Retorna: { ok, status, matchType, externalId, externalName, confidence, reasoning, candidatesCount }
async function runCheck(db, jobInput) {
  const { user_id, provider, resource_kind, expected_name } = jobInput;
  const adapter = adapters[provider];
  if (!adapter) {
    return { ok: false, status: 'failed', error: `Provider sem adapter: ${provider}` };
  }

  // Lista candidates
  let candidates = [];
  try {
    candidates = await adapter.listCandidates(db, user_id, resource_kind);
  } catch (err) {
    return { ok: false, status: 'failed', error: `Adapter ${provider}: ${err.message}` };
  }

  // Camada 1: literal
  const literal = findLiteralMatch(expected_name, candidates);
  if (literal) {
    return {
      ok: true,
      status: 'matched',
      matchType: 'literal',
      externalId: literal.id,
      externalName: literal.name,
      confidence: 1.0,
      reasoning: null,
      candidatesCount: candidates.length
    };
  }

  // Camada 2: semantic
  const sem = await findSemanticMatch(expected_name, candidates, provider, resource_kind);
  if (sem.match && sem.confidence >= 0.8) {
    return {
      ok: true,
      status: 'matched',
      matchType: 'semantic',
      externalId: sem.match.id,
      externalName: sem.match.name,
      confidence: sem.confidence,
      reasoning: sem.reasoning,
      candidatesCount: candidates.length
    };
  }

  // Gap: nenhum match confiável
  return {
    ok: true,
    status: 'gap',
    matchType: null,
    externalId: sem.match?.id || null,
    externalName: sem.match?.name || null,
    confidence: sem.confidence,
    reasoning: sem.reasoning,
    candidatesCount: candidates.length,
    topCandidates: candidates.slice(0, 5).map(c => ({ id: c.id, name: c.name }))
  };
}

// Persiste o resultado: cria/atualiza job + insere match se status='matched'.
async function persistResult(db, jobInput, result) {
  const jobUpdate = {
    status: result.status,
    match_type: result.matchType,
    matched_external_id: result.externalId,
    matched_external_name: result.externalName,
    confidence: result.confidence,
    djow_reasoning: result.reasoning,
    last_error: result.error || null
  };

  let jobId = jobInput.job_id;
  if (!jobId) {
    // Cria job novo
    const r = await db.query(
      `INSERT INTO lj_external_check_jobs
         (user_id, action_id, clickup_task_id, provider, resource_kind, expected_name,
          status, match_type, matched_external_id, matched_external_name, confidence,
          djow_reasoning, last_error, attempts, triggered_by, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, NOW())
       RETURNING id`,
      [
        jobInput.user_id, jobInput.action_id || null, jobInput.clickup_task_id || null,
        jobInput.provider, jobInput.resource_kind, jobInput.expected_name,
        jobUpdate.status, jobUpdate.match_type, jobUpdate.matched_external_id,
        jobUpdate.matched_external_name, jobUpdate.confidence, jobUpdate.djow_reasoning,
        jobUpdate.last_error, jobInput.triggered_by || 'manual'
      ]
    );
    jobId = r.rows[0].id;
  } else {
    await db.query(
      `UPDATE lj_external_check_jobs SET
         status = $2, match_type = $3, matched_external_id = $4, matched_external_name = $5,
         confidence = $6, djow_reasoning = $7, last_error = $8,
         attempts = attempts + 1, updated_at = NOW(),
         finished_at = CASE WHEN $2 IN ('matched','failed') THEN NOW() ELSE finished_at END
       WHERE id = $1`,
      [jobId, jobUpdate.status, jobUpdate.match_type, jobUpdate.matched_external_id,
       jobUpdate.matched_external_name, jobUpdate.confidence, jobUpdate.djow_reasoning,
       jobUpdate.last_error]
    );
  }

  // Se matched, registra audit
  if (result.status === 'matched' && result.externalId) {
    await db.query(
      `INSERT INTO lj_external_matches
         (user_id, job_id, action_id, provider, resource_kind, external_id, external_name,
          match_type, confidence, djow_reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, provider, resource_kind, external_id) DO UPDATE SET
         match_type = EXCLUDED.match_type,
         confidence = EXCLUDED.confidence,
         djow_reasoning = EXCLUDED.djow_reasoning,
         matched_at = NOW()`,
      [jobInput.user_id, jobId, jobInput.action_id || null, jobInput.provider,
       jobInput.resource_kind, result.externalId, result.externalName,
       result.matchType, result.confidence, result.reasoning]
    );
  }

  return jobId;
}

module.exports = {
  registerAdapter,
  runCheck,
  persistResult,
  // exportado pra testes / outros engines
  findLiteralMatch,
  findSemanticMatch,
  normName
};
