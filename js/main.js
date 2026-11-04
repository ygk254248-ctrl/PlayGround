import {
  RANKS, MAX_FLOOR, BOSS_FLOORS, THEMES, WEAPONS, ARMORS, CHARMS,
  META_UPGRADES, BOONS, ENEMY_INFO, ROOM_W, ROOM_H, WALL, themeForFloor
} from './data.js';
import { generateFloor, makeRng, doorPoint, DIRS, roomTypeInfo } from './dungeon.js';
import {
  loadSave, saveGame, resetSave, rankIndexForXp, rankForXp, nextRank,
  contractProgress, claimContract, equipItem, unlockItem, upgradeEquipment, upgradeMeta,
  addShards, addLicenseXp, bumpStat, bumpKill, moveCheckpoint, generateContract, formatNumber
} from './save.js';
import { AudioEngine } from './audio.js';
import { drawMenuScene, drawWorld, buildRoomBackground, buildStars } from './render.js';

const $ = id => document.getElementById(id);

const UI = {
  hud: $('hud'), title: $('title-screen'), hub: $('hub-screen'), hubContent: $('hub-content'),
  boon: $('boon-screen'), boonCards: $('boon-cards'), pause: $('pause-screen'),
  result: $('result-screen'), tutorial: $('tutorial'), loading: $('loading-screen'),
  canvas: $('game-canvas'), minimap: $('minimap'), toastStack: $('toasts'),
  bossHud: $('boss-hud'), bossFill: $('boss-fill'), bossDelayed: $('boss-delayed'),
  bossName: $('boss-name'), bossPhase: $('boss-phase'), interact: $('interact-prompt'),
  interactText: $('interact-text'), interactKey: $('interact-key')
};

const ctx = UI.canvas.getContext('2d');

const game = {
  mode: 'title',
  save: loadSave(),
  audio: null,
  time: 0,
  last: 0,
  width: 0,
  height: 0,
  dpr: 1,
  floor: 1,
  floorData: null,
  room: null,
  player: null,
  run: null,
  enemies: [],
  projectiles: [],
  hazards: [],
  particles: [],
  texts: [],
  pickups: [],
  effects: [],
  boss: null,
  camera: { x: ROOM_W / 2, y: ROOM_H / 2, shake: 0, zoom: 1 },
  mouse: { x: 0, y: 0, down: false, right: false },
  keys: new Set(),
  touch: { active: false, id: null, dx: 0, dy: 0, attack: false },
  stars: [],
  menuMotes: [],
  hudTimer: 0,
  mapTimer: 0,
  saveTimer: 0,
  saveDirty: false,
  damageFlash: 0,
  fade: 0,
  tutorialShown: false,
  hubTab: 'descent',
  codexTab: 'loop',
  boonOptions: [],
  pendingBoon: null,
  resultKind: 'death',
  banner: null,
  elapsed: 0
};

game.audio = new AudioEngine(game.save.settings);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const angleDiff = (a, b) => {
  let d = (a - b + Math.PI) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return d - Math.PI;
};

function hexMix(a, b, t) {
  const pa = a.replace('#', ''), pb = b.replace('#', '');
  const v = [0, 2, 4].map(i => Math.round(parseInt(pa.slice(i, i + 2), 16) * (1 - t) + parseInt(pb.slice(i, i + 2), 16) * t));
  return '#' + v.map(n => n.toString(16).padStart(2, '0')).join('');
}

function markSave() { game.saveDirty = true; }
function saveNow() {
  game.saveDirty = false;
  game.saveTimer = 0;
  saveGame(game.save);
}

function toast(message, kind = '', icon = '✦') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `<span>${icon}</span> ${message}`;
  UI.toastStack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
  while (UI.toastStack.children.length > 4) UI.toastStack.firstElementChild.remove();
}

function showBanner(text, sub = '', tone = 'gold') {
  game.banner = { text, sub, tone, time: 0, max: 4.2 };
}

function grantXp(amount) {
  if (amount <= 0) return;
  const result = addLicenseXp(game.save, amount);
  if (result.rankUp) {
    game.audio.play('rank');
    toast(`LICENSE PROMOTED — RANK ${result.to.id} · ${result.to.title}`, 'rank', '✧');
    showBanner(`RANK ${result.to.id}`, result.to.title, 'gold');
    burst(game.player.x, game.player.y, 42, '#ffdb99', 250);
  }
  markSave();
  return result;
}

function grantShards(amount, silent = false) {
  const value = addShards(game.save, amount);
  if (game.run) game.run.shardsEarned += value;
  if (!silent) toast(`+${formatNumber(value)} aether shards`, '', '✧');
  markSave();
  return value;
}

function isTouchLike() {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
}

function showEl(el, on = true) { el.classList.toggle('hidden', !on); }
function hideAllScreens() {
  [UI.title, UI.hub, UI.boon, UI.pause, UI.result].forEach(el => showEl(el, false));
  showEl(UI.tutorial, false);
}

/* ------------------------------------------------------------------ */
/* Menu and hub                                                       */
/* ------------------------------------------------------------------ */

function refreshTitle() {
  const rank = rankForXp(game.save.licenseXp);
  $('title-rank-seal').textContent = rank.id;
  $('title-checkpoint').textContent = String(game.save.checkpointFloor).padStart(2, '0');
  $('title-runs').textContent = game.save.stats.runs;
  $('title-bosses').textContent = game.save.stats.bosses;
  $('continue-line').textContent = game.save.stats.runs
    ? `Continue the ascent from Floor ${game.save.checkpointFloor} · ${formatNumber(game.save.shards)} shards banked.`
    : 'A new license. A tower with no summit. Begin at Floor 1.';
  updateSoundButtons();
}

function showTitle() {
  game.mode = 'title';
  hideAllScreens();
  showEl(UI.hud, false);
  showEl(UI.title, true);
  refreshTitle();
}

