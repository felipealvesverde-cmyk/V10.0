/*
 * Journey Tracker — pixel standalone V15
 * Cole este script no <head> ou no rodapé da LP do RD Station.
 * Exemplo:
 *   <script async src="https://cdn.seudominio.app/journey-tracker.js"
 *           data-tracking-id="trk_xxxxxxxx"
 *           data-endpoint="https://seudominio.app/api/lp-event"></script>
 *
 * Eventos detectados automaticamente:
 * pageview, scroll_25/50/75/90, cta_click, form_started, form_submitted,
 * checkout_click, exit, video_watched, time_on_page_60s, time_on_page_180s.
 *
 * Identificação: cookie próprio (_jt_sid) + captura de email/phone em form_submitted.
 */
(function () {
  if (window.__JOURNEY_TRACKER_LOADED) return;
  window.__JOURNEY_TRACKER_LOADED = true;

  var script = document.currentScript || document.querySelector('script[data-tracking-id]');
  if (!script) return;
  var trackingId = script.getAttribute('data-tracking-id') || '';
  var endpoint = script.getAttribute('data-endpoint') || '/api/lp-event';
  if (!trackingId) return;

  function uuid() {
    return 'jt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function cookie(name, value) {
    if (value !== undefined) {
      var maxAge = 60 * 60 * 24 * 365;
      document.cookie = name + '=' + value + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
      return value;
    }
    var match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  var sessionId = cookie('_jt_sid') || cookie('_jt_sid', uuid());
  var sentScrollMarks = {};
  var sentTimers = {};
  var startedAt = Date.now();

  function send(eventType, extra) {
    try {
      var payload = {
        trackingId: trackingId,
        sessionId: sessionId,
        url: location.href,
        path: location.pathname,
        referrer: document.referrer || '',
        timestamp: new Date().toISOString(),
        eventType: eventType,
        extra: extra || {},
        lead: extra && extra.lead ? extra.lead : null
      };
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function () {});
      }
    } catch (error) {
      // silently swallow
    }
  }

  // Pageview
  send('pageview');

  // Scroll
  var scrollMarks = [25, 50, 75, 90];
  window.addEventListener('scroll', function () {
    var maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    var percent = Math.round((window.scrollY / maxScroll) * 100);
    for (var i = 0; i < scrollMarks.length; i++) {
      var mark = scrollMarks[i];
      if (percent >= mark && !sentScrollMarks[mark]) {
        sentScrollMarks[mark] = true;
        send('scroll_' + mark);
      }
    }
  }, { passive: true });

  // CTA clicks: qualquer link/botão com data-jt-cta ou role="cta"
  document.addEventListener('click', function (event) {
    var target = event.target;
    while (target && target !== document.body) {
      if (target.hasAttribute && (target.hasAttribute('data-jt-cta') || target.getAttribute('role') === 'cta')) {
        send('cta_click', { label: target.textContent ? target.textContent.trim().slice(0, 80) : '', href: target.href || '' });
        return;
      }
      if (target.tagName === 'A' && /checkout|comprar|buy|carrinho/i.test(target.href || '')) {
        send('checkout_click', { href: target.href });
        return;
      }
      target = target.parentNode;
    }
  }, true);

  // Form events
  var formStarted = {};
  document.addEventListener('focusin', function (event) {
    var form = event.target && event.target.form;
    if (form && !formStarted[form.id || '_default']) {
      formStarted[form.id || '_default'] = true;
      send('form_started', { formId: form.id || null, formName: form.getAttribute('name') || null });
    }
  });
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    var formData = new FormData(form);
    var lead = {};
    formData.forEach(function (value, key) {
      var k = String(key).toLowerCase();
      if (/email/.test(k)) lead.email = String(value);
      else if (/phone|tel|whats/.test(k)) lead.phone = String(value);
      else if (/name|nome/.test(k)) lead.name = String(value);
      else if (/company|empresa/.test(k)) lead.company = String(value);
    });
    send('form_submitted', { formId: form.id || null, lead: lead });
  });

  // Time on page
  setTimeout(function () { if (!sentTimers[60]) { sentTimers[60] = true; send('time_on_page_60s'); } }, 60000);
  setTimeout(function () { if (!sentTimers[180]) { sentTimers[180] = true; send('time_on_page_180s'); } }, 180000);

  // Video watched
  document.addEventListener('ended', function (event) {
    if (event.target && (event.target.tagName === 'VIDEO' || event.target.tagName === 'AUDIO')) {
      send('video_watched', { src: event.target.currentSrc || '' });
    }
  }, true);

  // Exit
  window.addEventListener('beforeunload', function () {
    send('exit', { duration: Math.round((Date.now() - startedAt) / 1000) });
  });
})();
