// Aetherborne: Warband — application shell, creation wizard, dungeon loop and battle UI.
import {
  RACES,
  CLASSES,
  STAT_KEYS,
  STAT_LABELS,
  STAT_SHORT,
  FLOORS,
  floorData,
  raceById,
  classById,
  representativeKit,
  STATUSES
} from './data.js';
import {
  createCharacter,
  computeCharacter,
  grantXp,
  restoreCharacter,
  randomCharacter,
  randomName,
  xpNeeded
} from './character.js';
import {
  generateDungeon,
  drawDungeon,
  drawMinimap,
  revealAround,
  entityAt,
  isWalkable,
  hashSeed
} from './dungeon.js';
import { Battle } from './battle.js';
import { AudioEngine } from '../audio.js';

const SAVE_KEY = 'aetherborne_warband_v1';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeName(value) {
  return String(value || '').replace(/[<>&"']/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
}

function loadState() {
  const defaults = { version: 1, party: [], run: null, settings: { sound: true, music: true } };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const party = Array.isArray(parsed.party) ? parsed.party.slice(0, 6) : [];
    while (party.length < 6) party.push(null);
    for (let i = 0; i < party.length; i += 1) {
      const member = party[i];
      if (!member || !raceById(member.raceId) || !classById(member.classId)) party[i] = null;
    }
    return {
      version: 1,
      party,
      run: parsed.run && typeof parsed.run.floor === 'number' ? parsed.run : null,
      settings: { ...defaults.settings, ...(parsed.settings || {}) }
    };
  } catch (error) {
    console.warn('Save could not be read', error);
    return defaults;
  }
}

const saved = loadState();

const app = {
  mode: 'title',
  settings: saved.settings,
  party: saved.party,
  run: saved.run,
  audio: new AudioEngine(saved.settings),
  draft: null,
  step: 0,
  editingSlot: null,
  selectedSlot: null,
  manualTab: 'overview',
  overlayOpen: false,
  overlayClosable: true,
  dungeon: null,
  view: { visible: new Set(), explored: new Set(), camX: null, camY: null },
  keys: new Set(),
  touchDir: null,
  lastMove: 0,
  battle: null,
  battleState: null,
  currentEncounter: null,
  battleReturn: 'dungeon',
  lastFrame: 0,
  time: 0,
  toastTimer: null,
  dungeonToastTimer: null
};

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1,
      party: app.party,
      run: app.run,
      settings: app.settings,
      updatedAt: Date.now()
    }));
  } catch (error) {
    console.warn('Save failed', error);
  }
}

function partyMembers() {
  return app.party.filter(Boolean);
}

function firstEmptySlot() {
  return app.party.findIndex((member) => !member);
}

function hasParty() {
  return partyMembers().length > 0;
}

function showScreen(name) {
  $$('.screen').forEach((screen) => screen.classList.remove('is-active'));
  const screen = $(`#screen-${name}`);
  if (screen) screen.classList.add('is-active');
  app.mode = name;
}

function toast(text, tone = '') {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.innerHTML = text;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(10px)';
    el.style.transition = 'opacity .25s, transform .25s';
    setTimeout(() => el.remove(), 280);
  }, 2800);
}

function dungeonToast(text) {
  const el = $('#dungeon-toast');
  if (!el) return;
  el.innerHTML = text;
  el.classList.remove('hidden');
  clearTimeout(app.dungeonToastTimer);
  app.dungeonToastTimer = setTimeout(() => el.classList.add('hidden'), 2500);
}

function openOverlay(html, { wide = false, closable = true } = {}) {
  const overlay = $('#overlay');
  const card = $('#overlay-card');
  card.className = `overlay-card${wide ? ' wide' : ''}`;
  card.innerHTML = html;
  overlay.classList.remove('hidden');
  app.overlayOpen = true;
  app.overlayClosable = closable;
  setTimeout(() => card.scrollTop = 0, 0);
}

function closeOverlay() {
  $('#overlay').classList.add('hidden');
  app.overlayOpen = false;
  app.overlayClosable = true;
}

function audioPlay(name) {
  try { app.audio.play(name); } catch (error) { /* audio is a nicety */ }
}

function updateSoundButton() {
  const button = $('#btn-sound');
  if (!button) return;
  button.textContent = app.settings.sound ? '◖))' : '◖×';
  button.title = app.settings.sound ? '사운드 켜짐' : '사운드 꺼짐';
}

// ---------------------------------------------------------------------------
// Ambient decoration + title
// ---------------------------------------------------------------------------

function buildEmbers() {
  const host = $('#ambient-embers');
  if (!host) return;
  host.innerHTML = '';
  for (let i = 0; i < 24; i += 1) {
    const ember = document.createElement('span');
    ember.className = 'ember';
    ember.style.left = `${Math.random() * 100}%`;
    ember.style.animationDuration = `${9 + Math.random() * 12}s`;
    ember.style.animationDelay = `${Math.random() * -20}s`;
    ember.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
    ember.style.opacity = `${0.2 + Math.random() * 0.4}`;
    if (Math.random() > 0.6) ember.style.background = 'var(--teal)';
    host.appendChild(ember);
  }
}

function refreshTitle() {
  const continueButton = $('#btn-continue');
  const note = $('#title-note');
  if (!continueButton) return;
  const canContinue = hasParty() && app.run;
  continueButton.disabled = !canContinue;
  if (canContinue) {
    const floor = floorData(app.run.floor);
    note.textContent = `저장된 원정대 · ${partyMembers().length}/6명 · ${floor.name} ${app.run.floor}층`;
  } else if (hasParty()) {
    note.textContent = '저장된 원정대가 있습니다. 새 원정을 시작하거나 원정대를 재편성하세요.';
  } else {
    note.textContent = '탑은 아직 다음 원정대를 기다리고 있습니다.';
  }
  const sigils = $('#title-sigils');
  if (sigils) {
    const picks = ['fighter', 'guardian', 'ranger', 'cleric', 'mage', 'monk'];
    sigils.innerHTML = picks.map((id) => {
      const cls = classById(id);
      return `<div class="preview-sigil" data-label="${esc(cls.english.toUpperCase())}" style="color:${cls.color}">${cls.glyph}</div>`;
    }).join('');
  }
}

// ---------------------------------------------------------------------------
// Creation wizard
// ---------------------------------------------------------------------------

const STEP_LABELS = ['종족', '기본 클래스', '전문 키트', '능력치', '이름', '파티 배치'];

function startCreation(slot = null) {
  let target = slot;
  if (target == null) target = firstEmptySlot();
  if (target < 0) {
    toast('원정대가 가득 찼습니다. 빈 슬롯이 없습니다.');
    return;
  }
  app.editingSlot = target;
  app.draft = { raceId: null, classId: null, kitId: null, name: '' };
  app.step = 0;
  app.selectedSlot = null;
  showScreen('create');
  renderCreation();
}

function closeCreation() {
  app.draft = null;
  if (hasParty()) {
    showScreen('party');
    renderParty();
  } else {
    showScreen('title');
    refreshTitle();
  }
}

function renderStepTrack() {
  const host = $('#step-track');
  if (!host) return;
  host.innerHTML = STEP_LABELS.map((label, index) => {
    let cls = 'step-chip';
    if (index === app.step) cls += ' is-active';
    else if (index < app.step) cls += ' is-done';
    return `<span class="${cls}"><b>${index + 1}</b>${label}</span>`;
  }).join('');
}

