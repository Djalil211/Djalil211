/* ============================================================
   horse.js — Gallop Horse Renderer v2 (canvas 2D)
   دورة ركض كاملة: 4 أرجل بتوقيت rotary gallop + IK للركبتين
   + جسم يعلو ويهبط + ذيل وعرف يتحركان + عضلات مظللة
   يعمل في المتصفح وفي Node (@napi-rs/canvas)
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.HORSE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const frac = (x) => x - Math.floor(x);
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  // Path2D: عالمي في المتصفح، مستورد في Node
  let P2 = null;
  if (typeof Path2D !== 'undefined') P2 = Path2D;
  else if (typeof require === 'function') {
    try { P2 = require('@napi-rs/canvas').Path2D; } catch (e) { P2 = null; }
  }

  /* ---------- IK باثنتين عظمتين: يرجع مفصل الركبة/الرسغ ----------
     المفصل دائماً للخلف (شكل ركبة الحصان والعرقوب) */
  function ik2(ax, ay, tx, ty, l1, l2) {
    let dx = tx - ax, dy = ty - ay;
    let d = Math.hypot(dx, dy) || 1e-6;
    const dc = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const ux = dx / d, uy = dy / d;
    const ex = ax + ux * dc, ey = ay + uy * dc; // نقطة النهاية الفعالة
    const cosA = clamp((l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc), -1, 1);
    const base = Math.atan2(ey - ay, ex - ax);
    const a = Math.acos(cosA);
    const j1x = ax + Math.cos(base + a) * l1, j1y = ay + Math.sin(base + a) * l1;
    const j2x = ax + Math.cos(base - a) * l1, j2y = ay + Math.sin(base - a) * l1;
    const useJ1 = (j1x <= j2x); // المفصل للخلف دائماً
    return {
      jx: useJ1 ? j1x : j2x, jy: useJ1 ? j1y : j2y,
      ex: ex, ey: ey
    };
  }

  /* ---------- نظام الغبار ---------- */
  class Dust {
    constructor() { this.ps = []; }
    spawn(x, y, sc, n, pow) {
      for (let i = 0; i < n; i++) {
        this.ps.push({
          x: x + (Math.random() - 0.5) * 26 * sc,
          y: y - Math.random() * 6 * sc,
          vx: -(50 + Math.random() * 130) * sc * pow,
          vy: -(10 + Math.random() * 45) * sc * pow,
          r: (5 + Math.random() * 9) * sc,
          grow: (26 + Math.random() * 34) * sc,
          age: 0, max: 0.55 + Math.random() * 0.6
        });
      }
      if (this.ps.length > 260) this.ps.splice(0, this.ps.length - 260);
    }
    step(dt, speed) {
      for (const p of this.ps) {
        p.age += dt;
        p.x += p.vx * dt * (0.6 + 0.8 * speed);
        p.y += p.vy * dt; p.vy *= (1 - 2.2 * dt);
        p.r += p.grow * dt;
      }
      this.ps = this.ps.filter(p => p.age < p.max);
    }
    draw(ctx) {
      for (const p of this.ps) {
        const k = p.age / p.max;
        const alpha = 0.34 * (1 - k) * (1 - k);
        ctx.fillStyle = 'rgba(203,172,128,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.fill();
      }
    }
  }

  /* ---------- تعريف الأرجل: مرسى الجسم + طور التوقيت ----------
     ترتيب rotary gallop: الخلفيان أولاً ثم الأماميان ثم طيران */
  const LEGS = [
    { id: 'hindF', ax: -62, ay: -100, off: 0.52, hind: true, near: false },
    { id: 'frontF', ax: 56, ay: -102, off: 0.00, hind: false, near: false },
    { id: 'hindN', ax: -56, ay: -96, off: 0.10, hind: true, near: true },
    { id: 'frontN', ax: 62, ay: -98, off: 0.58, hind: false, near: true },
  ];
  const STANCE = 0.36; // نسبة زمن الارتكاز من الدورة

  function makeHorse(opts) {
    opts = opts || {};
    return {
      x: opts.x || 0, y: opts.y || 0,           // y = خط الأرض
      scale: opts.scale || 1,
      phase: 0,
      speed: opts.speed || 0.8,
      bob: 0, pitch: 0,
      boost: 0, boostAge: 99,
      dust: new Dust(),
      prevP: LEGS.map(() => 0),
      colors: Object.assign({
        body: '#8a5a33', bodyDark: '#5f3c1f', mane: '#2e1d10',
        hoof: '#241a12', highlight: 'rgba(255,232,200,0.20)'
      }, opts.colors || {}),
      flag: opts.flag || null, // دالة (ctx,w,h) ترسم علماً على canvas خارجي
    };
  }

  /* نقطة محلية -> عالمية (انزياح bob + ميل pitch حول مركز الجسم) */
  function worldPt(h, px, py) {
    const c = Math.cos(h.pitch), s = Math.sin(h.pitch);
    const uy = -100; // محور الدوران
    const ry = py - uy;
    return {
      x: h.x + px * c - ry * s,
      y: h.y + h.bob + uy + px * s + ry * c
    };
  }

  /* مسار الحافر: ارتكاز خطي للخلف + قوس تتأرجح للأمام */
  function hoofTarget(h, leg) {
    const sc = h.scale;
    const S = 168 * (0.72 + 0.5 * h.speed);       // طول الخطوة
    const lift = 36 * (0.65 + 0.55 * h.speed);    // ارتفاع الرفع
    const a = worldPt(h, leg.ax, leg.ay);
    const fx = a.x + S * 0.56 * sc, bx = a.x - S * 0.56 * sc;
    const p = frac(h.phase - leg.off);
    if (p < STANCE) {
      const s = p / STANCE;
      return { x: lerp(fx, bx, s), y: h.y, p, strike: false };
    }
    const q = (p - STANCE) / (1 - STANCE);
    return {
      x: lerp(bx, fx, smooth(q)),
      y: h.y - Math.sin(Math.PI * q) * lift * sc,
      p, strike: false
    };
  }

  function stepHorse(h, dt) {
    const eff = h.speed + 0.5 * h.boost;
    h.phase = frac(h.phase + dt * 1.45 * (0.82 + 0.4 * eff));
    const bobAmp = 8.5 * (0.6 + 0.4 * eff) * h.scale;
    h.bob = Math.sin(TAU * (h.phase - 0.12)) * bobAmp - 4 * h.scale;
    h.pitch = 0.055 * Math.sin(TAU * (h.phase - 0.3));
    if (h.boost > 0) { h.boostAge += dt; h.boost = Math.max(0, 1 - h.boostAge / 0.9); }
    // اكتشاف لحظة ارتكاز الحافر -> توليد غبار
    LEGS.forEach((leg, i) => {
      const p = frac(h.phase - leg.off);
      const wrapped = p < h.prevP[i];
      h.prevP[i] = p;
      if (wrapped && h.speed > 0.15) {
        const t = hoofTarget(h, leg);
        h.dust.spawn(t.x, t.y, h.scale, leg.hind ? 5 : 3, 0.5 + eff * 0.6);
      }
    });
    h.dust.step(dt, eff);
  }

  /* ---------- رسم طرف مستدق (نقاط + عروض) ---------- */
  function limb(ctx, pts, widths, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const w1 = widths[i] / 2, w2 = widths[i + 1] / 2;
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      ctx.beginPath();
      ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
      ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
      ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
      ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x1, y1, w1, 0, TAU); ctx.fill();
    }
    const last = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(last[0], last[1], widths[widths.length - 1] / 2, 0, TAU); ctx.fill();
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp(((n >> 16) & 255) * k, 0, 255) | 0;
    const g = clamp(((n >> 8) & 255) * k, 0, 255) | 0;
    const b = clamp((n & 255) * k, 0, 255) | 0;
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawLeg(ctx, h, leg, t, col) {
    const sc = h.scale;
    const a = worldPt(h, leg.ax, leg.ay);
    const L1 = (leg.hind ? 46 : 40) * sc, L2 = (leg.hind ? 44 : 38) * sc;
    const ik = ik2(a.x, a.y, t.x, t.y - 9 * sc, L1, L2);
    const fetl = { x: ik.ex, y: ik.ey };
    const hoof = { x: t.x, y: t.y };
    const w = leg.hind ? [19, 12, 7] : [15, 9.5, 6];
    limb(ctx, [[a.x, a.y], [ik.jx, ik.jy], [fetl.x, fetl.y]], w.map(x => x * sc), col);
    // الوصلة القصيرة (pastern) + الحافر
    limb(ctx, [[fetl.x, fetl.y], [hoof.x, hoof.y - 4 * sc]], [6, 5].map(x => x * sc), col);
    ctx.fillStyle = h.colors.hoof;
    ctx.beginPath();
    ctx.ellipse(hoof.x + 2 * sc, hoof.y - 3.5 * sc, 8.5 * sc, 6 * sc, 0, 0, TAU);
    ctx.fill();
  }

  /* ---------- الجسم: ظهر، صدر، بطن، عضلات ---------- */
  function drawBody(ctx, h, flagCanvas) {
    const c = h.colors;
    ctx.save();
    ctx.translate(h.x, h.y + h.bob);
    ctx.translate(0, -100 * h.scale); ctx.rotate(h.pitch); ctx.translate(0, 100 * h.scale);
    ctx.scale(h.scale, h.scale);
    const B = c.body;

    // --- الذيل (خلف الجسم) ---
    const maneC = c.mane;
    ctx.strokeStyle = maneC; ctx.lineCap = 'round';
    let tx = -80, ty = -128, tang = 3.45; // للخلف قليلاً للأعلى
    ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(tx, ty);
    for (let i = 0; i < 4; i++) {
      tang += Math.sin(TAU * (h.phase - i * 0.11)) * 0.24 + 0.10;
      tx += Math.cos(tang) * 23; ty += Math.sin(tang) * 23;
      ctx.lineTo(tx, ty); ctx.lineWidth = 13 - i * 2.6;
      ctx.stroke(); ctx.beginPath(); ctx.moveTo(tx, ty);
    }

    // --- العنق (يرسم قبل الجسم ليندمج معه) ---
    const neck = new P2();
    neck.moveTo(46, -132);
    neck.bezierCurveTo(70, -150, 96, -172, 126, -198);   // خط العُرف
    neck.lineTo(138, -186);
    neck.bezierCurveTo(112, -172, 92, -152, 80, -134);   // خط الحلق
    neck.closePath();
    ctx.fillStyle = B; ctx.fill(neck);

    // --- الرأس ---
    const head = new P2();
    head.moveTo(126, -198);
    head.bezierCurveTo(138, -210, 150, -212, 158, -207); // الجبهة
    head.bezierCurveTo(170, -200, 180, -194, 186, -189); // الأنف
    head.bezierCurveTo(188, -185, 184, -181, 176, -180); // الشفة
    head.bezierCurveTo(162, -178, 148, -178, 138, -182); // الفم
    head.closePath();
    ctx.fillStyle = B; ctx.fill(head);
    // الأذن
    ctx.fillStyle = shade(B, 0.85);
    ctx.beginPath(); ctx.moveTo(132, -200); ctx.lineTo(138, -216); ctx.lineTo(144, -199); ctx.closePath(); ctx.fill();
    // العين
    ctx.fillStyle = '#1a1008';
    ctx.beginPath(); ctx.arc(146, -197, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(147.2, -198, 1.1, 0, TAU); ctx.fill();
    // فتحة الأنف
    ctx.fillStyle = 'rgba(20,10,5,0.55)';
    ctx.beginPath(); ctx.ellipse(179, -186, 2.6, 1.8, 0.4, 0, TAU); ctx.fill();

    // --- العُرف (mane) ---
    ctx.strokeStyle = maneC;
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6;
      const sx = lerp(50, 124, t0), sy = lerp(-134, -200, t0) - 3;
      const wob = Math.sin(TAU * (h.phase * 2) + i * 0.8) * 4;
      ctx.lineWidth = 5.5 - i * 0.45;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx - 13, sy + 4 + wob * 0.4, sx - 19, sy + 13 + wob);
      ctx.stroke();
    }
    // خصلة الجبهة
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(130, -202);
    ctx.quadraticCurveTo(136, -210 + Math.sin(TAU * h.phase * 2) * 2, 143, -206); ctx.stroke();

    // --- الجذع الرئيسي ---
    const body = new P2();
    body.moveTo(88, -122);                               // أعلى الصدر
    body.bezierCurveTo(72, -140, 58, -142, 44, -138);    // الكتف/الغارب
    body.bezierCurveTo(18, -132, -8, -128, -34, -134);   // الظهر (تقعر خفيف)
    body.bezierCurveTo(-52, -138, -66, -140, -76, -136); // العجز
    body.bezierCurveTo(-96, -130, -108, -112, -106, -94);// الكفل
    body.bezierCurveTo(-104, -76, -92, -62, -74, -64);   // الفخذ الخلفي
    body.bezierCurveTo(-44, -70, -6, -74, 26, -78);      // البطن (مقوس)
    body.bezierCurveTo(52, -82, 74, -92, 88, -108);      // الصدر السفلي
    body.closePath();
    ctx.fillStyle = B; ctx.fill(body);

    // --- تظليل وعضلات (مقطوعة على شكل الجسم) ---
    ctx.save(); ctx.clip(body);
    // ظل البطن
    let g = ctx.createLinearGradient(0, -80, 0, -40);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,12,0,0.30)');
    ctx.fillStyle = g; ctx.fillRect(-120, -80, 220, 50);
    // عضلة الكفل
    g = ctx.createRadialGradient(-64, -102, 6, -64, -102, 46);
    g.addColorStop(0, 'rgba(255,220,170,0.22)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(25,10,0,0.28)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-64, -102, 46, 0, TAU); ctx.fill();
    // عضلة الكتف
    g = ctx.createRadialGradient(54, -112, 4, 54, -112, 34);
    g.addColorStop(0, 'rgba(255,220,170,0.18)');
    g.addColorStop(0.6, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(25,10,0,0.25)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(54, -112, 34, 0, TAU); ctx.fill();
    // عضلات الفخذ الأمامية والخلفية (خطوط داخلية)
    ctx.strokeStyle = 'rgba(30,12,0,0.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-46, -70); ctx.quadraticCurveTo(-58, -92, -52, -124); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(64, -96); ctx.quadraticCurveTo(48, -108, 44, -130); ctx.stroke();
    // لمعان الخط الظهري
    ctx.strokeStyle = c.highlight; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-30, -133);
    ctx.quadraticCurveTo(0, -127, 40, -137); ctx.stroke();
    ctx.restore();

    // حدود الجسم
    ctx.strokeStyle = 'rgba(20,8,0,0.35)'; ctx.lineWidth = 2.2; ctx.stroke(body);
    ctx.strokeStyle = 'rgba(20,8,0,0.3)'; ctx.lineWidth = 2; ctx.stroke(neck);
    ctx.stroke(head);

    // --- قماش السرج + سارية العلم ---
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-20, -132, 40, 26, 6) : ctx.rect(-20, -132, 40, 26);
    ctx.fill();
    if (flagCanvas) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-17, -129, 34, 20, 4) : ctx.rect(-17, -129, 34, 20);
      ctx.clip();
      ctx.drawImage(flagCanvas, -17, -129, 34, 20);
      ctx.restore();
    }
    ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-6, -130); ctx.lineTo(-6, -216); ctx.stroke();
    ctx.restore();

    // --- العلم المتموج أعلى السارية (إحداثيات عالمية) ---
    if (flagCanvas) {
      const base = worldPt(h, -6, -214);
      const fw = 62 * h.scale, fh = 40 * h.scale;
      const slices = 8, sw = flagCanvas.width / slices;
      for (let i = 0; i < slices; i++) {
        const wob = Math.sin(TAU * (h.phase * 1.6) - i * 0.55) * (i / slices) * 6 * h.scale;
        ctx.drawImage(flagCanvas, i * sw, 0, sw, flagCanvas.height,
          base.x + i * (fw / slices), base.y + wob, fw / slices + 1, fh);
      }
    }
  }

  function renderHorse(ctx, h) {
    const sc = h.scale, c = h.colors;
    // الظل الأرضي
    const k = clamp((h.bob / (8.5 * sc)) * 0.5 + 0.5, 0, 1);
    ctx.fillStyle = 'rgba(15,8,2,' + (0.30 - 0.10 * k).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 7 * sc, (118 - 14 * k) * sc, (15 - 3 * k) * sc, 0, 0, TAU);
    ctx.fill();

    // الأرجل البعيدة (أغمق) ثم الجسم ثم القريبة
    const farCol = shade(c.body, 0.68), nearCol = c.body;
    for (const leg of LEGS) if (!leg.near) drawLeg(ctx, h, leg, hoofTarget(h, leg), farCol);
    drawBody(ctx, h, h._flagCanvas || null);
    for (const leg of LEGS) if (leg.near) drawLeg(ctx, h, leg, hoofTarget(h, leg), nearCol);

    // موجة الطاقة عند الهدية
    if (h.boost > 0.02) {
      const bx = h.x - 70 * sc, by = h.y - 95 * sc;
      const r1 = 40 * sc + h.boostAge * 520 * sc;
      const al = h.boost * 0.55;
      ctx.lineWidth = 7 * sc;
      ctx.strokeStyle = 'rgba(90,220,255,' + (al * 0.9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, Math.min(r1, 320 * sc), Math.PI * 0.62, Math.PI * 1.38); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,60,' + (al * 0.7).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bx, by, Math.min(r1 * 0.72, 240 * sc), Math.PI * 0.66, Math.PI * 1.34); ctx.stroke();
      // خطوط السرعة
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const yy = h.y - (30 + (i * 13.7) % 150) * sc;
        const xx = h.x + 90 * sc + ((i * 53) % 160) * sc;
        const len = (60 + (i * 37) % 110) * sc * h.boost;
        ctx.strokeStyle = 'rgba(120,225,255,' + (0.10 + 0.16 * h.boost).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy); ctx.stroke();
      }
      // وميض أرضي
      ctx.fillStyle = 'rgba(90,220,255,' + (h.boost * 0.18).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(h.x, h.y + 4 * sc, 150 * sc, 18 * sc, 0, 0, TAU); ctx.fill();
    }
    h.dust.draw(ctx);
  }

  /* ---------- أعلام دقيقة (هندسية) ---------- */
  function makeFlag(draw, w, h) {
    const c = typeof document !== 'undefined'
      ? document.createElement('canvas')
      : null;
    const cv = c || { width: w, height: h, _custom: true };
    if (!c && typeof require === 'function') {
      // Node: يُنشأ من الخارج ويُمرر — نرجع دالة الرسم فقط
      return { width: w, height: h, draw: draw };
    }
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    draw(ctx, w, h);
    return cv;
  }

  function draw5Star(ctx, cx, cy, R, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? R : R * 0.42;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }

  /* علم الجزائر 🇩🇿: نصف أخضر/أبيض + هلال ونجمة أحمران */
  function drawFlagDZ(ctx, w, h) {
    ctx.fillStyle = '#006233'; ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(w / 2, 0, w / 2, h);
    const cx = w * 0.47, cy = h * 0.5, R = h * 0.34;
    ctx.fillStyle = '#D21034';
    ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI / 2, Math.PI * 1.5, false);       // القوس الخارجي (يسار)
    ctx.arc(cx + R * 0.42, cy, R * 0.86, Math.PI * 1.5, Math.PI / 2, false); // القوس الداخلي
    ctx.closePath(); ctx.fill();
    draw5Star(ctx, cx + R * 0.78, cy, R * 0.36, '#D21034');
  }

  return {
    makeHorse, stepHorse, renderHorse, hoofTarget,
    Dust, ik2, drawFlagDZ, draw5Star, LEGS
  };
});
