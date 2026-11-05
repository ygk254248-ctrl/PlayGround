// 6v6 turn-based battle engine. The UI is intentionally kept outside so the
// same rules can be rendered by any front-end.
import {
  ENEMIES,
  ENCOUNTER_POOLS,
  STATUSES,
  classById,
  representativeKit
} from './data.js';
import { computeCharacter } from './character.js';

const rnd = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function statusType(id) {
  return STATUSES[id]?.type || 'debuff';
}

function statusName(id) {
  return STATUSES[id]?.name || id;
}

function statusGlyph(id) {
  return STATUSES[id]?.glyph || '·';
}

export class Battle {
  constructor({ party, floor, encounter, items, callbacks = {} }) {
    this.party = party;
    this.floor = floor;
    this.encounter = encounter;
    this.items = { potions: items?.potions ?? 2, ethers: items?.ethers ?? 1 };
    this.cb = callbacks;
    this.round = 1;
    this.logs = [];
    this.units = [];
    this.queue = [];
    this.activeUid = null;
    this.phase = 'intro';
    this.pendingAction = null;
    this.finished = false;
    this.auto = false;
    this.message = '전투 준비';
    this.stolenGold = 0;
    this.result = null;
    this.buildAllies();
    this.buildEnemies();
  }

  buildAllies() {
    this.party.forEach((character, index) => {
      const c = computeCharacter(character);
      const row = index < 2 ? 'front' : index < 4 ? 'mid' : 'back';
      const maxHp = c.derived.maxHp;
      const maxAether = c.derived.maxAether;
      const unit = {
        uid: `ally_${character.id}`,
        side: 'ally',
        character,
        name: character.name,
        level: character.level,
        row,
        slot: index,
        raceId: character.raceId,
        classId: character.classId,
        kitId: character.kitId,
        raceName: c.race.name,
        className: c.cls.name,
        kitName: c.kit.name,
        glyph: c.cls.glyph,
        color: c.cls.color,
        stats: c.stats,
        maxHp,
        hp: clamp(character.hp ?? maxHp, 1, maxHp),
        maxAether,
        aether: clamp(character.aether ?? maxAether, 0, maxAether),
        power: c.derived.power,
        spell: c.derived.spell,
        defense: c.derived.defense,
        resolve: c.derived.resolve,
        speed: c.derived.speed,
        crit: c.derived.crit,
        evade: c.derived.evade,
        attackKind: c.attackKind,
        attackReach: c.attackReach,
        ability: c.cls.ability,
        kitAbility: c.kit.ability,
        statuses: [],
        cooldowns: {},
        alive: true,
        boss: false,
        trait: c.race.trait.id,
        veilUsed: false,
        deathlessUsed: false,
        guardUsed: false
      };
      this.units.push(unit);
    });
  }

  buildEnemies() {
    const pool = ENCOUNTER_POOLS[Math.min(5, this.floor)] || ENCOUNTER_POOLS[5];
    const isBoss = this.encounter?.encounterType === 'boss';
    const isElite = this.encounter?.encounterType === 'elite';
    const bossId = this.encounter?.bossId || (this.floor === 5 ? 'crown' : 'warden');
    const list = [];
    if (isBoss) {
      list.push({ id: bossId, boss: true });
      for (let i = 0; i < 5; i += 1) list.push({ id: pool[i % pool.length], boss: false });
    } else {
      for (let i = 0; i < 6; i += 1) list.push({ id: pool[i % pool.length], boss: false });
    }

    const counts = {};
    list.forEach((entry, index) => {
      const template = ENEMIES[entry.id] || ENEMIES.wisp;
      counts[entry.id] = (counts[entry.id] || 0) + 1;
      const level = Math.max(1, this.floor + (entry.boss ? 2 : 0) + (isElite ? 1 : 0));
      const scale = 1 + (this.floor - 1) * 0.12 + (isElite ? 0.18 : 0);
      const maxHp = Math.round((52 + this.floor * 17) * template.hp * (entry.boss ? 1 : 1) * scale);
      const row = entry.boss ? 'front' : index < 3 ? 'front' : 'back';
      const unit = {
        uid: `enemy_${index}_${entry.id}`,
        side: 'enemy',
        enemyId: entry.id,
        name: `${template.name}${counts[entry.id] > 1 ? ` ${roman[Math.min(8, counts[entry.id])]}` : ''}`,
        level,
        row,
        slot: index,
        raceName: '',
        className: template.role,
        kitName: '',
        glyph: template.glyph,
        color: template.color,
        maxHp,
        hp: maxHp,
        maxAether: 999,
        aether: 999,
        power: Math.round((17 + this.floor * 6.5) * template.power * scale),
        spell: Math.round((17 + this.floor * 6.5) * template.spell * scale),
        defense: Math.round((4 + this.floor * 3.2) * template.defense * scale),
        resolve: Math.round((4 + this.floor * 2.8) * template.resolve * scale),
        speed: Math.round((11 + this.floor * 1.6) * template.speed),
        crit: Math.round((4 + this.floor * 0.5) * 10) / 10,
        evade: Math.round((2 + this.floor * 0.35) * 10) / 10,
        attackKind: template.spell > template.power ? 'magic' : 'physical',
        attackReach: template.spell > template.power ? 'any' : 'front',
        ability: template.ability || null,
        abilities: template.abilities || (template.ability ? [template.ability] : []),
        statuses: [],
        cooldowns: {},
        alive: true,
        boss: !!entry.boss,
        undead: ['wisp', 'wraith', 'crown'].includes(entry.id),
        trait: null
      };
      this.units.push(unit);
    });
  }

