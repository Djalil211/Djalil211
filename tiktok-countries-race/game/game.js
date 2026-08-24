/* ====================================================================
   سباق الدول العربية — بث مباشر (نسخة قابلة للعب + شاشة اختيار الدول)
   ==================================================================== */
"use strict";

/* ---------- بيانات الدول العربية (23 دولة) ---------- */
const COUNTRIES = [
  {code:"DZ",name:"الجزائر",flag:"🇩🇿",c1:"#006233",c2:"#d21034",cheer:"يا الجزائر 🔥"},
  {code:"MA",name:"المغرب",flag:"🇲🇦",c1:"#c1272d",c2:"#006233",cheer:"أسود الأطلس 🦁"},
  {code:"TN",name:"تونس",flag:"🇹🇳",c1:"#e70013",c2:"#cfcfcf",cheer:"نسور قرطاج 🦅"},
  {code:"LY",name:"ليبيا",flag:"🇱🇾",c1:"#222",c2:"#239e46",cheer:"ليبيا للأمام"},
  {code:"EH",name:"الصحراء الغربية",flag:"🇪🇭",c1:"#111",c2:"#c8102e",cheer:"الصحراء"},
  {code:"MR",name:"موريتانيا",flag:"🇲🇷",c1:"#00a651",c2:"#c8102e",cheer:"موريتانيا"},
  {code:"EG",name:"مصر",flag:"🇪🇬",c1:"#d21034",c2:"#111",cheer:"يا فراعنة 👑"},
  {code:"SD",name:"السودان",flag:"🇸🇩",c1:"#d21034",c2:"#007a3d",cheer:"سودان القوة"},
  {code:"SA",name:"السعودية",flag:"🇸🇦",c1:"#006c35",c2:"#014d24",cheer:"الصقور الخضر"},
  {code:"AE",name:"الإمارات",flag:"🇦🇪",c1:"#d7282f",c2:"#00732f",cheer:"الإمارات قوية"},
  {code:"QA",name:"قطر",flag:"🇶🇦",c1:"#8a1538",c2:"#5a0f2c",cheer:"عنابي قطر"},
  {code:"KW",name:"الكويت",flag:"🇰🇼",c1:"#007a3d",c2:"#ce1126",cheer:"أزرق الكويت"},
  {code:"BH",name:"البحرين",flag:"🇧🇭",c1:"#c8102e",c2:"#ececec",cheer:"بحرين الحبيبة"},
  {code:"OM",name:"عُمان",flag:"🇴🇲",c1:"#c8102e",c2:"#00884c",cheer:"عُمان الأصيلة"},
  {code:"YE",name:"اليمن",flag:"🇾🇪",c1:"#ce1126",c2:"#111",cheer:"يا يمن الصمود"},
  {code:"IQ",name:"العراق",flag:"🇮🇶",c1:"#cf0921",c2:"#007227",cheer:"رافدان العراق"},
  {code:"SY",name:"سوريا",flag:"🇸🇾",c1:"#ce1126",c2:"#007a3d",cheer:"سوريا الأسد"},
  {code:"JO",name:"الأردن",flag:"🇯🇴",c1:"#ce1126",c2:"#007a3d",cheer:"الأردن أولاً"},
  {code:"LB",name:"لبنان",flag:"🇱🇧",c1:"#ed1c24",c2:"#d9d9d9",cheer:"أرز لبنان 🌲"},
  {code:"PS",name:"فلسطين",flag:"🇵🇸",c1:"#e4312b",c2:"#007a3d",cheer:"فلسطين حرة 🇵🇸"},
  {code:"SO",name:"الصومال",flag:"🇸🇴",c1:"#4189dd",c2:"#dfeaff",cheer:"الصومال"},
  {code:"DJ",name:"جيبوتي",flag:"🇩🇯",c1:"#6ab2e8",c2:"#12ad2b",cheer:"جيبوتي"},
  {code:"KM",name:"جزر القمر",flag:"🇰🇲",c1:"#ffc400",c2:"#007a3d",cheer:"القمر"},
];

/* ---------- مجموعات الاختيار السريع ---------- */
const GROUPS = {
  all:    ()=> COUNTRIES.map(c=>c.code),
  none:   ()=> [],
  gulf:   ()=> ["SA","AE","QA","KW","BH","OM","YE"],
  maghreb:()=> ["MR","MA","DZ","TN","LY","EH"],
  levant: ()=> ["SY","LB","JO","PS","IQ","EG","SD"],
  random12:()=> shuffle(COUNTRIES.map(c=>c.code)).slice(0,12),
};
const DEFAULT_SEL = ["DZ","MA","TN","EG","SA","AE","QA","KW","BH","OM","IQ","LB"];

