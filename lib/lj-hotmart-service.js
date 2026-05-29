// V35.2.0 — Hotmart service expandido.
// Processa webhook payload: dedup, match com visitor, aplica tags
// derivadas, promove pra Customer quando apropriado, grava purchase
// no audit log e atualiza métricas agregadas no visitor.
//
// Eventos suportados (V35.2.0):
//   POSITIVOS (promovem pra Customer):
//     - PURCHASE_APPROVED         → tag lj-compra-aprovada-hotmart
//     - PURCHASE_COMPLETE         → idem (alguns produtos usam este)
//   NEGATIVOS (registram, não revertem entity_type):
//     - PURCHASE_REFUNDED         → tag lj-compra-reembolsada-hotmart
//     - PURCHASE_CHARGEBACK       → tag lj-compra-chargeback-hotmart
//     - PURCHASE_CANCELED         → tag lj-compra-cancelada-hotmart
//   INTERMEDIÁRIOS (sinalizam intent/risco):
//     - PURCHASE_BILLET_PRINTED   → tag lj-boleto-gerado-hotmart (Vendas MOF)
//     - PURCHASE_DELAYED          → tag lj-pagamento-atrasado-hotmart
//     - PURCHASE_OUT_OF_SHOPPING_CART → tag lj-cart-abandoned-hotmart (Vendas TOF)
//     - PURCHASE_EXPIRED          → tag lj-compra-expirada-hotmart
//   ASSINATURAS (afetam CS BOF):
//     - SUBSCRIPTION_CANCELLATION → tag lj-churn-hotmart + transita pra CS BOF se for customer
//     - SWITCH_PLAN               → tag lj-switch-plan-hotmart (expansão/contração)
//     - UPDATE_SUBSCRIPTION_CHARGE_DATE → tag lj-charge-date-changed-hotmart (audit-only)

const transitionEngine = require('./lj-transition-engine');

const POSITIVE_EVENTS = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);
const NEGATIVE_EVENTS = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED', 'PURCHASE_EXPIRED']);
const INTERMEDIATE_EVENTS = new Set(['PURCHASE_BILLET_PRINTED', 'PURCHASE_DELAYED', 'PURCHASE_OUT_OF_SHOPPING_CART']);
const SUBSCRIPTION_EVENTS = new Set(['SUBSCRIPTION_CANCELLATION', 'SWITCH_PLAN', 'UPDATE_SUBSCRIPTION_CHARGE_DATE']);

// Mapeamento canônico: evento Hotmart → { tag, statusLabel, semantic }
// semantic = bucket usado pelo sub-funil (info pra UI mostrar sugestões depois)
const EVENT_MAP = {
  PURCHASE_APPROVED:           { tag: 'lj-compra-aprovada-hotmart',     status: 'approved',         semantic: 'vendas-bof' },
  PURCHASE_COMPLETE:           { tag: 'lj-compra-completa-hotmart',     status: 'approved',         semantic: 'vendas-bof' },
  PURCHASE_REFUNDED:           { tag: 'lj-compra-reembolsada-hotmart',  status: 'refunded',         semantic: 'cs-bof' },
  PURCHASE_CHARGEBACK:         { tag: 'lj-compra-chargeback-hotmart',   status: 'chargeback',       semantic: 'cs-bof' },
  PURCHASE_CANCELED:           { tag: 'lj-compra-cancelada-hotmart',    status: 'canceled',         semantic: 'vendas-bof' },
  PURCHASE_EXPIRED:            { tag: 'lj-compra-expirada-hotmart',     status: 'expired',          semantic: 'vendas-mof' },
  PURCHASE_BILLET_PRINTED:     { tag: 'lj-boleto-gerado-hotmart',       status: 'billet_printed',   semantic: 'vendas-mof' },
  PURCHASE_DELAYED:            { tag: 'lj-pagamento-atrasado-hotmart',  status: 'delayed',          semantic: 'vendas-mof' },
  PURCHASE_OUT_OF_SHOPPING_CART: { tag: 'lj-cart-abandoned-hotmart',    status: 'cart_abandoned',   semantic: 'vendas-tof' },
  SUBSCRIPTION_CANCELLATION:   { tag: 'lj-churn-hotmart',               status: 'sub_cancelled',    semantic: 'cs-bof' },
  SWITCH_PLAN:                 { tag: 'lj-switch-plan-hotmart',         status: 'sub_switched',     semantic: 'cs-mof' },
  UPDATE_SUBSCRIPTION_CHARGE_DATE: { tag: 'lj-charge-date-changed-hotmart', status: 'sub_date_changed', semantic: 'cs-mof' }
};

