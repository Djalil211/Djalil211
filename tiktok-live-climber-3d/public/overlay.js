/* ====================================================================
   رجل الطريق الخشبي — ثلاثي الأبعاد (Three.js) + بث TikTok + تحكم كيبورد
   ==================================================================== */
import * as THREE from './three.module.min.js';

const $=id=>document.getElementById(id);
const sceneEl=$("scene"), elViewers=$("viewer-count"), elKD=$("knockdowns"), elGifts=$("gifts");
const elProg=$("prog"), elDist=$("dist"), elChat=$("chat-layer"), elGift=$("gift-layer");
const elHeart=$("heart-layer"), elWinner=$("winner"), elStart=$("start"), elBegin=$("begin");
const elName=$("streamer-name"), elModeNote=$("mode-note"), cv=$("confetti"), cx=cv.getContext("2d");
const rnd=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)], clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const USERS=["ahmed","sara","khaled","nour","yassine","lina","omar","maya","riadh","amani","bilal","walid","farah"];
const PHRASES=["اسقطوه! 😂","طرحوه!","شاحنة عليه 🚚","go go","سيارة عليه 🚗","هديه 🎁","خخخ","لايك لايك","🍉"];

/* ===== الحالة ===== */
const S={ progress:0, x:0, falling:false, fallTimer:0, won:false, knockdowns:0, gifts:0,
  climbSpeed:0.020, rockKnockback:0.06, started:false, realMode:false };
const STEPS=28, STEP_H=2.4, STEP_D=2.8, HW=9, totalH=STEPS*STEP_H, totalD=STEPS*STEP_D;
const MOVE=15, FALL=22;
let obstacles=[], time=0, clock, trophy, trophyRing;