function renderCreation() {
  if (!app.draft) return;
  renderStepTrack();
  const eyebrow = $('#create-eyebrow');
  const heading = $('#create-heading');
  const sub = $('#create-sub');
  const grid = $('#create-grid');
  const extra = $('#create-extra');
  const back = $('#btn-create-back');
  const next = $('#btn-create-next');
  const hint = $('#create-hint');
  if (!grid) return;

  const step = app.step;
  eyebrow.textContent = `STEP ${String(step + 1).padStart(2, '0')} / 06`;
  extra.innerHTML = '';
  next.textContent = step === 4 ? '이름 확정 · 파티 배치' : '다음';
  back.textContent = step === 0 ? (hasParty() ? '파티로' : '처음으로') : '이전';
  next.disabled = false;
  hint.textContent = '';

  if (step === 0) {
    heading.textContent = '종족 선택';
    sub.textContent = '혈통은 능력치의 결을 정합니다. 어떤 클래스도 선택할 수 있으며, 조합에 따라 효율만 달라집니다.';
    grid.innerHTML = RACES.map((race) => {
      const selected = app.draft.raceId === race.id;
      const mods = STAT_KEYS.filter((k) => race.mods[k]).map((k) => `${STAT_SHORT[k]} +${race.mods[k]}`).join(' · ');
      return `
        <button class="option-card${selected ? ' is-selected' : ''}" data-race="${race.id}" style="--card-color:${race.color};--card-glow:${race.color}22">
          ${selected ? '<span class="selected-mark">✓</span>' : ''}
          <div class="option-top">
            <span class="option-glyph">${race.glyph}</span>
            <span>
              <span class="option-name">${race.name}</span>
              <span class="option-english">${race.english}</span>
              <span class="option-role">${race.epithet}</span>
            </span>
          </div>
          <p class="option-desc">${race.desc}</p>
          <div class="option-tags"><span class="mini-tag gold">${mods}</span><span class="mini-tag teal">${race.trait.name}</span></div>
        </button>`;
    }).join('');
    if (!app.draft.raceId) {
      next.disabled = true;
      hint.textContent = '종족을 선택하세요.';
    }
  } else if (step === 1) {
    heading.textContent = '기본 클래스 선택';
    sub.textContent = '클래스는 전투에서의 역할과 사용할 수 있는 장비를 정합니다. 종족은 클래스 선택을 막지 않습니다.';
    grid.innerHTML = CLASSES.map((cls) => {
      const selected = app.draft.classId === cls.id;
      const stats = cls.keyStats.map((k) => STAT_LABELS[k]).join(' · ');
      return `
        <button class="option-card${selected ? ' is-selected' : ''}" data-class="${cls.id}" style="--card-color:${cls.color};--card-glow:${cls.color}22">
          ${selected ? '<span class="selected-mark">✓</span>' : ''}
          <div class="option-top">
            <span class="option-glyph">${cls.glyph}</span>
            <span>
              <span class="option-name">${cls.name}</span>
              <span class="option-english">${cls.english}</span>
              <span class="option-role">${cls.role}</span>
            </span>
          </div>
          <p class="option-desc">${cls.desc}</p>
          <div class="option-tags">
            <span class="mini-tag gold">${stats}</span>
            <span class="mini-tag">${cls.weapons.slice(0, 2).join(' / ')}</span>
            <span class="mini-tag">${cls.armor[0] || '갑옷 없음'}</span>
          </div>
        </button>`;
    }).join('');
    if (!app.draft.classId) {
      next.disabled = true;
      hint.textContent = '기본 클래스를 선택하세요.';
    }
  } else if (step === 2) {
    const cls = classById(app.draft.classId);
    heading.textContent = `${cls.name} · 전문 키트`;
    sub.textContent = '각 클래스는 세 개의 키트 슬롯을 가집니다. 이번 빌드에서는 대표 키트 하나만 개방되어 있습니다.';
    grid.innerHTML = cls.kits.map((kit) => {
      const selected = app.draft.kitId === kit.id;
      const locked = !kit.representative;
      return `
        <button class="option-card${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}" data-kit="${kit.id}" data-locked="${locked}" style="--card-color:${locked ? '#776d80' : cls.color};--card-glow:${locked ? '#776d8022' : cls.color + '22'}">
          ${selected ? '<span class="selected-mark">✓</span>' : ''}
          ${locked ? '<span class="lock-badge">SEALED</span>' : '<span class="lock-badge" style="color:var(--teal);border-color:rgba(121,224,192,.25)">REPRESENTATIVE</span>'}
          <div class="option-top">
            <span class="option-glyph">${locked ? '◇' : '◆'}</span>
            <span>
              <span class="option-name">${kit.name}</span>
              <span class="option-english">${kit.english || ''}</span>
              <span class="option-role">${kit.role}</span>
            </span>
          </div>
          <div class="option-tags">
            ${kit.pros.map((p) => `<span class="mini-tag teal">${p}</span>`).join('')}
            ${kit.cons.map((c) => `<span class="mini-tag" style="color:var(--rose);border-color:rgba(240,125,139,.25)">${c}</span>`).join('')}
          </div>
          <p class="option-desc">${kit.equipment}</p>
        </button>`;
    }).join('');
    if (!app.draft.kitId) {
      next.disabled = true;
      hint.textContent = '대표 키트를 선택하세요.';
    } else {
      hint.textContent = '대표 키트만 이번 원정에서 사용할 수 있습니다.';
    }
  } else if (step === 3) {
    heading.textContent = '능력치 확인';
    sub.textContent = '종족 · 클래스 · 키트가 합쳐진 최종 능력치입니다. 수치는 역할 효율을 바꾸지만 선택을 막지는 않습니다.';
    grid.innerHTML = '';
    extra.innerHTML = renderStatsStep();
    next.disabled = false;
  } else if (step === 4) {
    heading.textContent = '이름 결정';
    sub.textContent = '이 원정대에서 불릴 이름을 정하세요. 이름은 전투 로그와 파티 명부에 표시됩니다.';
    grid.innerHTML = '';
    const suggested = randomName(partyMembers().map((m) => m.name));
    extra.innerHTML = `
      <div class="name-form">
        <label for="char-name">CHARACTER NAME</label>
        <input id="char-name" class="name-input" maxlength="18" autocomplete="off" placeholder="${esc(suggested)}" value="${esc(app.draft.name || '')}">
        <p>비워 두면 제안된 이름을 사용합니다. 최대 18자.</p>
        <button class="btn btn-secondary" id="btn-random-name" type="button">이름 제안 받기</button>
      </div>`;
    const input = $('#char-name');
    if (input) {
      setTimeout(() => input.focus(), 30);
      input.addEventListener('input', () => {
        app.draft.name = input.value;
        next.disabled = false;
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          advanceCreation();
        }
      });
    }
    const randomButton = $('#btn-random-name');
    if (randomButton) {
      randomButton.addEventListener('click', () => {
        const name = randomName(partyMembers().map((m) => m.name));
        if (input) { input.value = name; app.draft.name = name; input.focus(); }
      });
    }
    hint.textContent = '이름을 입력하거나 제안을 사용하세요.';
  }

  renderCreationDetail();
}

function modChips(mods) {
  return STAT_KEYS.filter((k) => mods[k]).map((k) => `<span class="detail-chip gold">${STAT_LABELS[k]} +${mods[k]}</span>`).join('');
}

function statBars(stats, compare = null) {
  const max = Math.max(18, ...Object.values(stats), ...(compare ? Object.values(compare) : []));
  return `<div class="stat-block">${STAT_KEYS.map((key) => {
    const value = stats[key] || 0;
    const pct = clamp((value / max) * 100, 4, 100);
    const delta = compare ? value - (compare[key] || 0) : 0;
    return `<div class="stat-line">
      <span>${STAT_LABELS[key]}${delta ? ` <em style="color:${delta > 0 ? 'var(--teal)' : 'var(--rose)'};font-style:normal">${delta > 0 ? '+' : ''}${delta}</em>` : ''}</span>
      <div class="stat-track"><i class="${value >= 14 ? 'high' : ''}" style="width:${pct}%"></i></div>
      <b>${value}</b>
    </div>`;
  }).join('')}</div>`;
}

function derivedGrid(computed) {
  const d = computed.derived;
  return `<div class="derived-grid">
    <div class="derived-cell"><span>HP</span><b>${d.maxHp}</b></div>
    <div class="derived-cell"><span>AETHER</span><b>${d.maxAether}</b></div>
    <div class="derived-cell"><span>POWER</span><b>${d.power}</b></div>
    <div class="derived-cell"><span>SPELL</span><b>${d.spell}</b></div>
    <div class="derived-cell"><span>DEFENSE</span><b>${d.defense}</b></div>
    <div class="derived-cell"><span>SPEED</span><b>${d.speed}</b></div>
    <div class="derived-cell"><span>CRIT</span><b>${d.crit}%</b></div>
    <div class="derived-cell"><span>EVADE</span><b>${d.evade}%</b></div>
  </div>`;
}

function abilityBox(title, ability, tag = '') {
  if (!ability) return '';
  return `<div class="ability-box">
    <h4>${esc(ability.name)}${tag ? `<span>${tag}</span>` : ''}</h4>
    <p>${esc(ability.desc || '')}</p>
  </div>`;
}

