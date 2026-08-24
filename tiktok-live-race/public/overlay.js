/* ====================================================================
   لوحة سباق الدول — مدفوعة بأحداث TikTok الحقيقية عبر WebSocket
   + شاشة اختيار الدول قبل البدء + سيارات بأعلام الدول
   ==================================================================== */
"use strict";

const elLanes = document.getElementById("lanes");
const elChat = document.getElementById("chat-layer");
const elGift = document.getElementById("gift-layer");
const elHeart = document.getElementById("heart-layer");
const elViewers = document.getElementById("viewer-count");
const elWinner = document.getElementById("winner");
const elWinnerFlag = document.getElementById("winner-flag");
const elWinnerName = document.getElementById("winner-name");
const elSetup = document.getElementById("setup");
const elChips = document.getElementById("chips");
const elSelCount = document.getElementById("sel-count");
const elStart = document.getElementById("start-race");
const cv = document.getElementById("confetti");
const cx = cv.getContext("2d");

let COUNTRIES = [];
const state = { lanes: [], raceOver: false, last: 0, racing: false };
let selected = new Set();        // أكواد الدول المختارة

// إعدادات البث من رابط URL (مثال: ?name=اسمك&solid=1)
const params = new URLSearchParams(location.search);
const nameInput = document.getElementById("streamer-name");
if(params.get("name")) nameInput.value = params.get("name");
if(params.get("solid") === "1") document.body.classList.add("solid");

const rnd = (a,b)=>a+Math.random()*(b-a);
const pick = a=>a[Math.floor(Math.random()*a.length)];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle = a=>{const r=a.slice();for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;};

/* مجموعات الاختيار السريع */
const GROUPS = {
  all:    ()=> COUNTRIES.map(c=>c.code),
  none:   ()=> [],
  gulf:   ()=> ["SA","AE","QA","KW","BH","OM","YE"],
  maghreb:()=> ["MR","MA","DZ","TN","LY","EH"],
  levant: ()=> ["SY","LB","JO","PS","IQ","EG","SD"],
  random12: ()=> shuffle(COUNTRIES.map(c=>c.code)).slice(0,12),
};
const DEFAULT_SEL = ["DZ","MA","TN","EG","SA","AE","QA","KW","BH","OM","IQ","LB"];

function resizeCanvas(){cv.width=innerWidth;cv.height=innerHeight;}
window.addEventListener("resize",()=>{resizeCanvas();measure();});
resizeCanvas();

/* ---------- شاشة اختيار الدول ---------- */
function renderChips(){
  elChips.innerHTML = "";
  COUNTRIES.forEach(c=>{
    const chip = document.createElement("button");
    chip.className = "chip" + (selected.has(c.code) ? " on" : "");
    chip.innerHTML = `<span class="chip-flag">${c.flag}</span><span class="chip-name">${c.name}</span>`;
    chip.addEventListener("click", ()=>{
      if(selected.has(c.code)) selected.delete(c.code); else selected.add(c.code);
      chip.classList.toggle("on");
      updateCount();
    });
    elChips.appendChild(chip);
  });
  updateCount();
}
function updateCount(){
  elSelCount.textContent = selected.size;
  elStart.disabled = selected.size < 2;
}
document.querySelectorAll(".qbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const codes = (GROUPS[btn.dataset.q] || (()=>[]))();
    if(btn.dataset.q === "none"){ selected.clear(); }
    else { selected = new Set(codes); }
    renderChips();
  });
});
elStart.addEventListener("click", startRace);

/* ---------- بناء المضمار ---------- */
function selectedCountries(){ return COUNTRIES.filter(c=>selected.has(c.code)); }

