// V34.7.a — Enriquecimento de nomes de visitors via heurística + Djow Sonnet.
//
// Cliente nunca chama isso diretamente. Roda como cron diário (madrugada)
// OU dispara manualmente via "Enriquecer agora" no sininho.
//
// POST /api/visitors-enrich-names
// Auth (V34.7.h): JWT autenticado (qualquer user) OR X-Cron-Token.
// Anthropic key resolvida via lib/ai-resolver — master env, master-shared
// (users.master_ai_enabled), ou user_ai_credentials (key própria do cliente).
// Body: { user_id?, max_visitors? = 100, dry_run? }
//
// Algoritmo:
//   1. Lista visitors com (name IS NULL OR name = email) AND email IS NOT NULL
//   2. Pra cada: tenta heurística primeiro
//      - split('@')[0] → replace _ . - por espaço → capitalize cada palavra
//      - Filtra: comprimento > 2, sem números puros, sem caracteres únicos
//   3. Se heurística não passa, chama Djow Sonnet (1 chamada por lote de 10
//      visitors pra economizar tokens — Sonnet recebe lista e devolve lista)
//   4. Grava em lj_visitors.name
//   5. Aplica tag lj-enriched-djow (audit)
//   6. Se visitor tem external_rd_contact_id, marca pending-contact-update
//      (worker rd-contact-sync-run sincroniza pro RD depois)

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ENRICH_MODEL = 'claude-haiku-4-5-20251001'; // mais barato pra heurísticas simples

// V34.7.h — authorize aceita qualquer JWT autenticado OU cron token.
// Master continua passando (tem req.user). Chave Anthropic vem do resolver.
function authorize(req) {
  if (req.user?.sub || req.user?.id) {
    return { ok: true, source: req.user.isMaster ? 'master' : 'user' };
  }
  const cronToken = process.env.CRON_RECONCILE_TOKEN;
  if (cronToken) {
    const provided = req.headers['x-cron-token'] || req.query?.cron_token;
    if (provided && String(provided) === cronToken) return { ok: true, source: 'cron-token' };
  }
  return { ok: false };
}

const { resolveAnthropicKey } = require('../lib/ai-resolver');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

// Capitaliza primeira letra de cada palavra
function titleCase(s) {
  return String(s || '')
    .split(/\s+/)
    .map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '')
    .join(' ')
    .trim();
}

// Heurística simples: email → "Nome Sobrenome"
// Retorna null se não conseguir inferir nada confiável.
function heuristicNameFromEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const local = email.split('@')[0];
  if (!local) return null;
  // Filtra emails com formato impossível
  if (/^[\d_-]+$/.test(local)) return null; // só números/underscore
  if (local.length < 3) return null; // muito curto
  // Remove números no fim ("joao123" → "joao")
  let cleaned = local.replace(/\d+$/, '');
  if (!cleaned || cleaned.length < 3) return null;
  // Substitui separadores por espaço
  cleaned = cleaned.replace(/[._-]+/g, ' ').trim();
  // Detecta nomes compostos plausíveis (tem espaço OU pelo menos 4 letras)
  if (cleaned.length < 4) return null;
  return titleCase(cleaned);
}

