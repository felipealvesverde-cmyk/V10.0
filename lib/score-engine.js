// V34.7.f — Score Motion Engine. Pura matemática RFV.
//
// Score = (R × pR + F × pF + V × pV) × hierarquia × 999
//
// - R: 2^(-dias_desde_último_evento / 30)    exponencial decay
// - F: log(1+total_events) / log(101)         logarítmica saturação
// - V: média ponderada de 7 subcomponentes ∈ [0,1] (versão core; persona Djow vem V35+)
// - hierarquia: clamp por entity_type (suspect ≤333, lead 334-666, customer ≥667)
// - pR + pF + pV = 1.0 (default 0.3 / 0.3 / 0.4)
//
// Cliente NÃO define valores arbitrários por evento — ajusta apenas pesos RFV.
// Subcomponentes do V são todas proporções 0-1 calculadas da DB.
//
// Funções principais:
//   - computeScore(visitor, campaignState, options) → { score, R, F, V, breakdown }
//   - applyEvent(db, userId, visitorId, eventInfo) → recalcula e persiste
//   - applyDecayBatch(db, userId, opts) → cron daily

const DEFAULT_WEIGHTS = { pR: 0.3, pF: 0.3, pV: 0.4 };

const ENTITY_HIERARCHY = {
  suspect:  { min: 0.0,  max: 0.333 },
  lead:     { min: 0.334, max: 0.666 },
  customer: { min: 0.667, max: 1.0 }
};

// =====================================
// R: Recency (decay exponencial)
// =====================================
function computeR(daysSinceLastEvent) {
  const d = Math.max(0, Number(daysSinceLastEvent) || 0);
  return Math.pow(2, -d / 30);
}

// =====================================
// F: Frequency (logarítmica saturação em 100 events)
// =====================================
function computeF(totalEvents) {
  const n = Math.max(0, Number(totalEvents) || 0);
  return Math.log(1 + n) / Math.log(101);
}

// =====================================
// V: Value (média ponderada de subcomponentes)
// =====================================
// Subcomponentes (V34.7.f core, simplificados — refinamento V35+):
//   completudePerfil  — % campos preenchidos no visitor (0-1)
//   engagementRate    — pos_tags / total_tags
//   multiCanalBonus   — # canais distintos / 5
//   crossBancoBonus   — # tags lj-banco-* / 3
//   tagSignal         — saldo tags positivas vs negativas, normalizado
//   burstConversion   — 1.0 se entity_type='customer', senão 0
//   tempoFunilParado  — penalty se >30d parado no stage
function computeV(visitor, campaignState, signals) {
  // signals: { posTagsCount, negTagsCount, totalTagsCount, distinctChannels, distinctBancos }
  const PROFILE_FIELDS = ['name', 'email', 'phone'];
  // Campos do visitor que contam pra completude (V34: usar só os 3 principais
  // pq idade/sexo/cidade/estado raramente vêm preenchidos no import CSV padrão).
  const filled = PROFILE_FIELDS.filter(f => !!String(visitor[f] || '').trim()).length;
  const completudePerfil = filled / PROFILE_FIELDS.length;

  const totalTags = Math.max(1, Number(signals?.totalTagsCount || 0));
  const posTags = Number(signals?.posTagsCount || 0);
  const negTags = Number(signals?.negTagsCount || 0);
  const engagementRate = totalTags > 0 ? Math.max(0, posTags / totalTags) : 0;

  const channels = Number(signals?.distinctChannels || 0);
  const multiCanalBonus = Math.min(1, channels / 5);

  const bancos = Number(signals?.distinctBancos || 0);
  const crossBancoBonus = Math.min(1, bancos / 3);

  // tagSignal: -1 (só negativas) a +1 (só positivas), normalizado pra 0-1
  const tagSaldo = totalTags > 0 ? (posTags - negTags) / totalTags : 0;
  const tagSignal = Math.max(0, Math.min(1, (tagSaldo + 1) / 2));

  const burstConversion = visitor.entity_type === 'customer' ? 1.0 : 0.0;

  // tempoFunilParado: penalty -0.1 a cada 30 dias parado (se campanha ativa)
  let tempoFunilPenalty = 0;
  if (campaignState?.last_movement_at) {
    const daysParado = (Date.now() - new Date(campaignState.last_movement_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysParado > 30) tempoFunilPenalty = Math.min(0.5, Math.floor(daysParado / 30) * 0.1);
  }

  // Pesos iguais nos subcomponentes (V34.7.f core; customizável V35+)
  const subWeights = {
    completudePerfil: 1.0,
    engagementRate: 1.5,
    multiCanalBonus: 0.8,
    crossBancoBonus: 0.8,
    tagSignal: 1.5,
    burstConversion: 2.0,
    tempoFunilPenalty: -1.0
  };
  const subVals = { completudePerfil, engagementRate, multiCanalBonus, crossBancoBonus, tagSignal, burstConversion, tempoFunilPenalty };

  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of Object.keys(subWeights)) {
    if (key === 'tempoFunilPenalty') {
      weightedSum += subWeights[key] * subVals[key]; // subtrai
      // não conta no weightTotal (é penalty separado)
    } else {
      weightedSum += subWeights[key] * subVals[key];
      weightTotal += subWeights[key];
    }
  }
  const V = weightTotal > 0 ? Math.max(0, Math.min(1, weightedSum / weightTotal)) : 0;

  return {
    V,
    breakdown: {
      completudePerfil,
      engagementRate,
      multiCanalBonus,
      crossBancoBonus,
      tagSignal,
      burstConversion,
      tempoFunilPenalty
    }
  };
}