function extractPurchaseData(payload) {
  // Hotmart v2 payload structure
  const event = String(payload?.event || '').toUpperCase();
  const data = payload?.data || {};
  const transaction = data?.purchase?.transaction || data?.purchase?.code || payload?.id || null;
  const buyer = data?.buyer || {};
  const product = data?.product || {};
  const purchase = data?.purchase || {};
  const price = purchase?.price || {};
  const commission = purchase?.commission || {};
  const subscription = data?.subscription || {};

  const valueCents = Math.round(Number(price?.value || 0) * 100);
  const commissionCents = Math.round(Number(commission?.value || 0) * 100);
  const currency = String(price?.currency_value || 'BRL').toUpperCase();
  const occurredAt = purchase?.approved_date ? new Date(purchase.approved_date).toISOString()
                    : payload?.creation_date ? new Date(payload.creation_date).toISOString()
                    : new Date().toISOString();

  return {
    event,
    transactionId: transaction ? String(transaction) : null,
    productIdHotmart: product?.id ? String(product.id) : null,
    productName: product?.name || null,
    buyerEmail: String(buyer?.email || '').trim().toLowerCase() || null,
    buyerName: buyer?.name || null,
    buyerPhone: buyer?.checkout_phone || buyer?.phone || null,
    valueCents,
    commissionCents,
    currency,
    isRecurring: !!(subscription?.plan?.id || purchase?.is_subscription),
    recurrenceNumber: Number(purchase?.recurrence_number || 1),
    occurredAt,
    rawPayload: payload
  };
}

async function findOrCreateVisitor(tenantDb, userId, productIdLj, buyerEmail, buyerName, buyerPhone) {
  // 1ª tentativa: match por email exato
  if (buyerEmail) {
    const byEmail = await tenantDb.query(
      `SELECT * FROM lj_visitors WHERE user_id = $1 AND LOWER(email) = $2 LIMIT 1`,
      [userId, buyerEmail]
    );
    if (byEmail.rows.length > 0) return { visitor: byEmail.rows[0], created: false };
  }
  // 2ª tentativa: match por phone
  if (buyerPhone) {
    const byPhone = await tenantDb.query(
      `SELECT * FROM lj_visitors WHERE user_id = $1 AND phone = $2 LIMIT 1`,
      [userId, buyerPhone]
    );
    if (byPhone.rows.length > 0) return { visitor: byPhone.rows[0], created: false };
  }
  // Não achou — cria visitor novo direto como Customer (compra direta)
  const newId = `hot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const created = await tenantDb.query(
    `INSERT INTO lj_visitors
      (lj_visitor_id, user_id, product_id, entity_type, current_stage, email, phone, name, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, 'suspect', 'marketing-tof', $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [newId, userId, productIdLj, buyerEmail, buyerPhone, buyerName]
  );
  return { visitor: created.rows[0], created: true };
}