function updateHunterCard() {
  const rank = rankForXp(game.save.licenseXp);
  const next = nextRank(game.save.licenseXp);
  const currentFloor = rank.xp;
  const span = next ? next.xp - currentFloor : 1;
  const pct = next ? clamp((game.save.licenseXp - currentFloor) / span, 0, 1) * 100 : 100;
  $('hub-rank-seal').textContent = rank.id;
  $('hub-rank-title').textContent = rank.title;
  $('hub-xp-fill').style.width = `${pct}%`;
  $('hub-xp-label').textContent = next ? `${formatNumber(game.save.licenseXp)} / ${formatNumber(next.xp)} XP` : `${formatNumber(game.save.licenseXp)} XP · MAX`;
  $('hub-rank-next').textContent = next ? `NEXT: ${next.id}` : 'LICENSE COMPLETE';
  $('hub-best').textContent = game.save.stats.bestFloor || game.save.checkpointFloor;
  $('hub-kills').textContent = game.save.stats.kills;
  $('hub-bosses').textContent = game.save.stats.bosses;
  $('hub-shards').textContent = formatNumber(game.save.shards);
  const seal = $('hunter-card');
  seal.style.setProperty('--rank-color', rank.color);
}

function openHub(tab = game.hubTab) {
  game.mode = 'hub';
  game.hubTab = tab;
  hideAllScreens();
  showEl(UI.hud, false);
  showEl(UI.hub, true);
  game.audio.resume();
  game.audio.play('ui');
  renderHub();
}

function renderHub() {
  updateHunterCard();
  document.querySelectorAll('[data-hub-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.hubTab === game.hubTab);
  });
  const content = UI.hubContent;
  if (game.hubTab === 'descent') content.innerHTML = renderDescent();
  else if (game.hubTab === 'license') content.innerHTML = renderLicense();
  else if (game.hubTab === 'forge') content.innerHTML = renderForge();
  else if (game.hubTab === 'contracts') content.innerHTML = renderContracts();
  else content.innerHTML = renderCodex();
  content.scrollTop = 0;
}

function renderDescent() {
  const save = game.save;
  const rank = rankForXp(save.licenseXp);
  const weapon = WEAPONS[save.equipment.weapon];
  const armor = ARMORS[save.equipment.armor];
  const charm = save.equipment.charm ? CHARMS[save.equipment.charm] : null;
  const nextBoss = BOSS_FLOORS.find(f => f >= save.checkpointFloor) || MAX_FLOOR;
  const checkpointButtons = [1, 5, 9].map(f => {
    const unlocked = save.checkpointFloor >= f;
    const current = save.checkpointFloor === f;
    return `<button class="checkpoint-pill ${unlocked ? 'unlocked' : ''} ${current ? 'current' : ''}" ${unlocked ? `data-action="start-run" data-floor="${f}"` : 'disabled'}>${current ? '◈' : '◇'} Floor ${f}</button>`;
  }).join('');
  return `
    <section class="hub-panel">
      <div class="panel-head">
        <div><p class="eyebrow">THE NEXT DOOR</p><h2>Begin the Ascent</h2><p>Every floor is assembled anew. The tower remembers your license, never your path.</p></div>
        <span class="head-mark">✧</span>
      </div>
      <div class="descent-hero">
        <div>
          <span class="card-kicker">CURRENT CHECKPOINT · ${String(save.checkpointFloor).padStart(2, '0')}</span>
          <h3>${save.checkpointFloor === 1 ? 'The Cinder Gate' : save.checkpointFloor === 5 ? 'The Verdant Landing' : 'The Astral Threshold'}</h3>
          <p>Lyra enters with her licensed loadout. Guardians wait on floors 4, 8, and 12. Shards, contract progress, and license experience survive death.</p>
          <div class="checkpoint-row">${checkpointButtons}</div>
          <div class="descent-actions">
            <button class="primary-button" data-action="start-run" data-floor="${save.checkpointFloor}">Begin at Floor ${save.checkpointFloor}</button>
            <span class="run-note">NEXT GUARDIAN · FLOOR ${nextBoss}</span>
          </div>
        </div>
        <div class="descent-side">
          <div class="stat-card"><span>License rank</span><b>${rank.id}</b><em>${rank.title}</em></div>
          <div class="stat-card"><span>Best floor</span><b>${save.stats.bestFloor || save.checkpointFloor}</b><em>of ${MAX_FLOOR}</em></div>
          <div class="stat-card"><span>Shards banked</span><b>${formatNumber(save.shards)}</b><em>permanent</em></div>
        </div>
      </div>
      <div class="section-label">CURRENT LOADOUT</div>
      <div class="loadout-row">
        <div class="loadout-chip"><span>Weapon · Lv.${save.equipment.levels[weapon.id] || 1}</span><b>${weapon.icon} ${weapon.name}</b></div>
        <div class="loadout-chip"><span>Armor · Lv.${save.equipment.levels[armor.id] || 1}</span><b>${armor.icon} ${armor.name}</b></div>
        <div class="loadout-chip"><span>Charm</span><b>${charm ? `${charm.icon} ${charm.name}` : '— Empty —'}</b></div>
      </div>
      <div class="lore-strip">“A hunter is not the blade, nor the license, nor the tower’s memory of her. A hunter is the next step she chooses.”</div>
    </section>`;
}

