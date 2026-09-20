/* Click sparks.
   Every press pops a small burst of eight radial lines from the click
   point, like a comic-book "tap". Drawn on one full-screen canvas that
   sits above everything and ignores the mouse; the colour is read from
   the page's ink colour at burst time, so it flips with the theme. */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  /* one burst = 8 evenly spaced sparks, ~420ms, easing out */
  var COUNT = 8, DUR = 420, R0 = 7, R1 = 26, LEN = 10, WIDTH = 2;
  var bursts = [];
  var rafId = 0;

  function ink() {
    /* the body's text colour tracks the theme tokens */
    return getComputedStyle(document.body).color || '#000';
  }

  function spawn(x, y) {
    bursts.push({ x: x, y: y, t0: performance.now(), rot: Math.random() * Math.PI, color: ink() });
    if (!rafId) rafId = requestAnimationFrame(draw);
  }

  function draw(now) {
    rafId = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var alive = [];
    for (var b = 0; b < bursts.length; b++) {
      var burst = bursts[b];
      var p = (now - burst.t0) / DUR;
      if (p >= 1) continue;
      alive.push(burst);
      var e = 1 - Math.pow(1 - p, 3);               /* ease-out cubic */
      var r = R0 + (R1 - R0) * e;
      var len = LEN * (1 - e);
      ctx.strokeStyle = burst.color;
      ctx.globalAlpha = 1 - p * p;
      ctx.lineWidth = WIDTH * dpr;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (var i = 0; i < COUNT; i++) {
        var a = burst.rot + (i / COUNT) * Math.PI * 2;
        var ca = Math.cos(a), sa = Math.sin(a);
        ctx.moveTo((burst.x + ca * r) * dpr, (burst.y + sa * r) * dpr);
        ctx.lineTo((burst.x + ca * (r + len)) * dpr, (burst.y + sa * (r + len)) * dpr);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    bursts = alive;
    if (bursts.length) rafId = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    spawn(e.clientX, e.clientY);
  }, { passive: true });
})();
