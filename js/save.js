import {
  SAVE_KEY, RANKS, MAX_FLOOR, CONTRACT_TEMPLATES, WEAPONS, ARMORS, CHARMS
} from './data.js';

export function rankIndexForXp(xp = 0) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) index = i;
  return index;
}

export function rankForXp(xp = 0) {
  return RANKS[rankIndexForXp(xp)];
}

export function nextRank(xp = 0) {
  return RANKS.find(r => r.xp > xp) || null;
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function contractProgress(save, contract) {
  if (!contract) return { value: 0, target: 1, complete: false, label: '' };
  const current = save.stats[contract.stat] || 0;
  const value = contract.absolute ? Math.min(current, contract.target) : Math.max(0, current - contract.start);
  return {
    value,
    target: contract.target,
    complete: value >= contract.target,
    label: `${Math.min(value, contract.target)} / ${contract.target}`
  };
}

export function generateContract(save, rand = Math.random, avoidIds = []) {
  const rank = rankIndexForXp(save.licenseXp);
  let pool = CONTRACT_TEMPLATES.filter(t => !avoidIds.includes(t.id));
  if ((save.stats.bestFloor || 0) >= MAX_FLOOR) pool = pool.filter(t => t.id !== 'depth');
  if (!pool.length) pool = CONTRACT_TEMPLATES.filter(t => t.id !== 'depth');
  const template = pool[Math.floor(rand() * pool.length)];
  let target;
  if (template.absolute) {
    target = Math.max(2, Math.min(MAX_FLOOR, Math.max(save.checkpointFloor || 1, save.stats.bestFloor + 1)));
  } else {
    target = Math.max(1, Math.round(template.min + rank * template.scale + rand() * (template.max - template.min) * 0.8));
  }
  const rewardScale = 0.85 + rank * 0.22;
  const rewardShards = Math.round((22 + target * 3.5) * template.reward * rewardScale);
  const rewardXp = Math.round((35 + target * 5) * template.reward * rewardScale);
  return {
    id: uid(),
    templateId: template.id,
    title: template.title,
    stat: template.stat,
    unit: template.unit,
    absolute: Boolean(template.absolute),
    start: template.absolute ? 0 : (save.stats[template.stat] || 0),
    target,
    rewardShards,
    rewardXp,
    createdAt: Date.now()
  };
}

export function refillContracts(save, rand = Math.random) {
  const active = new Set((save.contracts || []).map(c => c.templateId));
  while ((save.contracts || []).length < 3) {
    const c = generateContract(save, rand, [...active]);
    save.contracts.push(c);
    active.add(c.templateId);
  }
  return save.contracts;
}

export function defaultSave(rand = Math.random) {
  const save = {
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    licenseXp: 0,
    shards: 0,
    checkpointFloor: 1,
    hunter: { name: 'Lyra Vane', id: 'HV-0713' },
    stats: {
      kills: 0,
      killsByType: {},
      floors: 0,
      rooms: 0,
      bosses: 0,
      shardsEarned: 0,
      boons: 0,
      bestFloor: 0,
      runs: 0,
      deaths: 0,
      wins: 0
    },
    meta: { vitality: 0, might: 0, agility: 0, aether: 0, fortune: 0 },
    equipment: {
      weapon: 'saber',
      armor: 'coat',
      charm: null,
      levels: {
        saber: 1, daggers: 1, greatsword: 1,
        coat: 1, mail: 1, vestment: 1
      }
    },
    unlocked: {
      weapons: ['saber'],
      armors: ['coat'],
      charms: []
    },
    contracts: [],
    settings: { sound: true, music: true, shake: true, hints: true },
    lastRun: null
  };
  refillContracts(save, rand);
  return save;
}

function mergeDefaults(target, defaults) {
  for (const [key, value] of Object.entries(defaults)) {
    if (target[key] === undefined) target[key] = value;
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (typeof target[key] !== 'object' || target[key] === null) target[key] = value;
      else mergeDefaults(target[key], value);
    }
  }
  return target;
}

export function normalizeSave(raw) {
  const save = mergeDefaults(raw || {}, defaultSave(Math.random));
  if (!Array.isArray(save.contracts)) save.contracts = [];
  save.contracts = save.contracts.filter(c => c && c.templateId && c.stat);
  if (save.contracts.length < 3) refillContracts(save);
  // Repair any save that references equipment the player does not own.
  if (!WEAPONS[save.equipment.weapon] || !save.unlocked.weapons.includes(save.equipment.weapon)) save.equipment.weapon = 'saber';
  if (!ARMORS[save.equipment.armor] || !save.unlocked.armors.includes(save.equipment.armor)) save.equipment.armor = 'coat';
  if (save.equipment.charm && (!CHARMS[save.equipment.charm] || !save.unlocked.charms.includes(save.equipment.charm))) save.equipment.charm = null;
  return save;
}