function renderCreationDetail() {
  const host = $('#create-detail');
  if (!host || !app.draft) return;
  const race = app.draft.raceId ? raceById(app.draft.raceId) : null;
  const cls = app.draft.classId ? classById(app.draft.classId) : null;
  const kit = cls && app.draft.kitId ? cls.kits.find((k) => k.id === app.draft.kitId) : null;
  const computed = race && cls ? computeCharacter({
    raceId: race.id,
    classId: cls.id,
    kitId: kit?.id || representativeKit(cls.id).id,
    level: 1,
    growth: {}
  }) : null;

  if (app.step === 0) {
    if (!race) {
      host.innerHTML = `<div class="detail-head"><div><h3>혈통을 고르세요</h3><p>RACE</p></div></div>
        <div class="detail-section"><p class="detail-desc">12종족은 각각 고유한 능력치 보정과 특성을 가집니다. 종족은 클래스를 제한하지 않습니다.</p></div>`;
      return;
    }
    host.innerHTML = `
      <div class="detail-head">
        <span class="option-glyph" style="--card-color:${race.color};color:${race.color}">${race.glyph}</span>
        <div><h3>${race.name}</h3><p>${race.english} · ${race.epithet}</p></div>
      </div>
      <div class="detail-section"><div class="detail-label">설명</div><p class="detail-desc">${race.desc}</p></div>
      <div class="detail-section"><div class="detail-label">능력치 보정</div><div class="detail-chip-row">${modChips(race.mods)}</div></div>
      <div class="detail-section"><div class="detail-label">종족 특성</div>
        <div class="ability-box"><h4>${race.trait.name}</h4><p>${race.trait.desc}</p></div>
      </div>
      <div class="detail-section"><div class="detail-label">클래스 효율 메모</div><p class="detail-desc">${raceNote(race)}</p></div>`;
  } else if (app.step === 1) {
    if (!cls) {
      host.innerHTML = `<div class="detail-head"><div><h3>클래스를 고르세요</h3><p>BASE CLASS</p></div></div>
        <div class="detail-section"><p class="detail-desc">각 기본 클래스는 고유 능력과 장비 범주를 가집니다. 아래에서 역할 · 무기 · 방어구 · 주요 능력치 · 고유 능력을 비교하세요.</p></div>`;
      return;
    }
    host.innerHTML = `
      <div class="detail-head">
        <span class="option-glyph" style="--card-color:${cls.color};color:${cls.color}">${cls.glyph}</span>
        <div><h3>${cls.name}</h3><p>${cls.english} · ${cls.role}</p></div>
      </div>
      <div class="detail-section"><div class="detail-label">클래스 역할</div><p class="detail-desc">${cls.desc}</p></div>
      <div class="detail-section"><div class="detail-label">사용 가능한 무기 / 방어구</div>
        <div class="detail-chip-row">${cls.weapons.map((w) => `<span class="detail-chip">${w}</span>`).join('')}${cls.armor.map((a) => `<span class="detail-chip gold">${a}</span>`).join('') || '<span class="detail-chip bad">갑옷 없음</span>'}</div>
      </div>
      <div class="detail-section"><div class="detail-label">주요 능력치</div><div class="detail-chip-row">${cls.keyStats.map((k) => `<span class="detail-chip gold">${STAT_LABELS[k]}</span>`).join('')}</div></div>
      <div class="detail-section"><div class="detail-label">고유 능력</div>${abilityBox('CLASS ABILITY', cls.ability, `COST ${cls.ability.cost} · CD ${cls.ability.cooldown}`)}</div>
      <div class="detail-section"><div class="detail-label">전문 키트 슬롯</div>
        <p class="detail-desc">이 클래스에는 3개의 키트 데이터 슬롯이 있습니다. 이번 빌드에서는 <b style="color:var(--gold)">${representativeKit(cls.id).name}</b>만 개방됩니다.</p>
        <div class="detail-chip-row" style="margin-top:8px">${cls.kits.map((k) => `<span class="detail-chip ${k.representative ? 'gold' : ''}">${k.representative ? '◆' : '◇'} ${k.name}</span>`).join('')}</div>
      </div>
      ${computed ? `<div class="detail-section"><div class="detail-label">현재 종족 기준 예상 능력치</div>${statBars(computed.stats)}<div class="synergy-note">${raceClassNote(race, cls)}</div></div>` : ''}`;
  } else if (app.step === 2) {
    if (!cls || !kit) {
      host.innerHTML = `<div class="detail-head"><div><h3>키트를 고르세요</h3><p>SPECIALIST KIT</p></div></div>`;
      return;
    }
    host.innerHTML = `
      <div class="detail-head">
        <span class="option-glyph" style="--card-color:${cls.color};color:${cls.color}">◆</span>
        <div><h3>${kit.name}</h3><p>${kit.english || ''} · ${cls.name} 전용</p></div>
      </div>
      <div class="detail-section"><div class="detail-label">6대6 역할</div><p class="detail-desc">${kit.role}</p></div>
      <div class="detail-section"><div class="detail-label">장점 2</div><ul class="detail-list">${kit.pros.map((p) => `<li>${p}</li>`).join('')}</ul></div>
      <div class="detail-section"><div class="detail-label">단점 1+</div><ul class="detail-list cons">${kit.cons.map((c) => `<li>${c}</li>`).join('')}</ul></div>
      <div class="detail-section"><div class="detail-label">고유 능력</div>${abilityBox('KIT ABILITY', kit.ability, kit.ability.cost != null ? `COST ${kit.ability.cost} · CD ${kit.ability.cooldown}` : '')}</div>
      <div class="detail-section"><div class="detail-label">장비 / 무기 제한</div><p class="detail-desc">${kit.equipment}</p></div>
      <div class="detail-section"><div class="detail-label">키트 슬롯 3</div>
        <div class="detail-chip-row">${cls.kits.map((k) => `<span class="detail-chip ${k.representative ? 'gold' : ''}">${k.representative ? '◆' : '◇'} ${k.name}${k.representative ? '' : ' (미개방)'}</span>`).join('')}</div>
      </div>
      <div class="detail-section"><div class="detail-label">비교 메모</div><p class="detail-desc">${kitCompareNote(cls, kit)}</p></div>`;
  } else if (app.step === 3) {
    if (!computed) return;
    host.innerHTML = `
      <div class="detail-head">
        <span class="option-glyph" style="--card-color:${computed.cls.color};color:${computed.cls.color}">${computed.cls.glyph}</span>
        <div><h3>${computed.race.name} · ${computed.cls.name}</h3><p>${computed.kit.name}</p></div>
      </div>
      <div class="detail-section"><div class="detail-label">최종 능력치</div>${statBars(computed.stats)}</div>
      <div class="detail-section"><div class="detail-label">파생 전투 수치</div>${derivedGrid(computed)}</div>
      <div class="detail-section"><div class="detail-label">역할 / 장비</div>
        <div class="detail-chip-row"><span class="detail-chip gold">${computed.cls.role}</span><span class="detail-chip">${computed.equipment.weapon}</span><span class="detail-chip">${computed.equipment.armor}</span></div>
      </div>
      <div class="detail-section"><div class="detail-label">종족 특성</div><p class="detail-desc"><b style="color:var(--gold)">${computed.race.trait.name}</b> — ${computed.race.trait.desc}</p></div>
      <div class="detail-section"><div class="detail-label">클래스 능력</div>${abilityBox('CLASS', computed.cls.ability)}</div>
      <div class="detail-section"><div class="detail-label">키트 능력</div>${abilityBox('KIT', computed.kit.ability)}</div>
      <div class="detail-section"><div class="detail-label">키트 장점 / 단점</div>
        <div class="detail-chip-row">${computed.kit.pros.map((p) => `<span class="detail-chip good">+ ${p}</span>`).join('')}${computed.kit.cons.map((c) => `<span class="detail-chip bad">− ${c}</span>`).join('')}</div>
        <div class="synergy-note">${kitCompareNote(computed.cls, computed.kit)}</div>
      </div>`;
  } else if (app.step === 4) {
    if (!computed) return;
    host.innerHTML = `
      <div class="detail-head">
        <span class="option-glyph" style="--card-color:${computed.cls.color};color:${computed.cls.color}">${computed.cls.glyph}</span>
        <div><h3>${esc(app.draft.name || '이름 미정')}</h3><p>${computed.race.name} · ${computed.cls.name} · ${computed.kit.name}</p></div>
      </div>
      <div class="detail-section"><div class="detail-label">최종 확인</div><p class="detail-desc">이름을 확정하면 ${app.editingSlot + 1}번 슬롯에 배치됩니다. 이후 파티 화면에서 전열·중열·후열을 조정할 수 있습니다.</p></div>
      <div class="detail-section"><div class="detail-label">능력치</div>${statBars(computed.stats)}</div>
      <div class="detail-section"><div class="detail-label">파생 전투 수치</div>${derivedGrid(computed)}</div>`;
  }
}

function raceNote(race) {
  const notes = {
    emberkin: '근력 기반 클래스와 잘 맞고, 저체력에서 폭발적인 화력을 냅니다.',
    sylvan: '민첩 기반 원거리·암살 클래스의 회피와 선공을 끌어올립니다.',
    stoneborn: '전열 탱커와 근접 딜러가 받는 피해를 줄이는 데 적합합니다.',
    tidecaller: '정신·지력 기반 치유와 마법 클래스의 유지력을 높입니다.',
    ashwing: '속도와 치명타가 필요한 원거리·기동형 클래스에 유리합니다.',
    duskling: '첫 공격을 흘려보내므로 유리한 턴을 만드는 암살·교란에 어울립니다.',
    runeblood: '에테르 소모가 큰 마법·혼합 클래스의 운용을 편하게 만듭니다.',
    ironhide: '생명력이 중요한 탱커·근접 클래스에서 안정성이 높습니다.',
    sunfolk: '치유와 지원 클래스의 회복량을 크게 끌어올립니다.',
    graveborn: '한 번의 치명타를 버티므로 전열 유지력이 좋아집니다.',
    mistwalker: '회피와 디버프 저항으로 지원·교란 클래스가 안정적으로 행동합니다.',
    forgeborn: '방어력과 근력이 필요한 전열 클래스에 잘 맞습니다.'
  };
  return notes[race.id] || '';
}

function raceClassNote(race, cls) {
  if (!race || !cls) return '';
  const computed = computeCharacter({ raceId: race.id, classId: cls.id, kitId: representativeKit(cls.id).id, level: 1, growth: {} });
  const best = [...STAT_KEYS].sort((a, b) => computed.stats[b] - computed.stats[a])[0];
  return `${race.name}의 보정이 더해져 ${STAT_LABELS[best]}이(가) 가장 높습니다. ${race.trait.name} 특성은 ${cls.role} 역할에서 ${race.id === 'sunfolk' && cls.id === 'cleric' ? '특히 강력합니다.' : '나름의 효율을 냅니다.'}`;
}

function kitCompareNote(cls, kit) {
  return `${cls.name}의 기본 능력은 ${cls.ability.name}, 키트 능력은 ${kit.ability.name}입니다. 키트는 ${kit.role} 역할에 특화되며, 장비 제한으로 인해 기본 클래스보다 선택 폭이 좁아집니다.`;
}

function renderStatsStep() {
  const race = raceById(app.draft.raceId);
  const cls = classById(app.draft.classId);
  const kit = cls.kits.find((k) => k.id === app.draft.kitId) || representativeKit(cls.id);
  const computed = computeCharacter({ raceId: race.id, classId: cls.id, kitId: kit.id, level: 1, growth: {} });
  return `<div class="detail-chip-row" style="margin-bottom:14px">
      <span class="detail-chip gold">${race.name}</span><span class="detail-chip gold">${cls.name}</span><span class="detail-chip gold">${kit.name}</span>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px" class="stats-step-grid">
      <div>${statBars(computed.stats)}</div>
      <div>${derivedGrid(computed)}</div>
    </div>
    <div class="synergy-note" style="margin-top:14px">${race.trait.name}: ${race.trait.desc} · ${cls.ability.name}: ${cls.ability.desc}</div>`;
}

function advanceCreation() {
  if (!app.draft) return;
  if (app.step === 0) {
    if (!app.draft.raceId) return;
    app.step = 1;
  } else if (app.step === 1) {
    if (!app.draft.classId) return;
    if (!app.draft.kitId) app.draft.kitId = representativeKit(app.draft.classId).id;
    app.step = 2;
  } else if (app.step === 2) {
    if (!app.draft.kitId) return;
    app.step = 3;
  } else if (app.step === 3) {
    app.step = 4;
  } else if (app.step === 4) {
    finalizeCharacter();
    return;
  }
  renderCreation();
}

function finalizeCharacter() {
  const race = raceById(app.draft.raceId);
  const cls = classById(app.draft.classId);
  const kit = cls.kits.find((k) => k.id === app.draft.kitId) || representativeKit(cls.id);
  const usedNames = partyMembers().map((m) => m.name);
  let name = sanitizeName(app.draft.name);
  if (!name) name = randomName(usedNames);
  const character = createCharacter({
    name,
    raceId: race.id,
    classId: cls.id,
    kitId: kit.id,
    level: 1
  });
  const slot = app.editingSlot;
  app.party[slot] = character;
  app.draft = null;
  app.selectedSlot = slot;
  persist();
  audioPlay('rank');
  showScreen('party');
  renderParty();
  toast(`<b>${esc(character.name)}</b>이(가) 원정대에 합류했습니다.`);
}

// ---------------------------------------------------------------------------
// Party formation
// ---------------------------------------------------------------------------

const ROW_INFO = [
  { label: '전열', short: '전', cls: 'front' },
  { label: '중열', short: '중', cls: 'mid' },
  { label: '후열', short: '후', cls: 'back' }
];

function slotIndexRow(index) {
  return Math.floor(index / 2);
}

