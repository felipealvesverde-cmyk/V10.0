// V15 — LP Analytics Engine
// Calcula KPIs por LP a partir dos eventos coletados.
window.LpAnalyticsEngine = {
  KPIS: ['pageviews', 'sessions', 'avgScrollDepth', 'ctaClicks', 'formStarted', 'formSubmitted', 'checkoutClicks', 'exits'],

  analytics(lpId) {
    const entry = (App.state.lpRegistry || {})[lpId];
    if (!entry) return null;
    const events = (App.state.lpEvents || []).filter(e => e.trackingId === entry.trackingId);
    const out = {
      pageviews: 0,
      sessions: new Set(),
      ctaClicks: 0,
      formStarted: 0,
      formSubmitted: 0,
      checkoutClicks: 0,
      scrollDepths: [],
      exits: 0
    };
    for (const event of events) {
      if (event.eventType === 'pageview') {
        out.pageviews += 1;
        if (event.sessionId) out.sessions.add(event.sessionId);
      } else if (event.eventType?.startsWith('scroll_')) {
        const depth = Number(event.eventType.replace('scroll_', ''));
        if (Number.isFinite(depth)) out.scrollDepths.push(depth);
      } else if (event.eventType === 'cta_click') out.ctaClicks += 1;
      else if (event.eventType === 'form_started') out.formStarted += 1;
      else if (event.eventType === 'form_submitted') out.formSubmitted += 1;
      else if (event.eventType === 'checkout_click') out.checkoutClicks += 1;
      else if (event.eventType === 'exit') out.exits += 1;
    }
    const avgScroll = out.scrollDepths.length ? out.scrollDepths.reduce((a, b) => a + b, 0) / out.scrollDepths.length : 0;
    const ctaCTR = out.pageviews ? (out.ctaClicks / out.pageviews) * 100 : 0;
    const formConv = out.pageviews ? (out.formSubmitted / out.pageviews) * 100 : 0;
    return {
      pageviews: out.pageviews,
      sessions: out.sessions.size,
      avgScrollDepth: Math.round(avgScroll),
      ctaClicks: out.ctaClicks,
      formStarted: out.formStarted,
      formSubmitted: out.formSubmitted,
      checkoutClicks: out.checkoutClicks,
      exits: out.exits,
      ctaCTR: Math.round(ctaCTR * 10) / 10,
      formConversion: Math.round(formConv * 10) / 10
    };
  }
};
