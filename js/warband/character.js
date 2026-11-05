// Character math: race + class + specialist kit, with no cross-locking.
import {
  BASE_STATS,
  STAT_KEYS,
  RACES,
  CLASSES,
  NAME_POOL,
  raceById,
  classById,
  kitById,
  representativeKit
} from './data.js';

let characterCounter = 0;

export function makeCharacterId() {
  characterCounter += 1;
  return `warband_${Date.now().toString(36)}_${characterCounter}`;
}

export function xpNeeded(level) {
  return 70 + (level - 1) * 55;
}

export function computeCharacter(character) {
  const race = raceById(character.raceId) || RACES[0];
  const cls = classById(character.classId) || CLASSES[0];
  const kit = kitById(cls.id, character.kitId) || representativeKit(cls.id);
  const level = character.level || 1;
  const growth = character.growth || {};

  const stats = {};
  for (const key of STAT_KEYS) {
    stats[key] = (BASE_STATS[key] || 0) + (race.mods[key] || 0) + (cls.mods[key] || 0) + (kit.statMods?.[key] || 0) + (growth[key] || 0);
  }

  let hpMult = 1;
  let defenseMult = 1;
  let speedBonus = 0;
  let critBonus = 0;
  let evadeBonus = 0;
  if (race.trait.id === 'thick_hide') hpMult *= 1.12;
  if (race.trait.id === 'master_craft') defenseMult *= 1.1;
  if (race.trait.id === 'verdant_step') speedBonus += 3;
  if (race.trait.id === 'glide') { speedBonus += 6; critBonus += 5; }
  if (race.trait.id === 'fade') evadeBonus += 6;

  const maxHp = Math.max(1, Math.round((42 + stats.vitality * 6.4 + level * 4) * hpMult));
  const maxAether = Math.max(1, Math.round(10 + stats.intellect * 2.2 + stats.spirit * 2 + level * 2));
  const power = Math.round(10 + stats.might * 2.3 + level * 2.2);
  const spell = Math.round(10 + stats.intellect * 2.2 + stats.spirit * 0.75 + level * 2.2);
  const defense = Math.round((3 + stats.vitality * 1.15 + level * 1.1) * defenseMult);
  const resolve = Math.round(3 + stats.spirit * 1.1 + stats.intellect * 0.4 + level * 1.1);
  const speed = Math.round(10 + stats.agility * 1.9 + stats.presence * 0.35 + level * 0.8 + speedBonus);
  const crit = Math.min(60, Math.round((4 + stats.agility * 0.55 + stats.presence * 0.18 + critBonus) * 10) / 10);
  const evade = Math.min(40, Math.round((2 + stats.agility * 0.42 + evadeBonus) * 10) / 10);

  const allowedWeapons = kit.allowedWeapons?.length ? kit.allowedWeapons : cls.weapons;
  const allowedArmor = kit.allowedArmor?.length ? kit.allowedArmor : cls.armor;
  const equipment = {
    weapon: allowedWeapons[0] || '맨손',
    armor: allowedArmor[0] || '없음'
  };

  return {
    race,
    cls,
    kit,
    level,
    stats,
    derived: { maxHp, maxAether, power, spell, defense, resolve, speed, crit, evade },
    allowedWeapons,
    allowedArmor,
    equipment,
    attackKind: cls.attackKind,
    attackReach: cls.attackReach
  };
}

export function createCharacter({
  name,
  raceId,
  classId,
  kitId,
  level = 1,
  growth = {},
  hp = null,
  aether = null,
  xp = 0
}) {
  const character = {
    id: makeCharacterId(),
    name: (name || '').trim() || '이름 없는 자',
    raceId,
    classId,
    kitId: kitId || representativeKit(classId)?.id,
    level,
    xp,
    growth: { ...growth }
  };
  const computed = computeCharacter(character);
  character.hp = hp == null ? computed.derived.maxHp : Math.min(hp, computed.derived.maxHp);
  character.aether = aether == null ? computed.derived.maxAether : Math.min(aether, computed.derived.maxAether);
  return character;
}

export function levelUpCharacter(character) {
  const computed = computeCharacter(character);
  const keyStats = computed.cls.keyStats;
  character.level += 1;
  for (const key of keyStats) character.growth[key] = (character.growth[key] || 0) + 1;
  character.growth.vitality = (character.growth.vitality || 0) + 1;
  const next = computeCharacter(character);
  character.hp = Math.min(next.derived.maxHp, character.hp + Math.round(next.derived.maxHp * 0.35));
  character.aether = Math.min(next.derived.maxAether, character.aether + Math.round(next.derived.maxAether * 0.35));
  return next;
}

export function grantXp(character, amount) {
  character.xp = (character.xp || 0) + amount;
  let gained = 0;
  while (character.xp >= xpNeeded(character.level)) {
    character.xp -= xpNeeded(character.level);
    levelUpCharacter(character);
    gained += 1;
    if (gained > 20) break;
  }
  return gained;
}

export function restoreCharacter(character) {
  const computed = computeCharacter(character);
  character.hp = computed.derived.maxHp;
  character.aether = computed.derived.maxAether;
  return character;
}

export function healCharacter(character, fraction) {
  const computed = computeCharacter(character);
  character.hp = Math.min(computed.derived.maxHp, character.hp + Math.round(computed.derived.maxHp * fraction));
  return character.hp;
}

export function characterNamePool() {
  return NAME_POOL;
}

export function randomName(used = []) {
  const available = NAME_POOL.filter((n) => !used.includes(n));
  const pool = available.length ? available : NAME_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomCharacter(level = 1, usedNames = [], usedClasses = []) {
  const availableClasses = CLASSES.filter((c) => !usedClasses.includes(c.id));
  const clsPool = availableClasses.length ? availableClasses : CLASSES;
  const cls = clsPool[Math.floor(Math.random() * clsPool.length)];
  const race = RACES[Math.floor(Math.random() * RACES.length)];
  const kit = representativeKit(cls.id);
  const name = randomName(usedNames);
  return createCharacter({ name, raceId: race.id, classId: cls.id, kitId: kit.id, level });
}

export function partyPower(party) {
  return party.reduce((sum, member) => {
    if (!member) return sum;
    const c = computeCharacter(member);
    return sum + c.derived.maxHp + c.derived.power + c.derived.spell;
  }, 0);
}
