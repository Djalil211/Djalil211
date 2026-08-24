/* ====================================================================
   رجل الطريق الخشبي — مدفوعة بأحداث TikTok + تحكم بالكيبورد للتفادي
   ==================================================================== */
"use strict";

const scene=document.getElementById("scene");
const pathEl=scene.querySelector(".path");
const climber=document.getElementById("climber");
const vehiclesEl=document.getElementById("vehicles");
const elViewers=document.getElementById("viewer-count");
const elKD=document.getElementById("knockdowns");
const elGifts=document.getElementById("gifts");
const elProg=document.getElementById("prog");
const elDist=document.getElementById("dist");
const elChat=document.getElementById("chat-layer");
const elGift=document.getElementById("gift-layer");
const elHeart=document.getElementById("heart-layer");
const elWinner=document.getElementById("winner");
const elStart=document.getElementById("start");
const elBegin=document.getElementById("begin");
const elName=document.getElementById("streamer-name");
const elModeNote=document.getElementById("mode-note");
const cv=document.getElementById("confetti"); const cx=cv.getContext("2d");

const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const USERS=["ahmed","sara","khaled","nour","yassine","lina","omar","maya","riadh","amani","bilal","hadjer","walid","farah"];
const PHRASES=["اسقطوه! 😂","طرحوه!","لا وصل! 🔥","go go","شاحنة عليه 🚚","هديه هدية!","🍉","خخخ","لايك لايك","سيارة عليه 🚗"];

/* الحالة */
const S={ progress:0, x:300, climbing:false, falling:false, won:false, knockdowns:0, gifts:0,
  climbSpeed:0.022, rockKnockback:0.07, viewers:0, realMode:false, started:false };
let playW=520, sceneW=800, sceneH=500, pathLeft=140, fallSpeed=500, moveSpeed=500;
const climberH=96;
let obstacles=[];
const keys={};

/* ===== القياس ===== */
function measure(){
  const r=scene.getBoundingClientRect();
  sceneW=r.width; sceneH=r.height;
  playW=Math.min(sceneW-24,560);
  pathEl.style.setProperty("--pw",playW+"px");
  pathLeft=(sceneW-playW)/2;
  fallSpeed=sceneH*0.95;
  moveSpeed=playW*1.0;
  S.x=clamp(S.x,30,playW-30);
}
window.addEventListener("resize",()=>{measure();placeClimber();});
function climberTopY(){ return sceneH - S.progress*(sceneH-climberH-90) - climberH; }
function placeClimber(){
  climber.style.left=(pathLeft+S.x)+"px";
  climber.style.bottom=(S.progress*(sceneH-climberH-90))+"px";
}

/* ===== شاشة البداية ===== */
elBegin.addEventListener("click",()=>{
  const nm=(elName.value||new URLSearchParams(location.search).get("name")||"").trim();
  document.getElementById("brand-name").textContent= nm?("🧗 "+nm):"🧗 رجل الطريق الخشبي";
  elStart.classList.add("hidden");
  S.started=true; S.climbing=true; climber.classList.add("climbing");
  measure(); S.x=playW/2; placeClimber();
  connectOrSim();
  requestAnimationFrame(loop);
});
if(new URLSearchParams(location.search).get("solid")==="1") document.body.classList.add("solid");
if(new URLSearchParams(location.search).get("name")) elName.value=new URLSearchParams(location.search).get("name");
document.getElementById("bg-toggle").addEventListener("click",()=>document.body.classList.toggle("solid"));
document.getElementById("reset").addEventListener("click",()=>{ S.won=false;S.falling=false;S.progress=0;S.x=playW/2;S.knockdowns=0;elKD.textContent=0;elWinner.classList.add("hidden");climber.classList.add("climbing"); });

/* ===== لوحة المفاتيح (الأسهم + WASD) ===== */
const CTRL=["arrowleft","arrowright","arrowup","arrowdown","a","d","w","s"," "];
window.addEventListener("keydown",e=>{const k=e.key.toLowerCase(); if(CTRL.includes(k)){e.preventDefault();keys[k]=true;}});
window.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
window.addEventListener("blur",()=>{for(const k in keys)keys[k]=false;});
function isKey(...arr){return arr.some(k=>keys[k]);}

/* ===== ذكاء التفادي (للمعاينة/المحاكاة فقط) ===== */
function aiDodge(dt){
  const cy=climberTopY();
  let threat=null,best=Infinity;
  obstacles.forEach(o=>{ if(!o.checked && o.y<cy){const d=Math.abs(o.x-S.x); if(d<best){best=d;threat=o;}} });
  let target;
  if(threat && Math.abs(threat.x-S.x)<72){ target = threat.x<S.x ? playW-30 : 30; }
  else target=playW/2;
  const dir=Math.sign(target-S.x)||0;
  return clamp(S.x+dir*moveSpeed*0.7*dt,30,playW-30);
}