function renderParty() {
  const count = partyMembers().length;
  $('#party-count').textContent = `${count} / 6`;
  const begin = $('#btn-begin');
  begin.disabled = count < 6;
  begin.textContent = count < 6 ? `던전 진입 · ${count}/6` : '던전 진입';

  if (app.selectedSlot != null && !app.party[app.selectedSlot]) app.selectedSlot = null;
  if (app.selectedSlot == null) {
    const first = app.party.findIndex(Boolean);
    if (first >= 0) app.selectedSlot = first;
  }

  const board = $('#formation-board');
  board.innerHTML = ROW_INFO.map((row, rowIndex) => {
    const slots = [rowIndex * 2, rowIndex * 2 + 1].map((index) => slotCard(app.party[index], index, row, rowIndex)).join('');
    return `<div class="formation-row">
      <div class="formation-row-label"><b>${row.label}</b><span>${row.cls.toUpperCase()}</span></div>
      ${slots}
    </div>`;
  }).join('');

  const roster = $('#party-roster');
  const members = app.party.map((member, index) => member ? { member, index } : null).filter(Boolean);
  roster.innerHTML = members.length ? members.map(({ member, index }) => {
    const c = computeCharacter(member);
    return `<button class="roster-card${app.selectedSlot === index ? ' is-selected' : ''}" data-roster-slot="${index}" style="--card-color:${c.cls.color}">
      <span class="slot-avatar">${c.cls.glyph}</span>
      <div><h4>${esc(member.name)}</h4><p>Lv.${member.level} ${c.race.name} · ${c.cls.name}</p></div>
      <span class="roster-slot">${ROW_INFO[slotIndexRow(index)].short}${index % 2 + 1}</span>
    </button>`;
  }).join('') : '<p style="color:var(--muted-2);font-size:.66rem;line-height:1.6">아직 대원이 없습니다. 빈 슬롯을 눌러 첫 대원을 모집하세요.</p>';

  renderPartyDetail();
}

function slotCard(member, index, row) {
  if (!member) {
    return `<button class="slot is-empty" data-slot="${index}">
      <span class="slot-plus">＋</span>
      <span class="slot-empty-label">${row.label} 슬롯</span>
      <span class="slot-row-badge">${row.short}</span>
    </button>`;
  }
  const c = computeCharacter(member);
  const hpPct = clamp((member.hp / c.derived.maxHp) * 100, 0, 100);
  const apPct = clamp((member.aether / c.derived.maxAether) * 100, 0, 100);
  return `<button class="slot${app.selectedSlot === index ? ' is-selected' : ''}" data-slot="${index}" style="--card-color:${c.cls.color}">
    <span class="slot-row-badge">${row.short}</span>
    <div class="slot-char">
      <span class="slot-avatar">${c.cls.glyph}</span>
      <div>
        <h4>${esc(member.name)}</h4>
        <p>Lv.${member.level} ${c.race.name} · ${c.cls.name}</p>
        <p class="slot-kit">${c.kit.name}</p>
      </div>
    </div>
    <div class="slot-stats">
      <div class="mini-bar"><i style="width:${hpPct}%"></i></div>
      <div class="slot-hp-text"><span>HP ${member.hp}/${c.derived.maxHp}</span><span>${Math.round(hpPct)}%</span></div>
      <div class="mini-bar aether"><i style="width:${apPct}%"></i></div>
    </div>
  </button>`;
}

function renderPartyDetail() {
  const host = $('#party-detail');
  if (!host) return;
  const index = app.selectedSlot;
  const member = index != null ? app.party[index] : null;
  if (!member) {
    host.innerHTML = `<p style="color:var(--muted-2);font-size:.66rem;line-height:1.7">대원을 선택하면 종족 · 클래스 · 키트 · 능력치 · 장비 제한을 확인할 수 있습니다.</p>`;
    return;
  }
  const c = computeCharacter(member);
  const xp = xpNeeded(member.level);
  host.innerHTML = `
    <div class="detail-head">
      <span class="option-glyph" style="--card-color:${c.cls.color};color:${c.cls.color}">${c.cls.glyph}</span>
      <div><h3>${esc(member.name)}</h3><p>${c.race.name} · ${c.cls.name} · ${c.kit.name}</p></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">레벨 / 경험치 <b>Lv.${member.level}</b></div>
      <div class="stat-track"><i style="width:${clamp((member.xp / xp) * 100, 0, 100)}%"></i></div>
      <p class="detail-desc" style="margin-top:5px">${member.xp} / ${xp} XP · ${ROW_INFO[slotIndexRow(index)].label}</p>
    </div>
    <div class="detail-section"><div class="detail-label">능력치</div>${statBars(c.stats)}</div>
    <div class="detail-section"><div class="detail-label">파생 전투 수치</div>${derivedGrid(c)}</div>
    <div class="detail-section"><div class="detail-label">장비 / 제한</div>
      <div class="detail-chip-row"><span class="detail-chip">${c.equipment.weapon}</span><span class="detail-chip">${c.equipment.armor}</span></div>
      <p class="detail-desc" style="margin-top:6px">${c.kit.equipment}</p>
    </div>
    <div class="detail-section"><div class="detail-label">고유 능력</div>
      ${abilityBox('CLASS', c.cls.ability)}
      ${abilityBox('KIT', c.kit.ability)}
    </div>
    <div class="detail-section"><div class="detail-label">키트 장점 / 단점</div>
      <div class="detail-chip-row">${c.kit.pros.map((p) => `<span class="detail-chip good">+ ${p}</span>`).join('')}${c.kit.cons.map((x) => `<span class="detail-chip bad">− ${x}</span>`).join('')}</div>
    </div>
    <div class="detail-section"><div class="detail-label">종족 특성</div><p class="detail-desc"><b style="color:var(--gold)">${c.race.trait.name}</b> — ${c.race.trait.desc}</p></div>
    <div class="detail-section"><button class="btn btn-ghost" data-remove-slot="${index}" style="color:var(--rose)">대원 해산</button></div>`;
}

function handleSlotClick(index) {
  const member = app.party[index];
  if (app.selectedSlot == null) {
    if (member) {
      app.selectedSlot = index;
      renderParty();
    } else {
      startCreation(index);
    }
    return;
  }
  if (app.selectedSlot === index) {
    app.selectedSlot = null;
    renderParty();
    return;
  }
  const selected = app.party[app.selectedSlot];
  if (!selected) {
    app.selectedSlot = member ? index : null;
    renderParty();
    return;
  }
  if (!member) {
    app.party[index] = selected;
    app.party[app.selectedSlot] = null;
    app.selectedSlot = index;
  } else {
    app.party[index] = selected;
    app.party[app.selectedSlot] = member;
    app.selectedSlot = index;
  }
  persist();
  renderParty();
}

function autoMuster() {
  const usedNames = partyMembers().map((m) => m.name);
  const usedClasses = partyMembers().map((m) => m.classId);
  for (let i = 0; i < 6; i += 1) {
    if (app.party[i]) continue;
    const member = randomCharacter(1, usedNames, usedClasses);
    restoreCharacter(member);
    app.party[i] = member;
    usedNames.push(member.name);
    usedClasses.push(member.classId);
  }
  persist();
  renderParty();
  audioPlay('rank');
  toast('남은 슬롯을 용병으로 채웠습니다. 배치는 클릭으로 조정할 수 있습니다.');
}

function beginFromParty() {
  if (partyMembers().length < 6) {
    toast('6대6 전투를 위해 6명의 대원이 필요합니다. <b>용병으로 채우기</b>를 사용할 수 있습니다.');
    return;
  }
  if (app.run) resumeRun();
  else beginRun();
}

// ---------------------------------------------------------------------------
// Dungeon run
// ---------------------------------------------------------------------------

function beginRun() {
  app.run = {
    floor: 1,
    seed: Math.floor(Math.random() * 1e9),
    gold: 0,
    potions: 2,
    ethers: 1,
    pos: null,
    cleared: [],
    opened: [],
    used: [],
    startedAt: Date.now()
  };
  app.party = app.party.map((member) => member ? restoreCharacter(member) : null);
  loadFloor(1, app.run.seed, true);
  persist();
}

function resumeRun() {
  if (!app.run || !hasParty()) return;
  loadFloor(app.run.floor, app.run.seed, false);
}

function loadFloor(floor, seed, isNewFloor = false) {
  const dungeon = generateDungeon(floor, seed);
  const run = app.run;
  const cleared = new Set(run.cleared || []);
  const opened = new Set(run.opened || []);
  const used = new Set(run.used || []);
  for (const encounter of dungeon.encounters) encounter.cleared = cleared.has(encounter.id);
  for (const chest of dungeon.chests) chest.opened = opened.has(chest.id);
  for (const shrine of dungeon.shrines) shrine.used = used.has(shrine.id);

  let pos = run.pos ? { ...run.pos } : { ...dungeon.start };
  if (!isWalkable(dungeon, pos.x, pos.y)) pos = { ...dungeon.start };
  run.pos = { ...pos };
  app.dungeon = dungeon;
  app.view = { visible: new Set(), explored: new Set(), camX: null, camY: null };
  revealAround(dungeon, pos, 4, app.view.visible, app.view.explored);
  app.currentEncounter = null;
  app.battle = null;
  app.battleState = null;
  showScreen('dungeon');
  renderDungeonHud();
  syncRunFromDungeon();
  persist();
}

function syncRunFromDungeon() {
  if (!app.run || !app.dungeon) return;
  app.run.cleared = app.dungeon.encounters.filter((e) => e.cleared).map((e) => e.id);
  app.run.opened = app.dungeon.chests.filter((c) => c.opened).map((c) => c.id);
  app.run.used = app.dungeon.shrines.filter((s) => s.used).map((s) => s.id);
}

function renderDungeonHud() {
  if (!app.dungeon || !app.run) return;
  const floor = floorData(app.run.floor);
  $('#dungeon-floor-kicker').textContent = `FLOOR ${String(app.run.floor).padStart(2, '0')} · ${floor.english.toUpperCase()}`;
  $('#dungeon-floor-name').textContent = floor.name;
  $('#dungeon-floor-desc').textContent = floor.desc;
  const total = app.dungeon.encounters.length;
  const cleared = app.dungeon.encounters.filter((e) => e.cleared).length;
  const remaining = total - cleared;
  $('#dungeon-objective').textContent = remaining > 0 ? `조우 ${cleared} / ${total}` : '계단 개방';
  $('#dungeon-gold').textContent = app.run.gold;
  $('#dungeon-potions').textContent = app.run.potions;
  $('#minimap-label').textContent = `FLOOR ${app.run.floor}`;
  renderPartyBar();
}

function renderPartyBar() {
  const host = $('#party-bar');
  if (!host) return;
  host.innerHTML = app.party.map((member, index) => {
    if (!member) {
      return `<div class="party-chip is-down"><span class="slot-avatar">·</span><div class="party-chip-info"><h4>빈 슬롯</h4><p>${ROW_INFO[slotIndexRow(index)].short}${index % 2 + 1}</p></div></div>`;
    }
    const c = computeCharacter(member);
    const hpPct = clamp((member.hp / c.derived.maxHp) * 100, 0, 100);
    return `<div class="party-chip${member.hp <= 0 ? ' is-down' : ''}" style="--card-color:${c.cls.color}">
      <span class="slot-avatar">${c.cls.glyph}</span>
      <div class="party-chip-info">
        <h4>${esc(member.name)}</h4>
        <p>Lv.${member.level} ${c.cls.name}</p>
        <div class="mini-bar"><i style="width:${hpPct}%"></i></div>
      </div>
    </div>`;
  }).join('');
}

