/* Real-3D Vision Pro hero.
   Loads models/visionpro.glb into a transparent three.js scene and fades the
   canvas in on the first rendered frame. If WebGL is missing or the load
   fails the hero simply stays empty — nothing breaks.

   The cursor-follow is the same critically-damped spring as hero-visor.js,
   but here it drives real yaw/pitch on the model, so the perspective and
   reflections shift the way an actual object would. */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function () {
  var visor = document.querySelector('.hero__visor');
  var shadow = document.querySelector('.hero__visor-shadow');
  if (!visor) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- pose + motion constants ------------------------------------- */
  var BASE_YAW   = -Math.PI / 2;    /* glass pointing straight at the viewer */
  var BASE_PITCH =  0;              /* dead level at rest */
  var YAW_RANGE  =  0.55;           /* how far the cursor can turn it (rad) */
  var PITCH_RANGE = 0.22;
  var SHIFT_X = 0.20, SHIFT_Y = 0.07;  /* world-unit drift toward cursor */
  var STIFF = 110, DAMP = 19;       /* same spring as the 2D version */
  var IDLE_X = 0.16, IDLE_Y = 0.12;

  /* ---- renderer ------------------------------------------------------ */
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return; }           /* no WebGL: the flat image stays */

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  var canvas = renderer.domElement;
  canvas.className = 'hero__visor-canvas';
  visor.appendChild(canvas);

  var scene = new THREE.Scene();
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* a soft key light gives the glass a highlight the room env alone lacks */
  var key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-3, 1, 2);
  scene.add(fill);

  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  var pivot = new THREE.Group();     /* spring rotates this */
  window.__heroPivot = pivot;
  window.__heroRender = function () { renderer.render(scene, camera); };
  scene.add(pivot);

  /* ---- sizing -------------------------------------------------------- */
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitModel();
  }

  var modelSize = null;
  function fitModel() {
    if (!modelSize) return;
    /* fit by whichever axis is tighter, with ~12% air around the model */
    var dist = camera.position.z;
    var vh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    var vw = vh * camera.aspect;
    /* size against the visor box, not the padded canvas, so the headset
       occupies the same footprint the flat cutout did */
    var fw = visor.clientWidth / canvas.clientWidth;
    var fh = visor.clientHeight / canvas.clientHeight;
    /* phones are width-bound, so they get more of the box than desktop */
    var frac = window.innerWidth <= 720 ? 0.78 : 0.56;
    var s = Math.min(vw * fw / modelSize.x, vh * fh / modelSize.y) * frac;
    pivot.scale.setScalar(s);
  }

  /* ---- EyeSight-style aurora in the glass ---------------------------
     The glass mesh has no UVs, so a small animated canvas is projected
     onto it in the shader via the mesh's own geometry coordinates. It
     stays dark for a moment after load, then breathes to life. */
  var AUR_W = 512, AUR_H = 256;
  var aurCanvas = document.createElement('canvas');
  aurCanvas.width = AUR_W; aurCanvas.height = AUR_H;
  var aurCtx = aurCanvas.getContext('2d');
  var aurTex = new THREE.CanvasTexture(aurCanvas);
  aurTex.colorSpace = THREE.SRGBColorSpace;
  var aurUniforms = null;
  var lightsAt = 0, litOnce = false;   /* when the fade-in starts */
  var LIGHT_DELAY = 2400;      /* ms after the model appears */
  var LIGHT_FADE = 2600;       /* ms to full brightness */

  /* four soft blobs on slow, non-repeating orbits — Apple's palette */
  var BLOBS = [
    { c: '255,61,139',  r: 150, ax: 0.30, ay: 0.16, sx: 0.23, sy: 0.31, px: 0.0, py: 1.9 },
    { c: '255,157,46',  r: 120, ax: 0.34, ay: 0.20, sx: 0.17, sy: 0.26, px: 2.1, py: 0.4 },
    { c: '123,92,255',  r: 165, ax: 0.28, ay: 0.18, sx: 0.17, sy: 0.22, px: 4.0, py: 2.6 },
    { c: '64,150,255',  r: 105, ax: 0.36, ay: 0.22, sx: 0.29, sy: 0.19, px: 1.2, py: 4.4 }
  ];

  function drawAurora(t) {
    var g = aurCtx;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(0, 0, AUR_W, AUR_H);
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < BLOBS.length; i++) {
      var b = BLOBS[i];
      var cx = AUR_W * (0.5 + Math.sin(t * b.sx + b.px) * b.ax);
      var cy = AUR_H * (0.46 + Math.cos(t * b.sy + b.py) * b.ay);
      var breathe = 0.72 + 0.28 * Math.sin(t * 0.5 + b.px * 2.0);
      var grad = g.createRadialGradient(cx, cy, 0, cx, cy, b.r);
      grad.addColorStop(0, 'rgba(' + b.c + ',' + (0.62 * breathe).toFixed(3) + ')');
      grad.addColorStop(0.55, 'rgba(' + b.c + ',' + (0.20 * breathe).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(' + b.c + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, AUR_W, AUR_H);
    }
    /* keep the rim of the glass dark so the glow reads as inside it */
    g.globalCompositeOperation = 'destination-in';
    var fade = g.createRadialGradient(AUR_W / 2, AUR_H / 2, AUR_H * 0.25, AUR_W / 2, AUR_H / 2, AUR_W * 0.52);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, AUR_W, AUR_H);
    aurTex.needsUpdate = true;
  }

  function wireAurora(mat) {
    mat.onBeforeCompile = function (shader) {
      shader.uniforms.auroraMap = { value: aurTex };
      shader.uniforms.auroraIntensity = { value: 0 };
      aurUniforms = shader.uniforms;
      shader.vertexShader = 'varying vec3 vAuroraPos;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vAuroraPos = position;'
      );
      shader.fragmentShader = 'uniform sampler2D auroraMap;\nuniform float auroraIntensity;\nvarying vec3 vAuroraPos;\n' + shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  vec2 aUv = vec2(vAuroraPos.y * 0.5 + 0.5, 0.5 - vAuroraPos.z * 0.926);\n  totalEmissiveRadiance += texture2D(auroraMap, aUv).rgb * auroraIntensity;'
      );
    };
    mat.needsUpdate = true;
  }

  /* ---- model --------------------------------------------------------- */
  var ready = false;
  new GLTFLoader().load('models/visionpro.glb', function (gltf) {
    var model = gltf.scene;

    /* centre the geometry so the pivot spins through the middle */
    var box = new THREE.Box3().setFromObject(model);
    var c = box.getCenter(new THREE.Vector3());
    model.position.sub(c);

    var glass = null;
    model.traverse(function (o) {
      if (!glass && o.isMesh && o.material && o.material.name === 'FOugkDgsmvxAjLB') glass = o;
    });
    if (glass) { wireAurora(glass.material); lightsAt = performance.now() + LIGHT_DELAY; }

    pivot.add(model);
    pivot.rotation.set(BASE_PITCH, BASE_YAW, 0);

    /* measure the box in the resting pose, not the raw export orientation,
       so the fit reflects what's actually on screen */
    pivot.updateMatrixWorld(true);
    modelSize = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3());
    resize();
    start();
  }, undefined, function () { /* load failed: flat image stays */ });

  /* ---- spring state -------------------------------------------------- */
  var x = 0, y = 0, vx = 0, vy = 0;   /* normalised -1..1 */
  var tx = 0, ty = 0;
  var pointerLive = false, lingerT = 0;

  function toTarget(cx, cy) {
    var r = visor.getBoundingClientRect();
    var mx = r.left + r.width / 2, my = r.top + r.height / 2;
    tx = Math.max(-1, Math.min(1, (cx - mx) / (window.innerWidth / 2)));
    ty = Math.max(-1, Math.min(1, (cy - my) / (window.innerHeight / 2)));
  }

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    pointerLive = true;
    toTarget(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    pointerLive = true;
    lingerT = 0;
    toTarget(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'touch' || !pointerLive) return;
    toTarget(e.clientX, e.clientY);
  }, { passive: true });
  window.addEventListener('pointerup', function (e) {
    if (e.pointerType !== 'touch') return;
    lingerT = performance.now();     /* hold the pose briefly, then drift home */
  }, { passive: true });

  /* ---- loop ---------------------------------------------------------- */
  var rafId = 0, last = 0, running = false, inView = true, t0 = performance.now();

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    if (lingerT && now - lingerT > 900) { pointerLive = false; lingerT = 0; }

    var gx, gy;
    if (pointerLive) { gx = tx; gy = ty; }
    else {
      var t = (now - t0) / 1000;
      gx = Math.sin(t * 0.5) * IDLE_X;
      gy = Math.cos(t * 0.38) * IDLE_Y;
    }

    vx += ((gx - x) * STIFF - vx * DAMP) * dt;
    vy += ((gy - y) * STIFF - vy * DAMP) * dt;
    x += vx * dt;
    y += vy * dt;

    pivot.rotation.y = BASE_YAW + x * YAW_RANGE;
    pivot.rotation.x = BASE_PITCH + y * PITCH_RANGE;
    pivot.position.x = x * SHIFT_X;
    pivot.position.y = -y * SHIFT_Y;

    if (shadow) {
      shadow.style.transform = 'translateX(' + (x * 26).toFixed(1) + 'px) scaleX(' + (1 - Math.abs(x) * 0.14).toFixed(3) + ')';
      shadow.style.opacity = (0.30 - Math.abs(x) * 0.08 - y * 0.05).toFixed(3);
    }

    if (aurUniforms && lightsAt && now > lightsAt) {
      if (!litOnce) { litOnce = true; window.dispatchEvent(new CustomEvent('heroLightsOn')); }
      var ramp = Math.min((now - lightsAt) / LIGHT_FADE, 1);
      ramp = 1 - Math.pow(1 - ramp, 3);              /* ease-out */
      drawAurora(now / 1000);
      aurUniforms.auroraIntensity.value = ramp * 1.35;
    }

    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      visor.classList.add('is-3d');   /* fades the canvas in */
    }
  }

  function setRunning(on) {
    on = on && inView && !document.hidden;
    if (on === running) return;
    running = on;
    if (on) { last = performance.now(); rafId = requestAnimationFrame(frame); }
    else cancelAnimationFrame(rafId);
  }

  var started = false;
  function start() {
    if (started) return;
    started = true;
    resize();
    if (reduced) {
      /* one static, nicely posed frame — lights on, no motion */
      if (aurUniforms) { drawAurora(1.7); aurUniforms.auroraIntensity.value = 1.35; }
      renderer.render(scene, camera);
      visor.classList.add('is-3d');
      return;
    }
    setRunning(true);
  }

  new ResizeObserver(resize).observe(visor);
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (started && !reduced) setRunning(inView);
  }, { threshold: 0.05 }).observe(visor);
  document.addEventListener('visibilitychange', function () {
    if (started && !reduced) setRunning(!document.hidden);
  });
})();