/* ---------- جمهور محاكى ---------- */
const USERS = ["ahmed","sara_dz","khaled","nour","yassine","lina","omar","maya","user8372",
  "riadh","amani","bilal","hadjer","ziad","rim","salma","mounir","ines","walid","farah",
  "karim","dalila","amine","souad","reda","noussa"];
const PHRASES = ["هيا 🔥","أبطال 💪","go go go","للأمام 👇","بطل 🏆","قوية والله","يا بطل",
  "نتمنى الفوز","🎉🎉","نيران","لن نتنازل","مين راح يفوز؟","💯","عاشت ايديك","اللهم النصر","✨✨"];
const GIFTS = [{e:"🌹",n:"وردة"},{e:"💎",n:"ماسة"},{e:"🦁",n:"أسد"},{e:"🏆",n:"كأس"},
  {e:"👑",n:"تاج"},{e:"🚀",n:"صاروخ"},{e:"🎉",n:"حفلة"},{e:"🔥",n:"نار"}];
const MEDALS = ["🥇","🥈","🥉"];

/* ---------- حالة اللعبة ---------- */
const state = { lanes:[], raceOver:false, racing:false, last:0,
  viewers:1200+Math.floor(Math.random()*4000),
  chatTimer:0, giftTimer:6, viewerTimer:0, hypeTimer:0,
  audio:null, soundOn:true };
let selected = new Set();

/* ---------- DOM ---------- */
const elLanes = document.getElementById("lanes");
const elChat = document.getElementById("chat-layer");
const elGift = document.getElementById("gift-layer");
const elHeart = document.getElementById("heart-layer");
const elViewers = document.getElementById("viewer-count");
const elStatus = document.getElementById("race-status");
const elSetup = document.getElementById("setup");
const elChips = document.getElementById("chips");
const elSelCount = document.getElementById("sel-count");
const elStart = document.getElementById("start-race");
const cv = document.getElementById("confetti");
const cx = cv.getContext("2d");

const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function shuffle(a){const r=a.slice();for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}

/* ---------- شاشة اختيار الدول ---------- */
function renderChips(){
  elChips.innerHTML="";
  COUNTRIES.forEach(c=>{
    const chip=document.createElement("button");
    chip.className="chip"+(selected.has(c.code)?" on":"");
    chip.innerHTML=`<span class="chip-flag">${c.flag}</span><span class="chip-name">${c.name}</span>`;
    chip.addEventListener("click",()=>{
      if(selected.has(c.code)) selected.delete(c.code); else selected.add(c.code);
      chip.classList.toggle("on"); updateCount();
    });
    elChips.appendChild(chip);
  });
  updateCount();
}
function updateCount(){ elSelCount.textContent=selected.size; elStart.disabled=selected.size<2; }
document.querySelectorAll(".qbtn").forEach(b=>{
  b.addEventListener("click",()=>{
    if(b.dataset.q==="none") selected.clear();
    else selected=new Set((GROUPS[b.dataset.q]||(()=>[]))());
    renderChips();
  });
});
elStart.addEventListener("click",startRace);

/* ---------- بناء المضمار ---------- */
function selectedCountries(){ return COUNTRIES.filter(c=>selected.has(c.code)); }
function buildLanes(){
  elLanes.innerHTML=""; state.lanes=[];
  shuffle(selectedCountries()).forEach(c=>{
    const lane=document.createElement("div");
    lane.className="lane";
    lane.style.setProperty("--lane-c1",c.c1);
    lane.style.setProperty("--lane-c2",c.c2);
    lane.innerHTML=`
      <div class="lane-track"></div>
      <div class="pos-bar"></div>
      <div class="racer"><div class="carwrap"><span class="cf">${c.flag}</span><span class="car">🏎️</span></div><div class="name">${c.name}</div></div>
      <div class="rank-badge"></div>
      <button class="boost-btn" aria-label="دفع ${c.name}">＋</button>`;
    elLanes.appendChild(lane);
    const obj={c,lane,
      racer:lane.querySelector(".racer"), bar:lane.querySelector(".pos-bar"),
      rank:lane.querySelector(".rank-badge"), btn:lane.querySelector(".boost-btn"),
      pos:0, iv:0, hype:Math.random()*0.4, maxX:0};
    obj.btn.addEventListener("pointerdown",e=>{e.preventDefault();boost(obj,true);});
    state.lanes.push(obj);
  });
  measure();
}
function measure(){ state.lanes.forEach(l=>{ l.maxX=Math.max(40,l.lane.clientWidth-78); }); }
window.addEventListener("resize",measure);
window.addEventListener("orientationchange",()=>setTimeout(measure,300));