function tryMove(dx, dy) {
  if (app.mode !== 'dungeon' || !app.dungeon || app.overlayOpen || app.battle) return;
  const now = performance.now();
  if (now - app.lastMove < 110) return;
  const dungeon = app.dungeon;
  const run = app.run;
  if (!run) return;
  const nx = run.pos.x + dx;
  const ny = run.pos.y + dy;
  if (!isWalkable(dungeon, nx, ny)) {
    app.lastMove = now;
    return;
  }
  app.lastMove = now;
  run.pos = { x: nx, y: ny };
  revealAround(dungeon, run.pos, 4, app.view.visible, app.view.explored);
  syncRunFromDungeon();
  persist();
  const entity = entityAt(dungeon, nx, ny);
  if (entity) {
    if (entity.type === 'encounter') {
      startEncounter(entity);
      return;
    }
    if (entity.type === 'chest') {
      openChest(entity);
      return;
    }
    if (entity.type === 'shrine') {
      useShrine(entity);
      return;
    }
  }
  if (dungeon.stairs.x === nx && dungeon.stairs.y === ny) {
    const remaining = dungeon.encounters.filter((e) => !e.cleared).length;
    if (remaining === 0) dungeonToast('계단이 열렸습니다. <b>E</b>로 내려가세요.');
    else dungeonToast(`아직 조우가 <b>${remaining}</b>개 남았습니다.`);
  }
  renderDungeonHud();
}

function openChest(chest) {
  if (chest.opened) return;
  chest.opened = true;
  const gold = 18 + app.run.floor * 7 + Math.floor(Math.random() * 16);
  app.run.gold += gold;
  let extra = '';
  if (Math.random() < 0.42) { app.run.potions += 1; extra += ' · 회복약 +1'; }
  if (Math.random() < 0.2) { app.run.ethers += 1; extra += ' · 에테르약 +1'; }
  audioPlay('chest');
  dungeonToast(`보물 상자 · <b>${gold}</b> 금화${extra}`);
  syncRunFromDungeon();
  renderDungeonHud();
  persist();
}

function useShrine(shrine) {
  if (shrine.used) return;
  shrine.used = true;
  app.party = app.party.map((member) => {
    if (!member) return null;
    const c = computeCharacter(member);
    member.hp = Math.min(c.derived.maxHp, member.hp + Math.round(c.derived.maxHp * 0.35));
    member.aether = Math.min(c.derived.maxAether, member.aether + Math.round(c.derived.maxAether * 0.35));
    return member;
  });
  audioPlay('shrine');
  dungeonToast('성소의 빛이 원정대의 상처를 <b>35%</b> 회복시켰습니다.');
  syncRunFromDungeon();
  renderDungeonHud();
  persist();
}

function interact() {
  if (app.mode !== 'dungeon' || !app.dungeon || app.overlayOpen || app.battle) return;
  const run = app.run;
  const dungeon = app.dungeon;
  const entity = entityAt(dungeon, run.pos.x, run.pos.y);
  if (entity) {
    if (entity.type === 'encounter') startEncounter(entity);
    else if (entity.type === 'chest') openChest(entity);
    else if (entity.type === 'shrine') useShrine(entity);
    return;
  }
  if (dungeon.stairs.x === run.pos.x && dungeon.stairs.y === run.pos.y) {
    const remaining = dungeon.encounters.filter((e) => !e.cleared).length;
    if (remaining > 0) {
      dungeonToast(`계단이 봉인되어 있습니다. 남은 조우 <b>${remaining}</b>개.`);
      return;
    }
    showDescendOverlay();
    return;
  }
  dungeonToast('주변에 상호작용할 대상이 없습니다.');
}

function startEncounter(encounter) {
  if (app.battle || app.currentEncounter || app.overlayOpen) return;
  app.currentEncounter = encounter;
  audioPlay(encounter.encounterType === 'boss' ? 'boss' : 'lance');
  app.battle = new Battle({
    party: partyMembers(),
    floor: app.run.floor,
    encounter,
    items: { potions: app.run.potions, ethers: app.run.ethers },
    callbacks: {
      onUpdate: renderBattle,
      onLog: renderBattleLog,
      onFx: battleFx,
      onEnd: handleBattleEnd,
      onItemsChange: (items) => {
        app.run.potions = items.potions;
        app.run.ethers = items.ethers;
      }
    }
  });
  showScreen('battle');
  mountBattleUnits();
  renderBattle();
  app.battle.start();
}

function returnToDungeon() {
  app.battle = null;
  app.battleState = null;
  app.currentEncounter = null;
  showScreen('dungeon');
  renderDungeonHud();
  persist();
}

function syncPartyFromBattle() {
  if (!app.battle) return;
  for (const unit of app.battle.units) {
    if (unit.side !== 'ally' || !unit.character) continue;
    unit.character.hp = Math.max(0, Math.round(unit.hp));
    unit.character.aether = Math.max(0, Math.round(unit.aether));
  }
}

function handleBattleEnd(result) {
  if (!app.battle) return;
  syncPartyFromBattle();
  const encounter = app.currentEncounter;
  if (result.result === 'victory') {
    if (encounter) encounter.cleared = true;
    app.run.gold += result.gold;
    app.run.potions += result.potions;
    app.run.ethers += result.ethers;
    const levelUps = [];
    for (const member of partyMembers()) {
      const before = member.level;
      const gained = grantXp(member, result.xp);
      const c = computeCharacter(member);
      if (member.hp <= 0) member.hp = Math.max(1, Math.round(c.derived.maxHp * 0.25));
      else member.hp = Math.min(c.derived.maxHp, member.hp + Math.round(c.derived.maxHp * 0.12));
      member.aether = Math.min(c.derived.maxAether, member.aether + Math.round(c.derived.maxAether * 0.2));
      if (gained > 0) levelUps.push({ name: member.name, from: before, to: member.level });
    }
    syncRunFromDungeon();
    persist();
    renderDungeonHud();
    const bossText = result.boss ? ' · 수호자 격파' : '';
    openOverlay(`
      <div class="result-banner"><div class="result-glyph">✦</div><h2>전투 승리</h2><p>${app.run.floor}층의 조우를 정리했습니다${bossText}.</p></div>
      <div class="reward-grid">
        <div class="reward-cell"><span>XP</span><b>+${result.xp}</b></div>
        <div class="reward-cell"><span>GOLD</span><b>+${result.gold}</b></div>
        <div class="reward-cell"><span>POTION</span><b>+${result.potions}</b></div>
        <div class="reward-cell"><span>ETHER</span><b>+${result.ethers}</b></div>
      </div>
      ${levelUps.length ? `<div class="level-up-list">${levelUps.map((l) => `<div class="level-up-row"><span>${esc(l.name)}</span><b>Lv.${l.from} → Lv.${l.to}</b></div>`).join('')}</div>` : ''}
      <div class="overlay-actions">
        <button class="btn btn-primary" id="btn-victory-continue">${result.boss && app.run.floor === 5 ? '왕관의 심장 보기' : '던전으로 돌아가기'}</button>
      </div>
    `, { closable: false });
    audioPlay('victory');
    const continueButton = $('#btn-victory-continue');
    if (continueButton) {
      continueButton.addEventListener('click', () => {
        closeOverlay();
        if (result.boss && app.run.floor === 5) showCampaignVictory();
        else returnToDungeon();
      });
    }
  } else {
    syncRunFromDungeon();
    persist();
    openOverlay(`
      <div class="result-banner"><div class="result-glyph" style="color:var(--rose)">☠</div><h2>원정대 전멸</h2><p>${app.run.floor}층에서 원정대가 쓰러졌습니다.</p></div>
      <p style="color:var(--muted);font-size:.76rem;line-height:1.7">다시 싸우면 원정대가 생명력 60%로 복구되어 같은 조우에 도전합니다. 포기하면 원정 기록이 사라지고 파티 화면으로 돌아갑니다.</p>
      <div class="overlay-actions">
        <button class="btn btn-secondary" id="btn-defeat-abandon">원정 포기</button>
        <button class="btn btn-primary" id="btn-defeat-retry">다시 싸우기</button>
      </div>
    `, { closable: false });
    audioPlay('death');
    $('#btn-defeat-retry')?.addEventListener('click', () => {
      closeOverlay();
      for (const member of partyMembers()) {
        const c = computeCharacter(member);
        member.hp = Math.max(1, Math.round(c.derived.maxHp * 0.6));
        member.aether = Math.max(1, Math.round(c.derived.maxAether * 0.6));
      }
      const retryEncounter = app.currentEncounter;
      app.battle = null;
      app.currentEncounter = null;
      persist();
      if (retryEncounter) startEncounter(retryEncounter);
    });
    $('#btn-defeat-abandon')?.addEventListener('click', () => {
      closeOverlay();
      app.run = null;
      app.battle = null;
      app.currentEncounter = null;
      for (const member of partyMembers()) {
        const c = computeCharacter(member);
        member.hp = Math.max(1, Math.round(c.derived.maxHp * 0.5));
        member.aether = Math.max(1, Math.round(c.derived.maxAether * 0.5));
      }
      persist();
      showScreen('party');
      renderParty();
    });
  }
}