  start() {
    this.addLog(`<b>${this.floor}층</b>의 공허 존재들이 길을 막아섭니다.`, 'system');
    this.addLog('전투가 시작됩니다.', 'system');
    this.buildQueue();
    this.phase = 'intro';
    this.cb.onUpdate?.();
    setTimeout(() => this.nextTurn(), 480);
  }

  buildQueue() {
    this.queue = this.units
      .filter((u) => u.alive)
      .map((u) => ({ uid: u.uid, speed: u.speed + rnd(0, 3) + (this.getStatus(u, 'haste') ? 12 : 0) - (this.getStatus(u, 'slow') ? 8 : 0) }))
      .sort((a, b) => b.speed - a.speed)
      .map((u) => u.uid);
  }

  getUnit(uid) {
    return this.units.find((u) => u.uid === uid) || null;
  }

  getActive() {
    return this.getUnit(this.activeUid);
  }

  getAlive(side) {
    return this.units.filter((u) => u.side === side && u.alive);
  }

  getStatus(unit, id) {
    return unit.statuses.find((s) => s.id === id) || null;
  }

  hasStatus(unit, id) {
    return !!this.getStatus(unit, id);
  }

  addLog(text, tone = '') {
    this.logs.push({ text, tone, round: this.round });
    if (this.logs.length > 80) this.logs.shift();
    this.cb.onLog?.({ text, tone, round: this.round });
  }

  setMessage(text) {
    this.message = text;
    this.cb.onUpdate?.();
  }

  nextTurn() {
    if (this.finished) return;
    if (this.checkEnd()) return;
    if (!this.queue.length) {
      this.round += 1;
      this.buildQueue();
      this.addLog(`<b>라운드 ${this.round}</b>`, 'system');
      this.cb.onFx?.({ type: 'round', round: this.round });
      this.cb.onUpdate?.();
    }
    const uid = this.queue.shift();
    const unit = this.getUnit(uid);
    if (!unit || !unit.alive) {
      setTimeout(() => this.nextTurn(), 60);
      return;
    }
    this.activeUid = uid;
    this.pendingAction = null;
    this.startOfTurn(unit);
    if (this.finished) return;
    if (!unit.alive) {
      this.finishTurn(unit);
      return;
    }
    const stunned = this.hasStatus(unit, 'stun');
    if (stunned) {
      this.phase = 'resolving';
      this.setMessage(`${unit.name}은(는) 기절해 행동하지 못합니다.`);
      this.addLog(`<span class="${unit.side}">${unit.name}</span> 기절`, 'control');
      this.cb.onFx?.({ type: 'status', uid: unit.uid, text: '기절' });
      this.cb.onUpdate?.();
      setTimeout(() => this.finishTurn(unit), 720);
      return;
    }
    if (unit.side === 'ally') {
      this.phase = 'select';
      this.setMessage(`${unit.name}의 턴입니다.`);
      this.cb.onUpdate?.();
      if (this.auto) setTimeout(() => this.autoAlly(unit), 420);
    } else {
      this.phase = 'enemy';
      this.setMessage(`${unit.name}이(가) 노리고 있습니다.`);
      this.cb.onUpdate?.();
      setTimeout(() => this.enemyTurn(unit), 520);
    }
  }

  startOfTurn(unit) {
    // Cooldowns tick down at the start of the unit's own turn.
    for (const key of Object.keys(unit.cooldowns)) {
      unit.cooldowns[key] = Math.max(0, unit.cooldowns[key] - 1);
    }
    if (unit.trait === 'tidal_grace') {
      const heal = Math.round(unit.maxHp * 0.03);
      this.healUnit(unit, heal, null, '조수의 은총');
    }
    for (const status of [...unit.statuses]) {
      if (status.id === 'poison' || status.id === 'burn') {
        const amount = Math.max(1, Math.round(unit.maxHp * status.value));
        this.applyRawDamage(unit, amount, status.id === 'burn' ? '화상' : '독');
      } else if (status.id === 'regen') {
        const amount = Math.max(1, Math.round(unit.maxHp * status.value));
        this.healUnit(unit, amount, null, '재생');
      }
    }
    if (!unit.alive) return;
    if (unit.trait === 'deathless' && unit.hp <= 0) unit.hp = 1;
  }