function buildLanes(){
  elLanes.innerHTML = "";
  state.lanes = [];
  const list = shuffle(selectedCountries());
  list.forEach(c=>{
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.style.setProperty("--lane-c1",c.c1);
    lane.style.setProperty("--lane-c2",c.c2);
    lane.innerHTML = `
      <div class="lane-track"></div>
      <div class="pos-bar"></div>
      <div class="racer">
        <div class="carwrap"><span class="cf">${c.flag}</span><span class="car">🏎️</span></div>
        <div class="name">${c.name}</div>
      </div>
      <div class="rank-badge"></div>`;
    elLanes.appendChild(lane);
    state.lanes.push({
      c, lane,
      racer: lane.querySelector(".racer"),
      bar: lane.querySelector(".pos-bar"),
      rank: lane.querySelector(".rank-badge"),
      pos:0, iv:0, hype:Math.random()*0.3, maxX:0
    });
  });
  measure();
}
function measure(){ state.lanes.forEach(l=>{ l.maxX = Math.max(60, l.lane.clientWidth - 136); }); }

/* ---------- الدفع ---------- */
function boostByCode(code, amount){ const l=state.lanes.find(x=>x.c.code===code); if(l) applyBoost(l,amount); }
function boostRandom(amount){ if(state.lanes.length) applyBoost(pick(state.lanes),amount); }
function applyBoost(l, amount){
  l.iv = clamp(l.iv + amount, 0, 0.6);
  l.hype = clamp(l.hype + amount*0.6, 0, 1);
  l.racer.classList.remove("boost"); void l.racer.offsetWidth; l.racer.classList.add("boost");
}

/* ---------- العناصر العائمة ---------- */
function spawnHeart(emoji){
  const h=document.createElement("div"); h.className="heart";
  h.textContent = emoji || pick(["❤️","💖","👍","🔥","✨","⭐"]);
  h.style.left = rnd(0,36)+"px"; h.style.setProperty("--dx", rnd(-40,40)+"px");
  h.style.animationDuration = rnd(2.6,4.4)+"s"; h.style.fontSize = rnd(20,30)+"px";
  elHeart.appendChild(h); setTimeout(()=>h.remove(),4800);
}
function spawnComment(nick,text){
  const m=document.createElement("div"); m.className="chat-msg";
  m.innerHTML=`<b>${nick}</b> ${text}`;
  elChat.appendChild(m);
  while(elChat.children.length>5) elChat.firstChild.remove();
  setTimeout(()=>m.remove(),6800);
}
function spawnGift(nick,gift,diamonds,repeat){
  const p=document.createElement("div"); p.className="gift-pop";
  p.innerHTML=`<span class="emoji">${giftIcon(gift)}</span>${nick}<br><span style="font-weight:600">أرسل ${gift}</span><div class="coins">💎 ${diamonds*repeat}</div>`;
  elGift.appendChild(p); setTimeout(()=>p.remove(),2700);
}
function giftIcon(name){
  const n=(name||"").toLowerCase();
  if(n.includes("rose")||n.includes("ورد")) return "🌹";
  if(n.includes("lion")||n.includes("أسد")||n.includes("اسد")) return "🦁";
  if(n.includes("galaxy")||n.includes("universe")||n.includes("كون")) return "🌌";
  if(n.includes("crown")||n.includes("تاج")) return "👑";
  if(n.includes("heart")||n.includes("قلب")) return "💖";
  if(n.includes("rocket")||n.includes("صاروخ")) return "🚀";
  if(n.includes("fire")||n.includes("نار")) return "🔥";
  return "🎁";
}

/* ---------- حلقة السباق ---------- */
const MEDALS=["🥇","🥈","🥉"];
function loop(t){
  const dt = Math.min(0.05, (t-state.last)/1000 || 0);
  state.last = t;
  state.lanes.forEach(l=>{
    l.iv *= Math.exp(-dt/0.9);
    const crowd = 0.010 + l.hype*0.012;
    l.pos = clamp(l.pos + (crowd + l.iv)*dt, 0, 1);
    l.racer.style.transform = `translate(${l.pos*l.maxX}px,-50%)`;
    l.bar.style.width = (l.pos*100)+"%";
  });
  const order = state.lanes.slice().sort((a,b)=>b.pos-a.pos);
  order.forEach((l,i)=>{ l.rank.textContent = i<3?MEDALS[i]:(i+1); });
  if(!state.raceOver){
    for(const l of order){ if(l.pos>=1){ finish(l); break; } }
  }
  requestAnimationFrame(loop);
}

