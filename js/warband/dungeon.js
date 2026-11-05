// Tile dungeon generation, fog of war, minimap and canvas renderer.
import { floorData } from './data.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(value) {
  let h = 2166136261 >>> 0;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

function randInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}

function shuffle(rand, list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function roomOverlaps(a, b, pad = 1) {
  return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
}

export function generateDungeon(floor, seed = Date.now()) {
  const rand = mulberry32(typeof seed === 'number' ? seed : hashSeed(seed));
  const width = 31;
  const height = 21;
  const tiles = new Uint8Array(width * height);
  const rooms = [];

  for (let attempt = 0; attempt < 110 && rooms.length < 9; attempt += 1) {
    const w = randInt(rand, 5, 8);
    const h = randInt(rand, 4, 6);
    const x = randInt(rand, 1, width - w - 2);
    const y = randInt(rand, 1, height - h - 2);
    const room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
    if (rooms.some((other) => roomOverlaps(room, other, 1))) continue;
    rooms.push(room);
  }

  // Guarantee a usable layout even on a very unlucky seed.
  if (rooms.length < 5) {
    rooms.length = 0;
    const fallback = [
      { x: 2, y: 2, w: 6, h: 5 },
      { x: 12, y: 2, w: 6, h: 5 },
      { x: 22, y: 3, w: 6, h: 5 },
      { x: 3, y: 13, w: 6, h: 5 },
      { x: 13, y: 12, w: 6, h: 5 },
      { x: 23, y: 12, w: 6, h: 5 }
    ];
    for (const r of fallback) rooms.push({ ...r, cx: r.x + Math.floor(r.w / 2), cy: r.y + Math.floor(r.h / 2) });
  }

  const carve = (x, y) => {
    if (x > 0 && y > 0 && x < width - 1 && y < height - 1) tiles[y * width + x] = 1;
  };

  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) carve(x, y);
    }
  }

  const connect = (a, b) => {
    let x = a.cx;
    let y = a.cy;
    const horizontalFirst = rand() > 0.5;
    if (horizontalFirst) {
      while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); }
      while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); }
    } else {
      while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); }
      while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); }
    }
    carve(b.cx, b.cy);
  };

  for (let i = 1; i < rooms.length; i += 1) connect(rooms[i - 1], rooms[i]);
  for (let i = 0; i < rooms.length - 2; i += 1) {
    if (rand() < 0.28) connect(rooms[i], rooms[i + 2]);
  }

  const startRoom = rooms[0];
  const start = { x: startRoom.cx, y: startRoom.cy };

  const distanceFrom = (origin) => {
    const dist = new Int16Array(width * height).fill(-1);
    const queue = [origin];
    dist[origin.y * width + origin.x] = 0;
    while (queue.length) {
      const cur = queue.shift();
      const d = dist[cur.y * width + cur.x];
      for (const [dx, dy] of DIRS) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (tiles[ny * width + nx] !== 1) continue;
        const idx = ny * width + nx;
        if (dist[idx] !== -1) continue;
        dist[idx] = d + 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return dist;
  };

  const dist = distanceFrom(start);
  let stairsRoom = rooms[rooms.length - 1];
  let best = -1;
  for (const room of rooms) {
    if (room === startRoom) continue;
    const d = dist[room.cy * width + room.cx];
    if (d > best) { best = d; stairsRoom = room; }
  }
  const stairs = { x: stairsRoom.cx, y: stairsRoom.cy };

  const occupied = new Set([`${start.x},${start.y}`, `${stairs.x},${stairs.y}`]);
  const otherRooms = shuffle(rand, rooms.filter((r) => r !== startRoom && r !== stairsRoom));

  const floorTilesIn = (room) => {
    const list = [];
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        if (tiles[y * width + x] === 1 && !occupied.has(`${x},${y}`)) list.push({ x, y });
      }
    }
    return shuffle(rand, list);
  };

  const entities = [];
  const placeEntity = (type, room, extra = {}) => {
    const tilesList = floorTilesIn(room);
    const spot = tilesList.find((t) => !entities.some((e) => e.x === t.x && e.y === t.y));
    if (!spot) return null;
    occupied.add(`${spot.x},${spot.y}`);
    const entity = { id: `${type}_${entities.length}_${Math.floor(rand() * 9999)}`, type, x: spot.x, y: spot.y, ...extra };
    entities.push(entity);
    return entity;
  };

  const encounters = [];
  const isBossFloor = floor === 3 || floor === 5;
  const normalCount = floor === 1 ? 3 : floor === 2 ? 3 : floor === 4 ? 3 : 3;
  for (let i = 0; i < normalCount; i += 1) {
    const room = otherRooms[i % otherRooms.length];
    if (!room) break;
    const elite = floor >= 2 && i === normalCount - 1 && !isBossFloor;
    const entity = placeEntity('encounter', room, { encounterType: elite ? 'elite' : 'normal', cleared: false, floor });
    if (entity) encounters.push(entity);
  }

  if (isBossFloor) {
    const room = otherRooms[Math.min(otherRooms.length - 1, normalCount)] || stairsRoom;
    const entity = placeEntity('encounter', room, {
      encounterType: 'boss',
      bossId: floor === 5 ? 'crown' : 'warden',
      cleared: false,
      floor
    });
    if (entity) encounters.push(entity);
  }

  const chests = [];
  for (let i = 0; i < 2; i += 1) {
    const room = otherRooms[(i + 2) % otherRooms.length];
    if (!room) break;
    const entity = placeEntity('chest', room, { opened: false });
    if (entity) chests.push(entity);
  }

  const shrines = [];
  const shrineRoom = otherRooms[otherRooms.length - 1];
  if (shrineRoom) {
    const entity = placeEntity('shrine', shrineRoom, { used: false });
    if (entity) shrines.push(entity);
  }

  // Decorative torches on room walls. They also give the map a warm rhythm.
  const torches = [];
  for (const room of rooms) {
    const candidates = [
      { x: room.x, y: room.y },
      { x: room.x + room.w - 1, y: room.y },
      { x: room.x, y: room.y + room.h - 1 },
      { x: room.x + room.w - 1, y: room.y + room.h - 1 }
    ];
    for (const c of candidates) {
      if (rand() < 0.7) torches.push({ x: c.x, y: c.y, phase: rand() * Math.PI * 2 });
    }
  }

  return {
    floor,
    seed: typeof seed === 'number' ? seed : hashSeed(seed),
    width,
    height,
    tiles,
    rooms,
    start,
    stairs,
    encounters,
    chests,
    shrines,
    torches,
    theme: floorData(floor),
    dist
  };
}

