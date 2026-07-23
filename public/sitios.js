/* ───────────────────────────────────────────────────────────────────────────
   Bloque "Nuestros sitios" en el pie del storefront de Tiendanube.

   Vive acá y no en external-codes porque Tiendanube ESCAPA los <script> y
   <style> que se pegan en ese campo: quedan en el HTML como texto y nunca
   corren. El campo solo sirve de arranque (un <img onerror> que carga este
   archivo), igual que ldschema.js y mvtrk.js. Mejorar el bloque = git push.

   Idempotente y defensivo: si el tema cambia y no hay <footer>, no hace nada.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  var ID = 'mic-sitios-tn'

  var CSS = [
    '#' + ID + '{border-top:1px solid #e6e6e6;margin:28px auto 0;padding:26px 16px 6px;',
    'max-width:1100px;color:#222 !important;background:#fff !important;color-scheme:light}',
    '#' + ID + ' .mic-st-tit{font-size:11px;letter-spacing:.18em;text-transform:uppercase;',
    'color:#8a8179 !important;margin:0 0 14px}',
    '#' + ID + ' .mic-st-grid{display:flex;flex-wrap:wrap;gap:14px 32px}',
    '#' + ID + ' a.mic-st{display:flex;flex-direction:column;text-decoration:none;',
    'border-left:2px solid #e6e6e6;padding-left:12px;transition:border-color .18s ease}',
    '#' + ID + ' a.mic-st:hover{border-left-color:#487132}',
    '#' + ID + ' .mic-st-n{color:#222 !important;font-size:14px;line-height:1.4}',
    '#' + ID + ' .mic-st-u{color:#8CCF3F !important;font-size:12px;line-height:1.5}',
    '#' + ID + ' .mic-st-legal{margin:18px 0 0;font-size:11px;line-height:1.6;',
    'color:#8a8179 !important;max-width:560px}',
  ].join('')

  // El bloque de sitios queda apagado hasta que las guías estén terminadas: no mandamos
  // tráfico de la tienda a un sitio a medio hacer. Para reactivarlo, volver a poner acá
  // el <p class="mic-st-tit"> + el <div class="mic-st-grid"> con Tienda y:
  //   <a class="mic-st" href="https://guias.infomicelium.com.ar/guia">
  //     <span class="mic-st-n">Guías de cultivo</span>
  //     <span class="mic-st-u">guias.infomicelium.com.ar</span>
  //   </a>
  var HTML = [
    // Hay vendedores de insumos usando "mycelium" y el cliente confunde la marca con la
    // palabra genérica. La aclaración informa sin ponerse a discutir con nadie.
    '<p class="mic-st-legal">Micelium® es marca registrada. No tenemos relación ',
    'con vendedores de insumos que usan nombres parecidos.</p>',
  ].join('')

  function poner() {
    if (document.getElementById(ID)) return true
    var f = document.querySelector('footer')
    if (!f) return false

    if (!document.getElementById('mic-sitios-css')) {
      var st = document.createElement('style')
      st.id = 'mic-sitios-css'
      st.textContent = CSS
      document.head.appendChild(st)
    }

    var d = document.createElement('div')
    d.id = ID
    d.innerHTML = HTML
    f.appendChild(d)
    return true
  }

  function arrancar() {
    if (poner()) return
    // El tema arma parte del pie después del load. Reintentamos un rato corto y paramos:
    // un observer eterno sobre el DOM de la tienda no vale lo que cuesta.
    var intentos = 0
    var t = setInterval(function () {
      if (poner() || ++intentos > 20) clearInterval(t)
    }, 500)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar)
  } else {
    arrancar()
  }
})()
