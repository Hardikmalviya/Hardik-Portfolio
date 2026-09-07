/* About mode.
   Click About: the heading and testimonial fade away, the page's own scroll
   locks, and this overlay's scroll takes over. Progress 0..1 darkens the
   page, zooms and lights the Vision Pro (via window.heroVisor.setAbout),
   then floats the introduction in. Scroll back to the very top and nudge up
   once more (or press Escape / the X) to come back out. */
(function () {
  var about = document.getElementById('about');
  var scroller = about && about.querySelector('.about__scroll');
  var closeBtn = about && about.querySelector('.about__close');
  var links = document.querySelectorAll('[data-about]');
  if (!about || !scroller || !links.length) return;

  var body = document.body;
  var open = false;
  var raf = 0;

  function progress() {
    var max = scroller.scrollHeight - scroller.clientHeight;
    return max > 0 ? scroller.scrollTop / max : 0;
  }

  function apply() {
    raf = 0;
    var p = progress();
    about.style.setProperty('--p', p.toFixed(4));
    if (window.heroVisor) window.heroVisor.setAbout(p);
    /* past 40% the page reads as dark: flip the nav onto its dark styling */
    body.classList.toggle('about-dark', p > 0.4);
  }

  function onScroll() { if (!raf) raf = requestAnimationFrame(apply); }

  function enter() {
    if (open) return;
    open = true;
    if (window.lenis) {
      window.lenis.scrollTo(0, { immediate: true });
      window.lenis.stop();
    } else {
      window.scrollTo(0, 0);
    }
    about.hidden = false;
    scroller.scrollTop = 0;
    apply();
    /* next frame so the fade transitions actually run */
    requestAnimationFrame(function () { body.classList.add('about-mode'); });
    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.focus({ preventScroll: true });
  }

  function leave() {
    if (!open) return;
    open = false;
    scroller.removeEventListener('scroll', onScroll);
    body.classList.remove('about-mode', 'about-dark');
    if (window.heroVisor) window.heroVisor.setAbout(0);
    if (window.lenis) window.lenis.start();
    setTimeout(function () { about.hidden = true; about.style.setProperty('--p', 0); }, 350);
  }

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      open ? leave() : enter();
    });
  });
  closeBtn && closeBtn.addEventListener('click', leave);
  document.addEventListener('keydown', function (e) {
    if (open && (e.key === 'Escape' || e.key === 'Esc')) leave();
  });

  /* an extra upward nudge while already at the top backs out of About */
  scroller.addEventListener('wheel', function (e) {
    if (open && e.deltaY < -8 && scroller.scrollTop <= 0) leave();
  }, { passive: true });
})();