/* ===== Three.js ===== */
let renderer, scene, camera, climber;
function initThree(){
  renderer=new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(sceneEl.clientWidth, sceneEl.clientHeight);
  renderer.setClearColor(0x000000,0);
  sceneEl.appendChild(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(52, sceneEl.clientWidth/sceneEl.clientHeight, 0.1, 600);
  camera.position.set(8,8,22);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x402a18, 1.0));
  const sun=new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(10,30,20); scene.add(sun);
  buildStairs(); climber=makeClimber(); scene.add(climber);
  clock=new THREE.Clock();
  window.addEventListener("resize",onResize);
}
function onResize(){
  const w=sceneEl.clientWidth, h=sceneEl.clientHeight;
  renderer.setSize(w,h); camera.aspect=w/h; camera.updateProjectionMatrix();
}
function buildStairs(){
  const wood=new THREE.MeshLambertMaterial({color:0x8a5a2b});
  const dark=new THREE.MeshLambertMaterial({color:0x6b421f});
  for(let i=0;i<STEPS;i++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(HW*2, STEP_H, STEP_D), i%2?dark:wood);
    step.position.set(0, i*STEP_H+STEP_H/2, -i*STEP_D); scene.add(step);
  }
  const rail=new THREE.MeshLambertMaterial({color:0x4a2c12});
  for(const sx of [-HW,HW]){
    const r=new THREE.Mesh(new THREE.BoxGeometry(0.5,totalH,totalD+2),rail);
    r.position.set(sx,totalH/2,-totalD/2); scene.add(r);
  }
  const base=new THREE.Mesh(new THREE.CylinderGeometry(HW+1,HW+2,1.2,24),wood);
  base.position.set(0,-0.6,0); scene.add(base);
  trophy=new THREE.Mesh(new THREE.SphereGeometry(2.4,22,16),new THREE.MeshLambertMaterial({color:0xffd23f,emissive:0x553300}));
  trophy.position.set(0,totalH+3,-totalD); scene.add(trophy);
  trophyRing=new THREE.Mesh(new THREE.TorusGeometry(3.2,0.25,10,30),new THREE.MeshLambertMaterial({color:0xffd23f,emissive:0x332200}));
  trophyRing.position.set(0,totalH+3,-totalD); trophyRing.rotation.x=Math.PI/2; scene.add(trophyRing);
}
function makeClimber(){
  const g=new THREE.Group();
  const skin=new THREE.MeshLambertMaterial({color:0xf4c08a});
  const shirt=new THREE.MeshLambertMaterial({color:0xe74c3c});
  const dark=new THREE.MeshLambertMaterial({color:0x222222});
  const body=new THREE.Mesh(new THREE.SphereGeometry(1.05,22,16),shirt); body.scale.set(1.15,1.05,1.0); body.position.y=1.05; g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.56,18,14),skin); head.position.y=2.35; g.add(head);
  const eg=new THREE.SphereGeometry(0.08,8,8);
  const le=new THREE.Mesh(eg,dark); le.position.set(-0.18,2.42,0.5); g.add(le);
  const re=new THREE.Mesh(eg,dark); re.position.set(0.18,2.42,0.5); g.add(re);
  const ag=new THREE.CapsuleGeometry(0.16,0.7,4,8);
  const la=new THREE.Mesh(ag,skin); la.position.set(-1.1,1.25,0.3); la.rotation.z=0.5; g.add(la);
  const ra=new THREE.Mesh(ag,skin); ra.position.set(1.1,1.25,0.3); ra.rotation.z=-0.5; g.add(ra);
  const lg=new THREE.CapsuleGeometry(0.18,0.55,4,8);
  const ll=new THREE.Mesh(lg,dark); ll.position.set(-0.35,0.25,0.1); g.add(ll);
  const rl=new THREE.Mesh(lg,dark); rl.position.set(0.35,0.25,0.1); g.add(rl);
  g.userData={la,ra,ll,rl}; g.scale.set(1.1,1.1,1.1); return g;
}
function makeVehicle(type){
  const g=new THREE.Group();
  const col={car:0x2980b9,sports:0xe74c3c,truck:0x27ae60,motor:0x16a085}[type]||0x34495e;
  const bm=new THREE.MeshLambertMaterial({color:col});
  const wm=new THREE.MeshLambertMaterial({color:0x141414});
  const gm=new THREE.MeshLambertMaterial({color:0x223344});
  const box=(w,h,d,m,x,y,z)=>{const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);me.position.set(x,y,z);g.add(me);};
  const wgeo=new THREE.CylinderGeometry(0.45,0.45,0.3,14); wgeo.rotateZ(Math.PI/2);
  const wh=(x,z)=>{const w=new THREE.Mesh(wgeo,wm);w.position.set(x,-0.35,z);g.add(w);};
  if(type==="truck"){ box(2.2,1.5,2.0,bm,0,0.6,0); box(3.2,1.3,2.0,bm,-1.3,0.55,0); wh(1,1.1);wh(1,-1.1);wh(-1.4,1.1);wh(-1.4,-1.1); g.scale.setScalar(1.15); }
  else if(type==="sports"){ box(3.0,0.55,1.5,bm,0,0,0); box(1.5,0.5,1.3,gm,-0.2,0.4,0); wh(1,0.9);wh(1,-0.9);wh(-1,0.9);wh(-1,-0.9); }
  else if(type==="motor"){ box(1.5,0.5,0.5,bm,0,0.1,0); box(0.5,0.3,0.4,wm,-0.3,0.45,0); const mg=new THREE.CylinderGeometry(0.5,0.5,0.25,14);mg.rotateZ(Math.PI/2); [0.85,-0.85].forEach(x=>{const w=new THREE.Mesh(mg,wm);w.position.set(x,0,0);g.add(w);}); }
  else { box(2.7,0.8,1.4,bm,0,0.1,0); box(1.6,0.7,1.2,gm,-0.1,0.75,0); wh(0.9,0.85);wh(0.9,-0.85);wh(-0.9,0.85);wh(-0.9,-0.85); }
  return g;
}

