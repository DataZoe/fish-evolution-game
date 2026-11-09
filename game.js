'use strict';
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  const $ = (id) => document.getElementById(id);
  const stageEl = $('stageName'), eatenEl = $('eatenValue'), scoreEl = $('scoreValue');
  const energyEl = $('energyValue'), energyFill = $('energyFill'), noticeEl = $('notice');
  const stages = [
    { name: 'Fry', at: 0, r: 22, speed: 3.2, color: '#91efff', accent: '#e8ffff' },
    { name: 'Reefling', at: 80, r: 31, speed: 3.45, color: '#ffac72', accent: '#ffe6ad' },
    { name: 'Reef Hunter', at: 190, r: 43, speed: 3.7, color: '#f47754', accent: '#ffe6ad' },
    { name: 'Deep Guardian', at: 360, r: 58, speed: 3.9, color: '#895bc7', accent: '#d9c4ff' },
    { name: 'Apex', at: 620, r: 76, speed: 4.1, color: '#edca59', accent: '#fff2ac' },
  ];
  const world = { w: 2400, h: 1650 };
  const player = { x: 1200, y: 825, vx: 0, vy: 0, r: 22, stage: 0, angle: 0 };
  const state = { w: 0, h: 0, cx: 0, cy: 0, energy: 0, score: 0, eaten: 0, last: 0, prey: [], predators: [], bubbles: [], boosts: [], boostCooldown: 9, boostUntil: 0, boss: null, bossCooldown: 35, pointer: null };
  const keys = Object.create(null);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    state.w = r.width; state.h = r.height; canvas.width = Math.round(r.width*dpr); canvas.height = Math.round(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function fish(pred = false) {
    const palette = pred ? ['#d96356','#b95d76','#6675ca'] : ['#7df0c0','#78d6ff','#ffd46e','#ff90ae','#c4a4ff'];
    return { x: rand(45,world.w-45), y: rand(45,world.h-45), vx: rand(-.8,.8), vy: rand(-.7,.7), r: pred?rand(30,55):rand(9,21), color: palette[Math.floor(Math.random()*palette.length)], accent: pred?'#ffd4bc':'#f0ffff', pred };
  }
  function seed() {
    state.prey = Array.from({length:42},()=>fish()); state.predators = Array.from({length:8},()=>fish(true));
    state.bubbles = Array.from({length:32},()=>({x:rand(0,world.w),y:rand(0,world.h),r:rand(3,12),speed:rand(.25,.9),a:rand(.12,.42)}));
    state.boosts = [];
  }
  function toast(text) { if (!noticeEl) return; noticeEl.textContent=text; noticeEl.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>noticeEl.classList.remove('show'),2200); }
  function hud() {
    let idx=0; stages.forEach((s,i)=>{if(state.energy>=s.at)idx=i;}); player.stage=idx;
    player.r += (stages[idx].r-player.r)*.12;
    if(stageEl)stageEl.textContent=stages[idx].name;
    if(scoreEl)scoreEl.textContent=state.score;
    if(eatenEl)eatenEl.textContent=state.eaten;
    const next=stages[idx+1], pct=next?clamp((state.energy-stages[idx].at)/(next.at-stages[idx].at)*100,0,100):100;
    if(energyEl)energyEl.textContent=`${Math.round(pct)}%`; if(energyFill)energyFill.style.width=`${pct}%`;
  }
  function reset() {
    if(!confirm('Start over? Your stage, score, and fish-eaten count will reset.'))return;
    state.energy=state.score=state.eaten=0; state.boostUntil=0; state.boostCooldown=9; state.boss=null; state.bossCooldown=35;
    player.x=1200; player.y=825; player.vx=player.vy=0; player.r=stages[0].r; player.stage=0; player.angle=0; state.pointer=null;
    seed(); hud(); toast('New run started');
  }
  function steer(dt, now) {
    let x=0,y=0; if(keys.ArrowRight||keys.d)x++; if(keys.ArrowLeft||keys.a)x--; if(keys.ArrowDown||keys.s)y++; if(keys.ArrowUp||keys.w)y--;
    if(state.pointer){const dx=state.cx+state.pointer.x-player.x,dy=state.cy+state.pointer.y-player.y,d=Math.hypot(dx,dy);if(d>12){x+=dx/d;y+=dy/d;}}
    const n=Math.hypot(x,y); if(n){x/=n;y/=n;const multiplier=now<state.boostUntil?1.85:1;const speed=stages[player.stage].speed*multiplier;player.vx+=(x*speed-player.vx)*Math.min(1,.16*dt);player.vy+=(y*speed-player.vy)*Math.min(1,.16*dt);player.angle=Math.atan2(y,x);} else {player.vx*=Math.pow(.9,dt);player.vy*=Math.pow(.9,dt);}
    player.x=clamp(player.x+player.vx*dt,18,world.w-18);player.y=clamp(player.y+player.vy*dt,18,world.h-18);if(Math.hypot(player.vx,player.vy)>.15)player.angle=Math.atan2(player.vy,player.vx);
  }
  function move(f,dt,flee=false){if(flee){const dx=f.x-player.x,dy=f.y-player.y,d=Math.hypot(dx,dy);if(d<220&&d>0){f.vx+=dx/d*.035*dt;f.vy+=dy/d*.035*dt;}}const n=Math.hypot(f.vx,f.vy),max=f.pred?1.15:.8;if(n>max){f.vx=f.vx/n*max;f.vy=f.vy/n*max;}f.x+=f.vx*dt;f.y+=f.vy*dt;if(f.x<25||f.x>world.w-25)f.vx*=-1;if(f.y<25||f.y>world.h-25)f.vy*=-1;f.x=clamp(f.x,25,world.w-25);f.y=clamp(f.y,25,world.h-25);}
  function spawnBoost(){
    // Spawn in the current camera view so the pickup is discoverable immediately.
    const x=clamp(state.cx+rand(90,Math.max(100,state.w-90)),30,world.w-30);
    const y=clamp(state.cy+rand(120,Math.max(130,state.h-100)),30,world.h-30);
    state.boosts.push({x,y,r:20,phase:rand(0,Math.PI*2),life:20}); state.boostCooldown=rand(18,30);
  }
  function pickups(dt,now){
    state.boostCooldown-=dt/60;
    if(state.boostCooldown<=0 && state.boosts.length<1)spawnBoost();
    state.boosts=state.boosts.filter((b)=>b.life>0); state.boosts.forEach((b)=>{b.life-=dt/60;b.phase+=.06*dt;if(Math.hypot(b.x-player.x,b.y-player.y)<player.r+b.r){state.boostUntil=now+6500;state.boosts=state.boosts.filter(x=>x!==b);toast('Speed boost! Faster swimming for 6.5 seconds');}});
  }
  function collide(now){
    state.prey.forEach(f=>{if(Math.hypot(f.x-player.x,f.y-player.y)<player.r*.7+f.r*.7&&player.r>f.r*1.08){state.energy+=16+f.r*.8;state.score++;state.eaten++;Object.assign(f,fish());}});
    state.predators.forEach(f=>{const dx=f.x-player.x,dy=f.y-player.y,d=Math.hypot(dx,dy);if(d<player.r*.72+f.r*.7){if(player.r>f.r*1.12){state.energy+=32;state.score+=5;state.eaten++;Object.assign(f,fish(true));}else if(now>state.invulnerableUntil){player.vx-=dx/(d||1)*1.2;player.vy-=dy/(d||1)*1.2;state.energy=Math.max(0,state.energy-8);state.invulnerableUntil=now+700;}}});
  }
  function drawFish(f,isPlayer=false){const s=isPlayer?stages[player.stage]:null,r=isPlayer?player.r:f.r,a=isPlayer?player.angle:Math.atan2(f.vy,f.vx||1);ctx.save();ctx.translate(f.x-state.cx,f.y-state.cy);ctx.rotate(a);const body=isPlayer?s.color:f.color,fin=isPlayer?s.accent:f.accent;
    ctx.fillStyle=fin;ctx.beginPath();ctx.moveTo(-r*.82,0);ctx.quadraticCurveTo(-r*1.62,-r*.84,-r*2.08,-r*.7);ctx.quadraticCurveTo(-r*1.84,0,-r*2.08,r*.7);ctx.quadraticCurveTo(-r*1.48,r*.72,-r*.82,0);ctx.fill();
    ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-r,0);ctx.quadraticCurveTo(-r*.78,-r*.76,r*.48,-r*.63);ctx.quadraticCurveTo(r*1.12,-r*.52,r*1.24,0);ctx.quadraticCurveTo(r*1.1,r*.58,r*.4,r*.66);ctx.quadraticCurveTo(-r*.78,r*.75,-r,0);ctx.fill();
    ctx.fillStyle=fin;ctx.beginPath();ctx.moveTo(-r*.35,-r*.52);ctx.quadraticCurveTo(r*.08,-r*1.28,r*.62,-r*.58);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(-r*.12,r*.52);ctx.quadraticCurveTo(r*.32,r*1.08,r*.72,r*.52);ctx.closePath();ctx.fill();
    if(isPlayer&&s.name==='Apex'){ctx.strokeStyle='#fff1aa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r*1.15,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#14253a';ctx.beginPath();ctx.arc(r*.76,-r*.13,Math.max(2,r*.095),0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawBoost(b,now){const x=b.x-state.cx,y=b.y-state.cy,pulse=Math.sin(b.phase)*3;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(b.phase)*.12);ctx.shadowColor='#ffe46b';ctx.shadowBlur=22;ctx.fillStyle='rgba(255,221,92,.22)';ctx.beginPath();ctx.arc(0,0,b.r+6+pulse,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ffd84f';ctx.strokeStyle='#fff5b0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 25px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⚡',0,1);ctx.restore();}
  function render(now){ctx.clearRect(0,0,state.w,state.h);const g=ctx.createLinearGradient(0,0,0,state.h);g.addColorStop(0,'#56c6d6');g.addColorStop(.42,'#1689a7');g.addColorStop(1,'#07506d');ctx.fillStyle=g;ctx.fillRect(0,0,state.w,state.h);
    state.bubbles.forEach(b=>{const x=b.x-state.cx,y=b.y-state.cy;if(x>-20&&x<state.w+20&&y>-20&&y<state.h+20){ctx.beginPath();ctx.strokeStyle=`rgba(226,255,255,${b.a})`;ctx.arc(x,y,b.r,0,Math.PI*2);ctx.stroke();}});
    state.prey.forEach(f=>drawFish(f));state.predators.forEach(f=>drawFish(f));state.boosts.forEach(b=>drawBoost(b,now));drawFish(player,true);
    if(now<state.boostUntil){ctx.save();ctx.fillStyle='#fff1a8';ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.fillText(`⚡ SPEED ${Math.max(1,Math.ceil((state.boostUntil-now)/1000))}s`,state.w/2,80);ctx.restore();}
  }
  function tick(now){const dt=state.last?clamp((now-state.last)/16.67,0,2.5):1;state.last=now;steer(dt,now);state.prey.forEach(f=>move(f,dt,true));state.predators.forEach(f=>move(f,dt));collide(now);pickups(dt,now);state.bubbles.forEach(b=>{b.y-=b.speed*dt;if(b.y<0){b.y=world.h;b.x=rand(0,world.w);}});state.cx=clamp(player.x-state.w/2,0,world.w-state.w);state.cy=clamp(player.y-state.h/2,0,world.h-state.h);hud();render(now);requestAnimationFrame(tick);}
  function pos(e){const r=canvas.getBoundingClientRect();state.pointer={x:e.clientX-r.left,y:e.clientY-r.top};}
  canvas.addEventListener('pointerdown',e=>{pos(e);if(canvas.setPointerCapture)canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')pos(e);});canvas.addEventListener('pointerup',()=>{state.pointer=null;});canvas.addEventListener('pointercancel',()=>{state.pointer=null;});
  $('rebirthButton')?.addEventListener('click',reset);
  addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();keys[k]=true;});addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;keys[k]=false;});addEventListener('blur',()=>{Object.keys(keys).forEach(k=>keys[k]=false);state.pointer=null;});addEventListener('resize',resize);
  resize();seed();hud();requestAnimationFrame(tick);
})();
