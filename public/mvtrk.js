/* MICELIUM-VIDEO-TRACK v1
 * Tracking de reproduccion de video YouTube -> GA4 (G-BNK0H3Y825).
 * Inyectado en el storefront via Tiendanube Scripts API.
 * Fuerza enablejsapi=1, usa la IFrame Player API, dispara eventos nativos GA4:
 * video_start / video_progress (25/50/75) / video_complete.
 */
(function () {
  if (window.__mvtrkInit) return; window.__mvtrkInit = true;

  function gt() {
    (window.gtag) ? window.gtag.apply(null, arguments)
      : (window.dataLayer = window.dataLayer || []).push(arguments);
  }
  function ev(name, p, forcePct) {
    try {
      var d = p.getVideoData ? p.getVideoData() : {};
      var dur = p.getDuration ? p.getDuration() : 0;
      var cur = p.getCurrentTime ? p.getCurrentTime() : 0;
      var pct = (forcePct != null) ? forcePct : (dur ? Math.round(cur / dur * 100) : 0);
      gt('event', name, {
        video_provider: 'youtube',
        video_title: d.title || '',
        video_url: d.video_id ? ('https://www.youtube.com/watch?v=' + d.video_id) : '',
        video_current_time: Math.round(cur),
        video_duration: Math.round(dur),
        video_percent: pct,
        visible: true
      });
    } catch (e) {}
  }
  function poll(p) {
    if (p.__iv) return;
    p.__iv = setInterval(function () {
      try {
        var dur = p.getDuration(), cur = p.getCurrentTime();
        if (!dur) return;
        var pct = cur / dur * 100;
        p.__pct = p.__pct || {};
        [25, 50, 75].forEach(function (t) {
          if (pct >= t && !p.__pct[t]) { p.__pct[t] = 1; ev('video_progress', p, t); }
        });
      } catch (e) {}
    }, 1000);
  }
  function stopPoll(p) { if (p.__iv) { clearInterval(p.__iv); p.__iv = null; } }
  function onState(e) {
    var p = e.target, st = e.data, YT = window.YT;
    if (st === YT.PlayerState.PLAYING) {
      if (!p.__started) { p.__started = true; ev('video_start', p, 0); }
      poll(p);
    } else {
      stopPoll(p);
      if (st === YT.PlayerState.ENDED) {
        ev('video_complete', p, 100);
        p.__pct = {}; p.__started = false;
      }
    }
  }
  var idc = 0;
  function ensureApi(f) {
    var src = f.getAttribute('src') || '';
    if (!/[?&]enablejsapi=1/.test(src)) {
      var sep = src.indexOf('?') > -1 ? '&' : '?';
      f.setAttribute('src', src + sep + 'enablejsapi=1&origin=' + encodeURIComponent(location.origin));
      return true;
    }
    return false;
  }
  function whenApi(cb) {
    if (window.YT && window.YT.Player) return cb();
    if (!window.__mvtrkApiLoading) {
      window.__mvtrkApiLoading = true;
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (prev) try { prev(); } catch (e) {}
        (window.__mvtrkApiCbs || []).forEach(function (f) { f(); });
      };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
    (window.__mvtrkApiCbs = window.__mvtrkApiCbs || []).push(cb);
  }
  function attach(f) {
    if (f.__mvtrk) return; f.__mvtrk = true;
    if (!f.id) f.id = 'mvtrk-' + (++idc);
    var rewrote = ensureApi(f);
    whenApi(function () {
      setTimeout(function () {
        try { new window.YT.Player(f.id, { events: { onStateChange: onState } }); } catch (e) {}
      }, rewrote ? 600 : 0);
    });
  }
  function scan() {
    var nodes = document.querySelectorAll(
      'iframe[src*="youtube.com/embed"],iframe[src*="youtube-nocookie.com/embed"]');
    for (var i = 0; i < nodes.length; i++) attach(nodes[i]);
  }
  function boot() {
    scan();
    try {
      new MutationObserver(function () { scan(); })
        .observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