/* ===== العوائق ===== */
function spawnObstacle(vtype,full,aimed){
  const cy=S.progress*totalH, cz=-S.progress*totalD;
  const g=makeVehicle(vtype);
  const x = (aimed && Math.random()<0.5) ? clamp(S.x+rnd(-1.5,1.5),-8,8) : rnd(-8,8);
  const z = cz + rnd(-1.5,1.5);
  g.position.set(x, cy+28, z); g.rotation.set(rnd(0,3),rnd(0,3),rnd(0,3));
  scene.add(g);
  obstacles.push({g,x,y:cy+28,z,full,checked:false});
}
function doHit(o){ if(o)scene.remove(o.g); S.knockdowns++; elKD.textContent=S.knockdowns; S.falling=true; S.fallTimer=0; shake(); }
function smallKnock(o){ if(o)scene.remove(o.g); S.progress=Math.max(0,S.progress-S.rockKnockback); shake(true); }
function shake(small){const st=document.querySelector(".stage");st.classList.remove("shake","shake-s");void st.offsetWidth;st.classList.add(small?"shake-s":"shake");}
const ss=document.createElement("style"); ss.textContent=".stage.shake{animation:shk .4s}.stage.shake-s{animation:shk .2s}@keyframes shk{0%,100%{transform:translate(0,0)}25%{transform:translate(-6px,3px)}50%{transform:translate(5px,-3px)}75%{transform:translate(-3px,2px)}}"; document.head.appendChild(ss);

function win(){ S.won=true; elWinner.classList.remove("hidden"); confetti(); setTimeout(()=>{elWinner.classList.add("hidden");S.won=false;S.progress=0;S.x=0;S.knockdowns=0;elKD.textContent=0;},6000); }

/* ===== مدخلات الكيبورد ===== */
const keys={};
const CTRL=["arrowleft","arrowright","arrowup","arrowdown","a","d","w","s"," "];
window.addEventListener("keydown",e=>{const k=e.key.toLowerCase(); if(CTRL.includes(k)){e.preventDefault();keys[k]=true;}});
window.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
window.addEventListener("blur",()=>{for(const k in keys)keys[k]=false;});
const isKey=(...a)=>a.some(k=>keys[k]);
function aiDodge(dt){
  const cy=S.progress*totalH; let threat=null,best=Infinity;
  for(const o of obstacles){ if(!o.checked && o.y>cy && o.y<cy+24){const d=Math.abs(o.x-S.x); if(d<best){best=d;threat=o;}} }
  const target=(threat && Math.abs(threat.x-S.x)<4)?(threat.x<S.x?8:-8):0;
  const dir=Math.sign(target-S.x)||0;
  return clamp(S.x+dir*MOVE*0.7*dt,-8,8);
}