  finishTurn(unit) {
    if (this.finished) return;
    if (unit?.alive) {
      for (const status of [...unit.statuses]) {
        status.turns -= 1;
        if (status.turns <= 0) {
          unit.statuses = unit.statuses.filter((s) => s !== status);
        }
      }
    }
    this.activeUid = null;
    this.pendingAction = null;
    this.cb.onUpdate?.();
    if (this.checkEnd()) return;
    setTimeout(() => this.nextTurn(), 230);
  }

  checkEnd() {
    if (this.finished) return true;
    const alliesAlive = this.getAlive('ally').length;
    const enemiesAlive = this.getAlive('enemy').length;
    if (enemiesAlive === 0) {
      this.finish('victory');
      return true;
    }
    if (alliesAlive === 0) {
      this.finish('defeat');
      return true;
    }
    return false;
  }

  finish(result) {
    if (this.finished) return;
    this.finished = true;
    this.phase = result;
    const enemies = this.units.filter((u) => u.side === 'enemy');
    const boss = enemies.some((u) => u.boss);
    const baseXp = enemies.reduce((sum, u) => sum + (u.boss ? 120 : 28 + this.floor * 6), 0);
    const xp = Math.round(baseXp * (result === 'victory' ? 1 : 0.25));
    const gold = Math.round(enemies.reduce((sum, u) => sum + (u.boss ? 120 : 12 + this.floor * 4), 0) * (result === 'victory' ? 1 : 0.3)) + this.stolenGold;
    const potionDrop = result === 'victory' && Math.random() < (boss ? 0.85 : 0.28) ? 1 : 0;
    const etherDrop = result === 'victory' && Math.random() < (boss ? 0.65 : 0.18) ? 1 : 0;
    this.result = {
      result,
      xp,
      gold,
      potions: potionDrop,
      ethers: etherDrop,
      boss,
      floor: this.floor,
      round: this.round,
      units: this.units.map((u) => ({ uid: u.uid, side: u.side, hp: u.hp, maxHp: u.maxHp, aether: u.aether, maxAether: u.maxAether, alive: u.alive }))
    };
    if (result === 'victory') {
      this.addLog('<b>전투 승리.</b>', 'system');
      this.setMessage('승리했습니다.');
      this.cb.onFx?.({ type: 'victory' });
      setTimeout(() => this.cb.onEnd?.(this.result), 900);
    } else {
      this.addLog('<b>원정대가 쓰러졌습니다.</b>', 'system');
      this.setMessage('패배...');
      this.cb.onFx?.({ type: 'defeat' });
      setTimeout(() => this.cb.onEnd?.(this.result), 1100);
    }
    this.cb.onUpdate?.();
  }

  // -------------------------------------------------------------------------
  // Actions and targeting
  // -------------------------------------------------------------------------

  getPlayerActions() {
    const unit = this.getActive();
    if (!unit || unit.side !== 'ally' || this.phase !== 'select') return [];
    const ability = unit.ability;
    const kitAbility = unit.kitAbility;
    const actions = [
      {
        id: 'basic',
        name: '공격',
        icon: '⚔',
        cost: 0,
        cooldown: 0,
        target: 'enemy',
        kind: unit.attackKind,
        power: 1,
        reach: unit.attackReach,
        desc: unit.attackKind === 'physical' ? '무기로 적을 공격합니다.' : '마법으로 적을 공격합니다.',
        disabled: false,
        key: '1'
      }
    ];
    if (ability) {
      const cd = unit.cooldowns[ability.id] || 0;
      actions.push({
        ...ability,
        id: ability.id,
        icon: '✦',
        name: ability.name,
        desc: ability.desc,
        cost: this.costFor(unit, ability),
        disabled: cd > 0 || unit.aether < this.costFor(unit, ability),
        reason: cd > 0 ? `재사용 ${cd}턴` : unit.aether < this.costFor(unit, ability) ? '에테르 부족' : '',
        key: '2'
      });
    }
    if (kitAbility && kitAbility.id) {
      const cd = unit.cooldowns[kitAbility.id] || 0;
      actions.push({
        ...kitAbility,
        id: kitAbility.id,
        icon: '◆',
        name: kitAbility.name,
        desc: kitAbility.desc,
        cost: this.costFor(unit, kitAbility),
        disabled: cd > 0 || unit.aether < this.costFor(unit, kitAbility),
        reason: cd > 0 ? `재사용 ${cd}턴` : unit.aether < this.costFor(unit, kitAbility) ? '에테르 부족' : '',
        key: '3'
      });
    }
    actions.push({
      id: 'defend',
      name: '방어',
      icon: '◈',
      cost: 0,
      cooldown: 0,
      target: 'self',
      kind: 'buff',
      desc: '이번 턴 받는 피해를 40% 줄이고 에테르를 10% 회복합니다.',
      disabled: false,
      key: '4'
    });
    actions.push({
      id: 'potion',
      name: '회복약',
      icon: '✚',
      cost: 0,
      cooldown: 0,
      target: 'ally',
      kind: 'heal',
      power: 0.35,
      desc: `아군 하나의 생명력을 35% 회복합니다. 남은 수: ${this.items.potions}`,
      disabled: this.items.potions <= 0,
      reason: this.items.potions <= 0 ? '회복약 없음' : '',
      key: '5',
      item: true
    });
    actions.push({
      id: 'ether',
      name: '에테르약',
      icon: '✦',
      cost: 0,
      cooldown: 0,
      target: 'ally',
      kind: 'ether',
      desc: `아군 하나의 에테르를 30 회복합니다. 남은 수: ${this.items.ethers}`,
      disabled: this.items.ethers <= 0,
      reason: this.items.ethers <= 0 ? '에테르약 없음' : '',
      key: '6',
      item: true
    });
    return actions;
  }

