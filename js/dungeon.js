import { ROOM_W, ROOM_H, WALL, BOSS_FLOORS, MAX_FLOOR, themeForFloor } from './data.js';

export function makeRng(seed = Date.now()) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DIRS = {
  n: { x: 0, y: -1, opposite: 's' },
  e: { x: 1, y: 0, opposite: 'w' },
  s: { x: 0, y: 1, opposite: 'n' },
  w: { x: -1, y: 0, opposite: 'e' }
};

const ROOM_NAMES = {
  ember: ['Hall of Cinders', 'The Rust Chapel', 'Ember Ward', 'Furnace Gallery', 'The Ashen Stair', 'Oathbreaker Vault'],
  verdant: ['Rootbound Gallery', 'The Green Reliquary', 'Thorn Choir', 'Moss Archive', 'The Blooming Cell', 'Matriarch’s Walk'],
  astral: ['Starfall Gallery', 'The Glass Orrery', 'Aether Observatory', 'The Ninth Window', 'Void Antechamber', 'The Silent Meridian'],
  crown: ['Throne of Rust', 'The Hollow Aisle', 'Crown’s Descent', 'The Last Balcony', 'Night’s Anvil', 'The Empty Court']
};

const ROOM_TYPES = {
  start: { label: 'Threshold', icon: '◈' },
  combat: { label: 'Sealed Hall', icon: '⚔' },
  treasure: { label: 'Hoard', icon: '✧' },
  shrine: { label: 'Shrine', icon: '✦' },
  exit: { label: 'Stair Gate', icon: '⇧' },
  boss: { label: 'Guardian', icon: '♛' }
};

function key(x, y) { return `${x},${y}`; }

function addRoom(rooms, x, y, parent, dir) {
  const k = key(x, y);
  if (rooms[k]) return rooms[k];
  const room = {
    key: k,
    x, y,
    doors: { n: null, e: null, s: null, w: null },
    parent: parent || null,
    type: 'combat',
    visited: false,
    cleared: false,
    spawned: false,
    enemies: [],
    obstacles: [],
    chestOpened: false,
    shrineUsed: false,
    depth: 0,
    name: ''
  };
  rooms[k] = room;
  if (parent && dir) {
    room.doors[DIRS[dir].opposite] = parent.key;
    parent.doors[dir] = room.key;
  }
  return room;
}

function connect(rooms, a, b, dir) {
  if (!a || !b) return;
  a.doors[dir] = b.key;
  b.doors[DIRS[dir].opposite] = a.key;
}

function walkableNeighbors(room, rooms) {
  const out = [];
  for (const [dir, d] of Object.entries(DIRS)) {
    const other = rooms[key(room.x + d.x, room.y + d.y)];
    if (other) out.push({ dir, room: other });
  }
  return out;
}

function bfs(rooms, start) {
  const dist = { [start.key]: 0 };
  const queue = [start];
  while (queue.length) {
    const room = queue.shift();
    for (const { room: next } of walkableNeighbors(room, rooms)) {
      if (dist[next.key] === undefined) {
        dist[next.key] = dist[room.key] + 1;
        queue.push(next);
      }
    }
  }
  return dist;
}

function placeObstacles(room, rand) {
  const count = rand() < 0.25 ? 0 : 1 + Math.floor(rand() * 3);
  const safe = [
    { x: ROOM_W / 2, y: ROOM_H / 2, r: 180 },
    { x: ROOM_W / 2, y: WALL + 130, r: 150 },
    { x: ROOM_W / 2, y: ROOM_H - WALL - 130, r: 150 },
    { x: WALL + 130, y: ROOM_H / 2, r: 150 },
    { x: ROOM_W - WALL - 130, y: ROOM_H / 2, r: 150 }
  ];
  let attempts = 0;
  while (room.obstacles.length < count && attempts < 80) {
    attempts++;
    const x = WALL + 100 + rand() * (ROOM_W - WALL * 2 - 200);
    const y = WALL + 100 + rand() * (ROOM_H - WALL * 2 - 200);
    if (safe.some(s => Math.hypot(x - s.x, y - s.y) < s.r)) continue;
    if (room.obstacles.some(o => Math.hypot(x - o.x, y - o.y) < 150)) continue;
    room.obstacles.push({
      x, y,
      r: 22 + rand() * 12,
      kind: rand() < 0.45 ? 'pillar' : rand() < 0.6 ? 'statue' : 'crystal',
      seed: rand()
    });
  }
}

