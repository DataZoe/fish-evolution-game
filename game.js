'use strict';

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas && canvas.getContext('2d');
  const stageNameEl = document.getElementById('stageName');
  const scoreValueEl = document.getElementById('scoreValue');
  const eatenValueEl = document.getElementById('eatenValue');
  const energyValueEl = document.getElementById('energyValue');
  const energyFillEl = document.getElementById('energyFill');
  const bossAlertEl = document.getElementById('bossAlert');
  if (!canvas || !ctx) return;

  const world = { width: 2400, height: 1650 };
  const stages = [
    { name: 'Fry', threshold: 0, radius: 22, speed: 3.2, color: '#91efff', accent: '#e8ffff', kind: 0 },
    { name: 'Reefling', threshold: 80, radius: 31, speed: 3.45, color: '#ffac72', accent: '#ffe6ad', kind: 1 },
    { name: 'Reef Hunter', threshold: 190, radius: 43, speed: 3.7, color: '#f47754', accent: '#ffe6ad', kind: 2 },
    { name: 'Deep Guardian', threshold: 360, radius: 58, speed: 3.9, color: '#895bc7', accent: '#d9c4ff', kind: 3 },
    { name: 'Apex', threshold: 620, radius: 76, speed: 4.1, color: '#edca59', accent: '#fff2ac', kind: 4 },
  ];
  const keys = Object.create(null);
  const player = { x: world.width / 2, y: world.height / 2, vx: 0, vy: 0, radius: 22, stage: 0, angle: 0 };
  const state = {
    score: 0, eaten: 0, energy: 0, cameraX: 0, cameraY: 0, width: 0, height: 0, lastTime: 0,
    prey: [], predators: [], bubbles: [], pointerDown: false, pointerX: 0, pointerY: 0,
    boss: null, bossCooldown: 18, bossBannerUntil: 0, lastDamage: 0, invulnerableUntil: 0,
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const random = (min, max) => min + Math.random() * (max - min);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = rect.width; state.height = rect.height;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function makeFish(predator = false) {
    const radius = predator ? random(30, 55) : random(9, 21);
    const colors = predator ? ['#d96356', '#b95d76', '#6675ca'] : ['#7df0c0', '#78d6ff', '#ffd46e', '#ff90ae', '#c4a4ff'];
    return { x: random(45, world.width - 45), y: random(45, world.height - 45), vx: random(-1, 1), vy: random(-0.75, 0.75), radius, color: colors[Math.floor(Math.random() * colors.length)], accent: predator ? '#ffd4bc' : '#f0ffff', predator };
  }
  function seedWorld() {
    state.prey = Array.from({ length: 42 }, () => makeFish());
    state.predators = Array.from({ length: 8 }, () => makeFish(true));
    state.bubbles = Array.from({ length: 32 }, () => ({ x: random(0, world.width), y: random(0, world.height), r: random(3, 12), speed: random(0.25, 0.9), alpha: random(0.12, 0.42) }));
  }
  function updateHud() {
    const stage = stages[player.stage];
    if (stageNameEl) stageNameEl.textContent = stage.name;
    if (scoreValueEl) scoreValueEl.textContent = String(state.score);
    if (eatenValueEl) eatenValueEl.textContent = String(state.eaten);
    const next = stages[player.stage + 1];
    const pct = next ? (state.energy - stage.threshold) / (next.threshold - stage.threshold) : 1;
    if (energyValueEl) energyValueEl.textContent = `${Math.round(clamp(pct * 100, 0, 100))}%`;
    if (energyFillEl) energyFillEl.style.width = `${clamp(pct * 100, 0, 100)}%`;
  }
  function updateStage() {
    let next = 0;
    stages.forEach((stage, i) => { if (state.energy >= stage.threshold) next = i; });
    player.stage = next;
    player.radius += (stages[next].radius - player.radius) * 0.12;
    updateHud();
  }
  function steer(dt) {
    let x = 0, y = 0;
    if (keys.ArrowRight || keys.d) x++;
    if (keys.ArrowLeft || keys.a) x--;
    if (keys.ArrowDown || keys.s) y++;
    if (keys.ArrowUp || keys.w) y--;
    if (state.pointerDown) {
      const dx = state.cameraX + state.pointerX - player.x;
      const dy = state.cameraY + state.pointerY - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) { x += dx / dist; y += dy / dist; }
    }
    const len = Math.hypot(x, y);
    if (len) {
      x /= len; y /= len;
      const speed = stages[player.stage].speed;
      player.vx += (x * speed - player.vx) * Math.min(1, 0.16 * dt);
      player.vy += (y * speed - player.vy) * Math.min(1, 0.16 * dt);
      player.angle = Math.atan2(y, x);
    } else { player.vx *= Math.pow(0.9, dt); player.vy *= Math.pow(0.9, dt); }
    player.x = clamp(player.x + player.vx * dt, 18, world.width - 18);
    player.y = clamp(player.y + player.vy * dt, 18, world.height - 18);
    if (Math.hypot(player.vx, player.vy) > 0.15) player.angle = Math.atan2(player.vy, player.vx);
  }
  function moveFish(fish, dt, flee = false) {
    if (flee) {
      const dx = fish.x - player.x, dy = fish.y - player.y, dist = Math.hypot(dx, dy);
      if (dist < 220 && dist > 0) { fish.vx += dx / dist * 0.035 * dt; fish.vy += dy / dist * 0.035 * dt; }
    }
    const speed = Math.hypot(fish.vx, fish.vy), max = fish.predator ? 1.15 : 0.8;
    if (speed > max) { fish.vx = fish.vx / speed * max; fish.vy = fish.vy / speed * max; }
    fish.x = clamp(fish.x + fish.vx * dt, 25, world.width - 25);
    fish.y = clamp(fish.y + fish.vy * dt, 25, world.height - 25);
    if (fish.x <= 25 || fish.x >= world.width - 25) fish.vx *= -1;
    if (fish.y <= 25 || fish.y >= world.height - 25) fish.vy *= -1;
  }
  function spawnBoss() {
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? 50 : edge === 1 ? world.width - 50 : random(50, world.width - 50);
    const y = edge === 2 ? 50 : edge === 3 ? world.height - 50 : random(50, world.height - 50);
    state.boss = { x, y, vx: 0, vy: 0, radius: 82, color: '#9f315e', accent: '#ffd166', predator: true, hp: 3, maxHp: 3, age: 0, hitAt: 0 };
    state.bossBannerUntil = performance.now() + 3500;
  }
  function updateBoss(dt, now) {
    if (!state.boss) {
      state.bossCooldown -= dt / 60;
      if (state.bossCooldown <= 0) { spawnBoss(); state.bossCooldown = random(28, 42); }
      return;
    }
    const boss = state.boss;
    boss.age += dt / 60;
    const dx = player.x - boss.x, dy = player.y - boss.y, dist = Math.hypot(dx, dy) || 1;
    boss.vx += (dx / dist * 1.25 - boss.vx) * 0.018 * dt;
    boss.vy += (dy / dist * 1.25 - boss.vy) * 0.018 * dt;
    boss.x = clamp(boss.x + boss.vx * dt, 45, world.width - 45);
    boss.y = clamp(boss.y + boss.vy * dt, 45, world.height - 45);
    if (dist < player.radius * 0.7 + boss.radius * 0.72 && now > boss.hitAt + 900) {
      if (player.radius > boss.radius * 0.92) {
        boss.hp -= 1; boss.hitAt = now;
        if (boss.hp <= 0) {
          state.energy += 110; state.score += 25; state.eaten += 1;
          state.boss = null; state.bossCooldown = random(28, 42);
          state.bossBannerUntil = now + 2200;
          if (bossAlertEl) { bossAlertEl.textContent = 'BOSS DEFEATED! +25'; bossAlertEl.classList.add('visible'); }
          return;
        }
      } else {
        if (now > state.invulnerableUntil) {
          state.energy = Math.max(0, state.energy - 18);
          player.vx -= dx / dist * 3.5; player.vy -= dy / dist * 3.5;
          state.invulnerableUntil = now + 1100;
        }
        boss.hitAt = now;
      }
    }
    if (boss.age > 16) { state.boss = null; state.bossCooldown = random(25, 38); }
  }
  function eatAndCollide(now) {
    for (const fish of state.prey) {
      const dist = Math.hypot(fish.x - player.x, fish.y - player.y);
      if (dist < player.radius * 0.7 + fish.radius * 0.7 && player.radius > fish.radius * 1.08) {
        state.energy += 16 + fish.radius * 0.8; state.score += 1; state.eaten += 1;
        Object.assign(fish, makeFish());
      }
    }
    for (const fish of state.predators) {
      const dx = fish.x - player.x, dy = fish.y - player.y, dist = Math.hypot(dx, dy);
      if (dist < player.radius * 0.72 + fish.radius * 0.7 && now > state.invulnerableUntil) {
        if (player.radius > fish.radius * 1.12) {
          state.energy += 32; state.score += 5; state.eaten += 1; Object.assign(fish, makeFish(true));
        } else {
          player.vx -= dx / (dist || 1) * 1.2; player.vy -= dy / (dist || 1) * 1.2;
          state.energy = Math.max(0, state.energy - 8); state.invulnerableUntil = now + 700;
        }
      }
    }
  }
  function update(dt, now) {
    steer(dt);
    state.prey.forEach((fish) => moveFish(fish, dt, true));
    state.predators.forEach((fish) => moveFish(fish, dt));
    eatAndCollide(now);
    updateBoss(dt, now);
    state.bubbles.forEach((bubble) => { bubble.y -= bubble.speed * dt; if (bubble.y < 0) { bubble.y = world.height; bubble.x = random(0, world.width); } });
    state.cameraX = clamp(player.x - state.width / 2, 0, world.width - state.width);
    state.cameraY = clamp(player.y - state.height / 2, 0, world.height - state.height);
    updateStage();
    if (bossAlertEl) {
      if (state.boss && now < state.bossBannerUntil) { bossAlertEl.textContent = 'BOSS FISH APPROACHING!'; bossAlertEl.classList.add('visible'); }
      else if (!state.boss && now < state.bossBannerUntil && !bossAlertEl.textContent.includes('DEFEATED')) { bossAlertEl.textContent = 'BOSS FISH APPROACHING!'; bossAlertEl.classList.add('visible'); }
      else if (now >= state.bossBannerUntil) bossAlertEl.classList.remove('visible');
    }
  }
  function drawFish(fish, isPlayer = false) {
    const stage = isPlayer ? stages[player.stage] : null;
    const radius = isPlayer ? player.radius : fish.radius;
    const angle = isPlayer ? player.angle : Math.atan2(fish.vy, fish.vx || 1);
    ctx.save(); ctx.translate(fish.x - state.cameraX, fish.y - state.cameraY); ctx.rotate(angle);
    const body = isPlayer ? stage.color : fish.color, fin = isPlayer ? stage.accent : fish.accent;
    ctx.fillStyle = fin; ctx.beginPath(); ctx.moveTo(-radius * .82, 0); ctx.quadraticCurveTo(-radius * 1.62, -radius * .84, -radius * 2.08, -radius * .7); ctx.quadraticCurveTo(-radius * 1.84, 0, -radius * 2.08, radius * .7); ctx.quadraticCurveTo(-radius * 1.48, radius * .72, -radius * .82, 0); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-radius, 0); ctx.quadraticCurveTo(-radius * .78, -radius * .76, radius * .48, -radius * .63); ctx.quadraticCurveTo(radius * 1.12, -radius * .52, radius * 1.24, 0); ctx.quadraticCurveTo(radius * 1.1, radius * .58, radius * .4, radius * .66); ctx.quadraticCurveTo(-radius * .78, radius * .75, -radius, 0); ctx.fill();
    ctx.fillStyle = fin; ctx.beginPath(); ctx.moveTo(-radius * .35, -radius * .52); ctx.quadraticCurveTo(radius * .08, -radius * 1.28, radius * .62, -radius * .58); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-radius * .12, radius * .52); ctx.quadraticCurveTo(radius * .32, radius * 1.08, radius * .72, radius * .52); ctx.closePath(); ctx.fill();
    if (isPlayer && stage.kind >= 1) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-radius * .05, 0, radius * .18, radius * .47, .15, 0, Math.PI * 2); ctx.fill(); }
    if (isPlayer && stage.kind >= 2) { ctx.fillStyle = fin; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-radius * .5 + i * radius * .42, -radius * .5); ctx.lineTo(-radius * .28 + i * radius * .42, -radius * .91); ctx.lineTo(-radius * .04 + i * radius * .42, -radius * .48); ctx.fill(); } }
    if (isPlayer && stage.kind >= 3) { ctx.strokeStyle = 'rgba(41,25,70,.55)'; ctx.lineWidth = Math.max(1.5, radius * .055); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-radius * .48, i * radius * .22); ctx.quadraticCurveTo(-radius * .08, i * radius * .4, radius * .4, i * radius * .56); ctx.stroke(); } }
    if (isPlayer && stage.kind >= 4) { ctx.fillStyle = '#fff1aa'; ctx.beginPath(); ctx.moveTo(radius * .4, -radius * .5); ctx.lineTo(radius * .95, -radius * .82); ctx.lineTo(radius * .78, -radius * .28); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.beginPath(); ctx.ellipse(radius * .4, -radius * .2, radius * .27, radius * .12, -.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14253a'; ctx.beginPath(); ctx.arc(radius * .76, -radius * .13, Math.max(2, radius * .095), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(radius * .79, -radius * .17, Math.max(.8, radius * .03), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawBoss() {
    if (!state.boss) return;
    const b = state.boss;
    drawFish(b);
    const x = b.x - state.cameraX, y = b.y - state.cameraY - b.radius - 18;
    ctx.fillStyle = 'rgba(30,10,20,.75)'; ctx.fillRect(x - 34, y, 68, 8);
    ctx.fillStyle = '#ff526e'; ctx.fillRect(x - 32, y + 2, 64 * b.hp / b.maxHp, 4);
    ctx.strokeStyle = '#ffe4ea'; ctx.lineWidth = 1; ctx.strokeRect(x - 34, y, 68, 8);
  }
  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    const water = ctx.createLinearGradient(0, 0, 0, state.height); water.addColorStop(0, '#56c6d6'); water.addColorStop(.42, '#1689a7'); water.addColorStop(1, '#07506d'); ctx.fillStyle = water; ctx.fillRect(0, 0, state.width, state.height);
    ctx.save(); ctx.globalAlpha = .08; ctx.fillStyle = '#e9ffff';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(state.width * (.05 + i * .16), 0); ctx.lineTo(state.width * (.12 + i * .16), 0); ctx.lineTo(state.width * (.32 + i * .12), state.height); ctx.lineTo(state.width * (.21 + i * .12), state.height); ctx.fill(); }
    ctx.restore();
    state.bubbles.forEach((b) => { const x = b.x - state.cameraX, y = b.y - state.cameraY; if (x < -20 || x > state.width + 20 || y < -20 || y > state.height + 20) return; ctx.beginPath(); ctx.strokeStyle = `rgba(226,255,255,${b.alpha})`; ctx.lineWidth = 1.5; ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.stroke(); });
    state.prey.forEach((f) => drawFish(f)); state.predators.forEach((f) => drawFish(f)); drawBoss();
    if (performance.now() < state.invulnerableUntil) ctx.globalAlpha = Math.floor(performance.now() / 100) % 2 ? .4 : 1;
    drawFish(player, true); ctx.globalAlpha = 1;
    if (world.height - state.cameraY < state.height + 60) { ctx.fillStyle = '#d8bc75'; ctx.fillRect(0, world.height - state.cameraY, state.width, state.height); }
  }
  function frame(timestamp) {
    const dt = state.lastTime ? clamp((timestamp - state.lastTime) / 16.67, 0, 2.5) : 1;
    state.lastTime = timestamp; update(dt, timestamp); render(); window.requestAnimationFrame(frame);
  }
  function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); state.pointerX = event.clientX - rect.left; state.pointerY = event.clientY - rect.top; }
  canvas.addEventListener('pointerdown', (event) => { state.pointerDown = true; pointerPosition(event); if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => { if (state.pointerDown) pointerPosition(event); });
  canvas.addEventListener('pointerup', () => { state.pointerDown = false; });
  canvas.addEventListener('pointercancel', () => { state.pointerDown = false; });
  window.addEventListener('keydown', (event) => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault(); keys[key] = true; });
  window.addEventListener('keyup', (event) => { const key = event.key.length === 1 ? event.key.toLowerCase() : event.key; keys[key] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach((key) => { keys[key] = false; }); state.pointerDown = false; });
  window.addEventListener('resize', resize);
  resize(); seedWorld(); updateHud(); window.requestAnimationFrame(frame);
})();