function renderLicense() {
  const save = game.save;
  const rank = rankForXp(save.licenseXp);
  const next = nextRank(save.licenseXp);
  const span = next ? next.xp - rank.xp : 1;
  const pct = next ? clamp((save.licenseXp - rank.xp) / span, 0, 1) * 100 : 100;
  const ladder = RANKS.map(r => {
    const unlocked = save.licenseXp >= r.xp;
    const current = rank.id === r.id;
    return `<div class="rank-step ${current ? 'current' : ''} ${unlocked ? '' : 'locked'}">
      <span class="rank-dot">${r.id}</span>
      <div><h4>${r.title}</h4><p>${r.perk}</p></div>
      <span class="rank-xp">${formatNumber(r.xp)} XP</span>
    </div>`;
  }).join('');
  return `
    <section class="hub-panel">
      <div class="panel-head">
        <div><p class="eyebrow">PERMANENT RECORD</p><h2>Hunter’s License</h2><p>Promotion is earned by clearing floors, felling guardians, and honoring contracts.</p></div>
        <span class="head-mark">♛</span>
      </div>
      <div class="license-panel-grid">
        <div class="big-license">
          <div class="license-header"><span>TOWER HUNTERS GUILD · LOW WARD</span><span>HV-0713</span></div>
          <div class="big-license-rank">
            <div class="big-rank-seal" style="color:${rank.color};border-color:${rank.color}">${rank.id}</div>
            <div><h3>Lyra Vane</h3><p>${rank.title} · ${formatNumber(save.licenseXp)} license XP</p></div>
          </div>
          <div class="xp-line"><div style="width:${pct}%"></div></div>
          <div class="xp-labels"><span>${next ? `${formatNumber(next.xp - save.licenseXp)} XP TO ${next.id}` : 'MAXIMUM RANK'}</span><span>${next ? `NEXT: ${next.id}` : 'CROWN SLAYER'}</span></div>
          <div class="license-perk"><b>LICENSE PERK</b><br>${rank.perk}</div>
          <div class="license-rune-bg">✧</div>
        </div>
        <div>
          <div class="rank-ladder">${ladder}</div>
          <div class="license-stats-grid">
            <div class="mini-stat"><span>Ascents begun</span><b>${save.stats.runs}</b></div>
            <div class="mini-stat"><span>Denizens felled</span><b>${formatNumber(save.stats.kills)}</b></div>
            <div class="mini-stat"><span>Guardians broken</span><b>${save.stats.bosses}</b></div>
            <div class="mini-stat"><span>Floors cleared</span><b>${save.stats.floors}</b></div>
          </div>
        </div>
      </div>
    </section>`;
}

function equipmentCard(slot, item, unlocked, equipped, level) {
  const levelCap = 5;
  const cost = Math.round(45 * level * level);
  const lockText = `Unlock · ${item.unlock} ✧`;
  const stats = slot === 'weapon'
    ? `<span>DMG <b>${Math.round(item.damage * (1 + (level - 1) * 0.12))}</b></span><span>SPEED <b>${item.cooldown.toFixed(2)}s</b></span><span>REACH <b>${item.range}</b></span><span>CRIT <b>${Math.round(item.crit * 100)}%</b></span>`
    : slot === 'armor'
      ? `<span>HP <b>+${Math.round(item.hp * (1 + (level - 1) * 0.1))}</b></span><span>AETHER <b>+${item.aether}</b></span><span>DR <b>${Math.round(item.dr * 100)}%</b></span>`
      : `<span>PASSIVE</span>`;
  return `<div class="forge-card ${equipped ? 'equipped' : ''} ${unlocked ? '' : 'locked'}">
    <div class="forge-card-top">
      <div class="forge-icon">${item.icon}</div>
      <div class="forge-level">${unlocked ? `LV. ${level} / ${levelCap}` : 'UNFORGED'}</div>
    </div>
    <h4>${item.name}</h4>
    <p>${item.desc}</p>
    <div class="forge-stats">${stats}</div>
    <div class="forge-actions">
      ${unlocked
        ? `${equipped ? '<button class="tiny-button" disabled>Equipped</button>' : `<button class="tiny-button primary" data-action="forge-equip" data-slot="${slot}" data-id="${item.id}">Equip</button>`}
           ${slot !== 'charm' || true ? `<button class="tiny-button" data-action="forge-upgrade" data-id="${item.id}" ${level >= levelCap ? 'disabled' : ''}>${level >= levelCap ? 'Max level' : `Upgrade · ${cost} ✧`}</button>` : ''}`
        : `<button class="tiny-button primary" data-action="forge-unlock" data-slot="${slot}" data-id="${item.id}">${lockText}</button>`}
    </div>
  </div>`;
}

function renderForge() {
  const save = game.save;
  const weaponCards = Object.values(WEAPONS).map(item => equipmentCard('weapon', item, save.unlocked.weapons.includes(item.id), save.equipment.weapon === item.id, save.equipment.levels[item.id] || 1)).join('');
  const armorCards = Object.values(ARMORS).map(item => equipmentCard('armor', item, save.unlocked.armors.includes(item.id), save.equipment.armor === item.id, save.equipment.levels[item.id] || 1)).join('');
  const charmCards = Object.values(CHARMS).map(item => equipmentCard('charm', item, save.unlocked.charms.includes(item.id), save.equipment.charm === item.id, 1)).join('');
  const metaCards = Object.values(META_UPGRADES).map(u => {
    const level = save.meta[u.id] || 0;
    const cost = u.cost + level * u.step;
    return `<div class="forge-card ${level >= u.max ? 'equipped' : ''}">
      <div class="forge-card-top"><div class="forge-icon">${u.icon}</div><div class="forge-level">LV. ${level} / ${u.max}</div></div>
      <h4>${u.name}</h4><p>${u.desc}</p>
      <div class="forge-stats"><span>PERMANENT</span><span>APPLIED <b>${level * (u.id === 'might' ? 6 : u.id === 'vitality' ? 14 : u.id === 'agility' ? 4 : u.id === 'aether' ? 12 : 8)}${u.id === 'might' || u.id === 'agility' || u.id === 'fortune' ? '%' : ''}</b></span></div>
      <div class="forge-actions"><button class="tiny-button ${level < u.max ? 'primary' : ''}" data-action="meta-upgrade" data-id="${u.id}" ${level >= u.max ? 'disabled' : ''}>${level >= u.max ? 'Max' : `Forge · ${cost} ✧`}</button></div>
    </div>`;
  }).join('');
  return `
    <section class="hub-panel">
      <div class="panel-head">
        <div><p class="eyebrow">THE LOW WARD FORGE</p><h2>Equipment & Permanence</h2><p>Spend aether shards to unlock armaments, raise their levels, and sharpen Lyra’s body for every future ascent.</p></div>
        <span class="head-mark">⚒</span>
      </div>
      <div class="section-label">ATTRIBUTES · PERMANENT</div>
      <div class="forge-grid">${metaCards}</div>
      <div class="section-label">WEAPONS</div>
      <div class="forge-grid">${weaponCards}</div>
      <div class="section-label">ARMOR</div>
      <div class="forge-grid">${armorCards}</div>
      <div class="section-label">CHARMS</div>
      <div class="forge-grid">${charmCards}</div>
    </section>`;
}

