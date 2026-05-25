// V33.0.0 — Onda 2: Hotmart service.
// Processa webhook payload: dedup, match com visitor, promove pra Customer,
// grava purchase no audit log e atualiza métricas agregadas no visitor.
//
// Eventos suportados (V33.0.0):
//   - PURCHASE_APPROVED        → promove pra Customer + grava purchase
//   - PURCHASE_COMPLETE        → idem (alguns produtos usam este)
//   - PURCHASE_REFUNDED        → grava purchase com status='refunded' (não reverte entity_type)
//   - PURCHASE_CHARGEBACK      → grava com status='chargeback'
//   - PURCHASE_CANCELED        → grava com status='canceled'
// Outros eventos (BILLET_PRINTED, EXPIRED, etc) ignorados pra MVP.

const transitionEngine = require('./lj-transition-engine');

const POSITIVE_EVENTS = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE']);
const NEGATIVE_EVENTS = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED']);

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

async function processWebhook({ tenantDb, userId, payload, productMappings }) {
  const data = extractPurchaseData(payload);
  if (!data.transactionId) return { ok: false, message: 'transaction_id ausente.' };
  if (!data.buyerEmail && !data.buyerPhone) return { ok: false, message: 'buyer sem email/phone.' };

  // Mapeia produto Hotmart → produto LJ (se configurado)
  const productIdLj = (productMappings && data.productIdHotmart)
    ? (Number(productMappings[data.productIdHotmart]) || null)
    : null;

  const purchaseStatus = POSITIVE_EVENTS.has(data.event) ? 'approved'
                       : NEGATIVE_EVENTS.has(data.event) ? data.event.toLowerCase().replace('purchase_', '')
                       : 'other';

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

  // Eventos negativos: só registram, não promovem.
  if (!POSITIVE_EVENTS.has(data.event)) {
    return { ok: true, processed: 'recorded_only', event: data.event };
  }

  // Match/cria visitor e promove via engine (Lead→Customer ou Suspect→Customer)
  const { visitor, created } = await findOrCreateVisitor(
    tenantDb, userId, productIdLj, data.buyerEmail, data.buyerName, data.buyerPhone
  );

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
    new_stage: transition.newStage
  };
}

module.exports = { processWebhook, extractPurchaseData };
