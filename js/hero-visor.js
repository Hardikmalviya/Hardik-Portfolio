/* ------------------------------------------------------------------
   Hero visor
   The headset leans toward the cursor and follows it on a spring —
   under-damped just enough to settle with a hint of weight, which is
   what makes it feel like an object rather than a sticker. Touch works
   the same way; the OS "reduce motion" setting switches it all off.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var wrap   = document.querySelector('.hero__visor');
  var img    = wrap && wrap.querySelector('.hero__visor-img');
  var shadow = wrap && wrap.querySelector('.hero__visor-shadow');
  if (!wrap || !img) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---- tuning ---- */
  var SHIFT_X = 46,  SHIFT_Y = 26;   // how far it travels, px
  var ROT_Y   = 12,  ROT_X   = 8;    // how far it leans, deg
  var STIFF   = 110, DAMP    = 19;   // spring: slightly under-damped
  var IDLE_X  = 0.16, IDLE_Y = 0.12; // quiet drift when nobody's pointing

  var tx = 0, ty = 0;                // where it wants to be, -1..1
  var x = 0, y = 0, vx = 0, vy = 0;  // where it is
  var idleT = 0, pointerLive = false, leaveTimer = null;

  function onMove(e) {
    clearTimeout(leaveTimer);
    var r = wrap.getBoundingClientRect();
    var nx = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5);
    var ny = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.5);
    tx = Math.max(-1, Math.min(1, nx));
    ty = Math.max(-1, Math.min(1, ny));
    pointerLive = true;
  }
  function release() { pointerLive = false; }

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onMove, { passive: true });
  window.addEventListener('pointerup', function () {
    // on touch there's no hover: hold the pose a beat, then drift home
    if (window.matchMedia('(hover: none)').matches) {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(release, 900);
    }
  }, { passive: true });
  document.addEventListener('mouseleave', release);
  window.addEventListener('blur', release);

  var last = performance.now(), raf = null, running = false;

  function frame(now) {
    var dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    idleT += dt;

    // goal: the cursor, or a slow figure-of-eight when idle
    var gx = pointerLive ? tx : Math.sin(idleT * 0.50) * IDLE_X;
    var gy = pointerLive ? ty : Math.cos(idleT * 0.38) * IDLE_Y;

    // semi-implicit spring integration — interruptible by nature
    vx += ((gx - x) * STIFF - vx * DAMP) * dt;
    vy += ((gy - y) * STIFF - vy * DAMP) * dt;
    x += vx * dt;
    y += vy * dt;

    var px = x * SHIFT_X, py = y * SHIFT_Y;
    img.style.transform =
      'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)' +
      ' rotateY(' + (x * ROT_Y).toFixed(2) + 'deg)' +
      ' rotateX(' + (-y * ROT_X).toFixed(2) + 'deg)';

    if (shadow) {
      // the shadow trails underneath: moves less, thins as the visor banks
      shadow.style.transform =
        'translateX(' + (px * 0.55).toFixed(2) + 'px)' +
        ' scaleX(' + (1 - Math.abs(x) * 0.14).toFixed(3) + ')';
      shadow.style.opacity = (0.30 - Math.abs(x) * 0.08 - y * 0.05).toFixed(3);
    }

    raf = requestAnimationFrame(frame);
  }

  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop()  { if (running)  { running = false; cancelAnimationFrame(raf); } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { e[0].isIntersecting ? start() : stop(); }, { threshold: 0.05 }).observe(wrap);
  } else { start(); }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

  start();
})();