export function loadSave() {
  try {
    if (typeof localStorage === 'undefined') return defaultSave();
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return normalizeSave(JSON.parse(raw));
  } catch (error) {
    console.warn('Could not load save, starting fresh.', error);
    return defaultSave();
  }
}

export function saveGame(save) {
  save.updatedAt = Date.now();
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    console.warn('Could not persist save.', error);
  }
  return save;
}

export function resetSave() {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY); } catch {}
  return defaultSave();
}

export function addShards(save, amount) {
  const value = Math.max(0, Math.round(amount));
  save.shards += value;
  save.stats.shardsEarned = (save.stats.shardsEarned || 0) + value;
  return value;
}

export function addLicenseXp(save, amount) {
  const before = rankIndexForXp(save.licenseXp);
  save.licenseXp = Math.max(0, Math.round(save.licenseXp + amount));
  const after = rankIndexForXp(save.licenseXp);
  return {
    amount,
    rankUp: after > before,
    from: RANKS[before],
    to: RANKS[after]
  };
}

export function bumpStat(save, stat, amount = 1) {
  save.stats[stat] = (save.stats[stat] || 0) + amount;
}

export function bumpKill(save, type) {
  bumpStat(save, 'kills', 1);
  if (!save.stats.killsByType) save.stats.killsByType = {};
  save.stats.killsByType[type] = (save.stats.killsByType[type] || 0) + 1;
}

export function claimContract(save, id) {
  const idx = save.contracts.findIndex(c => c.id === id);
  if (idx < 0) return { ok: false, reason: 'Contract not found.' };
  const contract = save.contracts[idx];
  if (!contractProgress(save, contract).complete) return { ok: false, reason: 'Contract incomplete.' };
  const shards = addShards(save, contract.rewardShards);
  const xp = addLicenseXp(save, contract.rewardXp);
  save.contracts.splice(idx, 1);
  const active = new Set(save.contracts.map(c => c.templateId));
  save.contracts.push(generateContract(save, Math.random, [...active]));
  saveGame(save);
  return { ok: true, shards, xp: xp.amount, rankUp: xp };
}

export function equipItem(save, slot, id) {
  if (slot === 'weapon' && !save.unlocked.weapons.includes(id)) return false;
  if (slot === 'armor' && !save.unlocked.armors.includes(id)) return false;
  if (slot === 'charm' && !save.unlocked.charms.includes(id)) return false;
  save.equipment[slot] = id;
  saveGame(save);
  return true;
}

export function unlockItem(save, slot, id) {
  const table = slot === 'weapon' ? WEAPONS : slot === 'armor' ? ARMORS : CHARMS;
  const item = table[id];
  if (!item) return { ok: false, reason: 'Unknown item.' };
  const list = slot === 'weapon' ? save.unlocked.weapons : slot === 'armor' ? save.unlocked.armors : save.unlocked.charms;
  if (list.includes(id)) return { ok: false, reason: 'Already unlocked.' };
  if (save.shards < item.unlock) return { ok: false, reason: 'Not enough shards.' };
  save.shards -= item.unlock;
  list.push(id);
  saveGame(save);
  return { ok: true };
}

export function upgradeEquipment(save, id) {
  const levels = save.equipment.levels;
  const level = levels[id] || 1;
  if (level >= 5) return { ok: false, reason: 'Already at maximum.' };
  const cost = Math.round(45 * level * level);
  if (save.shards < cost) return { ok: false, reason: 'Not enough shards.' };
  save.shards -= cost;
  levels[id] = level + 1;
  saveGame(save);
  return { ok: true, cost, level: level + 1 };
}

export function upgradeMeta(save, id) {
  const meta = save.meta[id];
  const def = { vitality: { max: 5, cost: 50, step: 42 }, might: { max: 5, cost: 65, step: 50 }, agility: { max: 4, cost: 45, step: 40 }, aether: { max: 4, cost: 55, step: 45 }, fortune: { max: 3, cost: 75, step: 55 } }[id];
  if (!def) return { ok: false, reason: 'Unknown upgrade.' };
  const current = meta || 0;
  if (current >= def.max) return { ok: false, reason: 'Already at maximum.' };
  const cost = def.cost + current * def.step;
  if (save.shards < cost) return { ok: false, reason: 'Not enough shards.' };
  save.shards -= cost;
  save.meta[id] = current + 1;
  saveGame(save);
  return { ok: true, cost, level: current + 1 };
}

export function moveCheckpoint(save, floor) {
  if (floor > save.checkpointFloor && floor <= MAX_FLOOR) {
    save.checkpointFloor = floor;
    saveGame(save);
    return true;
  }
  return false;
}

export function formatNumber(value) {
  return Math.round(value).toLocaleString('en-US');
}