function showDescendOverlay() {
  if (!app.run) return;
  const nextFloor = app.run.floor + 1;
  const data = floorData(nextFloor);
  openOverlay(`
    <div class="floor-card">
      <p class="eyebrow">THE STAIRS OPEN</p>
      <div class="floor-number">${String(nextFloor).padStart(2, '0')}</div>
      <div class="floor-name">${data.name}</div>
      <p class="floor-desc">${data.desc}</p>
    </div>
    <p style="text-align:center;margin-top:14px;color:var(--muted-2);font-size:.66rem">원정대의 상처가 20% 회복되고 새 층으로 내려갑니다.</p>
    <div class="overlay-actions">
      <button class="btn btn-ghost" id="btn-descend-cancel">아직 머문다</button>
      <button class="btn btn-primary" id="btn-descend">${nextFloor}층으로 내려가기</button>
    </div>
  `);
  $('#btn-descend-cancel')?.addEventListener('click', closeOverlay);
  $('#btn-descend')?.addEventListener('click', () => {
    closeOverlay();
    for (const member of partyMembers()) {
      const c = computeCharacter(member);
      if (member.hp <= 0) member.hp = Math.max(1, Math.round(c.derived.maxHp * 0.25));
      else member.hp = Math.min(c.derived.maxHp, member.hp + Math.round(c.derived.maxHp * 0.2));
      member.aether = Math.min(c.derived.maxAether, member.aether + Math.round(c.derived.maxAether * 0.2));
    }
    app.run.floor = nextFloor;
    app.run.seed = Math.floor(Math.random() * 1e9);
    app.run.pos = null;
    app.run.cleared = [];
    app.run.opened = [];
    app.run.used = [];
    loadFloor(nextFloor, app.run.seed, true);
    dungeonToast(`<b>${data.name}</b>에 도착했습니다.`);
  });
}

function showCampaignVictory() {
  openOverlay(`
    <div class="result-banner">
      <div class="result-glyph">♛</div>
      <p class="eyebrow">THE HOLLOW CROWN IS SILENT</p>
      <h2>왕관은 부서졌다</h2>
      <p>공허의 왕관이 마지막 칙령을 내리고 무너졌습니다. 탑은 잠시 숨을 고르지만, 계단은 여전히 아래로 이어져 있습니다.</p>
    </div>
    <div class="reward-grid">
      <div class="reward-cell"><span>FLOOR</span><b>5</b></div>
      <div class="reward-cell"><span>WARBAND</span><b>${partyMembers().length}/6</b></div>
      <div class="reward-cell"><span>GOLD</span><b>${app.run.gold}</b></div>
    </div>
    <div class="overlay-actions">
      <button class="btn btn-secondary" id="btn-campaign-rest">원정대 해산</button>
      <button class="btn btn-primary" id="btn-campaign-continue">계속 내려가기</button>
    </div>
  `, { closable: false });
  audioPlay('rank');
  $('#btn-campaign-continue')?.addEventListener('click', () => {
    closeOverlay();
    app.run.floor = 6;
    app.run.seed = Math.floor(Math.random() * 1e9);
    app.run.pos = null;
    app.run.cleared = [];
    app.run.opened = [];
    app.run.used = [];
    loadFloor(6, app.run.seed, true);
    dungeonToast('왕관 아래의 끝없는 계단. 원정은 계속됩니다.');
  });
  $('#btn-campaign-rest')?.addEventListener('click', () => {
    closeOverlay();
    app.run = null;
    persist();
    showScreen('party');
    renderParty();
  });
}

function abandonRun() {
  openOverlay(`
    <p class="eyebrow">ABANDON DESCENT</p>
    <h2>원정을 포기할까요?</h2>
    <p>현재 층의 진행과 보상은 사라지지만, 원정대 명부는 유지됩니다. 파티 화면에서 다시 원정을 시작할 수 있습니다.</p>
    <div class="overlay-actions">
      <button class="btn btn-ghost" id="btn-abandon-cancel">계속 탐험</button>
      <button class="btn btn-primary" id="btn-abandon-confirm">원정 포기</button>
    </div>
  `);
  $('#btn-abandon-cancel')?.addEventListener('click', closeOverlay);
  $('#btn-abandon-confirm')?.addEventListener('click', () => {
    closeOverlay();
    app.run = null;
    app.battle = null;
    app.currentEncounter = null;
    for (const member of partyMembers()) {
      const c = computeCharacter(member);
      member.hp = Math.max(1, Math.round(c.derived.maxHp * 0.5));
      member.aether = Math.max(1, Math.round(c.derived.maxAether * 0.5));
    }
    persist();
    showScreen('party');
    renderParty();
  });
}

// ---------------------------------------------------------------------------
// Battle UI
// ---------------------------------------------------------------------------

function mountBattleUnits() {
  if (!app.battle) return;
  const allyHost = $('#ally-units');
  const enemyHost = $('#enemy-units');
  allyHost.innerHTML = app.battle.units.filter((u) => u.side === 'ally').map(unitCardHTML).join('');
  enemyHost.innerHTML = app.battle.units.filter((u) => u.side === 'enemy').map(unitCardHTML).join('');
}

function unitCardHTML(unit) {
  const rowShort = unit.row === 'front' ? '전' : unit.row === 'mid' ? '중' : '후';
  const meta = unit.side === 'ally' ? `${unit.raceName} · ${unit.className}` : unit.className;
  return `<div class="unit ${unit.side === 'ally' ? 'is-ally' : 'is-enemy'}" data-uid="${unit.uid}" style="--unit-color:${unit.color};--unit-glow:${unit.color}22">
    <div class="unit-avatar">${unit.glyph}<span class="unit-row ${unit.row}">${rowShort}</span></div>
    <div class="unit-body">
      <div class="unit-name">${unit.boss ? '<span class="boss-mark">♛</span>' : ''}${esc(unit.name)}</div>
      <div class="unit-meta">Lv.${unit.level} ${meta}</div>
      <div class="unit-bars">
        <div class="unit-bar"><i data-hp style="width:100%"></i></div>
        <div class="unit-bar aether"><i data-aether style="width:100%"></i></div>
      </div>
      <div class="unit-statuses"></div>
    </div>
  </div>`;
}

function renderBattleUnits(state) {
  for (const unit of state.units) {
    const card = $(`.unit[data-uid="${unit.uid}"]`);
    if (!card) continue;
    card.classList.toggle('is-active', state.activeUid === unit.uid);
    card.classList.toggle('is-dead', !unit.alive);
    card.classList.toggle('is-targetable', state.validTargets.includes(unit.uid));
    const hp = $('[data-hp]', card);
    const aether = $('[data-aether]', card);
    if (hp) hp.style.width = `${clamp((unit.hp / unit.maxHp) * 100, 0, 100)}%`;
    if (aether) aether.style.width = `${clamp((unit.aether / unit.maxAether) * 100, 0, 100)}%`;
    const statusHost = $('.unit-statuses', card);
    if (statusHost) {
      statusHost.innerHTML = unit.statuses.map((status) => {
        const def = STATUSES[status.id] || { name: status.id, glyph: '·', type: 'debuff' };
        const type = def.type === 'buff' || def.type === 'hot' ? 'buff' : def.type === 'control' ? 'control' : 'debuff';
        return `<span class="status-chip ${type}" title="${esc(def.name)} ${status.turns}턴">${def.glyph}${status.turns}</span>`;
      }).join('');
    }
  }
}

function renderBattle() {
  if (!app.battle) return;
  const state = app.battle.getState();
  app.battleState = state;
  $('#battle-round').textContent = state.round;
  const order = [...(state.activeUid ? [state.activeUid] : []), ...state.queue].slice(0, 12);
  $('#turn-order').innerHTML = order.map((uid) => {
    const unit = app.battle.getUnit(uid);
    if (!unit) return '';
    return `<span class="turn-token ${unit.side === 'ally' ? 'is-ally' : 'is-enemy'}${state.activeUid === uid ? ' is-current' : ''}${!unit.alive ? ' is-dead' : ''}" title="${esc(unit.name)}">${unit.glyph}</span>`;
  }).join('');
  $('#battle-message').innerHTML = state.message;
  renderBattleUnits(state);
  renderActiveCard(state);
  renderActionPanel(state);
  renderBattleLog();
  const banner = $('#round-banner');
  if (banner) banner.textContent = `ROUND ${state.round}`;
}

function renderActiveCard(state) {
  const host = $('#active-card');
  if (!host) return;
  const unit = app.battle?.getUnit(state.activeUid);
  if (!unit) {
    host.innerHTML = `<div class="active-kicker">WAITING</div><h3>턴 진행</h3><p>다음 행동을 준비합니다.</p>`;
    return;
  }
  const statusText = unit.statuses.length
    ? unit.statuses.map((s) => `${STATUSES[s.id]?.name || s.id} ${s.turns}`).join(' · ')
    : '상태 이상 없음';
  host.innerHTML = `<div class="active-kicker">${unit.side === 'ally' ? 'YOUR TURN' : 'ENEMY TURN'}</div>
    <h3>${esc(unit.name)}</h3>
    <p>${unit.side === 'ally' ? `${unit.raceName} · ${unit.className}` : unit.className} · ${unit.row === 'front' ? '전열' : unit.row === 'mid' ? '중열' : '후열'}</p>
    <div class="active-stats">
      <span>HP <b>${Math.max(0, Math.round(unit.hp))}/${unit.maxHp}</b></span>
      <span>AETHER <b>${Math.max(0, Math.round(unit.aether))}/${unit.maxAether}</b></span>
      <span>${statusText}</span>
    </div>`;
}

function renderActionPanel(state) {
  const host = $('#action-panel');
  if (!host) return;
  const autoLabel = state.auto ? '자동 ON' : '자동 OFF';
  if (state.phase === 'select') {
    const buttons = state.actions.map((action) => `
      <button class="action-btn${action.disabled ? '' : ''}" data-action-id="${action.id}" ${action.disabled ? 'disabled' : ''} title="${esc(action.reason || action.desc)}">
        <span class="key-hint">${action.key || ''}</span>
        <span class="action-icon">${action.icon}</span>
        <span class="action-name">${esc(action.name)}</span>
        <span class="action-cost">${action.item ? (action.id === 'potion' ? `남은 ${state.items.potions}` : `남은 ${state.items.ethers}`) : action.cost ? `에테르 ${action.cost}` : action.reason || '무료'}</span>
      </button>`).join('');
    host.innerHTML = `
      <div class="action-title"><b>${esc(app.battle.getActive()?.name || '')}의 행동</b><button class="mini-toggle" id="btn-auto">${autoLabel}</button></div>
      <div class="action-buttons">${buttons}</div>
      <div class="action-note">행동을 선택하세요. <b>1–6</b> 단축키 · 적을 직접 눌러 기본 공격</div>`;
  } else if (state.phase === 'target') {
    const action = app.battle.pendingAction;
    const targetWord = action?.target === 'ally' ? '아군' : '적';
    host.innerHTML = `
      <div class="action-title"><b>${esc(action?.name || '대상 선택')}</b><button class="mini-toggle" id="btn-cancel-target">취소</button></div>
      <div class="action-note" style="font-size:.6rem;color:var(--gold)">${esc(action?.desc || '')}</div>
      <div class="action-note">${targetWord}을(를) 클릭하세요. <b>ESC</b> 취소</div>`;
  } else if (state.phase === 'enemy') {
    host.innerHTML = `
      <div class="action-title"><b>적의 턴</b><button class="mini-toggle" id="btn-auto">${autoLabel}</button></div>
      <div class="action-note">공허 존재가 다음 수를 고르고 있습니다.</div>`;
  } else if (state.phase === 'resolving' || state.phase === 'intro') {
    host.innerHTML = `<div class="action-title"><b>${state.phase === 'intro' ? '전투 준비' : '행동 처리 중'}</b></div><div class="action-note">${state.phase === 'intro' ? '원정대가 진형을 갖춥니다.' : '결과를 계산하는 중...'}</div>`;
  } else if (state.phase === 'victory') {
    host.innerHTML = `<div class="action-title"><b style="color:var(--teal)">승리</b></div><div class="action-note">전리품을 정리합니다.</div>`;
  } else if (state.phase === 'defeat') {
    host.innerHTML = `<div class="action-title"><b style="color:var(--rose)">패배</b></div><div class="action-note">원정대가 쓰러졌습니다.</div>`;
  }
}

