
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const groundY = 460;

const ui = {
  health: document.getElementById("health"),
  power: document.getElementById("power"),
  coins: document.getElementById("coins"),
  gems: document.getElementById("gems"),
  level: document.getElementById("level"),
  world: document.getElementById("worldName"),
  message: document.getElementById("message"),
  shop: document.getElementById("shop"),
  feedback: document.getElementById("shopFeedback")
};

const worlds = [
  {
    name: "Emerald Forest",
    label: "🌿 Emerald Forest",
    sky: "#91d9c1",
    far: "#54aa80",
    ground: "#36764d",
    accent: "#baf28b",
    monster: "#7c3f91",
    width: 2400
  },
  {
    name: "Crystal Desert",
    label: "💎 Crystal Desert",
    sky: "#f6c18b",
    far: "#d98968",
    ground: "#b8754b",
    accent: "#8af5f2",
    monster: "#a33b55",
    width: 2700
  },
  {
    name: "Shadow Realm",
    label: "🌙 Shadow Realm",
    sky: "#25244d",
    far: "#494174",
    ground: "#292642",
    accent: "#c4a7ff",
    monster: "#dc4b87",
    width: 3000
  }
];

let worldIndex = 0;
let world = worlds[worldIndex];
let cameraX = 0;
let gameOver = false;
let shopOpen = false;
let lastTime = 0;
let elapsed = 0;
let noticeTimer = 0;

const player = {
  x: 100, y: groundY - 60,
  w: 34, h: 60,
  vx: 0, vy: 0,
  speed: 250,
  jump: 520,
  health: 100, maxHealth: 100,
  power: 10,
  coins: 0, gems: 0,
  level: 1, xp: 0,
  facing: 1,
  grounded: false,
  attacking: 0,
  attackCooldown: 0,
  invincible: 0,
  armor: 0,
  magic: false
};

const keys = {};
let monsters = [];
let loot = [];
let particles = [];
let portal = { x: 0, y: groundY - 100, w: 60, h: 100 };

function makeWorld(index) {
  worldIndex = index;
  world = worlds[index];
  player.x = 100;
  player.y = groundY - player.h;
  player.vx = 0;
  player.vy = 0;
  cameraX = 0;
  player.health = player.maxHealth;
  player.invincible = 1.5;
  loot = [];
  particles = [];

  monsters = [];
  for (let x = 420; x < world.width - 240; x += 300) {
    monsters.push({
      x, y: groundY - 42,
      w: 36, h: 42,
      startX: x,
      patrol: 75 + Math.random() * 65,
      dir: Math.random() < .5 ? -1 : 1,
      speed: 35 + Math.random() * 30,
      hp: 20 + index * 15,
      maxHp: 20 + index * 15,
      damage: 8 + index * 5,
      alive: true
    });
  }

  portal.x = world.width - 150;
  portal.y = groundY - 100;

  ui.world.textContent = world.label;
  say(index === 0
    ? "Find treasure and hunt monsters!"
    : "New dimension. Stronger monsters await!");
  updateUI();
}

function say(text) {
  ui.message.textContent = text;
  noticeTimer = 2.5;
}

function updateUI() {
  ui.health.textContent = Math.ceil(player.health);
  ui.power.textContent = player.power;
  ui.coins.textContent = player.coins;
  ui.gems.textContent = player.gems;
  ui.level.textContent = "Level " + player.level;
}

function openShop() {
  shopOpen = true;
  ui.shop.classList.remove("hidden");
  ui.feedback.textContent =
    `Coins: ${player.coins} | Diamonds: ${player.gems}`;
}

function closeShop() {
  shopOpen = false;
  ui.shop.classList.add("hidden");
}

function buy(item) {
  const costs = {
    sword: { coins: 10 },
    armor: { coins: 10 },
    potion: { coins: 5 },
    skill: { gems: 3 },
    strength: { gems: 5 }
  };

  const cost = costs[item];
  if (!cost) return;

  if (player.coins < (cost.coins || 0) ||
      player.gems < (cost.gems || 0)) {
    ui.feedback.textContent = "Not enough treasure!";
    return;
  }

  player.coins -= cost.coins || 0;
  player.gems -= cost.gems || 0;

  if (item === "sword") {
    player.power += 5;
    ui.feedback.textContent = "Iron Sword equipped! +5 power.";
  } else if (item === "armor") {
    player.armor += 4;
    ui.feedback.textContent = "Armor upgraded! Take less damage.";
  } else if (item === "potion") {
    player.health = Math.min(
      player.maxHealth, player.health + 40
    );
    ui.feedback.textContent = "Health restored.";
  } else if (item === "skill") {
    player.magic = true;
    player.power += 3;
    ui.feedback.textContent =
      "Magic unlocked! Your attacks reach farther.";
  } else if (item === "strength") {
    player.power += 10;
    ui.feedback.textContent = "Power increased by 10!";
  }

  updateUI();
}