  costFor(unit, ability) {
    const base = ability.cost || 0;
    return unit.trait === 'runic_echo' ? Math.max(0, Math.round(base * 0.85)) : base;
  }

  beginAction(actionId) {
    if (this.phase !== 'select') return false;
    const unit = this.getActive();
    if (!unit || unit.side !== 'ally') return false;
    if (actionId === 'cancel') {
      this.pendingAction = null;
      this.phase = 'select';
      this.cb.onUpdate?.();
      return true;
    }
    const action = this.getPlayerActions().find((a) => a.id === actionId);
    if (!action || action.disabled) return false;
    if (actionId === 'defend') {
      this.executeDefend(unit);
      return true;
    }
    if (action.target === 'self' || action.target === 'allEnemies' || action.target === 'allAllies' || action.target === 'randomEnemies' || action.target === 'randomAllies') {
      this.executeAction(unit, action, null);
      return true;
    }
    const targets = this.getValidTargets(unit, action);
    if (!targets.length) {
      this.setMessage('유효한 대상이 없습니다.');
      return false;
    }
    if (targets.length === 1) {
      this.executeAction(unit, action, targets[0].uid);
      return true;
    }
    this.pendingAction = action;
    this.phase = 'target';
    this.setMessage('대상을 선택하세요.');
    this.cb.onUpdate?.();
    return true;
  }

  selectTarget(uid) {
    if (this.phase !== 'target' || !this.pendingAction) return false;
    const unit = this.getActive();
    if (!unit) return false;
    const targets = this.getValidTargets(unit, this.pendingAction);
    if (!targets.some((t) => t.uid === uid)) return false;
    const action = this.pendingAction;
    this.pendingAction = null;
    this.executeAction(unit, action, uid);
    return true;
  }

  cancelTarget() {
    if (this.phase !== 'target') return false;
    this.pendingAction = null;
    this.phase = 'select';
    this.setMessage(`${this.getActive()?.name || ''}의 턴입니다.`);
    this.cb.onUpdate?.();
    return true;
  }

  toggleAuto() {
    this.auto = !this.auto;
    this.cb.onUpdate?.();
    if (this.auto && this.phase === 'select') setTimeout(() => this.autoAlly(this.getActive()), 200);
  }

  getValidTargets(unit, action) {
    const opposing = unit.side === 'ally' ? 'enemy' : 'ally';
    const same = unit.side;
    const targetType = action.target || (action.kind === 'heal' || action.kind === 'buff' ? 'ally' : 'enemy');
    let pool = [];
    if (targetType === 'enemy' || targetType === 'allEnemies' || targetType === 'randomEnemies') pool = this.getAlive(opposing);
    else if (targetType === 'ally' || targetType === 'allAllies' || targetType === 'randomAllies') pool = this.getAlive(same);
    else if (targetType === 'self') pool = [unit];
    else pool = this.getAlive(opposing);
    if (targetType === 'enemy' && (action.reach === 'front' || (!action.reach && action.kind === 'physical'))) {
      const front = pool.filter((u) => u.row === 'front');
      if (front.length) pool = front;
    }
    return pool;
  }

