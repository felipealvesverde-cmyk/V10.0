// V33.0.0 — Onda 1.2: gera o snippet JS pra cliente colar na LP da campanha.
//
// GET /api/tracker-snippet?campaign_id=123
//   → Retorna { ok, snippet: "<script>...</script>", trackerToken }
//
// Privado (exige JWT do dono do LJ). O snippet gerado contém:
//   - LJ_TRACKER_TOKEN: opaco (encrypt(tenant_id:user_id:campaign_id))
//   - LJ_TRACKER_ENDPOINT: URL base dos endpoints públicos (init/event)
//   - Lógica de cookie lj_visitor_id + envio de page_view automático + helper
//     window.LJTrack(eventType, payload) pra disparar eventos custom no site.
//
// Token é opaco: backend decifra pra saber tenant/user/campaign sem lookup.
// Cliente só copia e cola — não sabe nem precisa saber a estrutura interna.

const { encrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!isEncryptionReady()) {
    return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });
  }

  const userId = req.user.sub;
  const tenantId = req.user.tenantId;
  if (!tenantId) {
    return res.status(400).json({ ok: false, message: 'Sua conta não tem tenant ativo. Configure um produto antes de gerar tracker.' });
  }

  const campaignId = Number(req.query?.campaign_id || req.query?.campaignId || 0);
  if (!campaignId) {
    return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });
  }

  // Token opaco: encripta {tenant_id, user_id, campaign_id, issued_at}.
  // Backend dos endpoints públicos vai decifrar e validar.
  const payload = JSON.stringify({ t: tenantId, u: userId, c: campaignId, iat: Date.now() });
  let trackerToken;
  try {
    trackerToken = encrypt(payload);
  } catch (err) {
    return res.status(500).json({ ok: false, message: `Falha ao gerar token: ${err.message}` });
  }

  // URL base da API — host atual do request. Funciona em staging/prod sem hardcode.
  const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const apiBase = `${proto}://${host}`;

  // Snippet pronto pra colar no <head> da LP. Minifiable mas mantém legível
  // pra o cliente conferir antes de aplicar.
  const snippet = `<!-- LeadJourney tracker — campanha ${campaignId} -->
<script>
(function(){
  var T="${trackerToken}";
  var B="${apiBase}";
  var K="lj_vid";
  function rd(){var m=document.cookie.match(new RegExp("(?:^|; )"+K+"=([^;]*)"));return m?decodeURIComponent(m[1]):null;}
  function wr(v){var d=new Date();d.setTime(d.getTime()+365*864e5);document.cookie=K+"="+encodeURIComponent(v)+";expires="+d.toUTCString()+";path=/;samesite=lax";}
  function qs(){var p={},s=location.search.substring(1).split("&");for(var i=0;i<s.length;i++){var kv=s[i].split("=");if(kv[0])p[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||"");}return p;}
  function send(path,body){
    try{
      var x=new XMLHttpRequest();
      x.open("POST",B+path,true);
      x.setRequestHeader("Content-Type","application/json");
      x.send(JSON.stringify(body));
    }catch(e){}
  }
  var vid=rd();
  var q=qs();
  var ctx={
    tracker_token:T,
    utm_source:q.utm_source||null,utm_medium:q.utm_medium||null,utm_campaign:q.utm_campaign||null,
    utm_content:q.utm_content||null,utm_term:q.utm_term||null,
    referrer_url:document.referrer||null,landing_url:location.href
  };
  // Init: backend cria/recupera visitor + grava primeiro touchpoint se for novo
  try{
    var x=new XMLHttpRequest();
    x.open("POST",B+"/api/tracker-init",true);
    x.setRequestHeader("Content-Type","application/json");
    x.onreadystatechange=function(){
      if(x.readyState===4&&x.status===200){
        try{var r=JSON.parse(x.responseText);if(r.ok&&r.lj_visitor_id){wr(r.lj_visitor_id);vid=r.lj_visitor_id;
          // Dispara page_view automático após init
          send("/api/tracker-event",{tracker_token:T,lj_visitor_id:vid,event_type:"page_view",event_payload:{url:location.href,title:document.title}});
        }}catch(e){}
      }
    };
    x.send(JSON.stringify(Object.assign({lj_visitor_id:vid},ctx)));
  }catch(e){}
  // Helper público: window.LJTrack("form_submit", {email:"..."}) dispara evento custom
  window.LJTrack=function(eventType,payload){
    var v=rd();if(!v)return;
    send("/api/tracker-event",{tracker_token:T,lj_visitor_id:v,event_type:eventType,event_payload:payload||{}});
  };
})();
</script>
<!-- /LeadJourney tracker -->`;

  return res.status(200).json({
    ok: true,
    snippet,
    trackerToken,
    campaignId,
    apiBase
  });
};