document.getElementById("shopButton")
  .addEventListener("click", openShop);
document.getElementById("closeShop")
  .addEventListener("click", closeShop);

document.querySelectorAll("[data-item]").forEach(button => {
  button.addEventListener("click", () => buy(button.dataset.item));
});

function attack() {
  if (gameOver || shopOpen || player.attackCooldown > 0) return;

  player.attacking = 0.22;
  player.attackCooldown = 0.32;

  const range = player.magic ? 105 : 65;
  let hit = false;

  for (const m of monsters) {
    if (!m.alive) continue;

    const dx = m.x + m.w / 2 - (player.x + player.w / 2);
    const dy = Math.abs(m.y - player.y);

    if (Math.abs(dx) < range &&
        dy < 65 &&
        Math.sign(dx || 1) === player.facing) {
      m.hp -= player.power;
      hit = true;
      burst(m.x + m.w / 2, m.y, world.accent, 8);

      if (m.hp <= 0) {
        m.alive = false;
        player.xp += 10;
        dropLoot(m.x + m.w / 2, m.y);
        say("Monster defeated! Treasure dropped.");
        checkLevelUp();
      }
    }
  }

  if (!hit) say(player.magic ? "Magic slash!" : "Missed!");
}

function checkLevelUp() {
  const needed = player.level * 30;
  if (player.xp >= needed) {
    player.xp -= needed;
    player.level++;
    player.maxHealth += 15;
    player.health = player.maxHealth;
    player.power += 2;
    say("LEVEL UP! Health and power increased.");
  }
}

function dropLoot(x, y) {
  loot.push({
    x: x - 10, y: y - 15,
    type: Math.random() < .2 ? "gem" : "coin",
    phase: Math.random() * 6
  });

  if (Math.random() < .15) {
    loot.push({
      x: x + 15, y: y - 25,
      type: "gem", phase: 0
    });
  }
}

function burst(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - .5) * 220,
      vy: (Math.random() - .8) * 220,
      life: .4 + Math.random() * .4,
      color
    });
  }
}

function jump() {
  if (player.grounded && !gameOver && !shopOpen) {
    player.vy = -player.jump;
    player.grounded = false;
  }
}

function enterPortal() {
  if (gameOver || shopOpen) return;

  const distance = Math.abs(
    player.x + player.w / 2 - (portal.x + portal.w / 2)
  );

  if (distance > 105) {
    say("Move closer to the glowing portal!");
    return;
  }

  if (worldIndex < worlds.length - 1) {
    makeWorld(worldIndex + 1);
  } else {
    makeWorld(0);
    say("You escaped the Shadow Realm. Begin again!");
  }
}

document.getElementById("portalButton")
  .addEventListener("click", enterPortal);

document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();

  if (["arrowleft", "arrowright", "arrowup", " "].includes(key)) {
    e.preventDefault();
  }

  keys[key] = true;

  if (e.repeat) return;

  if (key === " " || key === "w" || key === "arrowup") jump();
  if (key === "j") attack();
  if (key === "e") enterPortal();
  if (key === "b") shopOpen ? closeShop() : openShop();

  if (gameOver && key === "r") restart();
});

document.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

