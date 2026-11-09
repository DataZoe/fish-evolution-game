'use strict';

(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas && canvas.getContext('2d');
  const stageNameEl = document.getElementById('stageName');
  const scoreValueEl = document.getElementById('scoreValue');
  const energyValueEl = document.getElementById('energyValue');
  const energyFillEl = document.getElementById('energyFill');

  if (!canvas || !ctx) {
    console.error('Fish Evolution could not start: game canvas is missing.');
    return;
  }

  const world = { width: 2400, height: 1650 };
  const stages = [
    { name: 'Fry', threshold: 0, radius: 22, speed: 3.2, color: '#91efff', accent: '#e8ffff', kind: 0 },
    { name: 'Reefling', threshold: 80, radius: 31, speed: 3.45, color: '#ffac72', accent: '#ffe6ad', kind: 1 },
    { name: 'Reef Hunter', threshold: 190, radius: 43, speed: 3.7, color: '#f47754', accent: '#ffe6ad', kind: 2 },
    { name: 'Deep Guardian', threshold: 360, radius: 58, speed: 3.9, color: '#895bc7', accent: '#d9c4ff', kind: 3 },
    { name: 'Apex', threshold: 620, radius: 76, speed: 4.1, color: '#edca59', accent: '#fff2ac', kind: 4 },
  ];
  const keys = Object.create(null);
  const player = {
    x: world.width / 2, y: world.height / 2, vx: 0, vy: 0,
    radius: stages[0].radius, stage: 0, angle: 0,
  };
  const state = {
    score: 0, energy: 0, cameraX: 0, cameraY: 0,
    width: 0, height: 0, lastTime: 0, prey: [], predators: [], bubbles: [],
    pointerDown: false, pointerX: 0, pointerY: 0,
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const random = (min, max) => min + Math.random() * (max - min);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = rect.width;
    state.height = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeFish(predator = false) {
    const radius = predator ? random(30, 55) : random(9, 21);
    const colors = predator
      ? ['#d96356', '#b95d76', '#6675ca']
      : ['#7df0c0', '#78d6ff', '#ffd46e', '#ff90ae', '#c4a4ff'];
    return {
      x: random(45, world.width - 45), y: random(45, world.height - 45),
      vx: random(-1, 1), vy: random(-0.75, 0.75), radius,
      color: colors[Math.floor(Math.random() * colors.length)],
      accent: predator ? '#ffd4bc' : '#f0ffff',
      predator,
    };
  }

  function seedWorld() {
    state.prey = Array.from({ length: 42 }, () => makeFish(false));
    state.predators = Array.from({ length: 8 }, () => makeFish(true));
    state.bubbles = Array.from({ length: 32 }, () => ({
      x: random(0, world.width), y: random(0, world.height), r: random(3, 12),
      speed: random(0.25, 0.9), alpha: random(0.12, 0.42),
    }));
  }

  function updateHud() {
    const stage = stages[player.stage];
    if (stageNameEl) stageNameEl.textContent = stage.name;
    if (scoreValueEl) scoreValueEl.textContent = String(state.score);
    const next = stages[player.stage + 1];
    const progress = next
      ? (state.energy - stage.threshold) / (next.threshold - stage.threshold)
      : 1;
    const percent = clamp(progress * 100, 0, 100);
    if (energyValueEl) energyValueEl.textContent = `${Math.round(percent)}%`;
    if (energyFillEl) energyFillEl.style.width = `${percent}%`;
  }

  function updateStage() {
    let nextStage = 0;
    stages.forEach((stage, index) => {
      if (state.energy >= stage.threshold) nextStage = index;
    });
    player.stage = nextStage;
    player.radius += (stages[nextStage].radius - player.radius) * 0.12;
    updateHud();
  }

  function steer(dt) {
    let x = 0;
    let y = 0;
    if (keys.ArrowRight || keys.d) x += 1;
    if (keys.ArrowLeft || keys.a) x -= 1;
    if (keys.ArrowDown || keys.s) y += 1;
    if (keys.ArrowUp || keys.w) y -= 1;

    if (state.pointerDown) {
      const targetX = state.cameraX + state.pointerX;
      const targetY = state.cameraY + state.pointerY;
      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 12) { x += dx / distance; y += dy / distance; }
    }

    const length = Math.hypot(x, y);
    if (length > 0) {
      x /= length;
      y /= length;
      const speed = stages[player.stage].speed;
      player.vx += (x * speed - player.vx) * Math.min(1, 0.16 * dt);
      player.vy += (y * speed - player.vy) * Math.min(1, 0.16 * dt);
      player.angle = Math.atan2(y, x);
    } else {
      player.vx *= Math.pow(0.9, dt);
      player.vy *= Math.pow(0.9, dt);
    }

    player.x = clamp(player.x + player.vx * dt, 18, world.width - 18);
    player.y = clamp(player.y + player.vy * dt, 18, world.height - 18);
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
    const maxSpeed = fish.predator ? 1.15 : 0.8;
    if (speed > maxSpeed) { fish.vx = fish.vx / speed * maxSpeed; fish.vy = fish.vy / speed * maxSpeed; }
    fish.x += fish.vx * dt;
    fish.y += fish.vy * dt;
    if (fish.x < 25 || fish.x > world.width - 25) fish.vx *= -1;
    if (fish.y < 25 || fish.y > world.height - 25) fish.vy *= -1;
    fish.x = clamp(fish.x, 25, world.width - 25);
    fish.y = clamp(fish.y, 25, world.height - 25);
  }

  function eatAndCollide() {
    for (const fish of state.prey) {
      const distance = Math.hypot(fish.x - player.x, fish.y - player.y);
      if (distance < player.radius * 0.7 + fish.radius * 0.7 && player.radius > fish.radius * 1.08) {
        state.energy += 16 + fish.radius * 0.8;
        state.score += 1;
        Object.assign(fish, makeFish(false));
      }
    }
    for (const fish of state.predators) {
      const distance = Math.hypot(fish.x - player.x, fish.y - player.y);
      if (distance < player.radius * 0.72 + fish.radius * 0.7) {
        if (player.radius > fish.radius * 1.12) {
          state.energy += 32;
          state.score += 5;
          Object.assign(fish, makeFish(true));
        } else {
          player.vx -= (fish.x - player.x) / (distance || 1) * 1.2;
          player.vy -= (fish.y - player.y) / (distance || 1) * 1.2;
          state.energy = Math.max(0, state.energy - 8);
        }
      }
    }
  }

  function update(dt) {
    steer(dt);
    state.prey.forEach((fish) => moveFish(fish, dt, true));
    state.predators.forEach((fish) => moveFish(fish, dt));
    eatAndCollide();
    state.bubbles.forEach((bubble) => {
      bubble.y -= bubble.speed * dt;
      if (bubble.y < 0) { bubble.y = world.height; bubble.x = random(0, world.width); }
    });
    state.cameraX = clamp(player.x - state.width / 2, 0, world.width - state.width);
    state.cameraY = clamp(player.y - state.height / 2, 0, world.height - state.height);
    updateStage();
  }

  function drawFish(fish, isPlayer = false) {
    const stage = isPlayer ? stages[player.stage] : null;
    const radius = isPlayer ? player.radius : fish.radius;
    const angle = isPlayer ? player.angle : Math.atan2(fish.vy, fish.vx || 1);
    ctx.save();
    ctx.translate(fish.x - state.cameraX, fish.y - state.cameraY);
    ctx.rotate(angle);
    const body = isPlayer ? stage.color : fish.color;
    const fin = isPlayer ? stage.accent : fish.accent;

    // Expressive, hand-drawn-style silhouette with a broad body and fan tail.
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

    // Evolution-specific silhouette details.
    if (isPlayer && stage.kind >= 1) {
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(-radius * 0.05, 0, radius * 0.18, radius * 0.47, 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isPlayer && stage.kind >= 2) {
      ctx.fillStyle = fin;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-radius * 0.5 + i * radius * 0.42, -radius * 0.5);
        ctx.lineTo(-radius * 0.28 + i * radius * 0.42, -radius * 0.91);
        ctx.lineTo(-radius * 0.04 + i * radius * 0.42, -radius * 0.48);
        ctx.fill();
      }
    }
    if (isPlayer && stage.kind >= 3) {
      ctx.strokeStyle = 'rgba(41,25,70,.55)';
      ctx.lineWidth = Math.max(1.5, radius * 0.055);
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-radius * 0.48, i * radius * 0.22);
        ctx.quadraticCurveTo(-radius * 0.08, i * radius * 0.4, radius * 0.4, i * radius * 0.56);
        ctx.stroke();
      }
    }
    if (isPlayer && stage.kind >= 4) {
      ctx.fillStyle = '#fff1aa';
      ctx.beginPath();
      ctx.moveTo(radius * 0.4, -radius * 0.5);
      ctx.lineTo(radius * 0.95, -radius * 0.82);
      ctx.lineTo(radius * 0.78, -radius * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,245,190,.3)';
      ctx.beginPath(); ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.beginPath(); ctx.ellipse(radius * 0.4, -radius * 0.2, radius * 0.27, radius * 0.12, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#14253a';
    ctx.beginPath(); ctx.arc(radius * 0.76, -radius * 0.13, Math.max(2, radius * 0.095), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(radius * 0.79, -radius * 0.17, Math.max(0.8, radius * 0.03), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, state.width, state.height);
    const water = ctx.createLinearGradient(0, 0, 0, state.height);
    water.addColorStop(0, '#56c6d6');
    water.addColorStop(0.42, '#1689a7');
    water.addColorStop(1, '#07506d');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, state.width, state.height);

    // Sunlit water rays and drifting bubbles.
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#e9ffff';
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(state.width * (0.05 + i * 0.16), 0);
      ctx.lineTo(state.width * (0.12 + i * 0.16), 0);
      ctx.lineTo(state.width * (0.32 + i * 0.12), state.height);
      ctx.lineTo(state.width * (0.21 + i * 0.12), state.height);
      ctx.fill();
    }
    ctx.restore();
    state.bubbles.forEach((bubble) => {
      const x = bubble.x - state.cameraX;
      const y = bubble.y - state.cameraY;
      if (x < -20 || x > state.width + 20 || y < -20 || y > state.height + 20) return;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(226,255,255,${bubble.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.arc(x, y, bubble.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    state.prey.forEach((fish) => drawFish(fish));
    state.predators.forEach((fish) => drawFish(fish));
    drawFish(player, true);

    // Sandy seabed at the far edge of the playfield.
    if (world.height - state.cameraY < state.height + 60) {
      ctx.fillStyle = '#d8bc75';
      ctx.fillRect(0, world.height - state.cameraY, state.width, state.height);
    }
  }

  function frame(timestamp) {
    const dt = state.lastTime ? clamp((timestamp - state.lastTime) / 16.67, 0, 2.5) : 1;
    state.lastTime = timestamp;
    update(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    state.pointerX = event.clientX - rect.left;
    state.pointerY = event.clientY - rect.top;
  }

  canvas.addEventListener('pointerdown', (event) => {
    state.pointerDown = true;
    pointerPosition(event);
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (state.pointerDown) pointerPosition(event);
  });
  canvas.addEventListener('pointerup', () => { state.pointerDown = false; });
  canvas.addEventListener('pointercancel', () => { state.pointerDown = false; });

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
    state.pointerDown = false;
  });
  window.addEventListener('resize', resize);

  resize();
  seedWorld();
  updateHud();
  window.requestAnimationFrame(frame);
})();