// Chama Djow Sonnet pra refinar lista de heurísticas (acentos, nomes brasileiros).
async function djowRefineNames(items, apiKey) {
  if (!items.length) return [];
  const systemPrompt = `Você é o Djow, motor de enriquecimento do LeadJourney.

Recebe lista de emails + tentativa de nome heurística. Sua tarefa:
- Verificar se o nome inferido é plausível em PT-BR (acentos corretos, nomes brasileiros conhecidos)
- Adicionar acentos quando óbvio ("Joao" → "João", "Elisa" → "Elisa", "Aleksandra" → "Aleksandra")
- Corrigir nomes que parecem siglas ou apelidos ("xx Killer Xx" → null, "Js" → null)

Responda APENAS JSON válido (sem markdown fence):
[
  { "email": "...", "name": "..." | null }
]

null = não foi possível inferir nome plausível.`;

  const userMessage = `Enriqueça estes nomes:
${items.map((it, i) => `${i + 1}. email="${it.email}", heuristica="${it.heuristic || '(falhou)'}"`).join('\n')}`;

  try {
    const r = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      body: JSON.stringify({
        model: ENRICH_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[enrich-names] Claude err:', data?.error?.message || r.status);
      return items.map(it => ({ email: it.email, name: it.heuristic }));
    }
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(stripped); } catch (_) {
      console.error('[enrich-names] Djow JSON inválido, fallback heurística');
      return items.map(it => ({ email: it.email, name: it.heuristic }));
    }
    if (!Array.isArray(parsed)) return items.map(it => ({ email: it.email, name: it.heuristic }));
    return parsed;
  } catch (err) {
    console.error('[enrich-names] Djow err:', err.message);
    return items.map(it => ({ email: it.email, name: it.heuristic }));
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  // V37.4.34 — Cron passa body.user_id (já é o owner). JWT resolve via tenant.
  const scopeUserId = body.user_id
    ? Number(body.user_id)
    : (req.user ? await resolveCredentialOwnerId(req) : 0);
  if (!scopeUserId) return res.status(400).json({ ok: false, message: 'user_id obrigatório (ou JWT autenticado).' });
  const max = Math.min(Number(body.max_visitors || 100), 500);
  const dryRun = Boolean(body.dry_run);

  // V34.7.h — Resolve key Anthropic. Cron sem JWT cai aqui também: usa master env.
  let apiKey = '';
  if (req.user?.sub || req.user?.id) {
    const resolved = await resolveAnthropicKey(req.db, {
      id: Number(req.user.sub || req.user.id),
      isMaster: Boolean(req.user.isMaster)
    });
    if (resolved.ok) apiKey = resolved.apiKey;
    else if (!dryRun) {
      return res.status(402).json({ ok: false, message: resolved.message || 'IA não configurada.' });
    }
  } else {
    apiKey = process.env.ANTHROPIC_API_KEY || '';
  }

  // Lista visitors sem nome (name = NULL OR name = email)
  let visitors = [];
  try {
    const r = await req.tenantDb.query(
      // V34.7.h.3 — Inclui placeholders gravados por lj-rd-lead-sync ("Lead sem
      // nome") e leadParser (idem). LOWER(TRIM(...)) tolera variações de caixa
      // ("Lead sem Nome", "  lead sem nome  ", etc).
      `SELECT lj_visitor_id, email, phone, name, external_rd_contact_id
         FROM lj_visitors
        WHERE user_id = $1
          AND email IS NOT NULL AND email <> ''
          AND (
                name IS NULL
                OR name = ''
                OR LOWER(name) = LOWER(email)
                OR LOWER(TRIM(name)) IN ('lead sem nome', 'sem nome', '(sem nome)', 'lead', '-')
              )
        ORDER BY first_seen_at DESC NULLS LAST
        LIMIT $2`,
      [scopeUserId, max]
    );
    visitors = r.rows;
  } catch (err) {
    return res.status(500).json({ ok: false, message: `lista visitors: ${err.message}` });
  }

  if (!visitors.length) {
    return res.status(200).json({ ok: true, processed: 0, enriched: 0, byHeuristic: 0, byDjow: 0, skipped: 0, markedForRdSync: 0 });
  }

  // Pass 1: heurística
  const enrichments = [];
  for (const v of visitors) {
    const heur = heuristicNameFromEmail(v.email);
    enrichments.push({ visitor: v, email: v.email, heuristic: heur, finalName: null, source: null });
  }

  // Pass 2: Djow refina TODOS (mesmo os que heurística achou — pra acentos)
  // Em batches de 10 pra economizar tokens
  if (apiKey && !dryRun) {
    const BATCH = 10;
    for (let i = 0; i < enrichments.length; i += BATCH) {
      const slice = enrichments.slice(i, i + BATCH).map(e => ({ email: e.email, heuristic: e.heuristic }));
      const refined = await djowRefineNames(slice, apiKey);
      for (let j = 0; j < refined.length; j++) {
        const target = enrichments[i + j];
        const refinedName = refined[j]?.name || null;
        if (refinedName && refinedName.length > 2) {
          target.finalName = refinedName;
          target.source = (refinedName === target.heuristic) ? 'heuristic' : 'djow';
        } else if (target.heuristic) {
          // Djow não validou mas heurística existe — usa heurística
          target.finalName = target.heuristic;
          target.source = 'heuristic';
        }
      }
    }
  } else {
    // Sem Djow (sem ANTHROPIC_API_KEY ou dryRun), só heurística
    for (const e of enrichments) {
      if (e.heuristic) { e.finalName = e.heuristic; e.source = 'heuristic'; }
    }
  }

  if (dryRun) {
    return res.status(200).json({
      ok: true,
      dryRun: true,
      processed: enrichments.length,
      preview: enrichments.slice(0, 20).map(e => ({
        email: e.email,
        heuristic: e.heuristic,
        finalName: e.finalName,
        source: e.source
      }))
    });
  }

  // Pass 3: grava no DB + marca pending-contact-update se tem RD contact
  let enriched = 0, byHeuristic = 0, byDjow = 0, skipped = 0, markedForRdSync = 0;
  const { markForSync } = require('../lib/rd-contact-sync-engine');
  for (const e of enrichments) {
    if (!e.finalName) { skipped++; continue; }
    try {
      await req.tenantDb.query(
        `UPDATE lj_visitors SET name = $3, updated_at = NOW()
           WHERE user_id = $1 AND lj_visitor_id = $2`,
        [scopeUserId, e.visitor.lj_visitor_id, e.finalName]
      );
      // Tag de audit
      await req.tenantDb.query(
        `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category)
           VALUES ($1, $2, $3, 'lj-motor', 'lj-native')
         ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
        [scopeUserId, e.visitor.lj_visitor_id, `lj-enriched-${e.source}`]
      );
      enriched++;
      if (e.source === 'heuristic') byHeuristic++;
      else if (e.source === 'djow') byDjow++;
      // Se tem RD contact, marca pending pra sync depois
      if (e.visitor.external_rd_contact_id) {
        await markForSync(req.tenantDb, scopeUserId, e.visitor.lj_visitor_id, 'enriched-djow');
        markedForRdSync++;
      }
    } catch (err) {
      console.error('[enrich-names] grava err:', err.message);
      skipped++;
    }
  }

  // V34.7.h.5 — eligibleRemaining: quantos ainda têm depois deste batch.
  // Frontend loopa enquanto > 0 pra mostrar barra de progresso.
  let eligibleRemaining = 0;
  try {
    const r = await req.tenantDb.query(
      `SELECT COUNT(*)::int AS c
         FROM lj_visitors
        WHERE user_id = $1
          AND email IS NOT NULL AND email <> ''
          AND (
                name IS NULL
                OR name = ''
                OR LOWER(name) = LOWER(email)
                OR LOWER(TRIM(name)) IN ('lead sem nome', 'sem nome', '(sem nome)', 'lead', '-')
              )`,
      [scopeUserId]
    );
    eligibleRemaining = r.rows[0]?.c || 0;
  } catch (err) {
    console.warn('[enrich-names] eligibleRemaining count falhou:', err.message);
  }

  return res.status(200).json({
    ok: true,
    processed: enrichments.length,
    enriched,
    byHeuristic,
    byDjow,
    skipped,
    markedForRdSync,
    eligibleRemaining,
    triggeredBy: auth.source
  });
};