  resolveTargets(unit, action, targetUid, hitIndex = 0) {
    const targetType = action.target || 'enemy';
    if (targetUid) {
      const target = this.getUnit(targetUid);
      return target?.alive ? [target] : [];
    }
    if (targetType === 'self') return [unit];
    if (targetType === 'allEnemies' || targetType === 'allAllies') {
      return this.getValidTargets(unit, action);
    }
    if (targetType === 'randomEnemies' || targetType === 'randomAllies') {
      const pool = this.getValidTargets(unit, action);
      return pool.length ? [pick(pool)] : [];
    }
    const pool = this.getValidTargets(unit, action);
    return pool.length ? [pool[0]] : [];
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  executeDefend(unit) {
    this.phase = 'resolving';
    this.setMessage(`${unit.name}이(가) 방어 태세를 취합니다.`);
    this.addLog(`<span class="ally">${unit.name}</span> 방어`, 'system');
    this.applyStatus(unit, { id: 'guard', turns: 2, value: 0.4 }, unit);
    unit.aether = Math.min(unit.maxAether, unit.aether + Math.round(unit.maxAether * 0.1));
    this.cb.onFx?.({ type: 'status', uid: unit.uid, text: '방어' });
    this.cb.onUpdate?.();
    setTimeout(() => this.finishTurn(unit), 500);
  }

  executeAction(unit, action, targetUid) {
    if (this.finished) return;
    this.phase = 'resolving';
    this.pendingAction = null;
    const cost = action.item ? 0 : this.costFor(unit, action);
    if (unit.aether < cost) {
      this.setMessage('에테르가 부족합니다.');
      this.phase = 'select';
      this.cb.onUpdate?.();
      return;
    }
    unit.aether -= cost;
    if (!action.item) unit.cooldowns[action.id] = action.cooldown || 0;

    const targetName = targetUid ? this.getUnit(targetUid)?.name : null;
    const targetText = targetName ? ` → ${targetName}` : '';
    this.addLog(`<span class="${unit.side}">${unit.name}</span> · <b>${action.name}</b>${targetText}`, 'action');
    this.setMessage(`${unit.name} · ${action.name}`);
    this.cb.onFx?.({ type: 'cast', uid: unit.uid, action });
    this.cb.onUpdate?.();

    let extraTurn = false;
    const targets = this.resolveTargets(unit, action, targetUid);
    const hits = action.hits || 1;
    const isRandom = action.target === 'randomEnemies' || action.target === 'randomAllies';

    if (action.item) {
      if (action.id === 'potion') {
        this.items.potions = Math.max(0, this.items.potions - 1);
        const target = targets[0] || unit;
        const amount = Math.round(target.maxHp * action.power);
        this.healUnit(target, amount, unit, '회복약');
        this.cb.onItemsChange?.({ ...this.items });
      } else if (action.id === 'ether') {
        this.items.ethers = Math.max(0, this.items.ethers - 1);
        const target = targets[0] || unit;
        target.aether = Math.min(target.maxAether, target.aether + 30);
        this.cb.onFx?.({ type: 'aether', uid: target.uid, amount: 30 });
        this.cb.onItemsChange?.({ ...this.items });
      }
      this.cb.onUpdate?.();
      setTimeout(() => this.finishTurn(unit), 520);
      return;
    }

    if (action.kind === 'heal') {
      const healTargets = action.target === 'allAllies' || action.target === 'allEnemies'
        ? this.getValidTargets(unit, action)
        : targets;
      for (const target of healTargets) {
        const amount = Math.round(this.spellPower(unit) * (action.power || 1) + target.maxHp * (action.heal || 0));
        this.healUnit(target, amount, unit, action.name);
        if (action.statuses?.length) {
          for (const s of action.statuses) this.applyStatus(target, s, unit);
        } else if (action.status) {
          this.applyStatus(target, action.status, unit);
        }
        if (action.cleanse) this.cleanse(target, action.cleanse);
      }
      if (action.special === 'undead_bane') {
        for (const enemy of this.getAlive(unit.side === 'ally' ? 'enemy' : 'ally')) {
          if (enemy.undead) {
            const dmg = Math.round(this.spellPower(unit) * 0.55);
            this.dealDamage(unit, enemy, { ...action, kind: 'magic', power: 0.55, status: null, statuses: null }, { bonus: 1.25 });
          }
        }
      }
    } else if (action.kind === 'buff' || action.kind === 'debuff') {
      const effectTargets = action.target === 'allEnemies' || action.target === 'allAllies'
        ? this.getValidTargets(unit, action)
        : targets;
      for (const target of effectTargets) {
        if (action.statuses?.length) {
          for (const s of action.statuses) this.applyStatus(target, s, unit);
        } else if (action.status) {
          this.applyStatus(target, action.status, unit);
        }
        if (action.heal) {
          const amount = Math.round(target.maxHp * action.heal);
          this.healUnit(target, amount, unit, action.name);
        }
        if (action.cleanse) this.cleanse(target, action.cleanse);
      }
      if (action.special === 'ashen_aegis') {
        for (const enemy of this.getAlive(unit.side === 'ally' ? 'enemy' : 'ally')) {
          this.applyStatus(enemy, { id: 'taunt', turns: 2, value: 1, source: unit.uid }, unit);
        }
      }
    } else {
      const hitTargets = isRandom ? [] : targets;
      for (let hit = 0; hit < hits; hit += 1) {
        const hitTarget = isRandom ? this.resolveTargets(unit, action, null, hit)[0] : hitTargets[hit % Math.max(1, hitTargets.length)];
        if (!hitTarget) continue;
        const beforeHp = hitTarget.hp;
        let bonus = 1;
        if (action.special === 'marked_bonus' && this.hasStatus(hitTarget, 'mark')) bonus *= 1.2;
        if (action.special === 'shadow_strike' && hitTarget.hp <= hitTarget.maxHp * 0.5) bonus *= 1.5;
        if (action.special === 'undead_bane' && hitTarget.undead) bonus *= 1.25;
        if (unit.trait === 'cinder_blood' && unit.hp <= unit.maxHp * 0.5) bonus *= 1.15;
        if (unit.kitId === 'nightglass_cutpurse') bonus *= 1.0;
        const critBonus = action.special === 'shadow_strike' ? 30 : 0;
        const dealt = this.dealDamage(unit, hitTarget, action, {
          bonus,
          pierce: action.pierce || 0,
          critBonus,
          sourceName: action.name
        });
        if (action.special === 'execute_chain' && !hitTarget.alive) extraTurn = true;
        if (action.special === 'steal' && dealt > 0) {
          const stolen = 8 + this.floor * 2;
          this.stolenGold += stolen;
          this.cb.onFx?.({ type: 'gold', amount: stolen });
        }
        if (action.special === 'ember_cascade' && dealt > 0 && this.lastDamageCrit) {
          unit.aether = Math.min(unit.maxAether, unit.aether + 3);
        }
        if (action.statuses?.length) {
          for (const s of action.statuses) if (hitTarget.alive) this.applyStatus(hitTarget, s, unit);
        } else if (action.status && hitTarget.alive) {
          this.applyStatus(hitTarget, action.status, unit);
        }
        if (action.special === 'dispel' && hitTarget.alive) this.dispel(hitTarget);
        if (action.special === 'steal' && dealt > 0 && beforeHp > 0) {
          // Stealing is intentionally small and shown in the result screen.
        }
      }
    }

    if (action.selfStatus) this.applyStatus(unit, action.selfStatus, unit);
    if (action.cleanse) this.cleanse(unit, action.cleanse);
    if (action.special === 'momentum') this.applyStatus(unit, { id: 'powerUp', turns: 1, value: 0.2 }, unit);
    if (action.special === 'wild_echo' && Math.random() < 0.2) {
      this.addLog('주문이 메아리칩니다!', 'system');
      setTimeout(() => {
        if (this.finished) return;
        const echoTarget = this.getAlive(unit.side === 'ally' ? 'enemy' : 'ally');
        if (echoTarget.length) {
          const target = pick(echoTarget);
          this.dealDamage(unit, target, { ...action, power: (action.power || 1) * 0.5, status: null, statuses: null }, { bonus: 1 });
          this.cb.onUpdate?.();
        }
      }, 260);
    }

    this.cb.onUpdate?.();
    if (this.checkEnd()) return;
    const delay = 540;
    if (extraTurn && unit.alive) {
      this.addLog(`${unit.name}의 처형 연쇄! 추가 행동.`, 'system');
      this.queue.unshift(unit.uid);
      this.activeUid = null;
      setTimeout(() => this.nextTurn(), delay);
    } else {
      setTimeout(() => this.finishTurn(unit), delay);
    }
  }

  spellPower(unit) {
    return Math.max(unit.spell, unit.power * 0.7);
  }

  // -------------------------------------------------------------------------
  // Damage, healing and statuses
  // -------------------------------------------------------------------------

  dealDamage(attacker, defender, action, opts = {}) {
    this.lastDamageCrit = false;
    if (!defender.alive) return 0;
    const trueDamage = !!opts.trueDamage;
    if (!trueDamage) {
      let evade = defender.evade + (this.hasStatus(defender, 'evadeUp') ? 20 : 0);
      if (defender.trait === 'umbral_veil' && !defender.veilUsed) {
        defender.veilUsed = true;
        this.cb.onFx?.({ type: 'miss', uid: defender.uid, text: '그림자 장막' });
        this.addLog(`${defender.name}의 그림자 장막이 공격을 삼켰습니다.`, 'system');
        return 0;
      }
      if (Math.random() * 100 < evade) {
        this.cb.onFx?.({ type: 'miss', uid: defender.uid, text: '회피' });
        this.addLog(`${defender.name} 회피`, 'system');
        return 0;
      }
    }

    const kind = action.kind || 'physical';
    const power = action.power || 1;
    let base = 0;
    let defense = 0;
    if (kind === 'physical') {
      base = attacker.power * power;
      defense = defender.defense;
    } else if (kind === 'magic') {
      base = attacker.spell * power;
      defense = defender.resolve;
    } else {
      base = (attacker.power * power + attacker.spell * (action.magicPower || 0.8)) * 0.82;
      defense = (defender.defense + defender.resolve) * 0.55;
    }
    const pierce = clamp(opts.pierce || 0, 0, 0.9);
    let raw = Math.max(1, base - defense * (1 - pierce) * 0.55);

    const powerUp = this.getStatus(attacker, 'powerUp');
    const weaken = this.getStatus(attacker, 'weaken');
    const defenseUp = this.getStatus(defender, 'defenseUp');
    const mark = this.getStatus(defender, 'mark');
    const shock = this.getStatus(defender, 'shock');
    const guard = this.getStatus(defender, 'guard');
    if (powerUp) raw *= 1 + powerUp.value;
    if (weaken) raw *= 1 - weaken.value;
    if (defenseUp) raw *= 1 - defenseUp.value * 0.65;
    if (mark) raw *= 1 + mark.value;
    if (shock && kind !== 'physical') raw *= 1 + shock.value;
    if (guard) raw *= 1 - guard.value;
    if (defender.trait === 'bedrock' && kind === 'physical') raw *= 0.85;
    if (opts.bonus) raw *= opts.bonus;

    let critChance = attacker.crit + (opts.critBonus || 0);
    const critUp = this.getStatus(attacker, 'critUp');
    if (critUp) critChance += critUp.value * 100;
    if (attacker.kitId === 'wild_ember' && kind === 'magic') critChance += 25;
    if (attacker.kitId === 'nightglass_cutpurse') critChance += 25;
    const crit = Math.random() * 100 < critChance;
    if (crit) raw *= 1.65;
    raw *= rnd(0.92, 1.08);
    let amount = Math.max(1, Math.round(raw));

    const shield = this.getStatus(defender, 'shield');
    if (shield?.amount > 0) {
      const absorbed = Math.min(shield.amount, amount);
      shield.amount -= absorbed;
      amount -= absorbed;
      if (shield.amount <= 0) defender.statuses = defender.statuses.filter((s) => s !== shield);
      if (absorbed > 0) {
        this.cb.onFx?.({ type: 'shield', uid: defender.uid, amount: absorbed });
        this.addLog(`${defender.name}의 보호막이 ${absorbed} 피해를 흡수했습니다.`, 'system');
      }
    }

    if (amount > 0) {
      defender.hp = Math.max(0, defender.hp - amount);
      if (defender.hp <= 0) {
        if (defender.trait === 'deathless' && !defender.deathlessUsed) {
          defender.deathlessUsed = true;
          defender.hp = 1;
          this.addLog(`${defender.name}이(가) 불사의 고집으로 버팁니다.`, 'system');
          this.cb.onFx?.({ type: 'status', uid: defender.uid, text: '불사의 고집' });
        } else {
          defender.alive = false;
          defender.hp = 0;
          this.addLog(`<span class="${defender.side}">${defender.name}</span> 쓰러짐`, 'system');
        }
      }
      this.cb.onFx?.({
        type: 'damage',
        uid: defender.uid,
        amount,
        crit,
        killed: !defender.alive,
        kind,
        source: attacker.uid
      });
      this.addLog(`${defender.name}에게 <b>${amount}</b> 피해${crit ? ' · 치명타' : ''}`, 'damage');
      if (crit) this.cb.onFx?.({ type: 'crit', uid: defender.uid });
      const lifesteal = this.getStatus(attacker, 'lifesteal');
      if (lifesteal) this.healUnit(attacker, Math.round(amount * lifesteal.value), null, '흡혈');
    }
    this.lastDamageCrit = crit;
    return amount;
  }

  applyRawDamage(target, amount, sourceName) {
    if (!target.alive) return;
    const shield = this.getStatus(target, 'shield');
    let remaining = amount;
    if (shield?.amount > 0) {
      const absorbed = Math.min(shield.amount, remaining);
      shield.amount -= absorbed;
      remaining -= absorbed;
      if (shield.amount <= 0) target.statuses = target.statuses.filter((s) => s !== shield);
    }
    if (remaining > 0) {
      target.hp = Math.max(0, target.hp - remaining);
      if (target.hp <= 0) {
        if (target.trait === 'deathless' && !target.deathlessUsed) {
          target.deathlessUsed = true;
          target.hp = 1;
        } else {
          target.alive = false;
          this.addLog(`<span class="${target.side}">${target.name}</span> 쓰러짐`, 'system');
        }
      }
      this.cb.onFx?.({ type: 'damage', uid: target.uid, amount: remaining, crit: false, killed: !target.alive, kind: 'dot' });
      this.addLog(`${target.name} · ${sourceName} <b>${remaining}</b>`, 'damage');
    }
  }

  healUnit(target, amount, source, sourceName = '회복') {
    if (!target?.alive) return 0;
    let final = Math.max(0, Math.round(amount));
    if (source?.trait === 'dawnlight') final = Math.round(final * 1.2);
    if (source?.kitId === 'dawnkeeper') final = Math.round(final * 1.2);
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + final);
    const healed = target.hp - before;
    if (healed > 0) {
      this.cb.onFx?.({ type: 'heal', uid: target.uid, amount: healed, source: sourceName });
      this.addLog(`${target.name} <b>+${healed}</b> 회복`, 'heal');
    }
    return healed;
  }

