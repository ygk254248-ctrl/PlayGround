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
    fireTimer: 1.1 + Math.random() * 1.6,
    teleportTimer: 2.4 + Math.random() * 1.8,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    orbitDir: Math.random() < 0.5 ? 1 : -1,
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
  game.fade = 1;
  game.mode = 'transition';
  setTimeout(() => {
    if (game.mode !== 'transition') return;
    loadFloor(floor + 1, false);
    updateHud(true);
    game.audio.play('portal');
  }, 520);
  setTimeout(() => { if (game.mode === 'transition') game.mode = 'playing'; }, 560);
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

/* ------------------------------------------------------------------ */
/* HUD refresh                                                         */
/* ------------------------------------------------------------------ */

function updateSoundButtons() {
  const s = game.save.settings;
  const titleBtn = $('sound-toggle-title');
  if (titleBtn) {
    titleBtn.textContent = s.sound ? '◖))' : '◖×';
    titleBtn.setAttribute('aria-pressed', String(Boolean(s.sound)));
  }
  const setText = (id, on) => { const el = $(id); if (el) el.textContent = on ? 'ON' : 'OFF'; };
  setText('setting-sound', s.sound);
  setText('setting-music', s.music);
  setText('setting-shake', s.shake);
}

function updateContractChip() {
  const chipTitle = $('contract-title');
  const chipProgress = $('contract-progress');
  if (!chipTitle || !chipProgress) return;
  const contract = (game.save.contracts || []).find((c) => !contractProgress(game.save, c).complete)
    || (game.save.contracts || [])[0];
  if (!contract) {
    chipTitle.textContent = 'All contracts honored';
    chipProgress.textContent = '✓';
    return;
  }
  const p = contractProgress(game.save, contract);
  chipTitle.textContent = contract.title;
  chipProgress.textContent = p.complete ? 'CLAIM ✧' : p.label;
}

function updateBoonStrip() {
  const strip = $('boon-strip');
  if (!strip || !game.run) return;
  const entries = Object.entries(game.run.boons || {});
  const key = entries.map(([id, n]) => `${id}:${n}`).join('|');
  if (strip.dataset.cache === key) return;
  strip.dataset.cache = key;
  strip.innerHTML = entries.map(([id, count]) => {
    const boon = BOONS[id];
    if (!boon) return '';
    return `<span class="boon-pip" title="${boon.name} ×${count}">${boon.icon}<b>${count}</b></span>`;
  }).join('');
}