function renderContracts() {
  const cards = game.save.contracts.map(c => {
    const p = contractProgress(game.save, c);
    const pct = clamp(p.value / p.target, 0, 1) * 100;
    return `<div class="contract-card ${p.complete ? 'complete' : ''}">
      <div class="contract-icon">✦</div>
      <div>
        <h4>${c.title}</h4>
        <p>${p.label} ${c.unit}${c.absolute ? ' reached' : ''} · Progress survives death.</p>
        <div class="contract-bar ${p.complete ? 'complete' : ''}"><div style="width:${pct}%"></div></div>
      </div>
      <div class="contract-reward">
        <span>REWARD</span>
        <b>${c.rewardShards} ✧ · ${c.rewardXp} XP</b>
        <button class="tiny-button ${p.complete ? 'primary' : ''}" data-action="claim-contract" data-id="${c.id}" ${p.complete ? '' : 'disabled'}>${p.complete ? 'Claim' : 'In progress'}</button>
      </div>
    </div>`;
  }).join('');
  return `
    <section class="hub-panel">
      <div class="panel-head">
        <div><p class="eyebrow">THE POSTING WALL</p><h2>Hunter Contracts</h2><p>Three standing contracts. Progress is recorded from the moment each is accepted and never expires.</p></div>
        <span class="head-mark">✎</span>
      </div>
      <div class="contract-list">${cards || '<div class="contract-empty">No contracts posted. Return after your next ascent.</div>'}</div>
      <div class="lore-strip">“The guild does not ask why you climb. It asks only what you brought back.”</div>
    </section>`;
}

function renderCodex() {
  const tabs = [['loop', 'Core Loop'], ['progression', 'Progression'], ['quests', 'Contracts'], ['bestiary', 'Bestiary']];
  const tabHtml = tabs.map(([id, label]) => `<button data-codex="${id}" class="${game.codexTab === id ? 'active' : ''}">${label}</button>`).join('');
  let body = '';
  if (game.codexTab === 'bestiary') {
    body = `<div class="bestiary-grid">${Object.values(ENEMY_INFO).map(e => `
      <div class="bestiary-card">
        <div class="bestiary-top"><div class="bestiary-icon">${e.icon}</div><div><h4>${e.name}</h4><span>${e.role} · ${e.threat}</span></div></div>
        <p>${e.desc}</p>
        <div class="bestiary-tell"><b>TELL</b> · ${e.tell}</div>
      </div>`).join('')}</div>`;
  } else {
    body = `<div class="codex-grid">${(CODEX_DATA[game.codexTab] || []).map(entry => `
      <div class="codex-entry"><h3>${entry.title}</h3><p>${entry.body}</p></div>`).join('')}</div>`;
  }
  return `
    <section class="hub-panel">
      <div class="panel-head">
        <div><p class="eyebrow">FIELD MANUAL</p><h2>The Hunter’s Codex</h2><p>The design of the tower, written in the margins of a dead hunter’s journal.</p></div>
        <span class="head-mark">❦</span>
      </div>
      <div class="codex-tabs">${tabHtml}</div>
      ${body}
    </section>`;
}

const CODEX_DATA = {
  loop: [
    { title: '01 · Prepare', body: 'Return to the Wayfarer’s Rest. Spend aether shards on permanent attributes, forge equipment, and accept three hunter contracts. Choose a checkpoint and descend.' },
    { title: '02 · Ascend', body: 'Each floor is a procedurally assembled set of sealed halls. A room’s doors remain locked until its denizens are culled. Treasure, shrines, and the stair gate tempt you off the critical path.' },
    { title: '03 · Adapt', body: 'Claim Aether Marks from shrines, hoards, and guardians. Marks stack until death and transform the run into a distinct build. Seek synergy between weapon cadence, critical strikes, and Aether abilities.' },
    { title: '04 · Die or Climb', body: 'Open the floor seal and carry your wounds to the next floor. Death ends the ascent but banks shards, contract progress, and license experience. Guardians open new checkpoints.' }
  ],
  progression: [
    { title: 'Hunter License', body: 'License experience comes from cleared floors, felled guardians, and claimed contracts. Promotion runs D → C → B → A → S, each rank adding damage and shard yield. The license is permanent.' },
    { title: 'Aether Shards', body: 'Shards are the only currency that survives death. They buy permanent attributes and equipment upgrades in the Sanctum. Shard yield improves with rank, the Fortune attribute, and the Gilded Greed mark.' },
    { title: 'Equipment', body: 'Weapons define attack rhythm, reach, and critical chance. Armor changes health, aether, speed, and damage reduction. Charms add one strong passive. Every weapon and armor can be upgraded to level 5.' },
    { title: 'Checkpoints', body: 'Felling a guardian opens a new ascent point. Runs may begin at floors 1, 5, or 9. The Hollow Crown waits on floor 12, and the tower does not end when the crown falls.' }
  ],
  quests: [
    { title: 'Three Active Contracts', body: 'The Rest always posts three contracts. Each one tracks a cumulative hunter statistic from the moment it was accepted, so progress survives death and multiple runs.' },
    { title: 'Claim and Renew', body: 'Claim a completed contract to receive shards and license experience. A fresh, more demanding contract replaces it immediately. Higher license ranks generate larger objectives and richer rewards.' },
    { title: 'No Failure State', body: 'Contracts never expire and cannot fail. They are long-term objectives that reward the way you already play: culling denizens, clearing rooms, climbing floors, gathering shards, and breaking guardians.' }
  ]
};

