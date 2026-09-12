/* ────────────────────────────────────────────────────────────────────────────
   marca.js — correcciones de marca y accesibilidad del storefront.
   Carga vía external-codes con el patrón <img onerror> (los <script> pegados
   en #assortedJs se renderizan escapados y nunca corren).

   Arregla lo que el CSS no puede:
     1. <h1> vacío  -> título real (SEO + lectores de pantalla)
     2. slides del hero sin alt descriptivo ni link al producto
     3. emoji de la barra de anuncio
     4. <h3 class="h1"> -> jerarquía de encabezados coherente
     5. landmark <main> ausente
     6. link del carrito sin nombre accesible

   Todo es idempotente y defensivo: si el tema cambia un selector, el bloque
   correspondiente se saltea sin romper los demás.
   Medido sobre infomicelium.com.ar el 11/09/2026.
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__mcMarcaInit) return;
  window.__mcMarcaInit = 1;

  var esHome = location.pathname === '/' || location.pathname === '';

  function log(m) { if (location.search.indexOf('mcdebug') > -1) console.log('[marca]', m); }

  /* ── 1. H1 que solo dice la marca ─────────────────────────────────────────
     Medido en la home (11/09/2026, DESPUÉS de la hidratación): el <h1 class="m-0">
     del logo contiene "MICELIUM". No está vacío — una lectura temprana del DOM
     lo reportaba así, pero el tema lo llena con el nombre de la tienda.

     El problema real: el único H1 de la home dice el nombre de la marca y nada
     sobre qué se vende. Para buscadores y lectores de pantalla, la página no
     declara su tema.

     Se reemplaza el TEXTO ACCESIBLE sin tocar el logo visible: el <h1> queda
     fuera de pantalla con el título real y el logo se marca aria-hidden, así
     nadie ve un cambio y la semántica mejora.                                 */
  var TITULO_HOME = 'Incubadoras automáticas para cultivar en casa — Micelium';
  function arreglarH1() {
    if (!esHome) return;
    var h1 = document.querySelector('h1');
    if (!h1 || h1.dataset.mcFixed) return;
    var txt = (h1.textContent || '').trim();
    // Solo actuar si el H1 está vacío o dice apenas el nombre de la marca
    if (txt && !/^micelium®?$/i.test(txt)) return;

    // El logo sigue visible. NO se usa aria-hidden sobre el <a> del logo: un
    // elemento aria-hidden con descendientes enfocables es una falla de
    // accesibilidad (verificado con Lighthouse el 11/09/2026). Se oculta solo
    // la IMAGEN, que no es enfocable, y el <a> conserva su nombre accesible.
    var logoImg = h1.querySelector('img, svg');
    if (logoImg) logoImg.setAttribute('aria-hidden', 'true');
    var logoLink = h1.querySelector('a');
    if (logoLink && !(logoLink.getAttribute('aria-label') || '').trim()) {
      logoLink.setAttribute('aria-label', 'Micelium — inicio');
    }

    var sr = document.createElement('span');
    sr.textContent = TITULO_HOME;
    sr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;' +
                       'clip:rect(0 0 0 0);white-space:nowrap;border:0;padding:0;margin:-1px';
    h1.appendChild(sr);
    h1.dataset.mcFixed = '1';
    log('h1 con titulo real');
  }

  /* ── 2. Slides del hero: alt descriptivo + link al producto ───────────────
     Medido: alt="Carrusel 1"/"Carrusel 2" y ningún <a> envolviendo el slide.
     Todo el copy del hero está quemado en el .webp, así que sin alt ese
     contenido no existe para Google ni para un lector de pantalla.           */
  var ALTS = {
    // por orden de aparición; el tema nombra los archivos igual en ambos slides
    '1': 'Incubadora Micelium: reduce la contaminación, multiplica x2 tu cosecha, ' +
         'sin ventilar ni rociar',
    '2': 'Incubadoras Fungi Micelium — fabricación nacional. Confían en nosotros: ' +
         'CONICET, INTA e INPI'
  };
  function arreglarSlides() {
    var imgs = document.querySelectorAll('.slider-image, .slider-slide img');
    if (!imgs.length) return;
    var n = 0;
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var alt = (img.getAttribute('alt') || '').trim();
      if (/^carrusel/i.test(alt) || !alt) {
        n++;
        var clave = (alt.match(/\d/) || [String((n % 2) + 1)])[0];
        img.setAttribute('alt', ALTS[clave] || ALTS['1']);
      }
      // envolver en link al producto si no lo tiene
      if (!img.closest('a')) {
        var a = document.createElement('a');
        a.href = '/productos/pack-oferta-incubadora-automatica-inc101/';
        a.setAttribute('aria-label', 'Ver la Incubadora Automática INC101');
        a.style.display = 'block';
        img.parentNode.insertBefore(a, img);
        a.appendChild(img);
      }
    }
    if (n) log('slides con alt: ' + n);
  }

  /* ── 3. Emoji de la barra de anuncio ──────────────────────────────────────
     El sistema veta emojis de teclado como iconografía.                      */
  function limpiarEmoji() {
    var re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;
    var nodos = document.querySelectorAll('.section-advertising, .link-contrast, .js-advertising-bar');
    for (var i = 0; i < nodos.length; i++) {
      var w = document.createTreeWalker(nodos[i], NodeFilter.SHOW_TEXT, null);
      var t;
      while ((t = w.nextNode())) {
        if (re.test(t.nodeValue)) {
          t.nodeValue = t.nodeValue.replace(re, '').replace(/^\s*[·|-]\s*/, '').trim();
          log('emoji removido');
        }
      }
    }
  }

  /* ── 4. Jerarquía de encabezados ──────────────────────────────────────────
     Medido: <h3 class="h1">Destacados</h3> y <h3 class="h2">…
     Lighthouse: "Heading elements are not in a sequentially-descending order".
     Se corrige el ROL sin cambiar el tamaño visual (la clase h1/h2 es estilo). */
  function arreglarHeadings() {
    var h3 = document.querySelectorAll('h3.h1, h3.h2');
    for (var i = 0; i < h3.length; i++) {
      // aria-level ajusta la semántica sin reconstruir el nodo ni perder estilos
      h3[i].setAttribute('role', 'heading');
      h3[i].setAttribute('aria-level', h3[i].classList.contains('h1') ? '2' : '2');
    }
    if (h3.length) log('headings normalizados: ' + h3.length);
  }

  /* ── 5. Landmark <main> ───────────────────────────────────────────────────
     Lighthouse: "Document does not have a main landmark".
     Trampa verificada el 11/09/2026: poner role="main" en un <div> anidado NO
     satisface la auditoría — el landmark debe ser un descendiente directo de
     <body> y no estar contenido en otro landmark. Por eso se envuelve el
     contenido principal en un <main> real.                                    */
  function marcarMain() {
    if (document.querySelector('main')) return;
    var body = document.body;
    // El contenido principal: todo lo que no es header/footer/nav/aside
    var main = document.createElement('main');
    main.id = 'mc-main';
    var hijos = [].slice.call(body.children);
    var inicio = -1, fin = -1;
    for (var i = 0; i < hijos.length; i++) {
      var t = hijos[i].tagName.toLowerCase();
      var esCromo = t === 'header' || t === 'footer' || t === 'nav' || t === 'script' ||
                    t === 'style' || t === 'noscript' || t === 'aside' ||
                    /footer|header|nav-|sidebar/i.test(hijos[i].className || '');
      if (!esCromo && hijos[i].offsetHeight > 0) {
        if (inicio === -1) inicio = i;
        fin = i;
      }
    }
    if (inicio === -1) return;
    body.insertBefore(main, hijos[inicio]);
    for (var j = inicio; j <= fin; j++) {
      if (hijos[j] !== main) main.appendChild(hijos[j]);
    }
    log('main envuelto');
  }

  /* ── 7. Meta description ──────────────────────────────────────────────────
     Medido: la home NO tiene meta description (SEO 83 en Lighthouse).
     El campo `description` de la tienda está vacío y `PUT /store` devuelve 401
     con el token actual, así que no se puede arreglar por API.
     Un buscador que ejecuta JS la lee; uno que no, no. Es un paliativo:
     lo correcto es cargarla en el panel de Tiendanube (SEO de la tienda).     */
  var META = 'Incubadoras automáticas para cultivar en casa: controlan temperatura y ' +
             'humedad solas. Fabricación argentina, 1 año de garantía y soporte real.';
  function ponerMeta() {
    if (document.querySelector('meta[name="description"]')) return;
    var m = document.createElement('meta');
    m.setAttribute('name', 'description');
    m.setAttribute('content', META);
    document.head.appendChild(m);
    log('meta description agregada');
  }

  /* ── 6. Link del carrito sin nombre accesible ─────────────────────────────
     Lighthouse: "Links do not have a discernible name".                      */
  function nombrarIconos() {
    var pares = [
      ['.js-toggle-cart, a[class*="js-toggle-cart"]', 'Ver el carrito'],
      ['a[class*="js-modal-open"][class*="search"], .js-search-open', 'Buscar productos']
    ];
    for (var i = 0; i < pares.length; i++) {
      var els = document.querySelectorAll(pares[i][0]);
      for (var j = 0; j < els.length; j++) {
        var e = els[j];
        if (!(e.getAttribute('aria-label') || '').trim() && !(e.textContent || '').trim()) {
          e.setAttribute('aria-label', pares[i][1]);
        }
      }
    }
  }

  function correr() {
    try { arreglarH1(); }        catch (e) { log('h1 ' + e); }
    try { arreglarSlides(); }    catch (e) { log('slides ' + e); }
    try { limpiarEmoji(); }      catch (e) { log('emoji ' + e); }
    try { arreglarHeadings(); }  catch (e) { log('headings ' + e); }
    try { marcarMain(); }        catch (e) { log('main ' + e); }
    try { nombrarIconos(); }     catch (e) { log('iconos ' + e); }
    try { ponerMeta(); }         catch (e) { log('meta ' + e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', correr);
  } else {
    correr();
  }
  // El carrusel y la grilla se hidratan tarde: reintentar acotado, sin observer infinito.
  var reintentos = 0;
  var iv = setInterval(function () {
    correr();
    if (++reintentos >= 6) clearInterval(iv);
  }, 900);
})();