// V35.2.0 — Aplica tag em visitor (idempotente, ON CONFLICT DO NOTHING).
// `category` opcional pra categorização — usa 'hotmart' por padrão.
async function applyHotmartTag(tenantDb, userId, ljVisitorId, tag, source = 'hotmart_webhook', category = 'hotmart') {
  if (!ljVisitorId || !tag) return;
  try {
    await tenantDb.query(
      `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
      [userId, ljVisitorId, tag, source, category]
    );
  } catch (err) {
    console.warn('[hotmart-service applyHotmartTag]', err.message);
  }
}

async function processWebhook({ tenantDb, userId, payload, productMappings }) {
  const data = extractPurchaseData(payload);
  if (!data.transactionId) return { ok: false, message: 'transaction_id ausente.' };
  if (!data.buyerEmail && !data.buyerPhone) return { ok: false, message: 'buyer sem email/phone.' };

  // Mapeia produto Hotmart → produto LJ (se configurado)
  const productIdLj = (productMappings && data.productIdHotmart)
    ? (Number(productMappings[data.productIdHotmart]) || null)
    : null;

  const eventMeta = EVENT_MAP[data.event] || { tag: null, status: 'other', semantic: null };
  const purchaseStatus = eventMeta.status;

  // Dedup: UPSERT em purchases por (user_id, transaction_id)
  await tenantDb.query(
    `INSERT INTO lj_hotmart_purchases
      (user_id, transaction_id, product_id_hotmart, product_id_lj, buyer_email, buyer_name, buyer_phone,
       purchase_status, transaction_value_cents, commission_cents, currency,
       is_recurring, recurrence_number, raw_payload, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (user_id, transaction_id) DO UPDATE SET
       purchase_status = EXCLUDED.purchase_status,
       raw_payload = EXCLUDED.raw_payload`,
    [
      userId, data.transactionId, data.productIdHotmart, productIdLj,
      data.buyerEmail, data.buyerName, data.buyerPhone,
      purchaseStatus, data.valueCents, data.commissionCents, data.currency,
      data.isRecurring, data.recurrenceNumber,
      JSON.stringify(data.rawPayload), data.occurredAt
    ]
  );

  // V35.2.0 — Match com visitor existente pra TODOS os eventos (intermediate,
  // negative, subscription). Só cria visitor novo se for POSITIVE_EVENTS
  // (compra de fato — antes disso é sinal, não cliente confirmado).
  let visitor = null, created = false;
  if (POSITIVE_EVENTS.has(data.event)) {
    const r = await findOrCreateVisitor(tenantDb, userId, productIdLj, data.buyerEmail, data.buyerName, data.buyerPhone);
    visitor = r.visitor;
    created = r.created;
  } else {
    // Match somente — não cria. Se não acha, evento é registrado mas não taggado.
    if (data.buyerEmail) {
      const byEmail = await tenantDb.query(
        `SELECT * FROM lj_visitors WHERE user_id = $1 AND LOWER(email) = $2 LIMIT 1`,
        [userId, data.buyerEmail]
      );
      if (byEmail.rows.length) visitor = byEmail.rows[0];
    }
    if (!visitor && data.buyerPhone) {
      const byPhone = await tenantDb.query(
        `SELECT * FROM lj_visitors WHERE user_id = $1 AND phone = $2 LIMIT 1`,
        [userId, data.buyerPhone]
      );
      if (byPhone.rows.length) visitor = byPhone.rows[0];
    }
  }

  // V35.2.0 — Aplica tag derivada se visitor existe
  if (visitor && eventMeta.tag) {
    await applyHotmartTag(tenantDb, userId, visitor.lj_visitor_id, eventMeta.tag);
  }

  // Eventos não-positivos: tag aplicada, sem promoção
  if (!POSITIVE_EVENTS.has(data.event)) {
    // V35.2.0 — SUBSCRIPTION_CANCELLATION: se visitor já é customer, garante movimento pra CS BOF
    let transitionResult = null;
    if (data.event === 'SUBSCRIPTION_CANCELLATION' && visitor && visitor.entity_type === 'customer') {
      try {
        transitionResult = await transitionEngine.applyEventRules({
          tenantDb, userId, visitor,
          eventType: 'subscription_cancelled',
          payload: { email: data.buyerEmail, phone: data.buyerPhone, name: data.buyerName },
          source: 'hotmart_webhook',
          campaignId: null,
          rawPayloadExtras: { transaction_id: data.transactionId, hotmart_event: data.event }
        });
      } catch (err) {
        console.warn('[hotmart-service subscription-cancel transition]', err.message);
      }
    }
    return {
      ok: true,
      processed: visitor ? 'tagged' : 'recorded_only',
      event: data.event,
      tag: eventMeta.tag,
      semantic: eventMeta.semantic,
      visitor_id: visitor?.lj_visitor_id || null,
      churn_transition: transitionResult?.promoted || false
    };
  }

  // POSITIVE: promove via engine (Lead→Customer ou Suspect→Customer)
  const transition = await transitionEngine.applyEventRules({
    tenantDb, userId, visitor,
    eventType: 'payment_confirmed',
    payload: { email: data.buyerEmail, phone: data.buyerPhone, name: data.buyerName },
    source: 'hotmart_webhook',
    campaignId: null,
    rawPayloadExtras: { transaction_id: data.transactionId, hotmart_event: data.event }
  });

  // Atualiza métricas agregadas no visitor (purchase count + value + datas)
  await tenantDb.query(
    `UPDATE lj_visitors
        SET hotmart_first_purchase_at = COALESCE(hotmart_first_purchase_at, $3),
            hotmart_last_purchase_at = $3,
            hotmart_purchase_count = hotmart_purchase_count + 1,
            total_value_cents = total_value_cents + $4,
            external_hotmart_purchase_id = $5,
            updated_at = NOW()
      WHERE user_id = $1 AND lj_visitor_id = $2`,
    [userId, visitor.lj_visitor_id, data.occurredAt, data.valueCents, data.transactionId]
  );

  return {
    ok: true,
    processed: 'promoted',
    visitor_id: visitor.lj_visitor_id,
    visitor_created: created,
    promoted: transition.promoted,
    new_entity_type: transition.newEntityType,
    new_stage: transition.newStage,
    tag: eventMeta.tag,
    semantic: eventMeta.semantic
  };
}

module.exports = { processWebhook, extractPurchaseData, applyHotmartTag, EVENT_MAP };