function renderBattleLog() {
  if (!app.battle) return;
  const host = $('#battle-log');
  if (!host) return;
  host.innerHTML = app.battle.logs.slice(-24).map((entry) => `<p class="${entry.tone || ''}">${entry.text}</p>`).join('');
  host.scrollTop = host.scrollHeight;
}

function floatOnUnit(uid, text, cls = '') {
  const card = $(`.unit[data-uid="${uid}"]`);
  if (!card) return;
  const el = document.createElement('div');
  el.className = `float-text ${cls}`;
  el.textContent = text;
  card.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function battleFx(event) {
  if (!event) return;
  if (event.type === 'damage') {
    floatOnUnit(event.uid, `-${event.amount}`, event.crit ? 'crit' : '');
    const card = $(`.unit[data-uid="${event.uid}"]`);
    if (card) {
      card.classList.remove('is-hit');
      void card.offsetWidth;
      card.classList.add('is-hit');
      setTimeout(() => card.classList.remove('is-hit'), 320);
    }
    audioPlay(event.crit ? 'crit' : 'hit');
  } else if (event.type === 'heal') {
    floatOnUnit(event.uid, `+${event.amount}`, 'heal');
    const card = $(`.unit[data-uid="${event.uid}"]`);
    if (card) {
      card.classList.remove('is-healed');
      void card.offsetWidth;
      card.classList.add('is-healed');
      setTimeout(() => card.classList.remove('is-healed'), 520);
    }
    audioPlay('pickup');
  } else if (event.type === 'miss') {
    floatOnUnit(event.uid, event.text || '회피', 'status');
    audioPlay('dash');
  } else if (event.type === 'status') {
    floatOnUnit(event.uid, event.text, 'status');
  } else if (event.type === 'shield') {
    floatOnUnit(event.uid, `보호 ${event.amount}`, 'status');
  } else if (event.type === 'aether') {
    floatOnUnit(event.uid, `+${event.amount} 에테르`, 'heal');
  } else if (event.type === 'cast') {
    const card = $(`.unit[data-uid="${event.uid}"]`);
    if (card) {
      card.classList.remove('is-attacking');
      void card.offsetWidth;
      card.classList.add('is-attacking');
      setTimeout(() => card.classList.remove('is-attacking'), 380);
    }
    audioPlay(event.action?.kind === 'magic' ? 'lance' : 'slash');
  } else if (event.type === 'round') {
    const banner = $('#round-banner');
    if (banner) {
      banner.textContent = `ROUND ${event.round}`;
      banner.style.transform = 'scale(1.18)';
      banner.style.color = 'var(--gold-bright)';
      setTimeout(() => { banner.style.transform = ''; banner.style.color = ''; }, 420);
    }
    audioPlay('ui');
  } else if (event.type === 'victory') {
    audioPlay('victory');
  } else if (event.type === 'defeat') {
    audioPlay('death');
  } else if (event.type === 'gold') {
    toast(`금화 <b>+${event.amount}</b>를 훔쳤습니다.`);
  }
}

// ---------------------------------------------------------------------------
// Field manual
// ---------------------------------------------------------------------------

function openManual(tab = app.manualTab || 'overview') {
  app.manualTab = tab;
  renderManual();
}

function renderManual() {
  const tabs = [
    ['overview', '개요'],
    ['races', '12종족'],
    ['classes', '12클래스'],
    ['kits', '대표 키트'],
    ['combat', '6v6 전투']
  ];
  let body = '';
  if (app.manualTab === 'overview') {
    body = `
      <div class="manual-grid">
        <div class="manual-entry"><h4><span>01</span> 원정대 결성</h4><p>종족 → 기본 클래스 → 전문 키트 → 능력치 확인 → 이름 → 파티 배치 순서로 6명을 구성합니다. 종족은 클래스를 막지 않습니다.</p></div>
        <div class="manual-entry"><h4><span>02</span> 타일 던전</h4><p>WASD·방향키 또는 터치 D-pad로 한 칸씩 이동합니다. 조우 타일을 밟으면 6대6 전투가 시작됩니다.</p></div>
        <div class="manual-entry"><h4><span>03</span> 6대6 턴제</h4><p>속도 순서로 턴이 돌아옵니다. 아군 턴에는 공격·클래스 능력·키트 능력·방어·아이템을 사용합니다.</p></div>
        <div class="manual-entry"><h4><span>04</span> 전열과 후열</h4><p>근접 공격은 살아 있는 전열을 우선 공격합니다. 마법·원거리 능력은 후열까지 닿습니다.</p></div>
        <div class="manual-entry"><h4><span>05</span> 성장</h4><p>전투 경험치로 레벨이 오르고, 클래스 주요 능력치와 생명력이 성장합니다. 층을 내려갈수록 적도 강해집니다.</p></div>
        <div class="manual-entry"><h4><span>06</span> 목표</h4><p>각 층의 조우를 모두 정리하면 계단이 열립니다. 5층의 공허의 왕관을 쓰러뜨리면 원정의 한 막이 끝납니다.</p></div>
      </div>
      <h3 style="margin-top:18px">조작</h3>
      <p>던전: WASD / 방향키 이동, E 상호작용, ESC 원정 포기 · 전투: 1–6 행동, ESC 대상 취소, A 자동 · 터치: D-pad와 버튼 지원.</p>`;
  } else if (app.manualTab === 'races') {
    body = `<div class="manual-grid">${RACES.map((race) => `<div class="manual-entry"><h4><span>${race.glyph}</span>${race.name} · ${race.english}</h4><p>${race.desc}</p><div class="manual-meta">${STAT_KEYS.filter((k) => race.mods[k]).map((k) => `${STAT_LABELS[k]} +${race.mods[k]}`).join(' · ')} · ${race.trait.name}: ${race.trait.desc}</div></div>`).join('')}</div>`;
  } else if (app.manualTab === 'classes') {
    body = `<div class="manual-grid">${CLASSES.map((cls) => `<div class="manual-entry"><h4><span>${cls.glyph}</span>${cls.name} · ${cls.role}</h4><p>${cls.desc}</p><div class="manual-meta">무기: ${cls.weapons.join(' / ')} · 방어구: ${cls.armor.join(' / ') || '없음'} · 주요: ${cls.keyStats.map((k) => STAT_LABELS[k]).join(' / ')}<br>${cls.ability.name}: ${cls.ability.desc}</div></div>`).join('')}</div>`;
  } else if (app.manualTab === 'kits') {
    body = `<p style="margin-bottom:10px">각 기본 클래스에는 3개의 키트 데이터 슬롯이 있습니다. 현재는 대표 키트 1개만 개방되어 있습니다.</p>
      <div class="manual-grid">${CLASSES.map((cls) => {
        const kit = representativeKit(cls.id);
        return `<div class="manual-entry"><h4><span>◆</span>${kit.name} · ${cls.name}</h4><p>${kit.role} · ${kit.equipment}</p><div class="manual-meta"><b style="color:var(--teal)">+</b> ${kit.pros.join(' · ')}<br><b style="color:var(--rose)">−</b> ${kit.cons.join(' · ')}<br>${kit.ability.name}: ${kit.ability.desc}</div></div>`;
      }).join('')}</div>`;
  } else {
    body = `<div class="manual-grid">
      <div class="manual-entry"><h4><span>◆</span>턴 순서</h4><p>모든 유닛이 속도 순으로 행동합니다. 가속·둔화 상태가 다음 라운드의 순서를 바꿉니다.</p></div>
      <div class="manual-entry"><h4><span>◆</span>전열 / 후열</h4><p>근접 기본 공격은 적 전열을 우선 대상으로 합니다. 전열이 모두 쓰러지면 후열을 공격할 수 있습니다. 원거리·마법은 후열까지 닿습니다.</p></div>
      <div class="manual-entry"><h4><span>◆</span>자원</h4><p>에테르는 클래스·키트 능력에 사용됩니다. 매 턴 일정량 회복되며, 에테르약으로 보충할 수 있습니다.</p></div>
      <div class="manual-entry"><h4><span>◆</span>상태 효과</h4><p>${Object.values(STATUSES).map((s) => `${s.glyph} ${s.name}`).join(' · ')}</p></div>
      <div class="manual-entry"><h4><span>◆</span>승리 / 패배</h4><p>적 6명을 모두 쓰러뜨리면 승리하고 경험치·금화·아이템을 얻습니다. 전멸하면 같은 조우에 재도전하거나 원정을 포기할 수 있습니다.</p></div>
      <div class="manual-entry"><h4><span>◆</span>보스</h4><p>3층의 잿빛 감시관과 5층의 공허의 왕관은 일반 조우보다 강력한 능력을 사용합니다. 보스를 쓰러뜨리면 큰 보상을 얻습니다.</p></div>
    </div>`;
  }
  openOverlay(`
    <button class="icon-btn overlay-close" id="btn-manual-close" aria-label="Close manual">×</button>
    <p class="eyebrow">FIELD MANUAL</p>
    <h2>전장 안내서</h2>
    <div class="manual-tabs">${tabs.map(([id, label]) => `<button class="manual-tab${app.manualTab === id ? ' is-active' : ''}" data-manual-tab="${id}">${label}</button>`).join('')}</div>
    <div class="manual-body">${body}</div>
    <div class="overlay-actions"><button class="btn btn-secondary" id="btn-manual-close-2">닫기</button></div>
  `, { wide: true });
  $('#btn-manual-close')?.addEventListener('click', closeOverlay);
  $('#btn-manual-close-2')?.addEventListener('click', closeOverlay);
  $$('[data-manual-tab]', $('#overlay-card')).forEach((button) => {
    button.addEventListener('click', () => {
      app.manualTab = button.dataset.manualTab;
      renderManual();
    });
  });
}

// ---------------------------------------------------------------------------
// New warband confirmation
// ---------------------------------------------------------------------------

function showNewConfirm() {
  openOverlay(`
    <p class="eyebrow">NEW WARBAND</p>
    <h2>새 원정대를 결성할까요?</h2>
    <p>현재 저장된 원정대 명부와 진행 중인 원정 기록이 사라집니다. 이 작업은 되돌릴 수 없습니다.</p>
    <div class="overlay-actions">
      <button class="btn btn-ghost" id="btn-new-cancel">취소</button>
      <button class="btn btn-primary" id="btn-new-confirm">새로 시작</button>
    </div>
  `);
  $('#btn-new-cancel')?.addEventListener('click', closeOverlay);
  $('#btn-new-confirm')?.addEventListener('click', () => {
    closeOverlay();
    app.party = [null, null, null, null, null, null];
    app.run = null;
    app.selectedSlot = null;
    persist();
    refreshTitle();
    startCreation(0);
  });
}

// ---------------------------------------------------------------------------
// Input, canvas loop and boot
// ---------------------------------------------------------------------------

function movementDirection() {
  if (app.keys.has('w') || app.keys.has('arrowup')) return [0, -1];
  if (app.keys.has('s') || app.keys.has('arrowdown')) return [0, 1];
  if (app.keys.has('a') || app.keys.has('arrowleft')) return [-1, 0];
  if (app.keys.has('d') || app.keys.has('arrowright')) return [1, 0];
  if (app.touchDir === 'up') return [0, -1];
  if (app.touchDir === 'down') return [0, 1];
  if (app.touchDir === 'left') return [-1, 0];
  if (app.touchDir === 'right') return [1, 0];
  return null;
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  const tag = event.target?.tagName;
  if (app.overlayOpen) {
    if (key === 'escape' && app.overlayClosable) closeOverlay();
    return;
  }
  if (app.mode === 'create') {
    if (key === 'escape') closeCreation();
    else if (key === 'enter' && tag !== 'input') advanceCreation();
    return;
  }
  if (app.mode === 'party') {
    if (key === 'escape') { showScreen('title'); refreshTitle(); }
    return;
  }
  if (app.mode === 'dungeon') {
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
      app.keys.add(key);
      const dir = movementDirection();
      if (dir) tryMove(dir[0], dir[1]);
    } else if (key === 'e' || key === 'enter') {
      event.preventDefault();
      interact();
    } else if (key === 'escape') {
      event.preventDefault();
      abandonRun();
    }
    return;
  }
  if (app.mode === 'battle' && app.battle) {
    if (key === 'escape') {
      app.battle.cancelTarget();
      return;
    }
    if (key === 'a') {
      app.battle.toggleAuto();
      return;
    }
    const action = app.battle.getPlayerActions().find((a) => a.key === key);
    if (action) app.battle.beginAction(action.id);
  }
}