  applyStatus(target, status, source) {
    if (!target?.alive || !status?.id) return;
    if (status.chance != null && Math.random() > status.chance) return;
    let turns = status.turns || 1;
    if (target.trait === 'fade' && statusType(status.id) !== 'buff' && status.id !== 'shield') {
      turns = Math.max(1, turns - 1);
    }
    const existing = target.statuses.find((s) => s.id === status.id);
    if (existing) {
      existing.turns = Math.max(existing.turns, turns);
      if (status.id === 'shield') {
        existing.amount = (existing.amount || 0) + Math.round(target.maxHp * (status.value || 0));
        existing.value = Math.max(existing.value || 0, status.value || 0);
      } else {
        existing.value = Math.max(existing.value || 0, status.value || 0);
      }
      if (status.source) existing.source = status.source;
    } else {
      const entry = {
        id: status.id,
        turns,
        value: status.value || 0,
        source: status.source || (status.id === 'taunt' && source?.uid ? source.uid : null)
      };
      if (status.id === 'shield') entry.amount = Math.round(target.maxHp * (status.value || 0));
      target.statuses.push(entry);
    }
    this.cb.onFx?.({ type: 'status', uid: target.uid, text: statusName(status.id), statusId: status.id });
    this.addLog(`${target.name} · ${statusName(status.id)}`, 'status');
  }