/* ===== توليد العوائق ===== */
function spawnObstacle(emoji,full,aimed){
  const el=document.createElement("div"); el.className="vehicle"+(full?" spin":""); el.textContent=emoji;
  el.style.top="0px";
  let xv;
  if(aimed && Math.random()<0.55) xv=clamp(S.x+rnd(-26,26),30,playW-30);
  else xv=rnd(30,playW-30);
  el.style.left=(pathLeft+xv)+"px";
  vehiclesEl.appendChild(el);
  obstacles.push({el,x:xv,y:0,full,checked:false});
}

/* ===== الاصطدام ===== */
function doHit(o){
  if(o){o.checked=true;o.el.remove();}
  S.knockdowns++; elKD.textContent=S.knockdowns;
  S.falling=true; S.climbing=false;
  climber.classList.remove("climbing"); climber.classList.add("falling");
  shake();
  setTimeout(()=>{ climber.classList.remove("falling"); S.progress=0; S.x=playW/2; S.falling=false; S.climbing=true; climber.classList.add("climbing"); placeClimber(); },900);
}
function smallKnock(o){
  if(o){o.checked=true;o.el.remove();}
  S.progress=Math.max(0,S.progress-S.rockKnockback);
  shake(true);
}
function shake(small){ const st=document.querySelector(".stage"); st.classList.remove("shake","shake-s"); void st.offsetWidth; st.classList.add(small?"shake-s":"shake"); }
// (animation classes added via CSS below at runtime if needed)
const stEl=document.querySelector(".stage");
const shakeStyle=document.createElement("style");
shakeStyle.textContent=".stage.shake{animation:shk .4s}.stage.shake-s{animation:shk .2s}@keyframes shk{0%,100%{transform:translate(0,0)}25%{transform:translate(-6px,3px)}50%{transform:translate(5px,-3px)}75%{transform:translate(-3px,2px)}}";
document.head.appendChild(shakeStyle);

/* ===== الفوز ===== */
function win(){
  S.won=true; S.climbing=false; climber.classList.remove("climbing");
  elWinner.classList.remove("hidden"); confetti();
  setTimeout(()=>{ elWinner.classList.add("hidden"); S.won=false; S.progress=0; S.x=playW/2; S.knockdowns=0; elKD.textContent=0; climber.classList.add("climbing"); },6000);
}

/* ===== الحلقة ===== */
let last=0;
function loop(t){
  if(!S.started){requestAnimationFrame(loop);return;}
  const dt=Math.min(0.05,(t-last)/1000||0); last=t;
  const left=isKey("arrowleft","a"), right=isKey("arrowright","d"), up=isKey("arrowup","w"), down=isKey("arrowdown","s");

  if(!S.falling && !S.won){
    let mv=0; if(left)mv-=1; if(right)mv+=1;
    if(mv!==0) S.x=clamp(S.x+mv*moveSpeed*dt,30,playW-30);
    else if(!S.realMode) S.x=aiDodge(dt);            // مساعد تلقائي في المعاينة فقط
    let climb=S.climbSpeed; if(up)climb*=2.4; if(down)climb*=0.12;
    S.progress=clamp(S.progress+climb*dt,0,1);
    if(S.progress>=1) win();
  }

  // تحريك العوائق للأسفل + فحص الاصطدام
  const cy=climberTopY();
  obstacles.forEach(o=>{
    o.y+=fallSpeed*dt; o.el.style.top=o.y+"px";
    if(!o.checked && !S.falling && !S.won && o.y>=cy-14 && o.y<=cy+climberH){
      if(Math.abs(o.x-S.x)<52){ (o.full?doHit:smallKnock)(o); }
    }
  });
  obstacles=obstacles.filter(o=>{ if(o.y>sceneH+70){o.el.remove();return false;} return true; });

  placeClimber();
  elProg.style.width=(S.progress*100)+"%";
  elDist.textContent="للقمة: "+Math.round((1-S.progress)*100)+"%";
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ===== عناصر عائمة ===== */
function spawnHeart(e){const h=document.createElement("div");h.className="heart";h.textContent=e||pick(["❤️","💖","🔥","✨","👍"]);h.style.left=rnd(0,34)+"px";h.style.setProperty("--dx",rnd(-36,36)+"px");h.style.animationDuration=rnd(2.4,4)+"s";h.style.fontSize=rnd(18,28)+"px";elHeart.appendChild(h);setTimeout(()=>h.remove(),4200);}
function spawnChat(nick,text){const m=document.createElement("div");m.className="chat-msg";m.innerHTML=`<b>${nick}</b> ${text}`;elChat.appendChild(m);while(elChat.children.length>5)elChat.firstChild.remove();setTimeout(()=>m.remove(),6500);}
function giftPopup(nick,gift,emoji){const p=document.createElement("div");p.className="gift-pop";p.innerHTML=`<span class="emoji">${emoji}</span>${nick}<br><span style="font-weight:600">أرسل ${gift}</span>`;elGift.appendChild(p);setTimeout(()=>p.remove(),2700);}

/* ===== كونفيتي ===== */
let parts=[];
function confetti(){cv.width=innerWidth;cv.height=innerHeight;parts=[];const c=["#22e7ff","#ff2d95","#ffd23f","#7a1bff","#00ff9d","#fff"];for(let i=0;i<180;i++)parts.push({x:cv.width/2,y:cv.height/3,vx:rnd(-8,8),vy:rnd(-13,3),g:rnd(.2,.4),s:rnd(7,13),c:pick(c),rot:rnd(0,6.3),vr:rnd(-.4,.4),life:1});dConf();}
function dConf(){cx.clearRect(0,0,cv.width,cv.height);let a=false;parts.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.life-=.005;if(p.life>0&&p.y<cv.height+20){a=true;cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.c;cx.globalAlpha=Math.max(0,p.life);cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.5);cx.restore();}});if(a)requestAnimationFrame(dConf);else cx.clearRect(0,0,cv.width,cv.height);}