document.querySelectorAll("[data-key]").forEach(button => {
  const action = button.dataset.key;

  const press = e => {
    e.preventDefault();
    if (action === "jump") jump();
    else if (action === "attack") attack();
    else keys[action] = true;
  };

  const release = e => {
    e.preventDefault();
    if (action !== "jump" && action !== "attack") {
      keys[action] = false;
    }
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

function restart() {
  gameOver = false;
  player.coins = 0;
  player.gems = 0;
  player.power = 10;
  player.level = 1;
  player.xp = 0;
  player.maxHealth = 100;
  player.health = 100;
  player.armor = 0;
  player.magic = false;
  makeWorld(0);
}

function update(dt) {
  if (gameOver || shopOpen) return;

  elapsed += dt;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.attacking = Math.max(0, player.attacking - dt);
  player.invincible = Math.max(0, player.invincible - dt);

  const movingLeft = keys.a || keys.arrowleft || keys.left;
  const movingRight = keys.d || keys.arrowright || keys.right;

  player.vx = (Number(!!movingRight) - Number(!!movingLeft))
    * player.speed;

  if (player.vx) player.facing = Math.sign(player.vx);

  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(world.width - player.w, player.x));

  player.vy += 1400 * dt;
  player.y += player.vy * dt;

  if (player.y + player.h >= groundY) {
    player.y = groundY - player.h;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  cameraX = Math.max(0, Math.min(
    world.width - W,
    player.x + player.w / 2 - W / 2
  ));

  for (const m of monsters) {
    if (!m.alive) continue;

    m.x += m.dir * m.speed * dt;
    if (m.x < m.startX - m.patrol ||
        m.x > m.startX + m.patrol) {
      m.dir *= -1;
    }

    const touching =
      player.x < m.x + m.w &&
      player.x + player.w > m.x &&
      player.y < m.y + m.h &&
      player.y + player.h > m.y;

    if (touching && player.invincible <= 0) {
      player.health -= Math.max(1, m.damage - player.armor);
      player.invincible = .8;
      player.vy = -210;
      player.x += player.x < m.x ? -18 : 18;
      burst(player.x, player.y, "#ff7373", 6);
      say("Ouch! Watch your health.");
      updateUI();

      if (player.health <= 0) {
        player.health = 0;
        gameOver = true;
        say("Game over! Press R to restart.");
      }
    }
  }

  for (const item of loot) {
    item.phase += dt * 3;

    const dx = player.x + player.w / 2 - item.x;
    const dy = player.y + player.h / 2 - item.y;

    if (Math.hypot(dx, dy) < 36) {
      if (item.type === "coin") {
        player.coins++;
        burst(item.x, item.y, "#ffe16b", 5);
      } else {
        player.gems++;
        burst(item.x, item.y, "#79f5ff", 7);
      }
      item.collected = true;
      updateUI();
    }
  }

  loot = loot.filter(item => !item.collected);

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 350 * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);

  if (noticeTimer > 0) {
    noticeTimer -= dt;
    if (noticeTimer <= 0) {
      ui.message.textContent = "Explore and collect treasure!";
    }
  }
}

function roundedRect(x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawBackground() {
  ctx.fillStyle = world.sky;
  ctx.fillRect(0, 0, W, H);

  // Distant hills scroll more slowly for depth.
  ctx.fillStyle = world.far;
  for (let i = 0; i < 9; i++) {
    const x = i * 180 - (cameraX * .25 % 180);
    ctx.beginPath();
    ctx.ellipse(x + 80, 355, 130, 100, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Unique decorative objects for each dimension.
  for (let i = 0; i < 15; i++) {
    const x = i * 190 - (cameraX * .55 % 190);
    const y = 90 + (i % 3) * 65;

    if (worldIndex === 0) {
      roundedRect(x + 20, y + 35, 12, 85, 5, "#70503d");
      roundedRect(x, y, 55, 65, 18, "#28794f");
      roundedRect(x + 15, y - 14, 45, 55, 18, "#43965d");
    } else if (worldIndex === 1) {
      ctx.fillStyle = "#f9e0ad";
      ctx.beginPath();
      ctx.moveTo(x, 390);
      ctx.lineTo(x + 35, y);
      ctx.lineTo(x + 80, 390);
      ctx.fill();

      ctx.fillStyle = world.accent;
      ctx.beginPath();
      ctx.moveTo(x + 95, 390);
      ctx.lineTo(x + 115, y + 45);
      ctx.lineTo(x + 140, 390);
      ctx.fill();
    } else {
      ctx.fillStyle = world.accent;
      ctx.globalAlpha = .7;
      ctx.beginPath();
      ctx.arc(x + 30, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#e0d8ff";
      ctx.beginPath();
      ctx.arc(x + 90, y + 35, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = world.ground;
  ctx.fillRect(0, groundY, W, H - groundY);

  ctx.fillStyle = world.accent;
  ctx.fillRect(0, groundY, W, 5);

  for (let x = -((cameraX * .8) % 45); x < W; x += 45) {
    ctx.globalAlpha = .22;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, groundY + 25, 22, 3);
    ctx.globalAlpha = 1;
  }
}

function drawPortal() {
  const x = portal.x - cameraX;
  const y = portal.y;

  ctx.save();
  ctx.shadowColor = world.accent;
  ctx.shadowBlur = 25;

  ctx.strokeStyle = world.accent;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(x + portal.w / 2, y + 50, 29, 49, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = .35 + Math.sin(elapsed * 3) * .15;
  ctx.fillStyle = world.accent;
  ctx.beginPath();
  ctx.ellipse(x + portal.w / 2, y + 50, 23, 42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#fff";
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("PORTAL", x + 30, y - 12);
  ctx.textAlign = "left";
}

function drawPlayer() {
  const x = player.x - cameraX;
  const y = player.y;

  ctx.save();

  if (player.invincible > 0 &&
      Math.floor(elapsed * 16) % 2 === 0) {
    ctx.globalAlpha = .5;
  }

  // Legs animate while moving.
  const walking = Math.abs(player.vx) > 0 ? Math.sin(elapsed * 14) * 6 : 0;

  roundedRect(x + 4, y + 35, 11, 22, 4, "#2459a8");
  roundedRect(x + 20, y + 35, 11, 22, 4, "#2459a8");

  roundedRect(x + 2, y + 51 + walking, 14, 8, 4, "#202038");
  roundedRect(x + 19, y + 51 - walking, 14, 8, 4, "#202038");

  roundedRect(x, y + 15, player.w, 28, 8, "#2fa8c5");

  // Original tiny adventurer, not a copied cartoon character.
  roundedRect(x + 3, y, 28, 24, 8, "#f7e9c9");
  roundedRect(x + 5, y + 4, 24, 17, 7, "#f7e9c9");

  ctx.fillStyle = "#1c2238";
  ctx.fillRect(x + (player.facing > 0 ? 21 : 8), y + 8, 3, 4);
  ctx.fillRect(x + (player.facing > 0 ? 13 : 19), y + 8, 3, 4);

  if (player.attacking > 0) {
    const ax = x + (player.facing > 0 ? 30 : -45);
    const ay = y + 15;

    ctx.strokeStyle = player.magic ? "#a78bfa" : "#f5f5ff";
    ctx.lineWidth = player.magic ? 7 : 5;
    ctx.beginPath();
    ctx.arc(ax, ay, player.magic ? 35 : 24,
      player.facing > 0 ? -1.1 : Math.PI - 1.1,
      player.facing > 0 ? 1.1 : Math.PI + 1.1);
    ctx.stroke();
  }

  ctx.restore();
}

function drawMonsters() {
  for (const m of monsters) {
    if (!m.alive) continue;

    const x = m.x - cameraX;
    const y = m.y;
    if (x < -60 || x > W + 60) continue;

    roundedRect(x, y + 9, m.w, m.h - 9, 12, world.monster);

    ctx.fillStyle = "#fff";
    ctx.fillRect(x + 8, y + 16, 7, 7);
    ctx.fillRect(x + 23, y + 16, 7, 7);

    ctx.fillStyle = "#222";
    ctx.fillRect(x + 11, y + 18, 3, 4);
    ctx.fillRect(x + 26, y + 18, 3, 4);

    ctx.fillStyle = "#222";
    ctx.fillRect(x, y + 2, m.w, 5);
    ctx.fillStyle = "#ed6868";
    ctx.fillRect(x, y + 2, m.w * Math.max(0, m.hp / m.maxHp), 5);
  }
}

function drawLoot() {
  for (const item of loot) {
    const x = item.x - cameraX;
    const y = item.y + Math.sin(item.phase) * 5;

    ctx.fillStyle = item.type === "coin" ? "#ffdb55" : "#75f5ff";
    ctx.beginPath();

    if (item.type === "coin") {
      ctx.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(x, y - 11);
      ctx.lineTo(x + 9, y);
      ctx.lineTo(x, y + 11);
      ctx.lineTo(x - 9, y);
      ctx.closePath();
    }

    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - cameraX, p.y, 5, 5);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();
  drawPortal();
  drawLoot();
  drawMonsters();
  drawPlayer();
  drawParticles();

  if (gameOver) {
    ctx.fillStyle = "#11182bdd";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px system-ui";
    ctx.fillText("GAME OVER", W / 2, H / 2 - 12);
    ctx.font = "18px system-ui";
    ctx.fillText("Press R to restart", W / 2, H / 2 + 28);
    ctx.textAlign = "left";
  }
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, .033);
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

makeWorld(0);
requestAnimationFrame(loop);
