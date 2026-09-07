/* Tiny UI sound kit — every sound is synthesised live with WebAudio, so
   there are no audio files to load and the timing is sample-accurate.

   The palette, kept deliberately quiet:
     hover on a pill/avatar . feather-light tick
     click on a link/button . soft, rounded "thock"
     double-click theme flip . airy whoosh
     the glass lighting up  . faint two-note shimmer (once)

   Browsers only allow audio after a user gesture, so the context wakes on
   the first press and everything before that stays silent. */
(function () {
  var ctx = null, master = null;
  var lastTick = 0;

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    return ctx;
  }

  function unlocked() { return ctx && ctx.state === 'running'; }

  /* one shared noise buffer for the percussive layers */
  var noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  }

  function env(t0, peak, decay) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    g.connect(master);
    return g;
  }

  function tick() {
    if (!unlocked()) return;
    var now = performance.now();
    if (now - lastTick < 70) return;   /* sweeping across pills stays gentle */
    lastTick = now;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1900, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.03);
    o.connect(env(t, 0.045, 0.035));
    o.start(t); o.stop(t + 0.05);
  }

  function thock() {
    if (!unlocked()) return;
    var t = ctx.currentTime;
    /* body: a quick pitch drop */
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(340, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.07);
    o.connect(env(t, 0.16, 0.09));
    o.start(t); o.stop(t + 0.1);
    /* attack: a breath of filtered noise */
    var n = noise();
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2100; f.Q.value = 1.2;
    n.connect(f); f.connect(env(t, 0.05, 0.03));
    n.start(t); n.stop(t + 0.04);
  }

  function whoosh() {
    if (!unlocked()) return;
    var t = ctx.currentTime;
    var n = noise();
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.5);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.6);
  }

  function shimmer() {
    if (!unlocked()) return;
    var t = ctx.currentTime;
    [523, 784].forEach(function (hz, i) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.035, t + i * 0.12 + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.9);
      o.connect(g); g.connect(master);
      o.start(t + i * 0.12); o.stop(t + i * 0.12 + 1);
    });
  }

  /* ---- wiring ---------------------------------------------------------- */
  var HOVERABLE = '.pill, .avatar, .quote__author a, .foot a';

  /* the context can only start on a gesture; the first press wakes it */
  function wake() {
    var c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
  }
  document.addEventListener('pointerdown', wake, { passive: true });
  document.addEventListener('keydown', wake);

  document.addEventListener('pointerover', function (e) {
    if (e.pointerType === 'touch') return;
    var el = e.target.closest && e.target.closest(HOVERABLE);
    if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) tick();
  }, { passive: true });

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a, button')) thock();
  }, { passive: true });

  document.addEventListener('dblclick', function () { whoosh(); }, { passive: true });

  window.addEventListener('heroLightsOn', function () { shimmer(); }, { once: true });

  window.__sound = { tick: tick, thock: thock, whoosh: whoosh, shimmer: shimmer };  /* for tuning */
})();
