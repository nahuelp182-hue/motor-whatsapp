/* MICELIUM-LDSCHEMA v1
 * Inyecta JSON-LD (schema.org) en el storefront de Tiendanube, que no emite
 * ningun dato estructurado propio. Lee todo del DOM (meta OG/twitter) asi el
 * precio/stock se mantienen solos cuando cambian en TN.
 *
 * Emite: Organization + WebSite (todas las paginas), Product (fichas),
 * Article (posts del blog). FAQPage se agrega por URL cuando exista la pagina.
 *
 * LIMITE CONOCIDO: al inyectarse por JS lo ven los crawlers que renderizan
 * (Googlebot -> AI Overviews/Gemini, Bingbot -> Copilot). GPTBot/ClaudeBot
 * no ejecutan JS y no lo ven; para ellos cuenta el contenido extractable.
 */
(function () {
  if (window.__ldschemaInit) return; window.__ldschemaInit = true;

  var ORIGIN = 'https://infomicelium.com.ar';

  function meta(sel) {
    var el = document.querySelector(sel);
    return el ? el.getAttribute('content') : null;
  }
  function og(p)  { return meta('meta[property="' + p + '"]'); }
  function tw(n)  { return meta('meta[name="' + n + '"]'); }
  function desc() { return meta('meta[name="description"]'); }

  function inject(obj) {
    try {
      var s = document.createElement('script');
      s.type = 'application/ld+json';
      s.text = JSON.stringify(obj);
      document.head.appendChild(s);
    } catch (e) {}
  }

  var ORG = {
    '@type': 'Organization',
    '@id': ORIGIN + '/#org',
    name: 'Micelium Argentina',
    alternateName: 'MICELIUM',
    url: ORIGIN + '/',
    description: 'Incubadoras automaticas para cultivo de girgolas, melena de leon, reishi y otras especies en casa. Equipos fabricados en Argentina con control automatico de temperatura y humedad.',
    email: 'info.micelium@gmail.com',
    sameAs: ['https://instagram.com/incubadoras_micelium'],
    areaServed: { '@type': 'Country', name: 'Argentina' }
  };

  function run() {
    var path = location.pathname;

    inject({ '@context': 'https://schema.org', '@graph': [ORG, {
      '@type': 'WebSite',
      '@id': ORIGIN + '/#website',
      url: ORIGIN + '/',
      name: 'Micelium Argentina',
      publisher: { '@id': ORIGIN + '/#org' },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: ORIGIN + '/search/?q={search_term_string}' },
        'query-input': 'required name=search_term_string'
      }
    }]});

    // ---- Product (fichas TN: og:type = tiendanube:product) ----
    if (og('og:type') === 'tiendanube:product') {
      // twitter:data1 = "$284.999,00 ARS" -> 284999.00
      var rawPrice = tw('twitter:data1') || '';
      var m = rawPrice.replace(/\./g, '').replace(',', '.').match(/([\d.]+)/);
      var stock = parseInt(tw('twitter:data2') || '0', 10);
      var prod = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: og('og:title'),
        url: og('og:url') || location.href,
        image: og('og:image:secure_url') || og('og:image'),
        description: desc() || undefined,
        brand: { '@type': 'Brand', name: 'Micelium Argentina' },
        offers: {
          '@type': 'Offer',
          url: og('og:url') || location.href,
          priceCurrency: 'ARS',
          price: m ? m[1] : undefined,
          availability: stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@id': ORIGIN + '/#org' }
        }
      };
      if (prod.name && prod.offers.price) inject(prod);
    }

    // ---- Article (posts del blog) ----
    if (path.indexOf('/blog/posts/') === 0) {
      var art = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: og('og:title') || document.title,
        description: desc() || undefined,
        image: og('og:image:secure_url') || og('og:image') || undefined,
        mainEntityOfPage: og('og:url') || location.href,
        inLanguage: 'es-AR',
        author: { '@id': ORIGIN + '/#org' },
        publisher: { '@id': ORIGIN + '/#org' }
      };
      inject(art);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
