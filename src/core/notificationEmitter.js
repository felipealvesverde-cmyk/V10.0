// V37.4.3 — Emitter de notifications client-side.
//
// Wrapper sobre fetch('/api/notification-emit') que silencia erros.
// Use pra disparar notification quando algo rolar em ações client-side
// (criar campanha, mudar status, etc).
//
// Uso:
//   window.LJEmit({
//     audience: 'tenant_wide' | userId | [user_ids] | { role: 'owner' },
//     kind: 'event.campaign_created',
//     category: 'event',
//     severity: 'info',
//     title: 'Nova campanha criada',
//     data: { campaignId, campaignName },
//     entityKind: 'campaign',
//     entityId: String(campaignId)
//   });

window.LJEmit = async function emitNotification(opts) {
  try {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return { ok: false, skipped: 'no_token' };
    const r = await fetch('/api/notification-emit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(opts || {})
    });
    const data = await r.json();
    // Refresh counts no badge depois de emitir
    if (data?.ok && window.Actions?.loadNotifications) {
      setTimeout(() => Actions.loadNotifications(true), 500);
    }
    return data;
  } catch (err) {
    console.warn('[LJEmit] erro silencioso:', err.message);
    return { ok: false, error: err.message };
  }
};
