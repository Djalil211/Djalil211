/* توليد إطارات مشهد المعاينة محلياً عبر @napi-rs/canvas */
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const H = require('../js/horse.js');
const SCENE = require('./scene.js');

(async () => {
  const bg = await loadImage(path.join(__dirname, '..', 'assets', 'bg.jpg'));
  const flag = createCanvas(90, 60);
  H.drawFlagDZ(flag.getContext('2d'), 90, 60);
  SCENE.setFlagCanvas(flag);

  const canvas = createCanvas(SCENE.W, SCENE.HGT);
  const ctx = canvas.getContext('2d');
  const outDir = path.join(__dirname, 'frames');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let checks = { dust: 0, boost: false, hoofGround: null };
  for (let i = 0; i < SCENE.N; i++) {
    SCENE.seek(i);
    SCENE.render(ctx, bg);

    // فحوصات منطقية (بلا رؤية: نتأكد أن الأنظمة تعمل)
    const hr = SCENE.horseRef();
    checks.dust = Math.max(checks.dust, hr.dust.ps.length);
    if (i > 85 && hr.boost > 0) checks.boost = true;
    if (i === 2) {
      const t0 = H.hoofTarget(hr, H.LEGS[1]);
      checks.hoofGround = Math.abs(t0.y - SCENE.GROUND);
    }
    fs.writeFileSync(
      path.join(outDir, 'f_' + String(i).padStart(3, '0') + '.png'),
      canvas.toBuffer('image/png')
    );
    if (i % 30 === 0) console.log('frame', i, '/', SCENE.N);
  }
  console.log('CHECKS', JSON.stringify(checks));
  console.log('DONE_FRAMES', SCENE.N);
})().catch(e => { console.error(e); process.exit(1); });
