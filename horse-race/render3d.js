/* render3d.js — يعرض المجسم ثلاثي الأبعاد (Horse.glb بدورة جَلَب من 15 إطاراً)
   بدون WebGL: تهيئر إطارات المورف + تظليل مسطح + خوارزمية الرسام على canvas */
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const H = require('./js/horse.js');

/* ---------- قراءة GLB ---------- */
function parseGLB(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const j = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8;
  const bin = buf.slice(binStart);
  function readAccessor(ai) {
    const acc = j.accessors[ai];
    const bv = j.bufferViews[acc.bufferView];
    const off = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const n = acc.count, comp = { 5126: 4, 5123: 2, 5125: 4 }[acc.componentType];
    const nComp = acc.type === 'VEC3' ? 3 : 1;
    const out = new Float32Array(n * nComp);
    if (acc.componentType === 5126) {
      for (let i = 0; i < out.length; i++) out[i] = bin.readFloatLE(off + i * 4);
    } else if (acc.componentType === 5123) {
      for (let i = 0; i < out.length; i++) out[i] = bin.readUInt16LE(off + i * 2);
    } else {
      for (let i = 0; i < out.length; i++) out[i] = buf2.readUInt32LE(off + i * 4);
    }
    return out;
  }
  const prim = j.meshes[0].primitives[0];
  const idx = readAccessor(prim.indices);
  const base = readAccessor(prim.attributes.POSITION);
  const targets = prim.targets.map(t => readAccessor(t.POSITION));
  return { idx, base, targets };
}

/* ---------- إطار مورف واحد ---------- */
function poseAt(g, ph, out) {
  const n = g.targets.length;
  const i0 = Math.floor(ph) % n, i1 = (i0 + 1) % n, t = ph - Math.floor(ph);
  const A = g.targets[i0], B = g.targets[i1];
  for (let k = 0; k < out.length; k++) out[k] = A[k] + (B[k] - A[k]) * t;
}

