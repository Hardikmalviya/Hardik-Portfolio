/* ------------------------------------------------------------------
   Hero pixel field
   A band of small square dots that drifts like a slow current. The cursor
   (or a finger) pushes nearby dots out into a ring and warms their colour —
   grey at rest, through peach and coral to plum at the centre — using the
   palette of the orb it replaces. Plain canvas, no dependencies.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var canvas = document.querySelector('.hero__field');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- palette (from images/hero-portrait.png) ---- */
  var REST = [212, 212, 212];                      // grey when far from the cursor
  var RAMP = [                                     // proximity 0 → 1
    [212, 212, 212],
    [251, 165, 140],   // peach   #fba58c
    [255, 117,  63],   // coral   #ff753f
    [222,  41,  78],   // pink    #de294e
    [147,  38, 104]    // plum    #932668
  ];

  /* ---- tuning ---- */
  var TEXT        = 'Heyyyyy :)';
  var SPACING     = 6;      // grid pitch, css px
  var DOT         = 3;      // dot size, css px
  var RING        = 78;     // cursor exclusion radius
  var WARMTH      = 210;    // radius over which colour warms
  var SPRING      = 0.085;  // pull back toward home
  var DAMP        = 0.80;   // velocity damping
  var DRIFT_AMP   = 1.3;    // idle wobble, px — small, so the word holds
  var JITTER      = 1.3;    // per-dot offset off the grid, so it isn't a bitmap

  var dots = [], W = 0, H = 0, dpr = 1;
  var mouse = { x: -9999, y: -9999, inside: false };
  var t0 = performance.now(), raf = null;

  /* cheap deterministic hash noise, good enough for organic dropout */
  function hash(x, y) {
    var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function smooth(a) { return a * a * (3 - 2 * a); }
  function noise(x, y) {                        // value noise in [0,1]
    var xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }

  function build() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dots.length = 0;
    var mask = textMask(W, H);
    if (!mask) return;

    // tighter grid on a small canvas, or the strokes come out too thin to read
    var sp = W < 560 ? 5 : SPACING;
    var cols = Math.ceil(W / sp), rows = Math.ceil(H / sp);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var gx = c * sp + sp / 2, gy = r * sp + sp / 2;
        var px = Math.min(W - 1, Math.round(gx)), py = Math.min(H - 1, Math.round(gy));
        if (mask[(py * W + px) * 4 + 3] < 128) continue;      // outside the letters

        // nudge off the grid so it reads as scattered dust, not a screen door
        var jx = (hash(c, r) - 0.5) * 2 * JITTER;
        var jy = (hash(r, c) - 0.5) * 2 * JITTER;
        var x = gx + jx, y = gy + jy;
        dots.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0, ph: hash(r, c) * 6.283, k: hash(c * 3, r * 7) });
      }
    }
  }

  /* Render the word to an offscreen canvas and hand back its alpha channel,
     so the dots can be placed wherever a glyph is. */
  function textMask(w, h) {
    if (!w || !h) return null;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    if (!x) return null;

    x.fillStyle = '#000';
    x.textAlign = 'center';
    x.textBaseline = 'middle';

    // On a wide box the whole thing fits on one line; on a narrow, tall one
    // (phones) it stacks, otherwise the type ends up tiny in a big empty field.
    var lines = (w / h < 1.9) ? ['Heyyyyy', ':)'] : [TEXT];

    var probe = 100;
    x.font = '700 ' + probe + 'px "Inter Tight", system-ui, sans-serif';
    var widest = 1;
    for (var i = 0; i < lines.length; i++) widest = Math.max(widest, x.measureText(lines[i]).width);

    var size = Math.min(probe * (w * 0.9) / widest, (h * 0.78) / lines.length);
    var lead = size * 1.02;

    x.font = '700 ' + size + 'px "Inter Tight", system-ui, sans-serif';
    var top = h / 2 - (lines.length - 1) * lead / 2;
    for (var j = 0; j < lines.length; j++) x.fillText(lines[j], w / 2, top + j * lead);

    return x.getImageData(0, 0, w, h).data;
  }

  function colour(t) {
    if (t <= 0) return REST;
    var n = RAMP.length - 1, s = Math.min(t, 0.9999) * n, i = Math.floor(s), f = s - i;
    var a = RAMP[i], b = RAMP[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  function frame(now) {
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    var mx = mouse.x, my = mouse.y, live = mouse.inside;

    for (var i = 0, n = dots.length; i < n; i++) {
      var d = dots[i];

      // idle drift: a slow current plus a personal wobble (off under reduced motion)
      var tx = d.hx, ty = d.hy;
      if (!reduceMotion) {
        var flow = noise(d.hx * 0.006 + t * 0.06, d.hy * 0.006) - 0.5;
        tx += Math.sin(t * 0.7 + d.ph) * DRIFT_AMP + flow * 3;
        ty += Math.cos(t * 0.55 + d.ph) * DRIFT_AMP * 0.7 + flow * 2;
      }

      // spring toward the drifting target
      d.vx += (tx - d.x) * SPRING;
      d.vy += (ty - d.y) * SPRING;

      // cursor: push anything inside the ring out to its edge
      var prox = 0;
      if (live) {
        var dx = d.x - mx, dy = d.y - my, dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        if (dist < RING) {
          var push = (RING - dist) / RING;
          d.vx += (dx / dist) * push * 6.5;
          d.vy += (dy / dist) * push * 6.5;
        }
        prox = Math.max(0, 1 - dist / WARMTH);
        prox = prox * prox;                           // hotter core, softer falloff
      }

      d.vx *= DAMP; d.vy *= DAMP;
      d.x += d.vx; d.y += d.vy;

      var cl = colour(prox);
      ctx.fillStyle = 'rgb(' + (cl[0] | 0) + ',' + (cl[1] | 0) + ',' + (cl[2] | 0) + ')';
      var s = DOT + prox * 1.5;                       // warm dots swell a touch
      ctx.fillRect(d.x - s / 2, d.y - s / 2, s, s);
    }

    raf = requestAnimationFrame(frame);
  }

  /* ---- pointer: listen on the document so the canvas never blocks clicks ---- */
  function onMove(e) {
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var pad = RING;                                   // keep reacting a little past the edge
    mouse.inside = x > -pad && y > -pad && x < rect.width + pad && y < rect.height + pad;
    mouse.x = x; mouse.y = y;
  }
  function onLeave() { mouse.inside = false; }

  // On touch there's no hover, so a tap would vanish the moment the finger
  // lifts. Let the ring linger a beat after release instead.
  var leaveTimer = null;
  function onMoveKeep(e) { clearTimeout(leaveTimer); onMove(e); }
  window.addEventListener('pointermove', onMoveKeep, { passive: true });
  window.addEventListener('pointerdown', onMoveKeep, { passive: true });
  window.addEventListener('pointerup', function () {
    if (matchMedia('(hover: none)').matches) { clearTimeout(leaveTimer); leaveTimer = setTimeout(onLeave, 1400); }
  }, { passive: true });
  document.addEventListener('mouseleave', onLeave);
  window.addEventListener('blur', onLeave);

  /* ---- lifecycle ---- */
  var ro = window.ResizeObserver ? new ResizeObserver(build) : null;
  if (ro) ro.observe(canvas); else window.addEventListener('resize', build);

  // Only animate while the hero is on screen
  var running = false;
  function start() { if (!running) { running = true; t0 = performance.now() - (t0 ? 0 : 0); raf = requestAnimationFrame(frame); } }
  function stop()  { if (running)  { running = false; cancelAnimationFrame(raf); } }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }, { threshold: 0.05 }).observe(canvas);
  } else { start(); }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

  build();
  start();

  // The word is sampled from rendered type, so it must be re-sampled once
  // Inter Tight is actually available — otherwise the fallback's letterforms
  // are what get frozen into the dots.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
})();