/* ------------------------------------------------------------------ */
/* Run setup and floor flow                                           */
/* ------------------------------------------------------------------ */

function computeStats(boons = {}) {
  const save = game.save;
  const weapon = WEAPONS[save.equipment.weapon] || WEAPONS.saber;
  const armor = ARMORS[save.equipment.armor] || ARMORS.coat;
  const charm = save.equipment.charm ? CHARMS[save.equipment.charm] : null;
  const wl = save.equipment.levels[weapon.id] || 1;
  const al = save.equipment.levels[armor.id] || 1;
  const rankIndex = rankIndexForXp(save.licenseXp);
  const b = id => boons[id] || 0;
  const attackSpeed = 1 + b('quickening') * 0.1;
  const damage = weapon.damage * (1 + (wl - 1) * 0.12) * (1 + save.meta.might * 0.06)
    * (1 + rankIndex * 0.04) * (1 + (charm?.effect?.damage || 0)) * (1 + b('bloodEdge') * 0.15);
  return {
    weapon,
    armor,
    charm,
    damage,
    cooldown: weapon.cooldown / attackSpeed,
    range: weapon.range,
    arc: weapon.arc,
    crit: clamp(weapon.crit + (charm?.effect?.crit || 0) + b('eagleEye') * 0.08, 0, 0.75),
    lifesteal: b('leech') * 0.03,
    maxHp: Math.round(100 + armor.hp * (1 + (al - 1) * 0.1) + save.meta.vitality * 14 + b('ironSkin') * 20),
    maxAether: Math.round(55 + armor.aether * (1 + (al - 1) * 0.1) + save.meta.aether * 12 + b('aetherWell') * 22),
    speed: 260 * armor.speed * (1 + save.meta.agility * 0.04) * (1 + b('fleetFoot') * 0.08),
    dr: clamp(armor.dr + b('serenity') * 0.08, 0, 0.5),
    shardMult: (1 + rankIndex * 0.05) * (1 + save.meta.fortune * 0.08) * (1 + b('greed') * 0.2),
    regen: 1.9 + b('aetherWell') * 0.8,
    specialMult: 1 + b('arcaneSurge') * 0.28,
    dashCooldown: 1.15 * (1 - b('blinkStep') * 0.18) * (1 - (charm?.effect?.dash || 0)),
    roomHeal: charm?.effect?.roomHeal || 0,
    executioner: b('executioner') > 0 ? 1 + b('executioner') * 0.3 : 1,
    shield: 0
  };
}

function createPlayer(stats) {
  return {
    x: ROOM_W / 2,
    y: ROOM_H * 0.68,
    r: 18,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    aether: stats.maxAether,
    maxAether: stats.maxAether,
    facing: -Math.PI / 2,
    attackCooldown: 0,
    attackAnim: 0,
    comboIndex: 0,
    comboTimer: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashDir: 0,
    lanceCooldown: 0,
    novaCooldown: 0,
    invuln: 0,
    hitFlash: 0,
    dashTrail: [],
    alive: true,
    damageTaken: 0,
    damageDealt: 0,
    doorCooldown: 0
  };
}

function startRun(floor = game.save.checkpointFloor) {
  game.audio.resume();
  const allowed = [1, 5, 9].filter(f => f <= game.save.checkpointFloor);
  const startFloor = allowed.includes(floor) ? floor : game.save.checkpointFloor;
  hideAllScreens();
  showEl(UI.hud, true);
  game.mode = 'playing';
  game.tutorialShown = false;
  game.resultKind = 'death';
  const freshStats = computeStats({});
  game.run = {
    floor: startFloor,
    boons: {},
    stats: freshStats,
    shardsEarned: 0,
    kills: 0,
    guardians: 0,
    roomsCleared: 0,
    floorsCleared: 0,
    startedAt: Date.now(),
    damageDealt: 0,
    damageTaken: 0,
    sealBroken: false
  };
  game.player = createPlayer(freshStats);
  game.save.stats.runs += 1;
  game.save.stats.bestFloor = Math.max(game.save.stats.bestFloor, startFloor);
  saveNow();
  loadFloor(startFloor, true);
  updateHud(true);
  updateContractChip();
  if (game.save.stats.runs <= 1 && game.save.settings.hints !== false) {
    game.tutorialShown = true;
    showEl(UI.tutorial, true);
  }
  game.audio.play('portal');
}

function loadFloor(floor, first = false) {
  game.floor = floor;
  game.floorData = generateFloor(floor);
  game.floorData.theme = themeForFloor(floor);
  game.run.floor = floor;
  game.run.roomsCleared = 0;
  game.run.sealBroken = false;
  game.save.stats.bestFloor = Math.max(game.save.stats.bestFloor, floor);
  if (!first && game.player) {
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.player.maxHp * 0.22);
    game.player.aether = Math.min(game.player.maxAether, game.player.aether + game.player.maxAether * 0.5);
  }
  enterRoom(game.floorData.startKey, null, true);
  game.fade = 1;
  showBanner(`FLOOR ${String(floor).padStart(2, '0')}`, game.floorData.theme.name, 'floor');
  markSave();
}

