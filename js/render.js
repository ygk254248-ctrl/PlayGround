// Canvas renderer for the legacy ascent and the animated title backdrop.
import { ROOM_W, ROOM_H, WALL } from './data.js';
import { doorPoint } from './dungeon.js';

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const num = parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Ambient starfield for the menu backdrop
// ---------------------------------------------------------------------------

export function buildStars(count = 170) {
  const rand = seeded(987654321);
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: rand(),
      y: rand() * 0.62,
      r: 0.4 + rand() * 1.5,
      phase: rand() * TAU,
      speed: 0.35 + rand() * 0.8,
      warm: rand() < 0.18
    });
  }
  return stars;
}

export function drawMenuScene(ctx, game) {
  const w = game.width;
  const h = game.height;
  const t = game.time;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#05040c');
  sky.addColorStop(0.42, '#0d0812');
  sky.addColorStop(0.78, '#190e13');
  sky.addColorStop(1, '#221016');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Moon
  const mx = w * 0.78;
  const my = h * 0.2;
  const moonR = Math.min(w, h) * 0.085;
  const halo = ctx.createRadialGradient(mx, my, moonR * 0.4, mx, my, moonR * 4.6);
  halo.addColorStop(0, 'rgba(255, 228, 178, 0.5)');
  halo.addColorStop(0.35, 'rgba(255, 214, 150, 0.12)');
  halo.addColorStop(1, 'rgba(255, 214, 150, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  const moon = ctx.createRadialGradient(mx - moonR * 0.3, my - moonR * 0.3, moonR * 0.1, mx, my, moonR);
  moon.addColorStop(0, '#ffefd2');
  moon.addColorStop(0.75, '#e8cfa4');
  moon.addColorStop(1, '#b9a071');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, moonR, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 128, 82, 0.5)';
  ctx.beginPath(); ctx.arc(mx - moonR * 0.32, my + moonR * 0.18, moonR * 0.16, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + moonR * 0.24, my - moonR * 0.3, moonR * 0.11, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(mx + moonR * 0.36, my + moonR * 0.34, moonR * 0.08, 0, TAU); ctx.fill();

  // Stars
  for (const star of game.stars) {
    const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase));
    ctx.globalAlpha = twinkle * 0.9;
    ctx.fillStyle = star.warm ? '#ffd9a8' : '#cfe0ff';
    ctx.beginPath();
    ctx.arc(star.x * w, star.y * h, star.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Far ridge
  ctx.fillStyle = '#0c070d';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  const ridge1 = [[0.08, 0.55], [0.16, 0.6], [0.24, 0.5], [0.33, 0.58], [0.41, 0.52], [0.5, 0.6], [0.58, 0.47], [0.66, 0.58], [0.74, 0.53], [0.82, 0.6], [0.9, 0.5], [1, 0.58]];
  for (const [x, y] of ridge1) ctx.lineTo(x * w, y * h);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // The tower silhouette, layered
  const towerBaseY = h * 0.94;
  const towerCx = w * 0.5;
  ctx.fillStyle = '#120a12';
  const tiers = [
    { w: 0.34, h: 0.16 },
    { w: 0.26, h: 0.14 },
    { w: 0.19, h: 0.12 },
    { w: 0.13, h: 0.13 },
    { w: 0.075, h: 0.1 },
    { w: 0.032, h: 0.075 }
  ];
  let ty = towerBaseY;
  for (const tier of tiers) {
    const tierH = tier.h * h;
    const half = (tier.w * w) / 2;
    ctx.fillRect(towerCx - half, ty - tierH, half * 2, tierH + 2);
    // Crowning ledge
    ctx.fillRect(towerCx - half * 1.13, ty - tierH - 7, half * 2.26, 9);
    ty -= tierH;
  }
  // Spire
  ctx.beginPath();
  ctx.moveTo(towerCx - w * 0.014, ty);
  ctx.lineTo(towerCx, ty - h * 0.075);
  ctx.lineTo(towerCx + w * 0.014, ty);
  ctx.closePath();
  ctx.fill();

  // Lit windows, flickering
  const winRand = seeded(112233);
  const windows = [];
  for (let i = 0; i < 26; i += 1) {
    windows.push({ x: towerCx + (winRand() - 0.5) * w * 0.27, y: towerBaseY - winRand() * h * 0.6, s: 1.4 + winRand() * 2.6, phase: winRand() * TAU });
  }
  for (const win of windows) {
    const flicker = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.7 + win.phase) * (0.6 + 0.4 * Math.sin(t * 3.1 + win.phase * 2)));
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#ffca7e';
    ctx.fillRect(win.x - win.s / 2, win.y - win.s / 2, win.s, win.s * 1.5);
  }
  ctx.globalAlpha = 1;

  // Near ridge
  ctx.fillStyle = '#070409';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.8);
  const ridge2 = [[0.1, 0.74], [0.22, 0.8], [0.3, 0.7], [0.44, 0.79], [0.52, 0.72], [0.63, 0.81], [0.72, 0.73], [0.85, 0.8], [0.94, 0.75], [1, 0.79]];
  for (const [x, y] of ridge2) ctx.lineTo(x * w, y * h);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Rising embers
  const emberRand = seeded(445566);
  for (let i = 0; i < 34; i += 1) {
    const cycle = ((t * (0.05 + emberRand() * 0.05) + emberRand()) % 1);
    const ex = emberRand() * w + Math.sin(t * 0.6 + i * 1.7) * 24;
    const ey = h - cycle * h * 0.85;
    const size = 1 + emberRand() * 2.1;
    ctx.globalAlpha = Math.sin(cycle * Math.PI) * 0.75;
    ctx.fillStyle = i % 3 === 0 ? '#ffd27e' : '#ff8a4a';
    ctx.beginPath();
    ctx.arc(ex, ey, size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Fog band
  const fog = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.95);
  fog.addColorStop(0, 'rgba(24, 14, 22, 0)');
  fog.addColorStop(1, 'rgba(24, 14, 22, 0.72)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Room background — painted once per room onto an offscreen canvas
// ---------------------------------------------------------------------------

export function buildRoomBackground(room, theme) {
  const canvas = document.createElement('canvas');
  canvas.width = ROOM_W;
  canvas.height = ROOM_H;
  const ctx = canvas.getContext('2d');
  const rand = seeded((room.x + 11) * 7919 + (room.y + 13) * 104729 + 97);

  // Base floor
  const floorGrad = ctx.createLinearGradient(0, 0, 0, ROOM_H);
  floorGrad.addColorStop(0, theme.floorAlt);
  floorGrad.addColorStop(0.5, theme.floor);
  floorGrad.addColorStop(1, theme.floorAlt);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);

  // Flagstone grid with slight jitter
  const tile = 64;
  for (let y = 0; y < ROOM_H / tile + 1; y += 1) {
    for (let x = 0; x < ROOM_W / tile + 1; x += 1) {
      const jx = (rand() - 0.5) * 6;
      const jy = (rand() - 0.5) * 6;
      ctx.fillStyle = rand() < 0.5 ? theme.floor : theme.floorAlt;
      ctx.fillRect(x * tile + 1 + jx, y * tile + 1 + jy, tile - 2, tile - 2);
      if (rand() < 0.16) {
        ctx.strokeStyle = rgba(theme.grout, 0.9);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const cx = x * tile + tile / 2 + jx;
        const cy = y * tile + tile / 2 + jy;
        ctx.moveTo(cx - tile * 0.28, cy + (rand() - 0.5) * 18);
        ctx.lineTo(cx + tile * 0.28, cy + (rand() - 0.5) * 18);
        ctx.stroke();
      }
      if (rand() < 0.09) {
        ctx.fillStyle = rgba(theme.wallTop, 0.24);
        ctx.fillRect(x * tile + 6 + jx, y * tile + 6 + jy, tile - 12, tile - 12);
      }
    }
  }
  // Grout lines
  ctx.strokeStyle = theme.grout;
  ctx.lineWidth = 2;
  for (let x = 0; x <= ROOM_W; x += tile) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ROOM_H); ctx.stroke();
  }
  for (let y = 0; y <= ROOM_H; y += tile) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ROOM_W, y); ctx.stroke();
  }

  // Faint ritual circle in the center of combat/boss halls
  if (room.type === 'combat' || room.type === 'boss') {
    ctx.save();
    ctx.translate(ROOM_W / 2, ROOM_H / 2);
    ctx.strokeStyle = rgba(theme.rune, 0.24);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 94, 0, TAU); ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 94, Math.sin(a) * 94);
      ctx.lineTo(Math.cos(a) * 120, Math.sin(a) * 120);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Central mosaic for shrine / treasure rooms
  if (room.type === 'shrine' || room.type === 'treasure') {
    ctx.save();
    ctx.translate(ROOM_W / 2, ROOM_H / 2);
    ctx.strokeStyle = rgba(theme.accent, 0.34);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 84, 0, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(theme.accent, 0.2);
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // Stair gate sigil
  if (room.type === 'exit' || room.type === 'boss') {
    ctx.save();
    ctx.translate(ROOM_W / 2, ROOM_H / 2);
    ctx.strokeStyle = rgba(room.type === 'exit' ? theme.accent : '#e1534d', 0.3);
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 3; i += 1) {
      const r = 46 + i * 26;
      ctx.beginPath();
      ctx.arc(0, 0, r, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 0.28, Math.PI * 0.72);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Walls ---------------------------------------------------------
  // Outer darkness
  ctx.fillStyle = '#050304';
  ctx.fillRect(0, 0, ROOM_W, WALL);
  ctx.fillRect(0, ROOM_H - WALL, ROOM_W, WALL);
  ctx.fillRect(0, 0, WALL, ROOM_H);
  ctx.fillRect(ROOM_W - WALL, 0, WALL, ROOM_H);

  // Masonry courses on the walls
  const wallGrad = ctx.createLinearGradient(0, 0, 0, WALL);
  wallGrad.addColorStop(0, theme.wall);
  wallGrad.addColorStop(1, theme.grout);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, ROOM_W, WALL);
  const wallGradB = ctx.createLinearGradient(0, ROOM_H - WALL, 0, ROOM_H);
  wallGradB.addColorStop(0, theme.grout);
  wallGradB.addColorStop(1, theme.wall);
  ctx.fillStyle = wallGradB;
  ctx.fillRect(0, ROOM_H - WALL, ROOM_W, WALL);
  const wallGradL = ctx.createLinearGradient(0, 0, WALL, 0);
  wallGradL.addColorStop(0, theme.wall);
  wallGradL.addColorStop(1, theme.grout);
  ctx.fillStyle = wallGradL;
  ctx.fillRect(0, 0, WALL, ROOM_H);
  const wallGradR = ctx.createLinearGradient(ROOM_W - WALL, 0, ROOM_W, 0);
  wallGradR.addColorStop(0, theme.grout);
  wallGradR.addColorStop(1, theme.wall);
  ctx.fillStyle = wallGradR;
  ctx.fillRect(ROOM_W - WALL, 0, WALL, ROOM_H);

  // Brick courses
  ctx.strokeStyle = rgba(theme.wallTop, 0.34);
  ctx.lineWidth = 1.6;
  const brickH = 14;
  for (let y = 8; y < WALL; y += brickH) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ROOM_W, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ROOM_H - y); ctx.lineTo(ROOM_W, ROOM_H - y); ctx.stroke();
  }
  for (let x = 8; x < WALL; x += brickH) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ROOM_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROOM_W - x, 0); ctx.lineTo(ROOM_W - x, ROOM_H); ctx.stroke();
  }

  // Inner wall edge highlight
  ctx.strokeStyle = rgba(theme.wallTop, 0.85);
  ctx.lineWidth = 3;
  ctx.strokeRect(WALL - 1.5, WALL - 1.5, ROOM_W - WALL * 2 + 3, ROOM_H - WALL * 2 + 3);
  ctx.strokeStyle = rgba('#000000', 0.55);
  ctx.lineWidth = 5;
  ctx.strokeRect(WALL + 3, WALL + 3, ROOM_W - WALL * 2 - 6, ROOM_H - WALL * 2 - 6);

  // ---- Door apertures -------------------------------------------------
  const APERTURE_HALF = 66;
  for (const dir of ['n', 's', 'e', 'w']) {
    if (!room.doors[dir]) continue;
    const c = doorPoint(room, dir);
    const horizontal = dir === 'n' || dir === 's';
    const px = horizontal ? c.x - APERTURE_HALF : c.x - WALL;
    const py = horizontal ? c.y - WALL : c.y - APERTURE_HALF;
    const pw = horizontal ? APERTURE_HALF * 2 : WALL * 2;
    const ph = horizontal ? WALL * 2 : APERTURE_HALF * 2;
    // Dark opening
    const depth = ctx.createRadialGradient(c.x, c.y, 8, c.x, c.y, horizontal ? APERTURE_HALF : APERTURE_HALF);
    depth.addColorStop(0, '#020203');
    depth.addColorStop(1, rgba(theme.grout, 0.9));
    ctx.fillStyle = depth;
    ctx.fillRect(px, py, pw, ph);
    // Door frame pillars
    ctx.fillStyle = theme.wall;
    const fw = 12;
    if (horizontal) {
      ctx.fillRect(c.x - APERTURE_HALF - fw / 2, dir === 'n' ? 0 : ROOM_H - WALL, fw, WALL);
      ctx.fillRect(c.x + APERTURE_HALF - fw / 2, dir === 'n' ? 0 : ROOM_H - WALL, fw, WALL);
      ctx.strokeStyle = rgba(theme.wallTop, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.x - APERTURE_HALF, dir === 'n' ? WALL : ROOM_H - WALL); ctx.lineTo(c.x + APERTURE_HALF, dir === 'n' ? WALL : ROOM_H - WALL); ctx.stroke();
    } else {
      ctx.fillRect(dir === 'w' ? 0 : ROOM_W - WALL, c.y - APERTURE_HALF - fw / 2, WALL, fw);
      ctx.fillRect(dir === 'w' ? 0 : ROOM_W - WALL, c.y + APERTURE_HALF - fw / 2, WALL, fw);
      ctx.strokeStyle = rgba(theme.wallTop, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(dir === 'w' ? WALL : ROOM_W - WALL, c.y - APERTURE_HALF); ctx.lineTo(dir === 'w' ? WALL : ROOM_W - WALL, c.y + APERTURE_HALF); ctx.stroke();
    }
  }

  // ---- Braziers in the corners ----------------------------------------
  const braziers = [
    { x: WALL + 34, y: WALL + 34 },
    { x: ROOM_W - WALL - 34, y: WALL + 34 },
    { x: WALL + 34, y: ROOM_H - WALL - 34 },
    { x: ROOM_W - WALL - 34, y: ROOM_H - WALL - 34 }
  ];
  for (const b of braziers) {
    const glow = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 74);
    glow.addColorStop(0, theme.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(b.x, b.y, 74, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1214';
    ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = theme.accent;
    ctx.beginPath(); ctx.arc(b.x, b.y, 4.2, 0, TAU); ctx.fill();
  }

  // ---- Obstacles -------------------------------------------------------
  for (const obstacle of room.obstacles) {
    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    // Contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(4, obstacle.r * 0.72, obstacle.r * 1.18, obstacle.r * 0.42, 0, 0, TAU);
    ctx.fill();
    if (obstacle.kind === 'crystal') {
      const shardGrad = ctx.createLinearGradient(-obstacle.r, 0, obstacle.r, 0);
      shardGrad.addColorStop(0, rgba(theme.accent2, 0.65));
      shardGrad.addColorStop(0.5, rgba('#ffffff', 0.85));
      shardGrad.addColorStop(1, rgba(theme.accent2, 0.4));
      ctx.fillStyle = shardGrad;
      ctx.beginPath();
      ctx.moveTo(0, -obstacle.r * 1.55);
      ctx.lineTo(obstacle.r * 0.72, -obstacle.r * 0.2);
      ctx.lineTo(obstacle.r * 0.42, obstacle.r * 0.62);
      ctx.lineTo(-obstacle.r * 0.42, obstacle.r * 0.62);
      ctx.lineTo(-obstacle.r * 0.72, -obstacle.r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(theme.accent2, 0.9);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const cglow = ctx.createRadialGradient(0, 0, 2, 0, 0, obstacle.r * 2.4);
      cglow.addColorStop(0, rgba(theme.accent2, 0.4));
      cglow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cglow;
      ctx.beginPath(); ctx.arc(0, 0, obstacle.r * 2.4, 0, TAU); ctx.fill();
    } else if (obstacle.kind === 'statue') {
      ctx.fillStyle = theme.wall;
      ctx.fillRect(-obstacle.r * 0.62, obstacle.r * 0.35, obstacle.r * 1.24, obstacle.r * 0.4);
      ctx.fillStyle = theme.wallTop;
      ctx.fillRect(-obstacle.r * 0.44, -obstacle.r * 0.32, obstacle.r * 0.88, obstacle.r * 0.72);
      ctx.beginPath();
      ctx.arc(0, -obstacle.r * 0.52, obstacle.r * 0.34, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(theme.wallTop, 0.6);
      ctx.fillRect(-obstacle.r * 0.44, -obstacle.r * 0.32, obstacle.r * 0.3, obstacle.r * 0.72);
    } else {
      // Pillar
      const pillarGrad = ctx.createLinearGradient(-obstacle.r, 0, obstacle.r, 0);
      pillarGrad.addColorStop(0, theme.grout);
      pillarGrad.addColorStop(0.32, theme.wallTop);
      pillarGrad.addColorStop(0.62, theme.wall);
      pillarGrad.addColorStop(1, theme.grout);
      ctx.fillStyle = pillarGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, obstacle.r, obstacle.r * 0.82, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(theme.wallTop, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -obstacle.r * 0.24, obstacle.r * 0.78, obstacle.r * 0.6, 0, Math.PI, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba('#000000', 0.4);
      ctx.beginPath();
      ctx.ellipse(0, obstacle.r * 0.3, obstacle.r * 0.9, obstacle.r * 0.55, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Rubble and debris
  for (let i = 0; i < 42; i += 1) {
    const x = WALL + rand() * (ROOM_W - WALL * 2);
    const y = WALL + rand() * (ROOM_H - WALL * 2);
    const r = 1 + rand() * 3.4;
    ctx.fillStyle = rand() < 0.3 ? rgba(theme.wallTop, 0.5) : rgba('#000000', 0.4);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  // Scorch marks
  for (let i = 0; i < 6; i += 1) {
    const x = WALL + rand() * (ROOM_W - WALL * 2);
    const y = WALL + rand() * (ROOM_H - WALL * 2);
    const r = 14 + rand() * 42;
    const scorch = ctx.createRadialGradient(x, y, 1, x, y, r);
    scorch.addColorStop(0, 'rgba(0,0,0,0.5)');
    scorch.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = scorch;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  room.bg = canvas;
  return canvas;
}

// ---------------------------------------------------------------------------
// Gameplay world frame
// ---------------------------------------------------------------------------

function drawTelegraph(ctx, e, t) {
  const tele = e.telegraph;
  if (!tele) return;
  const progress = Math.min(1, tele.t / tele.dur);
  const pulse = 0.35 + 0.3 * Math.sin(t * 18);
  ctx.save();
  if (tele.kind === 'arc') {
    ctx.translate(e.x, e.y);
    ctx.rotate(tele.dir);
    ctx.fillStyle = `rgba(229, 83, 77, ${0.14 + pulse * progress * 0.5})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, tele.range, -tele.arc / 2, tele.arc / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 120, 105, ${0.35 + progress * 0.55})`;
    ctx.lineWidth = 2 + progress * 2;
    ctx.beginPath();
    ctx.arc(0, 0, tele.range, -tele.arc / 2, tele.arc / 2);
    ctx.stroke();
  } else if (tele.kind === 'line') {
    ctx.translate(e.x, e.y);
    ctx.rotate(tele.dir);
    const grad = ctx.createLinearGradient(0, 0, tele.range, 0);
    grad.addColorStop(0, `rgba(255, 154, 88, ${0.28 + progress * 0.4})`);
    grad.addColorStop(1, 'rgba(255, 154, 88, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -13, tele.range, 26);
    ctx.strokeStyle = `rgba(255, 190, 120, ${0.3 + progress * 0.6})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(tele.range, -13); ctx.moveTo(0, 13); ctx.lineTo(tele.range, 13); ctx.stroke();
  } else if (tele.kind === 'ring') {
    ctx.strokeStyle = `rgba(255, 156, 110, ${0.32 + progress * 0.55})`;
    ctx.lineWidth = 3 + progress * 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, tele.range * progress, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(229, 83, 77, ${0.08 + progress * 0.15})`;
    ctx.beginPath(); ctx.arc(e.x, e.y, tele.range, 0, TAU); ctx.fill();
  } else if (tele.kind === 'cast') {
    ctx.strokeStyle = `rgba(165, 139, 255, ${0.3 + progress * 0.6})`;
    ctx.lineWidth = 2 + progress * 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 8 + progress * 12, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(ctx, e, t) {
  const flash = Math.max(0, e.flash);
  const elite = e.elite;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.lineJoin = 'round';

  const bodyFill = flash > 0 ? '#f4e9dc' : null;

  if (e.type === 'wisp') {
    const bob = Math.sin(t * 2.1 + e.anim) * 4;
    ctx.translate(0, bob);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, e.r * 2.3);
    glow.addColorStop(0, flash > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(159, 214, 255, 0.85)');
    glow.addColorStop(0.4, 'rgba(120, 170, 255, 0.28)');
    glow.addColorStop(1, 'rgba(120, 170, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 2.3, 0, TAU); ctx.fill();
    ctx.fillStyle = bodyFill || '#dff0ff';
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.62, 0, TAU); ctx.fill();
    ctx.strokeStyle = bodyFill || 'rgba(190, 224, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-e.r * 0.62, 0); ctx.lineTo(e.r * 0.62, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -e.r * 0.62); ctx.lineTo(0, e.r * 0.62); ctx.stroke();
    if (e.windup > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, e.r * (0.3 + 0.45 * (1 - e.windup / 0.6)), 0, TAU); ctx.fill();
    }
  } else if (e.type === 'hound') {
    const facing = e.facing || 0;
    ctx.rotate(facing);
    ctx.fillStyle = bodyFill || '#241512';
    ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.35, e.r * 0.72, 0, 0, TAU); ctx.fill();
    // Head
    ctx.beginPath(); ctx.ellipse(e.r * 1.28, -e.r * 0.1, e.r * 0.62, e.r * 0.5, 0, 0, TAU); ctx.fill();
    // Snout
    ctx.fillStyle = bodyFill || '#33201b';
    ctx.beginPath(); ctx.ellipse(e.r * 1.78, -e.r * 0.06, e.r * 0.34, e.r * 0.28, 0, 0, TAU); ctx.fill();
    // Ears
    ctx.fillStyle = bodyFill || '#1a0e0c';
    ctx.beginPath(); ctx.moveTo(e.r * 1.16, -e.r * 0.48); ctx.lineTo(e.r * 1.34, -e.r * 0.98); ctx.lineTo(e.r * 1.52, -e.r * 0.44); ctx.closePath(); ctx.fill();
    // Ember spine
    ctx.strokeStyle = bodyFill || '#ff8a4a';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.moveTo(-e.r * 1.1, -e.r * 0.3); ctx.lineTo(0, -e.r * 0.52); ctx.lineTo(e.r * 0.9, -e.r * 0.34); ctx.stroke();
    ctx.globalAlpha = 1;
    // Eye
    ctx.fillStyle = '#ffb054';
    ctx.beginPath(); ctx.arc(e.r * 1.42, -e.r * 0.16, 2.6, 0, TAU); ctx.fill();
  } else if (e.type === 'knight') {
    ctx.fillStyle = bodyFill || '#2a2c33';
    // Legs
    ctx.fillRect(-e.r * 0.62, e.r * 0.35, e.r * 0.42, e.r * 0.62);
    ctx.fillRect(e.r * 0.2, e.r * 0.35, e.r * 0.42, e.r * 0.62);
    // Torso
    ctx.fillStyle = bodyFill || '#3a3d47';
    ctx.beginPath();
    ctx.moveTo(-e.r * 0.85, e.r * 0.42);
    ctx.lineTo(-e.r * 0.72, -e.r * 0.42);
    ctx.quadraticCurveTo(0, -e.r * 0.86, e.r * 0.72, -e.r * 0.42);
    ctx.lineTo(e.r * 0.85, e.r * 0.42);
    ctx.closePath(); ctx.fill();
    // Pauldrons
    ctx.fillStyle = bodyFill || '#4c4f5c';
    ctx.beginPath(); ctx.arc(-e.r * 0.78, -e.r * 0.28, e.r * 0.34, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.78, -e.r * 0.28, e.r * 0.34, 0, TAU); ctx.fill();
    // Helm
    ctx.fillStyle = bodyFill || '#23242b';
    ctx.beginPath(); ctx.arc(0, -e.r * 0.74, e.r * 0.42, Math.PI, 0); ctx.fill();
    ctx.fillRect(-e.r * 0.42, -e.r * 0.74, e.r * 0.84, e.r * 0.2);
    // Visor glow
    ctx.fillStyle = '#ff5f45';
    ctx.fillRect(-e.r * 0.26, -e.r * 0.66, e.r * 0.52, 3.4);
  } else if (e.type === 'wraith') {
    const sway = Math.sin(t * 1.8 + e.anim) * 0.18;
    ctx.rotate(sway);
    const grad = ctx.createLinearGradient(0, -e.r * 1.6, 0, e.r * 1.4);
    grad.addColorStop(0, flash > 0 ? '#f4e9dc' : 'rgba(198, 214, 255, 0.92)');
    grad.addColorStop(1, 'rgba(120, 140, 220, 0.08)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -e.r * 1.5);
    ctx.quadraticCurveTo(e.r * 1.05, -e.r * 0.5, e.r * 0.72, e.r * 0.4);
    ctx.quadraticCurveTo(e.r * 0.42, e.r * 1.05, 0, e.r * 1.45);
    ctx.quadraticCurveTo(-e.r * 0.42, e.r * 1.05, -e.r * 0.72, e.r * 0.4);
    ctx.quadraticCurveTo(-e.r * 1.05, -e.r * 0.5, 0, -e.r * 1.5);
    ctx.closePath(); ctx.fill();
    // Eyes
    ctx.fillStyle = '#eef3ff';
    ctx.beginPath(); ctx.arc(-e.r * 0.3, -e.r * 0.42, 2.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(e.r * 0.3, -e.r * 0.42, 2.4, 0, TAU); ctx.fill();
  } else if (e.type === 'sentinel') {
    ctx.fillStyle = bodyFill || '#2e2a26';
    // Hexagonal body
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU - Math.PI / 2;
      const px = Math.cos(a) * e.r;
      const py = Math.sin(a) * e.r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = bodyFill || '#57504a';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Core rune
    ctx.strokeStyle = flash > 0 ? '#fff' : '#ffb054';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.42, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, e.r * 0.18, 0, TAU); ctx.stroke();
  } else if (e.type === 'moth') {
    const flap = Math.sin(t * 9 + e.anim) * 0.55;
    ctx.fillStyle = bodyFill || '#171320';
    ctx.save(); ctx.rotate(-0.5 - flap);
    ctx.beginPath(); ctx.ellipse(-e.r * 0.42, 0, e.r * 0.78, e.r * 0.34, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.rotate(0.5 + flap);
    ctx.beginPath(); ctx.ellipse(e.r * 0.42, 0, e.r * 0.78, e.r * 0.34, 0.4, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = bodyFill || '#241d33';
    ctx.beginPath(); ctx.ellipse(0, 0, e.r * 0.42, e.r * 0.26, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#b58cff';
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill();
  } else if (e.boss) {
    // Guardian renders — large, layered, crowned
    const bossKind = e.bossId || 'warden';
    if (bossKind === 'matriarch') {
      ctx.fillStyle = bodyFill || '#1d2b22';
      ctx.beginPath();
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * TAU - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = bodyFill || '#4e7a58'; ctx.lineWidth = 4; ctx.stroke();
      // Blooms
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * TAU + t * 0.4;
        ctx.fillStyle = i % 2 ? '#c5d96f' : '#65e0b6';
        ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.62, Math.sin(a) * e.r * 0.62, 6 + Math.sin(t * 3 + i) * 1.4, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#e9ffd9';
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.3, 0, TAU); ctx.fill();
    } else if (bossKind === 'crown') {
      const hover = Math.sin(t * 1.6) * 7;
      ctx.translate(0, hover);
      // Cloak mass
      const cloak = ctx.createLinearGradient(0, -e.r, 0, e.r * 1.3);
      cloak.addColorStop(0, bodyFill || '#241527');
      cloak.addColorStop(1, 'rgba(20, 9, 24, 0.15)');
      ctx.fillStyle = cloak;
      ctx.beginPath();
      ctx.moveTo(0, -e.r * 1.05);
      ctx.quadraticCurveTo(e.r * 1.15, -e.r * 0.2, e.r * 0.6, e.r * 1.15);
      ctx.quadraticCurveTo(0, e.r * 0.72, -e.r * 0.6, e.r * 1.15);
      ctx.quadraticCurveTo(-e.r * 1.15, -e.r * 0.2, 0, -e.r * 1.05);
      ctx.closePath(); ctx.fill();
      // Crown
      ctx.fillStyle = bodyFill || '#ffd479';
      ctx.save();
      ctx.translate(0, -e.r * 1.12);
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.42, 0);
      ctx.lineTo(-e.r * 0.42, -e.r * 0.3);
      ctx.lineTo(-e.r * 0.21, -e.r * 0.1);
      ctx.lineTo(0, -e.r * 0.42);
      ctx.lineTo(e.r * 0.21, -e.r * 0.1);
      ctx.lineTo(e.r * 0.42, -e.r * 0.3);
      ctx.lineTo(e.r * 0.42, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ff6e9d';
      ctx.beginPath(); ctx.arc(0, -e.r * 0.18, 3.4 + Math.sin(t * 4) * 1.1, 0, TAU); ctx.fill();
    } else {
      // warden — cinder knight, enlarged
      ctx.fillStyle = bodyFill || '#33251f';
      ctx.fillRect(-e.r * 0.5, e.r * 0.42, e.r * 0.34, e.r * 0.6);
      ctx.fillRect(e.r * 0.16, e.r * 0.42, e.r * 0.34, e.r * 0.6);
      ctx.fillStyle = bodyFill || '#453028';
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.92, e.r * 0.48);
      ctx.lineTo(-e.r * 0.78, -e.r * 0.5);
      ctx.quadraticCurveTo(0, -e.r * 1.02, e.r * 0.78, -e.r * 0.5);
      ctx.lineTo(e.r * 0.92, e.r * 0.48);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = bodyFill || '#59443a';
      ctx.beginPath(); ctx.arc(-e.r * 0.82, -e.r * 0.32, e.r * 0.36, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(e.r * 0.82, -e.r * 0.32, e.r * 0.36, 0, TAU); ctx.fill();
      ctx.fillStyle = bodyFill || '#241a15';
      ctx.beginPath(); ctx.arc(0, -e.r * 0.78, e.r * 0.44, Math.PI, 0); ctx.fill();
      ctx.fillRect(-e.r * 0.44, -e.r * 0.78, e.r * 0.88, e.r * 0.22);
      // Antler crown
      ctx.strokeStyle = bodyFill || '#8a6b4e';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-e.r * 0.3, -e.r * 1.14); ctx.lineTo(-e.r * 0.52, -e.r * 1.42); ctx.moveTo(-e.r * 0.3, -e.r * 1.14); ctx.lineTo(-e.r * 0.12, -e.r * 1.46); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e.r * 0.3, -e.r * 1.14); ctx.lineTo(e.r * 0.52, -e.r * 1.42); ctx.moveTo(e.r * 0.3, -e.r * 1.14); ctx.lineTo(e.r * 0.12, -e.r * 1.46); ctx.stroke();
      ctx.fillStyle = '#ffb054';
      ctx.fillRect(-e.r * 0.3, -e.r * 0.7, e.r * 0.6, 4.6);
    }
  }

  // Elite gilt ring
  if (elite) {
    ctx.strokeStyle = '#ffd479';
    ctx.lineWidth = 2.4;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 7, t * 1.4, t * 1.4 + TAU * 0.82); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Stun stars
  if (e.stun > 0) {
    ctx.save();
    ctx.fillStyle = '#ffe89a';
    for (let i = 0; i < 3; i += 1) {
      const a = t * 3 + (i / 3) * TAU;
      ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * (e.r + 10), e.y - e.r - 12 + Math.sin(a * 2) * 4, 2.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const t = game.time;
  const flash = p.hitFlash > 0;

  // Dash afterimages
  for (const ghost of p.dashTrail) {
    ctx.save();
    ctx.globalAlpha = ghost.life * 0.42;
    ctx.translate(ghost.x, ghost.y);
    ctx.fillStyle = '#8ef2c7';
    ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.9, p.r * 1.08, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(p.x, p.y);

  // Contact shadow
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(0, p.r * 0.92, p.r * 1.15, p.r * 0.4, 0, 0, TAU); ctx.fill();

  ctx.rotate(p.facing + Math.PI / 2);

  // Cloak
  const sway = Math.sin(t * 6) * 0.06;
  ctx.fillStyle = flash ? '#f6e7d7' : '#1e2a33';
  ctx.beginPath();
  ctx.moveTo(0, -p.r * 1.18);
  ctx.quadraticCurveTo(p.r * (0.95 + sway), -p.r * 0.25, p.r * 0.72, p.r * 0.95);
  ctx.quadraticCurveTo(0, p.r * 1.28, -p.r * 0.72, p.r * 0.95);
  ctx.quadraticCurveTo(-p.r * (0.95 + sway), -p.r * 0.25, 0, -p.r * 1.18);
  ctx.closePath(); ctx.fill();
  // Cloak trim
  ctx.strokeStyle = flash ? '#fff' : '#3f5b66';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Hood
  ctx.fillStyle = flash ? '#fff4e8' : '#28394a';
  ctx.beginPath(); ctx.arc(0, -p.r * 0.52, p.r * 0.52, 0, TAU); ctx.fill();
  ctx.fillStyle = flash ? '#fff' : '#111a24';
  ctx.beginPath(); ctx.arc(0, -p.r * 0.46, p.r * 0.32, 0, TAU); ctx.fill();
  // Eyes
  ctx.fillStyle = '#ffd88a';
  ctx.beginPath(); ctx.arc(-p.r * 0.13, -p.r * 0.5, 1.7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(p.r * 0.13, -p.r * 0.5, 1.7, 0, TAU); ctx.fill();

  // Blade — drawn toward the facing direction, swinging on attackAnim
  const swing = p.attackAnim > 0 ? Math.sin((1 - p.attackAnim / p.attackAnimMax) * Math.PI) : 0;
  ctx.save();
  ctx.translate(p.r * 0.66, p.r * 0.18);
  ctx.rotate(0.9 - swing * 1.7);
  const bladeLen = p.r * 1.55;
  const bladeGrad = ctx.createLinearGradient(0, 0, bladeLen, 0);
  bladeGrad.addColorStop(0, '#8f9db4');
  bladeGrad.addColorStop(0.35, '#e8efff');
  bladeGrad.addColorStop(1, '#ffffff');
  ctx.fillStyle = bladeGrad;
  ctx.beginPath();
  ctx.moveTo(0, -2.2);
  ctx.lineTo(bladeLen, -1.1);
  ctx.lineTo(bladeLen + 6, 0);
  ctx.lineTo(bladeLen, 1.1);
  ctx.lineTo(0, 2.2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5a4a2e';
  ctx.fillRect(-4, -3, 6, 6);
  ctx.restore();

  ctx.restore();
}

export function drawWorld(ctx, game) {
  const w = game.width;
  const h = game.height;
  const t = game.time;
  const room = game.room;
  const theme = game.floorData?.theme;

  // Backdrop beyond the hall walls
  ctx.fillStyle = theme?.sky || '#070409';
  ctx.fillRect(0, 0, w, h);

  if (!room) return;

  // Camera with shake
  const camX = game.camera.x;
  const camY = game.camera.y;
  const shake = game.camera.shake;
  const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shY = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const zoom = game.camera.zoom;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX + shX, -camY + shY);

  // Hall
  if (room.bg) ctx.drawImage(room.bg, 0, 0);

  // Interactable auras
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  if (room.type === 'treasure' && !room.chestOpened) {
    const cx = ROOM_W / 2, cy = ROOM_H / 2 + 8;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 90);
    g.addColorStop(0, `rgba(255, 219, 153, ${0.5 + pulse * 0.3})`);
    g.addColorStop(1, 'rgba(255, 219, 153, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a12';
    ctx.fillRect(cx - 26, cy - 14, 52, 30);
    ctx.fillStyle = '#5c4520';
    ctx.fillRect(cx - 26, cy - 20, 52, 12);
    ctx.fillStyle = '#ffd479';
    ctx.fillRect(cx - 4, cy - 8, 8, 8);
  } else if (room.type === 'shrine' && !room.shrineUsed) {
    const cx = ROOM_W / 2, cy = ROOM_H / 2 + 8;
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 95);
    g.addColorStop(0, `rgba(142, 242, 199, ${0.48 + pulse * 0.32})`);
    g.addColorStop(1, 'rgba(142, 242, 199, 0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 95, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8ef2c7';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 17 + pulse * 3, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, TAU); ctx.stroke();
  } else if ((room.type === 'exit' || room.type === 'boss')) {
    const cx = ROOM_W / 2, cy = ROOM_H / 2;
    const open = game.run?.sealBroken;
    const color = room.type === 'exit' ? '255, 212, 121' : '225, 83, 77';
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, open ? 150 : 80);
    g.addColorStop(0, `rgba(${color}, ${open ? 0.55 + pulse * 0.35 : 0.28})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, open ? 150 : 80, 0, TAU); ctx.fill();
    if (open) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.7);
      ctx.strokeStyle = `rgba(${color}, 0.85)`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, 34 + i * 17, i * 2.1, i * 2.1 + Math.PI * 1.32);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Door seals while the hall is locked
  const locked = !room.cleared && (room.type === 'combat' || room.type === 'boss');
  if (locked) {
    for (const dir of ['n', 's', 'e', 'w']) {
      if (!room.doors[dir]) continue;
      const c = doorPoint(room, dir);
      const horizontal = dir === 'n' || dir === 's';
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = 0.66 + pulse * 0.3;
      ctx.strokeStyle = '#ffd479';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(-60, 0); ctx.lineTo(60, 0); } else { ctx.moveTo(0, -60); ctx.lineTo(0, 60); }
      ctx.stroke();
      ctx.fillStyle = '#ffd479';
      ctx.save(); ctx.rotate(t); ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      ctx.restore();
    }
  }

  // Poison pools
  for (const hazard of game.hazards) {
    if (hazard.kind === 'pool') {
      const lifePct = Math.min(1, hazard.life / hazard.maxLife);
      const g = ctx.createRadialGradient(hazard.x, hazard.y, 4, hazard.x, hazard.y, hazard.r);
      g.addColorStop(0, `rgba(139, 224, 108, ${0.34 * lifePct + 0.14})`);
      g.addColorStop(1, 'rgba(80, 160, 70, 0.05)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(170, 255, 140, ${0.5 * lifePct})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.r, t, t + TAU); ctx.stroke();
    } else if (hazard.kind === 'ring') {
      ctx.strokeStyle = `rgba(255, 150, 100, ${0.85 * (1 - hazard.r / hazard.maxR + 0.25)})`;
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255, 220, 170, 0.9)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.r, 0, TAU); ctx.stroke();
    }
  }

  // Pickups — shard motes
  for (const pickup of game.pickups) {
    const bob = Math.sin(t * 3 + pickup.seed * 9) * 3;
    ctx.save();
    ctx.translate(pickup.x, pickup.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd88a';
    const s = pickup.size;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  // Enemy telegraphs under the bodies
  for (const e of game.enemies) drawTelegraph(ctx, e, t);

  // Enemies
  for (const e of game.enemies) drawEnemy(ctx, e, t);

  // Projectiles
  for (const proj of game.projectiles) {
    ctx.save();
    ctx.translate(proj.x, proj.y);
    if (proj.side === 'player') {
      ctx.rotate(Math.atan2(proj.vy, proj.vx));
      const grad = ctx.createLinearGradient(-26, 0, 12, 0);
      grad.addColorStop(0, 'rgba(163, 139, 255, 0)');
      grad.addColorStop(0.72, '#c9b8ff');
      grad.addColorStop(1, '#ffffff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-26, -4.4); ctx.lineTo(6, -3); ctx.lineTo(13, 0); ctx.lineTo(6, 3); ctx.lineTo(-26, 4.4);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = proj.color || '#cfeaff';
      ctx.beginPath(); ctx.arc(0, 0, proj.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, proj.r * 0.45, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // Player
  if (game.player?.alive !== false) drawPlayer(ctx, game);

  // Slash effects
  for (const fx of game.effects) {
    if (fx.type !== 'slash') continue;
    const p1 = Math.min(1, fx.t / fx.dur);
    ctx.save();
    ctx.translate(fx.x, fx.y);
    ctx.rotate(fx.angle);
    ctx.globalAlpha = 1 - p1;
    ctx.strokeStyle = '#eef4ff';
    ctx.lineWidth = 5 * (1 - p1) + 1;
    ctx.beginPath();
    ctx.arc(0, 0, fx.range * (0.55 + p1 * 0.6), -fx.arc / 2, fx.arc / 2);
    ctx.stroke();
    ctx.restore();
  }

  // Particles
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating texts
  ctx.save();
  ctx.font = '700 15px "Cinzel", serif';
  ctx.textAlign = 'center';
  for (const txt of game.texts) {
    ctx.globalAlpha = Math.max(0, txt.life / txt.maxLife);
    ctx.fillStyle = txt.color;
    ctx.fillText(txt.text, txt.x, txt.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // Weather motes drifting through the hall
  ctx.fillStyle = theme?.motes || '#ffb06d';
  for (let i = 0; i < 14; i += 1) {
    const seed = i * 137.3;
    const drift = (t * 24 + seed * 13) % (ROOM_H + 120);
    const mx = (seed * 7.13) % ROOM_W + Math.sin(t * 0.8 + i) * 26;
    ctx.globalAlpha = 0.16 + 0.14 * Math.sin(t * 1.6 + i * 2.1);
    ctx.beginPath();
    ctx.arc(mx, drift - 60, 1.5 + (i % 3) * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Low HP heartbeat vignette tint in-world
  if (game.player && game.player.hp / game.player.maxHp < 0.28) {
    const beat = 0.1 + 0.08 * Math.sin(t * 5.2);
    const vg = ctx.createRadialGradient(ROOM_W / 2, ROOM_H / 2, ROOM_H * 0.34, ROOM_W / 2, ROOM_H / 2, ROOM_H * 0.72);
    vg.addColorStop(0, 'rgba(120, 10, 16, 0)');
    vg.addColorStop(1, `rgba(120, 10, 16, ${beat})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, ROOM_W, ROOM_H);
  }

  ctx.restore();

  // Floor banner (FLOOR 04 — Guardian name, rank promos)
  if (game.banner && game.banner.time < game.banner.max) {
    const b = game.banner;
    const fadeIn = Math.min(1, b.time / 0.35);
    const fadeOut = Math.min(1, Math.max(0, (b.max - b.time) / 0.5));
    const alpha = Math.min(fadeIn, fadeOut);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = b.tone === 'boss' ? '#ff9a8c' : b.tone === 'floor' ? '#ffd479' : '#ffdb99';
    ctx.font = '600 15px "Chakra Petch", sans-serif';
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillText(b.text, w / 2, h * 0.3);
    ctx.globalAlpha = alpha;
    ctx.font = '700 34px "Cinzel", serif';
    ctx.fillText(b.sub, w / 2, h * 0.3 + 44);
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillRect(w / 2 - 90, h * 0.3 + 58, 180, 1);
    ctx.restore();
  }
}
