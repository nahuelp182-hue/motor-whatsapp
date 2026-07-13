/* MICELIUM-CURIOSOS v1
 * Tracking de primera parte para separar el tráfico de campaña (Meta TOFU)
 * del SEO/directo de Google, medir permanencia/curiosidad y seguir retorno
 * + recompra en el tiempo.
 *
 * - vid: UUID de primera parte (localStorage + cookie 2 años). Identidad estable.
 * - first-touch: canal sellado en la 1ra visita (el server nunca lo pisa).
 * - por cada página: mide dwell (tiempo visible) + max scroll + si vio producto,
 *   y manda 1 beacon al ocultar la pestaña (navigator.sendBeacon, no bloquea).
 * - thank-you page: manda evento 'purchase' con nº de orden → cose anónimo↔comprador.
 * Inyectado en TN via external-codes (bootstrap img-onerror -> este script).
 */
(function () {
  if (window.__curInit) return; window.__curInit = true;

  /* ================== CONFIG ================== */
  var API      = 'https://mw-micelium.vercel.app/api/track';
  var VID_KEY  = '__cur_vid';       // UUID de primera parte
  var ENGAGE_MS = 10000;            // dwell mínimo para "engaged"
  var ENGAGE_SCROLL = 50;           // % scroll mínimo para "engaged"
  /* ============================================ */

  /* ---------- identidad estable ---------- */
  function uuid() {
    try { return crypto.randomUUID(); }
    catch (e) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  }
  function getCookie(n) {
    var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }
  function setCookie(n, v) {
    var d = new Date(Date.now() + 2 * 365 * 864e5).toUTCString();
    document.cookie = n + '=' + encodeURIComponent(v) + ';expires=' + d + ';path=/;SameSite=Lax';
  }
  function getVid() {
    var v = '';
    try { v = localStorage.getItem(VID_KEY) || ''; } catch (e) {}
    if (!v) v = getCookie(VID_KEY);
    if (!v) v = uuid();
    try { localStorage.setItem(VID_KEY, v); } catch (e) {}
    setCookie(VID_KEY, v); // refresca expiración a 2 años
    return v;
  }

  /* ---------- clasificación de canal (mirror lib/attribution.ts) ---------- */
  function param(k) {
    try { return new URLSearchParams(location.search).get(k) || ''; }
    catch (e) { return ''; }
  }
  function refHost() {
    try { return document.referrer ? new URL(document.referrer).hostname : ''; }
    catch (e) { return ''; }
  }
  function classify() {
    var src = (param('utm_source') || '').toLowerCase();
    var med = (param('utm_medium') || '').toLowerCase();
    var fbclid = param('fbclid');
    var gclid  = param('gclid');
    var host = refHost();
    var isMetaRef = /(^|\.)facebook\.com$|(^|\.)instagram\.com$|(^|\.)fb\.com$|l\.instagram|lm\.facebook/.test(host);
    var isSearch  = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia)\./.test(host);

    if (fbclid || ['fb', 'ig', 'facebook', 'instagram'].indexOf(src) >= 0 || isMetaRef) return 'meta_ads';
    if (gclid || src === 'google' || med === 'cpc') return 'google_ads';
    if (isSearch) return 'seo';
    if (src || med) return 'otro_utm';
    if (!document.referrer) return 'directo';
    return 'otro_utm'; // referral de otro sitio
  }

  /* ---------- contexto de la página ---------- */
  var VID = getVid();
  var CHANNEL = classify();
  var SOURCE = (param('utm_source') || refHost() || '').slice(0, 120);
  var CAMPAIGN = param('utm_campaign').slice(0, 120);
  var LANDING = (location.pathname + location.search).slice(0, 500);
  var IS_PRODUCT = /\/productos?\//i.test(location.pathname);
  var IS_THANKYOU = /(checkout).*(success)|\/gracias|thank/i.test(location.pathname + location.search);

  /* ---------- medición dwell + scroll ---------- */
  var start = Date.now();
  var visibleMs = 0;
  var lastVisible = document.visibilityState === 'visible' ? Date.now() : 0;
  var maxScroll = 0;

  function tickScroll() {
    var h = document.documentElement;
    var full = Math.max(h.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (full <= 0) return;
    var pct = Math.round(((window.scrollY || h.scrollTop || 0) + window.innerHeight) / full * 100);
    if (pct > maxScroll) maxScroll = Math.min(100, pct);
  }
  window.addEventListener('scroll', tickScroll, { passive: true });
  tickScroll();

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      lastVisible = Date.now();
    } else if (lastVisible) {
      visibleMs += Date.now() - lastVisible;
      lastVisible = 0;
    }
  });

  function dwell() {
    var d = visibleMs;
    if (lastVisible) d += Date.now() - lastVisible;
    return d;
  }

  /* ---------- pageviews por sesión de pestaña ---------- */
  var pv = 1;
  try {
    pv = (parseInt(sessionStorage.getItem('__cur_pv') || '0', 10) || 0) + 1;
    sessionStorage.setItem('__cur_pv', String(pv));
  } catch (e) {}

  /* ---------- envío ---------- */
  function send(extra) {
    var d = dwell();
    var payload = Object.assign({
      vid: VID, channel: CHANNEL, source: SOURCE, campaign: CAMPAIGN, landing: LANDING,
      duration_ms: d, max_scroll: maxScroll, pageviews: pv,
      viewed_product: IS_PRODUCT,
      engaged: d >= ENGAGE_MS || maxScroll >= ENGAGE_SCROLL || IS_PRODUCT,
    }, extra || {});
    var body = JSON.stringify(payload);
    try {
      var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      if (navigator.sendBeacon && navigator.sendBeacon(API, blob)) return;
    } catch (e) {}
    try { fetch(API, { method: 'POST', body: body, keepalive: true, mode: 'cors' }); } catch (e) {}
  }

  /* ---------- beacon de sesión al salir (una sola vez) ---------- */
  var sent = false;
  function flush() {
    if (sent) return; sent = true;
    send({ event: 'session' });
  }

  /* ---------- thank-you: cosido a compra ---------- */
  if (IS_THANKYOU) {
    var orderNum = null;
    // TN suele exponer el nº de orden en la URL o en el texto del recibo.
    var m = (location.pathname + location.search).match(/(?:order|orden|numero|number)[=/_-]?(\d{3,})/i);
    if (m) orderNum = parseInt(m[1], 10);
    if (!orderNum) {
      var t = (document.body ? document.body.innerText : '').match(/#\s?(\d{3,})/);
      if (t) orderNum = parseInt(t[1], 10);
    }
    var email = null;
    var em = (document.body ? document.body.innerText : '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (em) email = em[0];
    send({ event: 'purchase', order_number: orderNum, email: email });
    sent = true; // el purchase ya creó la visita → evita un beacon de sesión redundante
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
})();
