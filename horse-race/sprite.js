/* sprite.js — تقطيع لوحة الحركة (sprite sheet) إلى إطارات نظيفة
   يكتشف الخلايا تلقائياً عبر فجوات الأخضر، يزيل الخلفية والحافة الخضراء */
const fs = require('fs');
const path = require('path');
const { loadImage, createCanvas } = require('@napi-rs/canvas');

const GREEN = [0, 255, 0];

async function main() {
  const src = process.argv[2] || path.join(__dirname, 'assets', 'sprite.png');
  const outDir = process.argv[3] || path.join(__dirname, 'assets', 'frames');
  const img = await loadImage(fs.readFileSync(src));
  const W = img.width, HGT = img.height;
  const c = createCanvas(W, HGT), ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, HGT).data;

  const isGreen = (i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    return g > 95 && g > r * 1.35 && g > b * 1.35;
  };

  // صفوف/أعمدة "غير خضراء" → نطاقات
  const rowHit = new Array(HGT).fill(false);
  const colHit = new Array(W).fill(false);
  for (let y = 0; y < HGT; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 40 && !isGreen(i)) { rowHit[y] = true; colHit[x] = true; }
    }
  }
  const bands = (hit, min, gap) => {
    const out = []; let s = -1, zeros = 0;
    for (let k = min - 1; k >= 0; k--) { /* noop */ }
    for (let k = 0; k <= hit.length; k++) {
      const on = k < hit.length && hit[k];
      if (on && s < 0) s = k;
      if (!on && s >= 0) { out.push([s, k - 1]); s = -1; }
    }
    return out.filter(b => b[1] - b[0] > gap);
  };
  const rowBands = bands(rowHit, 0, HGT * 0.03);
  const panels = [];
  for (const [ry0, ry1] of rowBands) {
    // داخل كل صف: أعمدة غير خضراء
    const cHit = new Array(W).fill(false);
    for (let y = ry0; y <= ry1; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 40 && !isGreen(i)) cHit[x] = true;
    }
    for (const [cx0, cx1] of bands(cHit, 0, W * 0.008)) {
      panels.push({ x0: cx0, x1: cx1, y0: ry0, y1: ry1 });
    }
  }
  console.log('panels found:', panels.length);
  if (panels.length < 4) { console.error('Very few panels!'); process.exit(2); }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // قص كل لوحة + إزالة الأخضر (معالجة الانسكاب) + توحيد الارتفاع
  const TARGET_H = 400;
  let n = 0;
  for (const p of panels) {
    const pw = p.x1 - p.x0 + 1, ph = p.y1 - p.y0 + 1;
    const s = TARGET_H / ph;
    const cw = Math.ceil(pw * s);
    const oc = createCanvas(cw, TARGET_H), octx = oc.getContext('2d');
    octx.imageSmoothingEnabled = true;
    // نسخة بكسلية بمعالجة ألفا الأخضر
    const tmp = createCanvas(pw, ph), tctx = tmp.getContext('2d');
    tctx.drawImage(c, p.x0, p.y0, pw, ph, 0, 0, pw, ph);
    const td = tctx.getImageData(0, 0, pw, ph);
    for (let i = 0; i < td.data.length; i += 4) {
      const r = td.data[i], g = td.data[i + 1], b = td.data[i + 2];
      if (g > 95 && g > r * 1.35 && g > b * 1.35) {
        td.data[i + 3] = 0;
      } else if (g > r && g > b && g > 70) {
        // انسكاب أخضر: خفض الأخضر نحو متوسط (r+b)/2
        td.data[i + 1] = Math.min(g, (r + b) / 2 + 25);
      }
    }
    tctx.putImageData(td, 0, 0);
    octx.drawImage(tmp, 0, 0, pw, ph, 0, 0, cw, TARGET_H);
    fs.writeFileSync(path.join(outDir, 'f_' + String(n).padStart(2, '0') + '.png'), oc.toBuffer('image/png'));
    n++;
  }
  console.log('DONE_SPRITE', n);
}
main().catch(e => { console.error(e); process.exit(1); });
