/* MICELIUM-CNC v1 — "¿Cómo nos conociste?" post-compra
 * Inyectado en el storefront via Tiendanube external-codes (#assortedJs).
 * Solo renderiza en la página de gracias (window.LS.order presente).
 * Guarda la respuesta como owner_note en la orden via /api/cnc.
 */
(function () {
  if (window.__cncInit) return; window.__cncInit = true;
  var ENDPOINT = 'https://mw-micelium.vercel.app/api/cnc';

  function getOrderId() {
    try {
      var o = window.LS && window.LS.order;
      if (!o) return null;
      if (typeof o === 'number' || typeof o === 'string') return o;
      return o.id || o.number || null;
    } catch (e) { return null; }
  }

  function boot() {
    var oid = getOrderId();
    if (!oid) return;                                   // no es la página de gracias
    try { if (localStorage.getItem('cnc_' + oid)) return; } catch (e) {}

    var opts = [
      ['instagram',     'Instagram'],
      ['google',        'Google'],
      ['recomendacion', 'Un conocido'],
      ['mercadolibre',  'MercadoLibre'],
      ['facebook',      'Facebook'],
      ['youtube',       'YouTube'],
      ['otro',          'Otro']
    ];

    var box = document.createElement('div');
    box.setAttribute('style', [
      'max-width:520px', 'margin:20px auto', 'padding:20px 22px',
      'border:1px solid #e6e6e6', 'border-radius:14px', 'background:#fff',
      'box-shadow:0 2px 12px rgba(0,0,0,.06)', 'font-family:inherit',
      'text-align:center', 'color:#222'
    ].join(';'));

    var h = document.createElement('div');
    h.textContent = '¿Cómo nos conociste?';
    h.setAttribute('style', 'font-size:17px;font-weight:700;margin-bottom:4px');
    var sub = document.createElement('div');
    sub.textContent = 'Nos ayuda un montón a mejorar 🙌';
    sub.setAttribute('style', 'font-size:13px;color:#777;margin-bottom:14px');
    box.appendChild(h); box.appendChild(sub);

    var wrap = document.createElement('div');
    wrap.setAttribute('style', 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center');
    box.appendChild(wrap);

    function done(msg) {
      box.innerHTML = '';
      var t = document.createElement('div');
      t.textContent = msg;
      t.setAttribute('style', 'font-size:16px;font-weight:600;color:#1a7f37;padding:6px 0');
      box.appendChild(t);
    }

    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o[1];
      b.setAttribute('style', [
        'cursor:pointer', 'border:1px solid #d5d5d5', 'background:#fafafa',
        'border-radius:999px', 'padding:9px 16px', 'font-size:14px', 'color:#222'
      ].join(';'));
      b.onmouseover = function () { b.style.background = '#f0f0f0'; };
      b.onmouseout  = function () { b.style.background = '#fafafa'; };
      b.onclick = function () {
        try { localStorage.setItem('cnc_' + oid, o[0]); } catch (e) {}
        try {
          fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: oid, source: o[0] }),
            keepalive: true
          }).catch(function () {});
        } catch (e) {}
        done('¡Gracias! 🍄');
      };
      wrap.appendChild(b);
    });

    var target = document.querySelector(
      '.checkout-success, .success-page, #checkout, main') || document.body;
    if (target.firstChild) target.insertBefore(box, target.firstChild);
    else target.appendChild(box);
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
