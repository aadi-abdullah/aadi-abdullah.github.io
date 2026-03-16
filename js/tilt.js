/* ============================================================
   tilt.js  —  RAF-throttled 3D card tilt + glossy reflection
   One shared requestAnimationFrame for all cards.
   Bridges to scene.js via window.sceneHighlight().
   Disabled on touch devices.
   ============================================================ */

(function () {

  if (window.matchMedia('(pointer:coarse)').matches) return;

  var cards      = document.querySelectorAll('.pcard,.sys-card,.proof-card,.m-card');
  var activeCard = null;
  var ex = 0, ey = 0;
  var pending    = false;

  function applyTilt() {
    pending = false;
    if (!activeCard) return;

    var r  = activeCard.getBoundingClientRect();
    var cx = r.width  / 2;
    var cy = r.height / 2;
    var rX = ((ey - cy) / cy) * -4.2;
    var rY = ((ex - cx) / cx) *  4.2;

    /* 3D transform */
    activeCard.style.transform =
      'perspective(900px) rotateX(' + rX.toFixed(2) + 'deg) rotateY(' + rY.toFixed(2) + 'deg) translateY(-5px)';

    /* Glossy highlight — CSS custom property drives radial-gradient in ::after */
    activeCard.style.setProperty('--gx', ((ex / r.width)  * 100).toFixed(1) + '%');
    activeCard.style.setProperty('--gy', ((ey / r.height) * 100).toFixed(1) + '%');

    /* Ambient glow sprite follow */
    var glow = activeCard.querySelector('.pcglow');
    if (glow) { glow.style.left = ex + 'px'; glow.style.top = ey + 'px'; }
  }

  cards.forEach(function (card) {

    card.addEventListener('mousemove', function (e) {
      activeCard = card;
      var r = card.getBoundingClientRect();
      ex = e.clientX - r.left;
      ey = e.clientY - r.top;
      if (!pending) { pending = true; requestAnimationFrame(applyTilt); }
    }, { passive: true });

    card.addEventListener('mouseleave', function () {
      if (activeCard === card) {
        activeCard = null;
        card.style.transform = '';
        card.style.setProperty('--gx', '50%');
        card.style.setProperty('--gy', '50%');
      }
    });

    card.addEventListener('mouseenter', function () {
      if (window.sceneHighlight) window.sceneHighlight(true);
    });

    card.addEventListener('mouseleave', function () {
      if (window.sceneHighlight) window.sceneHighlight(false);
    });
  });

}());