/* ===== معالجة الأحداث (حقيقية أو محاكاة) ===== */
function handle(d){
  switch(d.type){
    case "ready": if(d.climbSpeed)S.climbSpeed=d.climbSpeed; if(d.rockKnockback)S.rockKnockback=d.rockKnockback; break;
    case "viewers": S.viewers=d.count||0; elViewers.textContent=S.viewers.toLocaleString("en-US"); break;
    case "join": if(S.started)spawnChat("🚪",`${d.nickname} انضم`); break;
    case "comment": if(S.started)spawnChat(d.nickname,d.text); break;
    case "rock": if(S.started){spawnObstacle("🪨",false,false); spawnHeart("👍");} break;
    case "fall":
      if(!S.started)break;
      S.gifts++; elGifts.textContent=S.gifts;
      giftPopup(d.nickname,d.giftName||d.vname,d.vehicle);
      spawnObstacle(d.vehicle,true,true);
      for(let i=0;i<3;i++)spawnHeart("💎");
      break;
    case "streamEnd": elViewers.textContent="انتهى"; break;
  }
}

/* ===== الاتصال الحقيقي / المحاكاة ===== */
let simRunning=false; let simTimers=[];
function connectOrSim(){
  if(location.protocol==="file:"){ S.realMode=false; elModeNote.textContent="🤖 وضع معاينة (محاكاة هدايا) — للبث الحقيقي شغّل الأداة على كمبيوتر"; startSim(); return; }
  const ws=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}`);
  ws.onopen=()=>{ S.realMode=true; elModeNote.textContent="✅ متصل بـ TikTok — التحكم بالأسهم/WASD للتفادي"; stopSim(); };
  ws.onmessage=ev=>handle(JSON.parse(ev.data));
  ws.onclose=()=>{ setTimeout(()=>{ if(!S.realMode)startSim(); connectOrSim(); },3000); };
  ws.onerror=()=>{};
  setTimeout(()=>{ if(!S.realMode && !simRunning){ elModeNote.textContent="🤖 وضع معاينة (محاكاة)"; startSim(); } },1500);
}
function startSim(){
  if(simRunning)return; simRunning=true;
  simTimers.push(setInterval(()=>handle({type:"viewers",count:600+Math.floor(Math.random()*3500)}),1600));
  (function chatLoop(){ simTimers.push(setTimeout(()=>{handle({type:"comment",nickname:"@"+pick(USERS),text:pick(PHRASES)});chatLoop();},rnd(1200,2600))); })();
  (function rockLoop(){ simTimers.push(setTimeout(()=>{handle({type:"rock",nickname:"@"+pick(USERS)});rockLoop();},rnd(1500,3000))); })();
  (function giftLoop(){ simTimers.push(setTimeout(()=>{ const v=pick([["🏍️","دراجة"],["🚗","سيارة"],["🏎️","سيارة رياضية"],["🚚","شاحنة"]]); handle({type:"fall",vehicle:v[0],vname:v[1],giftName:v[1],nickname:"@"+pick(USERS)}); giftLoop(); },rnd(2200,4200))); })();
}
function stopSim(){ simRunning=false; simTimers.forEach(t=>clearTimeout(t)); simTimers=[]; }

measure();
