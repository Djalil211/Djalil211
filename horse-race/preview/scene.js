/* ============================================================
   scene.js — مشهد المعاينة: حصان يجري على مضمار مع غبار وهبة الهدية
   مشترك بين Node (توليد الفيديو) والمتصفح (صفحة المعاينة)
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../js/horse.js'));
  else root.SCENE = factory(root.HORSE);
})(typeof self !== 'undefined' ? self : this, function (H) {
  'use strict';
  const W = 1280, HGT = 720, GROUND = 596, FPS = 30, DUR = 6.5;
  const N = Math.round(DUR * FPS);

  let horse, bgOff, t, boosted, flagCv;

  function reset() {
    horse = H.makeHorse({
      x: 620, y: GROUND, scale: 1.55, speed: 0.8,
      flag: 'DZ'
    });
    horse._flagCanvas = flagCv || null;
    bgOff = 0; t = 0; boosted = false;
  }
  reset();

  function setFlagCanvas(cv) { flagCv = cv; horse._flagCanvas = cv; }

  let autoGift = true;
  function setAutoGift(v) { autoGift = !!v; }
  function sendGift() { horse.boost = 1; horse.boostAge = 0; }

  function step(dt) {
    t += dt;
    if (autoGift && !boosted && t >= 2.8) { boosted = true; horse.boost = 1; horse.boostAge = 0; }
    H.stepHorse(horse, dt);
    bgOff += (150 + 240 * (horse.speed + 0.5 * horse.boost)) * dt;
  }

  function render(ctx, bgImg) {
    // اهتزاز كاميرا خفيف عند الهدية
    let shx = 0, shy = 0;
    if (horse.boost > 0.7) {
      const k = (horse.boost - 0.7) / 0.3;
      shx = Math.sin(t * 997) * 5 * k; shy = Math.cos(t * 761) * 4 * k;
    }
    ctx.save();
    ctx.translate(shx, shy);

    // الخلفية مع تحريك أفقي (وهم الجري) — تغطية كاملة بلا تشويه
    if (bgImg) {
      const s = Math.max(W / bgImg.width, HGT / bgImg.height);
      const dw = bgImg.width * s, dh = bgImg.height * s;
      const dy = (HGT - dh) / 2;
      const off = -(bgOff % dw);
      ctx.drawImage(bgImg, off, dy, dw, dh);
      ctx.drawImage(bgImg, off + dw, dy, dw, dh);
    } else {
      ctx.fillStyle = '#2b3a52'; ctx.fillRect(0, 0, W, HGT);
    }

    // شريط الأرض الترابي
    let g = ctx.createLinearGradient(0, GROUND - 8, 0, HGT);
    g.addColorStop(0, 'rgba(122,92,60,0.92)');
    g.addColorStop(1, 'rgba(74,52,32,0.98)');
    ctx.fillStyle = g; ctx.fillRect(0, GROUND - 8, W, HGT - GROUND + 8);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, GROUND - 10, W, 3);

    H.renderHorse(ctx, horse);

    // تظليل سينمائي (vignette)
    g = ctx.createRadialGradient(W / 2, HGT / 2, HGT * 0.42, W / 2, HGT / 2, HGT * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HGT);
    ctx.restore();
  }

  let frame = -1;
  function seek(i) {
    if (i < frame) { reset(); frame = -1; }
    while (frame < i) { step(1 / FPS); frame++; }
  }

  return { W, HGT, GROUND, FPS, N, reset, step, render, seek, setFlagCanvas, horseRef: () => horse };
});