// =====================================
// Clamp por hierarquia entity_type
// =====================================
function applyHierarchy(score01, entityType) {
  const cap = ENTITY_HIERARCHY[entityType] || ENTITY_HIERARCHY.lead;
  // suspect: cap em max — não pode ultrapassar
  // lead: clamp entre min e max
  // customer: cap em min — não pode ficar abaixo + bonus multiplicativo
  if (entityType === 'customer') {
    const boosted = score01 * 1.5;
    return Math.max(cap.min, Math.min(1.0, boosted));
  }
  return Math.max(cap.min, Math.min(cap.max, score01));
}

// =====================================
// Compute principal — usa apenas dados puros
// =====================================
function computeScore({ visitor, campaignState = null, signals = {}, weights = DEFAULT_WEIGHTS, daysSinceLastEvent = 999, totalEvents = 0 }) {
  const R = computeR(daysSinceLastEvent);
  const F = computeF(totalEvents);
  const { V, breakdown } = computeV(visitor, campaignState, signals);

  const pR = Number(weights?.pR ?? DEFAULT_WEIGHTS.pR);
  const pF = Number(weights?.pF ?? DEFAULT_WEIGHTS.pF);
  const pV = Number(weights?.pV ?? DEFAULT_WEIGHTS.pV);

  const raw01 = R * pR + F * pF + V * pV;
  const clamped01 = applyHierarchy(raw01, visitor.entity_type);
  const score = Math.round(clamped01 * 999);

  return {
    score,
    R: Number(R.toFixed(4)),
    F: Number(F.toFixed(4)),
    V: Number(V.toFixed(4)),
    raw01: Number(raw01.toFixed(4)),
    clamped01: Number(clamped01.toFixed(4)),
    breakdown,
    weights: { pR, pF, pV }
  };
}

// =====================================
// V34.9.10 — Modelo "Critérios" (HubSpot-style): soma de pontos por regra.
// Lê lj_score_rules do user, casa com signals do visitor, retorna 0..999.
// =====================================
async function computeCriteriaScore(db, userId, visitor, signals) {
  let totalPoints = 0;
  let hits = 0;
  const breakdown = [];
  try {
    const r = await db.query(
      `SELECT * FROM lj_score_rules WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );
    // Loop nas regras + verifica match básico (pra MVP, suporta 'tag' e 'event')
    const tagsRes = await db.query(
      `SELECT tag FROM lj_visitor_tags WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitor.lj_visitor_id]
    );
    const tags = new Set(tagsRes.rows.map(t => String(t.tag || '').toLowerCase()));

    for (const rule of r.rows) {
      const type = String(rule.trigger_type || '').toLowerCase();
      const param = String(rule.trigger_param || '').toLowerCase();
      let matched = false;
      if (type === 'tag' && param && tags.has(param)) matched = true;
      else if (type === 'event' && Number(signals?.totalEvents || 0) > 0) matched = true;
      else if (type === 'score') {
        // Auto-trigger por score (ex.: cliente que atinge score X dispara regra)
        const score = Number(visitor.global_score || 0);
        const target = Number(rule.trigger_param || 0);
        if (target && score >= target) matched = true;
      }
      // pageview/form/cta/payment: precisariam de touchpoints/events específicos —
      // simplificado pra MVP. Refinar quando UI de cadastro estiver fechada.
      if (matched) {
        totalPoints += Number(rule.points || 0);
        hits++;
        breakdown.push({ ruleId: rule.id, type, param, points: rule.points });
      }
    }
  } catch (err) {
    console.warn('[computeCriteriaScore]', err.message);
  }
  // Normaliza pra 0..999. Saturação prática: cliente típico vai cadastrar
  // regras somando até ~500-1000pts max. Sem cap rígido — clamp por entity_type
  // continua valendo no caller.
  const raw01 = Math.max(0, Math.min(1, totalPoints / 1000));
  return { score: Math.round(raw01 * 999), raw01, totalPoints, hits, breakdown };
}

