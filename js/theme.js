/* Dark theme, flipped by double-clicking anywhere.
   The moment of the switch uses the View Transitions API: the browser
   snapshots the old page, the class flips underneath, and the new page
   is revealed through a circle growing out of the point you clicked.
   Browsers without the API just switch instantly. */
(function () {
  var KEY = 'theme';
  var root = document.documentElement;

  function setTheme(dark) {
    root.classList.toggle('dark', dark);
    try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) {}
  }

  function flip(x, y) {
    /* a double-click selects a word; that highlight would ride through
       the wipe, so drop it before switching */
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();

    var dark = !root.classList.contains('dark');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!document.startViewTransition || reduced) { setTheme(dark); return; }

    var t = document.startViewTransition(function () { setTheme(dark); });
    t.ready.then(function () {
      /* big enough to cover the far corner of the screen */
      var r = Math.hypot(Math.max(x, window.innerWidth - x),
                         Math.max(y, window.innerHeight - y));
      root.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)',
                     'circle(' + Math.ceil(r) + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 600, easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(function () {});
  }

  document.addEventListener('dblclick', function (e) {
    /* not on things you might double-click for their own sake */
    if (e.target.closest('a, button, input, textarea, select')) return;
    flip(e.clientX, e.clientY);
  });
})();
