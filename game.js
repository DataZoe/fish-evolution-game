'use strict';

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const $ = (id) => document.getElementById(id);
  const stageEl = $('stageName');
  const eatenEl = $('eatenValue');
  const scoreEl = $('scoreValue');
  const energyEl = $('energyValue');
  const energyFill = $('energyFill');
  const noticeEl = $('notice');
  const bossAlertEl = $('bossAlert');

  const world = { w: 2400, h: 1650 };
  const stages = [
    { name: 'Fry', at: 0, r: 22, speed: 3.2, color: '#91efff', accent: '#e8ffff' },
    { name: 'Reefling', at: 80, r: 31, speed: 3.45, color: '#ffac72', accent: '#ffe6ad' },
    { name: 'Reef Hunter', at: 190, r: 43, speed: 3.7, color: '#f47754', accent: '#ffe6ad' },
    { name: 'Deep Guardian', at: 360, r: 58, speed: 3.9, color: '#895bc7', accent: '#d9c4ff' },
    { name: 'Apex', at: 620, r: 76, speed: 4.1, color: '#edca59', accent: '#fff2ac' },
  ];
  const player = { x: world.w / 2, y: world.h / 2, vx: 0, vy: 0, r: 22, stage: 0, angle: 0 };
  const keys = Object.create(null);
  const state = {
    w: 0, h: 0, cx: 0, cy: 0, energy: 0, score: 0, eaten: 0, last: 0,
    prey: [], predators: [], bubbles: [], boosts: [], boostCooldown: 9, boostUntil: 0,
    boss: null, bossCooldown: 18, invulnerableUntil: 0, pointer: null,
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = (min, max) => min + Math.random() * (max - min);

  function toast(text) {
    if (!noticeEl) return;
    noticeEl.textContent = text;
    noticeEl.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => noticeEl.classList.remove('show'), 2200);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = rect.width;
    state.h = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeFish(predator = false) {
    const colors = predator
      ? ['#d96356', '#b95d76', '#6675ca']
      : ['#7df0c0', '#78d6ff', '#ffd46e', '#ff90ae', '#c4a4ff'];
    return {
      x: rand(45, world.w - 45), y: rand(45, world.h - 45),
      vx: rand(-0.8, 0.8), vy: rand(-0.7, 0.7),
      r: predator ? rand(30, 55) : rand(9, 21),
      color: colors[Math.floor(Math.random() * colors.length)],
      accent: predator ? '#ffd4bc' : '#f0ffff', pred: predator,
    };
  }

  function seedWorld() {
    state.prey = Array.from({ length: 42 }, () => makeFish());
    state.predators = Array.from({ length: 8 }, () => makeFish(true));
    state.bubbles = Array.from({ length: 32 }, () => ({
      x: rand(0, world.w), y: rand(0, world.h), r: rand(3, 12),
      speed: rand(0.25, 0.9), alpha: rand(0.12, 0.42),
    }));
    state.boosts = [];
  }

  function updateHud() {
    let stage = 0;
    stages.forEach((item, index) => { if (state.energy >= item.at) stage = index; });
    player.stage = stage;
    player.r += (stages[stage].r - player.r) * 0.12;
    if (stageEl) stageEl.textContent = stages[stage].name;
    if (scoreEl) scoreEl.textContent = String(state.score);
    if (eatenEl) eatenEl.textContent = String(state.eaten);
    const next = stages[stage + 1];
    const percent = next ? clamp((state.energy - stages[stage].at) / (next.at - stages[stage].at) * 100, 0, 100) : 100;
    if (energyEl) energyEl.textContent = `${Math.round(percent)}%`;
    if (energyFill) energyFill.style.width = `${percent}%`;
  }

  function reset() {
    if (!confirm('Start over? Your stage, score, and fish-eaten count will reset.')) return;
    state.energy = 0;
    state.score = 0;
    state.eaten = 0;
    state.boostUntil = 0;
    state.boostCooldown = 9;
    state.boss = null;
    state.bossCooldown = 18;
    state.invulnerableUntil = 0;
    state.pointer = null;
    player.x = world.w / 2;
    player.y = world.h / 2;
    player.vx = player.vy = 0;
    player.r = stages[0].r;
    player.stage = 0;
    player.angle = 0;
    if (bossAlertEl) {
      bossAlertEl.textContent = 'BOSS FISH APPROACHING!';
      bossAlertEl.classList.remove('visible');
    }
    seedWorld();
    updateHud();
    toast('New run started');
  }

  function steer(dt, now) {
    let x = 0;
    let y = 0;
    if (keys.ArrowRight || keys.d) x++;
    if (keys.ArrowLeft || keys.a) x--;
    if (keys.ArrowDown || keys.s) y++;
    if (keys.ArrowUp || keys.w) y--;
    if (state.pointer) {
      const dx = state.cx + state.pointer.x - player.x;
      const dy = state.cy + state.pointer.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 12) { x += dx / distance; y += dy / distance; }
    }
    const length = Math.hypot(x, y);
    if (length) {
      x /= length;
      y /= length;
      const boost = now < state.boostUntil ? 1.85 : 1;
      const speed = stages[player.stage].speed * boost;
      player.vx += (x * speed - player.vx) * Math.min(1, 0.16 * dt);
      player.vy += (y * speed - player.vy) * Math.min(1, 0.16 * dt);
    } else {
      player.vx *= Math.pow(0.9, dt);
      player.vy *= Math.pow(0.9, dt);
    }
    player.x = clamp(player.x + player.vx * dt, 18, world.w - 18);
    player.y = clamp(player.y + player.vy * dt, 18, world.h - 18);
    if (Math.hypot(player.vx, player.vy) > 0.15) player.angle = Math.atan2(player.vy, player.vx);
  }

  function moveFish(fish, dt, flee = false) {
    if (flee) {
      const dx = fish.x - player.x;
      const dy = fish.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 220 && distance > 0) {
        fish.vx += dx / distance * 0.035 * dt;
        fish.vy += dy / distance * 0.035 * dt;
      }
    }
    const speed = Math.hypot(fish.vx, fish.vy);
    const maxSpeed = fish.pred ? 1.15 : 0.8;
    if (speed > maxSpeed) {
      fish.vx = fish.vx / speed * maxSpeed;
      fish.vy = fish.vy / speed * maxSpeed;
    }
    fish.x = clamp(fish.x + fish.vx * dt, 25, world.w - 25);
    fish.y = clamp(fish.y + fish.vy * dt, 25, world.h - 25);
    if (fish.x <= 25 || fish.x >= world.w - 25) fish.vx *= -1;
    if (fish.y <= 25 || fish.y >= world.h - 25) fish.vy *= -1;
  }

  function damagePlayer(dx, dy, distance, energyLoss, now, cooldown = 700) {
    if (now < state.invulnerableUntil) return;
    const safeDistance = distance || 1;
    player.vx -= dx / safeDistance * 1.5;
    player.vy -= dy / safeDistance * 1.5;
    state.energy = Math.max(0, state.energy - energyLoss);
    state.invulnerableUntil = now + cooldown;
    toast(`Too big! -${energyLoss} evolution energy`);
  }

  function collide(now) {
    state.prey.forEach((fish) => {
      const dx = fish.x - player.x;
      const dy = fish.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= player.r * 0.7 + fish.r * 0.7) return;
      if (player.r > fish.r * 1.08) {
        state.energy += 16 + fish.r * 0.8;
        state.score++;
        state.eaten++;
        Object.assign(fish, makeFish());
      } else {
        // Bumping into a fish too large to eat costs evolution energy.
        damagePlayer(dx, dy, distance, 8, now);
      }
    });

    state.predators.forEach((fish) => {
      const dx = fish.x - player.x;
      const dy = fish.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= player.r * 0.72 + fish.r * 0.7) return;
      if (player.r > fish.r * 1.12) {
        state.energy += 32;
        state.score += 5;
        state.eaten++;
        Object.assign(fish, makeFish(true));
      } else {
        damagePlayer(dx, dy, distance, 8, now);
      }
    });
  }

  function spawnBoss() {
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 0 ? 50 : edge === 1 ? world.w - 50 : rand(50, world.w - 50);
    const y = edge === 2 ? 50 : edge === 3 ? world.h - 50 : rand(50, world.h - 50);
    state.boss = {
      x, y, vx: 0, vy: 0, r: 82, color: '#9f315e', accent: '#ffd166',
      pred: true, hp: 3, maxHp: 3, age: 0, hitAt: 0,
    };
    if (bossAlertEl) {
      bossAlertEl.textContent = 'BOSS FISH APPROACHING!';
      bossAlertEl.classList.add('visible');
    }
  }

  function updateBoss(dt, now) {
    if (!state.boss) {
      state.bossCooldown -= dt / 60;
      if (state.bossCooldown <= 0) {
        spawnBoss();
        state.bossCooldown = rand(28, 42);
      }
      return;
    }
    const boss = state.boss;
    boss.age += dt / 60;
    const dx = player.x - boss.x;
    const dy = player.y - boss.y;
    const distance = Math.hypot(dx, dy) || 1;
    boss.vx += (dx / distance * 1.25 - boss.vx) * 0.018 * dt;
    boss.vy += (dy / distance * 1.25 - boss.vy) * 0.018 * dt;
    boss.x = clamp(boss.x + boss.vx * dt, 45, world.w - 45);
    boss.y = clamp(boss.y + boss.vy * dt, 45, world.h - 45);

    if (distance < player.r * 0.7 + boss.r * 0.72 && now > boss.hitAt + 900) {
      if (player.r > boss.r * 0.92) {
        boss.hp--;
        boss.hitAt = now;
        if (boss.hp <= 0) {
          state.energy += 110;
          state.score += 25;
          state.eaten++;
          state.boss = null;
          state.bossCooldown = rand(28, 42);
          if (bossAlertEl) {
            bossAlertEl.textContent = 'BOSS DEFEATED! +25';
            bossAlertEl.classList.add('visible');
          }
          setTimeout(() => bossAlertEl?.classList.remove('visible'), 2200);
          toast('Boss defeated! +25 points');
          return;
        }
      } else {
        damagePlayer(boss.x - player.x, boss.y - player.y, distance, 18, now, 1100);
        boss.hitAt = now;
      }
    }
    if (boss.age > 16) {
      state.boss = null;
      state.bossCooldown = rand(25, 38);
      bossAlertEl?.classList.remove('visible');
    }
  }

  function spawnBoost() {
    const x = clamp(state.cx + rand(90, Math.max(100, state.w - 90)), 30, world.w - 30);
    const y = clamp(state.cy + rand(120, Math.max(130, state.h - 100)), 30, world.h - 30);
    state.boosts.push({ x, y, r: 20, phase: rand(0, Math.PI * 2), life: 20 });
    state.boostCooldown = rand(18, 30);
  }

  function updateBoosts(dt, now) {
    state.boostCooldown -= dt / 60;
    if (state.boostCooldown <= 0 && state.boosts.length < 1) spawnBoost();
    state.boosts = state.boosts.filter((boost) => boost.life > 0);
    state.boosts.forEach((boost) => {
      boost.life -= dt / 60;
      boost.phase += 0.06 * dt;
      if (Math.hypot(boost.x - player.x, boost.y - player.y) < player.r + boost.r) {
        state.boostUntil = now + 6500;
        state.boosts = state.boosts.filter((item) => item !== boost);
        toast('Speed boost! Faster swimming for 6.5 seconds');
      }
    });
  }

  function drawFish(fish, isPlayer = false) {
    const stage = isPlayer ? stages[player.stage] : null;
    const radius = isPlayer ? player.r : fish.r;
    const angle = isPlayer ? player.angle : Math.atan2(fish.vy, fish.vx || 1);
    ctx.save();
    ctx.translate(fish.x - state.cx, fish.y - state.cy);
    ctx.rotate(angle);
    const body = isPlayer ? stage.color : fish.color;
    const fin = isPlayer ? stage.accent : fish.accent;
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.82, 0);
    ctx.quadraticCurveTo(-radius * 1.62, -radius * 0.84, -radius * 2.08, -radius * 0.7);
    ctx.quadraticCurveTo(-radius * 1.84, 0, -radius * 2.08, radius * 0.7);
    ctx.quadraticCurveTo(-radius * 1.48, radius * 0.72, -radius * 0.82, 0);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-radius, 0);
    ctx.quadraticCurveTo(-radius * 0.78, -radius * 0.76, radius * 0.48, -radius * 0.63);
    ctx.quadraticCurveTo(radius * 1.12, -radius * 0.52, radius * 1.24, 0);
    ctx.quadraticCurveTo(radius * 1.1, radius * 0.58, radius * 0.4, radius * 0.66);
    ctx.quadraticCurveTo(-radius * 0.78, radius * 0.75, -radius, 0);
    ctx.fill();
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.35, -radius * 0.52);
    ctx.quadraticCurveTo(radius * 0.08, -radius * 1.28, radius * 0.62, -radius * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-radius * 0.12, radius * 0.52);
    ctx.quadraticCurveTo(radius * 0.32, radius * 1.08, radius * 0.72, radius * 0.52);
    ctx.closePath();
    ctx.fill();
    if (isPlayer && stage.name === 'Apex') {
      ctx.strokeStyle = '#fff1aa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.beginPath();
    ctx.ellipse(radius * 0.4, -radius * 0.2, radius * 0.27, radius * 0.12, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#14253a';
    ctx.beginPath();
    ctx.arc(radius * 0.76, -radius * 0.13, Math.max(2, radius * 0.095), 0, Math.PI * 2);
    ctx.fill();

    // Restore the boss's distinctive stripes and dorsal spines.
    if (fish === state.boss) {
      ctx.strokeStyle = 'rgba(255,225,164,.8)';
      ctx.lineWidth = Math.max(2, radius * 0.045);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-radius * 0.25 + i * radius * 0.34, -radius * 0.48);
        ctx.lineTo(-radius * 0.1 + i * radius * 0.34, radius * 0.48);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffd166';
      for (let i = 0; i < 4; i++) {
        const x = -radius * 0.55 + i * radius * 0.32;
        ctx.beginPath();
        ctx.moveTo(x, -radius * 0.5);
        ctx.lineTo(x + radius * 0.13, -radius * 0.92);
        ctx.lineTo(x + radius * 0.28, -radius * 0.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBoss() {
    if (!state.boss) return;
    const boss = state.boss;
    drawFish(boss);
    const x = boss.x - state.cx;
    const y = boss.y - state.cy - boss.r - 22;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#fff1c7';
    ctx.fillText('BOSS', x, y - 5);
    ctx.fillStyle = 'rgba(30,10,20,.82)';
    ctx.fillRect(x - 38, y, 76, 9);
    ctx.fillStyle = '#ff526e';
    ctx.fillRect(x - 36, y + 2, 72 * boss.hp / boss.maxHp, 5);
    ctx.strokeStyle = '#ffe4ea';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 38, y, 76, 9);
    ctx.restore();
  }

  function drawBoost(boost) {
    const x = boost.x - state.cx;
    const y = boost.y - state.cy;
    const pulse = Math.sin(boost.phase) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(boost.phase) * 0.12);
    ctx.shadowColor = '#ffe46b';
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(255,221,92,.22)';
    ctx.beginPath();
    ctx.arc(0, 0, boost.r + 6 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd84f';
    ctx.strokeStyle = '#fff5b0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, boost.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 25px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', 0, 1);
    ctx.restore();
  }

  function render(now) {
    ctx.clearRect(0, 0, state.w, state.h);
    const water = ctx.createLinearGradient(0, 0, 0, state.h);
    water.addColorStop(0, '#56c6d6');
    water.addColorStop(0.42, '#1689a7');
    water.addColorStop(1, '#07506d');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, state.w, state.h);
    state.bubbles.forEach((bubble) => {
      const x = bubble.x - state.cx;
      const y = bubble.y - state.cy;
      if (x < -20 || x > state.w + 20 || y < -20 || y > state.h + 20) return;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(226,255,255,${bubble.alpha})`;
      ctx.arc(x, y, bubble.r, 0, Math.PI * 2);
      ctx.stroke();
    });
    state.prey.forEach((fish) => drawFish(fish));
    state.predators.forEach((fish) => drawFish(fish));
    state.boosts.forEach(drawBoost);
    drawBoss();
    if (now < state.invulnerableUntil) ctx.globalAlpha = Math.floor(now / 100) % 2 ? 0.4 : 1;
    drawFish(player, true);
    ctx.globalAlpha = 1;
    if (now < state.boostUntil) {
      ctx.save();
      ctx.fillStyle = '#fff1a8';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`⚡ SPEED ${Math.max(1, Math.ceil((state.boostUntil - now) / 1000))}s`, state.w / 2, 80);
      ctx.restore();
    }
  }

  function tick(now) {
    const dt = state.last ? clamp((now - state.last) / 16.67, 0, 2.5) : 1;
    state.last = now;
    steer(dt, now);
    state.prey.forEach((fish) => moveFish(fish, dt, true));
    state.predators.forEach((fish) => moveFish(fish, dt));
    collide(now);
    updateBoosts(dt, now);
    updateBoss(dt, now);
    state.bubbles.forEach((bubble) => {
      bubble.y -= bubble.speed * dt;
      if (bubble.y < 0) { bubble.y = world.h; bubble.x = rand(0, world.w); }
    });
    state.cx = clamp(player.x - state.w / 2, 0, world.w - state.w);
    state.cy = clamp(player.y - state.h / 2, 0, world.h - state.h);
    updateHud();
    render(now);
    requestAnimationFrame(tick);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    state.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  canvas.addEventListener('pointerdown', (event) => {
    pointerPosition(event);
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (event.buttons || event.pointerType === 'touch') pointerPosition(event);
  });
  canvas.addEventListener('pointerup', () => { state.pointer = null; });
  canvas.addEventListener('pointercancel', () => { state.pointer = null; });
  $('rebirthButton')?.addEventListener('click', reset);
  window.addEventListener('keydown', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
    keys[key] = true;
  });
  window.addEventListener('keyup', (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys[key] = false;
  });
  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    state.pointer = null;
  });
  window.addEventListener('resize', resize);

  resize();
  seedWorld();
  updateHud();
  requestAnimationFrame(tick);
})();