function finish(winner){
  state.raceOver = true;
  elWinnerFlag.textContent = winner.c.flag + " 🏆";
  elWinnerName.textContent = winner.c.name;
  elWinner.classList.remove("hidden");
  confetti();
  setTimeout(()=>{ elWinner.classList.add("hidden"); restartRace(); }, 9000);
}

/* ---------- كونفيتي ---------- */
let parts=[];
function confetti(){
  parts=[]; const colors=["#22e7ff","#ff2d95","#ffd23f","#7a1bff","#00ff9d","#fff"];
  for(let i=0;i<200;i++) parts.push({x:cv.width/2,y:cv.height/3,vx:rnd(-9,9),vy:rnd(-15,4),g:rnd(.2,.45),s:rnd(7,14),c:pick(colors),rot:rnd(0,6.28),vr:rnd(-.4,.4),life:1});
  drawConfetti();
}
function drawConfetti(){
  cx.clearRect(0,0,cv.width,cv.height); let alive=false;
  parts.forEach(p=>{
    p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; p.life-=.005;
    if(p.life>0 && p.y<cv.height+20){ alive=true;
      cx.save(); cx.translate(p.x,p.y); cx.rotate(p.rot);
      cx.fillStyle=p.c; cx.globalAlpha=Math.max(0,p.life);
      cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.5); cx.restore();
    }
  });
  if(alive) requestAnimationFrame(drawConfetti); else cx.clearRect(0,0,cv.width,cv.height);
}

/* ---------- بدء / إعادة / تغيير ---------- */
function startRace(){
  if(selected.size < 2) return;
  const nm = (nameInput.value || params.get("name") || "").trim();
  document.getElementById("brand-name").textContent = nm ? ("🏁 " + nm) : "🏁 سباق الدول";
  elSetup.classList.add("hidden");
  state.raceOver=false; state.racing=true;
  cx.clearRect(0,0,cv.width,cv.height);
  buildLanes();
  state.last=performance.now();
  requestAnimationFrame(loop);
}
function restartRace(){
  if(!state.racing) return;
  state.raceOver=false; cx.clearRect(0,0,cv.width,cv.height);
  buildLanes(); state.last=performance.now();
}
document.getElementById("reset").addEventListener("click", restartRace);
document.getElementById("change").addEventListener("click", ()=>{
  state.racing=false; state.raceOver=true;
  elWinner.classList.add("hidden");
  elLanes.innerHTML="";
  elSetup.classList.remove("hidden");
});
document.getElementById("bg-toggle").addEventListener("click", ()=>{
  document.body.classList.toggle("solid");
});

/* ---------- WebSocket (أحداث TikTok الحقيقية) ---------- */
function connect(){
  const proto = location.protocol==="https:"?"wss":"ws";
  const ws = new WebSocket(`${proto}://${location.host}`);
  ws.onmessage = ev=>{
    const d = JSON.parse(ev.data);
    switch(d.type){
      case "countries":
        COUNTRIES = d.countries;
        selected = new Set(DEFAULT_SEL.filter(code=>COUNTRIES.some(c=>c.code===code)));
        renderChips();
        break;
      case "viewers":   elViewers.textContent = (d.count||0).toLocaleString("en-US"); break;
      case "comment":   if(state.racing) spawnComment(d.nickname, d.text); break;
      case "like":      if(state.racing) spawnHeart("❤️"); break;
      case "join":      if(state.racing) spawnComment("🚪", `${d.nickname} انضم`); break;
      case "gift":      if(state.racing){ spawnGift(d.nickname, d.giftName, d.diamonds, d.repeat); for(let i=0;i<Math.min(d.repeat||1,8);i++) spawnHeart("💎"); } break;
      case "boost":        if(state.racing) boostByCode(d.code, d.amount); break;
      case "boostRandom":  if(state.racing) boostRandom(d.amount); break;
      case "streamEnd": elViewers.textContent = "انتهى البث"; break;
    }
  };
  ws.onclose = ()=> setTimeout(connect, 2000);
  ws.onerror = ()=>{};
}
connect();
