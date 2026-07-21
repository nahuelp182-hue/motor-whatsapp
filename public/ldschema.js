/* MICELIUM-LDSCHEMA v2
 * Complemento client-side del JSON-LD del storefront.
 *
 * REPARTO DE RESPONSABILIDADES (revisado 21/07/2026):
 *  - Tiendanube ya emite server-side: Organization, WebPage, BreadcrumbList,
 *    Product (con sku, brand, weight, offers/price/availability/inventoryLevel)
 *    y BlogPosting. NO lo duplicamos: server-side gana siempre porque lo ven
 *    los crawlers que no ejecutan JS.
 *  - Organization + WebSite con @id estable viven en el snippet ESTATICO de
 *    #assortedJs (external-codes de TN) -> visible sin render. Ver
 *    ~/.claude/assortedJs_snippet_v2.html
 *  - Este archivo solo agrega lo que ninguno de los dos cubre y que necesita
 *    leer el DOM.
 *
 * QUE QUEDO ACA: enriquecer los posts del blog. El BlogPosting de TN trae
 * author como string suelto ("Micelium") y un publisher sin @id, asi que no
 * consolida autoridad en ninguna entidad. Emitimos un BlogPosting con @id
 * propio que enlaza author/publisher al nodo #org.
 *
 * LIMITE CONOCIDO (sin cambios): al inyectarse por JS lo ven los crawlers que
 * renderizan (Googlebot -> AI Overviews/Gemini, Bingbot -> Copilot).
 * GPTBot/ClaudeBot/OAI-SearchBot/PerplexityBot no ejecutan JS y no lo ven;
 * para ellos cuenta el snippet estatico + el contenido extractable.
 */
(function () {
  if (window.__ldschemaInit) return; window.__ldschemaInit = true;

  var ORIGIN = 'https://infomicelium.com.ar';
  var ORG_ID = ORIGIN + '/#org';

  function meta(sel) {
    var el = document.querySelector(sel);
    return el ? el.getAttribute('content') : null;
  }
  function og(p)  { return meta('meta[property="' + p + '"]'); }
  function desc() { return meta('meta[name="description"]'); }

  function inject(obj) {
    try {
      var s = document.createElement('script');
      s.type = 'application/ld+json';
      s.text = JSON.stringify(obj);
      document.head.appendChild(s);
    } catch (e) {}
  }

  // Fecha del BlogPosting que ya emitio TN: la reusamos en vez de inventarla.
  function fechasDeTN() {
    var out = {};
    var nodes = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < nodes.length; i++) {
      try {
        var d = JSON.parse(nodes[i].text);
        if (d && d['@type'] === 'BlogPosting') {
          if (d.datePublished) out.datePublished = d.datePublished;
          if (d.dateModified) out.dateModified = d.dateModified;
          if (d.headline) out.headline = d.headline;
          if (d.image && d.image.url) out.image = d.image.url;
          break;
        }
      } catch (e) {}
    }
    return out;
  }

  function run() {
    if (location.pathname.indexOf('/blog/posts/') !== 0) return;

    var tn = fechasDeTN();
    var url = (og('og:url') || location.href).split('?')[0];

    var art = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': url.replace(/\/$/, '') + '#article',
      headline: tn.headline || og('og:title') || document.title,
      description: desc() || undefined,
      image: tn.image || og('og:image:secure_url') || og('og:image') || undefined,
      datePublished: tn.datePublished || undefined,
      dateModified: tn.dateModified || tn.datePublished || undefined,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      isPartOf: { '@id': ORIGIN + '/#website' },
      inLanguage: 'es-AR',
      author: { '@id': ORG_ID },
      publisher: { '@id': ORG_ID }
    };
    inject(art);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
