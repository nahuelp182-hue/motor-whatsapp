/* MICELIUM-GEOGATE v1
 * Bloquea el acceso al storefront desde un radio de N km alrededor de un punto.
 * Geo-IP via ipwho.is (gratis, HTTPS, sin key) -> haversine -> veredicto.
 * Diseno FAIL-OPEN: si la API falla/tarda, NO bloquea (la tienda nunca se rompe).
 * Cachea el veredicto en sessionStorage (1 sola consulta por sesion).
 * Inyectado en TN via external-codes (bootstrap img-onerror -> este script).
 *
 * LIMITES CONOCIDOS (asumidos): geo-IP es nivel-ciudad (celulares ruteados por
 * capital provincial dan falsos), y se esquiva con VPN o JS desactivado.
 * Frena al vecino/competidor casual, no es un muro.
 */
(function () {
  if (window.__geogateInit) return; window.__geogateInit = true;

  /* =================== CONFIG — EDITAR ESTO =================== */
  var CENTER    = { lat: -29.904920, lng: -63.724668 }; // <-- TU PUEBLO (norte de Cordoba)
  var RADIUS_KM = 100;                                   // radio a bloquear
  var MODE      = 'message';        // 'message' (overlay) | 'redirect'
  var REDIRECT_URL = 'https://www.google.com';
  var TIMEOUT_MS = 2500;            // si la geo-IP tarda mas -> fail-open
  /* =========================================================== */

  var API = 'https://ipwho.is/';
  var CACHE_KEY = '__gg_v1';        // sessionStorage: 'A'=permitido 'B'=bloqueado
  var PASS_KEY  = '__gg_pass';      // localStorage: bypass permanente

  // --- BYPASS para vos/staff: visitar cualquier URL con ?nogate=1 una vez ---
  try {
    if (/[?&]nogate=1/.test(location.search)) localStorage.setItem(PASS_KEY, '1');
    if (localStorage.getItem(PASS_KEY) === '1') return;
  } catch (e) {}

  function haversine(a, b) {
    var R = 6371, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * toR) * Math.cos(b.lat * toR) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  function block() {
    if (MODE === 'redirect') { location.replace(REDIRECT_URL); return; }
    try {
      var o = document.createElement('div');
      o.setAttribute('style',
        'position:fixed;inset:0;z-index:2147483647;background:#fff;display:flex;' +
        'align-items:center;justify-content:center;text-align:center;padding:24px;' +
        'font-family:system-ui,-apple-system,Arial,sans-serif;color:#222');
      o.innerHTML =
        '<div><h1 style="font-size:22px;margin:0 0 10px">No disponible en tu zona</h1>' +
        '<p style="font-size:15px;color:#666;margin:0;max-width:420px">' +
        'Por el momento no realizamos envios ni ventas en tu region.</p></div>';
      (document.body || document.documentElement).appendChild(o);
      document.documentElement.style.overflow = 'hidden';
      if (window.stop) window.stop();
    } catch (e) { location.replace(REDIRECT_URL); }
  }

  function decide(inside) {
    try { sessionStorage.setItem(CACHE_KEY, inside ? 'B' : 'A'); } catch (e) {}
    if (inside) block();
  }

  // Cache de sesion
  var cached;
  try { cached = sessionStorage.getItem(CACHE_KEY); } catch (e) {}
  if (cached === 'B') { block(); return; }
  if (cached === 'A') return;

  var done = false;
  var t = setTimeout(function () { done = true; /* fail-open */ }, TIMEOUT_MS);

  try {
    fetch(API, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (done) return; done = true; clearTimeout(t);
        var lat = d && (typeof d.latitude  === 'number' ? d.latitude  : d.lat);
        var lng = d && (typeof d.longitude === 'number' ? d.longitude : d.lon);
        if (typeof lat !== 'number' || typeof lng !== 'number') return; // fail-open
        decide(haversine(CENTER, { lat: lat, lng: lng }) <= RADIUS_KM);
      })
      .catch(function () { /* fail-open */ });
  } catch (e) { /* fail-open */ }
})();
