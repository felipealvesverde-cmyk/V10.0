// V35.1.0 — Engine de reconciliação Hotmart via Sales API.
//
// Puxa histórico de vendas, converte cada item ao formato webhook e
// reprocessa via processWebhook (que já tem dedup por transaction_id).
// Idempotente: rodar 2x não duplica purchase.
//
// Fluxo:
//   1. Lê config OAuth + sync_window_days do user
//   2. Pagina /sales/history start_date=(hoje - window) end_date=hoje
//   3. Pra cada item: adapta + processWebhook
//   4. Grava last_sync_at + last_sync_result em hotmart_config

const { iterSalesHistory } = require('./hotmart-oauth');
const hotmartService = require('./lj-hotmart-service');

// Mapeia transaction_status da Sales API → event do webhook
const STATUS_TO_EVENT = {
  APPROVED: 'PURCHASE_APPROVED',
  COMPLETE: 'PURCHASE_COMPLETE',
  REFUNDED: 'PURCHASE_REFUNDED',
  CHARGEBACK: 'PURCHASE_CHARGEBACK',
  CANCELED: 'PURCHASE_CANCELED',
  BILLET_PRINTED: 'PURCHASE_BILLET_PRINTED',
  EXPIRED: 'PURCHASE_EXPIRED',
  DELAYED: 'PURCHASE_DELAYED',
  PROTEST: 'PURCHASE_PROTEST',
  WAITING_PAYMENT: 'PURCHASE_BILLET_PRINTED' // boleto/pix aguardando
};

function salesItemToWebhookPayload(item) {
  const status = String(item?.purchase?.status || item?.transaction_status || 'APPROVED').toUpperCase();
  return {
    event: STATUS_TO_EVENT[status] || 'PURCHASE_APPROVED',
    creation_date: item?.purchase?.approved_date || item?.purchase?.order_date || null,
    data: {
      buyer: item?.buyer || {},
      product: item?.product || {},
      purchase: item?.purchase || item,
      subscription: item?.subscription || null
    }
  };
}

/**
 * Roda 1 ciclo de reconciliação pra um user. Retorna stats.
 */
async function reconcileUser(tenantDb, userId, opts = {}) {
  const cfgR = await tenantDb.query(
    `SELECT product_mappings, sync_window_days FROM hotmart_config WHERE user_id = $1`,
    [userId]
  );
  if (!cfgR.rows.length) {
    return { ok: false, message: 'Sem hotmart_config — cliente não configurou.' };
  }
  const cfg = cfgR.rows[0];
  const productMappings = cfg.product_mappings || {};
  const windowDays = opts.windowDays || Number(cfg.sync_window_days) || 90;

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);

  const stats = {
    windowDays, startDate, endDate,
    seen: 0, processed: 0, promoted: 0, errors: 0,
    errorSample: []
  };

  try {
    for await (const batch of iterSalesHistory(tenantDb, userId, { startDate, endDate, pageSize: 50 })) {
      for (const item of batch) {
        stats.seen++;
        try {
          const payload = salesItemToWebhookPayload(item);
          const result = await hotmartService.processWebhook({
            tenantDb, userId, payload, productMappings
          });
          if (result.ok) {
            stats.processed++;
            if (result.processed === 'promoted') stats.promoted++;
          }
        } catch (err) {
          stats.errors++;
          if (stats.errorSample.length < 5) {
            stats.errorSample.push(err.message?.slice(0, 200) || 'unknown');
          }
        }
      }
    }
  } catch (err) {
    stats.fatal = err.message;
  }

  // Persiste resultado do sync
  await tenantDb.query(
    `UPDATE hotmart_config
        SET last_sync_at = NOW(), last_sync_result = $1, updated_at = NOW()
      WHERE user_id = $2`,
    [JSON.stringify(stats), userId]
  );

  return { ok: !stats.fatal, ...stats };
}

module.exports = { reconcileUser, salesItemToWebhookPayload };
