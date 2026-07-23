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

  // Dominio propio, no el de Vercel: mw-micelium.vercel.app queda detrás del desafío
  // anti-bots de Vercel ante cualquier ráfaga de pedidos, y un desafío que un navegador
  // resuelve solo NO lo resuelve un fetch entre orígenes. Verificado el 23/07/26: el host
  // de Vercel devolvía 403 con X-Vercel-Mitigated: challenge mientras el dominio propio
  // servía todo con 200.
  var BASE = 'https://guias.infomicelium.com.ar';
  var script = document.currentScript;

  /* Contexto: de dónde salen los widgets que corresponden a esta página.
     En Tiendanube el mismo código se inyecta UNA vez para todo el sitio, así que no puede
     venir escrito en la etiqueta: se deduce. `LS` solo existe en el storefront, y
     `LS.template` dice qué plantilla se está mostrando. */
  function contextoAuto() {
    try {
      if (window.LS && window.LS.template) {
        return window.LS.template === 'product' ? 'producto' : 'tienda';
      }
    } catch (e) {}
    return 'guias';
  }
  var CTX = (script && script.getAttribute('data-ctx')) || contextoAuto();

  var PALETA = {
    sage:     { bg: '#6f8a5f', texto: '#ffffff', suave: '#eef1ea' },
    profundo: { bg: '#3f4f38', texto: '#ffffff', suave: '#e9ede7' },
    crema:    { bg: '#f4f2eb', texto: '#2a2620', suave: '#faf9f5' },
    tierra:   { bg: '#7a6a55', texto: '#ffffff', suave: '#f1ede7' },
    carbon:   { bg: '#1c1a17', texto: '#ffffff', suave: '#ecebe9' }
  };
  /* El color puede ser un token de marca o un código propio (#rrggbb) cargado desde el
     panel para un evento puntual. Con un código propio hay que derivar las otras dos
     variantes, porque un widget necesita tres cosas y el panel solo pide una:
       bg    → el color elegido
       texto → blanco o carbón, el que se lea sobre ese fondo
       suave → la versión clara para los recuadros de fondo
     Derivarlas es lo que evita el caso de texto blanco sobre amarillo. */
  function paleta(c) {
    if (typeof c === 'string' && c.charAt(0) === '#' && c.length === 7) {
      var r = parseInt(c.substr(1, 2), 16),
          g = parseInt(c.substr(3, 2), 16),
          b = parseInt(c.substr(5, 2), 16);
      // Luminancia percibida: el ojo ve el verde mucho más que el azul.
      var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      function mezclarConBlanco(x) { return Math.round(x + (255 - x) * 0.9); }
      return {
        bg: c,
        texto: lum > 0.62 ? '#1c1a17' : '#ffffff',
        suave: 'rgb(' + mezclarConBlanco(r) + ',' + mezclarConBlanco(g) + ',' + mezclarConBlanco(b) + ')'
      };
    }
    return PALETA[c] || PALETA.sage;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function vid() {
    try { return localStorage.getItem('__mic_vid') || document.cookie.replace(/(?:^|.*;\s*)mic_vid\s*=\s*([^;]*).*$|^.*$/, '$1') || null; }
    catch (e) { return null; }
  }

  var PREVIEW = !!(script && script.hasAttribute('data-preview'));

  function evento(id, tipo) {
    // En vista previa no se registra nada: inflaría las métricas del widget real.
    if (PREVIEW) return;
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

  /* ¿Cuál es el texto principal de esta página? Se prueba de lo más específico a lo más
     general para no terminar insertando dentro del menú o del pie. */
  function contenido() {
    var candidatos = [
      '[data-mic-contenido]',      // marca explícita, gana siempre
      'article',
      '.mic-ancho main',
      'main',
      // Tiendanube no usa <main> ni <article>. En la ficha de producto, la columna de la
      // derecha (`js-product-detail`) es donde están el precio y el botón: ahí es donde
      // sirve un widget. La descripción va después, como segunda opción.
      '.js-product-detail',
      '.js-product-description',
      '.product-description'
    ];

    // Esas tres últimas SOLO valen en la ficha de producto. En la portada de la tienda
    // aparecen dentro de las tarjetas de la grilla y de plantillas ocultas: un widget ahí
    // terminaría metido adentro de un producto cualquiera. Sin lugar razonable, no se
    // dibuja — es mejor que aparecer en un lugar absurdo.
    var esFicha = true;
    try {
      if (window.LS && window.LS.template) esFicha = window.LS.template === 'product';
    } catch (e) {}

    for (var i = 0; i < candidatos.length; i++) {
      if (i >= 4 && !esFicha) return null;
      var el = document.querySelector(candidatos[i]);
      if (el) return el;
    }
    return null;
  }

  /* Inserta el host en el lugar elegido desde el panel. Reemplaza al viejo data-mic-slot:
     antes había que pegar un <div> a mano en cada página para mover un widget. */
  function insertar(host, ubicacion) {
    var cont = contenido();
    if (!cont) return false;

    // Los hijos "de texto" son la referencia para medir la página. Se excluye lo que ya
    // puso este mismo motor, si no cada widget correría de lugar al siguiente.
    var hijos = [];
    for (var i = 0; i < cont.children.length; i++) {
      var h = cont.children[i];
      if (h.hasAttribute('data-mic')) continue;
      hijos.push(h);
    }
    if (!hijos.length) { cont.appendChild(host); return true; }

    var idx;
    switch (ubicacion) {
      case 'inicio':      idx = 0; break;
      case 'tras_intro':  idx = Math.min(1, hijos.length - 1); break;
      case 'medio':       idx = Math.floor(hijos.length / 2); break;
      case 'antes_final': idx = Math.max(0, hijos.length - 1); break;
      default:            cont.appendChild(host); return true; // 'final'
    }
    cont.insertBefore(host, hijos[idx]);
    return true;
  }

  /* Contenedor aislado. Los flotantes van al body; los de bloque, al lugar elegido. */
  function montar(w, flotante) {
    var host = document.createElement('div');
    host.setAttribute('data-mic', w.tipo);

    if (flotante) {
      document.body.appendChild(host);
      return host.attachShadow({ mode: 'open' });
    }

    // Un <div data-mic-slot="TIPO"> en la página sigue mandando si existe: sirve para
    // ubicar un widget en un punto exacto que la lista no contempla.
    var slot = document.querySelector('[data-mic-slot="' + w.tipo + '"]');
    if (slot) {
      slot.appendChild(host);
      return host.attachShadow({ mode: 'open' });
    }

    if (!insertar(host, (w.config && w.config.ubicacion) || 'final')) return null;
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

  /* ── Precio de la página ──
     Los widgets de precio NUNCA guardan un número propio: lo leen de lo que la página ya
     muestra. Así no existe el caso de un precio viejo pegado en un widget que nadie
     recuerda que está prendido. */
  function precioPagina() {
    var sel = ['.js-price-display', '[data-store="product-price"]', '.price', '[itemprop="price"]'];
    for (var i = 0; i < sel.length; i++) {
      var el = document.querySelector(sel[i]);
      if (!el) continue;
      var txt = el.getAttribute('content') || el.textContent || '';
      // Formato argentino: el punto separa miles y la coma los decimales.
      var limpio = txt.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      var n = parseFloat(limpio);
      if (n > 0) return n;
    }
    return 0;
  }

  function pesos(n) {
    try { return '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 }); }
    catch (e) { return '$' + Math.round(n); }
  }

  R.cuotas = function (w) {
    var c = w.config, p = paleta(c.color);
    var total = precioPagina();
    if (!total) return; // sin precio en la página no se inventa uno
    var n = Math.max(2, Number(c.cuotas) || 3);
    var sh = montar(w, false); if (!sh) return;
    pintar(sh,
      '.c{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;background:' + p.suave + ';' +
      'border-radius:10px;padding:14px 18px;margin:16px 0}' +
      'b{font-size:20px;color:' + p.bg + '}' +
      'span{font-size:13px;color:#5a534a}',
      '<div class="c"><b>' + n + ' cuotas de ' + esc(pesos(total / n)) + '</b>' +
      '<span>' + esc(c.texto || '') + '</span></div>');
    verUnaVez(sh, w.id);
  };

  R.envio_estimado = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;

    // Solo días hábiles, y si ya pasó la hora de corte la cuenta arranca mañana. Es la
    // misma lógica que usa cualquier tienda grande, y es lo que hace creíble la fecha.
    function habiles(desde, dias) {
      var d = new Date(desde), sumados = 0;
      while (sumados < dias) {
        d.setDate(d.getDate() + 1);
        var dia = d.getDay();
        if (dia !== 0 && dia !== 6) sumados++;
      }
      return d;
    }
    var base = new Date();
    if (base.getHours() >= (Number(c.corte) || 15)) base.setDate(base.getDate() + 1);

    var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    function fmt(d) { return d.getDate() + ' de ' + MESES[d.getMonth()]; }

    var a = habiles(base, Math.max(1, Number(c.dias_min) || 3));
    var b = habiles(base, Math.max(Number(c.dias_min) || 3, Number(c.dias_max) || 7));

    pintar(sh,
      '.e{display:flex;gap:11px;align-items:center;background:' + p.suave + ';border-radius:10px;padding:14px 18px;margin:16px 0}' +
      '.i{font-size:20px}' +
      'span{font-size:14.5px;color:#3a352e;line-height:1.5}b{color:' + p.bg + '}',
      '<div class="e"><span class="i">🚚</span><span>' + esc(c.texto || 'Llega entre el') +
      ' <b>' + esc(fmt(a)) + '</b> y el <b>' + esc(fmt(b)) + '</b></span></div>');
    verUnaVez(sh, w.id);
  };

  R.pasos = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    var items = (c.items || []).map(function (i, n) {
      return '<li><span class="n">' + (n + 1) + '</span><div><b>' + esc(i.titulo) + '</b>' +
        '<span>' + esc(i.texto) + '</span></div></li>';
    }).join('');
    pintar(sh,
      'h3{margin:0 0 16px;font-size:20px;color:#2a2620}' +
      'ol{list-style:none;margin:24px 0;padding:0;display:grid;gap:16px}' +
      'li{display:flex;gap:14px;align-items:flex-start}' +
      '.n{flex:0 0 30px;height:30px;border-radius:999px;background:' + p.bg + ';color:' + p.texto + ';' +
      'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}' +
      'b{display:block;font-size:15.5px;color:#2a2620;margin-bottom:2px}' +
      'span{font-size:14px;line-height:1.55;color:#5a534a}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') + '<ol>' + items + '</ol>');
    verUnaVez(sh, w.id);
  };

  R.barra_confianza = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    var items = (c.items || []).map(function (i) {
      return '<div class="it"><span class="e">' + esc(i.icono || '•') + '</span>' +
        '<b>' + esc(i.titulo) + '</b><span class="t">' + esc(i.texto) + '</span></div>';
    }).join('');
    pintar(sh,
      '.g{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));' +
      'background:' + p.suave + ';border-radius:10px;padding:18px;margin:20px 0}' +
      '.it{text-align:center}' +
      '.e{display:block;font-size:22px;margin-bottom:5px}' +
      'b{display:block;font-size:13.5px;color:#2a2620;margin-bottom:2px}' +
      '.t{font-size:12px;line-height:1.45;color:#6a6157}',
      '<div class="g">' + items + '</div>');
    verUnaVez(sh, w.id);
  };

  R.comparador = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    var filas = (c.items || []).map(function (i) {
      return '<tr><th>' + esc(i.tema) + '</th><td>' + esc(i.a) + '</td><td class="b">' + esc(i.b) + '</td></tr>';
    }).join('');
    pintar(sh,
      'h3{margin:0 0 16px;font-size:20px;color:#2a2620}' +
      '.w{overflow-x:auto;margin:20px 0}' +
      'table{width:100%;border-collapse:collapse;font-size:14px;min-width:420px}' +
      'thead th{padding:10px;text-align:left;font-size:13px;color:#6a6157;font-weight:600}' +
      'thead th.b{color:' + p.bg + '}' +
      'th{text-align:left;padding:11px 10px;color:#2a2620;font-weight:600;vertical-align:top;width:26%}' +
      'td{padding:11px 10px;color:#5a534a;line-height:1.5;vertical-align:top;border-top:1px solid #e6e2da}' +
      'td.b{background:' + p.suave + ';color:#2a2620}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') +
      '<div class="w"><table><thead><tr><th></th><th>' + esc(c.col_a) + '</th>' +
      '<th class="b">' + esc(c.col_b) + '</th></tr></thead><tbody>' + filas + '</tbody></table></div>');
    verUnaVez(sh, w.id);
  };

  R.especificaciones = function (w) {
    var c = w.config, p = paleta(c.color);
    var sh = montar(w, false); if (!sh) return;
    var filas = (c.items || []).map(function (i) {
      return '<div class="f"><dt>' + esc(i.dato) + '</dt><dd>' + esc(i.valor) + '</dd></div>';
    }).join('');
    pintar(sh,
      'h3{margin:0 0 14px;font-size:20px;color:#2a2620}' +
      'dl{margin:20px 0;padding:0}' +
      '.f{display:flex;gap:14px;padding:10px 0;border-bottom:1px solid #e6e2da}' +
      'dt{flex:0 0 42%;margin:0;font-size:14px;color:#6a6157}' +
      'dd{margin:0;font-size:14px;color:#2a2620;font-weight:500}' +
      'h3{color:' + p.bg + '}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') + '<dl>' + filas + '</dl>');
    verUnaVez(sh, w.id);
  };

  R.banner_anuncio = function (w) {
    var c = w.config, p = paleta(c.color);
    var items = (c.items || []).filter(function (i) { return i.texto; });
    if (!items.length) return;
    var clave = '__mic_ban_' + w.id;
    try { if (c.cerrable && sessionStorage.getItem(clave) === '1') return; } catch (e) {}

    var sh = montar(w, true); if (!sh) return;
    pintar(sh,
      '.b{position:fixed;top:0;left:0;right:0;z-index:99996;background:' + p.bg + ';color:' + p.texto + ';' +
      'display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 34px;' +
      'font-size:13.5px;text-align:center;line-height:1.35}' +
      '.m{opacity:0;transition:opacity .4s}.m.on{opacity:1}' +
      '.x{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;' +
      'color:inherit;font-size:19px;opacity:.75;line-height:1}',
      '<div class="b"><span class="m on">' + esc(items[0].texto) + '</span>' +
      (c.cerrable ? '<button class="x" aria-label="Cerrar">×</button>' : '') + '</div>');

    // Empuja el contenido para no tapar el encabezado del sitio.
    var alto = sh.querySelector('.b').offsetHeight || 36;
    document.documentElement.style.setProperty('scroll-padding-top', alto + 'px');
    document.body.style.paddingTop = alto + 'px';

    var m = sh.querySelector('.m'), n = 0;
    if (items.length > 1) {
      setInterval(function () {
        m.classList.remove('on');
        setTimeout(function () {
          n = (n + 1) % items.length;
          m.textContent = items[n].texto;
          m.classList.add('on');
        }, 400);
      }, Math.max(2, Number(c.segundos) || 5) * 1000);
    }
    var x = sh.querySelector('.x');
    if (x) x.addEventListener('click', function () {
      document.body.style.paddingTop = '';
      sh.host.remove();
      try { sessionStorage.setItem(clave, '1'); } catch (e) {}
    });
    evento(w.id, 'impresion');
  };

  R.cuenta_regresiva = function (w) {
    var c = w.config, p = paleta(c.color);
    var fin = Date.parse(String(c.hasta || '').replace(' ', 'T'));
    if (!fin || fin <= Date.now()) return; // vencida: desaparece sola, sin que nadie la apague
    var sh = montar(w, false); if (!sh) return;
    pintar(sh,
      '.c{background:' + p.suave + ';border-radius:10px;padding:18px 20px;margin:20px 0;text-align:center}' +
      'b{display:block;font-size:15px;color:#2a2620;margin-bottom:10px}' +
      '.r{display:flex;justify-content:center;gap:10px}' +
      '.u{background:' + p.bg + ';color:' + p.texto + ';border-radius:8px;padding:8px 12px;min-width:56px}' +
      '.u i{display:block;font-style:normal;font-size:20px;font-weight:700;line-height:1.1}' +
      '.u s{display:block;text-decoration:none;font-size:10.5px;opacity:.85}' +
      '.t{margin:10px 0 0;font-size:13px;color:#5a534a}',
      '<div class="c"><b>' + esc(c.titulo) + '</b><div class="r"></div>' +
      (c.texto ? '<p class="t">' + esc(c.texto) + '</p>' : '') + '</div>');

    var r = sh.querySelector('.r');
    function tic() {
      var falta = fin - Date.now();
      if (falta <= 0) { sh.host.remove(); return; }
      var s = Math.floor(falta / 1000);
      var partes = [
        [Math.floor(s / 86400), 'días'],
        [Math.floor(s / 3600) % 24, 'horas'],
        [Math.floor(s / 60) % 60, 'min'],
        [s % 60, 'seg']
      ];
      r.innerHTML = partes.map(function (u) {
        return '<div class="u"><i>' + u[0] + '</i><s>' + u[1] + '</s></div>';
      }).join('');
    }
    tic();
    setInterval(tic, 1000);
    verUnaVez(sh, w.id);
  };

  R.video = function (w) {
    var c = w.config, p = paleta(c.color);
    // Acepta la dirección como se copia de YouTube, larga o corta.
    var m = String(c.youtube || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
    if (!m) return;
    var id = m[1];
    var sh = montar(w, false); if (!sh) return;
    pintar(sh,
      'h3{margin:0 0 12px;font-size:20px;color:' + p.bg + '}' +
      '.v{position:relative;margin:20px 0;border-radius:12px;overflow:hidden;background:#000;' +
      'aspect-ratio:16/9;cursor:pointer}' +
      'img{width:100%;height:100%;object-fit:cover;display:block}' +
      'iframe{width:100%;height:100%;border:0;display:block}' +
      '.p{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}' +
      '.p span{width:62px;height:62px;border-radius:999px;background:rgba(0,0,0,.65);color:#fff;' +
      'display:flex;align-items:center;justify-content:center;font-size:22px;padding-left:4px}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') +
      '<div class="v"><img loading="lazy" src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="">' +
      '<div class="p"><span>▶</span></div></div>');

    // El iframe recién se crea al tocar: cargarlo de entrada suma medio megabyte y varios
    // pedidos a Google en una página que quizá nadie mire.
    var caja = sh.querySelector('.v');
    caja.addEventListener('click', function () {
      caja.innerHTML = '<iframe allowfullscreen allow="accelerometer;autoplay;encrypted-media;picture-in-picture" ' +
        'src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1"></iframe>';
      evento(w.id, 'interaccion');
    }, { once: true });
    verUnaVez(sh, w.id);
  };

  /* ── Carrito de Tiendanube ──
     `LS.cart.subtotal` viene en CENTAVOS. Es el error clásico con esta API: usarlo tal cual
     multiplica todo por cien y el widget promete un envío gratis que no existe. */
  function totalCarrito() {
    try {
      var c = window.LS && window.LS.cart;
      if (!c || typeof c.subtotal !== 'number') return null;
      return c.subtotal / 100;
    } catch (e) { return null; }
  }

  /* El total cambia por muchas vías (agregar, quitar, cambiar cantidad, panel lateral) y no
     todas emiten evento. Se consulta cada tanto: es una lectura de memoria, no cuesta nada,
     y evita perderse un cambio y quedar mostrando un número viejo. */
  function alCambiarCarrito(fn) {
    var ultimo = totalCarrito();
    fn(ultimo);
    setInterval(function () {
      var t = totalCarrito();
      if (t !== ultimo) { ultimo = t; fn(t); }
    }, 700);
    try {
      if (window.LS && window.LS.on && window.LS.events) {
        window.LS.on(window.LS.events.productAddedToCart, function () {
          setTimeout(function () { fn(totalCarrito()); }, 250);
        });
      }
    } catch (e) {}
  }

  R.progreso_envio = function (w) {
    var c = w.config, p = paleta(c.color);
    var objetivo = Number(c.objetivo) || 0;
    if (!objetivo) return; // sin meta no hay nada que medir
    if (totalCarrito() === null) return; // no estamos en la tienda

    var sh = montar(w, !!c.fijo); if (!sh) return;
    pintar(sh,
      (c.fijo
        ? '.c{position:fixed;left:0;right:0;bottom:0;z-index:99995;border-top:1px solid #e6e2da;' +
          'background:#fff;box-shadow:0 -6px 20px rgba(0,0,0,.08);padding:11px 16px}'
        : '.c{background:' + p.suave + ';border-radius:10px;padding:14px 18px;margin:18px 0}') +
      '.t{font-size:14px;color:#2a2620;margin-bottom:8px}b{color:' + p.bg + '}' +
      '.b{height:8px;border-radius:999px;background:#e2ded6;overflow:hidden}' +
      '.f{height:100%;width:0;background:' + p.bg + ';border-radius:999px;transition:width .4s}',
      '<div class="c"><div class="t"></div><div class="b"><div class="f"></div></div></div>');

    var caja = sh.querySelector('.c');
    var txt = sh.querySelector('.t');
    var barra = sh.querySelector('.f');
    var contado = false;

    alCambiarCarrito(function (total) {
      // Con el carrito vacío el mensaje no significa nada: se esconde en vez de mostrar
      // "te falta todo".
      if (!total) { caja.style.display = 'none'; return; }
      caja.style.display = '';
      var falta = objetivo - total;
      barra.style.width = Math.min(100, (total / objetivo) * 100) + '%';
      txt.innerHTML = falta > 0
        ? esc(c.texto_falta || 'Te falta') + ' <b>' + esc(pesos(falta)) + '</b>'
        : '<b>' + esc(c.texto_logrado || '¡Envío gratis!') + '</b>';
      if (!contado) { contado = true; evento(w.id, 'impresion'); }
    });
  };

  R.pack_complementarios = function (w) {
    var c = w.config, p = paleta(c.color);
    // Los datos salen del catálogo resuelto por el servidor, no de la config: el widget
    // guarda solo ids y el precio se lee siempre del catálogo real.
    var items = (c.items || []).map(function (i) {
      var pr = prod(w, i.producto);
      return pr ? { id: pr.id, nombre: pr.nombre, precio: pr.precio, imagen: pr.imagen, nota: i.nota || '' } : null;
    }).filter(Boolean);
    if (!items.length) return;
    var sh = montar(w, false); if (!sh) return;

    var filas = items.map(function (it, i) {
      return '<label class="it"><input type="checkbox" checked data-id="' + esc(it.id) + '" data-precio="' + it.precio + '">' +
        (it.imagen ? '<img src="' + esc(it.imagen) + '" alt="">' : '<span class="ph"></span>') +
        '<span class="d"><b>' + esc(it.nombre) + '</b>' +
        (it.nota ? '<span class="n">' + esc(it.nota) + '</span>' : '') + '</span>' +
        '<span class="pr">' + esc(pesos(it.precio)) + '</span></label>';
    }).join('');

    pintar(sh,
      'h3{margin:0 0 12px;font-size:18px;color:#2a2620}' +
      '.c{border:1px solid #e6e2da;border-radius:12px;padding:16px;margin:20px 0}' +
      '.it{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid #f0ece5;cursor:pointer}' +
      '.it:last-of-type{border-bottom:none}' +
      'img,.ph{width:44px;height:44px;border-radius:7px;object-fit:cover;background:#f0ece5;flex:0 0 auto}' +
      '.d{flex:1;min-width:0}' +
      'b{display:block;font-size:14px;color:#2a2620}' +
      '.n{font-size:12.5px;color:#6a6157;line-height:1.4}' +
      '.pr{font-size:14px;font-weight:600;color:#2a2620;white-space:nowrap}' +
      '.tot{display:flex;justify-content:space-between;align-items:baseline;margin:12px 0 10px;font-size:14px;color:#5a534a}' +
      '.tot b{font-size:18px;color:' + p.bg + '}' +
      'button{width:100%;padding:13px;background:' + p.bg + ';color:' + p.texto + ';border-radius:9px;font-size:15px;font-weight:700}' +
      'button:disabled{opacity:.5}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') +
      '<div class="c">' + filas +
      '<div class="tot"><span>Total de lo seleccionado</span><b class="s">—</b></div>' +
      '<button>' + esc(c.etiqueta || 'Agregar al carrito') + '</button></div>');

    var casillas = [].slice.call(sh.querySelectorAll('input[type=checkbox]'));
    var suma = sh.querySelector('.s');
    var boton = sh.querySelector('button');

    function recalcular() {
      var t = 0, n = 0;
      casillas.forEach(function (ch) {
        if (ch.checked) { t += Number(ch.getAttribute('data-precio')) || 0; n++; }
      });
      suma.textContent = pesos(t);
      boton.disabled = n === 0;
    }
    casillas.forEach(function (ch) { ch.addEventListener('change', recalcular); });
    recalcular();

    boton.addEventListener('click', function () {
      var elegidos = casillas.filter(function (ch) { return ch.checked; });
      if (!elegidos.length) return;
      evento(w.id, 'interaccion');
      boton.disabled = true;
      boton.textContent = 'Agregando…';

      // Tiendanube agrega de a un producto por POST a /comprar/. Se mandan en secuencia y
      // recién al terminar se va al carrito: si se dispararan en paralelo, el carrito se
      // queda con el último que contestó.
      var i = 0;
      (function siguiente() {
        if (i >= elegidos.length) {
          evento(w.id, 'conversion');
          location.href = '/carrito/';
          return;
        }
        var fd = new FormData();
        fd.append('add_to_cart', elegidos[i].getAttribute('data-id'));
        fd.append('quantity', '1');
        i++;
        fetch('/comprar/', { method: 'POST', body: fd, credentials: 'same-origin' })
          .then(siguiente)
          .catch(siguiente);
      })();
    });

    verUnaVez(sh, w.id);
  };

  /* Gente viendo ahora.
   *
   * El navegador avisa que está presente y el servidor devuelve cuántos hay en esta misma
   * página. Se repite cada 45 s mientras la pestaña esté a la vista: si el visitante se va
   * a otra solapa deja de avisar, y al volver retoma. Así el número baja solo cuando la
   * gente se va, que es lo que lo hace cierto.
   *
   * El factor de corrección se aplica acá y no en el servidor a propósito: del lado del
   * servidor queda siempre el conteo crudo, que es contra el que se recalibra.
   */
  R.viendo_ahora = function (w) {
    var c = w.config, p = paleta(c.color);
    var factor = Math.min(5, Math.max(1, Number(c.factor) || 1));
    var minimo = Math.max(2, Number(c.minimo) || 3);
    var ventana = Math.min(600, Math.max(60, (Number(c.ventana) || 3) * 60));

    // Identificador propio del widget: si el tracker de curiosos no dejó uno (bloqueadores,
    // primera visita), se genera uno acá. Sin identificador no se puede contar sin duplicar.
    var id = vid();
    if (!id) {
      try {
        id = localStorage.getItem('__mic_pid');
        if (!id) {
          id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
          localStorage.setItem('__mic_pid', id);
        }
      } catch (e) {
        id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      }
    }

    var sh = null, texto = null, visible = false;

    function dibujar(n) {
      var frase = String(c.plantilla || '{n} personas están viendo este producto');
      // Concordancia: con 1 no puede decir "personas están".
      if (n === 1) {
        frase = frase
          .replace(/personas/gi, 'persona')
          .replace(/\bestán\b/gi, 'está')
          .replace(/\bviendo\b/gi, 'viendo');
      }
      frase = frase.replace(/\{n\}/g, String(n));

      if (!sh) {
        sh = montar(w, false);
        if (!sh) return;
        pintar(sh,
          '.v{display:inline-flex;align-items:center;gap:8px;margin:14px 0;padding:8px 14px;' +
          'background:' + p.suave + ';border-radius:999px;font-size:13.5px;color:#2a2620}' +
          '.d{width:8px;height:8px;border-radius:50%;background:#3fa34d;flex:none;' +
          'animation:lat 2s ease-in-out infinite}' +
          '@keyframes lat{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}' +
          '@media (prefers-reduced-motion:reduce){.d{animation:none}}',
          '<div class="v"><span class="d"></span><span class="t"></span></div>');
        texto = sh.querySelector('.t');
        verUnaVez(sh, w.id);
      }
      texto.textContent = frase;
      if (!visible) { sh.host.style.display = ''; visible = true; }
    }

    function ocultar() {
      if (sh && visible) { sh.host.style.display = 'none'; visible = false; }
    }

    function latir() {
      // Con la pestaña oculta no se avisa: quien está en otra solapa no está mirando esto.
      if (document.hidden) return;
      fetch(BASE + '/api/presencia', {
        method: 'POST',
        body: JSON.stringify({ pagina: location.pathname, vid: id, ventana: ventana })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var real = Number(d && d.n) || 0;
          if (!real) { ocultar(); return; } // sin dato real no se muestra nada
          var mostrado = Math.round(real * factor);
          if (mostrado < minimo) { ocultar(); return; }
          dibujar(mostrado);
        })
        .catch(function () { ocultar(); });
    }

    latir();
    setInterval(latir, 45000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) latir(); });
  };

  /* ── Productos ──
     La config guarda solo ids; nombre, precio e imagen llegan resueltos en `w.catalogo`.
     Así un cambio de precio en Tiendanube se ve sin tocar el widget. */
  function prod(w, id) {
    return (w.catalogo && w.catalogo[String(id)]) || null;
  }

  /* Agrega un producto al carrito de Tiendanube y espera a que termine. */
  function agregarAlCarrito(id) {
    var fd = new FormData();
    fd.append('add_to_cart', String(id));
    fd.append('quantity', '1');
    return fetch('/comprar/', { method: 'POST', body: fd, credentials: 'same-origin' });
  }

  /* Ids de producto que ya están en el carrito. Sirve para no ofrecer algo que la persona
     ya eligió, que es la forma más rápida de que un cross-sell parezca automático y tonto. */
  function idsEnCarrito() {
    try {
      var items = (window.LS && window.LS.cart && window.LS.cart.items) || [];
      return items.map(function (i) {
        return String(i.product_id != null ? i.product_id : i.id);
      });
    } catch (e) { return []; }
  }

  R.upsell_upgrade = function (w) {
    var c = w.config, p = paleta(c.color);
    var sup = prod(w, c.producto);
    if (!sup) return;

    var actual = precioPagina();
    // Sin precio en la página no hay diferencia que mostrar, y el widget entero se apoya en
    // esa diferencia. Antes de mostrar un total pelado, no se muestra nada.
    if (!actual || sup.precio <= actual) return;

    var sh = montar(w, false); if (!sh) return;
    var bullets = (c.items || []).filter(function (i) { return i.texto; }).map(function (i) {
      return '<li>' + esc(i.texto) + '</li>';
    }).join('');

    pintar(sh,
      '.c{border:2px solid ' + p.bg + ';border-radius:12px;padding:18px 20px;margin:20px 0;background:' + p.suave + '}' +
      'h3{margin:0 0 4px;font-size:17px;color:#2a2620}' +
      '.dif{font-size:22px;font-weight:700;color:' + p.bg + ';margin:6px 0 12px}' +
      '.dif small{font-size:13px;font-weight:400;color:#6a6157}' +
      '.top{display:flex;gap:13px;align-items:center;margin-bottom:10px}' +
      'img{width:56px;height:56px;border-radius:8px;object-fit:cover;flex:0 0 auto}' +
      '.nom{font-size:13.5px;color:#5a534a}' +
      'ul{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:6px}' +
      'li{font-size:14px;color:#3a352e;padding-left:20px;position:relative;line-height:1.45}' +
      'li:before{content:"+";position:absolute;left:4px;color:' + p.bg + ';font-weight:700}' +
      'button{width:100%;padding:13px;background:' + p.bg + ';color:' + p.texto + ';border-radius:9px;font-size:15px;font-weight:700}',
      '<div class="c"><div class="top">' +
      (sup.imagen ? '<img src="' + esc(sup.imagen) + '" alt="">' : '') +
      '<div><h3>' + esc(c.titulo) + '</h3><div class="nom">' + esc(sup.nombre) + '</div></div></div>' +
      '<div class="dif">+ ' + esc(pesos(sup.precio - actual)) + ' <small>sobre lo que estás viendo</small></div>' +
      (bullets ? '<ul>' + bullets + '</ul>' : '') +
      '<button>' + esc(c.etiqueta || 'Quiero la versión completa') + '</button></div>');

    sh.querySelector('button').addEventListener('click', function () {
      var b = sh.querySelector('button');
      evento(w.id, 'interaccion');
      b.disabled = true; b.textContent = 'Agregando…';
      agregarAlCarrito(sup.id).then(function () {
        evento(w.id, 'conversion');
        location.href = '/carrito/';
      });
    });
    verUnaVez(sh, w.id);
  };

  R.crosssell_carrito = function (w) {
    var c = w.config, p = paleta(c.color);
    if (totalCarrito() === null) return; // no estamos en la tienda
    var sh = null, caja = null;

    function calcular() {
      var enCarrito = idsEnCarrito();
      var vistos = {}, salida = [];
      (c.items || []).forEach(function (regla) {
        if (!regla.si_lleva || !regla.ofrecer) return;
        if (enCarrito.indexOf(String(regla.si_lleva)) === -1) return;   // no disparó
        if (enCarrito.indexOf(String(regla.ofrecer)) !== -1) return;    // ya lo lleva
        if (vistos[regla.ofrecer]) return;                              // no repetir
        var pr = prod(w, regla.ofrecer);
        if (!pr) return;
        vistos[regla.ofrecer] = true;
        salida.push({ p: pr, nota: regla.nota || '' });
      });
      return salida;
    }

    function dibujar() {
      var lista = calcular();
      if (!lista.length) { if (sh) sh.host.style.display = 'none'; return; }

      if (!sh) {
        sh = montar(w, false);
        if (!sh) return;
        pintar(sh,
          'h3{margin:0 0 12px;font-size:17px;color:#2a2620}' +
          '.c{border:1px solid #e6e2da;border-radius:12px;padding:16px;margin:20px 0}' +
          '.it{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid #f0ece5}' +
          '.it:last-child{border-bottom:none}' +
          'img,.ph{width:46px;height:46px;border-radius:7px;object-fit:cover;background:#f0ece5;flex:0 0 auto}' +
          '.d{flex:1;min-width:0}b{display:block;font-size:14px;color:#2a2620}' +
          '.n{font-size:12.5px;color:#6a6157;line-height:1.4}' +
          '.pr{font-size:14px;font-weight:600;white-space:nowrap;margin-right:8px}' +
          'button{padding:8px 14px;background:' + p.bg + ';color:' + p.texto + ';border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap}',
          '<div class="c"><h3>' + esc(c.titulo) + '</h3><div class="lista"></div></div>');
        verUnaVez(sh, w.id);
      }

      sh.host.style.display = '';
      sh.querySelector('.lista').innerHTML = lista.map(function (x) {
        return '<div class="it">' +
          (x.p.imagen ? '<img src="' + esc(x.p.imagen) + '" alt="">' : '<span class="ph"></span>') +
          '<span class="d"><b>' + esc(x.p.nombre) + '</b>' +
          (x.nota ? '<span class="n">' + esc(x.nota) + '</span>' : '') + '</span>' +
          '<span class="pr">' + esc(pesos(x.p.precio)) + '</span>' +
          '<button data-id="' + esc(x.p.id) + '">' + esc(c.etiqueta || 'Sumar') + '</button></div>';
      }).join('');

      [].slice.call(sh.querySelectorAll('button')).forEach(function (b) {
        b.addEventListener('click', function () {
          evento(w.id, 'interaccion');
          b.disabled = true; b.textContent = 'Sumando…';
          agregarAlCarrito(b.getAttribute('data-id')).then(function () {
            evento(w.id, 'conversion');
            location.reload();
          });
        });
      });
    }

    // Se redibuja con el carrito: una sugerencia que sigue ofreciendo lo que la persona
    // acaba de agregar es peor que no sugerir nada.
    alCambiarCarrito(dibujar);
  };

  R.upsell_al_agregar = function (w) {
    var c = w.config, p = paleta(c.color);
    var pr = prod(w, c.producto);
    if (!pr) return;
    if (totalCarrito() === null && !PREVIEW) return;

    var clave = '__mic_ups_' + w.id;
    function yaMostrado() {
      try { return sessionStorage.getItem(clave) === '1'; } catch (e) { return false; }
    }
    function marcar() { try { sessionStorage.setItem(clave, '1'); } catch (e) {} }

    function abrir() {
      if (yaMostrado()) return;
      marcar();
      var sh = montar(w, true); if (!sh) return;

      pintar(sh,
        '.ov{position:fixed;inset:0;background:rgba(20,18,15,.72);z-index:99999;display:flex;' +
        'align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s}' +
        '.ov.on{opacity:1}' +
        '.c{position:relative;max-width:400px;width:100%;background:#fff;border-radius:14px;padding:26px 24px 22px;text-align:center}' +
        'h3{margin:0 0 6px;font-size:19px;color:#2a2620}' +
        '.t{margin:0 0 16px;font-size:14px;line-height:1.55;color:#5a534a}' +
        'img{width:110px;height:110px;border-radius:10px;object-fit:cover;margin:0 auto 12px;display:block}' +
        '.nom{font-size:15px;color:#2a2620;font-weight:600}' +
        '.pr{font-size:20px;font-weight:700;color:' + p.bg + ';margin:4px 0 16px}' +
        'button{width:100%;padding:13px;background:' + p.bg + ';color:' + p.texto + ';border-radius:9px;font-size:15px;font-weight:700}' +
        '.no{display:block;width:100%;margin-top:10px;background:none;color:#8a8177;font-size:13px;font-weight:400;padding:6px}',
        '<div class="ov"><div class="c">' +
        '<h3>' + esc(c.titulo) + '</h3>' +
        (c.texto ? '<p class="t">' + esc(c.texto) + '</p>' : '') +
        (pr.imagen ? '<img src="' + esc(pr.imagen) + '" alt="">' : '') +
        '<div class="nom">' + esc(pr.nombre) + '</div>' +
        '<div class="pr">' + esc(pesos(pr.precio)) + '</div>' +
        '<button class="si">' + esc(c.etiqueta || 'Sumarlo a mi pedido') + '</button>' +
        '<button class="no">' + esc(c.rechazo || 'No, gracias') + '</button>' +
        '</div></div>');

      var ov = sh.querySelector('.ov');
      setTimeout(function () { ov.classList.add('on'); }, 20);
      evento(w.id, 'impresion');

      function cerrar() {
        ov.classList.remove('on');
        setTimeout(function () { sh.host.remove(); }, 300);
      }
      sh.querySelector('.no').addEventListener('click', cerrar);
      // Clic fuera y Escape también cierran: una ventana que aparece sin pedirla tiene que
      // ser fácil de sacar, o el próximo carrito no se arma.
      ov.addEventListener('click', function (e) { if (e.target === ov) cerrar(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });

      sh.querySelector('.si').addEventListener('click', function () {
        var b = sh.querySelector('.si');
        evento(w.id, 'interaccion');
        b.disabled = true; b.textContent = 'Sumando…';
        agregarAlCarrito(pr.id).then(function () {
          evento(w.id, 'conversion');
          location.href = '/carrito/';
        });
      });
    }

    if (PREVIEW) { abrir(); return; }

    try {
      if (window.LS && window.LS.on && window.LS.events) {
        window.LS.on(window.LS.events.productAddedToCart, function () {
          setTimeout(abrir, 400);
        });
      }
    } catch (e) {}
  };

  R.media = function (w) {
    var c = w.config, p = paleta(c.color);
    if (!c.archivo) return;
    var sh = montar(w, false); if (!sh) return;

    var RADIOS = { ninguno: '0', suave: '8px', redondo: '18px', circulo: '999px' };
    var radio = RADIOS[c.marco] || '18px';

    // La proporción se reserva ANTES de que cargue el archivo. Sin esto el texto salta
    // cuando la imagen aparece, que además de molesto penaliza en los buscadores.
    var PROPS = { '16:9': '16/9', '4:3': '4/3', '1:1': '1/1', '4:5': '4/5' };
    var prop = PROPS[c.proporcion];

    var ANCHOS = { completo: '100%', medio: '60%', chico: '38%' };
    var ancho = ANCHOS[c.ancho] || '100%';

    var esVideo = /\.(webm|mp4)(\?|$)/i.test(c.archivo);
    var alt = esc(c.alt || c.epigrafe || '');

    pintar(sh,
      'figure{margin:24px auto;width:' + ancho + ';max-width:100%}' +
      '.m{width:100%;overflow:hidden;border-radius:' + radio + ';background:#f0ece5;display:block' +
      (prop ? ';aspect-ratio:' + prop : '') +
      (c.borde ? ';border:1px solid ' + p.bg : '') + '}' +
      // object-fit recorta al centro: una imagen de cualquier medida entra en su lugar sin
      // deformarse. Es lo que evita que una foto mal exportada rompa la página.
      'img,video{width:100%;height:100%;object-fit:' + (prop ? 'cover' : 'contain') + ';display:block}' +
      'figcaption{margin-top:9px;font-size:13px;line-height:1.5;color:#6a6157;text-align:center}',
      '<figure><div class="m">' +
      (esVideo
        ? '<video src="' + esc(c.archivo) + '" autoplay loop muted playsinline preload="metadata" aria-label="' + alt + '"></video>'
        : '<img src="' + esc(c.archivo) + '" alt="' + alt + '" loading="lazy" decoding="async">') +
      '</div>' +
      (c.epigrafe ? '<figcaption>' + esc(c.epigrafe) + '</figcaption>' : '') +
      '</figure>');

    // El video arranca recién cuando entra en pantalla: reproducir algo que nadie está
    // mirando gasta datos del visitante y batería, sin comprarle nada a nadie.
    var v = sh.querySelector('video');
    if (v && 'IntersectionObserver' in window) {
      v.autoplay = false;
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { v.play().catch(function () {}); }
          else { v.pause(); }
        });
      }, { threshold: 0.25 }).observe(v);
    }

    verUnaVez(sh, w.id);
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

  /* Modo vista previa: el panel dibuja el widget con la config que se está editando, sin
     pasar por la base. Es el mismo código que corre en el sitio — si acá se ve bien, allá
     se ve bien. Un preview que dibuja aparte es un preview que miente. */
  if (PREVIEW) {
    window.MIC = {
      dibujar: function (w) {
        var viejos = document.querySelectorAll('[data-mic]');
        for (var i = 0; i < viejos.length; i++) viejos[i].remove();
        var fn = R[w.tipo];
        if (!fn) return;
        try { fn(w); } catch (e) { console.warn('[mic] preview', w.tipo, e); }
      }
    };
    window.addEventListener('message', function (e) {
      if (e.data && e.data.mic === 'preview') window.MIC.dibujar(e.data.widget);
    });
    if (window.parent !== window) window.parent.postMessage({ mic: 'listo' }, '*');
    return;
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