  cleanse(target, count = 1) {
    const debuffs = target.statuses.filter((s) => ['debuff', 'control', 'dot'].includes(statusType(s.id)));
    const remove = debuffs.slice(0, count);
    for (const s of remove) {
      target.statuses = target.statuses.filter((x) => x !== s);
      this.addLog(`${target.name} · ${statusName(s.id)} 정화`, 'heal');
    }
    if (remove.length) this.cb.onFx?.({ type: 'cleanse', uid: target.uid });
  }

  dispel(target) {
    const buffs = target.statuses.filter((s) => statusType(s.id) === 'buff' || s.id === 'shield');
    for (const s of buffs) {
      target.statuses = target.statuses.filter((x) => x !== s);
      this.addLog(`${target.name} · ${statusName(s.id)} 해제`, 'system');
    }
    if (buffs.length) this.cb.onFx?.({ type: 'dispel', uid: target.uid });
  }

  // -------------------------------------------------------------------------
  // Enemy AI / auto ally
  // -------------------------------------------------------------------------

  enemyTurn(unit) {
    if (this.finished || !unit.alive) return;
    if (this.phase !== 'enemy') return;
    const abilities = (unit.abilities || []).filter((a) => (unit.cooldowns[a.name] || 0) <= 0);
    let action = null;
    if (abilities.length && Math.random() < 0.58) {
      action = pick(abilities);
      action = {
        ...action,
        id: action.name,
        icon: '✦',
        cooldown: action.cooldown || 0,
        target: action.target || (action.kind === 'heal' ? 'ally' : 'enemy'),
        kind: action.kind || 'physical',
        power: action.power || 1,
        reach: action.reach || (action.kind === 'physical' ? 'front' : 'any')
      };
      unit.cooldowns[action.name] = action.cooldown || 0;
    } else {
      action = {
        id: 'basic',
        name: '공격',
        icon: '⚔',
        kind: unit.attackKind,
        power: 1,
        reach: unit.attackReach,
        target: 'enemy',
        cost: 0,
        cooldown: 0
      };
    }
    const taunt = unit.statuses.find((s) => s.id === 'taunt' && s.source);
    let targetUid = null;
    if (taunt) {
      const taunter = this.getUnit(taunt.source);
      if (taunter?.alive) targetUid = taunter.uid;
    }
    if (!targetUid) {
      const targets = this.getValidTargets(unit, action);
      if (targets.length) {
        const sorted = [...targets].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        targetUid = (Math.random() < 0.55 ? sorted[0] : pick(targets)).uid;
      }
    }
    this.executeAction(unit, action, targetUid);
  }

