/* ====================================================================
   رجل سمين على الطريق الخشبي — أداة بث TikTok تفاعلية (tiktok-live-connector v2)
   - رجل يصعد الطريق الخشبي تلقائياً نحو القمة.
   - كل هدية حقيقية → مركبة (دراجة/سيارة/سيارة رياضية/شاحنة) تسقط عليه وتعيده للصفر
     أو تُسقطه في الهاوية.
   - اللايك → حجر صغير يبطئه قليلاً.
   - بدون هدايا → يصل للقمة ويفوز 🏆
   ==================================================================== */

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection } = require('tiktok-live-connector');

function loadConfig() { try { return require('./config.json'); } catch (e) { return {}; } }
const config = Object.assign({
  tiktokUsername: process.env.TIKTOK_USERNAME || '',
  signApiKey: process.env.SIGN_API_KEY || '',
  port: Number(process.env.PORT) || 3000,
  climbSpeed: 0.022,            // سرعة الصعود (نسبة في الثانية) — ~45 ثانية للقمة بلا هدايا
  rockKnockback: 0.04,         // تأخير اللايك (حجر صغير)
  giftMap: {}                  // اختياري: ربط اسم هدية بنوع مركبة
}, loadConfig());

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}
wss.on('connection', ws => { ws.send(JSON.stringify({ type:'ready', climbSpeed: config.climbSpeed, rockKnockback: config.rockKnockback })); });

/* نوع المركبة حسب قيمة الهدية (الماس) */
function vehicleFor(diamonds) {
  if (diamonds >= 99) return { e:'🚛', n:'قطار شاحنات' };
  if (diamonds >= 34) return { e:'🚚', n:'شاحنة' };
  if (diamonds >= 10) return { e:'🏎️', n:'سيارة رياضية' };
  if (diamonds >= 3)  return { e:'🚗', n:'سيارة' };
  return { e:'🏍️', n:'دراجة' };
}

let tiktok = null;
function startTikTok(username, signApiKey) {
  if (!username) {
    console.log('⚠️  لم تُحدّد اسم مستخدم TikTok. أنشئ config.json: { "tiktokUsername":"اسمك", "signApiKey":"مفتاحك" }');
    return;
  }
  console.log(`🔁 الاتصال ببث @${username} ...`);
  const opts = { enableExtendedGiftInfo: true };
  if (signApiKey) opts.signApiKey = signApiKey;
  tiktok = new TikTokLiveConnection(username, opts);

  tiktok.connect().then(state => {
    console.log(`✅ متصل بالبث (roomId: ${state.roomId}) — اعرض اللعبة فوق بثّك الآن.`);
  }).catch(err => {
    console.error(`❌ فشل الاتصال: ${(err && err.message) || err}`);
    if (!signApiKey) console.error('   💡 يتطلب مفتاح signApiKey من https://www.eulerstream.com (باقة مجانية)');
    console.error('   تأكد أنك تبث مباشر الآن. إعادة المحاولة خلال 30 ثانية...');
    setTimeout(() => startTikTok(username, signApiKey), 30000);
  });

  tiktok.on('roomUser', d => broadcast({ type:'viewers', count: d.viewerCount }));
  tiktok.on('member',   d => broadcast({ type:'join', nickname: (d.user && d.user.nickname) || 'مشاهد' }));
  tiktok.on('chat',     d => broadcast({ type:'comment', nickname: (d.user && (d.user.nickname||d.user.uniqueId)) || 'مشاهد', text: d.comment || '' }));
  tiktok.on('like',     d => broadcast({ type:'rock', nickname: (d.user && d.user.nickname) || 'مشاهد' }));

  tiktok.on('gift', d => {
    const giftType = d.giftDetails && d.giftDetails.giftType;
    if (giftType === 1 && !d.repeatEnd) return; // انتظار نهاية السلسلة
    const giftName = (d.extendedGiftInfo && d.extendedGiftInfo.name) || (d.giftDetails && d.giftDetails.giftName) || 'هدية';
    const diamonds = (d.extendedGiftInfo && (d.extendedGiftInfo.diamondCount || d.extendedGiftInfo.cost)) || (d.giftDetails && d.giftDetails.diamondCount) || 1;
    const repeat = d.repeatCount || 1;
    const nickname = (d.user && (d.user.nickname || d.user.uniqueId)) || 'مشاهد';
    // نوع المركبة: من giftMap إن وُجد، وإلا حسب قيمة الماس
    let veh = config.giftMap && config.giftMap[giftName];
    let vehicle, vname;
    if (veh) { vehicle = veh.e; vname = veh.n; }
    else { const v = vehicleFor(diamonds); vehicle = v.e; vname = v.n; }
    broadcast({ type:'fall', vehicle, vname, nickname, giftName, diamonds, repeat });
  });

  tiktok.on('streamEnd', () => broadcast({ type:'streamEnd' }));
  tiktok.on('disconnected', () => { console.log('🔌 انقطع الاتصال، إعادة المحاولة...'); setTimeout(() => startTikTok(username, signApiKey), 15000); });
  tiktok.on('error', err => console.error('TikTok error:', (err && err.message) || err));
}

server.listen(config.port, () => {
  console.log('\n🧗🪵  رجل على الطريق الخشبي — بث TikTok تفاعلي  🪵🧗');
  console.log(`🌐 افتح اللعبة: http://localhost:${config.port}`);
  console.log('   أضفها كـ Browser Source / التقاط نافذة في TikTok Live Studio أو OBS.\n');
  startTikTok(config.tiktokUsername, config.signApiKey);
});