function placePlayerAtEntry(room, entrySide) {
  const p = game.player;
  if (entrySide) {
    const c = doorPoint(room, entrySide);
    const inward = entrySide === 'n' ? { x: 0, y: 1 } : entrySide === 's' ? { x: 0, y: -1 }
      : entrySide === 'w' ? { x: 1, y: 0 } : { x: -1, y: 0 };
    p.x = clamp(c.x + inward.x * 118, WALL + 55, ROOM_W - WALL - 55);
    p.y = clamp(c.y + inward.y * 118, WALL + 55, ROOM_H - WALL - 55);
    p.facing = Math.atan2(inward.y, inward.x);
  } else {
    p.x = ROOM_W / 2;
    p.y = ROOM_H * 0.68;
    p.facing = -Math.PI / 2;
  }
  p.doorCooldown = 1.1;
  p.dashTime = 0;
  p.attackCooldown = Math.min(p.attackCooldown, 0.1);
}

function enterRoom(key, entrySide = null, snap = false) {
  const room = game.floorData.rooms[key];
  if (!room) return;
  const firstVisit = !room.visited;
  game.room = room;
  room.visited = true;
  game.enemies = [];
  game.projectiles = [];
  game.hazards = [];
  game.pickups = [];
  game.effects = [];
  game.texts = [];
  game.boss = null;
  UI.bossHud.classList.add('hidden');
  placePlayerAtEntry(room, entrySide);
  if (!room.bg) buildRoomBackground(room, game.floorData.theme);
  spawnRoom(room);
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.camera.shake = 0;
  game.fade = 0.75;
  if (firstVisit && room.type !== 'start') toast(room.name, '', roomTypeInfo(room.type).icon);
  updateMap();
  updateHud(true);
  markSave();
}

function spawnRoom(room) {
  if (room.spawned) {
    if (room.type === 'boss' && game.boss) showEl(UI.bossHud, true);
    return;
  }
  room.spawned = true;
  if (room.type === 'combat') {
    room.cleared = false;
    spawnWave(room);
  } else if (room.type === 'boss') {
    room.cleared = false;
    spawnBoss(room);
  } else {
    room.cleared = true;
  }
}

function randomSpawnPoint(minFromPlayer = 250) {
  const p = game.player;
  for (let i = 0; i < 90; i++) {
    const x = WALL + 130 + Math.random() * (ROOM_W - WALL * 2 - 260);
    const y = WALL + 130 + Math.random() * (ROOM_H - WALL * 2 - 260);
    if (Math.hypot(x - p.x, y - p.y) < minFromPlayer) continue;
    if (game.room.obstacles.some(o => Math.hypot(x - o.x, y - o.y) < o.r + 48)) continue;
    return { x, y };
  }
  return { x: ROOM_W / 2 + rand(-220, 220), y: ROOM_H / 2 + rand(-160, 160) };
}

function enemyPool(floor) {
  if (floor <= 1) return ['wisp', 'hound'];
  if (floor <= 2) return ['wisp', 'hound', 'moth'];
  if (floor <= 3) return ['hound', 'knight', 'wisp', 'moth'];
  if (floor <= 5) return ['hound', 'knight', 'wraith', 'moth'];
  if (floor <= 7) return ['knight', 'wraith', 'sentinel', 'wisp'];
  if (floor <= 10) return ['wraith', 'sentinel', 'knight', 'moth'];
  return ['wraith', 'sentinel', 'knight', 'moth'];
}

const ENEMY_BASE = {
  wisp: { hp: 34, speed: 82, damage: 9, r: 17, name: 'Hollow Wisp' },
  hound: { hp: 58, speed: 152, damage: 13, r: 18, name: 'Bramble Hound' },
  moth: { hp: 25, speed: 182, damage: 8, r: 13, name: 'Void Moth' },
  knight: { hp: 118, speed: 88, damage: 18, r: 22, name: 'Cinder Knight' },
  wraith: { hp: 74, speed: 104, damage: 12, r: 18, name: 'Mirror Wraith' },
  sentinel: { hp: 190, speed: 58, damage: 21, r: 27, name: 'Stone Sentinel' }
};

const BOSS_BASE = {
  warden: { hp: 780, speed: 74, damage: 22, r: 48, name: 'The Ashen Warden' },
  matriarch: { hp: 1120, speed: 64, damage: 24, r: 46, name: 'The Verdant Matriarch' },
  crown: { hp: 1850, speed: 78, damage: 27, r: 52, name: 'The Hollow Crown' }
};

function createEnemy(type, x, y, floor, elite = false) {
  const base = ENEMY_BASE[type];
  const scale = 1 + (floor - 1) * 0.13;
  const eliteScale = elite ? 1.95 : 1;
  return {
    id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name: base.name,
    x, y,
    r: base.r * (elite ? 1.16 : 1),
    hp: Math.round(base.hp * scale * eliteScale),
    maxHp: Math.round(base.hp * scale * eliteScale),
    speed: base.speed * (1 + (floor - 1) * 0.018) * (elite ? 1.08 : 1),
    damage: base.damage * (1 + (floor - 1) * 0.07) * (elite ? 1.35 : 1),
    elite,
    state: 'chase',
    stateTimer: 0,
    attackTimer: 0.7 + Math.random() * 1.4,
    attackIndex: 0,
    pending: null,
    flash: 0,
    stun: 0,
    contactCd: 0,
    anim: Math.random() * 10,
    vx: 0,
    vy: 0,
    dead: false,
    boss: false
  };
}

function spawnWave(room) {
  const floor = game.floor;
  const pool = enemyPool(floor);
  const count = Math.min(9, 3 + Math.floor(floor * 0.42) + Math.floor(Math.random() * 2));
  const eliteChance = floor >= 5 ? Math.min(0.26, (floor - 4) * 0.035) : 0;
  for (let i = 0; i < count; i++) {
    const pos = randomSpawnPoint(240);
    const type = pool[(i + Math.floor(Math.random() * pool.length)) % pool.length];
    const elite = Math.random() < eliteChance && i > 0;
    const e = createEnemy(type, pos.x, pos.y, floor, elite);
    game.enemies.push(e);
    if (elite) {
      e.hp = Math.round(e.hp * 1.12);
      e.maxHp = e.hp;
    }
  }
}