// =====================================
// V34.9.10 — Helper: lê active_score_model do user (master DB).
// =====================================
async function readActiveScoreModel(masterDb, userId) {
  try {
    const r = await masterDb.query(
      'SELECT active_score_model FROM users WHERE id = $1',
      [userId]
    );
    return r.rows[0]?.active_score_model || 'rfv';
  } catch (_) { return 'rfv'; }
}

// =====================================
// V34.9.10.2 — Helper: combina RFV + Criteria conforme modelo ativo.
// =====================================
async function resolveScoreByModel({ model, visitor, signals, daysSinceLastEvent, totalEvents, db, userId, campaignState = null }) {
  if (model === 'criteria') {
    const c = await computeCriteriaScore(db, userId, visitor, signals);
    return { score: c.score, model: 'criteria', criteria: c, rfv: null };
  }
  const rfv = computeScore({ visitor, campaignState, signals, daysSinceLastEvent, totalEvents });
  if (model === 'hybrid') {
    const c = await computeCriteriaScore(db, userId, visitor, signals);
    // Médio simples por hora (50/50). Pesos editáveis ficam pra V34.9.11.
    const blended = Math.round((rfv.score + c.score) / 2);
    return { score: blended, model: 'hybrid', criteria: c, rfv };
  }
  return { score: rfv.score, model: 'rfv', criteria: null, rfv };
}

// =====================================
// applyEvent — recalcula e persiste global_score + campaign_score
// V34.9.10.2 — Aceita opts.masterDb pra ler active_score_model do user.
//   Sem masterDb → cai pra modelo 'rfv' (compat com callers existentes).
// =====================================
async function applyEvent(db, userId, visitorId, eventInfo = {}, opts = {}) {
  // Lê visitor
  const vRes = await db.query(
    `SELECT lj_visitor_id, name, email, phone, entity_type, current_stage,
            global_score, total_value_cents, first_seen_at, last_seen_at
       FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2 LIMIT 1`,
    [userId, visitorId]
  );
  if (!vRes.rows.length) return { ok: false, error: 'visitor não encontrado' };
  const visitor = vRes.rows[0];

  // Calcula signals (agregados do DB)
  const signals = await loadVisitorSignals(db, userId, visitorId);
  const daysSinceLastEvent = signals.daysSinceLastEvent;
  const totalEvents = signals.totalEvents;

  // V34.9.10.2 — Lê modelo ativo (rfv | criteria | hybrid). Cai pra rfv se sem masterDb.
  const model = opts.masterDb ? await readActiveScoreModel(opts.masterDb, userId) : 'rfv';

  // Global score (sem campanha — agregação cross-campanha)
  const globalResult = await resolveScoreByModel({
    model, visitor, signals, daysSinceLastEvent, totalEvents, db, userId
  });

  // Persiste global
  await db.query(
    `UPDATE lj_visitors SET global_score = $3, updated_at = NOW()
       WHERE user_id = $1 AND lj_visitor_id = $2`,
    [userId, visitorId, globalResult.score]
  );

  // Score por campanha (recalcula TODAS campanhas ativas do visitor)
  const csRes = await db.query(
    `SELECT campaign_id, current_stage, score, entry_stage, last_movement_at
       FROM lj_visitor_campaign_state WHERE user_id = $1 AND lj_visitor_id = $2`,
    [userId, visitorId]
  );
  const campaignResults = [];
  for (const cs of csRes.rows) {
    const campResult = await resolveScoreByModel({
      model, visitor, signals, daysSinceLastEvent, totalEvents, db, userId, campaignState: cs
    });
    await db.query(
      `UPDATE lj_visitor_campaign_state SET score = $4, last_movement_at = COALESCE($5, last_movement_at)
         WHERE user_id = $1 AND lj_visitor_id = $2 AND campaign_id = $3`,
      [userId, visitorId, cs.campaign_id, campResult.score, eventInfo?.movedStage ? new Date() : cs.last_movement_at]
    );
    campaignResults.push({ campaignId: cs.campaign_id, score: campResult.score, model: campResult.model });
  }

  return {
    ok: true,
    visitorId,
    globalScore: globalResult.score,
    breakdown: globalResult.breakdown,
    campaignScores: campaignResults
  };
}