/* ---------- الدفع ---------- */
function boost(l, fromPlayer){
  if(state.raceOver) return;
  l.iv+=fromPlayer?0.16:rnd(0.04,0.11); l.iv=clamp(l.iv,0,0.55);
  l.hype=clamp(l.hype+(fromPlayer?0.12:0.04),0,1);
  l.racer.classList.remove("boost"); void l.racer.offsetWidth; l.racer.classList.add("boost");
  spawnHeart(l.c.flag);
  if(fromPlayer){ sfx("tap"); if(Math.random()<0.5) spawnChat(l.c,"@"+pick(USERS)); }
}

/* ---------- جمهور البث ---------- */
function audienceTick(dt){
  state.chatTimer-=dt; state.giftTimer-=dt; state.hypeTimer-=dt;
  if(state.chatTimer<=0){
    state.chatTimer=rnd(0.7,2.0);
    const l=pick(state.lanes);
    spawnChat(l.c, "@"+pick(USERS)+": "+(Math.random()<0.6?l.c.cheer:pick(PHRASES)));
  }
  if(state.giftTimer<=0){ state.giftTimer=rnd(7,15); spawnGift(); sfx("gift"); }
  if(state.hypeTimer<=0){
    state.hypeTimer=rnd(0.25,0.6);
    state.lanes.forEach(l=>{ l.hype=clamp(l.hype+rnd(-0.12,0.16),0.05,1); });
    const n=1+Math.floor(Math.random()*3);
    for(let i=0;i<n;i++) boost(pick(state.lanes),false);
  }
}
function spawnHeart(emoji){
  const h=document.createElement("div"); h.className="heart";
  h.textContent=Math.random()<0.5?emoji:pick(["❤️","💖","🔥","✨","👍","⭐"]);
  h.style.left=rnd(0,28)+"px"; h.style.setProperty("--drift",rnd(-30,30)+"px");
  h.style.animationDuration=rnd(2.5,4.2)+"s"; h.style.fontSize=rnd(15,26)+"px";
  elHeart.appendChild(h); setTimeout(()=>h.remove(),4500);
}
function spawnChat(c,text){
  const m=document.createElement("div"); m.className="chat-msg";
  m.innerHTML=`<b>${c.flag}</b> ${text}`;
  elChat.appendChild(m);
  while(elChat.children.length>6) elChat.firstChild.remove();
  setTimeout(()=>m.remove(),6000);
}
function spawnGift(){
  const g=pick(GIFTS), u=pick(USERS);
  const pop=document.createElement("div"); pop.className="gift-pop";
  pop.innerHTML=`<span class="emoji">${g.e}</span>@${u} أرسل ${g.n}`;
  elGift.appendChild(pop); setTimeout(()=>pop.remove(),2500);
}
function tickViewers(dt){
  state.viewerTimer-=dt;
  if(state.viewerTimer<=0){
    state.viewerTimer=rnd(0.6,1.4);
    state.viewers=Math.max(500,state.viewers+Math.floor(rnd(-2,8)));
    elViewers.textContent=state.viewers.toLocaleString("en-US");
  }
}

/* ---------- حلقة اللعبة ---------- */
function loop(t){
  if(!state.racing) return;
  const dt=Math.min(0.05,(t-state.last)/1000||0); state.last=t;
  audienceTick(dt); tickViewers(dt);
  state.lanes.forEach(l=>{
    l.iv*=Math.exp(-dt/0.9);
    const crowd=0.018+l.hype*0.030;
    l.pos=clamp(l.pos+(crowd+l.iv)*dt,0,1);
    const px=l.pos*l.maxX;
    l.racer.style.transform=`translate(${px}px,-50%)`;
    l.bar.style.width=(l.pos*100)+"%";
  });
  const order=state.lanes.slice().sort((a,b)=>b.pos-a.pos);
  order.forEach((l,i)=>{
    l.rank.textContent=i<3?MEDALS[i]:(i+1);
    l.rank.style.background=i===0?"rgba(255,210,63,.9)":"rgba(0,0,0,.5)";
    l.rank.style.color=i===0?"#3a2a00":"var(--neon-g)";
  });
  if(!state.raceOver){ for(const l of order){ if(l.pos>=1){ finish(l); break; } } }
  requestAnimationFrame(loop);
}

function finish(winner){
  state.raceOver=true;
  elStatus.textContent="انتهى السباق! 🏆";
  document.getElementById("winner-flag").textContent=winner.c.flag;
  document.getElementById("winner-name").textContent=winner.c.name;
  document.getElementById("winner-modal").classList.remove("hidden");
  confetti(); sfx("win");
}