/* ===== الحلقة ===== */
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(0.05, clock?clock.getDelta():0.016); time+=dt;
  const cy=S.progress*totalH, cz=-S.progress*totalD;
  if(S.started && !S.falling && !S.won){
    const left=isKey("arrowleft","a"), right=isKey("arrowright","d"), up=isKey("arrowup","w"), down=isKey("arrowdown","s");
    let mv=0; if(left)mv-=1; if(right)mv+=1;
    if(mv!==0) S.x=clamp(S.x+mv*MOVE*dt,-8,8);
    else if(!S.realMode) S.x=aiDodge(dt);
    let climb=S.climbSpeed; if(up)climb*=2.4; if(down)climb*=0.12;
    S.progress=clamp(S.progress+climb*dt,0,1);
    if(S.progress>=1) win();
  }
  // الرجل
  if(S.falling){
    S.fallTimer+=dt; climber.position.y-=dt*48; climber.rotation.z+=dt*10;
    if(S.fallTimer>=0.9){ S.falling=false; S.progress=0; S.x=0; climber.rotation.set(0,0,0); }
  } else {
    climber.position.set(S.x, cy+Math.sin(time*9)*0.13, cz);
    if(!S.won){const u=climber.userData,s=Math.sin(time*8); u.la.rotation.x=s*0.7; u.ra.rotation.x=-s*0.7; u.ll.rotation.x=-s*0.5; u.rl.rotation.x=s*0.5;}
  }
  // العوائق
  for(const o of obstacles){
    o.y-=FALL*dt; o.g.position.set(o.x,o.y,o.z); o.g.rotation.x+=dt*2.2; o.g.rotation.z+=dt*1.7;
    if(!o.checked && !S.falling && !S.won && o.y<=cy+2.2 && o.y>=cy-1 && Math.abs(o.x-S.x)<3 && Math.abs(o.z-cz)<3){ o.checked=true; (o.full?doHit:smallKnock)(o); }
  }
  obstacles=obstacles.filter(o=>{ if(o.y<cy-16){scene.remove(o.g);return false;} return true; });
  // كاميرا متتبعة
  const cp=new THREE.Vector3(S.x*0.2+8, cy+6, cz+20);
  camera.position.lerp(cp,0.06);
  camera.lookAt(S.x*0.35, cy+2, cz);
  // trophy spin
  if(trophy)trophy.rotation.y+=dt*0.8;
  if(trophyRing)trophyRing.rotation.z+=dt;
  elProg.style.width=(S.progress*100)+"%"; elDist.textContent="للقمة: "+Math.round((1-S.progress)*100)+"%";
  if(renderer) renderer.render(scene,camera);
}

/* ===== عناصر عائمة ===== */
function spawnHeart(e){const h=document.createElement("div");h.className="heart";h.textContent=e||pick(["❤️","💖","🔥","✨","👍"]);h.style.left=rnd(0,34)+"px";h.style.setProperty("--dx",rnd(-36,36)+"px");h.style.animationDuration=rnd(2.4,4)+"s";h.style.fontSize=rnd(18,28)+"px";elHeart.appendChild(h);setTimeout(()=>h.remove(),4200);}
function spawnChat(nick,text){const m=document.createElement("div");m.className="chat-msg";m.innerHTML=`<b>${nick}</b> ${text}`;elChat.appendChild(m);while(elChat.children.length>5)elChat.firstChild.remove();setTimeout(()=>m.remove(),6500);}
function giftPopup(nick,gift,emoji){const p=document.createElement("div");p.className="gift-pop";p.innerHTML=`<span class="emoji">${emoji}</span>${nick}<br><span style="font-weight:600">أرسل ${gift}</span>`;elGift.appendChild(p);setTimeout(()=>p.remove(),2700);}
function vtypeFromEmoji(e){return {"🏍️":"motor","🚗":"car","🏎️":"sports","🚚":"truck","🚛":"truck"}[e]||"car";}
let parts=[];
function confetti(){cv.width=innerWidth;cv.height=innerHeight;parts=[];const c=["#22e7ff","#ff2d95","#ffd23f","#7a1bff","#00ff9d","#fff"];for(let i=0;i<180;i++)parts.push({x:cv.width/2,y:cv.height/3,vx:rnd(-8,8),vy:rnd(-13,3),g:rnd(.2,.4),s:rnd(7,13),c:pick(c),rot:rnd(0,6.3),vr:rnd(-.4,.4),life:1});dConf();}
function dConf(){cx.clearRect(0,0,cv.width,cv.height);let a=false;parts.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.life-=.005;if(p.life>0&&p.y<cv.height+20){a=true;cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.fillStyle=p.c;cx.globalAlpha=Math.max(0,p.life);cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.5);cx.restore();}});if(a)requestAnimationFrame(dConf);else cx.clearRect(0,0,cv.width,cv.height);}