function updateHud(force = false) {
  const p = game.player;
  const run = game.run;
  if (!p || !run) return;
  if (!force) {
    game.hudTimer -= 1;
    if (game.hudTimer > 0) return;
  }
  game.hudTimer = 6; // frames, ~10Hz at 60fps
  const stats = run.stats;
  const save = game.save;
  const rank = rankForXp(save.licenseXp);

  const hpPct = clamp((p.hp / p.maxHp) * 100, 0, 100);
  const aetherPct = clamp((p.aether / p.maxAether) * 100, 0, 100);
  $('hp-fill').style.width = `${hpPct}%`;
  $('aether-fill').style.width = `${aetherPct}%`;
  $('hp-text').textContent = `${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
  $('aether-text').textContent = `${Math.max(0, Math.floor(p.aether))} / ${p.maxAether}`;
  $('hud-rank').textContent = rank.id;
  $('hud-rank').style.color = rank.color;
  $('hud-hunter-name').textContent = save.hunter?.name || 'Lyra Vane';

  $('floor-number').textContent = `FLOOR ${String(game.floor).padStart(2, '0')}`;
  $('floor-theme').textContent = game.floorData?.theme?.name || '';
  const required = Math.max(1, game.floorData?.required || 1);
  const sealPct = clamp((run.roomsCleared / required) * 100, 0, 100);
  $('seal-fill').style.width = `${run.sealBroken ? 100 : sealPct}%`;
  $('seal-text').textContent = run.sealBroken ? 'SEAL BROKEN' : `SEAL ${Math.min(run.roomsCleared, required)} / ${required}`;
  $('shard-count').textContent = formatNumber(save.shards);
  $('map-room-name').textContent = game.room?.name || '—';
  updateBoonStrip();
  updateContractChip();
  updateBossHud();
}

function updateCooldownOverlays() {
  const p = game.player;
  if (!p) return;
  if (game.dashMax) {
    const el = $('dash-cd');
    if (el) el.style.transform = `scaleY(${clamp(p.dashCooldown / game.dashMax, 0, 1)})`;
  }
  if (game.lanceMax) {
    const el = $('lance-cd');
    if (el) el.style.transform = `scaleY(${clamp(p.lanceCooldown / game.lanceMax, 0, 1)})`;
  }
  if (game.novaMax) {
    const el = $('nova-cd');
    if (el) el.style.transform = `scaleY(${clamp(p.novaCooldown / game.novaMax, 0, 1)})`;
  }
}

function updateBossHud() {
  const boss = game.boss;
  if (!boss || boss.dead) return;
  const pct = clamp(boss.hp / boss.maxHp, 0, 1);
  $('boss-fill').style.transform = `scaleX(${pct})`;
  const delayed = $('boss-delayed');
  if (delayed) delayed.style.transform = `scaleX(${pct})`;
  $('boss-phase').textContent = pct > 0.55 ? 'PHASE I' : 'PHASE II';
}

function updateMap() {
  const canvas = UI.minimap;
  if (!canvas || !game.floorData) return;
  const mctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = 'rgba(5, 4, 9, 0.82)';
  mctx.fillRect(0, 0, W, H);
  const cellW = W / 7;
  const cellH = H / 7;
  const inset = 2;
  for (const room of Object.values(game.floorData.rooms)) {
    const rx = room.x * cellW + inset;
    const ry = room.y * cellH + inset;
    const rw = cellW - inset * 2;
    const rh = cellH - inset * 2;
    const isCurrent = game.room && room.key === game.room.key;
    if (!room.visited) {
      mctx.fillStyle = 'rgba(120, 118, 140, 0.055)';
      mctx.fillRect(rx, ry, rw, rh);
      continue;
    }
    let color = 'rgba(148, 158, 178, 0.5)';
    if (room.type === 'start') color = 'rgba(117, 170, 255, 0.75)';
    else if (room.type === 'treasure') color = room.chestOpened ? 'rgba(255, 212, 121, 0.35)' : 'rgba(255, 212, 121, 0.85)';
    else if (room.type === 'shrine') color = room.shrineUsed ? 'rgba(142, 242, 199, 0.3)' : 'rgba(142, 242, 199, 0.8)';
    else if (room.type === 'exit') color = game.run?.sealBroken ? 'rgba(140, 255, 170, 0.9)' : 'rgba(140, 255, 170, 0.3)';
    else if (room.type === 'boss') color = 'rgba(255, 110, 110, 0.85)';
    else if (room.cleared) color = 'rgba(121, 224, 192, 0.32)';
    else color = 'rgba(229, 110, 110, 0.72)';
    mctx.fillStyle = color;
    mctx.fillRect(rx, ry, rw, rh);
    if (isCurrent) {
      mctx.strokeStyle = '#ffffff';
      mctx.lineWidth = 1.6;
      mctx.strokeRect(rx - 1, ry - 1, rw + 2, rh + 2);
    }
  }
}

function burst(x, y, count, color, speed = 170) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * TAU;
    const v = speed * (0.35 + Math.random() * 0.75);
    const life = 0.45 + Math.random() * 0.5;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      size: 1.6 + Math.random() * 2.8,
      color,
      life,
      maxLife: life
    });
  }
}

function floatText(x, y, text, color = '#f4e9dc') {
  game.texts.push({ x: x + (Math.random() - 0.5) * 18, y: y - 12, vy: -64, text, color, life: 0.85, maxLife: 0.85 });
}

function addShake(amount) {
  if (game.save.settings.shake === false) return;
  game.camera.shake = Math.max(game.camera.shake, amount);
}

function setDamageFlash(value) {
  game.damageFlash = Math.max(game.damageFlash, value);
  const el = $('damage-flash');
  if (el) el.style.opacity = String(Math.min(0.85, game.damageFlash));
}

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Combat resolution                                                   */
/* ------------------------------------------------------------------ */

function angleDiffAbs(a, b) {
  return Math.abs(angleDiff(a, b));
}

function damageEnemy(enemy, amount, { angle = null, knockback = 0, crit = false, silent = false } = {}) {
  if (enemy.dead) return 0;
  const dealt = Math.max(1, Math.round(amount));
  enemy.hp -= dealt;
  enemy.flash = 0.14;
  if (knockback > 0 && angle != null) {
    enemy.vx += Math.cos(angle) * knockback;
    enemy.vy += Math.sin(angle) * knockback;
  }
  if (!silent) {
    floatText(enemy.x, enemy.y - enemy.r, String(dealt), crit ? '#ffd479' : '#f4e9dc');
    burst(enemy.x, enemy.y, crit ? 10 : 5, crit ? '#ffd479' : '#e8d9c8', crit ? 230 : 150);
  }
  if (enemy.hp <= 0) killEnemy(enemy);
  return dealt;
}

function killEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  bumpKill(game.save, enemy.type);
  game.run.kills += 1;
  const shardDrops = enemy.boss ? 46 : enemy.elite ? 16 : 2 + Math.floor(Math.random() * 5);
  for (let i = 0; i < Math.min(8, shardDrops); i += 1) {
    game.pickups.push({
      x: enemy.x + (Math.random() - 0.5) * 40,
      y: enemy.y + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 130,
      vy: (Math.random() - 0.5) * 130,
      value: Math.max(1, Math.round(shardDrops / Math.min(8, shardDrops))),
      r: 5,
      size: 7,
      seed: Math.random()
    });
  }
  burst(enemy.x, enemy.y, enemy.boss ? 46 : 18, enemy.boss ? '#ffd479' : '#b7c4d8', enemy.boss ? 320 : 210);
  if (enemy.boss) {
    game.boss = null;
    game.run.guardians += 1;
    bumpStat(game.save, 'bosses');
    showBanner('GUARDIAN BROKEN', enemy.name, 'boss');
    addShake(14);
    game.audio.play('victory');
    showEl(UI.bossHud, false);
    const checkpoint = BOSS_FLOORS.includes(game.floor) && moveCheckpoint(game.save, Math.min(MAX_FLOOR, game.floor + 1));
    if (checkpoint) toast(`New ascent point unlocked — <b>Floor ${Math.min(MAX_FLOOR, game.floor + 1)}</b>`, 'rank', '⇧');
  }
  addShake(enemy.boss ? 0 : 3);
  checkRoomCleared();
}

function checkRoomCleared() {
  const room = game.room;
  if (!room || room.cleared) return;
  if (room.type !== 'combat' && room.type !== 'boss') return;
  if (game.enemies.some((e) => !e.dead)) return;
  room.cleared = true;
  game.run.roomsCleared += 1;
  bumpStat(game.save, 'rooms');
  const charm = game.run.stats?.roomHeal || 0;
  if (charm > 0 && game.player) {
    game.player.hp = Math.min(game.player.maxHp, game.player.hp + charm);
  }
  const required = game.floorData.required;
  if (game.run.roomsCleared >= required) {
    game.run.sealBroken = true;
    toast('The floor seal breaks. The <b>stair gate</b> is open.', 'rank', '⇧');
    game.audio.play('portal');
    showBanner('SEAL BROKEN', 'THE STAIR GATE IS OPEN', 'floor');
  } else {
    toast(`Hall culled — <b>${game.run.roomsCleared} / ${required}</b> seals`, '', '⚔');
  }
  markSave();
  updateHud(true);
  updateMap();
}

function damagePlayer(amount, sourceAngle = null) {
  const p = game.player;
  if (!p || !p.alive || p.invuln > 0) return;
  const stats = game.run.stats;
  const dmg = Math.max(1, Math.round(amount * (1 - (stats.dr || 0))));
  p.hp -= dmg;
  p.hitFlash = 0.22;
  setDamageFlash(0.55);
  addShake(6);
  game.audio.play('hurt');
  floatText(p.x, p.y - 20, `-${dmg}`, '#ff9a8c');
  if (sourceAngle != null) {
    p.kx = (p.kx || 0) + Math.cos(sourceAngle) * 190;
    p.ky = (p.ky || 0) + Math.sin(sourceAngle) * 190;
  }
  game.run.damageTaken += dmg;
  if (p.hp <= 0) {
    p.hp = 0;
    playerDie();
  }
  updateHud(true);
}

function healPlayer(amount) {
  const p = game.player;
  if (!p) return;
  const healed = Math.min(p.maxHp - p.hp, Math.round(amount));
  p.hp += healed;
  if (healed > 0) floatText(p.x, p.y - 20, `+${healed}`, '#8ef2c7');
}

function nearestEnemyAngleFrom(player, target) {
  return Math.atan2(target.y - player.y, target.x - player.x);
}

function tryAttack() {
  const p = game.player;
  const stats = game.run.stats;
  if (p.attackCooldown > 0) return;
  const weapon = stats.weapon;
  const isThird = p.comboIndex === (weapon.combo - 1);
  const cooldown = stats.cooldown * (isThird ? 1.35 : 1);
  p.attackCooldown = cooldown;
  p.attackAnim = 0.22;
  p.attackAnimMax = 0.22;
  game.dashAttack = false;

  const facing = p.facing;
  const range = stats.range;
  const arc = stats.arc;
  game.effects.push({ type: 'slash', x: p.x, y: p.y, angle: facing, arc, range: range + 14, t: 0, dur: 0.18 });

  let hits = 0;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const d = dist(p, enemy);
    if (d > range + enemy.r) continue;
    const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    if (angleDiffAbs(angle, facing) > arc / 2 + Math.atan2(enemy.r, Math.max(1, d))) continue;
    const executioner = stats.executioner || 1;
    const executeBonus = enemy.hp / enemy.maxHp < 0.35 ? executioner : 1;
    const crit = Math.random() < stats.crit;
    const damage = stats.damage * executeBonus * (crit ? 1.75 : 1) * (isThird ? 1.3 : 1) * (0.9 + Math.random() * 0.2);
    const dealt = damageEnemy(enemy, damage, { angle, knockback: weapon.knockback, crit });
    healPlayer(dealt * (stats.lifesteal || 0));
    game.run.damageDealt += dealt;
    hits += 1;
  }

  if (hits > 0) {
    addShake(isThird ? 5 : 2.5);
    game.audio.play(hits > 1 ? 'crit' : 'hit');
    p.comboIndex = (p.comboIndex + 1) % weapon.combo;
    p.comboTimer = 1.1;
  } else {
    game.audio.play('slash');
    p.comboIndex = (p.comboIndex + 1) % weapon.combo;
    p.comboTimer = 1.1;
  }
  updateHud(true);
}

function tryDash() {
  const p = game.player;
  const stats = game.run.stats;
  if (p.dashCooldown > 0 || p.dashTime > 0) return;
  const move = movementVector();
  const dir = (move.x || move.y) ? Math.atan2(move.y, move.x) : p.facing;
  p.dashTime = 0.19;
  p.dashDir = dir;
  p.dashCooldown = Math.max(0.4, stats.dashCooldown || 1.15);
  p.invuln = Math.max(p.invuln, 0.34);
  game.dashMax = Math.max(0.4, stats.dashCooldown || 1.15);
  burst(p.x, p.y, 10, '#8ef2c7', 200);
  game.audio.play('dash');
}

function tryLance() {
  const p = game.player;
  const stats = game.run.stats;
  const cost = 13;
  if (p.lanceCooldown > 0) return;
  if (p.aether < cost) { toast('Not enough aether.', 'danger', '✦'); game.audio.play('error'); return; }
  p.aether -= cost;
  p.lanceCooldown = 3.4;
  game.lanceMax = 3.4;
  const angle = p.facing;
  game.projectiles.push({
    side: 'player',
    x: p.x + Math.cos(angle) * 24,
    y: p.y + Math.sin(angle) * 24,
    vx: Math.cos(angle) * 760,
    vy: Math.sin(angle) * 760,
    r: 9,
    damage: (34 + stats.damage * 1.35) * (stats.specialMult || 1),
    life: 1.4,
    pierce: true
  });
  burst(p.x + Math.cos(angle) * 26, p.y + Math.sin(angle) * 26, 8, '#c9b8ff', 170);
  game.audio.play('lance');
  updateHud(true);
}

function tryNova() {
  const p = game.player;
  const stats = game.run.stats;
  const cost = 22;
  if (p.novaCooldown > 0) return;
  if (p.aether < cost) { toast('Not enough aether.', 'danger', '✦'); game.audio.play('error'); return; }
  p.aether -= cost;
  p.novaCooldown = 6;
  game.novaMax = 6;
  const radius = 185;
  const damage = (42 + stats.damage * 1.15) * (stats.specialMult || 1);
  for (const enemy of [...game.enemies]) {
    if (enemy.dead) continue;
    const d = dist(p, enemy);
    if (d > radius + enemy.r) continue;
    const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
    damageEnemy(enemy, damage * (1 - (d / (radius + enemy.r)) * 0.45), { angle, knockback: 330 });
    if (!enemy.dead) enemy.stun = Math.max(enemy.stun || 0, 0.9);
  }
  burst(p.x, p.y, 34, '#c9b8ff', 340);
  game.effects.push({ type: 'ring', x: p.x, y: p.y, r: 20, maxR: radius, t: 0, dur: 0.4 });
  addShake(7);
  game.audio.play('nova');
  updateHud(true);
}

/* ------------------------------------------------------------------ */
/* Enemy AI                                                            */
/* ------------------------------------------------------------------ */

function enemyFacePlayer(e) {
  e.facing = Math.atan2(game.player.y - e.y, game.player.x - e.x);
}

function moveEnemy(e, mx, my, speed, dt) {
  const len = Math.hypot(mx, my);
  if (len > 0.001) {
    e.x += (mx / len) * speed * dt;
    e.y += (my / len) * speed * dt;
  }
}

function tickTelegraph(e, dt) {
  if (e.telegraph) {
    e.telegraph.t += dt;
    if (e.telegraph.t >= e.telegraph.dur) e.telegraph = null;
  }
}

function updateWisp(e, dt) {
  const p = game.player;
  const d = dist(e, p);
  const toP = Math.atan2(p.y - e.y, p.x - e.x);
  const elite = e.elite ? 1.18 : 1;
  e.strafeFlip = (e.strafeFlip || 0) - dt;
  if (e.strafeFlip <= 0) { e.strafeDir = (e.strafeDir || 1) * -1; e.strafeFlip = 2.4 + Math.random() * 1.6; }
  let approach = 0;
  if (d > 330) approach = 1; else if (d < 215) approach = -0.85;
  const strafe = (e.strafeDir || 1) * 0.8;
  const mx = Math.cos(toP) * approach + Math.cos(toP + Math.PI / 2) * strafe;
  const my = Math.sin(toP) * approach + Math.sin(toP + Math.PI / 2) * strafe;
  moveEnemy(e, mx, my, 96 * elite, dt);
  e.facing = toP;
  e.fireTimer -= dt;
  if (e.windup != null && e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) {
      e.windup = null;
      e.telegraph = null;
      game.projectiles.push({
        side: 'enemy', x: e.x, y: e.y,
        vx: Math.cos(toP) * 345, vy: Math.sin(toP) * 345,
        r: 7, damage: e.damage, color: '#9fd6ff', life: 3.4
      });
      e.fireTimer = 2 + Math.random() * 1.1;
      game.audio.play('lance');
    }
    return;
  }
  if (e.fireTimer <= 0 && d < 660) {
    e.windup = 0.62;
    e.telegraph = { kind: 'cast', t: 0, dur: 0.62 };
  }
}

function updateHound(e, dt) {
  const p = game.player;
  const d = dist(e, p);
  const toP = Math.atan2(p.y - e.y, p.x - e.x);
  e.facing = toP;
  e.stateTimer -= dt;
  const elite = e.elite ? 1.15 : 1;
  if (e.state === 'stalk') {
    const orbit = e.orbitDir || 1;
    const toward = d > 210 ? 0.85 : d < 140 ? -0.7 : 0;
    const mx = Math.cos(toP) * toward + Math.cos(toP + Math.PI / 2) * orbit;
    const my = Math.sin(toP) * toward + Math.sin(toP + Math.PI / 2) * orbit;
    moveEnemy(e, mx, my, 132 * elite, dt);
    if (e.stateTimer <= 0) { e.state = 'windup'; e.stateTimer = 0.58; e.lockAngle = toP; e.telegraph = { kind: 'line', t: 0, dur: 0.58, dir: toP, range: Math.min(d + 60, 460) }; }
  } else if (e.state === 'windup') {
    e.telegraph && (e.lockAngle = toP);
    e.telegraph && (e.telegraph.dir = toP);
    if (e.stateTimer <= 0) {
      e.state = 'charge';
      e.stateTimer = 0.4;
      e.vx = Math.cos(e.lockAngle) * 640;
      e.vy = Math.sin(e.lockAngle) * 640;
      game.audio.play('dash');
    }
  } else if (e.state === 'charge') {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.stateTimer <= 0) { e.state = 'recover'; e.stateTimer = 1.05; }
  } else { // recover
    moveEnemy(e, Math.cos(toP), Math.sin(toP), 46 * elite, dt);
    if (e.stateTimer <= 0) { e.state = 'stalk'; e.stateTimer = 1.5 + Math.random() * 1.4; e.orbitDir = Math.random() < 0.5 ? 1 : -1; }
  }
}

function updateKnight(e, dt) {
  const p = game.player;
  const d = dist(e, p);
  const toP = Math.atan2(p.y - e.y, p.x - e.x);
  e.facing = toP;
  const elite = e.elite ? 1.18 : 1;
  const isWarden = e.bossId === 'warden';
  const reach = isWarden ? 118 : 74;
  const cleaveRange = isWarden ? 168 : 108;
  const cleaveArc = isWarden ? 2.35 : 2.05;
  e.attackTimer -= dt;
  if (e.state === 'winding') {
    if (e.attackTimer <= 0) {
      const slam = e.telegraph?.kind === 'ring';
      e.state = 'chase';
      e.attackTimer = isWarden ? 1.35 : 1.75;
      e.telegraph = null;
      if (slam) {
        game.hazards.push({ kind: 'ring', x: e.x, y: e.y, r: e.r + 10, maxR: 252, speed: 272, damage: e.damage, hit: false });
        addShake(9);
        game.audio.play('nova');
        return;
      }
      const angle = e.facing;
      const pd = dist(p, e);
      if (pd < cleaveRange + p.r && angleDiffAbs(Math.atan2(p.y - e.y, p.x - e.x), angle) < cleaveArc / 2 + 0.25) {
        damagePlayer(e.damage * (isWarden ? 1.15 : 1), angle);
      }
      game.effects.push({ type: 'slash', x: e.x, y: e.y, angle, arc: cleaveArc, range: cleaveRange, t: 0, dur: 0.22 });
      addShake(isWarden ? 6 : 3.5);
      game.audio.play('slash');
    }
    return;
  }
  if (d > reach) moveEnemy(e, Math.cos(toP), Math.sin(toP), (isWarden ? 84 : 88) * elite, dt);
  if (e.attackTimer <= 0 && d < cleaveRange * 0.92) {
    e.state = 'winding';
    e.attackTimer = isWarden ? 0.72 : 0.8;
    e.telegraph = { kind: 'arc', t: 0, dur: e.attackTimer, dir: toP, range: cleaveRange, arc: cleaveArc };
    game.audio.play('ui');
  }
}

function updateWraith(e, dt) {
  const p = game.player;
  const d = dist(e, p);
  const toP = Math.atan2(p.y - e.y, p.x - e.x);
  e.facing = toP;
  e.teleportTimer -= dt;
  e.fireTimer -= dt;
  if (e.teleportTimer <= 0) {
    e.teleportTimer = 4.1 + Math.random() * 1.2;
    const a = Math.random() * TAU;
    const r = 240 + Math.random() * 130;
    const nx = clamp(p.x + Math.cos(a) * r, WALL + 40, ROOM_W - WALL - 40);
    const ny = clamp(p.y + Math.sin(a) * r, WALL + 40, ROOM_H - WALL - 40);
    burst(e.x, e.y, 14, '#c9d6ff', 190);
    e.x = nx; e.y = ny;
    burst(e.x, e.y, 14, '#c9d6ff', 190);
    game.audio.play('dash');
    return;
  }
  let approach = 0;
  if (d > 360) approach = 1; else if (d < 225) approach = -0.8;
  moveEnemy(e, Math.cos(toP) * approach, Math.sin(toP) * approach, 108, dt);
  if (e.fireTimer <= 0 && d < 640) {
    e.fireTimer = 2.35 + Math.random() * 0.8;
    for (const spread of [-0.3, 0, 0.3]) {
      const a = toP + spread;
      game.projectiles.push({
        side: 'enemy', x: e.x, y: e.y,
        vx: Math.cos(a) * 375, vy: Math.sin(a) * 375,
        r: 6, damage: e.damage, color: '#c9d6ff', life: 3
      });
    }
    game.audio.play('lance');
  }
}

function updateSentinel(e, dt) {
  const p = game.player;
  const d = dist(e, p);
  const toP = Math.atan2(p.y - e.y, p.x - e.x);
  e.facing = toP;
  e.attackTimer -= dt;
  if (e.state === 'winding') {
    if (e.attackTimer <= 0) {
      e.state = 'chase';
      e.attackTimer = 3.4;
      e.telegraph = null;
      game.hazards.push({ kind: 'ring', x: e.x, y: e.y, r: e.r + 8, maxR: e.boss ? 260 : 212, speed: 268, damage: e.damage, hit: false });
      addShake(8);
      game.audio.play('nova');
    }
    return;
  }
  if (d > 118) moveEnemy(e, Math.cos(toP), Math.sin(toP), 54, dt);
  if (e.attackTimer <= 0 && d < 250) {
    e.state = 'winding';
    e.attackTimer = 0.92;
    e.telegraph = { kind: 'ring', t: 0, dur: 0.92, range: e.boss ? 260 : 212 };
    game.audio.play('ui');
  }
}

function updateMoth(e, dt) {
  const p = game.player;
  const toP = Math.atan2(p.y - e.y, p.x - e.x);
  e.facing = toP;
  const wobble = Math.sin(game.time * 5.4 + e.anim * 3) * 1.05;
  moveEnemy(e, Math.cos(toP + wobble), Math.sin(toP + wobble), 158, dt);
}

function updateBossExtras(e, dt) {
  const p = game.player;
  if (e.bossId === 'warden') {
    if (!e.summoned1 && e.hp < e.maxHp * 0.66) {
      e.summoned1 = true;
      summonMinions(e, 'hound', 2);
      toast('The Warden calls the hunt.', 'danger', '♛');
    } else if (!e.summoned2 && e.hp < e.maxHp * 0.33) {
      e.summoned2 = true;
      summonMinions(e, 'hound', 2);
      toast('The Warden calls the hunt.', 'danger', '♛');
    }
    // Ground slam shares the sentinel pattern on a slower clock
    e.slamTimer = (e.slamTimer ?? 4.5) - dt;
    if (e.slamTimer <= 0 && dist(e, p) < 320) {
      e.slamTimer = 6.4;
      e.state = 'winding';
      e.attackTimer = 0.95;
      e.telegraph = { kind: 'ring', t: 0, dur: 0.95, range: 250 };
    }
  } else if (e.bossId === 'matriarch') {
    e.summonTimer = (e.summonTimer ?? 5) - dt;
    e.poolTimer = (e.poolTimer ?? 3.2) - dt;
    if (e.summonTimer <= 0) {
      e.summonTimer = e.hp < e.maxHp * 0.5 ? 6 : 8.5;
      const minions = game.enemies.filter((m) => !m.dead && !m.boss).length;
      if (minions < 3) {
        summonMinions(e, 'hound', 1);
        toast('The Matriarch blooms a hound.', 'danger', '❧');
      }
    }
    if (e.poolTimer <= 0) {
      e.poolTimer = 6.6;
      game.hazards.push({ kind: 'pool', x: p.x, y: p.y, r: 96, life: 5, maxLife: 5, tick: 0, damage: 9 });
      game.audio.play('shrine');
    }
  } else if (e.bossId === 'crown') {
    e.burstTimer = (e.burstTimer ?? 4) - dt;
    e.teleportTimer = (e.teleportTimer ?? 3.4) - dt;
    if (e.teleportTimer <= 0) {
      e.teleportTimer = e.hp < e.maxHp * 0.5 ? 3.6 : 5;
      burst(e.x, e.y, 18, '#ffd479', 230);
      const a = Math.random() * TAU;
      e.x = clamp(p.x + Math.cos(a) * 260, WALL + 40, ROOM_W - WALL - 40);
      e.y = clamp(p.y + Math.sin(a) * 260, WALL + 40, ROOM_H - WALL - 40);
      burst(e.x, e.y, 18, '#ffd479', 230);
    }
    if (e.burstTimer <= 0) {
      e.burstTimer = e.hp < e.maxHp * 0.5 ? 4.6 : 6.8;
      const bolts = e.hp < e.maxHp * 0.5 ? 14 : 9;
      for (let i = 0; i < bolts; i += 1) {
        const a = (i / bolts) * TAU;
        game.projectiles.push({
          side: 'enemy', x: e.x, y: e.y,
          vx: Math.cos(a) * 320, vy: Math.sin(a) * 320,
          r: 7, damage: e.damage * 0.72, color: '#ffd479', life: 4
        });
      }
      game.audio.play('nova');
      addShake(6);
    }
  }
}

function summonMinions(boss, type, count) {
  for (let i = 0; i < count; i += 1) {
    const pos = randomSpawnPoint(160);
    const minion = createEnemy(type, pos.x, pos.y, game.floor, false);
    minion.summoned = true;
    game.enemies.push(minion);
  }
}

function updateEnemy(e, dt) {
  if (e.dead) return;
  e.anim += dt;
  e.contactCd = Math.max(0, (e.contactCd || 0) - dt);
  e.flash = Math.max(0, e.flash - dt);
  e.x += (e.vx || 0) * dt;
  e.y += (e.vy || 0) * dt;
  e.vx = (e.vx || 0) * Math.max(0, 1 - 5.2 * dt);
  e.vy = (e.vy || 0) * Math.max(0, 1 - 5.2 * dt);
  // Stay in the hall
  e.x = clamp(e.x, WALL + e.r * 0.5, ROOM_W - WALL - e.r * 0.5);
  e.y = clamp(e.y, WALL + e.r * 0.5, ROOM_H - WALL - e.r * 0.5);
  tickTelegraph(e, dt);
  if (e.stun > 0) { e.stun -= dt; return; }
  if (e.boss) updateBossExtras(e, dt);
  switch (e.type) {
    case 'wisp': updateWisp(e, dt); break;
    case 'hound': updateHound(e, dt); break;
    case 'knight': updateKnight(e, dt); break;
    case 'wraith': updateWraith(e, dt); break;
    case 'sentinel': updateSentinel(e, dt); break;
    case 'moth': updateMoth(e, dt); break;
    default: updateKnight(e, dt);
  }
  // Contact damage
  const p = game.player;
  if (p.alive && e.contactCd <= 0 && dist(e, p) < e.r + p.r) {
    if (e.type === 'moth') {
      // The moth bursts on contact
      damagePlayer(e.damage * 1.15, Math.atan2(p.y - e.y, p.x - e.x));
      e.contactCd = 0.85;
      killEnemy(e);
    } else {
      const chargeBonus = e.type === 'hound' && e.state === 'charge' ? 1.6 : 1;
      damagePlayer(e.damage * chargeBonus, Math.atan2(p.y - e.y, p.x - e.x));
      e.contactCd = 0.85;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Projectiles, hazards, pickups, particles                            */
/* ------------------------------------------------------------------ */

function updateProjectiles(dt) {
  const p = game.player;
  for (const proj of game.projectiles) {
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;
    if (proj.x < WALL * 0.4 || proj.x > ROOM_W - WALL * 0.4 || proj.y < WALL * 0.4 || proj.y > ROOM_H - WALL * 0.4) proj.life = Math.min(proj.life, 0.18);
    if (proj.side === 'enemy') {
      if (p.alive && p.invuln <= 0 && dist(proj, p) < proj.r + p.r) {
        damagePlayer(proj.damage, Math.atan2(proj.vy, proj.vx));
        proj.life = 0;
        burst(proj.x, proj.y, 6, proj.color || '#9fd6ff', 150);
      }
    } else {
      for (const enemy of game.enemies) {
        if (enemy.dead || proj.hitSet?.has(enemy.id)) continue;
        if (dist(proj, enemy) < proj.r + enemy.r) {
          damageEnemy(enemy, proj.damage, { angle: Math.atan2(proj.vy, proj.vx), knockback: 140 });
          burst(proj.x, proj.y, 6, '#c9b8ff', 160);
          if (proj.pierce) {
            proj.hitSet = proj.hitSet || new Set();
            proj.hitSet.add(enemy.id);
          } else {
            proj.life = 0;
          }
        }
      }
    }
  }
  game.projectiles = game.projectiles.filter((proj) => proj.life > 0);
}

function updateHazards(dt) {
  const p = game.player;
  for (const hazard of game.hazards) {
    if (hazard.kind === 'ring') {
      hazard.r += hazard.speed * dt;
      if (!hazard.hit) {
        const d = Math.hypot(p.x - hazard.x, p.y - hazard.y);
        if (Math.abs(d - hazard.r) < 22 && p.invuln <= 0) {
          damagePlayer(hazard.damage, Math.atan2(p.y - hazard.y, p.x - hazard.x));
          hazard.hit = true;
        }
      }
      hazard.dead = hazard.r >= hazard.maxR;
    } else if (hazard.kind === 'pool') {
      hazard.life -= dt;
      hazard.tick -= dt;
      if (hazard.tick <= 0) {
        hazard.tick = 0.5;
        if (Math.hypot(p.x - hazard.x, p.y - hazard.y) < hazard.r) damagePlayer(hazard.damage, null);
      }
      hazard.dead = hazard.life <= 0;
    }
  }
  game.hazards = game.hazards.filter((hazard) => !hazard.dead);
}

function updatePickups(dt) {
  const p = game.player;
  for (const pickup of game.pickups) {
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.vx *= Math.max(0, 1 - 2.4 * dt);
    pickup.vy *= Math.max(0, 1 - 2.4 * dt);
    const d = dist(pickup, p);
    if (d < 150) {
      const pull = (1 - d / 150) * 950 + 140;
      pickup.x += ((p.x - pickup.x) / Math.max(1, d)) * pull * dt;
      pickup.y += ((p.y - pickup.y) / Math.max(1, d)) * pull * dt;
    }
    if (d < p.r + 10) {
      const value = addShards(game.save, Math.round(pickup.value * (game.run.stats.shardMult || 1)));
      floatText(pickup.x, pickup.y, `+${value}`, '#ffd479');
      game.audio.play('shard');
      pickup.collected = true;
    }
    pickup.life = (pickup.life ?? 22) - dt;
    if (pickup.life <= 0) pickup.collected = true;
  }
  game.pickups = game.pickups.filter((pickup) => !pickup.collected);
}

function updateParticles(dt) {
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - 2.1 * dt);
    p.vy *= Math.max(0, 1 - 2.1 * dt);
    p.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  for (const t of game.texts) {
    t.y += t.vy * dt;
    t.vy *= Math.max(0, 1 - 2.2 * dt);
    t.life -= dt;
  }
  game.texts = game.texts.filter((t) => t.life > 0);
  for (const fx of game.effects) {
    fx.t += dt;
    if (fx.type === 'ring') fx.r = 20 + ((fx.maxR - 20) * fx.t) / fx.dur;
  }
  game.effects = game.effects.filter((fx) => fx.t < fx.dur);
}

/* ------------------------------------------------------------------ */
/* Room flow — seals and doorways                                       */
/* ------------------------------------------------------------------ */

const APERTURE_PASS = 56;

function roomSealed() {
  const room = game.room;
  return room && !room.cleared && (room.type === 'combat' || room.type === 'boss');
}

function doorPassable(dir) {
  const room = game.room;
  if (!room || !room.doors[dir]) return false;
  if (roomSealed()) return false;
  const c = doorPoint(room, dir);
  const p = game.player;
  return (dir === 'n' || dir === 's') ? Math.abs(p.x - c.x) < APERTURE_PASS : Math.abs(p.y - c.y) < APERTURE_PASS;
}

function updateDoors() {
  const p = game.player;
  const room = game.room;
  if (!room) return;
  const sealed = roomSealed();
  // Wall clamps
  if (!doorPassable('n') && p.y < WALL + p.r) p.y = WALL + p.r;
  if (!doorPassable('s') && p.y > ROOM_H - WALL - p.r) p.y = ROOM_H - WALL - p.r;
  if (!doorPassable('w') && p.x < WALL + p.r) p.x = WALL + p.r;
  if (!doorPassable('e') && p.x > ROOM_W - WALL - p.r) p.x = ROOM_W - WALL - p.r;
  // Sealed warning when brushing against a locked doorway
  if (sealed) {
    for (const dir of ['n', 's', 'e', 'w']) {
      if (!room.doors[dir]) continue;
      const c = doorPoint(room, dir);
      const near = (dir === 'n' || dir === 's') ? Math.abs(p.x - c.x) < 70 && Math.abs(p.y - c.y) < WALL + 26
        : Math.abs(p.y - c.y) < 70 && Math.abs(p.x - c.x) < WALL + 26;
      if (near) {
        game.sealWarnTimer = (game.sealWarnTimer || 0) - 1;
        if (game.sealWarnTimer <= 0) {
          game.sealWarnTimer = 150;
          toast('The hall is sealed — cull its <b>denizens</b>.', 'danger', '◆');
          game.audio.play('error');
        }
      }
    }
  }
  // Doorway transitions
  if (doorPassable('n') && p.y < 6) enterRoom(room.doors.n, 's');
  else if (doorPassable('s') && p.y > ROOM_H - 6) enterRoom(room.doors.s, 'n');
  else if (doorPassable('w') && p.x < 6) enterRoom(room.doors.w, 'e');
  else if (doorPassable('e') && p.x > ROOM_W - 6) enterRoom(room.doors.e, 'w');
}

function movementVector() {
  let x = 0;
  let y = 0;
  if (game.keys.has('KeyW') || game.keys.has('ArrowUp')) y -= 1;
  if (game.keys.has('KeyS') || game.keys.has('ArrowDown')) y += 1;
  if (game.keys.has('KeyA') || game.keys.has('ArrowLeft')) x -= 1;
  if (game.keys.has('KeyD') || game.keys.has('ArrowRight')) x += 1;
  if (game.touch.active) { x += game.touch.dx; y += game.touch.dy; }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

/* ------------------------------------------------------------------ */
/* Main update                                                          */
/* ------------------------------------------------------------------ */

function updateGame(dt) {
  const p = game.player;
  const stats = game.run.stats;
  game.elapsed += dt;

  // Cooldowns and timers
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.attackAnim = Math.max(0, p.attackAnim - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.lanceCooldown = Math.max(0, p.lanceCooldown - dt);
  p.novaCooldown = Math.max(0, p.novaCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  p.doorCooldown = Math.max(0, p.doorCooldown - dt);
  p.comboTimer = Math.max(0, p.comboTimer - dt);
  if (p.comboTimer <= 0) p.comboIndex = 0;
  if (p.dashTime > 0) {
    p.dashTime = Math.max(0, p.dashTime - dt);
    p.dashTrail.push({ x: p.x, y: p.y, life: 0.4 });
    if (p.dashTrail.length > 7) p.dashTrail.shift();
  }
  for (const ghost of p.dashTrail) ghost.life -= dt * 1.6;
  p.dashTrail = p.dashTrail.filter((ghost) => ghost.life > 0);

  // Aether trickle
  p.aether = Math.min(p.maxAether, p.aether + stats.regen * dt);

  // Movement
  const move = movementVector();
  const dashing = p.dashTime > 0;
  let speed = stats.speed * (dashing ? 2.85 : 1);
  let mx = move.x;
  let my = move.y;
  if (dashing) { mx = Math.cos(p.dashDir); my = Math.sin(p.dashDir); }
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  // Knockback velocity
  p.x += (p.kx || 0) * dt;
  p.y += (p.ky || 0) * dt;
  p.kx = (p.kx || 0) * Math.max(0, 1 - 6.5 * dt);
  p.ky = (p.ky || 0) * Math.max(0, 1 - 6.5 * dt);

  // Facing — toward movement, or toward the cursor while attacking
  if (Math.hypot(mx, my) > 0.12 && !dashing) p.facing = Math.atan2(my, mx);
  if (game.mouse.active && (game.mouse.down || game.mouse.right)) {
    const world = screenToWorld(game.mouse.x, game.mouse.y);
    p.facing = Math.atan2(world.y - p.y, world.x - p.x);
  }

  // Obstacle collision — push out of circles
  for (const obstacle of game.room.obstacles) {
    const d = Math.hypot(p.x - obstacle.x, p.y - obstacle.y);
    const minD = obstacle.r * 0.72 + p.r * 0.82;
    if (d < minD && d > 0.001) {
      const push = (minD - d);
      p.x += ((p.x - obstacle.x) / d) * push;
      p.y += ((p.y - obstacle.y) / d) * push;
    }
  }

  updateDoors();

  // Attacks held
  if (game.mouse.down || game.touch.attack) tryAttack();

  // Enemies
  for (const enemy of game.enemies) updateEnemy(enemy, dt);
  game.enemies = game.enemies.filter((enemy) => !enemy.dead);

  updateProjectiles(dt);
  updateHazards(dt);
  updatePickups(dt);
  updateParticles(dt);

  // Camera follows, clamped so the hall stays framed
  const camLerp = Math.min(1, dt * 5.4);
  game.camera.x = lerp(game.camera.x, p.x, camLerp);
  game.camera.y = lerp(game.camera.y, p.y, camLerp);
  const zoom = game.camera.zoom;
  const halfW = game.width / 2 / zoom;
  const halfH = game.height / 2 / zoom;
  const margin = 96;
  if (ROOM_W > halfW * 2 - margin * 2) game.camera.x = clamp(game.camera.x, halfW - margin, ROOM_W - halfW + margin);
  else game.camera.x = ROOM_W / 2;
  if (ROOM_H > halfH * 2 - margin * 2) game.camera.y = clamp(game.camera.y, halfH - margin, ROOM_H - halfH + margin);
  else game.camera.y = ROOM_H / 2;
  game.camera.shake = Math.max(0, game.camera.shake - dt * 26);

  // Fade and banner
  game.fade = Math.max(0, game.fade - dt * 1.6);
  if (game.banner) game.banner.time += dt;
  if (game.damageFlash > 0) {
    game.damageFlash = Math.max(0, game.damageFlash - dt * 2.1);
    const el = $('damage-flash');
    if (el) el.style.opacity = String(Math.min(0.85, game.damageFlash));
  }

  // Boss phase text refresh
  if (game.boss) updateBossHud();

  // HUD and minimap throttles
  game.mapTimer -= dt;
  if (game.mapTimer <= 0) { game.mapTimer = 0.6; updateMap(); }
  updateHud();
  updateCooldownOverlays();

  // Interact prompt
  updateInteractPrompt();

  // Autosave after a quiet moment of play
  game.saveTimer += dt;
  if (game.saveTimer >= 2.4) {
    game.saveTimer = 0;
    if (game.saveDirty) saveNow();
  }
}

function updateInteractPrompt() {
  const el = $('interact-prompt');
  if (!el) return;
  const target = getInteractable();
  if (target) {
    $('interact-text').textContent = target.label;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

function screenToWorld(sx, sy) {
  const w = game.width;
  const h = game.height;
  const zoom = game.camera.zoom;
  return {
    x: (sx - w / 2) / zoom + game.camera.x,
    y: (sy - h / 2) / zoom + game.camera.y
  };
}

/* ------------------------------------------------------------------ */
/* Pause                                                                */
/* ------------------------------------------------------------------ */

function pauseGame() {
  if (game.mode !== 'playing') return;
  game.mode = 'pause';
  const stats = game.run?.stats;
  const statsEl = $('pause-stats');
  if (statsEl && game.run) {
    statsEl.innerHTML = `
      <div><span>FLOOR</span><b>${String(game.floor).padStart(2, '0')}</b></div>
      <div><span>DENIZENS FELLED</span><b>${game.run.kills}</b></div>
      <div><span>SHARDS EARNED</span><b>${formatNumber(game.run.shardsEarned)}</b></div>
      <div><span>MARKS CLAIMED</span><b>${Object.values(game.run.boons).reduce((a, b) => a + b, 0)}</b></div>`;
  }
  updateSoundButtons();
  showEl(UI.pause, true);
  game.audio.play('ui');
}

function resumeGame() {
  if (game.mode !== 'pause') return;
  game.mode = 'playing';
  showEl(UI.pause, false);
  game.audio.play('ui');
}

/* ------------------------------------------------------------------ */
/* Input                                                                */
/* ------------------------------------------------------------------ */

function wireMouse() {
  const canvas = UI.canvas;
  const fine = window.matchMedia('(pointer: fine)');
  game.mouse.active = fine.matches;
  window.addEventListener('mousemove', (event) => {
    if (!fine.matches) return;
    game.mouse.x = event.clientX;
    game.mouse.y = event.clientY;
    game.mouse.active = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (!fine.matches || game.mode !== 'playing') return;
    if (event.button === 0) { game.mouse.down = true; tryAttack(); }
    else if (event.button === 2) { game.mouse.right = true; tryLance(); }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) game.mouse.down = false;
    if (event.button === 2) game.mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('mouseleave', () => { game.mouse.down = false; game.mouse.right = false; });
}

function wireKeyboard() {
  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
    game.keys.add(code);
    if (code === 'Escape') {
      if (game.mode === 'playing') pauseGame();
      else if (game.mode === 'pause') resumeGame();
      else if (game.mode === 'hub') showTitle();
      return;
    }
    if (game.mode !== 'playing') return;
    if (code === 'KeyE') doInteract();
    else if (code === 'Space') tryDash();
    else if (code === 'KeyQ') tryNova();
    else if (code === 'KeyK') tryLance();
  });
  window.addEventListener('keyup', (event) => game.keys.delete(event.code));
  window.addEventListener('blur', () => { game.keys.clear(); game.mouse.down = false; game.mouse.right = false; game.touch.attack = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && game.mode === 'playing') pauseGame();
  });
}

function wireTouch() {
  const zone = $('joystick-zone');
  const knob = $('joystick-knob');
  if (!zone || !knob) return;
  let joyId = null;
  let origin = null;
  const radius = 46;

  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
  const resetJoy = () => {
    joyId = null;
    origin = null;
    game.touch.active = false;
    game.touch.dx = 0;
    game.touch.dy = 0;
    game.touch.id = null;
    setKnob(0, 0);
  };

  zone.addEventListener('touchstart', (event) => {
    event.preventDefault();
    if (joyId != null) return;
    const touch = event.changedTouches[0];
    joyId = touch.identifier;
    const rect = zone.getBoundingClientRect();
    origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    game.touch.id = joyId;
    game.touch.active = true;
  }, { passive: false });

  zone.addEventListener('touchmove', (event) => {
    if (joyId == null) return;
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (touch.identifier !== joyId) continue;
      let dx = touch.clientX - origin.x;
      let dy = touch.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      setKnob(dx, dy);
      game.touch.dx = dx / radius;
      game.touch.dy = dy / radius;
    }
  }, { passive: false });

  const endHandler = (event) => {
    for (const touch of event.changedTouches) if (touch.identifier === joyId) resetJoy();
  };
  zone.addEventListener('touchend', endHandler);
  zone.addEventListener('touchcancel', endHandler);

  document.querySelectorAll('[data-touch]').forEach((button) => {
    const action = button.dataset.touch;
    const onStart = (event) => {
      event.preventDefault();
      if (game.mode !== 'playing') return;
      if (action === 'attack') game.touch.attack = true;
      else if (action === 'dash') tryDash();
      else if (action === 'lance') tryLance();
      else if (action === 'nova') tryNova();
      else if (action === 'interact') doInteract();
    };
    const onEnd = () => { if (action === 'attack') game.touch.attack = false; };
    button.addEventListener('touchstart', onStart, { passive: false });
    button.addEventListener('touchend', onEnd);
    button.addEventListener('touchcancel', onEnd);
    button.addEventListener('mousedown', onStart);
    button.addEventListener('mouseup', onEnd);
  });
}

function wireDataActions() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    switch (action) {
      case 'quickplay': startRun(game.save.checkpointFloor); break;
      case 'open-hub': openHub(game.hubTab || 'descent'); break;
      case 'close-hub': showTitle(); break;
      case 'toggle-sound': {
        game.save.settings.sound = !game.save.settings.sound;
        if (game.audio.master) game.audio.master.gain.value = game.save.settings.sound ? 0.9 : 0;
        else game.audio.settings.sound = game.save.settings.sound;
        game.audio.settings.sound = game.save.settings.sound;
        updateSoundButtons();
        saveNow();
        game.audio.play('ui');
        break;
      }
      case 'toggle-music': {
        game.save.settings.music = !game.save.settings.music;
        game.audio.settings.music = game.save.settings.music;
        if (game.audio.musicGain) game.audio.musicGain.gain.value = game.save.settings.music ? 0.2 : 0;
        updateSoundButtons();
        saveNow();
        game.audio.play('ui');
        break;
      }
      case 'toggle-shake':
        game.save.settings.shake = !game.save.settings.shake;
        updateSoundButtons();
        saveNow();
        game.audio.play('ui');
        break;
      case 'resume': resumeGame(); break;
      case 'abandon': abandonRun(); break;
      case 'retry': startRun(game.save.checkpointFloor); break;
      case 'pause': if (game.mode === 'playing') pauseGame(); else if (game.mode === 'pause') resumeGame(); break;
      case 'start-run': {
        const floor = Number(el.dataset.floor);
        if (Number.isFinite(floor)) startRun(floor);
        break;
      }
      case 'forge-equip': {
        if (equipItem(game.save, el.dataset.slot, el.dataset.id)) { game.audio.play('ui'); } else { game.audio.play('error'); }
        renderHub();
        break;
      }
      case 'forge-upgrade': {
        const result = upgradeEquipment(game.save, el.dataset.id);
        game.audio.play(result.ok ? 'boon' : 'error');
        renderHub();
        break;
      }
      case 'forge-unlock': {
        const result = unlockItem(game.save, el.dataset.slot, el.dataset.id);
        game.audio.play(result.ok ? 'boon' : 'error');
        if (!result.ok && result.reason) toast(result.reason, 'danger', '✧');
        renderHub();
        break;
      }
      case 'meta-upgrade': {
        const result = upgradeMeta(game.save, el.dataset.id);
        game.audio.play(result.ok ? 'boon' : 'error');
        renderHub();
        break;
      }
      case 'claim-contract': {
        const result = claimContract(game.save, el.dataset.id);
        if (result.ok) {
          toast(`Contract honored — <b>+${result.shards}</b> shards · +${result.xp} XP`, 'rank', '✎');
          game.audio.play('rank');
        } else {
          game.audio.play('error');
        }
        renderHub();
        break;
      }
      case 'dismiss-tutorial': showEl(UI.tutorial, false); break;
      default: break;
    }
  });

  document.querySelectorAll('[data-hub-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      game.hubTab = button.dataset.hubTab;
      game.audio.play('ui');
      renderHub();
    });
  });

  UI.hubContent.addEventListener('click', (event) => {
    const codex = event.target.closest('[data-codex]');
    if (codex) {
      game.codexTab = codex.dataset.codex;
      game.audio.play('ui');
      renderHub();
    }
  });

  UI.boonCards.addEventListener('click', (event) => {
    const card = event.target.closest('[data-boon]');
    if (!card) return;
    applyBoon(card.dataset.boon);
  });
}

/* ------------------------------------------------------------------ */
/* Frame loop and boot                                                   */
/* ------------------------------------------------------------------ */

function render() {
  const ctx = UI.canvas.getContext('2d');
  ctx.clearRect(0, 0, game.width, game.height);
  if (game.room && game.floorData) {
    drawWorld(ctx, game);
  } else {
    drawMenuScene(ctx, game);
  }
  if (game.fade > 0) {
    ctx.fillStyle = `rgba(4, 3, 7, ${game.fade})`;
    ctx.fillRect(0, 0, game.width, game.height);
  }
}

let lastFrame = 0;
let loadingHidden = false;
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = now;
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (!Number.isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.05);
  game.time += dt;
  if (game.mode === 'playing') updateGame(dt);
  else if (game.mode === 'dead' || game.mode === 'transition') updateParticles(dt);
  render();
  if (!loadingHidden) {
    loadingHidden = true;
    const loading = $('loading-screen');
    if (loading) loading.classList.add('done');
  }
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  game.width = window.innerWidth;
  game.height = window.innerHeight;
  game.dpr = dpr;
  UI.canvas.width = Math.floor(game.width * dpr);
  UI.canvas.height = Math.floor(game.height * dpr);
  const ctx = UI.canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.camera.zoom = clamp(Math.min(game.width / ROOM_W, game.height / ROOM_H) * 1.06, 0.62, 1.25);
}

window.__aetherborne = game;

function boot() {
  document.body.classList.toggle('touch', isTouchLike());
  // Segment dividers inside the HP bar
  const chips = $('hp-chips');
  if (chips) chips.innerHTML = '<i></i>'.repeat(11);
  game.stars = buildStars(180);
  resize();
  window.addEventListener('resize', resize);
  wireMouse();
  wireKeyboard();
  wireTouch();
  wireDataActions();
  game.audio.init();
  updateSoundButtons();
  showTitle();
  requestAnimationFrame(frame);
}

boot();

