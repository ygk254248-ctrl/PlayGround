// Aetherborne: The Hollow Crown — canvas renderer.
// All art is generated at runtime; there are no external image assets.

import { ROOM_W, ROOM_H, WALL } from './data.js';

const TAU = Math.PI * 2;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function hexToRgba(hex, alpha = 1) {
  const raw = String(hex).replace('#', '');
  const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(255,255,255,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let a = seed || 1;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

/* ------------------------------------------------------------------ */
/* Menu backdrop                                                      */
/* ------------------------------------------------------------------ */

export function buildStars(width, height) {
  const rand = seededRandom(Math.floor(width * 13 + height * 7 + 11));
  const stars = [];
  const count = Math.round(clamp((width * height) / 9000, 70, 170));
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height * 0.74,
      r: 0.4 + rand() * 1.5,
      a: 0.2 + rand() * 0.7,
      phase: rand() * TAU,
      speed: 0.4 + rand() * 1.4
    });
  }
  return stars;
}

export function buildMenuMotes() {
  const rand = seededRandom(8817);
  return Array.from({ length: 34 }, () => ({
    x: rand(),
    y: rand(),
    r: 0.7 + rand() * 2.1,
    phase: rand() * TAU,
    drift: 0.2 + rand() * 0.8,
    speed: 0.015 + rand() * 0.05
  }));
}