export function tileAt(dungeon, x, y) {
  if (x < 0 || y < 0 || x >= dungeon.width || y >= dungeon.height) return 0;
  return dungeon.tiles[y * dungeon.width + x];
}

export function isWalkable(dungeon, x, y) {
  return tileAt(dungeon, x, y) === 1;
}

export function entityAt(dungeon, x, y) {
  return [...dungeon.encounters, ...dungeon.chests, ...dungeon.shrines].find((e) => e.x === x && e.y === y && !(e.cleared || e.opened || e.used));
}

export function revealAround(dungeon, pos, radius, visible, explored) {
  visible.clear();
  const r = radius;
  for (let y = pos.y - r; y <= pos.y + r; y += 1) {
    for (let x = pos.x - r; x <= pos.x + r; x += 1) {
      if (x < 0 || y < 0 || x >= dungeon.width || y >= dungeon.height) continue;
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (dx * dx + dy * dy > r * r + r) continue;
      visible.add(`${x},${y}`);
      explored.add(`${x},${y}`);
    }
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function tileHash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695040) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function drawDungeon(ctx, cssWidth, cssHeight, dungeon, view, time, party, leader) {
  const theme = dungeon.theme;
  const tile = Math.max(26, Math.min(54, Math.min(cssWidth / (dungeon.width + 2.5), cssHeight / (dungeon.height + 2.5))));
  const mapW = dungeon.width * tile;
  const mapH = dungeon.height * tile;
  const targetX = party.x * tile + tile / 2 - cssWidth / 2;
  const targetY = party.y * tile + tile / 2 - cssHeight / 2;
  const maxX = Math.max(0, mapW - cssWidth);
  const maxY = Math.max(0, mapH - cssHeight);
  const wantX = mapW <= cssWidth ? (cssWidth - mapW) / 2 : clamp(targetX, 0, maxX);
  const wantY = mapH <= cssHeight ? (cssHeight - mapH) / 2 : clamp(targetY, 0, maxY);
  if (view.camX == null) { view.camX = wantX; view.camY = wantY; }
  view.camX = lerp(view.camX, wantX, 0.16);
  view.camY = lerp(view.camY, wantY, 0.16);
  const camX = view.camX;
  const camY = view.camY;

  ctx.clearRect(0, 0, cssWidth, cssHeight);
  const bg = ctx.createRadialGradient(cssWidth / 2, cssHeight / 2, 20, cssWidth / 2, cssHeight / 2, Math.max(cssWidth, cssHeight) * 0.75);
  bg.addColorStop(0, theme.fog);
  bg.addColorStop(1, '#050409');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const startX = Math.max(0, Math.floor(camX / tile) - 1);
  const endX = Math.min(dungeon.width - 1, Math.ceil((camX + cssWidth) / tile) + 1);
  const startY = Math.max(0, Math.floor(camY / tile) - 1);
  const endY = Math.min(dungeon.height - 1, Math.ceil((camY + cssHeight) / tile) + 1);

  // Ambient torch glow behind the tiles.
  for (const torch of dungeon.torches) {
    const key = `${torch.x},${torch.y}`;
    if (!view.explored.has(key)) continue;
    const sx = torch.x * tile + tile / 2 - camX;
    const sy = torch.y * tile + tile / 2 - camY;
    if (sx < -tile * 4 || sy < -tile * 4 || sx > cssWidth + tile * 4 || sy > cssHeight + tile * 4) continue;
    const flicker = 0.82 + Math.sin(time * 0.004 + torch.phase) * 0.18;
    const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, tile * 3.2);
    glow.addColorStop(0, `${theme.accent}44`);
    glow.addColorStop(0.45, `${theme.accent}14`);
    glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = flicker;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, tile * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const key = `${x},${y}`;
      if (!view.explored.has(key)) continue;
      const visible = view.visible.has(key);
      const sx = Math.floor(x * tile - camX);
      const sy = Math.floor(y * tile - camY);
      const isFloor = tileAt(dungeon, x, y) === 1;
      if (isFloor) {
        const alt = (x + y) % 2 === 0;
        ctx.fillStyle = alt ? theme.floor : theme.floorAlt;
        ctx.fillRect(sx, sy, tile + 1, tile + 1);
        const noise = tileHash(x, y, dungeon.seed);
        if (noise > 0.72) {
          ctx.fillStyle = 'rgba(255,255,255,0.025)';
          ctx.fillRect(sx + tile * 0.2, sy + tile * 0.32, tile * 0.55, 1);
          ctx.fillRect(sx + tile * 0.4, sy + tile * 0.62, tile * 0.28, 1);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, tile, tile);
        // A faint inner highlight makes the stone read as carved tiles.
        ctx.fillStyle = 'rgba(255,255,255,0.018)';
        ctx.fillRect(sx + 1, sy + 1, tile - 2, 1);
      } else {
        const hasFloorBelow = tileAt(dungeon, x, y + 1) === 1;
        const hasFloorRight = tileAt(dungeon, x + 1, y) === 1;
        ctx.fillStyle = theme.wall;
        ctx.fillRect(sx, sy, tile + 1, tile + 1);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(sx, sy + tile * 0.72, tile + 1, tile * 0.28 + 1);
        if (hasFloorBelow) {
          ctx.fillStyle = theme.wallTop;
          ctx.fillRect(sx, sy + tile - 5, tile + 1, 5);
          ctx.fillStyle = 'rgba(0,0,0,0.32)';
          ctx.fillRect(sx, sy + tile, tile + 1, 5);
        }
        if (hasFloorRight) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(sx + tile - 2, sy, 2, tile);
        }
        const n = tileHash(x, y, dungeon.seed + 7);
        if (n > 0.66) {
          ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          ctx.beginPath();
          ctx.moveTo(sx + tile * 0.2, sy + tile * 0.15);
          ctx.lineTo(sx + tile * 0.42, sy + tile * 0.48);
          ctx.lineTo(sx + tile * 0.35, sy + tile * 0.8);
          ctx.stroke();
        }
      }
      if (!visible) {
        ctx.fillStyle = 'rgba(3, 2, 6, 0.64)';
        ctx.fillRect(sx, sy, tile + 1, tile + 1);
      }
    }
  }

  const pulse = 0.7 + Math.sin(time * 0.004) * 0.3;
  const drawWorld = (wx, wy, fn) => {
    const sx = wx * tile + tile / 2 - camX;
    const sy = wy * tile + tile / 2 - camY;
    if (sx < -tile * 2 || sy < -tile * 2 || sx > cssWidth + tile * 2 || sy > cssHeight + tile * 2) return;
    fn(sx, sy);
  };

  for (const torch of dungeon.torches) {
    const key = `${torch.x},${torch.y}`;
    if (!view.visible.has(key)) continue;
    drawWorld(torch.x, torch.y, (sx, sy) => {
      const flicker = 0.7 + Math.sin(time * 0.01 + torch.phase) * 0.3;
      ctx.fillStyle = `rgba(255, 194, 112, ${0.5 + flicker * 0.4})`;
      ctx.beginPath();
      ctx.arc(sx, sy - tile * 0.18, tile * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 231, 176, ${0.7 * flicker})`;
      ctx.beginPath();
      ctx.arc(sx, sy - tile * 0.22, tile * 0.04, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  for (const chest of dungeon.chests) {
    if (chest.opened) continue;
    const key = `${chest.x},${chest.y}`;
    if (!view.explored.has(key)) continue;
    drawWorld(chest.x, chest.y, (sx, sy) => {
      ctx.globalAlpha = view.visible.has(key) ? 1 : 0.42;
      ctx.fillStyle = '#7b5624';
      ctx.fillRect(sx - tile * 0.2, sy - tile * 0.12, tile * 0.4, tile * 0.28);
      ctx.fillStyle = '#e7b96a';
      ctx.fillRect(sx - tile * 0.2, sy - tile * 0.12, tile * 0.4, tile * 0.08);
      ctx.fillStyle = '#ffe8ad';
      ctx.fillRect(sx - tile * 0.035, sy - tile * 0.02, tile * 0.07, tile * 0.08);
      ctx.globalAlpha = 1;
    });
  }

  for (const shrine of dungeon.shrines) {
    if (shrine.used) continue;
    const key = `${shrine.x},${shrine.y}`;
    if (!view.explored.has(key)) continue;
    drawWorld(shrine.x, shrine.y, (sx, sy) => {
      ctx.globalAlpha = view.visible.has(key) ? 1 : 0.42;
      const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, tile * 0.8);
      glow.addColorStop(0, 'rgba(121,224,192,0.5)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, tile * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#79e0c0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, tile * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c6ffec';
      ctx.font = `${Math.round(tile * 0.34)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✦', sx, sy + 1);
      ctx.globalAlpha = 1;
    });
  }

  for (const encounter of dungeon.encounters) {
    if (encounter.cleared) continue;
    const key = `${encounter.x},${encounter.y}`;
    if (!view.explored.has(key)) continue;
    drawWorld(encounter.x, encounter.y, (sx, sy) => {
      const isBoss = encounter.encounterType === 'boss';
      const isElite = encounter.encounterType === 'elite';
      const color = isBoss ? '#ffd479' : isElite ? '#ff9e58' : '#f07d8b';
      const r = tile * (isBoss ? 0.38 : isElite ? 0.3 : 0.24);
      ctx.globalAlpha = view.visible.has(key) ? 1 : 0.45;
      const glow = ctx.createRadialGradient(sx, sy, 1, sx, sy, r * 2.5);
      glow.addColorStop(0, `${color}66`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isBoss ? 2 : 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, r * (0.9 + pulse * 0.14), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `${Math.round(tile * (isBoss ? 0.42 : 0.3))}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isBoss ? '♛' : isElite ? '✧' : '✧', sx, sy + 1);
      ctx.globalAlpha = 1;
    });
  }

  const stairsKey = `${dungeon.stairs.x},${dungeon.stairs.y}`;
  if (view.explored.has(stairsKey)) {
    drawWorld(dungeon.stairs.x, dungeon.stairs.y, (sx, sy) => {
      const visible = view.visible.has(stairsKey);
      ctx.globalAlpha = visible ? 1 : 0.48;
      const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, tile * 0.9);
      glow.addColorStop(0, 'rgba(169,151,255,0.6)');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, tile * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a997ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, tile * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#d9ceff';
      ctx.font = `${Math.round(tile * 0.32)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⇣', sx, sy + 1);
      ctx.globalAlpha = 1;
    });
  }

  // Party torchlight and token.
  const px = party.x * tile + tile / 2 - camX;
  const py = party.y * tile + tile / 2 - camY;
  const light = ctx.createRadialGradient(px, py, 2, px, py, tile * 4.2);
  light.addColorStop(0, 'rgba(255, 223, 164, 0.22)');
  light.addColorStop(0.4, 'rgba(255, 194, 112, 0.08)');
  light.addColorStop(1, 'transparent');
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(px, py, tile * 4.2, 0, Math.PI * 2);
  ctx.fill();

  if (party.length > 1) {
    for (let i = 1; i < party.length; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(1, party.length - 1) + time * 0.0006;
      const radius = tile * 0.34;
      const ox = px + Math.cos(angle) * radius;
      const oy = py + Math.sin(angle) * radius;
      ctx.fillStyle = 'rgba(231,185,106,0.5)';
      ctx.beginPath();
      ctx.arc(ox, oy, tile * 0.055, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = leader?.color || '#e7b96a';
  ctx.beginPath();
  ctx.arc(px, py, tile * 0.27, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 242, 211, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px, py, tile * 0.27, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#160f08';
  ctx.font = `${Math.round(tile * 0.3)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(leader?.glyph || '✧', px, py + 1);

  // Compass hint toward the stairs when they are still unexplored.
  if (!view.explored.has(stairsKey)) {
    const angle = Math.atan2(dungeon.stairs.y - party.y, dungeon.stairs.x - party.x);
    const cx = cssWidth / 2 + Math.cos(angle) * Math.min(cssWidth, cssHeight) * 0.32;
    const cy = cssHeight / 2 + Math.sin(angle) * Math.min(cssWidth, cssHeight) * 0.32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(169,151,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function drawMinimap(canvas, dungeon, view, party) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const theme = dungeon.theme;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(7,6,11,0.82)';
  ctx.fillRect(0, 0, w, h);
  const sx = w / dungeon.width;
  const sy = h / dungeon.height;
  const size = Math.min(sx, sy);
  const ox = (w - dungeon.width * size) / 2;
  const oy = (h - dungeon.height * size) / 2;

  for (let y = 0; y < dungeon.height; y += 1) {
    for (let x = 0; x < dungeon.width; x += 1) {
      const key = `${x},${y}`;
      if (!view.explored.has(key)) continue;
      const isFloor = tileAt(dungeon, x, y) === 1;
      ctx.fillStyle = isFloor ? (view.visible.has(key) ? theme.wallTop : 'rgba(70,60,80,0.35)') : 'rgba(20,16,26,0.5)';
      ctx.fillRect(ox + x * size, oy + y * size, Math.ceil(size), Math.ceil(size));
    }
  }

  const dot = (x, y, color, r = Math.max(1.5, size * 0.28)) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox + x * size + size / 2, oy + y * size + size / 2, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const e of dungeon.encounters) {
    if (e.cleared) continue;
    if (!view.explored.has(`${e.x},${e.y}`)) continue;
    dot(e.x, e.y, e.encounterType === 'boss' ? '#ffd479' : '#f07d8b', Math.max(1.6, size * 0.28));
  }
  for (const c of dungeon.chests) {
    if (c.opened || !view.explored.has(`${c.x},${c.y}`)) continue;
    dot(c.x, c.y, '#e7b96a', Math.max(1.2, size * 0.2));
  }
  for (const s of dungeon.shrines) {
    if (s.used || !view.explored.has(`${s.x},${s.y}`)) continue;
    dot(s.x, s.y, '#79e0c0', Math.max(1.2, size * 0.2));
  }
  if (view.explored.has(`${dungeon.stairs.x},${dungeon.stairs.y}`)) dot(dungeon.stairs.x, dungeon.stairs.y, '#a997ff', Math.max(2, size * 0.36));
  dot(party.x, party.y, '#fff2d3', Math.max(2.2, size * 0.4));
  ctx.strokeStyle = 'rgba(231,185,106,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