// =====================================
// loadVisitorSignals — agrega dados pra computar V
// =====================================
async function loadVisitorSignals(db, userId, visitorId) {
  // Tags por categoria (positivas / negativas / total)
  const tagsRes = await db.query(
    `SELECT tag, source FROM lj_visitor_tags
       WHERE user_id = $1 AND lj_visitor_id = $2`,
    [userId, visitorId]
  );
  let posTagsCount = 0, negTagsCount = 0;
  let distinctBancos = 0;
  const channelsSet = new Set();
  const NEGATIVE_TAGS = /bounced|unsubscrib|descadastr|invalid|hard-bounce|spam/i;
  const POSITIVE_TAGS = /abriu|opened|clicou|clicked|baixou|download|formul|converted|comprou/i;
  for (const row of tagsRes.rows) {
    const t = String(row.tag || '');
    if (NEGATIVE_TAGS.test(t)) negTagsCount++;
    else if (POSITIVE_TAGS.test(t)) posTagsCount++;
    if (t.startsWith('lj-banco-')) distinctBancos++;
    if (t.startsWith('lj-source-')) channelsSet.add(t.replace(/^lj-source-/, ''));
  }
  const totalTagsCount = tagsRes.rows.length;

  // Touchpoints distinct channels
  try {
    const tpRes = await db.query(
      `SELECT DISTINCT channel FROM lj_visitor_touchpoints
         WHERE user_id = $1 AND lj_visitor_id = $2 AND channel IS NOT NULL`,
      [userId, visitorId]
    );
    for (const row of tpRes.rows) channelsSet.add(row.channel);
  } catch (_) { /* tabela pode não existir em tenants antigos */ }

  // Total events (touchpoints + events + transitions + tag changes)
  let totalEvents = totalTagsCount;
  try {
    const tpc = await db.query(`SELECT COUNT(*) AS c FROM lj_visitor_touchpoints WHERE user_id = $1 AND lj_visitor_id = $2`, [userId, visitorId]);
    totalEvents += Number(tpc.rows[0]?.c || 0);
  } catch (_) {}
  try {
    const evc = await db.query(`SELECT COUNT(*) AS c FROM lj_visitor_events WHERE user_id = $1 AND lj_visitor_id = $2`, [userId, visitorId]);
    totalEvents += Number(evc.rows[0]?.c || 0);
  } catch (_) {}

  // Last event timestamp (mais recente entre last_seen, touchpoint, event, tag audit)
  let lastEventAt = null;
  try {
    const r = await db.query(
      `SELECT GREATEST(
         (SELECT MAX(last_seen_at) FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2),
         (SELECT MAX(touched_at) FROM lj_visitor_touchpoints WHERE user_id = $1 AND lj_visitor_id = $2),
         (SELECT MAX(occurred_at) FROM lj_visitor_events WHERE user_id = $1 AND lj_visitor_id = $2),
         (SELECT MAX(occurred_at) FROM lj_tag_audit_log WHERE user_id = $1 AND lj_visitor_id = $2)
       ) AS last_at`,
      [userId, visitorId]
    );
    lastEventAt = r.rows[0]?.last_at || null;
  } catch (_) {}
  const daysSinceLastEvent = lastEventAt
    ? (Date.now() - new Date(lastEventAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999;

  return {
    posTagsCount, negTagsCount, totalTagsCount,
    distinctChannels: channelsSet.size,
    distinctBancos,
    totalEvents,
    daysSinceLastEvent,
    lastEventAt
  };
}

// =====================================
// applyDecayBatch — cron diário recalcula todos com R atualizado
// =====================================
async function applyDecayBatch(db, userId, opts = {}) {
  const max = Math.min(Number(opts.maxVisitors || 200), 1000);
  const r = await db.query(
    `SELECT lj_visitor_id FROM lj_visitors WHERE user_id = $1
       ORDER BY updated_at ASC NULLS FIRST LIMIT $2`,
    [userId, max]
  );
  let processed = 0, errors = [];
  for (const row of r.rows) {
    try {
      await applyEvent(db, userId, row.lj_visitor_id);
      processed++;
    } catch (err) {
      if (errors.length < 5) errors.push({ visitor: row.lj_visitor_id, error: err.message });
    }
  }
  return { ok: true, processed, errors };
}

module.exports = {
  computeR, computeF, computeV,
  computeScore,
  computeCriteriaScore,
  readActiveScoreModel,
  applyEvent,
  applyDecayBatch,
  loadVisitorSignals,
  applyHierarchy,
  DEFAULT_WEIGHTS,
  ENTITY_HIERARCHY
};