export function drawMenuScene(ctx, width, height, time, stars = [], motes = []) {
  const w = width;
  const h = height;
  ctx.save();

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#08060f');
  sky.addColorStop(0.45, '#100a18');
  sky.addColorStop(1, '#07050b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Distant violet nebula.
  const nebula = ctx.createRadialGradient(w * 0.63, h * 0.24, 10, w * 0.63, h * 0.24, w * 0.52);
  nebula.addColorStop(0, 'rgba(105, 66, 130, 0.18)');
  nebula.addColorStop(0.55, 'rgba(62, 37, 91, 0.08)');
  nebula.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, w, h);

  // Stars.
  for (const star of stars) {
    const twinkle = 0.55 + 0.45 * Math.sin(time * star.speed + star.phase);
    ctx.globalAlpha = star.a * twinkle;
    ctx.fillStyle = '#f7ead2';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Moon.
  const moonX = w * 0.735;
  const moonY = h * 0.235;
  const moonR = Math.min(w, h) * 0.105;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.2, moonX, moonY, moonR * 3.2);
  moonGlow.addColorStop(0, 'rgba(255, 232, 184, 0.2)');
  moonGlow.addColorStop(0.4, 'rgba(228, 183, 108, 0.07)');
  moonGlow.addColorStop(1, 'rgba(228, 183, 108, 0)');
  ctx.fillStyle = moonGlow;
  ctx.fillRect(0, 0, w, h);
  const moon = ctx.createRadialGradient(moonX - moonR * 0.3, moonY - moonR * 0.32, moonR * 0.1, moonX, moonY, moonR);
  moon.addColorStop(0, '#fbefd2');
  moon.addColorStop(0.55, '#cfb087');
  moon.addColorStop(0.82, '#8d6b5b');
  moon.addColorStop(1, '#4f3548');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonR, 0, TAU);
  ctx.fill();

  // Moon craters.
  ctx.fillStyle = 'rgba(84, 55, 64, 0.18)';
  [[-0.25, -0.08, 0.18], [0.2, 0.18, 0.13], [0.08, -0.33, 0.09], [-0.12, 0.32, 0.1]].forEach(([dx, dy, r]) => {
    ctx.beginPath();
    ctx.arc(moonX + dx * moonR, moonY + dy * moonR, r * moonR, 0, TAU);
    ctx.fill();
  });

  // Mountains.
  drawRidge(ctx, w, h, h * 0.53, 'rgba(18, 13, 26, 0.9)', 0.55, 1);
  drawRidge(ctx, w, h, h * 0.62, 'rgba(12, 9, 18, 0.96)', 0.8, 2);

  // The tower silhouette, rising behind the menu copy.
  drawTower(ctx, w, h, time);

  // Fog banks.
  const fog = ctx.createLinearGradient(0, h * 0.56, 0, h);
  fog.addColorStop(0, 'rgba(10, 8, 16, 0)');
  fog.addColorStop(0.55, 'rgba(9, 7, 14, 0.55)');
  fog.addColorStop(1, 'rgba(5, 4, 9, 0.92)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, h * 0.52, w, h * 0.48);

  // Slow gold motes.
  for (const mote of motes) {
    const mx = (mote.x * w + Math.sin(time * mote.drift + mote.phase) * 26 + w) % w;
    const my = (mote.y * h - ((time * mote.speed * 40) % (h * 0.5)) + h * 0.5) % (h * 0.9);
    const a = 0.14 + 0.2 * (0.5 + 0.5 * Math.sin(time * 0.8 + mote.phase));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffdb99';
    glow(ctx, '#ffdb99', 8);
    ctx.beginPath();
    ctx.arc(mx, my, mote.r, 0, TAU);
    ctx.fill();
    noGlow(ctx);
  }
  ctx.globalAlpha = 1;

  // Moonlit dust rays.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const angle = -0.7 + i * 0.17;
    const grad = ctx.createLinearGradient(moonX, moonY, moonX + Math.cos(angle) * w, moonY + Math.sin(angle) * h);
    grad.addColorStop(0, 'rgba(255, 223, 166, 0.035)');
    grad.addColorStop(1, 'rgba(255, 223, 166, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(moonX, moonY);
    ctx.lineTo(moonX + Math.cos(angle - 0.05) * w * 0.9, moonY + Math.sin(angle - 0.05) * h * 0.9);
    ctx.lineTo(moonX + Math.cos(angle + 0.05) * w * 0.9, moonY + Math.sin(angle + 0.05) * h * 0.9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

function drawRidge(ctx, w, h, baseY, color, rough, seed) {
  const rand = seededRandom(900 + seed * 77 + Math.floor(w));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);
  let x = 0;
  while (x < w) {
    const step = 55 + rand() * 110;
    const peak = baseY - (12 + rand() * 70) * rough;
    ctx.lineTo(x + step * 0.45, peak);
    ctx.lineTo(x + step, baseY + rand() * 16);
    x += step;
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawTower(ctx, w, h, time) {
  const cx = w * 0.79;
  const base = h * 0.83;
  const top = h * 0.16;
  const bodyW = w * 0.135;
  ctx.save();

  // Halo behind the spire.
  const halo = ctx.createRadialGradient(cx, h * 0.35, 20, cx, h * 0.35, w * 0.34);
  halo.addColorStop(0, 'rgba(228, 183, 108, 0.1)');
  halo.addColorStop(1, 'rgba(228, 183, 108, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - w * 0.4, 0, w * 0.8, h);

  const stone = ctx.createLinearGradient(cx - bodyW / 2, 0, cx + bodyW / 2, 0);
  stone.addColorStop(0, '#0b0811');
  stone.addColorStop(0.4, '#171020');
  stone.addColorStop(0.7, '#100b17');
  stone.addColorStop(1, '#07050b');

  // Main keep.
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(cx - bodyW / 2, base);
  ctx.lineTo(cx - bodyW * 0.34, top + h * 0.18);
  ctx.lineTo(cx - bodyW * 0.2, top + h * 0.1);
  ctx.lineTo(cx - bodyW * 0.17, top);
  ctx.lineTo(cx + bodyW * 0.17, top);
  ctx.lineTo(cx + bodyW * 0.2, top + h * 0.1);
  ctx.lineTo(cx + bodyW * 0.34, top + h * 0.18);
  ctx.lineTo(cx + bodyW / 2, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(228, 183, 108, 0.13)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Side spires.
  [[-0.44, 0.62, 0.36], [0.46, 0.58, 0.42]].forEach(([off, yScale, widthScale]) => {
    const sx = cx + bodyW * off;
    const sBase = base - h * 0.02;
    const sTop = h * yScale;
    ctx.fillStyle = '#0a0710';
    ctx.beginPath();
    ctx.moveTo(sx - bodyW * 0.11 * widthScale, sBase);
    ctx.lineTo(sx - bodyW * 0.07 * widthScale, sTop);
    ctx.lineTo(sx, sTop - h * 0.055);
    ctx.lineTo(sx + bodyW * 0.07 * widthScale, sTop);
    ctx.lineTo(sx + bodyW * 0.11 * widthScale, sBase);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(228, 183, 108, 0.08)';
    ctx.stroke();
  });

  // Buttresses.
  ctx.fillStyle = '#08060d';
  ctx.beginPath();
  ctx.moveTo(cx - bodyW * 0.55, base);
  ctx.lineTo(cx - bodyW * 0.36, top + h * 0.32);
  ctx.lineTo(cx - bodyW * 0.38, base);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + bodyW * 0.55, base);
  ctx.lineTo(cx + bodyW * 0.36, top + h * 0.32);
  ctx.lineTo(cx + bodyW * 0.38, base);
  ctx.closePath();
  ctx.fill();

  // Windows.
  const windows = [
    [0, 0.32, 0.8], [0, 0.44, 1], [0, 0.56, 0.85], [0, 0.68, 1], [0, 0.78, 0.72],
    [-0.16, 0.4, 0.6], [0.16, 0.4, 0.6], [-0.16, 0.56, 0.6], [0.16, 0.56, 0.6],
    [-0.16, 0.72, 0.55], [0.16, 0.72, 0.55]
  ];
  for (const [ox, oy, scale] of windows) {
    const wx = cx + ox * bodyW;
    const wy = top + h * 0.1 + (base - top - h * 0.1) * (oy - 0.28) / 0.55;
    const flicker = 0.65 + 0.35 * Math.sin(time * (1.1 + ox * 2 + oy) + ox * 9);
    ctx.globalAlpha = 0.75 * flicker;
    ctx.fillStyle = '#ffcf8a';
    glow(ctx, '#ffb45e', 16);
    roundRect(ctx, wx - 2.6 * scale, wy - 7 * scale, 5.2 * scale, 14 * scale, 2.6 * scale);
    ctx.fill();
    noGlow(ctx);
  }
  ctx.globalAlpha = 1;

  // Crown-like finial.
  ctx.strokeStyle = 'rgba(255, 219, 153, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, top - h * 0.012, bodyW * 0.11, Math.PI * 1.06, Math.PI * 1.94);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * bodyW * 0.045, top - h * 0.015);
    ctx.lineTo(cx + i * bodyW * 0.056, top - h * 0.048);
    ctx.stroke();
  }

  // Stair terraces in the foreground.
  ctx.fillStyle = 'rgba(6, 5, 10, 0.86)';
  for (let i = 0; i < 7; i++) {
    const sw = w * (0.12 + i * 0.055);
    const sy = base + i * h * 0.022;
    ctx.fillRect(cx - sw / 2, sy, sw, h * 0.026);
    ctx.strokeStyle = 'rgba(228, 183, 108, 0.04)';
    ctx.strokeRect(cx - sw / 2, sy, sw, h * 0.026);
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Room backgrounds                                                   */
/* ------------------------------------------------------------------ */

const DIR_LIST = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0]
];

export function buildRoomBackground(room, theme) {
  const canvas = document.createElement('canvas');
  canvas.width = ROOM_W;
  canvas.height = ROOM_H;
  const c = canvas.getContext('2d');
  const rand = seededRandom(hashString(room.key + theme.id + room.name));

  c.fillStyle = theme.sky;
  c.fillRect(0, 0, ROOM_W, ROOM_H);

  const floorX = WALL;
  const floorY = WALL;
  const floorW = ROOM_W - WALL * 2;
  const floorH = ROOM_H - WALL * 2;

  // Floor base.
  const floor = c.createLinearGradient(0, floorY, 0, floorY + floorH);
  floor.addColorStop(0, theme.floorAlt);
  floor.addColorStop(0.45, theme.floor);
  floor.addColorStop(1, theme.floorAlt);
  c.fillStyle = floor;
  c.fillRect(floorX, floorY, floorW, floorH);

  // Flagstones.
  const tile = 76;
  for (let y = floorY; y < floorY + floorH; y += tile) {
    for (let x = floorX; x < floorX + floorW; x += tile) {
      const shade = rand();
      c.fillStyle = shade > 0.72
        ? hexToRgba(theme.wallTop, 0.16)
        : shade < 0.18 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.012)';
      c.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      c.strokeStyle = hexToRgba(theme.grout, 0.85);
      c.lineWidth = 2;
      c.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      if (rand() > 0.86) {
        c.strokeStyle = 'rgba(0,0,0,0.28)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 12 + rand() * 30, y + 8);
        c.lineTo(x + 20 + rand() * 28, y + 30 + rand() * 26);
        c.lineTo(x + 30 + rand() * 30, y + 50 + rand() * 18);
        c.stroke();
      }
    }
  }

  // Floor shadow pools at the walls.
  const innerShadow = c.createLinearGradient(0, floorY, 0, floorY + 90);
  innerShadow.addColorStop(0, 'rgba(0,0,0,0.52)');
  innerShadow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = innerShadow;
  c.fillRect(floorX, floorY, floorW, 90);
  const innerShadowB = c.createLinearGradient(0, floorY + floorH, 0, floorY + floorH - 90);
  innerShadowB.addColorStop(0, 'rgba(0,0,0,0.48)');
  innerShadowB.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = innerShadowB;
  c.fillRect(floorX, floorY + floorH - 90, floorW, 90);

  // Central floor sigil.
  const sigilX = ROOM_W / 2;
  const sigilY = ROOM_H / 2 + 8;
  const sigilR = room.type === 'boss' ? 176 : 118;
  c.save();
  c.globalAlpha = 0.34;
  c.strokeStyle = theme.rune;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(sigilX, sigilY, sigilR, 0, TAU);
  c.stroke();
  c.beginPath();
  c.arc(sigilX, sigilY, sigilR * 0.78, 0, TAU);
  c.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    c.beginPath();
    c.moveTo(sigilX + Math.cos(a) * sigilR * 0.78, sigilY + Math.sin(a) * sigilR * 0.78);
    c.lineTo(sigilX + Math.cos(a) * sigilR * 0.92, sigilY + Math.sin(a) * sigilR * 0.92);
    c.stroke();
  }
  c.globalAlpha = 0.19;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    c.save();
    c.translate(sigilX, sigilY);
    c.rotate(a);
    c.beginPath();
    c.moveTo(-sigilR * 0.55, 0);
    c.lineTo(0, -sigilR * 0.2);
    c.lineTo(sigilR * 0.55, 0);
    c.lineTo(0, sigilR * 0.2);
    c.closePath();
    c.stroke();
    c.restore();
  }
  c.restore();

  // Wall stonework.
  drawWallBand(c, 0, 0, ROOM_W, WALL, theme, rand, 'horizontal');
  drawWallBand(c, 0, ROOM_H - WALL, ROOM_W, WALL, theme, rand, 'horizontal');
  drawWallBand(c, 0, 0, WALL, ROOM_H, theme, rand, 'vertical');
  drawWallBand(c, ROOM_W - WALL, 0, WALL, ROOM_H, theme, rand, 'vertical');

  // Corner towers.
  for (const [cx, cy] of [[WALL / 2, WALL / 2], [ROOM_W - WALL / 2, WALL / 2], [WALL / 2, ROOM_H - WALL / 2], [ROOM_W - WALL / 2, ROOM_H - WALL / 2]]) {
    const corner = c.createRadialGradient(cx, cy, 8, cx, cy, 96);
    corner.addColorStop(0, hexToRgba(theme.wallTop, 0.55));
    corner.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = corner;
    c.fillRect(cx - 100, cy - 100, 200, 200);
  }

  // Torch sconces.
  const torchSpots = [
    [WALL + 34, WALL + 30], [ROOM_W - WALL - 34, WALL + 30],
    [WALL + 34, ROOM_H - WALL - 30], [ROOM_W - WALL - 34, ROOM_H - WALL - 30]
  ];
  for (const [tx, ty] of torchSpots) {
    const g = c.createRadialGradient(tx, ty, 2, tx, ty, 72);
    g.addColorStop(0, hexToRgba(theme.accent, 0.4));
    g.addColorStop(0.4, hexToRgba(theme.accent, 0.11));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(tx - 76, ty - 76, 152, 152);
    c.fillStyle = 'rgba(20, 14, 18, 0.9)';
    roundRect(c, tx - 5, ty - 5, 10, 18, 2);
    c.fill();
    c.fillStyle = hexToRgba(theme.accent, 0.85);
    c.beginPath();
    c.moveTo(tx, ty - 13);
    c.quadraticCurveTo(tx + 7, ty - 3, tx, ty + 4);
    c.quadraticCurveTo(tx - 7, ty - 3, tx, ty - 13);
    c.fill();
  }

  // Doors.
  for (const [dir, dx, dy] of DIR_LIST) {
    if (!room.doors[dir]) continue;
    drawDoor(c, dir, theme, rand);
  }

  // Faint color wash to bind the palette together.
  const wash = c.createRadialGradient(ROOM_W / 2, ROOM_H / 2, 80, ROOM_W / 2, ROOM_H / 2, ROOM_W * 0.7);
  wash.addColorStop(0, hexToRgba(theme.accent, 0.025));
  wash.addColorStop(1, hexToRgba(theme.sky, 0.18));
  c.fillStyle = wash;
  c.fillRect(0, 0, ROOM_W, ROOM_H);

  // Vignette baked into the backdrop.
  const vig = c.createRadialGradient(ROOM_W / 2, ROOM_H / 2, ROOM_H * 0.28, ROOM_W / 2, ROOM_H / 2, ROOM_W * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.42)');
  c.fillStyle = vig;
  c.fillRect(0, 0, ROOM_W, ROOM_H);

  return canvas;
}

function drawWallBand(c, x, y, w, h, theme, rand, orientation) {
  const grad = c.createLinearGradient(x, y, x + (orientation === 'horizontal' ? 0 : w), y + (orientation === 'horizontal' ? h : 0));
  grad.addColorStop(0, '#08060d');
  grad.addColorStop(0.35, theme.wall);
  grad.addColorStop(1, theme.wallTop);
  c.fillStyle = grad;
  c.fillRect(x, y, w, h);

  c.strokeStyle = 'rgba(0,0,0,0.4)';
  c.lineWidth = 1;
  if (orientation === 'horizontal') {
    for (let bx = x; bx < x + w; bx += 62) {
      const bh = 18 + rand() * 18;
      c.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.1)';
      c.fillRect(bx + 2, y + rand() * (h - bh), 58, bh);
      c.strokeRect(bx + 2, y + 2, 58, h - 4);
    }
    c.fillStyle = 'rgba(0,0,0,0.38)';
    c.fillRect(x, y + h - 7, w, 7);
  } else {
    for (let by = y; by < y + h; by += 62) {
      const bw = 18 + rand() * 18;
      c.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.1)';
      c.fillRect(x + rand() * (w - bw), by + 2, bw, 58);
      c.strokeRect(x + 2, by + 2, w - 4, 58);
    }
    c.fillStyle = 'rgba(0,0,0,0.34)';
    c.fillRect(x + (x === 0 ? w - 7 : 0), y, 7, h);
  }

  // Top highlight.
  c.fillStyle = hexToRgba(theme.wallTop, 0.35);
  if (orientation === 'horizontal') c.fillRect(x, y + (y === 0 ? h - 3 : 0), w, 3);
  else c.fillRect(x + (x === 0 ? w - 3 : 0), y, 3, h);
}

