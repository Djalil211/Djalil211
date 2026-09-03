/* render_sprite.js — يركّب إطارات الحصان (من صورة/لوحة) في مشهد السباق:
   خلفية متحركة + أرض ترابية + غبار + علم الجزائر + موجة الهدية + اهتزاز */
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const H = require('./js/horse.js');

(async () => {
  const W = 1280, HGT = 720, GROUND = 600, FPS = 30, DUR = 6.5, N = Math.round(DUR * FPS);
  const framesDir = path.join(__dirname, 'assets', 'frames');
  const files = fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).sort();
  const frames = [];
  for (const f of files) frames.push(await loadImage(path.join(framesDir, f)));
  console.log('frames:', frames.length);
  const CYC = frames.length;

  const bg = await loadImage(path.join(__dirname, 'assets', 'bg.jpg'));
  const flag = createCanvas(90, 60);
  H.drawFlagDZ(flag.getContext('2d'), 90, 60);

  // حجم الحصان: ارتفاع 360px على الشاشة
  const HORSE_H = 360;
  const canvas = createCanvas(W, HGT), ctx = canvas.getContext('2d');
  const dust = new H.Dust();

  const outDir = path.join(__dirname, 'preview', 'framesS');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let boosted = false, boostAge = 99, boost = 0, bgOff = 0, cycF = 0;
  const L = [-0.42, 0.78, 0.46];

  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    if (!boosted && t >= 2.8) { boosted = true; boostAge = 0; }
    boostAge += 1 / FPS;
    boost = Math.max(0, 1 - boostAge / 0.9);
    const spd = 0.9 + 0.55 * boost;

    // تقدم الدورة (إطار مورف = خطوة)
    const prev = cycF;
    cycF += (1 / FPS) * 1.45 * (0.82 + 0.4 * spd) * CYC;
    if (Math.floor(cycF) !== Math.floor(prev)) {
      dust.spawn(700, GROUND, 1.6, 7, 0.8 + spd * 0.7);
      dust.spawn(760, GROUND, 1.6, 5, 0.8 + spd * 0.7);
    }
    dust.step(1 / FPS, spd);
    bgOff += (150 + 240 * spd) * (1 / FPS);

    /* خلفية */
    let shx = 0, shy = 0;
    if (boost > 0.7) { const k = (boost - 0.7) / 0.3; shx = Math.sin(t * 997) * 5 * k; shy = Math.cos(t * 761) * 4 * k; }
    ctx.save(); ctx.translate(shx, shy);
    const s = Math.max(W / bg.width, HGT / bg.height);
    const dw = bg.width * s, dh = bg.height * s, dy = (HGT - dh) / 2;
    const off = -(bgOff % dw);
    ctx.drawImage(bg, off, dy, dw, dh); ctx.drawImage(bg, off + dw, dy, dw, dh);
    let gr = ctx.createLinearGradient(0, GROUND - 8, 0, HGT);
    gr.addColorStop(0, 'rgba(122,92,60,0.92)'); gr.addColorStop(1, 'rgba(74,52,32,0.98)');
    ctx.fillStyle = gr; ctx.fillRect(0, GROUND - 8, W, HGT - GROUND + 8);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, GROUND - 10, W, 3);

    /* موجة الهدية خلف الحصان */
    if (boost > 0.02) {
      const bx = 430, by = GROUND - 170;
      const r1 = Math.min(60 + boostAge * 900, 560);
      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(90,220,255,' + (boost * 0.85).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, r1, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,60,' + (boost * 0.65).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, r1 * 0.72, Math.PI * 0.64, Math.PI * 1.36); ctx.stroke();
      ctx.lineWidth = 4;
      for (let i = 0; i < 12; i++) {
        const yy = GROUND - (30 + (i * 13.7) % 160);
        const xx = 950 + ((i * 53) % 180);
        const len = (70 + (i * 37) % 120) * boost;
        ctx.strokeStyle = 'rgba(120,225,255,' + (0.10 + 0.17 * boost).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy); ctx.stroke();
      }
    }

    /* الظل */
    ctx.fillStyle = 'rgba(15,8,2,0.32)';
    ctx.beginPath(); ctx.ellipse(700, GROUND + 8, 230, 22, 0, 0, Math.PI * 2); ctx.fill();

    /* الحصان: إطار الدورة + bob */
    const fi = Math.floor(cycF) % CYC;
    const fr = frames[fi];
    const sc = HORSE_H / fr.height;
    const hw = fr.width * sc;
    const bob = Math.sin((cycF / CYC) * Math.PI * 2) * 7 - 3;
    ctx.drawImage(fr, 700 - hw / 2, GROUND - HORSE_H + bob, hw, HORSE_H);

    /* العلم */
    const fx = 620, fyTop = GROUND - 345;
    ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(fx, GROUND - 5); ctx.lineTo(fx, fyTop); ctx.stroke();
    const fw = 84, fh = 56, slices = 8, sw2 = flag.width / slices;
    for (let i = 0; i < slices; i++) {
      const wob = Math.sin(t * 9 - i * 0.55) * (i / slices) * 8;
      ctx.drawImage(flag, i * sw2, 0, sw2, flag.height, fx + i * (fw / slices), fyTop + wob, fw / slices + 1, fh);
    }

    dust.draw(ctx);

    /* vignette */
    gr = ctx.createRadialGradient(W / 2, HGT / 2, HGT * 0.42, W / 2, HGT / 2, HGT * 0.95);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, HGT);
    ctx.restore();

    fs.writeFileSync(path.join(outDir, 'f_' + String(f).padStart(3, '0') + '.png'), canvas.toBuffer('image/png'));
    if (f % 45 === 0) console.log('frame', f, '/', N);
  }
  console.log('DONE_FRAMES', N);
})().catch(e => { console.error(e); process.exit(1); });
