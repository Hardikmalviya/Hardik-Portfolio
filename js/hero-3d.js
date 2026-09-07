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

  var modelSize = null, baseScale = 0;
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
    baseScale = Math.min(vw * fw / modelSize.x, vh * fh / modelSize.y) * frac;
    applyPose();
  }

  /* ---- model --------------------------------------------------------- */
  var ready = false;
  new GLTFLoader().load('models/visionpro.glb', function (gltf) {
    var model = gltf.scene;

    model.traverse(function (o) {
      if (o.isMesh && o.material && o.material.emissiveMap) {
        o.material.emissive.setRGB(1, 1, 1);
        o.material.emissiveIntensity = 0;
        emissives.push(o.material);
      }
    });

    /* centre the geometry so the pivot spins through the middle */
    var box = new THREE.Box3().setFromObject(model);
    var c = box.getCenter(new THREE.Vector3());
    model.position.sub(c);

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

  /* ---- About mode ----------------------------------------------------
     js/hero-about.js drives aboutP with the About overlay's scroll:
     0 = normal hero, 1 = fully zoomed in, lit up, on the dark page. */
  var aboutP = 0;
  var glow = new THREE.PointLight(0xdfe8ff, 0, 12, 2);
  glow.position.set(0, 0.25, 2.2);
  scene.add(glow);
  var emissives = [];   /* materials with a display/emissive map, found at load */

  window.heroVisor = {
    setAbout: function (p) {
      aboutP = Math.max(0, Math.min(1, p));
      glow.intensity = aboutP * 26;
      renderer.toneMappingExposure = 1.15 + aboutP * 0.3;
      for (var i = 0; i < emissives.length; i++) emissives[i].emissiveIntensity = aboutP * 2.6;
      /* under reduced motion there is no loop, so paint the change now */
      if (reduced && started) { applyPose(); renderer.render(scene, camera); }
    }
  };

  function applyPose() {
    var damp = 1 - aboutP * 0.6;   /* the follow calms down as you go in */
    /* phones start from a fuller frame, so About grows and lifts less there */
    var narrow = window.innerWidth <= 720;
    var zoom = 1 + aboutP * (narrow ? 0.55 : 1.15);
    var lift = aboutP * (narrow ? 0.55 : 1.1);
    pivot.rotation.y = BASE_YAW + x * YAW_RANGE * damp;
    pivot.rotation.x = BASE_PITCH + y * PITCH_RANGE * damp;
    pivot.position.x = x * SHIFT_X * damp;
    pivot.position.y = -y * SHIFT_Y * damp + lift;   /* up and out of the intro's way */
    if (baseScale) pivot.scale.setScalar(baseScale * zoom);
  }

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

    applyPose();

    if (shadow) {
      shadow.style.transform = 'translateX(' + (x * 26).toFixed(1) + 'px) scaleX(' + (1 - Math.abs(x) * 0.14).toFixed(3) + ')';
      shadow.style.opacity = (0.30 - Math.abs(x) * 0.08 - y * 0.05).toFixed(3);
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
      /* one static, nicely posed frame — no motion */
      renderer.render(scene, camera);
      visor.classList.add('is-3d');
      return;
    }
    setRunning(true);
  }

  var ro = new ResizeObserver(resize);
  ro.observe(visor);
  ro.observe(canvas);   /* About mode swaps the canvas to fullscreen */
  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (started && !reduced) setRunning(inView);
  }, { threshold: 0.05 }).observe(visor);
  document.addEventListener('visibilitychange', function () {
    if (started && !reduced) setRunning(!document.hidden);
  });
})();