function drawDoor(c, dir, theme, rand) {
  const horizontal = dir === 'n' || dir === 's';
  const half = 78;
  let x, y, w, h;
  if (dir === 'n') { x = ROOM_W / 2 - half; y = 0; w = half * 2; h = WALL; }
  else if (dir === 's') { x = ROOM_W / 2 - half; y = ROOM_H - WALL; w = half * 2; h = WALL; }
  else if (dir === 'w') { x = 0; y = ROOM_H / 2 - half; w = WALL; h = half * 2; }
  else { x = ROOM_W - WALL; y = ROOM_H / 2 - half; w = WALL; h = half * 2; }

  // Dark passage.
  const dark = c.createLinearGradient(
    x + (horizontal ? 0 : (dir === 'w' ? 0 : w)),
    y + (horizontal ? (dir === 'n' ? 0 : h) : 0),
    x + (horizontal ? 0 : (dir === 'w' ? w : 0)),
    y + (horizontal ? (dir === 'n' ? h : 0) : 0)
  );
  dark.addColorStop(0, 'rgba(0,0,0,0.92)');
  dark.addColorStop(0.7, 'rgba(4,3,8,0.86)');
  dark.addColorStop(1, 'rgba(22,15,26,0.7)');
  c.fillStyle = dark;
  c.fillRect(x + 8, y + 8, w - 16, h - 16);

  // Stone frame.
  c.fillStyle = hexToRgba(theme.wallTop, 0.7);
  if (horizontal) {
    c.fillRect(x - 10, y + (dir === 'n' ? 0 : h - 10), w + 20, 10);
    c.fillStyle = hexToRgba(theme.accent, 0.28);
    c.fillRect(x - 4, y + (dir === 'n' ? h - 4 : 0), w + 8, 4);
    c.fillStyle = hexToRgba(theme.wallTop, 0.9);
    c.fillRect(x - 12, y, 12, h);
    c.fillRect(x + w, y, 12, h);
  } else {
    c.fillRect(x + (dir === 'w' ? 0 : w - 10), y - 10, 10, h + 20);
    c.fillStyle = hexToRgba(theme.accent, 0.28);
    c.fillRect(x + (dir === 'w' ? w - 4 : 0), y - 4, 4, h + 8);
    c.fillStyle = hexToRgba(theme.wallTop, 0.9);
    c.fillRect(x, y - 12, w, 12);
    c.fillRect(x, y + h, w, 12);
  }

  // Carved lintel runes.
  c.save();
  c.globalAlpha = 0.55;
  c.strokeStyle = theme.rune;
  c.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const rx = x + 22 + i * ((w - 44) / 4);
    const ry = horizontal ? (dir === 'n' ? 14 : ROOM_H - 14) : y + 22 + i * ((h - 44) / 4);
    c.beginPath();
    if (horizontal) {
      c.moveTo(rx - 3, ry);
      c.lineTo(rx, ry - 4);
      c.lineTo(rx + 3, ry);
      c.lineTo(rx, ry + 4);
    } else {
      c.moveTo(x + (dir === 'w' ? 14 : ROOM_W - 14), ry - 3);
      c.lineTo(x + (dir === 'w' ? 18 : ROOM_W - 18), ry);
      c.lineTo(x + (dir === 'w' ? 14 : ROOM_W - 14), ry + 3);
      c.lineTo(x + (dir === 'w' ? 10 : ROOM_W - 10), ry);
    }
    c.closePath();
    c.stroke();
  }
  c.restore();

  // Threshold shadow.
  c.fillStyle = 'rgba(0,0,0,0.28)';
  if (horizontal) c.fillRect(x - 10, y + (dir === 'n' ? h : -26), w + 20, 26);
  else c.fillRect(x + (dir === 'w' ? w : -26), y - 10, 26, h + 20);
}

/* ------------------------------------------------------------------ */
/* World rendering                                                    */
/* ------------------------------------------------------------------ */

export function drawWorld(ctx, game) {
  const w = game.width;
  const h = game.height;
  const theme = game.floorData?.theme || {
    sky: '#08060d', floor: '#171019', floorAlt: '#1d141f', grout: '#0a070c',
    wall: '#2a1c29', wallTop: '#443047', accent: '#e4b76c', accent2: '#f17d8d',
    glow: 'rgba(228,183,108,0.5)', fog: 'rgba(8,6,13,0.6)', rune: '#e4b76c', motes: '#ffdb99'
  };

  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, theme.sky);
  bg.addColorStop(0.5, '#05040a');
  bg.addColorStop(1, '#030207');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const room = game.room;
  if (!room) {
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  const scale = Math.min(w / ROOM_W, h / ROOM_H);
  const marginX = (w - ROOM_W * scale) / 2;
  const marginY = (h - ROOM_H * scale) / 2;
  const camX = game.camera?.x ?? ROOM_W / 2;
  const camY = game.camera?.y ?? ROOM_H / 2;
  const shiftX = clamp((camX - ROOM_W / 2) * scale * 0.32, -marginX * 0.85, marginX * 0.85);
  const shiftY = clamp((camY - ROOM_H / 2) * scale * 0.25, -marginY * 0.75, marginY * 0.75);
  const ox = marginX - shiftX;
  const oy = marginY - shiftY;

  game.view = { scale, ox, oy };

  let shakeX = 0;
  let shakeY = 0;
  const shake = game.camera?.shake || 0;
  if (shake > 0.1 && game.save?.settings?.shake !== false) {
    shakeX = (Math.random() - 0.5) * shake;
    shakeY = (Math.random() - 0.5) * shake;
  }

  ctx.translate(ox + shakeX, oy + shakeY);
  ctx.scale(scale, scale);

  if (room.bg) ctx.drawImage(room.bg, 0, 0);
  else {
    ctx.fillStyle = theme.floor;
    ctx.fillRect(WALL, WALL, ROOM_W - WALL * 2, ROOM_H - WALL * 2);
  }

  drawDoorStates(ctx, game, room, theme);
  drawInteractables(ctx, game, room, theme);
  drawObstacles(ctx, game);
  drawHazards(ctx, game);
  drawPickups(ctx, game);
  drawEffects(ctx, game);

  const entities = [];
  for (const enemy of game.enemies) {
    if (!enemy.dead) entities.push({ y: enemy.y, enemy });
  }
  if (game.player?.alive) entities.push({ y: game.player.y, player: true });
  entities.sort((a, b) => a.y - b.y);
  for (const item of entities) {
    if (item.enemy) drawEnemy(ctx, item.enemy, game, theme);
    else drawPlayer(ctx, game.player, game, theme);
  }

  drawProjectiles(ctx, game);
  drawParticles(ctx, game);
  drawFloatingTexts(ctx, game);
  ctx.restore();

  if (game.fade > 0.001) {
    ctx.fillStyle = `rgba(4, 3, 8, ${clamp(game.fade, 0, 1)})`;
    ctx.fillRect(0, 0, w, h);
  }

  drawBanner(ctx, game, w, h);
}

function drawDoorStates(ctx, game, room, theme) {
  const cleared = room.cleared;
  for (const [dir] of DIR_LIST) {
    if (!room.doors[dir]) continue;
    let x, y;
    if (dir === 'n') { x = ROOM_W / 2; y = 22; }
    else if (dir === 's') { x = ROOM_W / 2; y = ROOM_H - 22; }
    else if (dir === 'w') { x = 22; y = ROOM_H / 2; }
    else { x = ROOM_W - 22; y = ROOM_H / 2; }

    const pulse = 0.6 + 0.4 * Math.sin(game.time * 2.2 + x * 0.01 + y * 0.01);
    if (cleared) {
      const g = ctx.createRadialGradient(x, y, 2, x, y, 92);
      g.addColorStop(0, hexToRgba(theme.accent, 0.26 * pulse));
      g.addColorStop(0.45, hexToRgba(theme.accent, 0.08));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 96, y - 96, 192, 192);

      // Animated chevrons mark a passage that can be walked through.
      const outAngle = dir === 'n' ? Math.PI : dir === 's' ? 0 : dir === 'e' ? -Math.PI / 2 : Math.PI / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(outAngle);
      ctx.strokeStyle = hexToRgba(theme.accent, 0.5 + 0.35 * pulse);
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 2; i++) {
        const off = 16 + i * 14 + (Math.sin(game.time * 2.4) * 2);
        ctx.beginPath();
        ctx.moveTo(-10, off - 7);
        ctx.lineTo(0, off + 3);
        ctx.lineTo(10, off - 7);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      const g = ctx.createRadialGradient(x, y, 2, x, y, 78);
      g.addColorStop(0, hexToRgba(theme.accent2, 0.2));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 82, y - 82, 164, 164);
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = hexToRgba(theme.accent2, 0.5 * pulse);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, TAU);
      ctx.stroke();
      ctx.rotate(game.time * 0.4);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -19);
        ctx.lineTo(5, -27);
        ctx.lineTo(-5, -27);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawInteractables(ctx, game, room, theme) {
  const time = game.time;
  if (room.type === 'treasure') {
    drawChest(ctx, ROOM_W / 2, ROOM_H / 2 + 8, room.chestOpened, theme, time);
  } else if (room.type === 'shrine') {
    drawShrine(ctx, ROOM_W / 2, ROOM_H / 2 + 8, room.shrineUsed, theme, time);
  } else if (room.type === 'exit' || (room.type === 'boss' && room.cleared)) {
    drawPortal(ctx, ROOM_W / 2, ROOM_H / 2, game.run?.sealBroken, theme, time);
  }
}

