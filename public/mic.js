/* MIC-WIDGETS v1 — motor de widgets propio
 *
 * Un solo archivo para todos los widgets. Pide la config a /api/widgets/config y dibuja
 * lo que esté prendido. Todo el contenido viene de la base: acá no hay ni un texto de
 * negocio escrito a mano, porque si lo hubiera habría que desplegar para cambiarlo, que
 * es justo lo que este motor viene a evitar.
 *
 * Uso:
 *   <script src="https://mw-micelium.vercel.app/mic.js" data-ctx="guias"></script>
 * En Tiendanube se inyecta con el bootstrap img-onerror (ver los otros scripts públicos).
 *
 * Los widgets de bloque se dibujan dentro de <div data-mic-slot="TIPO"></div>.
 * Los flotantes (WhatsApp, barra de acción, ventana emergente) no necesitan slot.
 *
 * Cada widget vive en su propio Shadow DOM: el CSS de Tiendanube no lo puede romper, ni
 * él romper el de la página.
 */
(function () {
  if (window.__micInit) return;
  window.__micInit = true;

  var BASE = 'https://mw-micelium.vercel.app';
  var script = document.currentScript;
  var CTX = (script && script.getAttribute('data-ctx')) || 'guias';

  var PALETA = {
    sage:     { bg: '#6f8a5f', texto: '#ffffff', suave: '#eef1ea' },
    profundo: { bg: '#3f4f38', texto: '#ffffff', suave: '#e9ede7' },
    crema:    { bg: '#f4f2eb', texto: '#2a2620', suave: '#faf9f5' },
    tierra:   { bg: '#7a6a55', texto: '#ffffff', suave: '#f1ede7' },
    carbon:   { bg: '#1c1a17', texto: '#ffffff', suave: '#ecebe9' }
  };
  function paleta(c) { return PALETA[c] || PALETA.sage; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function vid() {
    try { return localStorage.getItem('__mic_vid') || document.cookie.replace(/(?:^|.*;\s*)mic_vid\s*=\s*([^;]*).*$|^.*$/, '$1') || null; }
    catch (e) { return null; }
  }

  function evento(id, tipo) {
    try {
      var body = JSON.stringify({ widget_id: id, tipo: tipo, vid: vid() });
      if (navigator.sendBeacon) navigator.sendBeacon(BASE + '/api/widgets/evento', body);
      else fetch(BASE + '/api/widgets/evento', { method: 'POST', body: body, keepalive: true });
    } catch (e) {}
  }

  var esMovil = window.matchMedia('(max-width: 768px)').matches;

  /* ¿Corresponde mostrar este widget en esta página? Las fechas ya las filtró el servidor. */
  function aplica(w) {
    var r = w.reglas || {};
    if (r.dispositivo === 'movil' && !esMovil) return false;
    if (r.dispositivo === 'escritorio' && esMovil) return false;
    var rutas = r.rutas || [];
    if (rutas.length) {
      var p = location.pathname;
      for (var i = 0; i < rutas.length; i++) if (p.indexOf(rutas[i]) === 0) return true;
      return false;
    }
    return true;
  }

  /* Contenedor aislado. Los widgets de bloque van al slot; los flotantes, al body. */
  function montar(w, flotante) {
    var host = document.createElement('div');
    host.setAttribute('data-mic', w.tipo);
    if (flotante) {
      document.body.appendChild(host);
    } else {
      var slot = document.querySelector('[data-mic-slot="' + w.tipo + '"]');
      if (!slot) return null; // sin lugar donde ir: no se inventa una posición
      slot.appendChild(host);
    }
    return host.attachShadow({ mode: 'open' });
  }

  var BASE_CSS =
    ':host{all:initial}*{box-sizing:border-box;font-family:ui-sans-serif,system-ui,"Segoe UI",Helvetica,Arial,sans-serif}' +
    'button{font:inherit;cursor:pointer;border:none}';

  function pintar(shadow, css, html) {
    shadow.innerHTML = '<style>' + BASE_CSS + css + '</style>' + html;
  }

  /* Marca la impresión una sola vez, y recién cuando el widget entra en pantalla: una
     impresión que nadie vio no sirve para comparar widgets entre sí. */
  function verUnaVez(shadow, id) {
    var el = shadow.host;
    if (!('IntersectionObserver' in window)) { evento(id, 'impresion'); return; }
    var obs = new IntersectionObserver(function (entradas) {
      for (var i = 0; i < entradas.length; i++) {
        if (entradas[i].isIntersecting) { evento(id, 'impresion'); obs.disconnect(); }
      }
    }, { threshold: 0.4 });
    obs.observe(el);
  }

  /* ══════════════ RENDERERS ══════════════
   * Uno por tipo, con la misma firma. Agregar un tipo nuevo = declararlo en
   * lib/widgets/tipos.ts y sumar una función acá. Nada más.
   */
  var R = {};

  R.whatsapp_flotante = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, true); if (!sh) return;
    var lado = c.posicion === 'izquierda' ? 'left:18px' : 'right:18px';
    pintar(sh,
      '.b{position:fixed;bottom:18px;' + lado + ';z-index:99998;display:flex;align-items:center;gap:9px;' +
      'padding:13px 19px;border-radius:999px;background:' + p.bg + ';color:' + p.texto + ';font-size:15px;' +
      'font-weight:600;box-shadow:0 8px 26px rgba(0,0,0,.24);opacity:0;transform:translateY(10px);' +
      'transition:opacity .3s,transform .3s;text-decoration:none}' +
      '.b.on{opacity:1;transform:none}',
      '<a class="b" target="_blank" rel="noopener"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">' +
      '<path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5-.3.3c-.1.1-.2.3 0 .5.2.3.8 1.3 1.7 2.1 1.1 1 2 1.3 2.3 1.4.2.1.4.1.5-.1l.8-.9c.2-.2.3-.2.5-.1l2 .9c.2.1.4.2.4.3.1.1.1.6-.1 1.2z"/>' +
      '</svg><span>' + esc(c.etiqueta || 'Consultanos') + '</span></a>');

    var a = sh.querySelector('.b');
    var num = String(c.numero || '').replace(/\D/g, '');
    a.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(c.mensaje || '');
    a.addEventListener('click', function () { evento(w.id, 'interaccion'); evento(w.id, 'conversion'); });
    setTimeout(function () { a.classList.add('on'); evento(w.id, 'impresion'); }, (Number(c.demora) || 0) * 1000);
  };

  R.cta_producto = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    pintar(sh,
      '.c{background:' + p.suave + ';border-left:4px solid ' + p.bg + ';border-radius:10px;padding:26px 28px;margin:32px 0}' +
      'h3{margin:0 0 8px;font-size:20px;color:#2a2620;line-height:1.3}' +
      'p{margin:0 0 18px;font-size:15px;line-height:1.6;color:#4e4840}' +
      'a{display:inline-block;background:' + p.bg + ';color:' + p.texto + ';padding:12px 24px;border-radius:8px;' +
      'font-weight:600;font-size:15px;text-decoration:none}',
      '<div class="c">' + (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') +
      (c.texto ? '<p>' + esc(c.texto) + '</p>' : '') +
      (c.url ? '<a href="' + esc(c.url) + '">' + esc(c.etiqueta || 'Ver más') + '</a>' : '') + '</div>');

    var a = sh.querySelector('a');
    if (a) a.addEventListener('click', function () { evento(w.id, 'interaccion'); evento(w.id, 'conversion'); });
    verUnaVez(sh, w.id);
  };

  R.beneficios = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    var items = (c.items || []).map(function (i) {
      return '<li><span class="i">' + esc(i.icono || '•') + '</span><span>' + esc(i.texto) + '</span></li>';
    }).join('');
    pintar(sh,
      'ul{list-style:none;margin:24px 0;padding:0;display:grid;gap:11px}' +
      'li{display:flex;gap:11px;align-items:flex-start;font-size:15px;line-height:1.5;color:#3a352e}' +
      '.i{flex:0 0 auto;font-size:17px}' +
      'h3{margin:0 0 14px;font-size:18px;color:' + p.bg + '}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') + '<ul>' + items + '</ul>');
    verUnaVez(sh, w.id);
  };

  R.garantia = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    pintar(sh,
      '.g{display:flex;gap:14px;align-items:flex-start;background:' + p.suave + ';border-radius:10px;padding:18px 20px;margin:20px 0}' +
      '.e{font-size:26px;line-height:1}' +
      'b{display:block;font-size:15px;color:#2a2620;margin-bottom:3px}' +
      'span.t{font-size:13.5px;line-height:1.55;color:#5a534a}',
      '<div class="g"><div class="e">' + esc(c.icono || '🛡️') + '</div><div>' +
      '<b>' + esc(c.titulo) + '</b><span class="t">' + esc(c.texto) + '</span></div></div>');
    verUnaVez(sh, w.id);
  };

  R.faq = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    var items = (c.items || []).map(function (i) {
      return '<details><summary>' + esc(i.pregunta) + '</summary><div>' + esc(i.respuesta) + '</div></details>';
    }).join('');
    pintar(sh,
      'h3{margin:0 0 16px;font-size:20px;color:#2a2620}' +
      'details{border-bottom:1px solid #e6e2da}' +
      'summary{cursor:pointer;padding:15px 0;font-size:15.5px;font-weight:600;color:' + p.bg + ';list-style:none;position:relative;padding-right:26px}' +
      'summary::-webkit-details-marker{display:none}' +
      'summary:after{content:"+";position:absolute;right:4px;top:13px;font-size:19px;color:#b5aca0}' +
      'details[open] summary:after{content:"–"}' +
      'div{padding:0 0 16px;font-size:14.5px;line-height:1.65;color:#4e4840;white-space:pre-wrap}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') + items);

    sh.querySelectorAll('summary').forEach(function (s) {
      s.addEventListener('click', function () { evento(w.id, 'interaccion'); }, { once: true });
    });
    verUnaVez(sh, w.id);
  };

  R.resenas = function (w) {
    var c = w.config, p = paleta(c.color);
    var datos = w.datos || [];
    if (!datos.length) return; // sin reseñas reales no se dibuja nada: no hay relleno
    var sh = montar(w, false); if (!sh) return;
    var cards = datos.map(function (r) {
      return '<article><p>' + esc(r.texto) + '</p><footer><b>' + esc(r.nombre) + '</b>' +
        (c.sello && r.verificada ? '<span class="v">✓ compra verificada</span>' : '') + '</footer></article>';
    }).join('');
    pintar(sh,
      'h3{margin:0 0 18px;font-size:20px;color:#2a2620}' +
      '.g{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}' +
      'article{background:#fff;border:1px solid #e6e2da;border-radius:10px;padding:18px}' +
      'p{margin:0 0 12px;font-size:14.5px;line-height:1.6;color:#3a352e}' +
      'footer{display:flex;flex-direction:column;gap:3px}' +
      'b{font-size:13.5px;color:#2a2620}' +
      '.v{font-size:11.5px;color:' + p.bg + ';font-weight:600}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') + '<div class="g">' + cards + '</div>');
    verUnaVez(sh, w.id);
  };

  R.barra_accion = function (w) {
    var c = w.config, p = paleta(c.color);
    if (c.solo_movil && !esMovil) return;
    // Se engancha al botón real de Tiendanube: no duplica el carrito, lo dispara.
    var real = document.querySelector('.js-addtocart, [name="add-to-cart"], .js-prod-submit-form button[type="submit"]');
    if (!real) return;

    var sh = montar(w, true); if (!sh) return;
    var precio = '';
    var elP = document.querySelector('.js-price-display, [data-store="product-price"]');
    if (c.mostrar_precio && elP) precio = elP.textContent.trim();

    pintar(sh,
      '.b{position:fixed;left:0;right:0;bottom:0;z-index:99997;display:flex;align-items:center;gap:12px;' +
      'padding:11px 14px;background:#fff;border-top:1px solid #e6e2da;box-shadow:0 -6px 20px rgba(0,0,0,.10);' +
      'transform:translateY(110%);transition:transform .28s}' +
      '.b.on{transform:none}' +
      '.p{flex:1;font-size:16px;font-weight:700;color:#2a2620}' +
      'button{background:' + p.bg + ';color:' + p.texto + ';padding:13px 22px;border-radius:9px;font-size:15px;font-weight:700}',
      '<div class="b"><div class="p">' + esc(precio) + '</div><button>' + esc(c.etiqueta || 'Agregar al carrito') + '</button></div>');

    var barra = sh.querySelector('.b');
    sh.querySelector('button').addEventListener('click', function () {
      evento(w.id, 'interaccion');
      evento(w.id, 'conversion');
      real.click();
    });

    var umbral = Number(c.scroll) || 0, visto = false;
    function alScroll() {
      var y = window.scrollY / Math.max(1, document.body.scrollHeight - innerHeight) * 100;
      var mostrar = y >= umbral;
      barra.classList.toggle('on', mostrar);
      if (mostrar && !visto) { visto = true; evento(w.id, 'impresion'); }
    }
    window.addEventListener('scroll', alScroll, { passive: true });
    alScroll();
  };

  R.captura_email = function (w) {
    var c = w.config, p = paleta(c.color);
    var popup = c.modo !== 'bloque';
    var clave = '__mic_cap_' + w.id;
    if (popup) { try { if (localStorage.getItem(clave) === '1') return; } catch (e) {} }

    var sh = montar(w, popup); if (!sh) return;

    var form =
      '<form><input class="e" type="email" required placeholder="tu@email.com">' +
      '<button type="submit">' + esc(c.etiqueta || 'Enviar') + '</button><div class="m"></div></form>';
    var cuerpo =
      '<div class="cont">' + (popup ? '<button class="x" aria-label="Cerrar">×</button>' : '') +
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') +
      (c.texto ? '<p>' + esc(c.texto) + '</p>' : '') + form + '</div>';

    pintar(sh,
      (popup
        ? '.ov{position:fixed;inset:0;background:rgba(20,18,15,.72);z-index:99999;display:flex;align-items:center;' +
          'justify-content:center;padding:16px;opacity:0;transition:opacity .25s}.ov.on{opacity:1}' +
          '.cont{position:relative;max-width:440px;width:100%;background:#fff;border-radius:14px;padding:30px 28px 26px}' +
          '.x{position:absolute;top:8px;right:12px;background:none;font-size:26px;color:#a89e92;line-height:1}'
        : '.cont{background:' + p.suave + ';border-radius:12px;padding:26px 28px;margin:30px 0}') +
      'h3{margin:0 0 8px;font-size:20px;color:#2a2620;line-height:1.3}' +
      'p{margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#4e4840}' +
      '.e{width:100%;padding:12px 14px;border:1.5px solid #d9cec2;border-radius:9px;font-size:15px;margin-bottom:10px}' +
      'button[type=submit]{width:100%;padding:13px;background:' + p.bg + ';color:' + p.texto + ';border-radius:9px;font-size:15px;font-weight:700}' +
      '.m{font-size:13.5px;margin-top:9px;min-height:18px;color:' + p.bg + '}',
      popup ? '<div class="ov">' + cuerpo + '</div>' : cuerpo);

    var f = sh.querySelector('form');
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = sh.querySelector('.e').value.trim();
      var msg = sh.querySelector('.m');
      msg.textContent = 'Enviando…';
      evento(w.id, 'interaccion');
      fetch(BASE + '/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, origen: 'widget:' + w.id })
      }).then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          // /api/lead devuelve códigos, no frases. Traducirlos acá evita mostrarle
          // "formato" o "send" a un visitante.
          var ERRORES = {
            formato: 'Revisá el correo, parece mal escrito.',
            dominio: 'Ese dominio de correo no existe.',
            send: 'No se pudo enviar. Probá de nuevo en un minuto.',
            config: 'No se pudo enviar. Probá de nuevo en un minuto.',
            server: 'No se pudo enviar. Probá de nuevo en un minuto.'
          };
          if (d && d.error) { msg.textContent = ERRORES[d.error] || 'No se pudo enviar.'; return; }
          msg.textContent = c.gracias || '¡Listo!';
          evento(w.id, 'conversion');
          try { localStorage.setItem(clave, '1'); } catch (e) {}
          if (popup) setTimeout(cerrar, 2200);
        })
        .catch(function () { msg.textContent = 'No se pudo enviar. Probá de nuevo.'; });
    });

    function cerrar() {
      var ov = sh.querySelector('.ov');
      if (ov) ov.classList.remove('on');
      try { localStorage.setItem(clave, '1'); } catch (e) {}
      setTimeout(function () { sh.host.remove(); }, 300);
    }

    if (popup) {
      var ov = sh.querySelector('.ov');
      sh.querySelector('.x').addEventListener('click', cerrar);
      ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
      var abierto = false;
      function abrir() {
        if (abierto) return; abierto = true;
        ov.classList.add('on');
        evento(w.id, 'impresion');
      }
      setTimeout(abrir, (Number(c.demora) || 15) * 1000);
      if (c.salida) {
        document.addEventListener('mouseout', function (e) {
          if (!e.relatedTarget && e.clientY <= 0) abrir();
        });
      }
    } else {
      verUnaVez(sh, w.id);
    }
  };

  /* ══════════════ ARRANQUE ══════════════ */
  function arrancar(lista) {
    for (var i = 0; i < lista.length; i++) {
      var w = lista[i];
      if (!aplica(w)) continue;
      var fn = R[w.tipo];
      if (!fn) continue; // tipo nuevo en la base, script viejo en caché: se ignora, no rompe
      try { fn(w); } catch (e) { console.warn('[mic] falló', w.tipo, e); }
    }
  }

  fetch(BASE + '/api/widgets/config?ctx=' + encodeURIComponent(CTX))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var lista = (d && d.widgets) || [];
      if (!lista.length) return;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { arrancar(lista); });
      } else {
        arrancar(lista);
      }
    })
    .catch(function (e) { console.warn('[mic] sin config', e); });
})();