function spawnBoss(room) {
  const bossId = game.floor >= 12 ? 'crown' : game.floor >= 8 ? 'matriarch' : 'warden';
  const base = BOSS_BASE[bossId];
  const boss = {
    id: bossId,
    type: 'boss',
    bossId,
    name: base.name,
    x: ROOM_W / 2,
    y: ROOM_H * 0.4,
    r: base.r,
    hp: base.hp,
    maxHp: base.hp,
    speed: base.speed,
    damage: base.damage,
    elite: false,
    boss: true,
    phase: 1,
    state: 'chase',
    stateTimer: 0,
    attackTimer: 1.8,
    attackIndex: 0,
    pending: null,
    flash: 0,
    stun: 0,
    contactCd: 0,
    anim: 0,
    vx: 0,
    vy: 0,
    dead: false,
    summoned: 0
  };
  game.enemies.push(boss);
  game.boss = boss;
  UI.bossName.textContent = base.name;
  UI.bossPhase.textContent = 'PHASE I';
  UI.bossFill.style.transform = 'scaleX(1)';
  UI.bossDelayed.style.transform = 'scaleX(1)';
  UI.bossHud.classList.remove('hidden');
  showBanner('GUARDIAN', base.name, 'boss');
  game.audio.play('boss');
  game.camera.shake = 12;
}

function recalcStats() {
  const p = game.player;
  if (!p) return;
  game.run.stats = computeStats(game.run.boons);
  const s = game.run.stats;
  p.maxHp = s.maxHp;
  p.maxAether = s.maxAether;
  p.hp = Math.min(p.hp, p.maxHp);
  p.aether = Math.min(p.aether, p.maxAether);
}

/* ------------------------------------------------------------------ */
/* Interactions, boons, and results                                   */
/* ------------------------------------------------------------------ */

function chestPosition(room) { return { x: ROOM_W / 2, y: ROOM_H / 2 + 8 }; }
function shrinePosition(room) { return { x: ROOM_W / 2, y: ROOM_H / 2 + 8 }; }
function portalPosition(room) { return { x: ROOM_W / 2, y: ROOM_H / 2 }; }

function getInteractable() {
  const room = game.room;
  if (!room || game.mode !== 'playing') return null;
  const p = game.player;
  if (room.type === 'treasure' && !room.chestOpened) {
    if (dist(p, chestPosition(room)) < 112) return { kind: 'chest', label: 'Open the sealed hoard' };
  }
  if (room.type === 'shrine' && !room.shrineUsed) {
    if (dist(p, shrinePosition(room)) < 112) return { kind: 'shrine', label: 'Touch the aether shrine' };
  }
  if (room.type === 'exit' || room.type === 'boss') {
    if (dist(p, portalPosition(room)) < 125) {
      if (game.run.sealBroken) return { kind: 'portal', label: game.floor >= MAX_FLOOR ? 'Claim the hollow crown' : 'Descend to the next floor' };
      return { kind: 'locked', label: `Seal the floor — ${game.run.roomsCleared} / ${game.floorData.required} halls` };
    }
  }
  return null;
}

function doInteract() {
  if (game.mode !== 'playing' || !game.player) return;
  const target = getInteractable();
  if (!target) return;
  if (target.kind === 'locked') {
    game.audio.play('error');
    toast('The stair gate is sealed. Clear every hostile hall.', 'danger', '◇');
    return;
  }
  if (target.kind === 'chest') {
    const room = game.room;
    room.chestOpened = true;
    game.audio.play('chest');
    const value = grantShards(28 + game.floor * 9, true);
    toast(`The hoard yields <b>${value}</b> aether shards`, '', '✧');
    burst(chestPosition(room).x, chestPosition(room).y, 34, '#ffdb99', 190);
    game.pendingBoon = { reason: 'hoard' };
    setTimeout(() => { if (game.mode === 'playing') offerBoons('THE HOARD OPENS'); }, 450);
    markSave();
    return;
  }
  if (target.kind === 'shrine') {
    const room = game.room;
    room.shrineUsed = true;
    const heal = Math.round(game.player.maxHp * 0.35);
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + heal);
    game.player.aether = game.player.maxAether;
    game.audio.play('shrine');
    toast(`The shrine restores <b>${heal}</b> health and all aether`, '', '✦');
    burst(shrinePosition(room).x, shrinePosition(room).y, 36, '#8ef2c7', 180);
    game.pendingBoon = { reason: 'shrine' };
    setTimeout(() => { if (game.mode === 'playing') offerBoons('THE SHRINE ANSWERS'); }, 500);
    markSave();
    return;
  }
  if (target.kind === 'portal') descend();
}

function offerBoons(kicker = 'THE TOWER OFFERS') {
  const available = Object.values(BOONS).filter(b => (game.run.boons[b.id] || 0) < b.max);
  if (!available.length) {
    const value = grantShards(45);
    toast(`Every mark is claimed. The tower pays <b>${value}</b> shards instead.`, '', '✧');
    game.mode = 'playing';
    return;
  }
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  game.boonOptions = shuffled.slice(0, 3);
  game.mode = 'boon';
  game.audio.play('boon');
  showEl(UI.tutorial, false);
  const totalMarks = Object.values(game.run.boons).reduce((a, b) => a + b, 0);
  $('boon-count-label').textContent = toRoman(totalMarks + 1);
  UI.boonCards.innerHTML = game.boonOptions.map((b, i) => `
    <button class="boon-card" data-boon="${b.id}" data-index="${i}">
      <span class="boon-number">${toRoman(i + 1)}</span>
      <span class="boon-icon">${b.icon}</span>
      <h3>${b.name}</h3>
      <span class="boon-stack">Mark ${i + 1} · stack ${(game.run.boons[b.id] || 0) + 1} / ${b.max}</span>
      <p class="boon-desc">${b.desc}</p>
      <p class="boon-flavor">“${b.flavor}”</p>
    </button>`).join('');
  document.querySelector('.boon-shell .eyebrow').textContent = kicker;
  showEl(UI.boon, true);
  markSave();
}

