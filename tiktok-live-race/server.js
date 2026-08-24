/* ====================================================================
   سباق الدول العربية — أداة بث TikTok تفاعلية (tiktok-live-connector v2)
   - تتصل ببثّك على TikTok عبر TikTokLiveConnection
   - الهدايا / اللايكات / التعليقات الحقيقية تحرّك الدول في السباق
   - تعرض لوحة السباق على http://localhost:3000 (تُلتقط في OBS / TikTok Live Studio)

   ⚠️ الإصدار v2 يتطلب مفتاح توقيع (signApiKey) من https://www.eulerstream.com
      لأن TikTok تفرض توقيع الطلبات الآن.
   ==================================================================== */

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const COUNTRIES = require('./public/countries.json');

/* ---------- الإعدادات ---------- */
function loadConfig() {
  try { return require('./config.json'); } catch (e) { return {}; }
}
const config = Object.assign({
  tiktokUsername: process.env.TIKTOK_USERNAME || '',
  signApiKey: process.env.SIGN_API_KEY || '',
  port: Number(process.env.PORT) || 3000,
  commentBoost: 0.06,        // دفعة عند ذكر اسم دولة في تعليق
  likeBoost: 0.010,          // دفعة صغيرة عند كل لايك
  giftBoostBase: 0.10,       // دفعة أساسية لكل هدية
  giftBoostPerDiamond: 0.025,// دفعة إضافية لكل ماسة
  giftMap: {}                // اختياري: ربط اسم هدية بكود دولة
}, loadConfig());

/* ---------- الخادم + WebSocket ---------- */
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'countries', countries: COUNTRIES }));
});

/* ---------- مطابقة اسم الدولة ---------- */
function matchCountry(text) {
  if (!text) return null;
  const t = String(text).trim();
  for (const c of COUNTRIES) {
    if (t.includes(c.name) || t.includes(c.code) || (c.en && t.toLowerCase().includes(c.en.toLowerCase()))) return c;
  }
  for (const c of COUNTRIES) { if (t.includes(c.flag)) return c; }
  return null;
}

/* ---------- اتصال TikTok ---------- */
let tiktok = null;
function startTikTok(username, signApiKey) {
  if (!username) {
    console.log('⚠️  لم تُحدّد اسم مستخدم TikTok.');
    console.log('   أنشئ ملف config.json: { "tiktokUsername":"اسمك_بدون_@", "signApiKey":"مفتاحك" }');
    console.log('   أو:  TIKTOK_USERNAME=اسمك SIGN_API_KEY=مفتاحك npm start');
    return;
  }
  console.log(`🔁 جارٍ الاتصال ببث @${username} ...`);
  const opts = { enableExtendedGiftInfo: true };
  if (signApiKey) opts.signApiKey = signApiKey;
  tiktok = new TikTokLiveConnection(username, opts);

  tiktok.connect().then(state => {
    console.log(`✅ متصل بالبث المباشر (roomId: ${state.roomId})`);
    console.log('🎯 اللوحة جاهزة — اعرضها فوق بثّك الآن.');
  }).catch(err => {
    console.error(`❌ فشل الاتصال: ${(err && err.message) || err}`);
    if (!signApiKey) console.error('   💡 الإصدار الحالي يتطلب مفتاح توقيع signApiKey من https://www.eulerstream.com');
    console.error('   تأكد أنك «تبث مباشر الآن» وأن الاسم/المفتاح صحيحان. إعادة المحاولة خلال 30 ثانية...');
    setTimeout(() => startTikTok(username, signApiKey), 30000);
  });

  // عدد المشاهدين الحقيقي
  tiktok.on('roomUser', d => broadcast({ type: 'viewers', count: d.viewerCount }));

  // دخول مشاهد
  tiktok.on('member', d => broadcast({ type: 'join', nickname: (d.user && d.user.nickname) || 'مشاهد' }));

  // تعليق
  tiktok.on('chat', d => {
    const nick = (d.user && (d.user.nickname || d.user.uniqueId)) || 'مشاهد';
    broadcast({ type: 'comment', nickname: nick, text: d.comment || '' });
    const c = matchCountry(d.comment);
    if (c) broadcast({ type: 'boost', code: c.code, amount: config.commentBoost });
  });

  // لايك
  tiktok.on('like', d => {
    broadcast({ type: 'like', nickname: (d.user && d.user.nickname) || 'مشاهد' });
    broadcast({ type: 'boostRandom', amount: config.likeBoost });
  });

  // هدية (مع معالجة سلاسل الإرسال المتتالية)
  tiktok.on('gift', d => {
    const giftType = d.giftDetails && d.giftDetails.giftType;
    if (giftType === 1 && !d.repeatEnd) return; // السلسلة جارية — ننتظر النهاية

    const giftName = (d.extendedGiftInfo && (d.extendedGiftInfo.name))
                  || (d.giftDetails && d.giftDetails.giftName) || 'هدية';
    const diamonds = (d.extendedGiftInfo && (d.extendedGiftInfo.diamondCount || d.extendedGiftInfo.cost))
                  || (d.giftDetails && d.giftDetails.diamondCount) || 1;
    const repeat = d.repeatCount || 1;
    const nickname = (d.user && (d.user.nickname || d.user.uniqueId)) || 'مشاهد';

    broadcast({ type: 'gift', nickname, giftName, diamonds, repeat });

    const amt = (config.giftBoostBase + diamonds * config.giftBoostPerDiamond) * Math.max(1, Math.min(repeat, 10));
    let code = config.giftMap && config.giftMap[giftName];
    if (!code) { const c = matchCountry(nickname); code = c ? c.code : null; }
    if (code) broadcast({ type: 'boost', code, amount: amt });
    else broadcast({ type: 'boostRandom', amount: amt });
  });

  tiktok.on('streamEnd', () => { console.log('🛑 انتهى البث.'); broadcast({ type: 'streamEnd' }); });
  tiktok.on('disconnected', () => { console.log('🔌 انقطع الاتصال، إعادة المحاولة خلال 15 ثانية...'); setTimeout(() => startTikTok(username, signApiKey), 15000); });
  // مُهم: التقاط أخطاء EventEmitter حتى لا يتعطّل البرنامج
  tiktok.on('error', err => console.error('TikTok error:', (err && err.message) || err));
}

/* ---------- التشغيل ---------- */
server.listen(config.port, () => {
  console.log('');
  console.log('🏁🏁🏁  سباق الدول العربية — بث TikTok تفاعلي  🏁🏁🏁');
  console.log(`🌐 افتح لوحة السباق:  http://localhost:${config.port}`);
  console.log('   ثم أضفها كـ "التقاط نافذة/شاشة" في TikTok Live Studio أو OBS.');
  console.log('');
  startTikTok(config.tiktokUsername, config.signApiKey);
});
