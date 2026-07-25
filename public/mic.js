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

  /* Id del producto que se está viendo. Sirve para dos cosas: registrar de qué producto
     viene una reseña nueva, y filtrar el widget a "solo las de este producto". Tiendanube lo
     expone en `LS.product.id` dentro de la ficha; si el tema no lo trae, se devuelve vacío y
     el filtro por producto se cae a mostrar todas (nunca a mostrar nada). */
  function productoActual() {
    try {
      if (window.LS && window.LS.product && window.LS.product.id != null) {
        return String(window.LS.product.id).replace(/\D/g, '');
      }
    } catch (e) {}
    return '';
  }
  var PRODUCTO = productoActual();

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

  /* `valor` es el monto en pesos que el widget puso en juego (lo que se agregó al carrito).
     Sin eso, «facturación estimada» sería una columna vacía: se sabría que alguien hizo clic
     pero no cuánto movió, que es lo único que permite comparar widgets entre sí. */
  function evento(id, tipo, valor) {
    // En vista previa no se registra nada: inflaría las métricas del widget real.
    if (PREVIEW) return;
    try {
      var body = JSON.stringify({ widget_id: id, tipo: tipo, vid: vid(), valor: valor || 0 });
      if (navigator.sendBeacon) navigator.sendBeacon(BASE + '/api/widgets/evento', body);
      else fetch(BASE + '/api/widgets/evento', { method: 'POST', body: body, keepalive: true });
    } catch (e) {}
  }

  /* Envuelve un cambio de estado (rotar un mensaje, cruzar un umbral) para que el navegador
     funda el antes con el después. Un `transition` de CSS no puede hacerlo: anima propiedades
     de un mismo nodo, no sabe interpolar entre dos contenidos distintos. Donde no hay soporte
     —o el visitante pidió menos movimiento— el cambio ocurre igual, sin animar: mejora
     progresiva, riesgo cero. El nombre se limpia al terminar porque debe ser único en todo el
     documento, aunque el widget viva en su propio Shadow DOM. */
  function conTransicion(el, nombre, cambiar) {
    try {
      var menos = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!document.startViewTransition || menos) { cambiar(); return; }
      el.style.viewTransitionName = nombre;
      var vt = document.startViewTransition(cambiar);
      vt.finished.finally(function () { try { el.style.viewTransitionName = ''; } catch (e) {} });
    } catch (e) { cambiar(); }
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

  /* ── Ficha de producto: anclas reales ──────────────────────────────────────
     La columna de la derecha de la ficha (`.product-detail-container`) es una pila de
     bloques con un orden fijo y conocido: título, precio, medios de pago, aviso de envío,
     formulario de compra (cantidad + "Agregar al carrito"), descripción. Cada ubicación
     apunta a UNO de esos bloques por su selector propio, en vez de contar hijos: contar
     no sirve acá, porque el bloque de la ficha es un solo hijo gigante y todo termina
     pegado arriba o al fondo. Es la diferencia entre "más o menos por el medio" y
     "debajo del precio". */
  var ANCLAS = {
    // clave              selector del bloque                                         después
    prod_titulo:         ['.page-header, .js-product-name, h1',                        true],
    prod_precio_arriba:  ['.js-price-container, .js-price-display',                    false],
    prod_precio:         ['.js-price-container, .js-price-display',                    true],
    prod_pagos:          ['.js-product-payments-container, .js-max-installments-container', true],
    prod_envio:          ['.js-free-shipping-minimum-message, #product-shipping-container', true],
    prod_form_arriba:    ['form.js-product-form, .js-product-form',                    false],
    prod_boton:          ['form.js-product-form, .js-product-form',                    true],
    prod_desc_arriba:    ['.js-product-description, .product-description',             false],
    prod_desc:           ['.js-product-description, .product-description',             true],
    prod_final:          [null,                                                        true]
  };

  // Las ubicaciones viejas quedaron guardadas en la base. Se traducen a la equivalente
  // concreta para que ningún widget ya configurado se mueva de lugar al actualizar.
  var HEREDADAS = {
    inicio: 'prod_titulo',
    tras_intro: 'prod_precio',
    medio: 'prod_form_arriba',
    antes_final: 'prod_boton',
    final: 'prod_final'
  };

  /* La columna de la ficha. No sirve `.js-product-detail`: ese envuelve TAMBIÉN la galería
     de fotos, y sus hijos directos son un único <div> contenedor. */
  function columnaFicha() {
    return document.querySelector('.js-product-detail .product-detail-container') ||
           document.querySelector('.product-detail-container');
  }

  /* Sube desde el ancla hasta el hijo directo de la columna. Sin esto, "debajo del precio"
     inserta dentro del <span> del precio (queda en línea, roto) y "debajo del botón" cae
     adentro del <form>, entre la cantidad y el botón. El widget tiene que ser hermano de
     los bloques de la columna, no colarse dentro de uno. */
  function bloqueDe(el, cont) {
    var n = el;
    while (n && n.parentNode && n.parentNode !== cont) n = n.parentNode;
    return n && n.parentNode === cont ? n : null;
  }

  /* Primer ancla del selector que esté DENTRO de la columna. El filtro importa: la ficha
     trae al pie una grilla de productos relacionados con su propio `.js-addtocart` y su
     propio precio, y sin acotar la búsqueda el widget se iría a esa grilla. */
  function anclaEn(cont, sel) {
    var lista = cont.querySelectorAll(sel);
    for (var i = 0; i < lista.length; i++) {
      var b = bloqueDe(lista[i], cont);
      if (b) return b;
    }
    return null;
  }

  function insertarEnFicha(host, ubicacion) {
    var cont = columnaFicha();
    if (!cont) return false;

    var clave = ANCLAS[ubicacion] ? ubicacion : (HEREDADAS[ubicacion] || 'prod_final');
    var def = ANCLAS[clave];

    // El host ocupa su propio renglón completo aunque el vecino sea un flex o un grid.
    host.style.cssText = 'display:block;width:100%;flex:0 0 100%;margin:0';

    var ref = def[0] ? anclaEn(cont, def[0]) : null;
    if (!ref) {
      // Sin el ancla pedida (tema distinto, producto sin cuotas, sin descripción) va al
      // final de la columna: un lugar previsible es mejor que uno inventado.
      cont.appendChild(host);
      return true;
    }
    cont.insertBefore(host, def[1] ? ref.nextSibling : ref);
    return true;
  }

  /* Inserta el host en el lugar elegido desde el panel. Reemplaza al viejo data-mic-slot:
     antes había que pegar un <div> a mano en cada página para mover un widget. */
  function insertar(host, ubicacion) {
    // En la ficha de producto manda el mapa de anclas; el conteo de párrafos es para el
    // texto de las guías y el blog, donde no hay bloques con nombre.
    if (columnaFicha() && insertarEnFicha(host, ubicacion)) return true;

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
    'button{font:inherit;cursor:pointer;border:none}' +
    /* Entrada de los widgets de bloque: invisibles hasta que cruzan la pantalla (verUnaVez
       les pone la clase mic-vis en ese momento, el mismo en que ya marcaba la impresión). El
       gesto se elige desde el panel con data-anim; 'ninguna' no pone el atributo y no anima. */
    ':host([data-anim]){opacity:0;will-change:opacity,transform}' +
    ':host([data-anim].mic-vis){opacity:1;transform:none;transition:opacity .55s cubic-bezier(.22,.61,.36,1),transform .55s cubic-bezier(.22,.61,.36,1)}' +
    ':host([data-anim="subir"]){transform:translateY(20px)}' +
    ':host([data-anim="escala"]){transform:scale(.965)}' +
    ':host([data-anim="lado"]){transform:translateX(-24px)}' +
    /* Respeta a quien pidió menos movimiento: se ve completo, sin desplazamiento ni transición. */
    '@media (prefers-reduced-motion:reduce){:host([data-anim]){opacity:1;transform:none}:host([data-anim].mic-vis){transition:none}}';

  function pintar(shadow, css, html) {
    shadow.innerHTML = '<style>' + BASE_CSS + css + '</style>' + html;
  }

  /* Marca la impresión una sola vez, y recién cuando el widget entra en pantalla: una
     impresión que nadie vio no sirve para comparar widgets entre sí. */
  function verUnaVez(shadow, id, anim) {
    var el = shadow.host;
    // Estado inicial de la entrada. Sin dato, el gesto por defecto es 'subir'; 'ninguna' apaga
    // la animación (el widget aparece de una). El CSS de :host([data-anim]) lo deja invisible.
    if (anim == null) anim = 'subir';
    if (anim !== 'ninguna') el.setAttribute('data-anim', anim);
    function revelar() { el.classList.add('mic-vis'); }
    if (!('IntersectionObserver' in window)) { revelar(); evento(id, 'impresion'); return; }
    var obs = new IntersectionObserver(function (entradas) {
      for (var i = 0; i < entradas.length; i++) {
        if (entradas[i].isIntersecting) { revelar(); evento(id, 'impresion'); obs.disconnect(); }
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
    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
  };

  /* Fila de 5 estrellas para un rating dado (o para elegir uno). `n` es cuántas van llenas.
     `size` (opcional) fija el tamaño en px con estilo en línea; sin él manda el CSS —así el
     selector del formulario puede ser grande sin que las de las tarjetas lo hereden. El color
     de las llenas lo pone la clase `.st.on` (se setea una vez por widget). */
  function estrellas(n, size) {
    var st = size ? ' style="font-size:' + size + 'px"' : '';
    var s = '';
    for (var i = 1; i <= 5; i++) s += '<span class="st' + (i <= n ? ' on' : '') + '"' + st + '>★</span>';
    return s;
  }

  function colorEstrella(v, p) {
    if (v === 'ambar') return '#f59e0b';
    if (v === 'negro') return '#2a2620';
    if (v === 'marca') return p.bg;
    return '#e8a838'; // dorado, el estándar
  }

  /* Achica la foto en el navegador antes de subirla: una serverless no acepta cuerpos grandes
     y no tiene sentido mandar 5 MB de un celular. Máx 1200px, JPEG 0.82 → queda liviana. */
  function comprimirFoto(file, cb) {
    if (!file || !/^image\//.test(file.type)) { cb(null); return; }
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var max = 1200, w = img.width, h = img.height;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; }
      }
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      cv.toBlob(function (b) { cb(b); }, 'image/jpeg', 0.82);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    img.src = url;
  }

  R.resenas = function (w) {
    var c = w.config, p = paleta(c.color);
    var datos = w.datos || [];
    var resumen = w.resumen || { promedio: null, total: 0 };
    var conForm = !!c.formulario;
    // Sin reseñas reales no se dibuja relleno. Pero si el formulario está prendido, el bloque
    // igual aparece para que se pueda dejar la primera.
    if (!datos.length && !conForm) return;
    var sh = montar(w, false); if (!sh) return;

    var sc = colorEstrella(c.estrellaColor, p);
    var tam = Math.max(10, Math.min(30, Number(c.estrellaTamano) || 15));
    var alin = c.estrellaAlineacion === 'centro' ? 'center' : c.estrellaAlineacion === 'derecha' ? 'right' : 'left';
    var verFotos = c.mostrarFotos !== false;

    var cards = datos.map(function (r) {
      var sello = '';
      if (c.sello && r.verificada) {
        sello = '<span class="v">✓ ' + (r.fuente === 'google' ? 'Google' : 'compra verificada') + '</span>';
      }
      var estr = (r.rating ? '<div class="rs">' + estrellas(r.rating, tam) + '</div>' : '');
      var foto = (verFotos && r.foto ? '<img class="ph" src="' + esc(r.foto) + '" loading="lazy" alt="">' : '');
      var fecha = (c.mostrarFecha && r.fecha ? '<span class="fx">' + esc(r.fecha) + '</span>' : '');
      return '<article>' + estr + foto + '<p>' + esc(r.texto) + '</p><footer><b>' + esc(r.nombre) + '</b>' +
        sello + fecha + '</footer></article>';
    }).join('');

    // Encabezado con el promedio, estilo el de las apps de reseñas.
    var cab = '';
    if (c.promedio && resumen.promedio) {
      cab = '<div class="avg"><div class="num">' + String(resumen.promedio).replace('.', ',') + '</div>' +
        '<div class="am"><div class="rs">' + estrellas(Math.round(resumen.promedio), 16) + '</div>' +
        '<div class="cnt">' + resumen.total + (resumen.total === 1 ? ' reseña' : ' reseñas') + '</div></div></div>';
    }

    var boton = conForm
      ? '<button class="wr">' + esc(c.botonTexto || 'Escribir reseña') + '</button>'
      : '';

    var campoFoto = (conForm && c.permitirFoto)
      ? '<label class="fol"><input class="fo" type="file" accept="image/*">' +
        '<span class="fob">📷 Agregar una foto (opcional)</span></label><div class="fop"></div>'
      : '';

    // Formulario (oculto hasta tocar el botón). Vive dentro del mismo Shadow DOM.
    var form = conForm
      ? '<div class="ov"><div class="md"><button class="x" aria-label="Cerrar">×</button>' +
        '<h4>Dejá tu reseña</h4>' +
        '<div class="pick" role="radiogroup">' + estrellas(0) + '</div>' +
        '<input class="nm" type="text" maxlength="80" placeholder="Tu nombre">' +
        '<textarea class="tx" maxlength="1000" placeholder="¿Qué te pareció? Contá tu experiencia."></textarea>' +
        campoFoto +
        '<input class="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<button class="sb">Enviar reseña</button>' +
        '<div class="msg"></div></div></div>'
      : '';

    // Lightbox para ver la foto en grande (siempre presente por si hay fotos en las tarjetas).
    var lightbox = '<div class="lb"><img alt=""></div>';

    pintar(sh,
      'h3{margin:0 0 4px;font-size:20px;color:#2a2620}' +
      '.sub{margin:0 0 16px;font-size:13.5px;color:#6a6157}' +
      '.top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}' +
      '.avg{display:flex;align-items:center;gap:12px}' +
      '.num{font-size:38px;font-weight:700;color:#2a2620;line-height:1}' +
      '.cnt{font-size:12.5px;color:#6a6157;margin-top:2px}' +
      '.rs{letter-spacing:1px;text-align:' + alin + '}.st{color:#d9d4cb;font-size:15px}.st.on{color:' + sc + '}' +
      '.g{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}' +
      'article{background:#fff;border:1px solid #e6e2da;border-radius:10px;padding:18px}' +
      'article .rs{margin-bottom:9px}' +
      '.ph{width:100%;max-height:220px;object-fit:cover;border-radius:8px;margin:0 0 12px;cursor:pointer;display:block}' +
      'p{margin:0 0 12px;font-size:14.5px;line-height:1.6;color:#3a352e}' +
      'footer{display:flex;flex-direction:column;gap:3px}' +
      'b{font-size:13.5px;color:#2a2620}' +
      '.v{font-size:11.5px;color:' + p.bg + ';font-weight:600}' +
      '.fx{font-size:11px;color:#a89c8e}' +
      '.wr{background:' + p.bg + ';color:' + p.texto + ';padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600}' +
      // Modal
      '.ov{display:none;position:fixed;inset:0;z-index:99999;background:rgba(20,18,15,.55);align-items:center;justify-content:center;padding:16px}' +
      '.ov.on{display:flex}' +
      '.md{background:#fff;border-radius:14px;padding:24px;max-width:400px;width:100%;position:relative;box-shadow:0 18px 50px rgba(0,0,0,.3);max-height:92vh;overflow:auto}' +
      '.md h4{margin:0 0 14px;font-size:18px;color:#2a2620}' +
      '.x{position:absolute;top:12px;right:14px;background:none;font-size:24px;color:#a89c8e;line-height:1}' +
      '.pick{margin-bottom:14px}.pick .st{font-size:30px;cursor:pointer;color:#d9d4cb}.pick .st.on{color:' + sc + '}' +
      '.md input.nm,.md textarea{width:100%;border:1px solid #d9d4cb;border-radius:8px;padding:11px;font-size:14px;margin-bottom:11px;color:#2a2620}' +
      '.md textarea{min-height:96px;resize:vertical}' +
      '.fol{display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:11px}' +
      '.fol .fo{display:none}.fob{font-size:13px;color:' + p.bg + ';font-weight:600}' +
      '.fop{margin-bottom:11px}.fop img{max-height:120px;border-radius:8px;display:block}' +
      '.hp{position:absolute;left:-9999px;width:1px;height:1px}' +
      '.sb{width:100%;background:' + p.bg + ';color:' + p.texto + ';padding:12px;border-radius:8px;font-size:15px;font-weight:600}' +
      '.msg{margin-top:12px;font-size:13.5px;text-align:center;color:#3a352e}' +
      '.msg.ok{color:' + p.bg + '}.msg.err{color:#b0341d}' +
      // Lightbox
      '.lb{display:none;position:fixed;inset:0;z-index:100000;background:rgba(10,9,7,.88);align-items:center;justify-content:center;padding:20px;cursor:zoom-out}' +
      '.lb.on{display:flex}.lb img{max-width:100%;max-height:100%;border-radius:8px}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') +
      (c.subtitulo ? '<div class="sub">' + esc(c.subtitulo) + '</div>' : '') +
      '<div class="top">' + cab + boton + '</div>' +
      '<div class="g">' + cards + '</div>' + form + lightbox);

    if (verFotos) montarLightbox(sh);
    if (conForm) montarFormResena(sh, w, c);
    verUnaVez(sh, w.id, c.animacion);
  };

  /* Clic en una foto de reseña → se ve en grande. Un solo overlay reutilizado. */
  function montarLightbox(sh) {
    var lb = sh.querySelector('.lb'); if (!lb) return;
    var lbi = lb.querySelector('img');
    var fotos = sh.querySelectorAll('.ph');
    for (var i = 0; i < fotos.length; i++) {
      (function (el) {
        el.addEventListener('click', function () { lbi.src = el.src; lb.classList.add('on'); });
      })(fotos[i]);
    }
    lb.addEventListener('click', function () { lb.classList.remove('on'); lbi.src = ''; });
  }

  /* Interacción del formulario de reseña: elegir estrellas, foto opcional, enviar y bloquear
     el reenvío. El envío queda pendiente de moderación en el panel; por eso el mensaje habla
     de revisión. Va como multipart porque puede llevar la foto adjunta. */
  function montarFormResena(sh, w, c) {
    var ov = sh.querySelector('.ov'), abrir = sh.querySelector('.wr');
    if (!ov || !abrir) return;
    var cerrar = sh.querySelector('.x'), enviar = sh.querySelector('.sb'), msg = sh.querySelector('.msg');
    var estrs = sh.querySelectorAll('.pick .st'), elegido = 0, fotoBlob = null;

    abrir.addEventListener('click', function () { ov.classList.add('on'); evento(w.id, 'interaccion'); });
    cerrar.addEventListener('click', function () { ov.classList.remove('on'); });
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.classList.remove('on'); });

    for (var i = 0; i < estrs.length; i++) {
      (function (idx) {
        estrs[idx].addEventListener('click', function () {
          elegido = idx + 1;
          for (var j = 0; j < estrs.length; j++) estrs[j].classList.toggle('on', j < elegido);
        });
      })(i);
    }

    // Deep-link: si la persona llega con ?calificar (o #resena) en la URL —el link que
    // manda el mensaje de WhatsApp post-entrega— se le abre el formulario solo. Una sola vez
    // por página, aunque haya más de un widget de reseñas.
    try {
      if (!window.__micCalificar && (/[?&]calificar\b/.test(location.search) || location.hash === '#resena')) {
        window.__micCalificar = true;
        ov.classList.add('on'); evento(w.id, 'interaccion');
      }
    } catch (e) {}

    var fo = sh.querySelector('.fo'), fop = sh.querySelector('.fop');
    if (fo) {
      fo.addEventListener('change', function () {
        var f = fo.files && fo.files[0];
        fotoBlob = null; if (fop) fop.innerHTML = '';
        if (!f) return;
        comprimirFoto(f, function (b) {
          if (!b) return;
          fotoBlob = b;
          if (fop) { var im = new Image(); im.src = URL.createObjectURL(b); fop.innerHTML = ''; fop.appendChild(im); }
        });
      });
    }

    enviar.addEventListener('click', function () {
      var nm = sh.querySelector('.nm').value.trim();
      var tx = sh.querySelector('.tx').value.trim();
      var hp = sh.querySelector('.hp').value;
      msg.className = 'msg';
      if (!elegido) { msg.textContent = 'Elegí cuántas estrellas.'; msg.className = 'msg err'; return; }
      if (nm.length < 2) { msg.textContent = 'Poné tu nombre.'; msg.className = 'msg err'; return; }
      if (tx.length < 10) { msg.textContent = 'Contá un poco más tu experiencia.'; msg.className = 'msg err'; return; }
      enviar.disabled = true; msg.textContent = 'Enviando…';

      var fd = new FormData();
      fd.append('autor', nm); fd.append('texto', tx); fd.append('rating', String(elegido));
      fd.append('website', hp);
      if (PRODUCTO) fd.append('product_id', PRODUCTO);
      if (fotoBlob) fd.append('foto', fotoBlob, 'resena.jpg');

      // Sin Content-Type manual: el navegador pone el boundary del multipart.
      fetch(BASE + '/api/widgets/resena', { method: 'POST', body: fd })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (d && d.ok) {
            msg.className = 'msg ok';
            msg.textContent = c.mensajeGracias || '¡Gracias! Tu reseña se publicará luego de una breve revisión.';
            evento(w.id, 'conversion');
            var oc = ['.pick', '.nm', '.tx', '.fol', '.fop'];
            for (var k = 0; k < oc.length; k++) { var el = sh.querySelector(oc[k]); if (el) el.style.display = 'none'; }
            enviar.style.display = 'none';
          } else {
            msg.className = 'msg err'; enviar.disabled = false;
            msg.textContent = 'No se pudo enviar. Probá de nuevo en un rato.';
          }
        }).catch(function () {
          msg.className = 'msg err'; enviar.disabled = false;
          msg.textContent = 'No se pudo enviar. Revisá tu conexión.';
        });
    });
  }

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
      verUnaVez(sh, w.id, c.animacion);
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

  /* El precio tachado (el "antes"). Vive aparte de precioPagina() porque puede no existir:
     un producto sin promoción no tiene precio de lista, y ahí no hay ahorro que mostrar. */
  function precioListaPagina() {
    var sel = ['#compare_price_display', '.js-compare-price-display', '[data-store="product-compare-price"]'];
    for (var i = 0; i < sel.length; i++) {
      var el = document.querySelector(sel[i]);
      if (!el) continue;
      // Un compare vacío o escondido es "sin promoción", no cero.
      if (el.offsetParent === null && (el.style.display === 'none' || !el.textContent.trim())) continue;
      var limpio = (el.textContent || '').replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
      var n = parseFloat(limpio);
      if (n > 0) return n;
    }
    return 0;
  }

  /* Precio con descuento por medio de pago (transferencia). Tiendanube ya lo muestra en un
     renglón chico bajo el precio; leerlo de ahí evita repetir un porcentaje a mano que
     después nadie recuerda actualizar cuando se cambia la configuración de pagos. */
  function precioTransferencia() {
    var el = document.querySelector('.js-payment-discount-price-product[data-priceraw-without-shipping]');
    if (!el) return null;
    var cent = Number(el.getAttribute('data-priceraw-without-shipping'));
    if (!(cent > 0)) return null;
    var nom = document.querySelector('.js-payment-discount-name-product');
    return { monto: cent / 100, medio: (nom && nom.textContent.trim()) || 'transferencia' };
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
    verUnaVez(sh, w.id, c.animacion);
  };

  R.envio_estimado = function (w) {
    var c = w.config;
    var p = paleta(c.color), pt = paleta(c.color_texto);
    var sh = montar(w, false); if (!sh) return;

    /* Suma días hábiles. El sábado cuenta solo si la tienda despacha los sábados; el
       domingo nunca. Es la diferencia entre una fecha creíble y una que no se cumple. */
    function habiles(desde, dias) {
      var d = new Date(desde.getTime()), sumados = 0;
      while (sumados < dias) {
        d.setDate(d.getDate() + 1);
        var dia = d.getDay();
        if (dia === 0) continue;
        if (dia === 6 && !c.sabados) continue;
        sumados++;
      }
      return d;
    }

    var corte = Number(c.corte);
    if (!isFinite(corte)) corte = 18;
    var ahora = new Date();
    var pasoLaHora = ahora.getHours() >= corte;

    // Base: hoy, salvo que ya haya pasado la hora de corte. Un domingo o un sábado sin
    // despacho también corre la base al próximo día hábil.
    var base = new Date();
    if (pasoLaHora) base = habiles(base, 1);
    else {
      var dh = base.getDay();
      if (dh === 0 || (dh === 6 && !c.sabados)) base = habiles(base, 1);
    }

    var envio = Number(c.dias_envio) > 0 ? habiles(base, Number(c.dias_envio)) : base;
    var entrega = habiles(envio, Math.max(1, Number(c.dias_entrega) || 1));
    var entrega2 = habiles(entrega, 1);

    var MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    function corto(d) { return d.getDate() + ' ' + MESES[d.getMonth()]; }

    // "Hoy" y "Mañana" se entienden de un vistazo; una fecha obliga a pensar qué día es hoy.
    function relativo(d) {
      var h = new Date(); h.setHours(0, 0, 0, 0);
      var x = new Date(d.getTime()); x.setHours(0, 0, 0, 0);
      var dias = Math.round((x - h) / 86400000);
      if (dias <= 0) return 'Hoy';
      if (dias === 1) return 'Mañana';
      return corto(d);
    }

    function dosDigitos(n) { return (n < 10 ? '0' : '') + n; }
    var limite = (!pasoLaHora && c.mostrar_limite) ? 'antes de las ' + dosDigitos(corte) + ':00' : '';

    var textoEntrega = c.rango
      ? corto(entrega) + ' - ' + corto(entrega2)
      : corto(entrega);

    var SVG = {
      compra: '<path d="M6 7V6a6 6 0 0112 0v1h3l-1.5 15h-15L3 7h3zm2 0h8V6a4 4 0 00-8 0v1z"/>',
      envio: '<path d="M1 5h13v10H1V5zm14 3h4l3 4v3h-2a2.5 2.5 0 01-5 0h-.5V8h.5zM4.5 15a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z"/>',
      entrega: '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>'
    };
    function icono(clave, emoji) {
      if (c.iconos === 'emoji') return '<span class="em">' + emoji + '</span>';
      return '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">' + SVG[clave] + '</svg>';
    }

    function paso(clave, emoji, titulo, fecha, extra) {
      return '<div class="p"><span class="ic">' + icono(clave, emoji) + '</span>' +
        '<span class="t">' + esc(titulo) + '</span>' +
        '<span class="f">' + esc(fecha) + '</span>' +
        (extra ? '<span class="lim">' + esc(extra) + '</span>' : '') + '</div>';
    }

    pintar(sh,
      '.c{margin:20px 0;padding:' + (c.fondo === 'ninguno' ? '4px 0' : '18px 14px') + ';' +
      (c.fondo === 'ninguno' ? '' : 'background:' + p.suave + ';border-radius:12px;') + '}' +
      '.fila{display:flex;align-items:flex-start;justify-content:space-between}' +
      '.p{flex:1 1 0;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px;min-width:0}' +
      '.ic{color:' + p.bg + ';height:24px;display:flex;align-items:center}' +
      '.em{font-size:20px;line-height:1}' +
      '.t{font-size:13.5px;font-weight:600;color:' + pt.bg + '}' +
      '.f{font-size:12.5px;color:' + p.bg + '}' +
      '.lim{font-size:10.5px;color:#8a8177;text-transform:uppercase;letter-spacing:.04em}' +
      // La línea se alinea con los íconos, no con el bloque entero: si se centrara sobre
      // todo el alto, quedaría cruzando el texto.
      '.ln{flex:0 1 60px;height:1px;background:' + p.bg + ';opacity:.45;margin-top:12px}' +
      '.nota{margin:12px 0 0;text-align:center;font-size:11.5px;color:#8a8177}',
      '<div class="c"><div class="fila">' +
      paso('compra', '🛒', c.et_compra || 'Compra', relativo(base), limite) +
      '<span class="ln"></span>' +
      paso('envio', '🚚', c.et_envio || 'Envío', relativo(envio), '') +
      '<span class="ln"></span>' +
      paso('entrega', '✅', c.et_entrega || 'Entrega', textoEntrega, '') +
      '</div>' +
      (c.nota ? '<p class="nota">' + esc(c.nota) + '</p>' : '') +
      '</div>');

    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
  };

  /* Desglose del pack.
     El widget no guarda ni un solo importe: reparte el precio de lista que la página ya
     muestra según el peso de cada pieza. Así el desglose no puede quedar desfasado del
     precio real — que es exactamente lo que pasaba cuando la tabla estaba escrita a mano
     dentro de la descripción del producto. */
  R.desglose_pack = function (w) {
    var c = w.config, p = paleta(c.color);
    var items = (c.items || []).filter(function (i) { return i.nombre; });
    if (!items.length) return;

    var pagando = precioPagina();
    var lista = precioListaPagina();
    // Sin promoción vigente no hay dos números que enfrentar: el desglose se reparte
    // sobre lo que se paga y no se habla de ahorro.
    var base = lista > pagando ? lista : pagando;
    var hayAhorro = lista > pagando && pagando > 0;

    var sumaPesos = items.reduce(function (a, i) { return a + (Number(i.peso) > 0 ? Number(i.peso) : 1); }, 0);
    var valores = [];
    if (base > 0 && sumaPesos > 0) {
      var acum = 0, mayor = 0;
      for (var k = 0; k < items.length; k++) {
        var peso = Number(items[k].peso) > 0 ? Number(items[k].peso) : 1;
        // A la centena: un desglose con centavos parece una cuenta forzada.
        var v = Math.round((base * peso / sumaPesos) / 100) * 100;
        valores.push(v); acum += v;
        if (peso > (Number(items[mayor].peso) || 1)) mayor = k;
      }
      // El redondeo desajusta la suma. Se corrige en la pieza más grande: si las filas no
      // suman el total que está abajo, el cliente lo nota y deja de creer toda la tabla.
      valores[mayor] += base - acum;
    }

    var sh = montar(w, false); if (!sh) return;

    var filas = items.map(function (i, n) {
      return '<tr>' +
        '<td><b>' + esc(i.nombre) + '</b>' + (i.detalle ? '<small>' + esc(i.detalle) + '</small>' : '') + '</td>' +
        (valores.length ? '<td class="n">' + esc(pesos(valores[n])) + '</td>' : '') +
        '</tr>';
    }).join('');

    var pie = '';
    if (valores.length && hayAhorro) {
      pie =
        '<tr class="t"><td>' + esc(c.etiqueta_total || 'Valor por separado') + '</td>' +
        '<td class="n tach">' + esc(pesos(base)) + '</td></tr>' +
        '<tr class="pk"><td><b>' + esc(c.etiqueta_pack || 'Precio del pack') + '</b></td>' +
        '<td class="n"><b>' + esc(pesos(pagando)) + '</b></td></tr>';

      // El mejor precio real de la tienda. Va como fila propia porque el renglón nativo de
      // Tiendanube es chico y se pierde: quien está sumando piezas es justo quien lo mira.
      var tr = c.mostrar_transferencia !== false ? precioTransferencia() : null;
      if (tr && tr.monto < pagando) {
        pie += '<tr class="tf"><td>Pagando con ' + esc(tr.medio.toLowerCase()) + '</td>' +
          '<td class="n"><b>' + esc(pesos(tr.monto)) + '</b></td></tr>';
      }
    }

    var ahorroTxt = '';
    if (hayAhorro && c.mostrar_ahorro !== false) {
      var a = base - pagando;
      ahorroTxt = '<p class="ah">Ahorrás <b>' + esc(pesos(a)) + '</b> — un <b>' +
        Math.round(a / base * 100) + '&nbsp;%</b> respecto del valor por separado.</p>';
    }

    pintar(sh,
      'h3{margin:0 0 6px;font-size:20px;color:' + p.bg + '}' +
      '.in{margin:0 0 14px;font-size:13px;color:#6a6157}' +
      '.w{overflow-x:auto;margin:20px 0 0}' +
      'table{width:100%;border-collapse:collapse;font-size:14px}' +
      'td{padding:12px 10px;border-top:1px solid #e6e2da;vertical-align:top}' +
      'td b{color:#2a2620;font-weight:600}' +
      'td small{display:block;margin-top:3px;font-size:12px;color:#6a6157;line-height:1.45}' +
      '.n{text-align:right;white-space:nowrap;color:#5a534a}' +
      '.tach{text-decoration:line-through;color:#8c8c82}' +
      '.t td{color:#6a6157}' +
      '.pk td{background:' + p.suave + ';border-top:1px solid ' + p.bg + ';padding:14px 10px}' +
      '.pk b{color:' + p.bg + ';font-size:18px}' +
      '.tf td{color:#6a6157;border-top:0;padding-top:0;background:' + p.suave + '}' +
      '.tf b{color:' + p.bg + '}' +
      '.ah{text-align:center;margin:14px 0 2px;font-size:14px;color:' + p.bg + '}' +
      '.nt{text-align:center;margin:0;font-size:12px;color:#6a6157}',
      (c.titulo ? '<h3>' + esc(c.titulo) + '</h3>' : '') +
      (c.intro ? '<p class="in">' + esc(c.intro) + '</p>' : '') +
      '<div class="w"><table><tbody>' + filas + pie + '</tbody></table></div>' +
      ahorroTxt +
      (c.nota ? '<p class="nt">' + esc(c.nota) + '</p>' : ''));
    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
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
        conTransicion(m, 'mic-ban-' + w.id, function () {
          n = (n + 1) % items.length;
          m.textContent = items[n].texto;
        });
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

  /* ── Corte de despacho ──────────────────────────────────────────────────────
   * Dos estados que se resuelven solos con la hora de Argentina:
   *   abierto → hoy hay despacho y todavía no cerró: "Sale hoy" + reloj al corte.
   *   cerrado → ya cerró, o hoy no se despacha: "Sale el martes", sin reloj.
   *
   * Todo el cálculo va en hora de Argentina (UTC-3 fijo, el país no mueve el reloj en
   * verano) y NO en la del visitante: si no, alguien mirando desde España a las 20:00 de
   * allá vería "sale hoy" cuando en el depósito ya son las 15:00 y el corte pasó.
   *
   * El truco del desfasaje: `Date.now() - 3h` da un instante cuyos getUTC* devuelven los
   * valores de pared de Argentina. Se hacen todas las cuentas en ese espacio corrido y
   * al final se suman las 3 h para volver a un timestamp real y poder restar contra
   * Date.now(). Sumar/restar días con getUTC* es seguro; con getHours() locales no,
   * porque en un huso con horario de verano un día puede tener 23 o 25 horas.
   */
  var DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var CLAVES_DIA = ['dia_dom', 'dia_lun', 'dia_mar', 'dia_mie', 'dia_jue', 'dia_vie', 'dia_sab'];

  R.corte_despacho = function (w) {
    var c = w.config, p = paleta(c.color);
    var H = 3600000, D = 86400000;

    // Días con despacho, como números de getUTCDay(): 0 domingo … 6 sábado.
    var dias = [];
    for (var i = 0; i < 7; i++) if (c[CLAVES_DIA[i]]) dias.push(i);
    if (!dias.length) return; // sin ningún día no hay nada verdadero que decir

    var hora = Math.min(23, Math.max(0, Number(c.hora_corte)));
    if (!isFinite(hora)) hora = 14;
    var umbral = Number(c.horas_reloj) > 0 ? Number(c.horas_reloj) : 8;

    // Feriados como YYYY-MM-DD, para comparar contra la fecha de pared argentina.
    var feriados = {};
    String(c.feriados || '').split(/[\n,;]+/).forEach(function (s) {
      s = s.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) feriados[s] = 1;
    });

    function ymd(d) {
      var m = d.getUTCMonth() + 1, x = d.getUTCDate();
      return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x;
    }

    /* Próximo corte que todavía no pasó. Devuelve el timestamp REAL y si cae hoy.
       Mira 14 días para no quedarse sin salida con una cadencia de un solo día que
       encima cae feriado. */
    function proximo() {
      var ahora = Date.now() - 3 * H; // espacio corrido: getUTC* = hora argentina
      var a = new Date(ahora);
      var medianoche = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
      for (var k = 0; k < 14; k++) {
        var dia = new Date(medianoche + k * D);
        if (dias.indexOf(dia.getUTCDay()) < 0) continue;
        if (feriados[ymd(dia)]) continue;
        var corte = medianoche + k * D + hora * H;
        if (corte > ahora) return { ms: corte + 3 * H, dow: dia.getUTCDay(), hoy: k === 0 };
      }
      return null;
    }

    var pr = proximo();
    if (!pr) return;

    // El despacho siguiente al que se está por cerrar: es el "después" del mensaje
    // abierto ("si no llegás, entra en el del martes").
    function despuesDe(pr) {
      var base = pr.ms - 3 * H; // volver al espacio corrido
      var b = new Date(base);
      var medianoche = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
      for (var k = 1; k < 15; k++) {
        var dia = new Date(medianoche + k * D);
        if (dias.indexOf(dia.getUTCDay()) < 0) continue;
        if (feriados[ymd(dia)]) continue;
        return dia.getUTCDay();
      }
      return null;
    }

    var sigDow = despuesDe(pr);
    var hh = (hora < 10 ? '0' : '') + hora + ':00';

    /* Pasado el corte, el próximo despacho es casi siempre el día siguiente. «Sale el
       martes» un lunes a las 18:00 se lee mucho más lejos de lo que es; «Sale mañana»
       dice exactamente lo mismo y no suena a demora. Por eso {dia} viene con artículo
       incluido («el martes») o resuelto como «mañana»/«hoy»: así una sola plantilla
       —«Sale {dia}»— funciona en los tres casos sin quedar mal escrita. */
    function comoDia(ms) {
      var hoyART = new Date(Date.now() - 3 * H);
      var hoy0 = Date.UTC(hoyART.getUTCFullYear(), hoyART.getUTCMonth(), hoyART.getUTCDate());
      var d = new Date(ms - 3 * H);
      var d0 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      var faltanDias = Math.round((d0 - hoy0) / D);
      if (faltanDias === 0) return 'hoy';
      if (faltanDias === 1) return 'mañana';
      return 'el ' + DIAS_ES[d.getUTCDay()];
    }

    function llenar(txt, diaNombre) {
      return String(txt || '')
        .replace(/\{hora\}/g, hh)
        .replace(/\{dia\}/g, diaNombre)
        // Sin artículo: la plantilla lo pone («en el del {proximo}» → «en el del martes»).
        .replace(/\{proximo\}/g, sigDow == null ? 'próximo' : DIAS_ES[sigDow]);
    }

    var abierto = pr.hoy;
    var nombreDia = comoDia(pr.ms);
    var titulo = llenar(abierto ? c.titulo_abierto : c.titulo_cerrado, nombreDia);
    var nota   = llenar(abierto ? c.nota_abierta   : c.nota_cerrada,   nombreDia);

    var sh = montar(w, false); if (!sh) return;
    pintar(sh,
      '.c{display:flex;align-items:center;gap:14px;background:' + p.suave + ';border-left:3px solid ' + p.bg +
        ';border-radius:10px;padding:14px 16px;margin:18px 0}' +
      '.ic{flex:0 0 auto;font-size:20px;line-height:1}' +
      '.tx{flex:1 1 auto;min-width:0}' +
      'b{display:block;font-size:15px;font-weight:700;color:#2a2620;line-height:1.25}' +
      'small{display:block;margin-top:3px;font-size:12.5px;color:#5a534a;line-height:1.4}' +
      /* El reloj es tabular para que no se muevan las cifras al bajar los segundos. */
      '.rl{flex:0 0 auto;background:' + p.bg + ';color:' + p.texto + ';border-radius:8px;padding:7px 11px;' +
        'font-variant-numeric:tabular-nums;font-size:15px;font-weight:700;white-space:nowrap}' +
      '@media(max-width:420px){.c{flex-wrap:wrap}.rl{order:3}}',
      '<div class="c"><span class="ic">' + (abierto ? '🕒' : '📦') + '</span>' +
      '<span class="tx"><b>' + esc(titulo) + '</b>' + (nota ? '<small>' + esc(nota) + '</small>' : '') + '</span>' +
      (abierto ? '<span class="rl"></span>' : '') + '</div>');

    if (abierto) {
      var rl = sh.querySelector('.rl'), t = null;
      function tic() {
        var falta = pr.ms - Date.now();
        // Cruzó el corte con la pestaña abierta: se recalcula el estado desde cero en
        // vez de mostrar 00:00:00, que sería mentira a partir de ese segundo.
        if (falta <= 0) { clearInterval(t); sh.host.remove(); R.corte_despacho(w); return; }
        var s = Math.floor(falta / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
        if (h >= umbral) { rl.textContent = hh; return; } // lejos: la hora, sin reloj corriendo
        var dd = function (n) { return (n < 10 ? '0' : '') + n; };
        rl.textContent = h > 0 ? h + ' h ' + dd(m) + ' min' : dd(m) + ':' + dd(s % 60);
      }
      tic();
      t = setInterval(tic, 1000);
      // Sin esto el intervalo sigue corriendo sobre un nodo que ya no está en la página.
      window.addEventListener('pagehide', function () { clearInterval(t); });
    }

    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
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
    verUnaVez(sh, w.id, c.animacion);
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
      // Al cruzar el umbral, el texto muta con un crossfade en vez de saltar de golpe.
      conTransicion(txt, 'mic-prog-' + w.id, function () {
        txt.innerHTML = falta > 0
          ? esc(c.texto_falta || 'Te falta') + ' <b>' + esc(pesos(falta)) + '</b>'
          : '<b>' + esc(c.texto_logrado || '¡Envío gratis!') + '</b>';
      });
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
      var montoTotal = elegidos.reduce(function (acc, ch) {
        return acc + (Number(ch.getAttribute('data-precio')) || 0);
      }, 0);
      evento(w.id, 'interaccion');
      boton.disabled = true;
      boton.textContent = 'Agregando…';

      // Tiendanube agrega de a un producto por POST a /comprar/. Se mandan en secuencia y
      // recién al terminar se va al carrito: si se dispararan en paralelo, el carrito se
      // queda con el último que contestó.
      var i = 0;
      (function siguiente() {
        if (i >= elegidos.length) {
          evento(w.id, 'conversion', montoTotal);
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

    verUnaVez(sh, w.id, c.animacion);
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
        verUnaVez(sh, w.id, c.animacion);
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
        evento(w.id, 'conversion', sup.precio - actual);
        location.href = '/carrito/';
      });
    });
    verUnaVez(sh, w.id, c.animacion);
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
        verUnaVez(sh, w.id, c.animacion);
      }

      sh.host.style.display = '';
      sh.querySelector('.lista').innerHTML = lista.map(function (x) {
        return '<div class="it">' +
          (x.p.imagen ? '<img src="' + esc(x.p.imagen) + '" alt="">' : '<span class="ph"></span>') +
          '<span class="d"><b>' + esc(x.p.nombre) + '</b>' +
          (x.nota ? '<span class="n">' + esc(x.nota) + '</span>' : '') + '</span>' +
          '<span class="pr">' + esc(pesos(x.p.precio)) + '</span>' +
          '<button data-id="' + esc(x.p.id) + '" data-precio="' + x.p.precio + '">' + esc(c.etiqueta || 'Sumar') + '</button></div>';
      }).join('');

      [].slice.call(sh.querySelectorAll('button')).forEach(function (b) {
        b.addEventListener('click', function () {
          evento(w.id, 'interaccion');
          b.disabled = true; b.textContent = 'Sumando…';
          var monto = Number(b.getAttribute('data-precio')) || 0;
          agregarAlCarrito(b.getAttribute('data-id')).then(function () {
            evento(w.id, 'conversion', monto);
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
          evento(w.id, 'conversion', pr.precio);
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

    verUnaVez(sh, w.id, c.animacion);
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

  fetch(BASE + '/api/widgets/config?ctx=' + encodeURIComponent(CTX) +
        (PRODUCTO ? '&producto=' + encodeURIComponent(PRODUCTO) : ''))
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