/* ===== الأحداث (حقيقية / محاكاة) ===== */
function handle(d){
  switch(d.type){
    case "ready": if(d.climbSpeed)S.climbSpeed=d.climbSpeed; if(d.rockKnockback)S.rockKnockback=d.rockKnockback; break;
    case "viewers": elViewers.textContent=(d.count||0).toLocaleString("en-US"); break;
    case "join": if(S.started)spawnChat("🚪",`${d.nickname} انضم`); break;
    case "comment": if(S.started)spawnChat(d.nickname,d.text); break;
    case "rock": if(S.started){spawnObstacle("car",false,false); spawnHeart("👍");} break;
    case "fall": if(!S.started)break; S.gifts++; elGifts.textContent=S.gifts; giftPopup(d.nickname,d.giftName||d.vname,d.vehicle); spawnObstacle(vtypeFromEmoji(d.vehicle),true,true); for(let i=0;i<3;i++)spawnHeart("💎"); break;
    case "streamEnd": elViewers.textContent="انتهى"; break;
  }
}
let simRunning=false, simTimers=[];
function startSim(){
  if(simRunning)return; simRunning=true;
  simTimers.push(setInterval(()=>handle({type:"viewers",count:600+Math.floor(Math.random()*3500)}),1600));
  (function cl(){simTimers.push(setTimeout(()=>{handle({type:"comment",nickname:"@"+pick(USERS),text:pick(PHRASES)});cl();},rnd(1200,2600)));})();
  (function rl(){simTimers.push(setTimeout(()=>{handle({type:"rock",nickname:"@"+pick(USERS)});rl();},rnd(1600,3200)));})();
  (function gl(){simTimers.push(setTimeout(()=>{const v=pick([["🏍️","دراجة"],["🚗","سيارة"],["🏎️","سيارة رياضية"],["🚚","شاحنة"]]);handle({type:"fall",vehicle:v[0],vname:v[1],giftName:v[1],nickname:"@"+pick(USERS)});gl();},rnd(2200,4200)));})();
}
function stopSim(){simRunning=false;simTimers.forEach(t=>clearTimeout(t));simTimers=[];}
function connectOrSim(){
  if(location.protocol==="file:"){S.realMode=false;elModeNote.textContent="🤖 وضع معاينة (محاكاة هدايا) — تحكم بالأسهم/WASD";startSim();return;}
  const ws=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}`);
  ws.onopen=()=>{S.realMode=true;elModeNote.textContent="✅ متصل بـ TikTok — تحكم بالأسهم/WASD للتفادي";stopSim();};
  ws.onmessage=ev=>handle(JSON.parse(ev.data));
  ws.onclose=()=>{setTimeout(()=>{if(!S.realMode)startSim();connectOrSim();},3000);};
  ws.onerror=()=>{};
  setTimeout(()=>{if(!S.realMode&&!simRunning){elModeNote.textContent="🤖 وضع معاينة (محاكاة)";startSim();}},1500);
}

/* ===== أزرار ===== */
elBegin.addEventListener("click",()=>{
  const nm=(elName.value||new URLSearchParams(location.search).get("name")||"").trim();
  $("brand-name").textContent=nm?("🧗 "+nm):"🧗 رجل الطريق الخشبي 3D";
  elStart.classList.add("hidden"); S.started=true; S.x=0; connectOrSim();
});
$("bg-toggle").addEventListener("click",()=>document.body.classList.toggle("solid"));
$("reset").addEventListener("click",()=>{S.won=false;S.falling=false;S.progress=0;S.x=0;S.knockdowns=0;elKD.textContent=0;climber.rotation.set(0,0,0);elWinner.classList.add("hidden");});
if(new URLSearchParams(location.search).get("solid")==="1")document.body.classList.add("solid");
if(new URLSearchParams(location.search).get("name"))elName.value=new URLSearchParams(location.search).get("name");

/* ===== انطلاق ===== */
initThree(); animate(); elModeNote.textContent="🎬 جاهز — اضغط ابدأ";
