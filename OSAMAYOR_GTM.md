# OSA MAYOR — motor de widgets vía Google Tag Manager

> **ESTADO: FUNCIONANDO** — verificado el 29/08/2026 sobre la tienda real
> (`/search/?q=luna`, URL dinámica sin caché):
> `window.__micInit === true`, `window.__micBoot === 1`,
> contenedores GTM activos `["G-KEXLLEL92E", "GTM-5DBVNKSX"]`,
> y `mic.js` servido desde `osamayor-nine.vercel.app`.
>
> La **home** puede seguir mostrando el HTML anterior por un rato: Cloudflare la cachea con
> `s-maxage=86400`. No es un problema a resolver, expira solo. Verificar siempre sobre una
> URL dinámica.
>
> Los widgets todavía no dibujan nada porque no hay ninguno creado en la base de Osamayor
> (`/api/widgets/config?ctx=tienda` devuelve `{"widgets":[]}`). Ese es el próximo paso.

## Por qué GTM y no el sistema de Scripts de Tiendanube

El script "Motor de widgets" (id 9713) de la app OSAMAYORGESTION llegó a `status: active`
con `current_version` válido y, tras reinstalar la app, hasta quedó **registrado en el HTML
del storefront**:

```js
window.scriptLoaderService.addScriptOnEvent(
  'https://apps-scripts.tiendanube.com/osamayorgestion/motor-de-widgets/2.js?...&store=3224928',
  'onfirstinteraction')
```

Y aun así **el loader del front-end no lo ejecuta**. En el mismo bloque hay otros dos
`addScriptOnEvent` (el wallet de Tiendanube y una app pública de reseñas): esos dos cargan,
el nuestro no, sin un error en consola. La diferencia es que la nuestra es una app
**privada** ("para tus clientes") y la que carga es **pública/homologada** — que es el
enforcement de NubeSDK descrito como "vía front-end (bloqueo sistemático)" para apps
privadas que inyectan scripts (fechas: 30/08/2026 bloqueo de nuevas instalaciones,
30/10/2026 desinstalación progresiva).

El motor en sí está sano: cargado a mano con `document.createElement('script')` en la
tienda real arranca perfecto (`window.__micInit === true`, `mic.js` servido desde la
instancia de Osamayor).

OSA MAYOR **no tiene** el campo de JavaScript libre de external-codes que sí tiene Micelium
(su pantalla de Códigos externos solo trae GTM, GA4, metaetiqueta, encuestas, píxel de
Facebook, códigos de conversión, AFIP y Bing). Por eso la vía es **GTM**.

## Contenedor

`GTM-5DBVNKSX` — creado el 29/08/2026 para `tiendaosamayor.com.ar`.

## Tag A — Motor de widgets

- **Tipo:** HTML personalizado
- **Activador:** All Pages / Todas las páginas
- **Nombre sugerido:** `Motor de widgets — Osamayor`

```html
<script>
  (function () {
    if (window.__micBoot) return;
    window.__micBoot = 1;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://osamayor-nine.vercel.app/mic.js';
    document.head.appendChild(s);
  })();
</script>
```

**NO agregar `data-ctx`.** `mic.js` deduce el contexto de `window.LS.template` (`product` →
`producto`, resto → `tienda`). Fijarlo rompería los widgets de las páginas de producto.
El `__micBoot` evita doble carga si el tag llegara a dispararse dos veces.

## Tag B — Google Ads: NO se hizo, y está bien

El campo "Google Tag Manager" de Tiendanube tenía cargado `AW-16819875899`, que es un ID de
**Google Ads**, no un contenedor GTM. Tiendanube igual pedía
`googletagmanager.com/gtm.js?id=AW-...`, así que figuraba "Conectado" — pero no es un
contenedor administrable, no se le pueden crear tags.

Al reemplazarlo por el `GTM-` real ese tag de Ads se pierde. **Nahuel confirmó el 29/08/2026
que OSA MAYOR no hace Google Ads**, así que no había nada que conservar y el tag no se
repuso. Si alguna vez la tienda empieza a hacer Ads, hay que crear dentro de GTM una
"Etiqueta de Google" con ese ID (o el que corresponda) y activador All Pages.

GA4 (`G-KEXLLEL92E`) vive en su propio campo de Tiendanube y **no se toca**: sigue
funcionando aparte.

## Orden de ejecución

1. Crear el Tag A en GTM.
2. **Publicar** el contenedor (botón "Enviar" → "Publicar").
3. En Tiendanube → Códigos externos → Google Tag Manager: **Desvincular** (el campo viene
   bloqueado con el `AW-`), escribir `GTM-5DBVNKSX` y guardar.

## Verificación

La home está detrás de Cloudflare con `s-maxage=86400` y puede devolver HTML de horas
atrás. Verificar sobre una URL dinámica:

```bash
curl -sL "https://www.tiendaosamayor.com.ar/search/?q=zz$(date +%s)" | grep -c "GTM-5DBVNKSX"
```

Y en el navegador, sobre la tienda real:

```js
window.__micInit                                   // debe ser true
Array.from(document.scripts).map(s => s.src)
  .filter(s => s.includes('osamayor-nine'))        // debe listar mic.js
```

Los widgets no se van a dibujar hasta que existan en la base: hoy
`/api/widgets/config?ctx=tienda` devuelve `{"widgets":[]}`. Eso es lo esperado, no un error.

## Deuda conocida

`mic.js` se sirve desde `osamayor-nine.vercel.app`. El comentario del propio archivo
advierte que un `*.vercel.app` cae bajo el desafío anti-bots de Vercel ante una ráfaga de
pedidos (verificado el 23/07/2026: 403 con `X-Vercel-Mitigated: challenge`), y que un
desafío que el navegador resuelve solo **no** lo resuelve un `fetch` entre orígenes. Hoy no
se dispara y el tráfico de la tienda es bajo, pero cuando crezca hay que darle dominio
propio. El DNS de `tiendaosamayor.com.ar` está en **AWS Route 53** (no Cloudflare).
