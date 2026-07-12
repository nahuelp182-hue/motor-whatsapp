/* MICELIUM-LEADMAGNET v1
 * Popup + trigger por boton para captar email y enviar la guia PDF por correo.
 * - Popup: aparece a los TIMEOUT_MS o en intento de salida, 1 vez por visitante.
 * - Botones: cualquier elemento con [data-leadmagnet] abre el mismo modal
 *   (para usar en el blog: <a href="#" data-leadmagnet>Descargar guia gratis</a>).
 * - Envia el email a /api/lead (valida formato + MX + manda la guia por mail).
 * - Entrega por correo (no descarga directa) -> asegura que el mail sea real.
 * Inyectado en TN via external-codes (bootstrap img-onerror -> este script).
 */
(function () {
  if (window.__lmInit) return; window.__lmInit = true;

  /* ================== CONFIG ================== */
  var API       = 'https://mw-micelium.vercel.app/api/lead';
  var TIMEOUT_MS = 15000;          // aparece a los 15s
  var DONE_KEY   = '__lm_done_v1'; // localStorage: ya suscripto/cerrado
  /* ============================================ */

  function done() { try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; } }
  function setDone() { try { localStorage.setItem(DONE_KEY, '1'); } catch (e) {} }

  var CSS =
    '.lm-ov{position:fixed;inset:0;background:rgba(20,18,15,.72);z-index:99999;display:flex;'+
    'align-items:center;justify-content:center;padding:16px;opacity:0;transition:opacity .25s}'+
    '.lm-ov.on{opacity:1}'+
    '.lm-card{width:100%;max-width:460px;background:#fff;border-radius:16px;overflow:hidden;'+
    'box-shadow:0 30px 80px rgba(0,0,0,.45);font-family:"Segoe UI",Helvetica,Arial,sans-serif;'+
    'transform:translateY(12px);transition:transform .25s}'+
    '.lm-ov.on .lm-card{transform:none}'+
    '.lm-x{position:absolute;top:12px;right:16px;color:#fff;font-size:24px;cursor:pointer;opacity:.8;line-height:1;z-index:2}'+
    '.lm-top{background:#1c1a17;color:#fff;padding:24px 28px 20px;text-align:center;position:relative}'+
    '.lm-logo{font-weight:800;letter-spacing:3px;font-size:12px;color:#d8cfc6}'+
    '.lm-acc{width:44px;height:3px;background:#b0341d;margin:9px auto}'+
    '.lm-top h2{font-size:21px;line-height:1.22;margin:6px 0 0;font-weight:800}'+
    '.lm-g{color:#e8a08a}'+
    '.lm-body{padding:22px 28px 26px;text-align:center}'+
    '.lm-body p{color:#5a5148;font-size:14px;line-height:1.5;margin:0 0 16px}'+
    '.lm-list{text-align:left;max-width:320px;margin:0 auto 18px;color:#3a332c;font-size:13.5px}'+
    '.lm-list div{margin-bottom:6px}.lm-list b{color:#b0341d}'+
    '.lm-inp{width:100%;padding:13px 15px;border:1.5px solid #d9cec2;border-radius:9px;'+
    'font-size:15px;margin-bottom:11px;font-family:inherit;box-sizing:border-box}'+
    '.lm-inp:focus{outline:none;border-color:#b0341d}'+
    '.lm-btn{width:100%;padding:14px;background:#b0341d;color:#fff;border:none;border-radius:9px;'+
    'font-size:15px;font-weight:800;cursor:pointer;font-family:inherit}'+
    '.lm-btn:disabled{opacity:.6;cursor:default}'+
    '.lm-fine{color:#9a8f82;font-size:11px;margin-top:11px}'+
    '.lm-msg{font-size:14px;margin-top:10px;min-height:18px}'+
    '.lm-err{color:#b0341d}.lm-ok{color:#3f8f3f}'+
    '.lm-success{padding:8px 0}.lm-success .big{font-size:40px}'+
    '.lm-success h3{font-size:19px;color:#1c1a17;margin:8px 0 6px}';

  var HTML =
    '<div class="lm-card">'+
      '<span class="lm-x" data-lm-close>&times;</span>'+
      '<div class="lm-top">'+
        '<div class="lm-logo">MICELIUM</div><div class="lm-acc"></div>'+
        '<h2>Descarga gratis: <span class="lm-g">Tu primer cultivo<br>de hongos en casa</span></h2>'+
      '</div>'+
      '<div class="lm-body">'+
        '<div class="lm-form">'+
          '<p>La guia honesta para lograrlo <b>sin experiencia</b> y sin frustrarte en el intento.</p>'+
          '<div class="lm-list">'+
            '<div>&#9989; Las <b>4 etapas</b> del cultivo, simple</div>'+
            '<div>&#9989; Las <b>3 razones</b> por las que el 90% fracasa</div>'+
            '<div>&#9989; Variedades mas faciles + <b>3 recetas</b></div>'+
          '</div>'+
          '<input class="lm-inp" type="email" placeholder="Tu mejor email" autocomplete="email">'+
          '<button class="lm-btn" type="button">QUIERO LA GUIA GRATIS</button>'+
          '<div class="lm-msg"></div>'+
          '<div class="lm-fine">Te la enviamos a tu correo. Sin spam.</div>'+
        '</div>'+
        '<div class="lm-success" style="display:none">'+
          '<div class="big">&#128231;</div>'+
          '<h3>&iexcl;Revisa tu correo!</h3>'+
          '<p>Te enviamos la guia a tu email. Si no la ves en unos minutos, mira en la carpeta de <b>spam/promociones</b>.</p>'+
        '</div>'+
      '</div>'+
    '</div>';

  function mount() {
    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    var ov = document.createElement('div'); ov.className = 'lm-ov'; ov.innerHTML = HTML;
    ov.style.display = 'none';
    document.body.appendChild(ov);

    var input = ov.querySelector('.lm-inp');
    var btn   = ov.querySelector('.lm-btn');
    var msg   = ov.querySelector('.lm-msg');
    var form  = ov.querySelector('.lm-form');
    var okBox = ov.querySelector('.lm-success');

    function open() { ov.style.display = 'flex'; requestAnimationFrame(function(){ ov.classList.add('on'); }); setTimeout(function(){ try{input.focus();}catch(e){} }, 300); }
    function close() { ov.classList.remove('on'); setTimeout(function(){ ov.style.display = 'none'; }, 250); setDone(); }

    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.hasAttribute('data-lm-close')) close();
    });

    btn.addEventListener('click', function () {
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.className = 'lm-msg lm-err'; msg.textContent = 'Escribi un email valido.'; return; }
      btn.disabled = true; msg.className = 'lm-msg'; msg.textContent = 'Enviando...';
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
        .then(function (r) { return r.json().catch(function(){ return { ok: r.ok }; }); })
        .then(function (d) {
          if (d && d.ok) { form.style.display = 'none'; okBox.style.display = 'block'; setDone(); }
          else {
            btn.disabled = false; msg.className = 'lm-msg lm-err';
            msg.textContent = (d && d.error === 'dominio') ? 'Ese correo no parece existir. Revisalo.' : 'No pudimos enviarlo. Proba de nuevo.';
          }
        })
        .catch(function () { btn.disabled = false; msg.className = 'lm-msg lm-err'; msg.textContent = 'Error de conexion. Proba de nuevo.'; });
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });

    // triggers por boton (blog / cualquier lado)
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-leadmagnet]') : null;
      if (t) { e.preventDefault(); form.style.display = ''; okBox.style.display = 'none'; btn.disabled = false; msg.textContent = ''; open(); }
    });

    // popup automatico: 1 vez por visitante (no si ya lo cerro/suscribio)
    if (!done()) {
      var fired = false;
      var fire = function () { if (fired) return; fired = true; open(); };
      setTimeout(fire, TIMEOUT_MS);
      document.addEventListener('mouseout', function (e) { if (e.clientY <= 0 && !e.relatedTarget) fire(); });
    }
    window.__lmOpen = function(){ form.style.display=''; okBox.style.display='none'; btn.disabled=false; msg.textContent=''; open(); };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
