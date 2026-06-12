// V37.4.3 — Helper pra emitir notifications dos endpoints API.
//
// Wrapper sobre createNotification que silencia erros (não rompe o fluxo
// principal do endpoint se a notification falhar) e padroniza payload.
//
// Uso:
//   const { emit } = require('../lib/emit-notification');
//   await emit(req, {
//     audience: 'tenant_wide',
//     kind: 'event.product_created',
//     category: 'event',
//     severity: 'info',
//     title: 'Novo produto criado',
//     data: { productId: 123, productName: 'Atira.Pro' },
//     entityKind: 'product',
//     entityId: '123'
//   });

const { createNotification } = require('./notification-engine');

async function emit(req, opts) {
  try {
    if (!req?.tenantDb || !req?.user?.tenantId) return { ok: false, skipped: 'no_tenant_db_or_id' };
    return await createNotification({
      db: req.tenantDb,
      tenantId: req.user.tenantId,
      sourceUserId: req.user.sub,
      ...opts
    });
  } catch (err) {
    console.error('[emit-notification]', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { emit };