function handleKeyUp(event) {
  app.keys.delete(event.key.toLowerCase());
}

function setupInput() {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', () => { app.keys.clear(); app.touchDir = null; });

  const dpadButtons = $$('.dpad-btn');
  for (const button of dpadButtons) {
    const start = (event) => {
      event.preventDefault();
      app.touchDir = button.dataset.dir;
      button.classList.add('is-held');
      const dir = movementDirection();
      if (dir) tryMove(dir[0], dir[1]);
    };
    const end = () => {
      button.classList.remove('is-held');
      if (app.touchDir === button.dataset.dir) app.touchDir = null;
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('pointerleave', end);
  }

  $('#btn-interact')?.addEventListener('click', interact);

  $('#btn-new')?.addEventListener('click', () => {
    app.audio.resume();
    if (hasParty() || app.run) showNewConfirm();
    else startCreation(0);
  });
  $('#btn-continue')?.addEventListener('click', () => {
    app.audio.resume();
    if (app.run && hasParty()) resumeRun();
  });
  $('#btn-manual')?.addEventListener('click', openManual);
  $('#btn-sound')?.addEventListener('click', () => {
    app.audio.resume();
    app.settings.sound = !app.settings.sound;
    app.audio.syncSettings();
    updateSoundButton();
    persist();
    audioPlay('ui');
  });

  $('#btn-create-back')?.addEventListener('click', () => {
    if (app.step === 0) closeCreation();
    else { app.step -= 1; renderCreation(); }
  });
  $('#btn-create-next')?.addEventListener('click', advanceCreation);
  $('#btn-create-close')?.addEventListener('click', closeCreation);

  $('#create-grid')?.addEventListener('click', (event) => {
    const raceButton = event.target.closest('[data-race]');
    if (raceButton) {
      app.draft.raceId = raceButton.dataset.race;
      audioPlay('ui');
      renderCreation();
      return;
    }
    const classButton = event.target.closest('[data-class]');
    if (classButton) {
      app.draft.classId = classButton.dataset.class;
      app.draft.kitId = representativeKit(app.draft.classId).id;
      audioPlay('ui');
      renderCreation();
      return;
    }
    const kitButton = event.target.closest('[data-kit]');
    if (kitButton) {
      if (kitButton.dataset.locked === 'true') {
        toast('이 키트는 아직 봉인되어 있습니다. 이번 빌드에서는 대표 키트만 사용할 수 있습니다.');
        audioPlay('error');
        return;
      }
      app.draft.kitId = kitButton.dataset.kit;
      audioPlay('ui');
      renderCreation();
    }
  });

  $('#btn-party-close')?.addEventListener('click', () => { showScreen('title'); refreshTitle(); });
  $('#btn-party-back')?.addEventListener('click', () => { showScreen('title'); refreshTitle(); });
  $('#btn-recruit')?.addEventListener('click', () => startCreation(firstEmptySlot()));
  $('#btn-autofill')?.addEventListener('click', autoMuster);
  $('#btn-begin')?.addEventListener('click', beginFromParty);

  $('#formation-board')?.addEventListener('click', (event) => {
    const slot = event.target.closest('[data-slot]');
    if (slot) handleSlotClick(Number(slot.dataset.slot));
  });
  $('#party-roster')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-roster-slot]');
    if (!button) return;
    app.selectedSlot = Number(button.dataset.rosterSlot);
    renderParty();
  });
  $('#party-detail')?.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-slot]');
    if (!remove) return;
    const slot = Number(remove.dataset.removeSlot);
    const member = app.party[slot];
    if (!member) return;
    app.party[slot] = null;
    app.selectedSlot = app.party.findIndex(Boolean);
    persist();
    renderParty();
    toast(`${esc(member.name)}을(를) 명부에서 해산했습니다.`);
  });

  $('#btn-dungeon-manual')?.addEventListener('click', openManual);
  $('#btn-battle-manual')?.addEventListener('click', openManual);
  $('#btn-abandon')?.addEventListener('click', abandonRun);
  $('#btn-battle-log')?.addEventListener('click', () => {
    $('.battle-bottom')?.classList.toggle('show-log');
  });

  $('#ally-units')?.addEventListener('click', (event) => handleUnitClick(event));
  $('#enemy-units')?.addEventListener('click', (event) => handleUnitClick(event));
  $('#action-panel')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action-id]');
    if (action && app.battle) {
      app.battle.beginAction(action.dataset.actionId);
      return;
    }
    if (event.target.closest('#btn-cancel-target')) app.battle?.cancelTarget();
    if (event.target.closest('#btn-auto')) app.battle?.toggleAuto();
  });

  $('#overlay')?.addEventListener('click', (event) => {
    if (event.target === $('#overlay') && app.overlayClosable) closeOverlay();
  });

  window.addEventListener('resize', () => {
    app.view.camX = null;
    app.view.camY = null;
  });

  document.addEventListener('pointerdown', () => app.audio.resume(), { once: true });
}

function handleUnitClick(event) {
  if (!app.battle) return;
  const card = event.target.closest('.unit');
  if (!card) return;
  const uid = card.dataset.uid;
  const state = app.battle.getState();
  if (state.phase === 'target') {
    app.battle.selectTarget(uid);
    return;
  }
  if (state.phase === 'select') {
    const unit = app.battle.getUnit(uid);
    if (unit?.side === 'enemy') {
      const ok = app.battle.beginAction('basic');
      if (ok && app.battle.phase === 'target') app.battle.selectTarget(uid);
    }
  }
}

function drawDungeonFrame(now) {
  if (app.mode !== 'dungeon' || !app.dungeon) return;
  const canvas = $('#dungeon-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const targetW = Math.round(rect.width * dpr);
  const targetH = Math.round(rect.height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const members = partyMembers();
  const leaderCharacter = members[0] ? computeCharacter(members[0]) : null;
  const leader = leaderCharacter ? { glyph: leaderCharacter.cls.glyph, color: leaderCharacter.cls.color } : null;
  drawDungeon(ctx, rect.width, rect.height, app.dungeon, app.view, now, app.run.pos, leader);
  if (!app.lastMinimap || now - app.lastMinimap > 160) {
    drawMinimap($('#minimap'), app.dungeon, app.view, app.run.pos);
    app.lastMinimap = now;
  }
}

function frame(now) {
  app.time = now;
  if (app.mode === 'dungeon' && app.dungeon && !app.overlayOpen && !app.battle) {
    const dir = movementDirection();
    if (dir) tryMove(dir[0], dir[1]);
    drawDungeonFrame(now);
  } else if (app.mode === 'dungeon' && app.dungeon) {
    drawDungeonFrame(now);
  }
  requestAnimationFrame(frame);
}

function init() {
  buildEmbers();
  updateSoundButton();
  refreshTitle();
  setupInput();
  setTimeout(() => $('#boot')?.classList.add('is-gone'), 350);
  requestAnimationFrame(frame);
  // Auto-start is used by the preview capture; it opens the creation wizard.
  const params = new URLSearchParams(window.location.search);
  if (params.get('play') === '1') {
    if (app.run && hasParty()) resumeRun();
    else if (hasParty()) { showScreen('party'); renderParty(); }
    else startCreation(0);
  }
}

// Exposed for debugging and automated smoke tests.
window.__warband = app;

init();


