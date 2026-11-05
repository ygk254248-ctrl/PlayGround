/* ═══════════════════════════════════════════════════════════
   AZURE BLADE — Tower of the Fallen King
   A 2D side-scrolling action game inspired by Tower Hunter:
   Erza's Trial. Built with plain Canvas + Web Audio.

   Controls:
     A/D or ←/→ ........ run        Space/W/↑ ... jump
     J / Z ............. light      K / X ....... heavy attack
     ↓ / S ............. dodge roll Shift / C ... dash
     Esc / P ........... pause      M ........... mute
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────
const VIEW_H = 720;                 // world units visible vertically
const GRAV = 2600;
const WORLD_W = 7200;
const WORLD_H = 2610;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rand = (a, b) => a + Math.random() * (b - a);
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// ─────────────────────────────────────────────────────────
// Level data
// ─────────────────────────────────────────────────────────
const PLATFORMS = [
  // Zone 1 — Gatehouse
  { x: 0,    y: 2500, w: 1500, h: 300, kind: 'ground' },
  // Zone 2 — Ascent of Embers
  { x: 1560, y: 2405, w: 150, h: 26 },
  { x: 1780, y: 2295, w: 150, h: 26 },
  { x: 2000, y: 2190, w: 150, h: 24 },
  { x: 2220, y: 2085, w: 150, h: 24 },
  { x: 2440, y: 1980, w: 160, h: 24 },
  { x: 2660, y: 1875, w: 150, h: 24 },
  { x: 2880, y: 1770, w: 160, h: 24 },
  { x: 3100, y: 1670, w: 170, h: 24 },           // a8 — checkpoint
  // Hidden Alcove A (drop through the gap between a7 and a8)
  { x: 3060, y: 2080, w: 340, h: 36 },           // alcove floor
  { x: 3120, y: 1780, w: 36,  h: 300 },          // alcove wall L
  { x: 3300, y: 1780, w: 36,  h: 300 },          // alcove wall R
  // Zone 3 — The Long Gallery
  { x: 3400, y: 1590, w: 150, h: 24 },
  { x: 3620, y: 1505, w: 160, h: 24 },
  { x: 3840, y: 1415, w: 150, h: 24 },
  { x: 4180, y: 1330, w: 150, h: 24 },           // b4 (fire jet)
  // Hidden Nook (drop through gap between b3 and b4)
  { x: 3900, y: 1715, w: 270, h: 28 },           // nook floor
  { x: 3900, y: 1380, w: 36,  h: 335 },          // nook wall L
  { x: 4134, y: 1380, w: 36,  h: 335 },          // nook wall R
  { x: 4410, y: 1240, w: 150, h: 24 },           // b5
  { x: 4620, y: 1150, w: 170, h: 24 },           // b6 — goblin patrol
  { x: 4840, y: 1150, w: 300, h: 24 },           // b7 — long bridge
  // Zone 4 — Sky Shaft (wall-jump chimney)
  { x: 4980, y: 1300, w: 250, h: 20 },           // catch floor if you fall
  { x: 5190, y: 500,  w: 48,  h: 760 },          // shaft wall L
  { x: 5490, y: 500,  w: 48,  h: 760 },          // shaft wall R
  { x: 5538, y: 500,  w: 190, h: 22 },           // shaft-top ledge
  { x: 5780, y: 575,  w: 150, h: 22 },           // step down to arena
  // Zone 5 — Throne of the Gilded King (boss arena)
  { x: 5980, y: 760,  w: 1220, h: 80, kind: 'arena' },
];

const SPIKES = [
  { x: 2035, y: 2176, w: 80, h: 14 },            // on a3
  { x: 3875, y: 1401, w: 80, h: 14 },            // on b3
];

const FIRE_JETS = [
  { x: 2508, y: 1980, w: 34, height: 165, period: 2.7, onTime: 1.15, offset: 0.0 },
  { x: 4243, y: 1330, w: 34, height: 165, period: 2.2, onTime: 1.05, offset: 1.1 },
];

const SIGNS = [
  { x: 170,  y: 2500, text: 'A / D or ← / → to run — Space to jump' },
  { x: 470,  y: 2500, text: 'J: light attack (chain the combo!) · K: heavy attack' },
  { x: 770,  y: 2500, text: '↓ roll (invincible) · Shift dash · jump twice in mid-air' },
  { x: 1120, y: 2500, text: 'Gilded archways hide treasure. Watch for golden glows…' },
  { x: 3660, y: 1505, text: 'Storm-bats dive from above. Keep moving!' },
];

const BRAZIERS = [
  { x: 120,  y: 2500, idx: 0 },
  { x: 3180, y: 1670, idx: 1 },
  { x: 5020, y: 1150, idx: 2 },
  { x: 5600, y: 500,  idx: 3 },
];

const CHESTS = [
  { x: 1330, y: 2500, loot: 'gift' },   // Gatehouse grotto: heart + gems
  { x: 3225, y: 2080, loot: 'heart' },  // Alcove A: heart container
  { x: 4020, y: 1715, loot: 'gems' },   // Nook: 150 gems
];

const GEM_SPOTS = [
  [600, 2440], [820, 2440], [1050, 2440],
  [1620, 2350], [1840, 2240], [2270, 2030],
  [2500, 1930], [2720, 1820], [2940, 1715],
  [3160, 2010], [3250, 2010], [3340, 2010],
  [3460, 1535], [3680, 1450], [3900, 1360],
  [4240, 1275], [4470, 1185], [4680, 1095],
  [4900, 1095], [5060, 1095], [5300, 1150],
  [5260, 900], [5355, 700], [5450, 480],
  [5590, 445], [5840, 520], [6100, 705],
  [3160, 2045], [3225, 1990], [3290, 2045],
  [3970, 1660], [4060, 1660], [4015, 1605],
  [1300, 2445], [1375, 2445],
];

const SPAWN = {
  slimes:  [ { x: 700, y: 2444 }, { x: 960, y: 2444 }, { x: 1830, y: 2240 } ],
  goblins: [ { x: 1080, y: 2444, min: 950,  max: 1420 },
             { x: 3660, y: 1450, min: 3600, max: 3810 },
             { x: 4680, y: 1095, min: 4595, max: 4835 } ],
  bats:    [ { x: 2760, y: 1700 }, { x: 4460, y: 1100 }, { x: 5050, y: 1000 }, { x: 7100 - 2400, y: 100 } ].slice(0, 3),
};

const WINDOWS = [
  [250, 1800, 1.1], [700, 2100, 0.9], [1150, 2250, 1.2],
  [1750, 1900, 1.0], [2350, 1500, 1.3], [2900, 1300, 0.9],
  [3600, 1150, 1.1], [4350, 900, 1.0], [5050, 750, 1.2],
];

const TORCHES = [
  [330, 2500], [900, 2500], [1660, 2405], [2290, 2085], [2730, 1875],
  [3170, 1670], [3670, 1505], [4270, 1330], [4690, 1150], [5570, 500],
  [6150, 760], [7050, 760],
];

const BANNERS = [
  [520, 2420], [2150, 2000], [3520, 1520], [4760, 1085], [6300, 690],
];

const HIDDEN_ARCHES = [
  { x: 1135, y: 2500, w: 180, h: 190, label: 'Gatehouse Grotto' },
  { x: 3042, y: 1670, w: 76,  h: 40,  label: 'Gilded Archway' },   // gap a7→a8
  { x: 3988, y: 1330, w: 194, h: 90,  label: 'Gilded Archway' },   // gap b3→b4
];

const ARENA = { x1: 6010, x2: 7110, floor: 760, bossX: 6480 };
const PLAYER_START = { x: 90, y: 2500 };

// ─────────────────────────────────────────────────────────
// Canvas setup
// ─────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let scale = 1;
let viewW = 1280;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.floor(w * DPR);
  canvas.height = Math.floor(h * DPR);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  scale = canvas.height / VIEW_H;
  viewW = canvas.width / scale;
}
window.addEventListener('resize', resize);
resize();

// Pre-render a brick wall tile for the tower interior
const brickTile = document.createElement('canvas');
brickTile.width = 512; brickTile.height = 320;
(function buildBrickTile() {
  const b = brickTile.getContext('2d');
  b.fillStyle = '#33244a';
  b.fillRect(0, 0, 512, 320);
  const rowH = 40, colW = 86;
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 ? colW / 2 : 0;
    for (let col = -1; col < 8; col++) {
      const x = col * colW + offset, y = row * rowH;
      const v = hash2(col * 7 + 13, row * 3 + 7);
      const base = 52 + v * 26;
      b.fillStyle = `rgb(${base + 14},${base},${base + 34})`;
      b.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
      // top bevel highlight
      b.fillStyle = 'rgba(255,255,255,0.07)';
      b.fillRect(x + 2, y + 2, colW - 4, 5);
      // bottom shadow
      b.fillStyle = 'rgba(0,0,0,0.28)';
      b.fillRect(x + 2, y + rowH - 8, colW - 4, 6);
      if (v > 0.82) { // cracked brick
        b.strokeStyle = 'rgba(0,0,0,0.4)';
        b.lineWidth = 2;
        b.beginPath();
        b.moveTo(x + 18, y + 6); b.lineTo(x + 30 + v * 30, y + rowH - 8);
        b.stroke();
      }
    }
  }
  // faint moss / dust
  for (let i = 0; i < 240; i++) {
    const x = hash2(i, 99) * 512, y = hash2(i, 55) * 320;
    b.fillStyle = hash2(i, 7) > 0.5 ? 'rgba(120,180,120,0.10)' : 'rgba(0,0,0,0.16)';
    b.beginPath(); b.arc(x, y, 2 + hash2(i, 31) * 5, 0, Math.PI * 2); b.fill();
  }
})();

// ─────────────────────────────────────────────────────────
// Input
// ─────────────────────────────────────────────────────────
const keys = new Set();
const pressed = new Set();
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'light', KeyZ: 'light',
  KeyK: 'heavy', KeyX: 'heavy',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyC: 'dash', KeyL: 'dash',
  Escape: 'pause', KeyP: 'pause', KeyM: 'mute', Enter: 'confirm',
};

window.addEventListener('keydown', (e) => {
  const a = KEYMAP[e.code];
  if (!a) return;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) e.preventDefault();
  if (!keys.has(a)) pressed.add(a);
  keys.add(a);
  AudioEngine.resume();
});
window.addEventListener('keyup', (e) => {
  const a = KEYMAP[e.code];
  if (a) keys.delete(a);
});
window.addEventListener('blur', () => keys.clear());

const touchState = { left: false, right: false };
function bindHold(id, action) {
  const el = document.getElementById(id);
  if (!el) return;
  const on = (e) => { e.preventDefault(); el.classList.add('held'); if (action === 'left' || action === 'right') touchState[action] = true; else { if (!keys.has(action)) pressed.add(action); keys.add(action); } AudioEngine.resume(); };
  const off = (e) => { e.preventDefault(); el.classList.remove('held'); if (action === 'left' || action === 'right') touchState[action] = false; else keys.delete(action); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindHold('t-left', 'left'); bindHold('t-right', 'right');
bindHold('t-jump', 'jump'); bindHold('t-atk', 'light'); bindHold('t-heavy', 'heavy');
bindHold('t-dash', 'dash'); bindHold('t-roll', 'down');

function inputLeft()  { return keys.has('left')  || touchState.left; }
function inputRight() { return keys.has('right') || touchState.right; }

// ─────────────────────────────────────────────────────────
// Game state
// ─────────────────────────────────────────────────────────
let gameState = 'title';           // title | playing | paused | gameover | victory
let runTime = 0;
let gemsCollected = 0;
let enemiesDefeated = 0;
let deaths = 0;
let shakeT = 0, shakeMag = 0;
let hitstop = 0;
let slowmo = 0;
let toastTimer = null;

const URL_PARAMS = new URLSearchParams(location.search);
const IS_TOUCH = ('ontouchstart' in window) || window.matchMedia('(pointer: coarse)').matches || URL_PARAMS.has('touch');

function showToast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function shake(t, mag) { shakeT = Math.max(shakeT, t); shakeMag = Math.max(shakeMag, mag); }

// ─────────────────────────────────────────────────────────
// Camera
// ─────────────────────────────────────────────────────────
const camera = { x: 0, y: WORLD_H - VIEW_H };
function updateCamera(dt) {
  const targetX = player.x + player.w / 2 - viewW / 2 + player.facing * 70;
  const targetY = player.y + player.h / 2 - VIEW_H / 2 - 40;
  const k = 1 - Math.pow(0.0015, dt);
  camera.x = lerp(camera.x, clamp(targetX, 0, WORLD_W - viewW), k);
  camera.y = lerp(camera.y, clamp(targetY, 0, WORLD_H - VIEW_H), k);
  if (shakeT > 0) shakeT -= dt; else shakeMag = 0;
}

// ─────────────────────────────────────────────────────────
// Entities
// ─────────────────────────────────────────────────────────
const player = {
  x: PLAYER_START.x, y: PLAYER_START.y - 56, w: 34, h: 56,
  vx: 0, vy: 0, facing: 1,
  hp: 100, maxHp: 100,
  onGround: false, wallDir: 0,
  jumps: 0,
  attackT: 0, attackDur: 0, combo: 0, comboWindow: 0, swingId: 0, attackKind: 'light',
  attackHitSet: new Set(),
  rollT: 0, rollCd: 0, dashT: 0, dashCd: 0,
  invuln: 0, hurtT: 0,
  respawnIdx: 0,
  animTime: 0,
  ghostTrail: [],
};

let enemies = [];
let gems = [];
let heartsDrop = [];
let particles = [];
let floaters = [];
let chests = [];
let braziersLit = new Set([0]);

const boss = {
  active: false, engaged: false, defeated: false,
  x: ARENA.bossX, y: ARENA.floor - 150, w: 112, h: 150,
  vx: 0, vy: 0, hp: 320, maxHp: 320, facing: -1,
  state: 'idle', stateT: 0, attackCd: 2.0, slashCd: 0, chargeCd: 3.5, axeCd: 2.0, slamCd: 5.0,
  invuln: 0, hitT: 0, phase2: false, slamTargetX: 0,
  animTime: 0, onGround: true, roarT: 0,
};
let bossProjectiles = [];   // axes + shockwaves
let bossGatesClosed = false;

function resetPlayerToStart(full = true) {
  player.x = PLAYER_START.x; player.y = PLAYER_START.y - player.h;
  player.vx = 0; player.vy = 0; player.facing = 1;
  if (full) { player.hp = player.maxHp; }
  player.invuln = 0; player.hurtT = 0; player.rollT = 0; player.dashT = 0;
  player.combo = 0; player.attackT = 0;
  camera.x = 0; camera.y = WORLD_H - VIEW_H;
}

function respawnAtBrazier() {
  const bz = BRAZIERS[player.respawnIdx] || BRAZIERS[0];
  player.x = bz.x - player.w / 2;
  player.y = bz.y - player.h;
  player.vx = 0; player.vy = 0; player.hp = player.maxHp;
  player.invuln = 1.5; player.hurtT = 0; player.rollT = 0; player.dashT = 0;
  player.combo = 0; player.attackT = 0;
  camera.x = clamp(player.x - viewW / 2, 0, WORLD_W - viewW);
  camera.y = clamp(player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  resetEnemies();
  resetBoss();
}

function resetEnemies() {
  enemies = [];
  for (const s of SPAWN.slimes) enemies.push(makeSlime(s.x, s.y));
  for (const g of SPAWN.goblins) enemies.push(makeGoblin(g.x, g.y, g.min, g.max));
  for (const b of SPAWN.bats) enemies.push(makeBat(b.x, b.y));
}

function resetBoss() {
  boss.active = false; boss.engaged = false; boss.defeated = false;
  boss.x = ARENA.bossX; boss.y = ARENA.floor - boss.h;
  boss.vx = 0; boss.vy = 0; boss.hp = boss.maxHp; boss.facing = -1;
  boss.state = 'idle'; boss.stateT = 0; boss.phase2 = false;
  boss.attackCd = 2.0; boss.slashCd = 0; boss.chargeCd = 3.5; boss.axeCd = 2.0; boss.slamCd = 5.0;
  boss.invuln = 0; boss.hitT = 0; boss.roarT = 0;
  bossProjectiles = [];
  bossGatesClosed = false;
}

function makeSlime(x, y) {
  return { type: 'slime', x, y, w: 44, h: 34, vx: 0, vy: 0, hp: 30, maxHp: 30,
    facing: 1, hopT: rand(0.2, 1.2), hitT: 0, knockT: 0, animTime: rand(0, 10), onGround: false, dead: false };
}
function makeGoblin(x, y, min, max) {
  return { type: 'goblin', x, y, w: 36, h: 48, vx: 0, vy: 0, hp: 45, maxHp: 45,
    facing: 1, min, max, state: 'patrol', stateT: 0, attackCd: 0, hitT: 0, animTime: rand(0, 10), onGround: false, dead: false };
}
function makeBat(x, y) {
  return { type: 'bat', x, y, w: 40, h: 22, vx: 0, vy: 0, hp: 20, maxHp: 20,
    facing: 1, baseY: y, t: rand(0, 10), diveT: 0, diveCd: rand(1, 2), hitT: 0, animTime: rand(0, 10), dead: false, homeX: x };
}

function resetRun() {
  gemsCollected = 0; enemiesDefeated = 0; deaths = 0; runTime = 0;
  braziersLit = new Set([0]);
  player.maxHp = 100; player.hp = 100; player.respawnIdx = 0;
  resetPlayerToStart(true);
  resetEnemies();
  resetBoss();
  chests = CHESTS.map(c => ({ ...c, opened: false }));
  gems = GEM_SPOTS.map(([x, y]) => ({ x, y, vx: 0, vy: 0, value: 1, settled: true, t: rand(0, 10) }));
  heartsDrop = [];
  particles = [];
  floaters = [];
}

// ─────────────────────────────────────────────────────────
// Physics helpers
// ─────────────────────────────────────────────────────────
function moveAndCollide(e, dt, isPlayer = false) {
  // Horizontal
  e.x += e.vx * dt;
  e.wallDir = 0;
  for (const p of PLATFORMS) {
    if (!overlap(e, p)) continue;
    if (e.vx > 0) { e.x = p.x - e.w; if (!isPlayer) e.vx = -Math.abs(e.vx) * 0.4; else e.vx = 0; e.wallDir = 1; }
    else if (e.vx < 0) { e.x = p.x + p.w; if (!isPlayer) e.vx = Math.abs(e.vx) * 0.4; else e.vx = 0; e.wallDir = -1; }
  }
  // Vertical
  e.onGround = false;
  e.y += e.vy * dt;
  for (const p of PLATFORMS) {
    if (!overlap(e, p)) continue;
    if (e.vy >= 0 && e.y + e.h - e.vy * dt <= p.y + 1) {
      e.y = p.y - e.h; e.vy = 0; e.onGround = true;
    } else if (e.vy < 0) {
      e.y = p.y + p.h; e.vy = 0;
    } else {
      // fallback: push out vertically by smallest penetration
      const fromTop = e.y + e.h - p.y, fromBottom = p.y + p.h - e.y;
      if (fromTop < fromBottom) { e.y = p.y - e.h; e.vy = 0; e.onGround = true; }
      else { e.y = p.y + p.h; e.vy = Math.max(0, e.vy); }
    }
  }
  // World bounds
  if (e.x < 0) { e.x = 0; if (isPlayer) e.vx = Math.max(0, e.vx); }
  if (e.x + e.w > WORLD_W) { e.x = WORLD_W - e.w; if (isPlayer) e.vx = Math.min(0, e.vx); }
}

// Boss arena confinement while the fight is live
function confineToArena(e) {
  if (!bossGatesClosed || boss.defeated) return;
  if (e.x < ARENA.x1) { e.x = ARENA.x1; if (e.vx < 0) e.vx = 0; }
  if (e.x + e.w > ARENA.x2 + 90) { e.x = ARENA.x2 + 90 - e.w; if (e.vx > 0) e.vx = 0; }
}

// ─────────────────────────────────────────────────────────
// Particles & floaters
// ─────────────────────────────────────────────────────────
function spawnParticles(x, y, n, opts) {
  for (let i = 0; i < n; i++) {
    const a = opts.angle !== undefined ? opts.angle + rand(-opts.spread || -0.6, opts.spread || 0.6) : rand(0, Math.PI * 2);
    const sp = rand(opts.speedMin ?? 60, opts.speedMax ?? 260);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0, maxLife: rand(opts.lifeMin ?? 0.35, opts.lifeMax ?? 0.8),
      size: rand(opts.sizeMin ?? 2, opts.sizeMax ?? 5),
      color: Array.isArray(opts.colors) ? opts.colors[(Math.random() * opts.colors.length) | 0] : (opts.color || '#ffd166'),
      grav: opts.grav ?? 500,
    });
  }
}
function addFloater(x, y, text, color = '#fff', size = 15) {
  floaters.push({ x, y, text, color, size, t: 0, vy: -70 });
}
function updateParticles(dt) {
  for (const p of particles) { p.life += dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  particles = particles.filter(p => p.life < p.maxLife);
  for (const f of floaters) { f.t += dt; f.y += f.vy * dt; f.vy *= (1 - 2.4 * dt); }
  floaters = floaters.filter(f => f.t < 1.1);
}

// ─────────────────────────────────────────────────────────
// Damage & combat
// ─────────────────────────────────────────────────────────
function damageEnemy(e, dmg, dir, knockback, heavy) {
  e.hp -= dmg;
  e.hitT = 0.14;
  e.vx = dir * knockback;
  e.vy = -Math.abs(knockback) * 0.45 - 120;
  e.knockT = 0.25;
  addFloater(e.x + e.w / 2, e.y - 6, String(dmg), heavy ? '#ffd166' : '#ffffff', heavy ? 22 : 16);
  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, heavy ? 14 : 8, {
    colors: ['#ffe08a', '#fff6c8', '#ffb35c'], speedMax: heavy ? 380 : 260, grav: 300,
  });
  if (heavy) { AudioEngine.sfx.hitHeavy(); hitstop = Math.max(hitstop, 0.07); shake(0.18, 7); }
  else { AudioEngine.sfx.hit(); hitstop = Math.max(hitstop, 0.04); shake(0.1, 4); }
  if (e.hp <= 0 && !e.dead) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  enemiesDefeated += 1;
  AudioEngine.sfx.enemyDie();
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  spawnParticles(cx, cy, 22, { colors: e.type === 'slime' ? ['#7dffb0', '#2ecc71', '#bfffda'] : e.type === 'goblin' ? ['#8fe07a', '#3f7a3a', '#d8ffb0'] : ['#c39bff', '#6a3df0', '#e6d6ff'], speedMax: 340, grav: 420 });
  // Loot
  const gemCount = e.type === 'bat' ? 2 : e.type === 'goblin' ? 3 : 2;
  for (let i = 0; i < gemCount; i++) {
    gems.push({ x: cx + rand(-14, 14), y: cy - 6, vx: rand(-160, 160), vy: rand(-320, -140), value: 1, settled: false, t: 0 });
  }
  if (Math.random() < 0.14) {
    heartsDrop.push({ x: cx, y: cy, vx: rand(-80, 80), vy: -260, t: 0, settled: false });
  }
}

function damagePlayer(dmg, srcX) {
  if (player.invuln > 0 || player.rollT > 0 || gameState !== 'playing') return;
  player.hp -= dmg;
  player.invuln = 1.0;
  player.hurtT = 0.35;
  const dir = srcX !== undefined ? (player.x + player.w / 2 < srcX ? -1 : 1) : -player.facing;
  player.vx = dir * 320;
  player.vy = -220;
  AudioEngine.sfx.hurt();
  shake(0.3, 8);
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 12, { colors: ['#ff8a70', '#ffd0c0', '#ff5a40'], speedMax: 300 });
  if (player.hp <= 0) {
    player.hp = 0;
    onPlayerDeath();
  }
}

function onPlayerDeath() {
  deaths += 1;
  AudioEngine.sfx.gameover();
  AudioEngine.stopMusic();
  shake(0.6, 12);
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 40, { colors: ['#4fd2ff', '#bff3ff', '#ffffff'], speedMax: 420, grav: 260 });
  gameState = 'gameover';
  setTimeout(() => {
    document.getElementById('gameOverDetail').textContent =
      deaths === 1 ? 'Airi falls… but the Azure Order does not kneel.' : `Airi falls… ${deaths} times this climb. The tower laughs.`;
    showOverlay('gameOverScreen');
    updateHudVisibility();
  }, 1300);
}

// Attack hitboxes -----------------------------------------
function playerAttackHitbox() {
  const range = player.attackKind === 'heavy' ? 88 : 66;
  const w = range, h = 62;
  const x = player.facing === 1 ? player.x + player.w : player.x - w;
  return { x, y: player.y + 2, w, h };
}
function doPlayerAttack(kind) {
  player.attackKind = kind;
  player.attackT = kind === 'heavy' ? 0.5 : 0.28;
  player.attackDur = player.attackT;
  player.swingId += 1;
  player.attackHitSet = new Set();
  if (kind === 'heavy') { AudioEngine.sfx.slashHeavy(); player.vx *= 0.2; }
  else AudioEngine.sfx.slash();
}

function updateAttacks(dt) {
  // Timers
  if (player.comboWindow > 0) player.comboWindow -= dt;
  else player.combo = 0;
  if (player.rollCd > 0) player.rollCd -= dt;
  if (player.dashCd > 0) player.dashCd -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  if (player.hurtT > 0) player.hurtT -= dt;
  if (player.attackT > 0) player.attackT -= dt;

  if (player.attackT <= 0) return;
  const progress = 1 - player.attackT / player.attackDur;
  // Hit window: middle of the swing
  if (progress < 0.18 || progress > 0.72) return;
  const hb = playerAttackHitbox();
  const heavy = player.attackKind === 'heavy';
  const dmg = heavy ? 32 : (player.combo === 3 ? 18 : 12);
  const kb = heavy ? 520 : (player.combo === 3 ? 380 : 240);

  for (const e of enemies) {
    if (e.dead || player.attackHitSet.has(e)) continue;
    if (overlap(hb, e)) {
      player.attackHitSet.add(e);
      damageEnemy(e, dmg, player.facing, kb, heavy);
    }
  }
  // Boss hit test
  if (boss.engaged && !boss.defeated && boss.invuln <= 0 && !player.attackHitSet.has('boss')) {
    if (overlap(hb, boss)) {
      player.attackHitSet.add('boss');
      damageBoss(dmg, player.facing, heavy);
    }
  }
}

function damageBoss(dmg, dir, heavy) {
  boss.hp -= dmg;
  boss.hitT = 0.15;
  boss.vx = dir * (heavy ? 130 : 40);   // poise — barely pushed
  addFloater(boss.x + boss.w / 2, boss.y - 8, String(dmg), heavy ? '#ffd166' : '#fff', heavy ? 24 : 17);
  spawnParticles(boss.x + boss.w / 2, boss.y + 60, heavy ? 16 : 9, { colors: ['#ffd166', '#fff6c8', '#e8c368'], speedMax: 320, grav: 240 });
  AudioEngine.sfx.bossHit();
  hitstop = Math.max(hitstop, heavy ? 0.06 : 0.035);
  shake(0.12, heavy ? 6 : 3);
  if (boss.hp <= boss.maxHp * 0.5 && !boss.phase2) enterPhase2();
  if (boss.hp <= 0) {
    boss.hp = 0;
    defeatBoss();
  }
}

function enterPhase2() {
  boss.phase2 = true;
  boss.roarT = 1.3;
  boss.invuln = 1.4;
  boss.state = 'idle'; boss.stateT = 0;
  boss.x = clamp(boss.x, ARENA.x1 + 10, ARENA.x2 - boss.w - 10);
  AudioEngine.sfx.bossRoar();
  shake(0.9, 13);
  spawnParticles(boss.x + boss.w / 2, boss.y + 40, 46, { colors: ['#ff5a40', '#ffb35c', '#ffe08a'], speedMax: 430, grav: 200 });
  addFloater(boss.x + boss.w / 2, boss.y - 24, 'THE GILDED KING BURNS!', '#ff8a5c', 20);
  showToast('Phase II — Ghalus is enraged!', 2600);
}

function defeatBoss() {
  boss.defeated = true;
  boss.state = 'dying';
  boss.stateT = 0;
  AudioEngine.sfx.bossDie();
  shake(1.2, 14);
  spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, 80, { colors: ['#ffd166', '#ff8a5c', '#fff6c8', '#e8c368'], speedMax: 560, lifeMax: 1.6, grav: 160 });
  // shower of gems
  for (let i = 0; i < 60; i++) {
    gems.push({ x: boss.x + boss.w / 2 + rand(-40, 40), y: boss.y + rand(0, 60), vx: rand(-380, 380), vy: rand(-640, -120), value: 1, settled: false, t: 0 });
  }
  slowmo = 1.4;
  setTimeout(() => {
    if (gameState !== 'playing') return;
    gameState = 'victory';
    showVictoryScreen();
    updateHudVisibility();
    AudioEngine.stopMusic();
    AudioEngine.sfx.victory();
  }, 2400);
}

// ─────────────────────────────────────────────────────────
// Overlay / HUD helpers
// ─────────────────────────────────────────────────────────
const overlays = ['titleScreen', 'howToScreen', 'pauseScreen', 'gameOverScreen', 'victoryScreen'];
function showOverlay(id) {
  for (const o of overlays) document.getElementById(o).classList.toggle('hidden', o !== id);
}
function hideOverlays() { for (const o of overlays) document.getElementById(o).classList.add('hidden'); }
function updateHudVisibility() {
  const inGame = gameState === 'playing' || gameState === 'paused';
  document.getElementById('pauseBtn').style.display = inGame ? 'flex' : 'none';
  document.getElementById('touch').classList.toggle('ingame', IS_TOUCH && gameState === 'playing');
}
function getBest() {
  try { return JSON.parse(localStorage.getItem('azureblade_best') || 'null'); } catch { return null; }
}
function saveBest(timeMs, gems) {
  const prev = getBest();
  const best = {
    bestTime: prev && prev.bestTime ? Math.min(prev.bestTime, timeMs) : timeMs,
    bestGems: prev ? Math.max(prev.bestGems ?? 0, gems) : gems,
    clears: (prev?.clears ?? 0) + 1,
  };
  localStorage.setItem('azureblade_best', JSON.stringify(best));
  return best;
}
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function showVictoryScreen() {
  const best = saveBest(Math.floor(runTime * 1000), gemsCollected);
  const isBestTime = Math.abs(best.bestTime - Math.floor(runTime * 1000)) < 1;
  document.getElementById('victoryStats').innerHTML = `
    <div class="stat"><b>${formatTime(runTime)}</b><span>Time${isBestTime ? ' · <i class="newbest">Best!</i>' : ''}</span></div>
    <div class="stat"><b>${gemsCollected}</b><span>Gems</span></div>
    <div class="stat"><b>${enemiesDefeated}</b><span>Foes Felled</span></div>`;
  showOverlay('victoryScreen');
}
function refreshBestLine() {
  const b = getBest();
  document.getElementById('bestLine').innerHTML = b
    ? `Best clear: <b>${formatTime(b.bestTime / 1000)}</b> · <b>${b.bestGems}</b> gems · <b>${b.clears}</b> ${b.clears === 1 ? 'clear' : 'clears'}`
    : 'No clears yet. The tower is waiting.';
}

// ─────────────────────────────────────────────────────────
// State transitions
// ─────────────────────────────────────────────────────────
function startGame() {
  resetRun();
  gameState = 'playing';
  hideOverlays();
  updateHudVisibility();
  AudioEngine.resume();
  AudioEngine.startMusic();
  AudioEngine.sfx.uiConfirm();
  showToast('Reach the summit. Slay the Gilded King.', 3000);
}
function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    showOverlay('pauseScreen');
    AudioEngine.sfx.uiMove();
    AudioEngine.stopMusic();
  } else if (gameState === 'paused') {
    gameState = 'playing';
    hideOverlays();
    AudioEngine.startMusic();
    AudioEngine.sfx.uiConfirm();
  }
  updateHudVisibility();
}
function goToTitle() {
  gameState = 'title';
  showOverlay('titleScreen');
  updateHudVisibility();
  refreshBestLine();
  AudioEngine.stopMusic();
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('howToBtn').addEventListener('click', () => { AudioEngine.resume(); AudioEngine.sfx.uiMove(); showOverlay('howToScreen'); });
document.getElementById('howToClose').addEventListener('click', () => { AudioEngine.sfx.uiConfirm(); showOverlay('titleScreen'); });
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('restartCheckpointBtn').addEventListener('click', () => { AudioEngine.sfx.uiConfirm(); respawnAtBrazier(); gameState = 'playing'; hideOverlays(); updateHudVisibility(); AudioEngine.startMusic(); });
document.getElementById('quitToTitleBtn').addEventListener('click', goToTitle);
document.getElementById('retryBtn').addEventListener('click', () => { AudioEngine.sfx.uiConfirm(); respawnAtBrazier(); gameState = 'playing'; hideOverlays(); updateHudVisibility(); AudioEngine.startMusic(); });
document.getElementById('gameOverTitleBtn').addEventListener('click', goToTitle);
document.getElementById('playAgainBtn').addEventListener('click', startGame);
document.getElementById('victoryTitleBtn').addEventListener('click', goToTitle);
document.getElementById('pauseBtn').addEventListener('click', () => { if (gameState === 'playing' || gameState === 'paused') togglePause(); });

// ─────────────────────────────────────────────────────────
// Update — player
// ─────────────────────────────────────────────────────────
const MOVE_MAX = 340, ACCEL = 2800, FRICTION = 2400, AIR_ACCEL = 2100;
const JUMP_VEL = 950, DOUBLE_JUMP_VEL = 840, WALL_JUMP_VEL = 820, WALL_JUMP_PUSH = 400, WALL_SLIDE = 140;

function updatePlayer(dt) {
  const wasGrounded = player.onGround;
  if (player.onGround) player.jumps = 0;

  // Horizontal movement
  const left = inputLeft(), right = inputRight();
  const move = (right ? 1 : 0) - (left ? 1 : 0);
  const rolling = player.rollT > 0, dashing = player.dashT > 0;

  if (rolling || dashing) {
    // locked horizontal velocity during roll/dash
    if (rolling) player.vx = player.rollDir * 430;
    else player.vx = player.dashDir * 640;
  } else if (move !== 0) {
    const accel = player.onGround ? ACCEL : AIR_ACCEL;
    player.vx += move * accel * dt;
    player.vx = clamp(player.vx, -MOVE_MAX, MOVE_MAX);
    player.facing = move;
  } else {
    const f = (player.onGround ? FRICTION : FRICTION * 0.18) * dt;
    if (Math.abs(player.vx) <= f) player.vx = 0; else player.vx -= Math.sign(player.vx) * f;
  }

  // Timers
  if (player.rollT > 0) player.rollT -= dt;
  if (player.dashT > 0) player.dashT -= dt;

  // Wall slide
  const holdingWall = (player.wallDir === 1 && right) || (player.wallDir === -1 && left);
  if (!player.onGround && player.vy > 0 && holdingWall && player.wallDir !== 0) {
    player.vy = Math.min(player.vy, WALL_SLIDE);
    if (Math.random() < 0.35) {
      particles.push({ x: player.x + (player.wallDir === 1 ? player.w : 0), y: player.y + rand(10, player.h), vx: -player.wallDir * rand(20, 80), vy: rand(-40, 40), life: 0, maxLife: 0.5, size: rand(2, 4), color: '#cbb8e6', grav: 200 });
    }
  }

  // Jump
  if (pressed.has('jump')) {
    if (player.onGround) {
      player.vy = -JUMP_VEL; player.jumps = 1;
      AudioEngine.sfx.jump();
      spawnParticles(player.x + player.w / 2, player.y + player.h, 6, { colors: ['#cbb8e6', '#8f7fb5'], speedMax: 160, grav: 620, angle: Math.PI / 2, spread: 0.7 });
    } else if (player.wallDir !== 0) {
      player.vy = -WALL_JUMP_VEL;
      player.vx = -player.wallDir * WALL_JUMP_PUSH;
      player.facing = -player.wallDir;
      player.jumps = 1;
      AudioEngine.sfx.wallJump();
      spawnParticles(player.x + (player.wallDir === 1 ? player.w : 0), player.y + player.h * 0.5, 8, { colors: ['#cbb8e6', '#fff'], speedMax: 200, grav: 300 });
    } else if (player.jumps < 2) {
      player.vy = -DOUBLE_JUMP_VEL; player.jumps = 2;
      AudioEngine.sfx.doubleJump();
      spawnParticles(player.x + player.w / 2, player.y + player.h * 0.6, 10, { colors: ['#4fd2ff', '#bff3ff'], speedMax: 210, grav: 150, angle: Math.PI / 2, spread: 1.1 });
    }
  }
  // Variable jump height
  if (!keys.has('jump') && player.vy < -320) player.vy = -320;

  // Dodge roll (↓ / S)
  if (pressed.has('down') && player.rollT <= 0 && player.rollCd <= 0 && rolling !== true) {
    player.rollT = 0.38;
    player.rollCd = 0.55;
    player.rollDir = move !== 0 ? move : player.facing;
    player.facing = player.rollDir;
    AudioEngine.sfx.roll();
    spawnParticles(player.x + player.w / 2, player.y + player.h - 4, 8, { colors: ['#e8c368', '#c8963e'], speedMax: 240, grav: 200 });
  }

  // Dash (Shift / C)
  if (pressed.has('dash') && player.dashT <= 0 && player.dashCd <= 0) {
    player.dashT = 0.17;
    player.dashCd = 0.75;
    player.dashDir = move !== 0 ? move : player.facing;
    player.facing = player.dashDir;
    AudioEngine.sfx.dash();
    shake(0.08, 2.5);
  }

  // Attacks
  if (pressed.has('light') && player.attackT <= 0 && player.rollT <= 0) {
    player.combo = player.comboWindow > 0 ? (player.combo % 3) + 1 : 1;
    player.comboWindow = 0.75;
    doPlayerAttack('light');
    player.vx += player.facing * 90;   // small lunge
  }
  if (pressed.has('heavy') && player.attackT <= 0 && player.rollT <= 0) {
    doPlayerAttack('heavy');
    if (player.onGround) player.vx = 0;
  }

  // Gravity & integrate
  player.vy += GRAV * dt;
  player.vy = Math.min(player.vy, 1500);
  moveAndCollide(player, dt, true);
  confineToArena(player);

  // Ghost trail while dashing / rolling
  if (dashing || rolling) {
    player.ghostTrail.push({ x: player.x, y: player.y, facing: player.facing, life: 0.35 });
  }
  for (const g of player.ghostTrail) g.life -= dt;
  player.ghostTrail = player.ghostTrail.filter(g => g.life > 0);

  player.animTime += dt * (Math.abs(player.vx) / MOVE_MAX);

  // Resolve attack hits & tick combat timers
  updateAttacks(dt);

  // Fell out of the world? Treat as a costly slip — respawn at the last brazier
  if (player.y > WORLD_H + 120) {
    player.hp = Math.max(1, player.hp - 25);
    addFloater(clamp(player.x, camera.x + 60, camera.x + viewW - 60), camera.y + 80, '-25', '#ff8a70', 20);
    respawnAtBrazier();
    return;
  }

  // Pickups: gems & hearts (magnet)
  const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
  for (const g of gems) {
    if (!g.settled) {
      g.vy += 1600 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
      for (const p of PLATFORMS) {
        if (g.x > p.x && g.x < p.x + p.w && g.y > p.y - 6 && g.y < p.y + 14 && g.vy > 0) { g.y = p.y - 6; g.vy = 0; g.vx *= 0.5; if (Math.abs(g.vy) < 30) g.settled = true; }
      }
      if (g.y > WORLD_H - 8) { g.y = WORLD_H - 8; g.settled = true; }
    } else {
      const d = dist(pcx, pcy, g.x, g.y);
      if (d < 110) { g.x = lerp(g.x, pcx, 1 - Math.pow(0.0001, dt)); g.y = lerp(g.y, pcy, 1 - Math.pow(0.0001, dt)); }
    }
    g.t += dt;
  }
  for (const h of heartsDrop) {
    if (!h.settled) {
      h.vy += 1500 * dt; h.x += h.vx * dt; h.y += h.vy * dt;
      for (const p of PLATFORMS) {
        if (h.x > p.x && h.x < p.x + p.w && h.y > p.y - 8 && h.y < p.y + 14 && h.vy > 0) { h.y = p.y - 8; h.vy = 0; h.settled = true; }
      }
    }
    h.t += dt;
  }
  // Collect
  for (let i = gems.length - 1; i >= 0; i--) {
    if (dist(pcx, pcy, gems[i].x, gems[i].y) < 26) {
      gemsCollected += gems[i].value;
      AudioEngine.sfx.coin();
      spawnParticles(gems[i].x, gems[i].y, 4, { colors: ['#4fd2ff', '#bff3ff'], speedMax: 140, grav: 60 });
      gems.splice(i, 1);
    }
  }
  for (let i = heartsDrop.length - 1; i >= 0; i--) {
    if (dist(pcx, pcy, heartsDrop[i].x, heartsDrop[i].y) < 26) {
      player.hp = Math.min(player.maxHp, player.hp + 25);
      AudioEngine.sfx.heart();
      addFloater(pcx, player.y - 10, '+25', '#ff7d9c', 18);
      spawnParticles(pcx, pcy, 10, { colors: ['#ff7d9c', '#ffb3c6'], speedMax: 180, grav: 60 });
      heartsDrop.splice(i, 1);
    }
  }

  // Braziers (checkpoints)
  for (const bz of BRAZIERS) {
    if (!braziersLit.has(bz.idx) && dist(pcx, pcy, bz.x, bz.y - 20) < 70) {
      braziersLit.add(bz.idx);
      player.respawnIdx = bz.idx;
      AudioEngine.sfx.checkpoint();
      showToast('Brazier lit — checkpoint!');
      spawnParticles(bz.x, bz.y - 30, 18, { colors: ['#ffb35c', '#ffe08a', '#ff8a5c'], speedMax: 200, grav: -120 });
    }
  }

  // Chests
  for (const c of chests) {
    if (c.opened) continue;
    if (Math.abs(pcx - (c.x + 16)) < 46 && Math.abs(pcy - (c.y - 18)) < 54) {
      c.opened = true;
      AudioEngine.sfx.chest();
      spawnParticles(c.x + 16, c.y - 16, 26, { colors: ['#ffd166', '#fff6c8', '#e8c368'], speedMax: 320, grav: 180 });
      if (c.loot === 'heart') {
        player.maxHp += 20; player.hp = player.maxHp;
        addFloater(c.x + 16, c.y - 40, 'MAX HP UP!', '#ff7d9c', 22);
        showToast('Heart Container! Max HP increased');
      } else if (c.loot === 'gift') {
        player.hp = Math.min(player.maxHp, player.hp + 40);
        for (let i = 0; i < 12; i++) gems.push({ x: c.x + 16, y: c.y - 12, vx: rand(-260, 260), vy: rand(-420, -150), value: 1, settled: false, t: 0 });
        showToast('Gatehouse Grotto plundered!');
      } else {
        for (let i = 0; i < 30; i++) gems.push({ x: c.x + 16, y: c.y - 12, vx: rand(-320, 320), vy: rand(-480, -150), value: 5, settled: false, t: 0 });
        showToast('The hoard is yours! +150 gems');
      }
    }
  }

  // Signs are rendered; nothing to do here
}

// ─────────────────────────────────────────────────────────
// Update — enemies
// ─────────────────────────────────────────────────────────
function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) continue;
    e.animTime += dt;
    if (e.hitT > 0) e.hitT -= dt;
    if (e.knockT > 0) e.knockT -= dt;

    const pcx = player.x + player.w / 2;
    const ecx = e.x + e.w / 2;
    const dx = pcx - ecx;
    const adx = Math.abs(dx);
    const dy = Math.abs((player.y + player.h / 2) - (e.y + e.h / 2));

    if (e.type === 'slime') {
      e.vy += GRAV * dt;
      e.hopT -= dt;
      if (e.hopT <= 0 && e.onGround) {
        const dir = adx < 560 ? Math.sign(dx) || 1 : (Math.random() < 0.5 ? -1 : 1);
        e.vx = dir * rand(180, 260);
        e.vy = -rand(430, 560);
        e.facing = dir;
        e.hopT = rand(1.3, 2.1);
      }
      if (e.onGround) e.vx *= Math.pow(0.02, dt);
      moveAndCollide(e, dt);
      // Contact damage
      if (overlap(e, player)) damagePlayer(12, ecx);
    }

    else if (e.type === 'goblin') {
      e.vy += GRAV * dt;
      if (e.knockT > 0) {
        // being knocked back — no steering
      } else if (e.state === 'patrol') {
        e.attackCd -= dt;
        if (adx < 330 && dy < 90) { e.state = 'chase'; }
        else {
          e.vx = e.facing * 90;
          if (e.x < e.min) e.facing = 1;
          if (e.x + e.w > e.max) e.facing = -1;
        }
      } else if (e.state === 'chase') {
        e.attackCd -= dt;
        if (adx < 52 && dy < 60 && e.attackCd <= 0) {
          e.state = 'windup'; e.stateT = 0.42; e.vx = 0;
        } else if (adx > 520) {
          e.state = 'patrol';
        } else {
          e.vx = Math.sign(dx) * 165;
          e.facing = Math.sign(dx) || 1;
        }
      } else if (e.state === 'windup') {
        e.vx = 0; e.stateT -= dt;
        if (e.stateT <= 0) {
          e.state = 'swipe'; e.stateT = 0.16;
          // Swipe hitbox in front
          const hb = { x: e.facing === 1 ? e.x + e.w : e.x - 52, y: e.y, w: 52, h: e.h };
          if (overlap(hb, player)) damagePlayer(15, ecx);
          AudioEngine.sfx.swing();
        }
      } else if (e.state === 'swipe') {
        e.stateT -= dt;
        if (e.stateT <= 0) { e.state = 'chase'; e.attackCd = 1.25; }
      }
      moveAndCollide(e, dt);
      if (overlap(e, player) && e.state !== 'windup') damagePlayer(8, ecx);
    }

    else if (e.type === 'bat') {
      e.t += dt;
      e.diveCd -= dt;
      const aggro = adx < 420 && dy < 260;
      if (e.diveT > 0) {
        e.diveT -= dt;
        // keep diving velocity
      } else if (aggro && e.diveCd <= 0) {
        const d = Math.max(dist(ecx, e.y, pcx, player.y + player.h / 2), 1);
        e.vx = (dx / d) * 430;
        e.vy = ((player.y + player.h / 2) - (e.y + e.h / 2)) / d * 430;
        e.diveT = 0.55;
        e.diveCd = 1.6;
      } else {
        e.vx = Math.cos(e.t * 1.7) * 95;
        e.vy = Math.sin(e.t * 3.1) * 62;
        if (!aggro) e.y = lerp(e.y, e.baseY + Math.sin(e.t * 2) * 24, 0.02);
      }
      e.facing = e.vx >= 0 ? 1 : -1;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // soft world bounds
      e.x = clamp(e.x, 20, WORLD_W - e.w - 20);
      e.y = clamp(e.y, 30, WORLD_H - 200);
      if (overlap(e, player)) damagePlayer(10, ecx);
    }
  }
  enemies = enemies.filter(e => !e.dead);

  // Hazards — spikes
  for (const s of SPIKES) {
    if (overlap(s, player)) damagePlayer(20, s.x + s.w / 2);
  }
  // Hazards — fire jets
  for (const f of FIRE_JETS) {
    const cycle = (runTime + f.offset) % f.period;
    f.active = cycle < f.onTime;
    f.warmup = !f.active && cycle > f.period - 0.6;
    if (f.active) {
      const hb = { x: f.x - 4, y: f.y - f.height, w: f.w + 8, h: f.height };
      if (overlap(hb, player)) damagePlayer(16, f.x + f.w / 2);
      if (Math.random() < 0.6) {
        particles.push({ x: f.x + f.w / 2 + rand(-10, 10), y: f.y - rand(0, f.height * 0.4), vx: rand(-30, 30), vy: -rand(260, 480), life: 0, maxLife: rand(0.3, 0.6), size: rand(4, 9), color: ['#ffb35c', '#ff8a5c', '#ffe08a'][(Math.random() * 3) | 0], grav: -300 });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
// Update — boss
// ─────────────────────────────────────────────────────────
function updateBoss(dt) {
  // Engagement trigger
  if (!boss.engaged && !boss.defeated && player.x + player.w > ARENA.x1 + 40) {
    boss.engaged = true;
    boss.active = true;
    bossGatesClosed = true;
    boss.roarT = 1.6;
    boss.invuln = 1.2;
    AudioEngine.sfx.bossRoar();
    shake(1.0, 12);
    showToast('GHALUS, THE GILDED KING', 2800);
    spawnParticles(boss.x + boss.w / 2, boss.y + 30, 40, { colors: ['#e8c368', '#8a6a2a', '#fff2c0'], speedMax: 400 });
  }
  if (!boss.engaged || boss.defeated) { boss.animTime += dt; return; }

  boss.animTime += dt;
  if (boss.invuln > 0) boss.invuln -= dt;
  if (boss.hitT > 0) boss.hitT -= dt;
  if (boss.roarT > 0) { boss.roarT -= dt; boss.vx = 0; return; }
  boss.slashCd -= dt; boss.chargeCd -= dt; boss.axeCd -= dt; boss.slamCd -= dt;

  const pcx = player.x + player.w / 2;
  const bcx = boss.x + boss.w / 2;
  const dx = pcx - bcx;
  const adx = Math.abs(dx);
  const speed = boss.phase2 ? 235 : 150;

  boss.facing = dx >= 0 ? 1 : -1;

  // State machine
  if (boss.state === 'idle') {
    boss.vx = clamp(dx, -1, 1) * speed;
    // Choose attack
    if (adx < 230 && boss.slashCd <= 0) {
      boss.state = 'telegraph_slash'; boss.stateT = boss.phase2 ? 0.3 : 0.45; boss.vx = 0;
    } else if (adx > 320 && adx < 900 && boss.slamCd <= 0) {
      boss.state = 'telegraph_slam'; boss.stateT = 0.55; boss.slamTargetX = pcx; boss.vx = 0;
    } else if (adx >= 420 && boss.chargeCd <= 0) {
      boss.state = 'telegraph_charge'; boss.stateT = 0.62; boss.vx = 0;
    } else if (adx > 300 && boss.axeCd <= 0) {
      boss.state = 'telegraph_axe'; boss.stateT = 0.4; boss.vx = 0;
    }
  }
  else if (boss.state === 'telegraph_slash') {
    boss.stateT -= dt; boss.vx = 0;
    if (boss.stateT <= 0) {
      boss.state = 'slash'; boss.stateT = 0.22;
      const hb = { x: boss.facing === 1 ? boss.x + boss.w : boss.x - 150, y: boss.y + 10, w: 150, h: boss.h - 20 };
      if (overlap(hb, player)) damagePlayer(20, bcx);
      AudioEngine.sfx.slashHeavy();
      shake(0.2, 7);
      spawnParticles(boss.facing === 1 ? boss.x + boss.w + 60 : boss.x - 60, boss.y + 80, 16, { colors: ['#fff', '#ffd166'], speedMax: 380, angle: boss.facing === 1 ? 0 : Math.PI, spread: 0.7 });
    }
  }
  else if (boss.state === 'slash') { boss.stateT -= dt; if (boss.stateT <= 0) { boss.state = 'idle'; boss.slashCd = boss.phase2 ? 0.9 : 1.6; } }

  else if (boss.state === 'telegraph_charge') {
    boss.stateT -= dt; boss.vx = 0;
    if (Math.random() < 0.5) spawnParticles(boss.x + boss.w / 2, boss.y + boss.h - 4, 2, { colors: ['#cbb8e6', '#8f7fb5'], speedMax: 120, grav: 300 });
    if (boss.stateT <= 0) { boss.state = 'charge'; boss.stateT = 0.52; boss.chargeDir = boss.facing; AudioEngine.sfx.dash(); }
  }
  else if (boss.state === 'charge') {
    boss.stateT -= dt;
    boss.vx = boss.chargeDir * (boss.phase2 ? 950 : 820);
    // Charge hit
    if (overlap(boss, player)) {
      damagePlayer(25, bcx);
      player.vy = -350;
      player.vx = boss.chargeDir * 520;
    }
    // Wall slam → self-stun
    if ((boss.chargeDir === 1 && boss.x + boss.w >= ARENA.x2 + 60) || (boss.chargeDir === -1 && boss.x <= ARENA.x1 + 2)) {
      boss.state = 'stunned'; boss.stateT = 1.0; boss.vx = 0;
      shake(0.5, 12);
      AudioEngine.sfx.hitHeavy();
      spawnParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, 34, { colors: ['#e8c368', '#cbb8e6', '#fff'], speedMax: 460 });
      addFloater(boss.x + boss.w / 2, boss.y - 10, 'CRASH!', '#ffd166', 26);
    }
    if (boss.stateT <= 0) { boss.state = 'idle'; boss.chargeCd = boss.phase2 ? 3.0 : 5.0; boss.vx = 0; }
  }
  else if (boss.state === 'stunned') { boss.stateT -= dt; boss.vx = 0; if (boss.stateT <= 0) boss.state = 'idle'; }

  else if (boss.state === 'telegraph_slam') {
    boss.stateT -= dt; boss.vx = 0;
    if (boss.stateT <= 0) {
      boss.state = 'leap';
      const distToTarget = clamp(boss.slamTargetX - bcx, -700, 700);
      boss.vx = distToTarget * 1.35;
      boss.vy = -980;
      boss.onGround = false;
      AudioEngine.sfx.dash();
    }
  }
  else if (boss.state === 'leap') {
    boss.vy += GRAV * dt;
    if (boss.onGround) {
      boss.state = 'slam'; boss.stateT = 0.42;
      boss.vx = 0;
      shake(0.6, 12);
      AudioEngine.sfx.hitHeavy();
      // Shockwaves both directions
      const wy = ARENA.floor - 26;
      bossProjectiles.push({ kind: 'wave', x: boss.x + boss.w / 2 - 17, y: wy, w: 34, h: 26, vx: -330, vy: 0, dmg: 18, t: 0, life: 2.4 });
      bossProjectiles.push({ kind: 'wave', x: boss.x + boss.w / 2 - 17, y: wy, w: 34, h: 26, vx: 330, vy: 0, dmg: 18, t: 0, life: 2.4 });
      if (boss.phase2) {
        bossProjectiles.push({ kind: 'wave', x: boss.x + boss.w / 2 - 15, y: wy, w: 30, h: 23, vx: -560, vy: 0, dmg: 18, t: 0, life: 2.0 });
        bossProjectiles.push({ kind: 'wave', x: boss.x + boss.w / 2 - 15, y: wy, w: 30, h: 23, vx: 560, vy: 0, dmg: 18, t: 0, life: 2.0 });
      }
      // Direct slam damage
      const slamBox = { x: boss.x - 60, y: ARENA.floor - 60, w: boss.w + 120, h: 60 };
      if (overlap(slamBox, player)) damagePlayer(30, bcx);
      spawnParticles(boss.x + boss.w / 2, ARENA.floor, 40, { colors: ['#cbb8e6', '#e8c368', '#8f7fb5'], speedMax: 520, angle: -Math.PI / 2, spread: 1.4, grav: 700 });
    }
  }
  else if (boss.state === 'slam') { boss.stateT -= dt; if (boss.stateT <= 0) { boss.state = 'idle'; boss.slamCd = boss.phase2 ? 4.0 : 6.5; } }

  else if (boss.state === 'telegraph_axe') {
    boss.stateT -= dt; boss.vx = 0;
    if (boss.stateT <= 0) {
      boss.state = 'idle';
      boss.axeCd = boss.phase2 ? 2.2 : 4.0;
      throwAxe(bcx, boss.y + 40, pcx, player.y + player.h / 2, boss.phase2);
      if (boss.phase2) setTimeout(() => { if (gameState === 'playing' && !boss.defeated) throwAxe(boss.x + boss.w / 2, boss.y + 40, player.x + player.w / 2, player.y + player.h / 2, true); }, 220);
      AudioEngine.sfx.slash();
    }
  }
  else if (boss.state === 'dying') {
    boss.stateT += dt; boss.vx = 0;
    if (Math.random() < 0.35) {
      spawnParticles(boss.x + rand(0, boss.w), boss.y + rand(0, boss.h), 6, { colors: ['#ffd166', '#ff8a5c', '#fff'], speedMax: 260, grav: 100 });
    }
    return;
  }

  // Gravity & collide (boss uses same mover)
  if (boss.state !== 'leap') boss.vy += GRAV * dt;
  moveAndCollide(boss, dt);
  // Hard arena clamp for boss
  boss.x = clamp(boss.x, ARENA.x1 - 30, ARENA.x2 + 60 - boss.w);

  // Contact damage
  if (overlap(boss, player)) damagePlayer(15, bcx);

  // Projectiles
  for (const p of bossProjectiles) {
    p.t += dt;
    if (p.kind === 'axe') {
      p.vy += 1750 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.spin += dt * 14;
      if (p.y + p.h >= ARENA.floor + 4) {
        p.life = 0;
        spawnParticles(p.x + p.w / 2, ARENA.floor, 8, { colors: ['#cbb8e6'], speedMax: 180, grav: 500 });
      }
    } else if (p.kind === 'wave') {
      p.x += p.vx * dt;
      p.life -= dt;
    }
    if (p.life > 0 && overlap(p, player)) damagePlayer(p.dmg, p.x + p.w / 2);
  }
  bossProjectiles = bossProjectiles.filter(p => p.life > 0 && p.t < 6);
}

function throwAxe(fromX, fromY, targetX, targetY, heavy) {
  const dx = targetX - fromX, dy = targetY - fromY;
  const flight = 1.05;
  const vx = dx / flight;
  const vy = (dy - 0.5 * 1750 * flight * flight) / flight;
  bossProjectiles.push({ kind: 'axe', x: fromX - 14, y: fromY - 14, w: 28, h: 28, vx, vy, dmg: heavy ? 18 : 15, t: 0, life: 4, spin: 0 });
}

// ─────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────
function drawBackground() {
  const camX = camera.x, camY = camera.y;
  // Sky — dusk gradient, brighter near the (high) summit
  const summitGlow = clamp(1 - camY / (WORLD_H - VIEW_H), 0, 1);
  const g = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, '#3d2a63');
  g.addColorStop(0.35, '#59305c');
  g.addColorStop(0.7, '#7a3d55');
  g.addColorStop(1, '#a8532f');
  ctx.fillStyle = g;
  ctx.fillRect(camX - 4, camY - 4, viewW + 8, VIEW_H + 8);

  // Sun low on horizon at bottom (the sunset you climb toward… inverted: glow at top)
  const sunX = WORLD_W * 0.82, sunY = -140;
  const sun = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 700);
  sun.addColorStop(0, 'rgba(255, 236, 170, 0.9)');
  sun.addColorStop(0.25, 'rgba(255, 190, 110, 0.35)');
  sun.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(camX - 4, camY - 4, viewW + 8, VIEW_H + 8);

  // Far layer — floating isles & spires (parallax 0.15)
  ctx.save();
  ctx.translate(camX * 0.85, camY * 0.85);   // slight counter-shift
  ctx.fillStyle = '#241430';
  const far = [
    [-200, 900, 260, 700], [150, 500, 150, 1100], [520, 1150, 420, 560],
    [1050, 750, 200, 900], [1500, 1250, 520, 480], [2150, 650, 240, 1000],
    [2600, 1100, 380, 620], [3150, 700, 180, 950], [3600, 1250, 480, 520],
    [4250, 800, 220, 850], [4700, 1150, 420, 600], [5350, 650, 200, 1000],
    [5800, 1100, 500, 620], [6500, 700, 240, 900],
  ];
  for (const [x, y, w, h] of far) {
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w * 0.18, y + h * 0.22);
    ctx.lineTo(x + w * 0.5, y);
    ctx.lineTo(x + w * 0.82, y + h * 0.22);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Mid layer — arches & scaffolds (parallax 0.4)
  ctx.save();
  ctx.translate(camX * 0.6, camY * 0.6);
  ctx.fillStyle = '#2e1b40';
  for (let i = 0; i < 14; i++) {
    const x = i * 560 + 120, h = 340 + hash2(i, 5) * 420;
    const base = 1350 + Math.sin(i * 1.7) * 120;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + 30, base - h);
    ctx.lineTo(x + 70, base - h);
    ctx.lineTo(x + 100, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 24, base - h, 148, 18);   // capital
  }
  ctx.restore();

  // Clouds drifting (parallax 0.3)
  ctx.save();
  ctx.translate(camX * 0.7 + Math.sin(performance.now() * 0.00005) * 40, camY * 0.7);
  ctx.fillStyle = 'rgba(255, 205, 170, 0.16)';
  for (let i = 0; i < 10; i++) {
    const x = i * 780 + hash2(i, 21) * 300, y = 260 + hash2(i, 33) * 900;
    ctx.beginPath();
    ctx.ellipse(x, y, 150 + hash2(i, 44) * 120, 26 + hash2(i, 66) * 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Tower interior wall — brick tile across world
  const tile = brickTile;
  for (let x = 0; x < WORLD_W; x += tile.width) {
    for (let y = 0; y < WORLD_H; y += tile.height) {
      ctx.drawImage(tile, x, y);
    }
  }
  // Dark gradient at very bottom (the depths below)
  const deep = ctx.createLinearGradient(0, WORLD_H - 500, 0, WORLD_H);
  deep.addColorStop(0, 'rgba(10,6,18,0)');
  deep.addColorStop(1, 'rgba(10,6,18,0.75)');
  ctx.fillStyle = deep;
  ctx.fillRect(0, WORLD_H - 500, WORLD_W, 500);

  // Glowing arch windows
  for (const [wx, wy, ws] of WINDOWS) {
    const grad = ctx.createRadialGradient(wx, wy, 4, wx, wy, 120 * ws);
    grad.addColorStop(0, 'rgba(255, 202, 106, 0.5)');
    grad.addColorStop(1, 'rgba(255,202,106,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(wx - 130 * ws, wy - 130 * ws, 260 * ws, 260 * ws);
    ctx.fillStyle = '#1a1026';
    ctx.beginPath();
    ctx.moveTo(wx - 26 * ws, wy + 44 * ws);
    ctx.lineTo(wx - 26 * ws, wy - 18 * ws);
    ctx.arc(wx, wy - 18 * ws, 26 * ws, Math.PI, 0);
    ctx.lineTo(wx + 26 * ws, wy + 44 * ws);
    ctx.closePath();
    ctx.fill();
    const ig = ctx.createLinearGradient(wx, wy - 40 * ws, wx, wy + 44 * ws);
    ig.addColorStop(0, '#ffd98a'); ig.addColorStop(1, '#e88a3c');
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.moveTo(wx - 17 * ws, wy + 38 * ws);
    ctx.lineTo(wx - 17 * ws, wy - 14 * ws);
    ctx.arc(wx, wy - 14 * ws, 17 * ws, Math.PI, 0);
    ctx.lineTo(wx + 17 * ws, wy + 38 * ws);
    ctx.closePath();
    ctx.fill();
    // mullion
    ctx.strokeStyle = 'rgba(26,16,38,0.9)';
    ctx.lineWidth = 3 * ws;
    ctx.beginPath(); ctx.moveTo(wx, wy - 30 * ws); ctx.lineTo(wx, wy + 38 * ws); ctx.stroke();
  }
}

function drawArchGate(a) {
  // Gilded archway — signals a hidden treasure path
  const { x, y, w, h } = a;
  ctx.save();
  ctx.strokeStyle = '#e8c368';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h + w / 2);
  ctx.arc(x + w / 2, y - h + w / 2, (w / 2) - 0, Math.PI, 0);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
  // keystone gem
  ctx.fillStyle = '#4fd2ff';
  ctx.save();
  ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h - 4);
  ctx.lineTo(x + w / 2 + 7, y - h + 8);
  ctx.lineTo(x + w / 2, y - h + 18);
  ctx.lineTo(x + w / 2 - 7, y - h + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // rising sparkles
  const t = performance.now() * 0.001;
  for (let i = 0; i < 5; i++) {
    const p = (t * 0.35 + i * 0.2 + hash2(i, 11)) % 1;
    const sx = x + hash2(i, 71) * w;
    const sy = y - p * h;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPlatform(p) {
  const isArena = p.kind === 'arena';
  const isGround = p.kind === 'ground';
  // Slab body
  const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
  if (isArena) { g.addColorStop(0, '#5a4632'); g.addColorStop(0.18, '#4a3826'); g.addColorStop(1, '#241a10'); }
  else { g.addColorStop(0, '#4a3a5e'); g.addColorStop(0.18, '#3c2e50'); g.addColorStop(1, '#1e1530'); }
  ctx.fillStyle = g;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  // Top surface — sunlit stone
  ctx.fillStyle = isArena ? '#8a6f4a' : '#6b5588';
  ctx.fillRect(p.x, p.y, p.w, Math.min(8, p.h));
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(p.x, p.y, p.w, 2);
  // Gold trim on arena floor
  if (isArena) {
    ctx.fillStyle = '#e8c368';
    ctx.fillRect(p.x, p.y + 8, p.w, 3);
  }
  // Stone seams
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  const seam = 46;
  for (let x = p.x + seam; x < p.x + p.w; x += seam) {
    ctx.beginPath(); ctx.moveTo(x, p.y + 4); ctx.lineTo(x, p.y + Math.min(p.h, 22)); ctx.stroke();
  }
  // Moss tufts
  for (let i = 0; i < p.w / 90; i++) {
    const mx = p.x + hash2(p.x + i * 13, p.y) * p.w;
    if (hash2(i, p.y) > 0.55) {
      ctx.fillStyle = 'rgba(110,190,120,0.5)';
      ctx.beginPath(); ctx.ellipse(mx, p.y, 7, 3.4, 0, Math.PI, 0); ctx.fill();
    }
  }
  // Ground extends below — darken deep
  if (isGround) {
    const gg = ctx.createLinearGradient(0, p.y + 60, 0, p.y + p.h);
    gg.addColorStop(0, 'rgba(10,6,18,0)');
    gg.addColorStop(1, 'rgba(10,6,18,0.9)');
    ctx.fillStyle = gg;
    ctx.fillRect(p.x, p.y + 60, p.w, p.h - 60);
  }
}

function drawSpikes(s) {
  ctx.fillStyle = '#241a2e';
  ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
  const n = Math.floor(s.w / 12);
  for (let i = 0; i < n; i++) {
    const x = s.x + i * 12;
    const grad = ctx.createLinearGradient(x, s.y + s.h, x + 6, s.y);
    grad.addColorStop(0, '#5a4a6e');
    grad.addColorStop(0.5, '#b9a8d4');
    grad.addColorStop(1, '#f4ecff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, s.y + s.h);
    ctx.lineTo(x + 6, s.y);
    ctx.lineTo(x + 12, s.y + s.h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawFireJet(f) {
  // Vent base
  ctx.fillStyle = '#241a10';
  ctx.fillRect(f.x - 4, f.y - 6, f.w + 8, 8);
  ctx.fillStyle = '#4a3826';
  ctx.fillRect(f.x - 4, f.y - 8, f.w + 8, 3);
  const t = performance.now() * 0.001;
  if (f.active) {
    const g = ctx.createLinearGradient(0, f.y, 0, f.y - f.height);
    g.addColorStop(0, 'rgba(255, 224, 138, 0.95)');
    g.addColorStop(0.35, 'rgba(255, 150, 60, 0.9)');
    g.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = g;
    const wob = Math.sin(t * 22 + f.x) * 4;
    ctx.beginPath();
    ctx.moveTo(f.x - 2, f.y);
    ctx.quadraticCurveTo(f.x + f.w / 2 + wob, f.y - f.height * 0.6, f.x + f.w / 2 + wob * 1.6, f.y - f.height);
    ctx.quadraticCurveTo(f.x + f.w / 2 - wob, f.y - f.height * 0.55, f.x + f.w + 2, f.y);
    ctx.closePath();
    ctx.fill();
    // glow
    const glow = ctx.createRadialGradient(f.x + f.w / 2, f.y - 20, 2, f.x + f.w / 2, f.y - 20, 90);
    glow.addColorStop(0, 'rgba(255,180,80,0.5)'); glow.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(f.x - 80, f.y - f.height, 200, f.height);
  } else if (f.warmup) {
    // telegraph glow
    ctx.fillStyle = `rgba(255,140,60,${0.35 + 0.3 * Math.sin(t * 18)})`;
    ctx.fillRect(f.x - 2, f.y - 10, f.w + 4, 6);
  }
}

function drawBrazier(bz) {
  const lit = braziersLit.has(bz.idx);
  const x = bz.x, y = bz.y;
  // Pedestal
  ctx.fillStyle = '#241a10';
  ctx.fillRect(x - 14, y - 26, 28, 26);
  ctx.fillStyle = '#4a3826';
  ctx.fillRect(x - 18, y - 30, 36, 6);
  if (lit) {
    const t = performance.now() * 0.001;
    const fl = 1 + Math.sin(t * 11 + x) * 0.22;
    // glow
    const glow = ctx.createRadialGradient(x, y - 44, 4, x, y - 44, 90);
    glow.addColorStop(0, 'rgba(255,190,90,0.55)'); glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 95, y - 135, 190, 130);
    // flame
    ctx.fillStyle = '#ff8a3c';
    ctx.beginPath();
    ctx.moveTo(x - 9 * fl, y - 30);
    ctx.quadraticCurveTo(x, y - 58 * fl, x + 9 * fl, y - 30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(x - 5 * fl, y - 30);
    ctx.quadraticCurveTo(x, y - 46 * fl, x + 5 * fl, y - 30);
    ctx.closePath(); ctx.fill();
    if (Math.random() < 0.2) {
      particles.push({ x: x + rand(-5, 5), y: y - 44, vx: rand(-25, 25), vy: -rand(60, 130), life: 0, maxLife: 0.7, size: rand(1.5, 3), color: '#ffd166', grav: -80 });
    }
  } else {
    ctx.fillStyle = '#33244a';
    ctx.beginPath(); ctx.ellipse(x, y - 30, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawChest(c) {
  const { x, y } = c;
  const top = y - 34;
  ctx.save();
  if (c.opened) ctx.globalAlpha = 0.75;
  // body
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x, top + 10, 40, 24);
  // lid
  ctx.fillStyle = c.opened ? '#3a2610' : '#6e4a22';
  ctx.fillRect(x - 2, top + (c.opened ? -2 : 4), 44, 12);
  // gold bands
  ctx.fillStyle = '#e8c368';
  ctx.fillRect(x + 4, top + 10, 4, 24);
  ctx.fillRect(x + 32, top + 10, 4, 24);
  ctx.fillRect(x + 14, top + 12, 12, 9);
  // lock
  ctx.fillStyle = '#b8863b';
  ctx.beginPath(); ctx.arc(x + 20, top + 20, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (!c.opened) {
    const t = performance.now() * 0.001;
    const a = 0.5 + 0.5 * Math.sin(t * 3 + x);
    ctx.fillStyle = `rgba(255, 224, 138, ${0.5 * a})`;
    ctx.beginPath(); ctx.arc(x + 20, top, 30 + a * 12, 0, Math.PI * 2); ctx.fill();
  }
}

function drawSign(s) {
  ctx.fillStyle = '#4a3320';
  ctx.fillRect(s.x - 3, s.y - 56, 6, 56);
  ctx.fillStyle = '#6e4a22';
  ctx.fillRect(s.x - 26, s.y - 84, 52, 32);
  ctx.strokeStyle = '#2e1f10';
  ctx.lineWidth = 2;
  ctx.strokeRect(s.x - 26, s.y - 84, 52, 32);
  ctx.fillStyle = '#e8c368';
  ctx.font = 'bold 15px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('✦', s.x, s.y - 62);
  // prompt when player near
  const pcx = player.x + player.w / 2;
  if (Math.abs(pcx - s.x) < 80 && Math.abs((player.y + player.h) - s.y) < 90) {
    const text = s.text;
    ctx.font = '500 15px "Alegreya Sans", sans-serif';
    const w = ctx.measureText(text).width + 28;
    const bx = clamp(s.x - w / 2, 8, WORLD_W - w - 8), by = s.y - 138;
    ctx.fillStyle = 'rgba(18,8,32,0.92)';
    ctx.strokeStyle = 'rgba(232,195,104,0.5)';
    roundRect(bx, by, w, 30, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5ecdd';
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + w / 2, by + 20);
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTorch(t) {
  const [x, y] = t;
  ctx.strokeStyle = '#241a10';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x, y - 60); ctx.lineTo(x + 12, y - 30); ctx.stroke();
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 5, y - 68, 10, 12);
  const time = performance.now() * 0.001;
  const fl = 1 + Math.sin(time * 12 + x * 0.7) * 0.25;
  ctx.fillStyle = '#ff8a3c';
  ctx.beginPath();
  ctx.moveTo(x - 6 * fl, y - 68);
  ctx.quadraticCurveTo(x, y - 92 * fl, x + 6 * fl, y - 68);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(x - 3.2 * fl, y - 68);
  ctx.quadraticCurveTo(x, y - 82 * fl, x + 3.2 * fl, y - 68);
  ctx.closePath(); ctx.fill();
  if (Math.random() < 0.1) {
    particles.push({ x: x + rand(-3, 3), y: y - 80, vx: rand(-15, 15), vy: -rand(50, 110), life: 0, maxLife: 0.6, size: rand(1, 2.4), color: '#ffb35c', grav: -60 });
  }
}

function drawBanner(b) {
  const [x, y] = b;
  const t = performance.now() * 0.001;
  const sway = Math.sin(t * 1.4 + x) * 3;
  ctx.fillStyle = '#7a1f2b';
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 96);
  ctx.lineTo(x + 16, y - 96);
  ctx.lineTo(x + 16 + sway, y - 8);
  ctx.lineTo(x + sway * 0.5, y + 12);
  ctx.lineTo(x - 16 + sway, y - 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8c368';
  ctx.fillRect(x - 16, y - 96, 32, 5);
  // sword sigil
  ctx.strokeStyle = '#e8c368';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + sway * 0.6, y - 66); ctx.lineTo(x + sway * 0.6, y - 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6 + sway * 0.6, y - 46); ctx.lineTo(x + 6 + sway * 0.6, y - 46); ctx.stroke();
}

function drawGem(g) {
  const bob = Math.sin(g.t * 2.4) * 2.5;
  ctx.save();
  ctx.translate(g.x, g.y + bob);
  ctx.rotate(Math.sin(g.t * 1.8) * 0.16);
  ctx.shadowColor = '#4fd2ff';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#4fd2ff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5.4, 0); ctx.lineTo(0, 8); ctx.lineTo(-5.4, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d8f6ff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(2.6, 0); ctx.lineTo(0, 3); ctx.lineTo(-2.6, 0);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawHeartDrop(h) {
  ctx.save();
  ctx.translate(h.x, h.y + Math.sin(h.t * 3) * 2);
  ctx.shadowColor = '#ff5a7a'; ctx.shadowBlur = 12;
  drawHeartPath(0, 0, 9);
  ctx.fillStyle = '#ff5a7a';
  ctx.fill();
  ctx.restore();
}

function drawHeartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.75);
  ctx.bezierCurveTo(x - s * 1.15, y - s * 0.15, x - s * 0.62, y - s * 0.9, x, y - s * 0.32);
  ctx.bezierCurveTo(x + s * 0.62, y - s * 0.9, x + s * 1.15, y - s * 0.15, x, y + s * 0.75);
  ctx.closePath();
}

// ── Enemy drawing ─────────────────────────────────────────
function drawSlime(e) {
  const squash = e.onGround ? 1 + Math.sin(e.animTime * 6) * 0.12 : 0.92;
  const stretchX = 1 / Math.sqrt(squash);
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h);
  ctx.scale(stretchX, squash);
  if (e.hitT > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(e.hitT * 60);
  const g = ctx.createRadialGradient(0, -e.h * 0.4, 2, 0, -e.h * 0.3, e.w * 0.75);
  g.addColorStop(0, '#a4ffc4');
  g.addColorStop(0.55, '#3ce07a');
  g.addColorStop(1, '#1d8f4c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-e.w / 2, 0);
  ctx.quadraticCurveTo(-e.w / 2 - 4, -e.h, 0, -e.h - 2);
  ctx.quadraticCurveTo(e.w / 2 + 4, -e.h, e.w / 2, 0);
  ctx.closePath();
  ctx.fill();
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(-e.w * 0.18, -e.h * 0.62, 6, 3.4, -0.4, 0, Math.PI * 2); ctx.fill();
  // eyes
  const look = Math.sign(player.x + player.w / 2 - (e.x + e.w / 2)) || 1;
  ctx.fillStyle = '#0c2e1a';
  ctx.beginPath(); ctx.arc(-8 + look * 2, -e.h * 0.45, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(8 + look * 2, -e.h * 0.45, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGoblin(e) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h);
  if (e.hitT > 0) { ctx.globalAlpha = 0.65 + 0.35 * Math.sin(e.hitT * 60); }
  const dir = e.facing;
  ctx.scale(dir, 1);
  const walk = Math.sin(e.animTime * 10) * (Math.abs(e.vx) > 20 ? 1 : 0);
  // legs
  ctx.strokeStyle = '#2e4a26';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(-6 - walk * 6, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -18); ctx.lineTo(6 + walk * 6, 0); ctx.stroke();
  // body — ragged tunic
  ctx.fillStyle = '#4a3826';
  ctx.beginPath();
  ctx.moveTo(-12, -38); ctx.lineTo(12, -38); ctx.lineTo(14, -14); ctx.lineTo(-14, -14);
  ctx.closePath(); ctx.fill();
  // arms
  ctx.strokeStyle = '#57a047';
  ctx.lineWidth = 5.4;
  const windup = e.state === 'windup';
  const armAngle = windup ? -1.9 : (e.state === 'swipe' ? 0.9 : walk * 0.6);
  ctx.save();
  ctx.translate(9, -32);
  ctx.rotate(armAngle);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(15, 4); ctx.stroke();
  // dagger
  ctx.strokeStyle = '#c8c8d4'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(15, 4); ctx.lineTo(24, 0 + (windup ? -6 : 4)); ctx.stroke();
  ctx.restore();
  // head — big ears
  ctx.fillStyle = '#57a047';
  ctx.beginPath(); ctx.ellipse(0, -46, 11.5, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-10, -50); ctx.lineTo(-20, -56); ctx.lineTo(-9, -42); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, -50); ctx.lineTo(20, -56); ctx.lineTo(9, -42); ctx.closePath(); ctx.fill();
  // eyes
  ctx.fillStyle = windup ? '#ffe08a' : '#f5e94a';
  ctx.beginPath(); ctx.arc(3.5, -47, 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-3.5, -47, 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBat(e) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
  if (e.hitT > 0) ctx.globalAlpha = 0.6 + 0.4 * Math.sin(e.hitT * 60);
  const flap = Math.sin(e.animTime * 13);
  ctx.scale(e.facing, 1);
  // wings
  ctx.fillStyle = '#4a2a72';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(flap * 0.55 * side * (side > 0 ? 1 : 1));
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.quadraticCurveTo(14, -12 - flap * 7, 24, -2 - flap * 9);
    ctx.quadraticCurveTo(17, 2, 10, 4 + flap * 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // body
  ctx.fillStyle = '#6a3df0';
  ctx.beginPath(); ctx.ellipse(0, 0, 8.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.beginPath(); ctx.moveTo(-4.5, -6); ctx.lineTo(-2.5, -11); ctx.lineTo(-0.5, -6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4.5, -6); ctx.lineTo(2.5, -11); ctx.lineTo(0.5, -6); ctx.closePath(); ctx.fill();
  // eyes
  ctx.fillStyle = '#ff5a4a';
  ctx.beginPath(); ctx.arc(-3, -1, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -1, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Boss drawing ──────────────────────────────────────────
function drawBoss(t) {
  const b = boss;
  if (!b.active && !b.engaged) {
    // Dormant colossus silhouette behind the arena gate
    return;
  }
  const cx = b.x + b.w / 2, bottom = b.y + b.h;
  const burning = b.phase2;
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.scale(b.facing, 1);
  if (b.hitT > 0) ctx.globalAlpha = 0.7 + 0.3 * Math.sin(b.hitT * 70);
  const bob = Math.sin(b.animTime * 2.2) * 2;

  // Greaves & boots
  ctx.fillStyle = '#22160c';
  ctx.fillRect(-34, -34, 24, 34);
  ctx.fillRect(10, -34, 24, 34);
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(-36, -8, 28, 8);
  ctx.fillRect(8, -8, 28, 8);
  // Legs armor
  ctx.fillStyle = '#2e2438';
  ctx.fillRect(-32, -64, 20, 34);
  ctx.fillRect(12, -64, 20, 34);

  // Torso — blackened steel cuirass with gold filigree
  const torsoG = ctx.createLinearGradient(0, -128 + bob, 0, -56);
  torsoG.addColorStop(0, burning ? '#3d1f1a' : '#332a44');
  torsoG.addColorStop(0.5, burning ? '#54261e' : '#463a5e');
  torsoG.addColorStop(1, burning ? '#2a1410' : '#241c30');
  ctx.fillStyle = torsoG;
  ctx.beginPath();
  ctx.moveTo(-38, -118 + bob);
  ctx.lineTo(38, -118 + bob);
  ctx.lineTo(30, -56);
  ctx.lineTo(-30, -56);
  ctx.closePath();
  ctx.fill();
  // gold filigree lines
  ctx.strokeStyle = burning ? '#ffb35c' : '#d8b25c';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-20, -110 + bob); ctx.lineTo(-20, -62); ctx.moveTo(20, -110 + bob); ctx.lineTo(20, -62); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-26, -84 + bob); ctx.lineTo(26, -84 + bob); ctx.stroke();
  // sun sigil on chest
  ctx.fillStyle = burning ? '#ff8a3c' : '#e8c368';
  ctx.beginPath(); ctx.arc(0, -96 + bob, 7.5, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 10, -96 + bob + Math.sin(a) * 10);
    ctx.lineTo(Math.cos(a) * 15, -96 + bob + Math.sin(a) * 15);
    ctx.stroke();
  }

  // Pauldrons — massive layered gold shells
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * 40, -112 + bob);
    const pg = ctx.createLinearGradient(0, -18, 0, 18);
    pg.addColorStop(0, '#ffe9a8'); pg.addColorStop(0.45, '#d8b25c'); pg.addColorStop(1, '#7a5a1e');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 17, side * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(0, 5, 22, 8, side * 0.18, 0, Math.PI); ctx.fill();
    // spikes
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.moveTo(side * 6, -14); ctx.lineTo(side * 10, -26); ctx.lineTo(side * 15, -12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Helmet — horned greathelm with red plume
  ctx.save();
  ctx.translate(0, -128 + bob);
  const hg = ctx.createLinearGradient(0, -34, 0, 10);
  hg.addColorStop(0, '#4a3f5e'); hg.addColorStop(0.6, '#241c30'); hg.addColorStop(1, '#171021');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-19, 8);
  ctx.lineTo(-19, -14);
  ctx.quadraticCurveTo(-19, -30, 0, -32);
  ctx.quadraticCurveTo(19, -30, 19, -14);
  ctx.lineTo(19, 8);
  ctx.closePath(); ctx.fill();
  // horns
  ctx.fillStyle = '#d8b25c';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 15, -20);
    ctx.quadraticCurveTo(side * 34, -30, side * 40, -52);
    ctx.quadraticCurveTo(side * 24, -38, side * 12, -30);
    ctx.closePath(); ctx.fill();
  }
  // face slit with glowing eyes
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(-13, -14, 26, 9);
  const eyeGlow = burning ? '#ff5a2a' : '#ffd166';
  ctx.fillStyle = eyeGlow;
  ctx.shadowColor = eyeGlow; ctx.shadowBlur = 12;
  ctx.fillRect(-9, -11.5, 6, 4);
  ctx.fillRect(3, -11.5, 6, 4);
  ctx.shadowBlur = 0;
  // plume
  ctx.strokeStyle = burning ? '#ff5a2a' : '#c9403a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.quadraticCurveTo(6 + Math.sin(t * 3) * 3, -52, 2 + Math.sin(t * 3 + 1) * 5, -62);
  ctx.stroke();
  ctx.restore();

  // Greatsword — held low, or raised during telegraphs
  const raise = (b.state === 'telegraph_slash' || b.state === 'telegraph_charge') ? -1.5 : (b.state === 'slash' ? 0.9 : 0.35);
  ctx.save();
  ctx.translate(34, -70 + bob);
  ctx.rotate(raise);
  // blade
  const bg = ctx.createLinearGradient(0, 0, 0, -110);
  bg.addColorStop(0, '#8a8a9e'); bg.addColorStop(0.5, '#d8d8e8'); bg.addColorStop(1, '#ffffff');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-6, 0); ctx.lineTo(-6, -88); ctx.lineTo(0, -108); ctx.lineTo(6, -88); ctx.lineTo(6, 0);
  ctx.closePath(); ctx.fill();
  // fuller
  ctx.strokeStyle = 'rgba(40,40,60,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, -84); ctx.stroke();
  // crossguard & grip
  ctx.fillStyle = '#d8b25c'; ctx.fillRect(-14, 0, 28, 7);
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(-4.5, 7, 9, 26);
  ctx.fillStyle = '#d8b25c'; ctx.beginPath(); ctx.arc(0, 36, 5.4, 0, Math.PI * 2); ctx.fill();
  if (burning) {
    ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 9);
    ctx.strokeStyle = '#ff8a3c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -100); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Phase 2 cracks glowing
  if (burning) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 7);
    ctx.strokeStyle = '#ff8a3c';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-18, -112 + bob); ctx.lineTo(-8, -88 + bob); ctx.lineTo(-16, -64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, -108 + bob); ctx.lineTo(10, -80 + bob); ctx.lineTo(20, -60); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Roar shockwave ring
  if (b.roarT > 0) {
    const p = 1 - b.roarT / 1.6;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.strokeStyle = burning ? '#ff8a3c' : '#e8c368';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, -80, 30 + p * 190, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBossProjectile(p) {
  if (p.kind === 'axe') {
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    ctx.rotate(p.spin);
    ctx.fillStyle = '#d8d8e8';
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.quadraticCurveTo(12, -10, 12, 0); ctx.quadraticCurveTo(12, 10, 0, 14);
    ctx.quadraticCurveTo(-4, 6, -4, 0); ctx.quadraticCurveTo(-4, -6, 0, -14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6e4a22';
    ctx.fillRect(-2.5, -14, 5, 28);
    ctx.restore();
  } else if (p.kind === 'wave') {
    ctx.save();
    ctx.globalAlpha = clamp(p.life, 0, 1);
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h + 14);
    g.addColorStop(0, 'rgba(255,224,138,0)');
    g.addColorStop(0.5, '#ffd166');
    g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.quadraticCurveTo(p.x + p.w / 2, p.y - 14, p.x + p.w, p.y + p.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ── Player drawing ────────────────────────────────────────
function drawPlayer(t) {
  // Ghost afterimages
  for (const g of player.ghostTrail) {
    ctx.save();
    ctx.globalAlpha = g.life * 1.5;
    ctx.translate(g.x + player.w / 2, g.y + player.h);
    ctx.scale(g.facing, 1);
    ctx.fillStyle = '#4fd2ff';
    roundRect(-13, -player.h, 26, player.h, 9);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h);
  ctx.scale(player.facing, 1);

  const running = Math.abs(player.vx) > 40 && player.onGround;
  const runPhase = player.animTime * 11;
  const airborne = !player.onGround;
  const rolling = player.rollT > 0;
  const dashing = player.dashT > 0;
  const hurt = player.hurtT > 0;

  if (hurt && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  if (player.invuln > 0 && !hurt) ctx.globalAlpha = 0.72 + 0.28 * Math.sin(t * 30);

  const legSwing = running ? Math.sin(runPhase) * 14 : 0;
  const bobY = running ? Math.abs(Math.sin(runPhase)) * 3 : Math.sin(t * 2.1) * 1.6;

  if (rolling) {
    // Tucked spin
    ctx.rotate((0.38 - player.rollT) / 0.38 * Math.PI * 2 * player.rollDir * (player.rollDir === player.facing ? 1 : 1));
    ctx.translate(0, -14);
  }

  // ── Scarf / ribbon (behind body) ──
  const scarfFlutter = Math.sin(t * 9 + runPhase * 0.5) * (4 + Math.abs(player.vx) * 0.012);
  ctx.strokeStyle = '#35b6e8';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -44 + bobY);
  ctx.quadraticCurveTo(-18, -40 + bobY + scarfFlutter, -30 - Math.abs(player.vx) * 0.02, -30 + bobY + scarfFlutter * 1.6);
  ctx.stroke();
  ctx.strokeStyle = '#7fe0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -44 + bobY);
  ctx.quadraticCurveTo(-18, -40 + bobY + scarfFlutter, -30 - Math.abs(player.vx) * 0.02, -30 + bobY + scarfFlutter * 1.6);
  ctx.stroke();

  // ── Legs ──
  ctx.strokeStyle = '#2b2b3e';
  ctx.lineWidth = 7.5;
  if (rolling) {
    ctx.beginPath(); ctx.moveTo(-6, -20); ctx.lineTo(-12, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -20); ctx.lineTo(10, -4); ctx.stroke();
  } else if (airborne) {
    ctx.beginPath(); ctx.moveTo(-5, -19); ctx.lineTo(-11, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -19); ctx.lineTo(8, -8); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-5, -19); ctx.lineTo(-5 + legSwing * 0.5, -1 + Math.min(0, legSwing * 0.15)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -19); ctx.lineTo(5 - legSwing * 0.5, -1 + Math.min(0, -legSwing * 0.15)); ctx.stroke();
  }
  // Boots
  ctx.fillStyle = '#573a1e';
  if (!airborne && !rolling) {
    ctx.fillRect(-10 + legSwing * 0.5, -5, 10, 5);
    ctx.fillRect(0 - legSwing * 0.5, -5, 10, 5);
  } else {
    ctx.fillRect(-13, -5, 10, 5);
    ctx.fillRect(4, -7, 10, 5);
  }

  // ── Skirt / tunic ──
  const skirtG = ctx.createLinearGradient(0, -34 + bobY, 0, -12);
  skirtG.addColorStop(0, '#c9403a');
  skirtG.addColorStop(1, '#8a2018');
  ctx.fillStyle = skirtG;
  ctx.beginPath();
  ctx.moveTo(-11, -33 + bobY);
  ctx.lineTo(11, -33 + bobY);
  ctx.lineTo(15 + (running ? Math.sin(runPhase * 2) * 2 : 0), -13);
  ctx.lineTo(-15 - (running ? Math.sin(runPhase * 2) * 2 : 0), -13);
  ctx.closePath();
  ctx.fill();
  // gold hem
  ctx.strokeStyle = '#e8c368';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-14, -14.5); ctx.lineTo(14, -14.5); ctx.stroke();

  // ── Torso ──
  const torsoG = ctx.createLinearGradient(0, -52 + bobY, 0, -30 + bobY);
  torsoG.addColorStop(0, '#e2503c');
  torsoG.addColorStop(1, '#a32c22');
  ctx.fillStyle = torsoG;
  roundRect(-11.5, -52 + bobY, 23, 22, 6);
  ctx.fill();
  // breastplate trim
  ctx.strokeStyle = '#e8c368';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -50 + bobY); ctx.lineTo(0, -33 + bobY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-9, -40 + bobY); ctx.lineTo(9, -40 + bobY); ctx.stroke();
  // belt
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(-11.5, -32 + bobY, 23, 4.5);
  ctx.fillStyle = '#e8c368';
  ctx.fillRect(-2.5, -32.6 + bobY, 5, 5.6);

  // ── Head ──
  const headY = -58 + bobY;
  // face
  ctx.fillStyle = '#ffd9c0';
  ctx.beginPath(); ctx.ellipse(1.5, headY, 9.2, 10, 0, 0, Math.PI * 2); ctx.fill();
  // eye (single, anime profile) with fierce brow
  ctx.fillStyle = '#12303e';
  ctx.beginPath(); ctx.ellipse(6.2, headY - 1, 1.7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#301a10';
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(3.6, headY - 5.2); ctx.lineTo(8.6, headY - 3.4); ctx.stroke();
  // mouth — determined line
  ctx.beginPath(); ctx.moveTo(5.4, headY + 4.4); ctx.lineTo(8.8, headY + 4.0); ctx.stroke();

  // ── Hair — long flowing azure ponytail ──
  const hairG = ctx.createLinearGradient(0, headY - 14, 0, headY + 26);
  hairG.addColorStop(0, '#7fe0ff');
  hairG.addColorStop(0.35, '#35b6e8');
  hairG.addColorStop(1, '#1288c4');
  ctx.fillStyle = hairG;
  // back mass
  ctx.beginPath();
  ctx.moveTo(-9, headY - 4);
  ctx.quadraticCurveTo(-12, headY + 6, -8, headY + 12);
  ctx.quadraticCurveTo(-14, headY + 22, -10, headY + 30);
  ctx.lineTo(-3, headY + 22);
  ctx.quadraticCurveTo(-6, headY + 8, -2, headY);
  ctx.closePath(); ctx.fill();
  // crown of head
  ctx.beginPath(); ctx.ellipse(0, headY - 5.5, 10, 7.4, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-10, headY - 6, 20, 4);
  // side sweep fringe
  ctx.beginPath();
  ctx.moveTo(-9, headY - 2);
  ctx.quadraticCurveTo(-4, headY + 3, 2, headY - 2);
  ctx.quadraticCurveTo(6, headY - 6, 10, headY - 1);
  ctx.lineTo(10, headY - 7);
  ctx.lineTo(-9, headY - 8);
  ctx.closePath(); ctx.fill();
  // ponytail — big sweeping tail, animated
  const tailSway = Math.sin(t * 6 + runPhase * 0.6) * (5 + Math.abs(player.vx) * 0.02) + (airborne ? -8 : 0);
  ctx.beginPath();
  ctx.moveTo(-6, headY - 9);
  ctx.quadraticCurveTo(-26, headY - 14 + tailSway, -34, headY + 6 + tailSway * 1.7);
  ctx.quadraticCurveTo(-38, headY + 20 + tailSway * 2.1, -30, headY + 34 + tailSway * 2.3);
  ctx.quadraticCurveTo(-24, headY + 12 + tailSway, -14, headY + 2 + tailSway * 0.4);
  ctx.closePath(); ctx.fill();
  // hair tie
  ctx.fillStyle = '#e8c368';
  ctx.beginPath(); ctx.arc(-7.5, headY - 8, 3.1, 0, Math.PI * 2); ctx.fill();

  // ── Sword arm + blade ──
  let armAngle;
  if (player.attackT > 0) {
    const p = 1 - player.attackT / player.attackDur;
    if (player.attackKind === 'heavy') {
      armAngle = lerp(-2.4, 1.1, easeOutCubic(clamp(p * 1.35, 0, 1)));
    } else {
      // three-hit combo: horizontal, backhand, overhead
      if (player.combo === 1) armAngle = lerp(-1.9, 0.7, easeOutCubic(clamp(p * 1.5, 0, 1)));
      else if (player.combo === 2) armAngle = lerp(1.0, -1.7, easeOutCubic(clamp(p * 1.5, 0, 1)));
      else armAngle = lerp(-2.6, 1.3, easeOutCubic(clamp(p * 1.4, 0, 1)));
    }
  } else if (airborne) {
    armAngle = -0.6;
  } else {
    armAngle = -0.25 + Math.sin(runPhase) * 0.18 * (running ? 1 : 0);
  }

  ctx.save();
  ctx.translate(8, -44 + bobY);
  ctx.rotate(armAngle);
  // arm
  ctx.strokeStyle = '#ffd9c0';
  ctx.lineWidth = 5.4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
  // bracer
  ctx.strokeStyle = '#c9403a';
  ctx.lineWidth = 6.4;
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(13, 0); ctx.stroke();
  // sword
  ctx.save();
  ctx.translate(13, 0);
  const bladeLen = player.attackKind === 'heavy' && player.attackT > 0 ? 46 : 38;
  const bg = ctx.createLinearGradient(0, 0, bladeLen + 10, 0);
  bg.addColorStop(0, '#9adcff');
  bg.addColorStop(0.4, '#eafcff');
  bg.addColorStop(1, '#6fc4ee');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, -2.6);
  ctx.lineTo(bladeLen, -2.6);
  ctx.lineTo(bladeLen + 8, 0);
  ctx.lineTo(bladeLen, 2.6);
  ctx.lineTo(0, 2.6);
  ctx.closePath(); ctx.fill();
  // glow edge while attacking
  if (player.attackT > 0) {
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = '#bff3ff';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, -2.6); ctx.lineTo(bladeLen + 8, 0); ctx.stroke();
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  }
  // guard & grip
  ctx.fillStyle = '#e8c368';
  ctx.fillRect(-2, -5, 3.6, 10);
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(-8, -2.2, 6, 4.4);
  ctx.restore();
  ctx.restore();

  // Slash arc swoosh
  if (player.attackT > 0) {
    const p = 1 - player.attackT / player.attackDur;
    if (p > 0.15 && p < 0.75) {
      const alpha = Math.sin(((p - 0.15) / 0.6) * Math.PI) * 0.85;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#dff6ff';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 14;
      const arcDir = player.combo === 2 ? -1 : 1;
      ctx.beginPath();
      ctx.arc(6, -38 + bobY, 34 + p * 16, arcDir > 0 ? -0.9 : Math.PI - 0.9, arcDir > 0 ? 0.9 : Math.PI + 0.9, arcDir < 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

// ── HUD ───────────────────────────────────────────────────
function drawHUD() {
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const cw = window.innerWidth;

  // Hearts
  const heartSize = 15, pad = 16, gap = 34;
  const maxHearts = Math.ceil(player.maxHp / 20);
  for (let i = 0; i < maxHearts; i++) {
    const hpForHeart = clamp(player.hp - i * 20, 0, 20);
    const x = pad + i * gap + heartSize, y = pad + heartSize;
    ctx.save();
    ctx.translate(x, y);
    // backing
    drawHeartPath(0, 0, heartSize);
    ctx.fillStyle = 'rgba(10,6,18,0.6)';
    ctx.fill();
    // fill by fraction
    const frac = hpForHeart / 20;
    if (frac > 0) {
      ctx.save();
      drawHeartPath(0, 0, heartSize - 2);
      ctx.clip();
      ctx.fillStyle = frac > 0.5 ? '#ff5a7a' : '#ffb35c';
      ctx.fillRect(-heartSize, heartSize - 2 * heartSize * frac, heartSize * 2, heartSize * 2 * frac + 2);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    drawHeartPath(0, 0, heartSize);
    ctx.stroke();
    ctx.restore();
  }

  // Gems
  const gy = pad + heartSize * 2 + 12;
  ctx.save();
  ctx.translate(pad + 12, gy + 8);
  ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#4fd2ff';
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 10); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.font = '700 19px "Alegreya Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#dff6ff';
  ctx.fillText(String(gemsCollected), pad + 28, gy + 9);

  // Timer
  ctx.font = '600 15px "Alegreya Sans", sans-serif';
  ctx.fillStyle = 'rgba(245,236,221,0.75)';
  ctx.fillText('⏱ ' + formatTime(runTime), pad, gy + 36);

  // Boss bar
  if (boss.engaged && !boss.defeated) {
    const bw = Math.min(cw * 0.52, 560), bh = 17;
    const bx = (cw - bw) / 2, by = 18;
    ctx.font = '700 13px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = boss.phase2 ? '#ffb35c' : '#e8c368';
    ctx.fillText(boss.phase2 ? 'G H A L U S   ·   T H E   B U R N I N G   K I N G' : 'G H A L U S ,   T H E   G I L D E D   K I N G', cw / 2, by - 4);
    ctx.fillStyle = 'rgba(10,6,18,0.72)';
    roundRect(bx - 2, by, bw + 4, bh + 4, 4); ctx.fill();
    const frac = clamp(boss.hp / boss.maxHp, 0, 1);
    const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    bg.addColorStop(0, boss.phase2 ? '#ff5a2a' : '#c9403a');
    bg.addColorStop(0.5, boss.phase2 ? '#ffb35c' : '#e8c368');
    bg.addColorStop(1, boss.phase2 ? '#ff5a2a' : '#c9403a');
    ctx.fillStyle = bg;
    if (frac > 0) { roundRect(bx, by + 2, bw * frac, bh, 3); ctx.fill(); }
    // segment tick at 50%
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(bx + bw / 2 - 1, by + 2, 2, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    roundRect(bx - 2, by, bw + 4, bh + 4, 4); ctx.stroke();
  }

  // Summit progress — tiny tower glyph on right edge
  const prog = clamp(1 - (player.y / WORLD_H), 0, 1);
  const barH = Math.min(window.innerHeight * 0.42, 260), barX = cw - 14, barY = (window.innerHeight - barH) / 2;
  ctx.fillStyle = 'rgba(10,6,18,0.55)';
  roundRect(barX - 3, barY, 7, barH, 4); ctx.fill();
  ctx.fillStyle = '#4fd2ff';
  const fillH = barH * prog;
  roundRect(barX - 3, barY + barH - fillH, 7, fillH, 4); ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '11px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('▲', barX, barY - 6);

  ctx.restore();
}

// ─────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────
let lastTs = 0;
let timeAcc = 0;
const STEP = 1 / 60;
const MAX_STEPS = 6;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  let frameDt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;

  // Hitstop — freeze world briefly on impact
  if (hitstop > 0) { hitstop -= frameDt; frameDt = 0; }
  // Slow-mo on boss kill
  if (slowmo > 0) { slowmo -= frameDt; frameDt *= 0.22; }

  const t = ts / 1000;

  // Fixed-timestep simulation — stable physics at any frame rate
  timeAcc += frameDt;
  let steps = 0;
  while (timeAcc >= STEP && steps < MAX_STEPS) {
    if (gameState === 'playing') {
      runTime += STEP;
      updatePlayer(STEP);
      updateEnemies(STEP);
      updateBoss(STEP);
      updateParticles(STEP);
    } else {
      updateParticles(STEP);
    }
    timeAcc -= STEP;
    steps += 1;
    pressed.clear();   // each input edge is consumed by exactly one simulation step
  }
  if (steps === MAX_STEPS) timeAcc = 0;
  updateCamera(frameDt);

  // ── Render ──
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const shX = shakeMag ? rand(-shakeMag, shakeMag) * (shakeT > 0 ? shakeT * 3 : 0) : 0;
  const shY = shakeMag ? rand(-shakeMag, shakeMag) * (shakeT > 0 ? shakeT * 3 : 0) : 0;
  ctx.setTransform(scale, 0, 0, scale, (-camera.x + shX) * scale, (-camera.y + shY) * scale);

  drawBackground();

  // Torch flames & banners behind gameplay
  for (const b of BANNERS) drawBanner(b);
  for (const tc of TORCHES) drawTorch(tc);

  // Gilded arches (hidden passage markers)
  for (const a of HIDDEN_ARCHES) drawArchGate(a);

  // Platforms & hazards
  for (const p of PLATFORMS) drawPlatform(p);
  for (const s of SPIKES) drawSpikes(s);
  for (const f of FIRE_JETS) drawFireJet(f);

  // World props
  for (const bz of BRAZIERS) drawBrazier(bz);
  for (const c of chests) drawChest(c);
  for (const s of SIGNS) drawSign(s);

  // Pickups
  for (const g of gems) drawGem(g);
  for (const h of heartsDrop) drawHeartDrop(h);

  // Enemies
  for (const e of enemies) {
    if (e.type === 'slime') drawSlime(e);
    else if (e.type === 'goblin') drawGoblin(e);
    else if (e.type === 'bat') drawBat(e);
  }

  // Boss (+ projectiles)
  if (boss.active || boss.engaged) drawBoss(t);
  for (const p of bossProjectiles) drawBossProjectile(p);

  // Player
  if (gameState !== 'gameover') drawPlayer(t);

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = clamp(1 - p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating damage numbers
  for (const f of floaters) {
    ctx.globalAlpha = clamp(1.15 - f.t, 0, 1);
    ctx.font = `800 ${f.size}px "Alegreya Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10,6,18,0.8)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  // Boss gates — energy barriers while the fight is live
  if (bossGatesClosed && !boss.defeated) {
    const t2 = performance.now() * 0.001;
    for (const gx of [ARENA.x1 - 8, ARENA.x2 + 88]) {
      const gg = ctx.createLinearGradient(gx, 0, gx + 6, 0);
      gg.addColorStop(0, 'rgba(79,210,255,0)');
      gg.addColorStop(0.5, `rgba(79,210,255,${0.55 + 0.3 * Math.sin(t2 * 6)})`);
      gg.addColorStop(1, 'rgba(79,210,255,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(gx, camera.y - 10, 6, VIEW_H + 20);
    }
  }

  // Vignette
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.42, canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
  vg.addColorStop(0, 'rgba(8,4,16,0)');
  vg.addColorStop(1, 'rgba(8,4,16,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'playing' || gameState === 'paused') drawHUD();
}

// Pause & mute hotkeys (separate listener to act on edge press)
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] === 'pause') {
    if (gameState === 'playing' || gameState === 'paused') togglePause();
  } else if (KEYMAP[e.code] === 'mute') {
    const m = AudioEngine.toggleMuted();
    showToast(m ? 'Sound muted' : 'Sound on');
  } else if (KEYMAP[e.code] === 'confirm' && gameState === 'title') {
    startGame();
  }
});

// ─────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────
resetRun();
gameState = 'title';
showOverlay('titleScreen');
updateHudVisibility();
refreshBestLine();
requestAnimationFrame(frame);

// Debug/testing hook: open index.html?debug=1 to poke at the world from DevTools
if (URL_PARAMS.has('debug')) {
  window.__azure = { player, boss, startGame, respawnAtBrazier, enemies: () => enemies, stats: () => ({ gemsCollected, enemiesDefeated, deaths, runTime }), get state() { return gameState; }, setState(s) { gameState = s; } };
}