function applyBoon(id) {
  if (game.mode !== 'boon') return;
  const boon = BOONS[id];
  if (!boon) return;
  game.run.boons[id] = (game.run.boons[id] || 0) + 1;
  bumpStat(game.save, 'boons');
  recalcStats();
  if (id === 'ironSkin') game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20);
  if (id === 'aetherWell') game.player.aether = Math.min(game.player.maxAether, game.player.aether + 22);
  if (id === 'ironSkin' || id === 'aetherWell') { /* max values already raised by recalcStats */ }
  game.mode = 'playing';
  showEl(UI.boon, false);
  game.pendingBoon = null;
  toast(`<b>${boon.name}</b> claimed`, '', boon.icon);
  game.audio.play('pickup');
  updateHud(true);
  markSave();
  saveNow();
}

function toRoman(num) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (num >= v) { out += s; num -= v; }
  return out || 'I';
}

function descend() {
  if (game.mode !== 'playing') return;
  if (game.floor >= MAX_FLOOR) { finishVictory(); return; }
  const floor = game.floor;
  const shardReward = grantShards(30 + floor * 4, true);
  const xpReward = 38 + floor * 7;
  grantXp(xpReward);
  bumpStat(game.save, 'floors');
  game.run.floorsCleared += 1;
  if (BOSS_FLOORS.includes(floor)) {
    const liveFloor = Math.min(MAX_FLOOR, floor + 1);
    if (moveCheckpoint(game.save, liveFloor)) {
      toast(`New ascent point unlocked — <b>Floor ${liveFloor}</b>`, 'rank', '⇧');
    }
  }
  toast(`Floor ${floor} cleared — <b>+${shardReward}</b> shards · +${xpReward} license XP`, '', '⇧');
  game.audio.play('portal');
  saveNow();
  setTimeout(() => {
    if (game.mode !== 'playing') return;
    loadFloor(floor + 1, false);
    updateHud(true);
    game.audio.play('portal');
  }, 520);
  game.fade = 1;
  game.mode = 'transition';
  setTimeout(() => { if (game.mode === 'transition') game.mode = 'playing'; }, 520);
}

function finishVictory() {
  grantShards(420, true);
  grantXp(420);
  game.save.stats.wins += 1;
  game.save.stats.bestFloor = MAX_FLOOR;
  saveNow();
  game.audio.play('victory');
  showResult('victory');
}

function playerDie() {
  if (!game.player.alive) return;
  game.player.alive = false;
  game.mode = 'dead';
  game.audio.play('death');
  game.camera.shake = 18;
  burst(game.player.x, game.player.y, 60, '#f8e0c0', 300);
  game.save.stats.deaths += 1;
  saveNow();
  setTimeout(() => { if (game.mode === 'dead') showResult('death'); }, 1250);
}

function abandonRun() {
  if (!game.run) { showTitle(); return; }
  showResult('abandon');
}

function showResult(kind) {
  game.resultKind = kind;
  game.mode = 'result';
  hideAllScreens();
  showEl(UI.hud, false);
  showEl(UI.result, true);
  const save = game.save;
  const run = game.run;
  const rank = rankForXp(save.licenseXp);
  const next = nextRank(save.licenseXp);
  const span = next ? next.xp - rank.xp : 1;
  const pct = next ? clamp((save.licenseXp - rank.xp) / span, 0, 1) * 100 : 100;
  const shards = run?.shardsEarned || 0;
  const title = kind === 'victory' ? 'The Crown Is Silent' : kind === 'abandon' ? 'The Ascent Ends' : `Fallen at Floor ${run?.floor || 1}`;
  const kicker = kind === 'victory' ? 'THE HOLLOW CROWN FALLS' : kind === 'abandon' ? 'YOU RETURN TO THE REST' : 'THE ASCENT ENDS';
  const sub = kind === 'victory'
    ? 'The tower has no summit. It only has a new keeper. For now.'
    : kind === 'abandon'
      ? 'Your shards and contracts are banked. The tower keeps your unfinished marks.'
      : 'The tower keeps what it kills. What you earned is already yours.';
  $('result-kicker').textContent = kicker;
  $('result-title').textContent = title;
  $('result-sub').textContent = sub;
  $('result-grid').innerHTML = `
    <div><span>FLOOR REACHED</span><b>${run?.floor || 1}</b></div>
    <div><span>SHARDS EARNED</span><b class="gold">${formatNumber(shards)}</b></div>
    <div><span>DENIZENS FELLED</span><b>${run?.kills || 0}</b></div>
    <div><span>GUARDIANS</span><b>${run?.guardians || 0}</b></div>`;
  const boons = run ? Object.entries(run.boons).map(([id, count]) => {
    const b = BOONS[id];
    return `<p><span>${b.icon} ${b.name}</span><b>×${count}</b></p>`;
  }).join('') : '';
  $('result-columns').innerHTML = `
    <div class="result-column"><h4>ASCENT MARKS</h4>${boons || '<p class="empty">No marks claimed.</p>'}</div>
    <div class="result-column"><h4>LICENSE · ${rank.id} ${rank.title}</h4>
      <p><span>License XP</span><b>${formatNumber(save.licenseXp)}</b></p>
      <p><span>Next rank</span><b>${next ? `${next.id} · ${formatNumber(next.xp - save.licenseXp)} XP` : 'Maximum'}</b></p>
      <div class="xp-line" style="height:3px;background:rgba(255,255,255,.08);overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--gold)"></div></div>
      <p style="margin-top:9px"><span>Shards banked</span><b>${formatNumber(save.shards)}</b></p>
    </div>`;
  const retry = document.querySelector('#result-screen [data-action="retry"]');
  retry.textContent = kind === 'victory' ? 'Begin a New Ascent' : 'Ascend Again';
  showEl(UI.tutorial, false);
  saveNow();
}

// __APPEND__