/* ---------- كونفيتي ---------- */
let confettiParts=[];
function confetti(){
  resizeCanvas(); confettiParts=[];
  const colors=["#22e7ff","#ff2d95","#ffd23f","#7a1bff","#00ff9d","#fff"];
  for(let i=0;i<160;i++) confettiParts.push({x:cv.width/2,y:cv.height/3,vx:rnd(-7,7),vy:rnd(-12,3),
    g:rnd(.18,.4),s:rnd(6,12),c:pick(colors),rot:rnd(0,6.28),vr:rnd(-.3,.3),life:1});
  drawConfetti();
}
function drawConfetti(){
  cx.clearRect(0,0,cv.width,cv.height); let alive=false;
  confettiParts.forEach(p=>{
    p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr; p.life-=.006;
    if(p.life>0 && p.y<cv.height+20){ alive=true;
      cx.save(); cx.translate(p.x,p.y); cx.rotate(p.rot);
      cx.fillStyle=p.c; cx.globalAlpha=Math.max(0,p.life);
      cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.5); cx.restore();
    }
  });
  if(alive) requestAnimationFrame(drawConfetti); else cx.clearRect(0,0,cv.width,cv.height);
}
function resizeCanvas(){cv.width=innerWidth;cv.height=innerHeight;}
window.addEventListener("resize",resizeCanvas); resizeCanvas();

/* ---------- الصوت ---------- */
function ensureAudio(){ if(!state.audio){ try{state.audio=new(window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(state.audio&&state.audio.state==="suspended") state.audio.resume(); }
function sfx(type){
  if(!state.soundOn) return; ensureAudio(); const a=state.audio; if(!a) return; const t=a.currentTime;
  const beep=(f,d,vol=0.15,delay=0,t2="sine")=>{const o=a.createOscillator(),g=a.createGain();
    o.type=t2;o.frequency.value=f;o.connect(g);g.connect(a.destination);
    g.gain.setValueAtTime(0,t+delay);g.gain.linearRampToValueAtTime(vol,t+delay+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+delay+d);o.start(t+delay);o.stop(t+delay+d+0.02);};
  if(type==="tap") beep(rnd(520,720),0.12,0.10);
  else if(type==="gift"){beep(880,0.1,0.10);beep(1320,0.16,0.08,0.08);}
  else if(type==="win"){[523,659,784,1046].forEach((f,i)=>beep(f,0.3,0.16,i*0.12,"triangle"));}
}

/* ---------- أزرار التحكم ---------- */
document.getElementById("restart").addEventListener("click",startRace);
document.getElementById("play-again").addEventListener("click",startRace);
document.getElementById("rush").addEventListener("click",()=>{
  if(state.raceOver||!state.racing) return;
  state.lanes.forEach(l=>boost(l,true));
  elStatus.textContent="⚡ تسريع جماعي!";
  setTimeout(()=>{if(!state.raceOver)elStatus.textContent="اضغط على سيارة أي دولة لدفعها نحو خط النهاية!";},1400);
});
document.getElementById("sound-toggle").addEventListener("click",e=>{
  state.soundOn=!state.soundOn; e.currentTarget.textContent=state.soundOn?"🔊":"🔇"; if(state.soundOn) sfx("tap");
});
document.getElementById("share-btn").addEventListener("click",async()=>{
  const data={title:"سباق الدول العربية",text:"شجّع دولتك في سباق الدول! 🏁",url:location.href};
  try{ if(navigator.share) await navigator.share(data); else throw 1; }
  catch{ elStatus.textContent="انسخ الرابط وشاركه 📋"; setTimeout(()=>elStatus.textContent="اضغط على سيارة أي دولة لدفعها نحو خط النهاية!",1800); }
});
document.getElementById("change").addEventListener("click",()=>{
  state.racing=false; state.raceOver=true;
  document.getElementById("winner-modal").classList.add("hidden");
  elLanes.innerHTML="";
  elSetup.classList.remove("hidden");
});

/* ---------- بدء سباق ---------- */
function startRace(){
  if(selected.size<2) return;
  state.raceOver=false; state.racing=true;
  document.getElementById("winner-modal").classList.add("hidden");
  cx.clearRect(0,0,cv.width,cv.height);
  elStatus.textContent="اضغط على سيارة أي دولة لدفعها نحو خط النهاية!";
  elChat.innerHTML="";
  elSetup.classList.add("hidden");
  buildLanes();
  state.last=performance.now();
  requestAnimationFrame(loop);
}

/* ---------- PWA ---------- */
if("serviceWorker" in navigator){ window.addEventListener("load",()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); }); }

/* ---------- التهيئة ---------- */
selected = new Set(DEFAULT_SEL);
renderChips();