function drawChest(ctx, x, y, opened, theme, time) {
  ctx.save();
  const glowColor = opened ? 'rgba(120,227,199,0.1)' : hexToRgba(theme.accent, 0.22);
  const g = ctx.createRadialGradient(x, y, 4, x, y, opened ? 64 : 100);
  g.addColorStop(0, glowColor);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 110, y - 110, 220, 220);

  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(x, y + 24, 44, 15, 0, 0, TAU);
  ctx.fill();

  // Chest body.
  const grd = ctx.createLinearGradient(x - 40, y - 14, x + 40, y + 34);
  grd.addColorStop(0, '#3a2722');
  grd.addColorStop(0.5, '#231719');
  grd.addColorStop(1, '#110c10');
  ctx.fillStyle = grd;
  roundRect(ctx, x - 38, y - 10, 76, 44, 4);
  ctx.fill();
  ctx.strokeStyle = opened ? 'rgba(120,227,199,0.4)' : hexToRgba(theme.accent, 0.66);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bands.
  ctx.strokeStyle = 'rgba(228,183,108,0.42)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 8);
  ctx.lineTo(x - 14, y + 32);
  ctx.moveTo(x + 14, y - 8);
  ctx.lineTo(x + 14, y + 32);
  ctx.stroke();

  // Lid.
  ctx.save();
  ctx.translate(x, y - 8);
  if (opened) {
    ctx.rotate(-0.62);
    ctx.translate(-22, -2);
  }
  const lid = ctx.createLinearGradient(0, -22, 0, 4);
  lid.addColorStop(0, '#4a332a');
  lid.addColorStop(1, '#221719');
  ctx.fillStyle = lid;
  roundRect(ctx, -40, -20, 80, 25, 5);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(theme.accent, 0.55);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // Lock.
  ctx.fillStyle = opened ? theme.accent2 : hexToRgba(theme.accent, 0.9);
  ctx.beginPath();
  ctx.arc(x, y + 13, 5, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - 1.5, y + 15, 3, 8);

  // Sparkles.
  if (!opened) {
    for (let i = 0; i < 4; i++) {
      const a = time * 0.8 + i * 1.7;
      const sx = x + Math.cos(a) * (30 + i * 4);
      const sy = y - 18 + Math.sin(a * 1.3) * 12;
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(time * 2 + i);
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawShrine(ctx, x, y, used, theme, time) {
  ctx.save();
  const active = !used;
  const pulse = 0.55 + 0.45 * Math.sin(time * 2.4);
  const g = ctx.createRadialGradient(x, y - 8, 4, x, y - 8, active ? 124 : 58);
  g.addColorStop(0, active ? hexToRgba(theme.rune, 0.3 * pulse) : 'rgba(120,227,199,0.08)');
  g.addColorStop(0.6, active ? hexToRgba(theme.accent, 0.08) : 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 130, y - 135, 260, 260);

  // Base.
  ctx.fillStyle = '#1b1620';
  ctx.beginPath();
  ctx.moveTo(x - 36, y + 34);
  ctx.lineTo(x - 24, y + 12);
  ctx.lineTo(x + 24, y + 12);
  ctx.lineTo(x + 36, y + 34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexToRgba(theme.accent, 0.35);
  ctx.stroke();

  ctx.fillStyle = '#2a2130';
  roundRect(ctx, x - 30, y + 2, 60, 16, 3);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(theme.accent, 0.4);
  ctx.stroke();

  // Floating crystal.
  const floatY = y - 28 + Math.sin(time * 1.8) * 4;
  ctx.translate(x, floatY);
  ctx.rotate(time * 0.25);
  if (active) glow(ctx, theme.rune, 24);
  const crystal = ctx.createLinearGradient(-12, -22, 12, 22);
  crystal.addColorStop(0, active ? '#e6fff9' : '#5d6e6a');
  crystal.addColorStop(0.5, active ? theme.accent : '#39464a');
  crystal.addColorStop(1, active ? '#2b7f74' : '#1a2426');
  ctx.fillStyle = crystal;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(15, -4);
  ctx.lineTo(8, 24);
  ctx.lineTo(-8, 24);
  ctx.lineTo(-15, -4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  noGlow(ctx);

  if (active) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = theme.rune;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPortal(ctx, x, y, active, theme, time) {
  ctx.save();
  const pulse = 0.55 + 0.45 * Math.sin(time * 1.7);
  const color = active ? theme.accent : theme.accent2;
  const radius = 86;
  const g = ctx.createRadialGradient(x, y, 4, x, y, radius * 1.7);
  g.addColorStop(0, hexToRgba(color, active ? 0.3 * pulse : 0.12));
  g.addColorStop(0.45, hexToRgba(color, active ? 0.1 : 0.04));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - radius * 2, y - radius * 2, radius * 4, radius * 4);

  // Outer rings.
  ctx.strokeStyle = hexToRgba(color, active ? 0.7 : 0.4);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.74, 0, TAU);
  ctx.stroke();

  // Rune ticks.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * (active ? 0.35 : 0.08));
  for (let i = 0; i < 12; i++) {
    ctx.rotate(TAU / 12);
    ctx.beginPath();
    ctx.moveTo(radius * 0.83, 0);
    ctx.lineTo(radius * (active ? 1.02 : 0.9), 0);
    ctx.stroke();
  }
  ctx.restore();

  // Inner void.
  const inner = ctx.createRadialGradient(x, y, 2, x, y, radius * 0.68);
  inner.addColorStop(0, active ? hexToRgba(color, 0.5 * pulse) : 'rgba(8,5,12,0.9)');
  inner.addColorStop(0.6, active ? hexToRgba(color, 0.14) : 'rgba(4,3,8,0.9)');
  inner.addColorStop(1, 'rgba(2,1,5,0.95)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.68, 0, TAU);
  ctx.fill();

  if (active) {
    // Upward beam.
    const beam = ctx.createLinearGradient(x, y - 260, x, y + 20);
    beam.addColorStop(0, 'rgba(0,0,0,0)');
    beam.addColorStop(0.7, hexToRgba(color, 0.08));
    beam.addColorStop(1, hexToRgba(color, 0.18));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 10);
    ctx.lineTo(x - 48, y - 270);
    ctx.lineTo(x + 48, y - 270);
    ctx.lineTo(x + 10, y - 10);
    ctx.closePath();
    ctx.fill();

    // Rising motes.
    for (let i = 0; i < 6; i++) {
      const a = time * 0.9 + i * 1.4;
      const rr = 18 + (i % 3) * 20;
      const yy = y - ((time * 26 + i * 22) % 170);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * rr, yy, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    // Sealed chain cross.
    ctx.strokeStyle = 'rgba(241,125,141,0.36)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 54, y - 54);
    ctx.lineTo(x + 54, y + 54);
    ctx.moveTo(x + 54, y - 54);
    ctx.lineTo(x - 54, y + 54);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacles(ctx, game) {
  const obstacles = game.room?.obstacles || [];
  if (!obstacles.length) return;
  const theme = game.floorData?.theme || { accent: '#e4b76c', rune: '#e4b76c', accent2: '#f17d8d', wallTop: '#443047' };
  const time = game.time;

  for (const o of obstacles) {
    const rand = seededRandom(Math.floor((o.seed || 0.5) * 100000) + 31);
    const r = o.r;
    ctx.save();

    // Ground shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + r * 0.58, r * 1.22, r * 0.46, 0, 0, TAU);
    ctx.fill();

    if (o.kind === 'crystal') {
      const pulse = 0.6 + 0.4 * Math.sin(time * 2 + (o.seed || 0) * 9);
      const glowR = r * 2.6;
      const g = ctx.createRadialGradient(o.x, o.y - r * 0.2, 2, o.x, o.y - r * 0.2, glowR);
      g.addColorStop(0, hexToRgba(theme.rune, 0.2 * pulse));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(o.x - glowR, o.y - glowR - r * 0.2, glowR * 2, glowR * 2);

      const shards = [
        [0, -r * 0.2, r * 0.42, r * 1.15, 0],
        [-r * 0.5, 0, r * 0.3, r * 0.8, -0.32],
        [r * 0.48, -r * 0.05, r * 0.26, r * 0.68, 0.3],
        [r * 0.08, -r * 0.6, r * 0.18, r * 0.5, 0.12]
      ];
      for (const [ox, oy, sw, sh, rot] of shards) {
        ctx.save();
        ctx.translate(o.x + ox, o.y + oy);
        ctx.rotate(rot + Math.sin(time * 0.5 + ox) * 0.02);
        const crystal = ctx.createLinearGradient(-sw, -sh, sw, sh * 0.4);
        crystal.addColorStop(0, '#f3fffb');
        crystal.addColorStop(0.4, theme.accent);
        crystal.addColorStop(1, '#1c4f49');
        ctx.fillStyle = crystal;
        glow(ctx, theme.rune, 10 * pulse);
        ctx.beginPath();
        ctx.moveTo(0, -sh);
        ctx.lineTo(sw, -sh * 0.18);
        ctx.lineTo(sw * 0.5, sh * 0.5);
        ctx.lineTo(-sw * 0.5, sh * 0.5);
        ctx.lineTo(-sw, -sh * 0.18);
        ctx.closePath();
        ctx.fill();
        noGlow(ctx);
        ctx.strokeStyle = 'rgba(255,255,255,0.32)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      // Stone base.
      ctx.fillStyle = '#211b24';
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + r * 0.46, r * 0.9, r * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(theme.accent, 0.32);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (o.kind === 'statue') {
      // Pedestal.
      const ped = ctx.createLinearGradient(o.x - r, o.y, o.x + r, o.y);
      ped.addColorStop(0, '#17131c');
      ped.addColorStop(0.45, '#332c38');
      ped.addColorStop(1, '#100d14');
      ctx.fillStyle = ped;
      roundRect(ctx, o.x - r * 0.78, o.y - r * 0.1, r * 1.56, r * 0.78, 3);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(theme.accent, 0.28);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(o.x - r * 0.7, o.y - r * 0.02, r * 1.4, 3);

      // Robed figure.
      const robe = ctx.createLinearGradient(o.x, o.y - r * 1.9, o.x, o.y + r * 0.4);
      robe.addColorStop(0, '#5b5068');
      robe.addColorStop(0.45, '#332c3e');
      robe.addColorStop(1, '#16121c');
      ctx.fillStyle = robe;
      ctx.beginPath();
      ctx.moveTo(o.x, o.y - r * 1.62);
      ctx.quadraticCurveTo(o.x + r * 0.72, o.y - r * 0.9, o.x + r * 0.66, o.y + r * 0.26);
      ctx.lineTo(o.x - r * 0.66, o.y + r * 0.26);
      ctx.quadraticCurveTo(o.x - r * 0.72, o.y - r * 0.9, o.x, o.y - r * 1.62);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexToRgba(theme.accent, 0.22);
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Hood and face.
      ctx.fillStyle = '#0e0a12';
      ctx.beginPath();
      ctx.arc(o.x, o.y - r * 1.36, r * 0.38, Math.PI * 0.98, Math.PI * 2.02);
      ctx.fill();
      ctx.fillStyle = hexToRgba(theme.accent, 0.7 + 0.3 * Math.sin(time * 1.4 + (o.seed || 0) * 7));
      ctx.beginPath();
      ctx.arc(o.x - r * 0.13, o.y - r * 1.3, 1.6, 0, TAU);
      ctx.arc(o.x + r * 0.13, o.y - r * 1.3, 1.6, 0, TAU);
      ctx.fill();

      // Spear / staff.
      ctx.strokeStyle = '#4b3d2d';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(o.x + r * 0.56, o.y + r * 0.2);
      ctx.lineTo(o.x + r * 0.56, o.y - r * 1.9);
      ctx.stroke();
      ctx.fillStyle = hexToRgba(theme.accent, 0.8);
      ctx.beginPath();
      ctx.moveTo(o.x + r * 0.56, o.y - r * 2.18);
      ctx.lineTo(o.x + r * 0.72, o.y - r * 1.86);
      ctx.lineTo(o.x + r * 0.56, o.y - r * 1.94);
      ctx.lineTo(o.x + r * 0.4, o.y - r * 1.86);
      ctx.closePath();
      ctx.fill();
    } else {
      // Pillar.
      const shaftW = r * 1.5;
      const top = o.y - r * 2.25;
      const bottom = o.y + r * 0.34;
      const shaft = ctx.createLinearGradient(o.x - shaftW / 2, 0, o.x + shaftW / 2, 0);
      shaft.addColorStop(0, '#0e0b12');
      shaft.addColorStop(0.35, '#3a3141');
      shaft.addColorStop(0.6, '#4c4053');
      shaft.addColorStop(1, '#141018');
      ctx.fillStyle = shaft;
      ctx.fillRect(o.x - shaftW / 2, top, shaftW, bottom - top);
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(o.x - shaftW / 2, top, shaftW, bottom - top);

      // Flutes.
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.4;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(o.x + i * shaftW * 0.22, top + 6);
        ctx.lineTo(o.x + i * shaftW * 0.22, bottom - 4);
        ctx.stroke();
      }

      // Capital and base.
      const cap = ctx.createLinearGradient(0, top - 10, 0, top + 8);
      cap.addColorStop(0, '#5b4d61');
      cap.addColorStop(1, '#221b28');
      ctx.fillStyle = cap;
      roundRect(ctx, o.x - r * 0.95, top - r * 0.34, r * 1.9, r * 0.4, 2);
      ctx.fill();
      ctx.fillStyle = '#2a2230';
      roundRect(ctx, o.x - r * 0.95, bottom - r * 0.18, r * 1.9, r * 0.44, 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(theme.accent, 0.24);
      ctx.lineWidth = 1.1;
      ctx.stroke();

      // Rune band.
      ctx.strokeStyle = hexToRgba(theme.rune, 0.32 + 0.16 * Math.sin(time * 1.6 + (o.seed || 0) * 6));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(o.x - r * 0.32, o.y - r * 1.15);
      ctx.lineTo(o.x, o.y - r * 0.85);
      ctx.lineTo(o.x + r * 0.32, o.y - r * 1.15);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawHazards(ctx, game) {
  for (const hz of game.hazards) {
    ctx.save();
    if (hz.type === 'ring') {
      const a = clamp(hz.life / hz.maxLife, 0, 1);
      ctx.strokeStyle = hexToRgba(hz.color || '#ff7d6c', 0.7 * a);
      ctx.lineWidth = hz.thickness || 16;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, Math.max(1, hz.r), 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = hexToRgba(hz.color || '#ff7d6c', 0.2 * a);
      ctx.lineWidth = (hz.thickness || 16) * 2.6;
      ctx.stroke();
    } else if (hz.type === 'pool') {
      const warn = hz.delay > 0;
      const pulse = 0.55 + 0.45 * Math.sin(game.time * 6 + hz.x);
      const a = warn ? 0.22 : 0.36 + 0.18 * pulse;
      if (warn) {
        ctx.strokeStyle = 'rgba(241,125,141,0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(241,125,141,0.08)';
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(hz.x, hz.y, 2, hz.x, hz.y, hz.r);
        g.addColorStop(0, hexToRgba(hz.color || '#8ef2c7', a));
        g.addColorStop(0.7, hexToRgba(hz.color || '#8ef2c7', a * 0.5));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(hz.color || '#8ef2c7', 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r * 0.72, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawPickups(ctx, game) {
  for (const p of game.pickups) {
    const bob = Math.sin(game.time * 4 + (p.phase || 0)) * 3;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    glow(ctx, '#ffdb99', 12);
    ctx.fillStyle = '#ffe9b5';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
}

function drawEffects(ctx, game) {
  for (const fx of game.effects) {
    const t = clamp(fx.life / fx.maxLife, 0, 1);
    ctx.save();
    if (fx.type === 'shockwave') {
      const r = fx.maxR * (1 - t);
      ctx.globalAlpha = t * 0.6;
      ctx.strokeStyle = fx.color || '#ffdb99';
      ctx.lineWidth = 3 + t * 5;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, Math.max(1, r), 0, TAU);
      ctx.stroke();
    } else if (fx.type === 'slash') {
      ctx.globalAlpha = t * 0.8;
      ctx.translate(fx.x, fx.y);
      ctx.rotate(fx.angle || 0);
      ctx.strokeStyle = fx.color || '#e6f5ff';
      ctx.lineWidth = 6 * t + 1;
      ctx.beginPath();
      ctx.arc(0, 0, fx.radius || 100, -(fx.arc || 1.4) / 2, (fx.arc || 1.4) / 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------------ */
/* Characters                                                         */
/* ------------------------------------------------------------------ */

function drawEnemy(ctx, e, game, theme) {
  const t = game.time;
  const bob = Math.sin(e.anim + t * 2.2) * (e.type === 'moth' ? 5 : 2);
  ctx.save();

  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r * 0.7, e.r * 0.95, e.r * 0.38, 0, 0, TAU);
  ctx.fill();

  if (e.boss) {
    drawBoss(ctx, e, game, theme);
    ctx.restore();
    return;
  }

  const angle = Math.atan2((game.player?.y || 0) - e.y, (game.player?.x || 0) - e.x);
  ctx.translate(e.x, e.y + bob);
  if (e.type === 'hound') ctx.rotate(angle);
  else if (e.type === 'knight' || e.type === 'sentinel') ctx.rotate(0);

  const flash = e.flash > 0;

  if (e.type === 'wisp') {
    const pulse = 0.7 + 0.3 * Math.sin(t * 3 + e.anim);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, e.r * 2.1);
    g.addColorStop(0, hexToRgba(theme.accent, 0.5 * pulse));
    g.addColorStop(0.5, hexToRgba(theme.accent, 0.14));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-e.r * 2.2, -e.r * 2.2, e.r * 4.4, e.r * 4.4);
    glow(ctx, theme.accent, 20);
    ctx.fillStyle = flash ? '#ffffff' : '#ffdca4';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.52, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = hexToRgba(theme.accent, 0.7);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + i * (TAU / 3);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * e.r * 0.95, Math.sin(a) * e.r * 0.95, 3, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a1420';
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r * 0.19, e.r * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath();
    ctx.arc(-2, -2, 1.6, 0, TAU);
    ctx.fill();
  } else if (e.type === 'hound') {
    // Legs.
    ctx.strokeStyle = '#2d2020';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const lx = -14 + i * 9;
      const sw = Math.sin(t * 12 + i * 1.7) * 4;
      ctx.beginPath();
      ctx.moveTo(lx, 6);
      ctx.lineTo(lx + sw, 16);
      ctx.stroke();
    }
    // Body.
    const body = ctx.createLinearGradient(-20, -12, 20, 14);
    body.addColorStop(0, '#503a2c');
    body.addColorStop(0.55, '#2b2020');
    body.addColorStop(1, '#171114');
    ctx.fillStyle = flash ? '#fff' : body;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r * 1.28, e.r * 0.72, 0, 0, TAU);
    ctx.fill();
    // Brambles.
    ctx.strokeStyle = '#6d4a35';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const bx = -16 + i * 8;
      ctx.beginPath();
      ctx.moveTo(bx, -6);
      ctx.lineTo(bx + 3, -16 - (i % 2) * 4);
      ctx.stroke();
    }
    // Head.
    ctx.fillStyle = flash ? '#fff' : '#3a2a24';
    ctx.beginPath();
    ctx.ellipse(e.r * 0.9, 0, e.r * 0.68, e.r * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = e.state === 'windup' ? '#ffb347' : '#ff6b59';
    glow(ctx, '#ff6b59', 10);
    ctx.beginPath();
    ctx.arc(e.r * 1.12, -4, 2.2, 0, TAU);
    ctx.arc(e.r * 1.12, 4, 2.2, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    // Tail.
    ctx.strokeStyle = '#4b352b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-e.r * 1.2, 0);
    ctx.quadraticCurveTo(-e.r * 1.7, -8 + Math.sin(t * 7 + e.anim) * 5, -e.r * 1.9, 2);
    ctx.stroke();
  } else if (e.type === 'moth') {
    const flap = Math.sin(t * 14 + e.anim) * 0.7;
    ctx.save();
    ctx.rotate(-0.4 + flap);
    ctx.fillStyle = 'rgba(160, 120, 210, 0.34)';
    ctx.beginPath();
    ctx.ellipse(-9, -6, 13, 7, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.4 - flap);
    ctx.fillStyle = 'rgba(160, 120, 210, 0.3)';
    ctx.beginPath();
    ctx.ellipse(9, -6, 13, 7, 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = flash ? '#fff' : '#241a34';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c7b0ff';
    glow(ctx, '#a996ff', 10);
    ctx.beginPath();
    ctx.arc(-1.5, -5, 1.3, 0, TAU);
    ctx.arc(1.5, -5, 1.3, 0, TAU);
    ctx.fill();
    noGlow(ctx);
  } else if (e.type === 'knight') {
    drawKnight(ctx, e, t, theme, flash);
  } else if (e.type === 'wraith') {
    const alpha = e.state === 'teleport' ? 0.3 : 0.72;
    ctx.globalAlpha = alpha;
    // Cloak.
    const cloak = ctx.createLinearGradient(0, -e.r, 0, e.r * 1.4);
    cloak.addColorStop(0, '#d8ccff');
    cloak.addColorStop(0.45, '#6d5d9e');
    cloak.addColorStop(1, 'rgba(24,18,40,0.1)');
    ctx.fillStyle = flash ? '#fff' : cloak;
    ctx.beginPath();
    ctx.moveTo(0, -e.r);
    ctx.quadraticCurveTo(e.r, -e.r * 0.2, e.r * 0.8, e.r * 1.3);
    ctx.lineTo(-e.r * 0.8, e.r * 1.3);
    ctx.quadraticCurveTo(-e.r, -e.r * 0.2, 0, -e.r);
    ctx.fill();
    // Mirror shards.
    ctx.strokeStyle = 'rgba(190,220,255,0.7)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const a = t * 1.3 + i * 1.7;
      const sx = Math.cos(a) * e.r * 1.1;
      const sy = Math.sin(a) * e.r * 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 5);
      ctx.lineTo(sx + 4, sy);
      ctx.lineTo(sx, sy + 5);
      ctx.lineTo(sx - 4, sy);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.fillStyle = '#1a1428';
    ctx.beginPath();
    ctx.ellipse(0, -e.r * 0.35, e.r * 0.34, e.r * 0.44, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b6e3ff';
    ctx.beginPath();
    ctx.arc(-3, -e.r * 0.38, 1.8, 0, TAU);
    ctx.arc(3, -e.r * 0.38, 1.8, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (e.type === 'sentinel') {
    // Arms.
    ctx.fillStyle = '#3d3830';
    ctx.fillRect(-e.r * 1.35, -e.r * 0.35, e.r * 0.4, e.r * 0.9);
    ctx.fillRect(e.r * 0.95, -e.r * 0.35, e.r * 0.4, e.r * 0.9);
    // Hex body.
    const rock = ctx.createLinearGradient(0, -e.r, 0, e.r);
    rock.addColorStop(0, '#6c6250');
    rock.addColorStop(0.5, '#413b31');
    rock.addColorStop(1, '#22201d');
    ctx.fillStyle = flash ? '#fff' : rock;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 6;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Rune core.
    ctx.fillStyle = e.state === 'windup' ? '#ff9b74' : '#e4b76c';
    glow(ctx, e.state === 'windup' ? '#ff7d6c' : '#e4b76c', e.state === 'windup' ? 26 : 12);
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.26, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    ctx.strokeStyle = 'rgba(20,16,14,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.6, 0);
    ctx.lineTo(-e.r * 0.28, 0);
    ctx.moveTo(e.r * 0.28, 0);
    ctx.lineTo(e.r * 0.6, 0);
    ctx.stroke();
  }

  ctx.restore();
  drawEnemyHealth(ctx, e);
}

function drawKnight(ctx, e, t, theme, flash) {
  const wind = e.state === 'windup';
  // Weapon.
  ctx.save();
  if (wind) {
    const p = 1 - clamp(e.stateTimer / 0.65, 0, 1);
    ctx.rotate(-1.4 + p * 1.1);
  }
  ctx.strokeStyle = '#b7c4d6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(e.r * 0.8, 0);
  ctx.lineTo(e.r * 1.95, 0);
  ctx.stroke();
  ctx.strokeStyle = '#5f4c36';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(e.r * 0.62, 0);
  ctx.lineTo(e.r * 0.86, 0);
  ctx.stroke();
  ctx.restore();

  // Body armor.
  const armor = ctx.createLinearGradient(0, -e.r, 0, e.r);
  armor.addColorStop(0, '#6b5250');
  armor.addColorStop(0.55, '#38292b');
  armor.addColorStop(1, '#1b1417');
  ctx.fillStyle = flash ? '#fff' : armor;
  roundRect(ctx, -e.r * 0.78, -e.r * 0.72, e.r * 1.56, e.r * 1.5, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Shoulders.
  ctx.fillStyle = flash ? '#fff' : '#4a3636';
  ctx.beginPath();
  ctx.ellipse(-e.r * 0.8, -e.r * 0.34, e.r * 0.35, e.r * 0.25, -0.3, 0, TAU);
  ctx.ellipse(e.r * 0.8, -e.r * 0.34, e.r * 0.35, e.r * 0.25, 0.3, 0, TAU);
  ctx.fill();

  // Helmet.
  ctx.fillStyle = flash ? '#fff' : '#2a2022';
  roundRect(ctx, -e.r * 0.34, -e.r * 0.98, e.r * 0.68, e.r * 0.58, 5);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(theme.accent, 0.4);
  ctx.stroke();
  ctx.fillStyle = wind ? '#ff9f6d' : hexToRgba(theme.accent, 0.9);
  glow(ctx, theme.accent, wind ? 16 : 6);
  ctx.fillRect(-e.r * 0.23, -e.r * 0.74, e.r * 0.46, 3);
  noGlow(ctx);

  // Chest sigil.
  ctx.strokeStyle = wind ? 'rgba(255,120,90,0.9)' : hexToRgba(theme.accent, 0.34);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -e.r * 0.28);
  ctx.lineTo(e.r * 0.2, 0);
  ctx.lineTo(0, e.r * 0.28);
  ctx.lineTo(-e.r * 0.2, 0);
  ctx.closePath();
  ctx.stroke();

  if (wind) {
    ctx.globalAlpha = 0.55 + 0.4 * Math.sin(t * 20);
    ctx.strokeStyle = '#ff7d6c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -e.r * 1.3, 9, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawBoss(ctx, e, game, theme) {
  const t = game.time;
  const pulse = 0.7 + 0.3 * Math.sin(t * 2.4);
  const colors = e.bossId === 'crown'
    ? { aura: '#ffd479', body1: '#6a416d', body2: '#2a1730', edge: '#a8799d', eye: '#ffe4a6', trim: '#ffd479' }
    : e.bossId === 'matriarch'
      ? { aura: '#78e3c7', body1: '#3c6650', body2: '#15251d', edge: '#6f9e7d', eye: '#c8ffde', trim: '#a7e07a' }
      : { aura: '#ff8a5a', body1: '#744138', body2: '#291417', edge: '#a3624e', eye: '#ffd2a0', trim: '#ff9a58' };

  // Ground aura.
  const aura = ctx.createRadialGradient(e.x, e.y, e.r * 0.4, e.x, e.y, e.r * 3.5);
  aura.addColorStop(0, hexToRgba(colors.aura, 0.18 * pulse));
  aura.addColorStop(0.5, hexToRgba(colors.aura, 0.05));
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(e.x - e.r * 3.6, e.y - e.r * 3.6, e.r * 7.2, e.r * 7.2);

  // Rotating ground sigil.
  ctx.save();
  ctx.translate(e.x, e.y + e.r * 0.95);
  ctx.scale(1, 0.42);
  ctx.rotate(t * 0.22);
  ctx.strokeStyle = hexToRgba(colors.trim, 0.34 * pulse);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 2.15, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 1.7, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * e.r * 1.72, Math.sin(a) * e.r * 1.72);
    ctx.lineTo(Math.cos(a) * e.r * 2.1, Math.sin(a) * e.r * 2.1);
    ctx.stroke();
  }
  ctx.restore();

  const wind = e.state === 'windup' || e.state === 'charge';
  ctx.save();
  ctx.translate(e.x, e.y + Math.sin(t * 1.6) * 2.5);

  // Tattered cloak.
  const cloak = ctx.createLinearGradient(0, -e.r, 0, e.r * 1.75);
  cloak.addColorStop(0, colors.body1);
  cloak.addColorStop(0.38, colors.body2);
  cloak.addColorStop(1, 'rgba(7,5,11,0.2)');
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-e.r * 0.38, -e.r * 0.78);
  ctx.bezierCurveTo(-e.r * 1.25, -e.r * 0.5, -e.r * 1.5, e.r * 0.4, -e.r * 1.5, e.r * 1.12);
  ctx.lineTo(-e.r * 1.22, e.r * 1.56);
  ctx.lineTo(-e.r * 0.92, e.r * 1.3);
  ctx.lineTo(-e.r * 0.4, e.r * 1.78);
  ctx.lineTo(e.r * 0.12, e.r * 1.4);
  ctx.lineTo(e.r * 0.65, e.r * 1.72);
  ctx.lineTo(e.r * 1.02, e.r * 1.28);
  ctx.lineTo(e.r * 1.32, e.r * 1.5);
  ctx.bezierCurveTo(e.r * 1.55, e.r * 0.5, e.r * 1.2, -e.r * 0.55, e.r * 0.38, -e.r * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexToRgba(colors.edge, 0.72);
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Inner cloak folds.
  ctx.strokeStyle = 'rgba(0,0,0,0.38)';
  ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * e.r * 0.22, e.r * 0.35);
    ctx.quadraticCurveTo(i * e.r * 0.4, e.r * 0.9, i * e.r * 0.55, e.r * 1.45);
    ctx.stroke();
  }

  // Shoulder pauldrons and spikes.
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * e.r * 0.92, -e.r * 0.34);
    ctx.rotate(side * -0.17);
    const pad = ctx.createLinearGradient(0, -e.r * 0.34, 0, e.r * 0.3);
    pad.addColorStop(0, colors.edge);
    pad.addColorStop(1, colors.body2);
    ctx.fillStyle = pad;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r * 0.5, e.r * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(colors.trim, 0.55);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = colors.body1;
    ctx.beginPath();
    ctx.moveTo(side * e.r * 0.18, -e.r * 0.24);
    ctx.lineTo(side * e.r * 0.62, -e.r * 0.7);
    ctx.lineTo(side * e.r * 0.4, -e.r * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Torso plate.
  const torso = ctx.createLinearGradient(-e.r * 0.6, -e.r * 0.7, e.r * 0.6, e.r * 0.75);
  torso.addColorStop(0, colors.edge);
  torso.addColorStop(0.45, colors.body1);
  torso.addColorStop(1, colors.body2);
  ctx.fillStyle = torso;
  roundRect(ctx, -e.r * 0.58, -e.r * 0.74, e.r * 1.16, e.r * 1.38, e.r * 0.22);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(colors.trim, 0.48);
  ctx.lineWidth = 1.7;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.48, -e.r * 0.18 + i * e.r * 0.22);
    ctx.quadraticCurveTo(0, e.r * 0.04 + i * e.r * 0.22, e.r * 0.48, -e.r * 0.18 + i * e.r * 0.22);
    ctx.stroke();
  }

  // Weapon arm.
  ctx.save();
  ctx.translate(e.r * 0.7, -e.r * 0.02);
  ctx.rotate(wind ? (e.state === 'charge' ? -0.95 : -0.55 + Math.sin(t * 28) * 0.05) : -0.16);
  ctx.strokeStyle = colors.body1;
  ctx.lineWidth = e.r * 0.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(e.r * 0.62, 0);
  ctx.stroke();
  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(e.r * 0.66, 0);
  ctx.lineTo(e.r * 1.9, 0);
  ctx.stroke();
  glow(ctx, colors.trim, wind ? 24 : 10);
  ctx.strokeStyle = '#eef4ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(e.r * 1.84, 0);
  ctx.lineTo(e.r * 2.55, 0);
  ctx.stroke();
  noGlow(ctx);
  ctx.fillStyle = colors.trim;
  ctx.fillRect(e.r * 0.62, -e.r * 0.08, e.r * 0.14, e.r * 0.16);
  ctx.restore();

  // Free hand.
  ctx.fillStyle = colors.body2;
  ctx.beginPath();
  ctx.arc(-e.r * 0.96, e.r * 0.32, e.r * 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(colors.trim, 0.4);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Head: horned mask.
  ctx.fillStyle = '#0d0911';
  ctx.beginPath();
  ctx.moveTo(-e.r * 0.42, -e.r * 1.2);
  ctx.lineTo(-e.r * 0.28, -e.r * 0.66);
  ctx.quadraticCurveTo(0, -e.r * 0.46, e.r * 0.28, -e.r * 0.66);
  ctx.lineTo(e.r * 0.42, -e.r * 1.2);
  ctx.quadraticCurveTo(0, -e.r * 1.5, -e.r * 0.42, -e.r * 1.2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(colors.edge, 0.62);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Horns.
  ctx.fillStyle = colors.body1;
  ctx.beginPath();
  ctx.moveTo(-e.r * 0.35, -e.r * 1.14);
  ctx.quadraticCurveTo(-e.r * 0.72, -e.r * 1.5, -e.r * 0.66, -e.r * 1.76);
  ctx.quadraticCurveTo(-e.r * 0.4, -e.r * 1.5, -e.r * 0.12, -e.r * 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(e.r * 0.35, -e.r * 1.14);
  ctx.quadraticCurveTo(e.r * 0.72, -e.r * 1.5, e.r * 0.66, -e.r * 1.76);
  ctx.quadraticCurveTo(e.r * 0.4, -e.r * 1.5, e.r * 0.12, -e.r * 1.2);
  ctx.closePath();
  ctx.fill();

  // Eyes and mouth sigil.
  ctx.fillStyle = colors.eye;
  glow(ctx, colors.eye, 24);
  ctx.beginPath();
  ctx.ellipse(-e.r * 0.16, -e.r * 0.94, e.r * 0.1, e.r * 0.055, -0.15, 0, TAU);
  ctx.ellipse(e.r * 0.16, -e.r * 0.94, e.r * 0.1, e.r * 0.055, 0.15, 0, TAU);
  ctx.fill();
  noGlow(ctx);
  ctx.strokeStyle = hexToRgba(colors.aura, 0.7 * pulse);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -e.r * 0.86);
  ctx.lineTo(0, -e.r * 0.64);
  ctx.moveTo(-e.r * 0.1, -e.r * 0.7);
  ctx.lineTo(e.r * 0.1, -e.r * 0.7);
  ctx.stroke();

  // Floating crown.
  ctx.save();
  ctx.translate(0, -e.r * 1.86 + Math.sin(t * 1.8) * 2.5);
  ctx.rotate(Math.sin(t * 0.7) * 0.07);
  glow(ctx, colors.trim, 18);
  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, e.r * 0.48, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * e.r * 0.14, -e.r * 0.04);
    ctx.lineTo(i * e.r * 0.17, -e.r * (0.2 + (3 - Math.abs(i)) * 0.05));
    ctx.stroke();
  }
  noGlow(ctx);
  ctx.restore();

  // Chest rune.
  ctx.strokeStyle = hexToRgba(colors.aura, 0.7 * pulse);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -e.r * 0.04, e.r * 0.2, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -e.r * 0.21);
  ctx.lineTo(e.r * 0.13, -e.r * 0.01);
  ctx.lineTo(0, e.r * 0.19);
  ctx.lineTo(-e.r * 0.13, -e.r * 0.01);
  ctx.closePath();
  ctx.stroke();

  // Phase embers.
  if (e.phase === 2) {
    for (let i = 0; i < 9; i++) {
      const a = t * 1.3 + i * 0.9;
      const rr = e.r * (1.2 + (i % 3) * 0.22);
      ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 4 + i);
      ctx.fillStyle = colors.aura;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.7 - e.r * 0.3, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  drawEnemyHealth(ctx, e);
}

function drawEnemyHealth(ctx, e) {
  if (e.hp >= e.maxHp) {
    if (e.elite) drawEliteMark(ctx, e);
    return;
  }
  const width = e.boss ? 120 : Math.max(34, e.r * 2.2);
  const x = e.x - width / 2;
  const y = e.y - e.r - (e.boss ? 52 : 18);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.66)';
  ctx.fillRect(x - 1, y - 1, width + 2, 6);
  const frac = clamp(e.hp / e.maxHp, 0, 1);
  const col = e.boss ? '#ff6e77' : e.elite ? '#ffcf6b' : '#e06771';
  ctx.fillStyle = col;
  ctx.fillRect(x, y, width * frac, 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1, y - 1, width + 2, 6);
  ctx.restore();
  if (e.elite) drawEliteMark(ctx, e);
}

function drawEliteMark(ctx, e) {
  ctx.save();
  ctx.translate(e.x, e.y - e.r - 24);
  ctx.fillStyle = '#ffcf6b';
  glow(ctx, '#ffcf6b', 10);
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(6, 0);
  ctx.lineTo(0, 5);
  ctx.lineTo(-6, 0);
  ctx.closePath();
  ctx.fill();
  noGlow(ctx);
  ctx.restore();
}

function drawPlayer(ctx, p, game, theme) {
  const t = game.time;
  const stats = game.run?.stats;

  // Dash afterimages.
  for (const trail of p.dashTrail || []) {
    const a = clamp(trail.life / 0.3, 0, 1) * 0.36;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.ellipse(trail.x, trail.y, 15, 20, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 17, 21, 8, 0, 0, TAU);
  ctx.fill();

  const bob = p.dashTime > 0 ? 0 : Math.sin(t * 3.4) * 1.2;
  ctx.translate(p.x, p.y + bob);

  // Invulnerability halo.
  if (p.invuln > 0) {
    ctx.globalAlpha = 0.2 + 0.2 * Math.sin(t * 18);
    ctx.strokeStyle = '#bfe7ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Cloak silhouette.
  const cloak = ctx.createLinearGradient(0, -22, 0, 25);
  cloak.addColorStop(0, '#3e3358');
  cloak.addColorStop(0.45, '#241c36');
  cloak.addColorStop(1, '#140f1f');
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.quadraticCurveTo(19, -8, 16, 24);
  ctx.quadraticCurveTo(0, 31, -16, 24);
  ctx.quadraticCurveTo(-19, -8, 0, -20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(228,183,108,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Scarf / cloak trim.
  ctx.strokeStyle = 'rgba(190,140,90,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-12, 20);
  ctx.quadraticCurveTo(-20 + Math.sin(t * 5) * 3, 26, -24, 34);
  ctx.stroke();

  // Shoulders.
  ctx.fillStyle = '#4b3a62';
  ctx.beginPath();
  ctx.ellipse(-10, -11, 8, 5, -0.4, 0, TAU);
  ctx.ellipse(10, -11, 8, 5, 0.4, 0, TAU);
  ctx.fill();

  // Head / hood.
  ctx.fillStyle = '#e6c4a2';
  ctx.beginPath();
  ctx.arc(0, -16, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#332646';
  ctx.beginPath();
  ctx.arc(0, -18, 10, Math.PI * 0.96, Math.PI * 2.04);
  ctx.fill();
  ctx.strokeStyle = 'rgba(228,183,108,0.38)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -18, 10, Math.PI * 1.06, Math.PI * 1.94);
  ctx.stroke();

  // Eyes.
  ctx.fillStyle = '#ffdb99';
  glow(ctx, '#ffdb99', 6);
  ctx.beginPath();
  ctx.arc(-2.6, -15, 1.2, 0, TAU);
  ctx.arc(2.6, -15, 1.2, 0, TAU);
  ctx.fill();
  noGlow(ctx);

  // Sword at rest.
  ctx.save();
  ctx.rotate(p.facing + 0.55);
  if (p.attackAnim > 0) {
    const progress = 1 - clamp(p.attackAnim / 0.2, 0, 1);
    const combo = p.comboIndex || 0;
    ctx.rotate(-0.7 + progress * 1.45 + combo * 0.18);
  }
  ctx.strokeStyle = '#d9ecff';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(37, 0);
  ctx.stroke();
  ctx.strokeStyle = '#c9a66b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, -4);
  ctx.lineTo(8, 4);
  ctx.stroke();
  ctx.restore();

  if (p.attackAnim > 0 && stats) {
    const progress = 1 - clamp(p.attackAnim / 0.2, 0, 1);
    const arc = stats.arc || 1.7;
    const range = stats.range || 110;
    const start = p.facing - arc / 2;
    const end = start + arc * (0.25 + progress * 0.75);
    ctx.save();
    ctx.globalAlpha = clamp(p.attackAnim / 0.2, 0, 1) * 0.55;
    ctx.strokeStyle = '#eaf7ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, range * 0.75, start, end);
    ctx.stroke();
    ctx.globalAlpha = clamp(p.attackAnim / 0.2, 0, 1) * 0.28;
    ctx.lineWidth = 13;
    ctx.strokeStyle = '#8ecfff';
    ctx.beginPath();
    ctx.arc(0, 0, range * 0.72, start, end);
    ctx.stroke();
    ctx.restore();
  }

  if (p.hitFlash > 0) {
    ctx.globalAlpha = clamp(p.hitFlash * 4, 0, 0.7);
    ctx.fillStyle = '#ff5a66';
    ctx.beginPath();
    ctx.ellipse(0, 2, 18, 25, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawProjectiles(ctx, game) {
  for (const pr of game.projectiles) {
    ctx.save();
    const speed = Math.hypot(pr.vx, pr.vy) || 1;
    const angle = Math.atan2(pr.vy, pr.vx);
    ctx.translate(pr.x, pr.y);

    if (pr.friendly) {
      ctx.rotate(angle);
      ctx.strokeStyle = 'rgba(159,232,255,0.45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      glow(ctx, '#8fe7ff', 18);
      const g = ctx.createLinearGradient(-8, 0, 10, 0);
      g.addColorStop(0, 'rgba(120,200,255,0.2)');
      g.addColorStop(0.6, '#bfefff');
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 3.2, 0, 0, TAU);
      ctx.fill();
      noGlow(ctx);
    } else {
      const pulse = 0.7 + 0.3 * Math.sin(game.time * 10 + pr.x);
      glow(ctx, pr.color || '#ff7d6c', 16);
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, pr.r * 2.2);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.35, pr.color || '#ff7d6c');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = pulse;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, pr.r * 2.2, 0, TAU);
      ctx.fill();
      noGlow(ctx);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff5e8';
      ctx.beginPath();
      ctx.arc(0, 0, pr.r * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a * (p.alpha ?? 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloatingTexts(ctx, game) {
  for (const t of game.texts) {
    const a = clamp(t.life / t.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `${t.size || 15}px "Palatino Linotype", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = t.color || '#f4e8d1';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

function drawBanner(ctx, game, w, h) {
  const banner = game.banner;
  if (!banner) return;
  const elapsed = banner.time || 0;
  const max = banner.max || 3;
  if (elapsed > max) return;
  const fadeIn = clamp(elapsed / 0.28, 0, 1);
  const fadeOut = clamp((max - elapsed) / 0.6, 0, 1);
  const alpha = Math.min(fadeIn, fadeOut);
  const colors = {
    gold: '#ffdb99',
    boss: '#ff9a8c',
    floor: '#f4e8d1'
  };
  const color = colors[banner.tone] || colors.gold;

  ctx.save();
  ctx.globalAlpha = alpha;
  const y = h * 0.3;
  const kickerY = y - 34;

  // Rule lines.
  const line = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, 0);
  line.addColorStop(0, 'rgba(228,183,108,0)');
  line.addColorStop(0.5, hexToRgba(color, 0.55));
  line.addColorStop(1, 'rgba(228,183,108,0)');
  ctx.fillStyle = line;
  ctx.fillRect(w * 0.2, kickerY + 6, w * 0.6, 1);

  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = '10px "Trebuchet MS", sans-serif';
  ctx.letterSpacing = '6px';
  if (banner.sub) {
    ctx.font = '10px "Trebuchet MS", sans-serif';
    ctx.fillText(banner.sub.toUpperCase(), w / 2, kickerY - 4);
  }
  glow(ctx, color, 22);
  ctx.fillStyle = color;
  ctx.font = '44px "Palatino Linotype", Georgia, serif';
  ctx.fillText(banner.text, w / 2, y + 26);
  noGlow(ctx);
  ctx.restore();
}