export function generateFloor(floor, rand = Math.random) {
  const theme = themeForFloor(floor);
  const rooms = {};
  const start = addRoom(rooms, 3, 3, null, null);
  const targetCount = BOSS_FLOORS.includes(floor)
    ? (floor === 12 ? 6 : 5)
    : 7 + Math.floor(rand() * 3);
  const frontier = [start];
  let guard = 0;
  while (Object.keys(rooms).length < targetCount && guard++ < 400) {
    const base = frontier[Math.floor(rand() * frontier.length)];
    const options = Object.entries(DIRS)
      .filter(([, d]) => {
        const nx = base.x + d.x, ny = base.y + d.y;
        return nx >= 0 && nx < 7 && ny >= 0 && ny < 7 && !rooms[key(nx, ny)];
      });
    if (!options.length) { frontier.splice(frontier.indexOf(base), 1); if (!frontier.length) break; continue; }
    const [dir, d] = options[Math.floor(rand() * options.length)];
    const next = addRoom(rooms, base.x + d.x, base.y + d.y, base, dir);
    frontier.push(next);
    // Occasional side connections create loops and make the map feel less like a corridor.
    if (rand() < 0.18) {
      const side = Object.entries(DIRS)[Math.floor(rand() * 4)];
      const other = rooms[key(next.x + side[1].x, next.y + side[1].y)];
      if (other && other !== base && !next.doors[side[0]]) connect(rooms, next, other, side[0]);
    }
  }

  const dist = bfs(rooms, start);
  let farthest = start;
  for (const room of Object.values(rooms)) {
    room.depth = dist[room.key] || 0;
    if (room.depth > farthest.depth) farthest = room;
  }

  if (BOSS_FLOORS.includes(floor)) {
    farthest.type = 'boss';
    const rest = Object.values(rooms).filter(r => r !== start && r !== farthest);
    const pool = rest.sort(() => rand() - 0.5);
    if (pool[0]) pool[0].type = 'shrine';
    if (pool[1]) pool[1].type = 'treasure';
  } else {
    farthest.type = 'exit';
    const rest = Object.values(rooms)
      .filter(r => r !== start && r !== farthest)
      .sort((a, b) => b.depth - a.depth);
    if (rest[0] && rand() < 0.85) rest[0].type = 'treasure';
    const shrineCandidates = rest.filter(r => r.type === 'combat');
    if (shrineCandidates.length) {
      shrineCandidates[Math.floor(rand() * shrineCandidates.length)].type = 'shrine';
    }
  }

  const names = ROOM_NAMES[theme.id];
  for (const room of Object.values(rooms)) {
    if (room.type === 'start') room.name = 'The Threshold';
    else if (room.type === 'boss') room.name = floor === 12 ? 'The Empty Court' : floor === 8 ? 'The Blooming Cell' : 'The Ashen Stair';
    else if (room.type === 'exit') room.name = 'The Stair Gate';
    else if (room.type === 'shrine') room.name = 'Aether Shrine';
    else if (room.type === 'treasure') room.name = 'Sealed Hoard';
    else room.name = names[Math.floor(rand() * names.length)];
    placeObstacles(room, rand);
  }

  const roomsList = Object.values(rooms);
  return {
    floor,
    theme,
    rooms,
    list: roomsList,
    startKey: start.key,
    exitKey: farthest.type === 'exit' ? farthest.key : null,
    bossKey: farthest.type === 'boss' ? farthest.key : null,
    maxDepth: farthest.depth,
    seed: Math.floor(rand() * 1e9),
    required: roomsList.filter(r => r.type === 'combat' || r.type === 'boss').length
  };
}

export function roomTypeInfo(type) {
  return ROOM_TYPES[type] || ROOM_TYPES.combat;
}

export function doorPoint(room, dir) {
  switch (dir) {
    case 'n': return { x: ROOM_W / 2, y: WALL / 2 };
    case 's': return { x: ROOM_W / 2, y: ROOM_H - WALL / 2 };
    case 'w': return { x: WALL / 2, y: ROOM_H / 2 };
    case 'e': return { x: ROOM_W - WALL / 2, y: ROOM_H / 2 };
    default: return { x: ROOM_W / 2, y: ROOM_H / 2 };
  }
}

export function doorAperture(room, dir) {
  const c = doorPoint(room, dir);
  const half = 72;
  if (dir === 'n' || dir === 's') return { x: c.x - half, y: c.y - 8, w: half * 2, h: 16 };
  return { x: c.x - 8, y: c.y - half, w: 16, h: half * 2 };
}

export function roomCenter(room) {
  return { x: ROOM_W / 2, y: ROOM_H / 2 };
}