  autoAlly(unit) {
    if (!unit || !unit.alive || this.phase !== 'select') return;
    const actions = this.getPlayerActions().filter((a) => !a.disabled && a.id !== 'potion' && a.id !== 'ether');
    const kit = actions.find((a) => a.id === unit.kitAbility?.id);
    const ability = actions.find((a) => a.id === unit.ability?.id);
    const targetTypes = [kit, ability].filter(Boolean);
    for (const action of targetTypes) {
      if (action.target === 'allAllies' || action.target === 'ally' || action.target === 'self') {
        this.executeAction(unit, action, null);
        return;
      }
      if (Math.random() < 0.45) {
        const targets = this.getValidTargets(unit, action);
        if (targets.length) {
          this.executeAction(unit, action, pick(targets).uid);
          return;
        }
      }
    }
    const enemies = this.getAlive('enemy');
    if (!enemies.length) return;
    const sorted = [...enemies].sort((a, b) => a.hp - b.hp);
    this.executeAction(unit, actions[0], sorted[0].uid);
  }

  getState() {
    const active = this.getActive();
    return {
      round: this.round,
      phase: this.phase,
      activeUid: this.activeUid,
      queue: [...this.queue],
      units: this.units,
      actions: this.getPlayerActions(),
      pendingAction: this.pendingAction,
      validTargets: this.phase === 'target' && this.pendingAction ? this.getValidTargets(active, this.pendingAction).map((u) => u.uid) : [],
      message: this.message,
      items: { ...this.items },
      auto: this.auto,
      finished: this.finished,
      result: this.result
    };
  }
}