(async () => {
  const W = 1280, HGT = 720, GROUND = 596, FPS = 30, DUR = 6.5, N = Math.round(DUR * FPS);
  const g = parseGLB(fs.readFileSync(path.join(__dirname, 'assets', 'Horse.glb')));
  const NV = g.base.length / 3, NT = g.idx.length / 3;

  /* هل الأهداف مطلقة أم إزاحات؟ */
  let maxAbs = 0;
  for (let k = 0; k < 300; k++) maxAbs = Math.max(maxAbs, Math.abs(g.targets[0][k]));
  const ABSOLUTE = maxAbs > 20;
  if (!ABSOLUTE) for (let ti = 0; ti < g.targets.length; ti++) {
    const T = g.targets[ti];
    for (let k = 0; k < T.length; k++) T[k] += g.base[k];
  }
  console.log('mode:', ABSOLUTE ? 'absolute' : 'delta→absolute', '| poses:', g.targets.length, '| verts:', NV, '| tris:', NT);

  const S = 1.62;                      // حجم الحصان على الشاشة
  const X0 = 640, FLIP = true;         // منظور جانبي
  const proj = (x, y, z) => ({ sx: X0 + (FLIP ? -z : z) * S, sy: GROUND - y * S, d: x });

  const pose = new Float32Array(g.base.length);
  const canvas = createCanvas(W, HGT);
  const ctx = canvas.getContext('2d');
  const bg = await loadImage(path.join(__dirname, 'assets', 'bg.jpg'));
  const flag = createCanvas(90, 60);
  H.drawFlagDZ(flag.getContext('2d'), 90, 60);

  const dust = new H.Dust();
  const triDepth = new Float32Array(NT);
  const triOrder = new Uint16Array(NT).map((_, i) => i);

  const outDir = path.join(__dirname, 'preview', 'frames3d');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let t = 0, boosted = false, boost = 0, boostAge = 99, cycPrev = 0, bgOff = 0;
  const L = [-0.42, 0.78, 0.46]; // اتجاه الضوء (شاشة-أعلى-أمام)
  const lenL = Math.hypot(...L);

  for (let f = 0; f < N; f++) {
    t = f / FPS;
    if (!boosted && t >= 2.8) { boosted = true; boost = 1; boostAge = 0; }
    boostAge += 1 / FPS;
    boost = Math.max(0, 1 - boostAge / 0.9);

    const spd = 0.9 + 0.55 * boost;
    const ph = (t * 1.45 * (0.82 + 0.4 * spd)) * g.targets.length; // طور المورف عبر الدورة
    poseAt(g, ph, pose);
    const cyc = Math.floor(ph / g.targets.length);
    if (cyc !== cycPrev) {
      cycPrev = cyc;
      dust.spawn(X0 - 180, GROUND, 1.7, 7, 0.8 + spd * 0.7);
      dust.spawn(X0 - 220, GROUND, 1.7, 5, 0.8 + spd * 0.7);
    }
    dust.step(1 / FPS, spd);
    bgOff += (150 + 240 * spd) * (1 / FPS);

    /* --- الخلفية والأرض --- */
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

    /* --- موجة الهدية (خلف الحصان) --- */
    if (boost > 0.02) {
      const bx = X0 - 300, by = GROUND - 150;
      const r1 = Math.min(60 + boostAge * 900, 560);
      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(90,220,255,' + (boost * 0.85).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, r1, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,60,' + (boost * 0.65).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, r1 * 0.72, Math.PI * 0.64, Math.PI * 1.36); ctx.stroke();
      ctx.lineWidth = 4;
      for (let i = 0; i < 12; i++) {
        const yy = GROUND - (30 + (i * 13.7) % 160);
        const xx = X0 + 200 + ((i * 53) % 180);
        const len = (70 + (i * 37) % 120) * boost;
        ctx.strokeStyle = 'rgba(120,225,255,' + (0.10 + 0.17 * boost).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy); ctx.stroke();
      }
    }

    /* --- الظل الأرضي --- */
    ctx.fillStyle = 'rgba(15,8,2,0.32)';
    ctx.beginPath(); ctx.ellipse(X0, GROUND + 10, 250, 26, 0, 0, Math.PI * 2); ctx.fill();

    /* --- الحصان: تظليل مسطح + ترتيب الرسام --- */
    const pts = new Float32Array(NV * 2);
    for (let v = 0; v < NV; v++) {
      const p = proj(pose[v * 3], pose[v * 3 + 1], pose[v * 3 + 2]);
      pts[v * 2] = p.sx; pts[v * 2 + 1] = p.sy;
    }
    for (let i = 0; i < NT; i++) {
      const a = g.idx[i * 3] * 2, b = g.idx[i * 3 + 1] * 2, c = g.idx[i * 3 + 2] * 2;
      triDepth[i] = (pose[g.idx[i * 3] * 3] + pose[g.idx[i * 3 + 1] * 3] + pose[g.idx[i * 3 + 2] * 3]) / 3;
    }
    const order = Array.from(triOrder).sort((p, q) => triDepth[q] - triDepth[p]);
    for (const i of order) {
      const ia = g.idx[i * 3], ib = g.idx[i * 3 + 1], ic = g.idx[i * 3 + 2];
      // طبيعي المثلث في فضاء الشاشة+العمق
      const ax = pose[ia * 3], ay = pose[ia * 3 + 1], az = pose[ia * 3 + 2];
      const bx = pose[ib * 3], by = pose[ib * 3 + 1], bz = pose[ib * 3 + 2];
      const cx = pose[ic * 3], cy = pose[ic * 3 + 1], cz = pose[ic * 3 + 2];
      let ux = bx - ax, uy = by - ay, uz = bz - az;
      let vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1e-6;
      // إلى فضاء الكاميرا: (شاشةX = -z, شاشةY = y, عمق = x)
      let cnx = -nz / nl * (FLIP ? 1 : -1), cny = ny / nl, cnd = nx / nl;
      if (cnd < 0) { cnx = -cnx; cny = -cny; cnd = -cnd; } // نحو المشاهد
      const lambert = Math.max(0, (cnx * L[0] + cny * L[1] + cnd * L[2]) / lenL);
      const k = 0.38 + 0.72 * lambert;
      ctx.fillStyle = 'rgb(' + ((138 * k) | 0) + ',' + ((92 * k) | 0) + ',' + ((56 * k) | 0) + ')';
      ctx.beginPath();
      ctx.moveTo(pts[ia * 2], pts[ia * 2 + 1]);
      ctx.lineTo(pts[ib * 2], pts[ib * 2 + 1]);
      ctx.lineTo(pts[ic * 2], pts[ic * 2 + 1]);
      ctx.closePath(); ctx.fill();
    }

    /* --- العلم فوق الحصان --- */
    const fx = X0 - 20, fyTop = GROUND - 330;
    ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(fx, GROUND - 10); ctx.lineTo(fx, fyTop); ctx.stroke();
    const fw = 84, fh = 56, slices = 8, sw = flag.width / slices;
    for (let i = 0; i < slices; i++) {
      const wob = Math.sin((t * 9) - i * 0.55) * (i / slices) * 8;
      ctx.drawImage(flag, i * sw, 0, sw, flag.height, fx + i * (fw / slices), fyTop + wob, fw / slices + 1, fh);
    }

    dust.draw(ctx);

    /* --- لمسة سينمائية --- */
    gr = ctx.createRadialGradient(W / 2, HGT / 2, HGT * 0.42, W / 2, HGT / 2, HGT * 0.95);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, HGT);
    ctx.restore();

    fs.writeFileSync(path.join(outDir, 'f_' + String(f).padStart(3, '0') + '.png'), canvas.toBuffer('image/png'));
    if (f % 45 === 0) console.log('frame', f, '/', N);
  }
  console.log('DONE_FRAMES', N);
})().catch(e => { console.error(e); process.exit(1); });
