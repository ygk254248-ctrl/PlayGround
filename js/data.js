// Aetherborne: The Hollow Crown — static game data and design content.

export const SAVE_KEY = 'aetherborne_save_v1';

export const RANKS = [
  { id: 'D', title: 'Novice Hunter', xp: 0, color: '#a8b4c8', perk: 'Standard contract access.' },
  { id: 'C', title: 'Field Hunter', xp: 250, color: '#73dcb2', perk: '+4% damage · +5% shard yield' },
  { id: 'B', title: 'Veteran Hunter', xp: 800, color: '#75aaff', perk: '+8% damage · +10% shard yield' },
  { id: 'A', title: 'Elite Hunter', xp: 1800, color: '#c49bff', perk: '+12% damage · +15% shard yield' },
  { id: 'S', title: 'Crownslayer', xp: 3600, color: '#ffd479', perk: '+16% damage · +20% shard yield' }
];

export const MAX_FLOOR = 12;
export const BOSS_FLOORS = [4, 8, 12];
export const CHECKPOINT_FLOORS = [1, 5, 9];
export const ROOM_W = 1140;
export const ROOM_H = 800;
export const WALL = 54;

export const THEMES = {
  ember: {
    id: 'ember',
    name: 'The Cinder Vaults',
    short: 'Cinder Vaults',
    sky: '#160d10',
    floor: '#24161a',
    floorAlt: '#2c1a1f',
    grout: '#100a0d',
    wall: '#3a2426',
    wallTop: '#5a3530',
    accent: '#ff9a58',
    accent2: '#e1534d',
    glow: 'rgba(255, 138, 74, 0.58)',
    fog: 'rgba(37, 13, 18, 0.62)',
    rune: '#ff7b45',
    motes: '#ffb06d'
  },
  verdant: {
    id: 'verdant',
    name: 'The Verdant Reliquary',
    short: 'Verdant Reliquary',
    sky: '#081412',
    floor: '#14211e',
    floorAlt: '#182925',
    grout: '#09110f',
    wall: '#243831',
    wallTop: '#345046',
    accent: '#65e0b6',
    accent2: '#c5d96f',
    glow: 'rgba(92, 225, 183, 0.54)',
    fog: 'rgba(7, 27, 24, 0.62)',
    rune: '#5ce6b5',
    motes: '#8ef2c7'
  },
  astral: {
    id: 'astral',
    name: 'The Astral Spire',
    short: 'Astral Spire',
    sky: '#0b0b1a',
    floor: '#17182b',
    floorAlt: '#1d1e35',
    grout: '#0a0a14',
    wall: '#2a2b4b',
    wallTop: '#41436b',
    accent: '#a38bff',
    accent2: '#68c9ff',
    glow: 'rgba(143, 125, 255, 0.56)',
    fog: 'rgba(9, 9, 30, 0.64)',
    rune: '#9f8cff',
    motes: '#c3b5ff'
  },
  crown: {
    id: 'crown',
    name: 'The Hollow Crown',
    short: 'Hollow Crown',
    sky: '#100811',
    floor: '#211523',
    floorAlt: '#291a2b',
    grout: '#0c060d',
    wall: '#3b2540',
    wallTop: '#5c3763',
    accent: '#ffd479',
    accent2: '#ff6e9d',
    glow: 'rgba(255, 212, 121, 0.55)',
    fog: 'rgba(24, 8, 25, 0.66)',
    rune: '#ffd479',
    motes: '#ffe3a3'
  }
};

export function themeForFloor(floor) {
  if (floor >= 12) return THEMES.crown;
  if (floor >= 8) return THEMES.astral;
  if (floor >= 4) return THEMES.verdant;
  return THEMES.ember;
}

export const WEAPONS = {
  saber: {
    id: 'saber',
    name: 'Moonlit Saber',
    kind: 'Balanced blade',
    icon: '⚔',
    damage: 23,
    cooldown: 0.36,
    range: 116,
    arc: 1.75,
    combo: 3,
    crit: 0.05,
    knockback: 180,
    unlock: 0,
    desc: 'A duelist’s ivory blade. Quick arcs, clean follow-through, and a generous critical window.',
    tint: '#d9ecff'
  },
  daggers: {
    id: 'daggers',
    name: 'Emberfang Daggers',
    kind: 'Twin fangs',
    icon: '🗡',
    damage: 12,
    cooldown: 0.19,
    range: 84,
    arc: 1.32,
    combo: 4,
    crit: 0.16,
    knockback: 80,
    unlock: 90,
    desc: 'Twin obsidian fangs that reward relentless pressure. Short reach, blistering tempo.',
    tint: '#ff9e7a'
  },
  greatsword: {
    id: 'greatsword',
    name: 'Gravewarden Greatsword',
    kind: 'Heavy blade',
    icon: '🪓',
    damage: 46,
    cooldown: 0.72,
    range: 148,
    arc: 2.05,
    combo: 2,
    crit: 0.03,
    knockback: 340,
    unlock: 220,
    desc: 'A slab of fallen masonry reforged into a blade. Slow, ruinous, and impossible to ignore.',
    tint: '#ffd08a'
  }
};

export const ARMORS = {
  coat: {
    id: 'coat',
    name: 'Wayfarer Coat',
    kind: 'Light armor',
    icon: '🧥',
    hp: 20,
    aether: 10,
    dr: 0,
    speed: 1.04,
    unlock: 0,
    desc: 'Oiled leather and silver thread. Favors motion over mercy.'
  },
  mail: {
    id: 'mail',
    name: 'Warden Mail',
    kind: 'Heavy armor',
    icon: '🛡',
    hp: 70,
    aether: 0,
    dr: 0.08,
    speed: 0.96,
    unlock: 140,
    desc: 'Ceremonial plate worn by the tower’s failed jailers. Turns a killing blow into a bruise.'
  },
  vestment: {
    id: 'vestment',
    name: 'Astral Vestment',
    kind: 'Aether weave',
    icon: '✦',
    hp: 0,
    aether: 46,
    dr: 0.02,
    speed: 1.06,
    unlock: 280,
    desc: 'A mantle woven from starlight and regret. Expands the reservoir of aether.'
  }
};

export const CHARMS = {
  ember: {
    id: 'ember',
    name: 'Ember Sigil',
    kind: 'Charm',
    icon: '◈',
    unlock: 120,
    desc: '+12% damage.',
    effect: { damage: 0.12 }
  },
  dew: {
    id: 'dew',
    name: 'Dewglass',
    kind: 'Charm',
    icon: '❖',
    unlock: 160,
    desc: 'Restore 10 health whenever a room is cleared.',
    effect: { roomHeal: 10 }
  },
  mirror: {
    id: 'mirror',
    name: 'Mirror Shard',
    kind: 'Charm',
    icon: '▣',
    unlock: 190,
    desc: 'Dash recharges 25% faster.',
    effect: { dash: 0.25 }
  },
  serpent: {
    id: 'serpent',
    name: 'Serpent’s Eye',
    kind: 'Charm',
    icon: '◉',
    unlock: 240,
    desc: '+9% critical chance.',
    effect: { crit: 0.09 }
  }
};

export const META_UPGRADES = {
  vitality: {
    id: 'vitality',
    name: 'Vitality',
    icon: '♥',
    desc: '+14 maximum health.',
    max: 5,
    cost: 50,
    step: 42
  },
  might: {
    id: 'might',
    name: 'Might',
    icon: '⚔',
    desc: '+6% weapon damage.',
    max: 5,
    cost: 65,
    step: 50
  },
  agility: {
    id: 'agility',
    name: 'Agility',
    icon: '➤',
    desc: '+4% movement speed.',
    max: 4,
    cost: 45,
    step: 40
  },
  aether: {
    id: 'aether',
    name: 'Aether',
    icon: '✦',
    desc: '+12 maximum aether.',
    max: 4,
    cost: 55,
    step: 45
  },
  fortune: {
    id: 'fortune',
    name: 'Fortune',
    icon: '✧',
    desc: '+8% shard yield.',
    max: 3,
    cost: 75,
    step: 55
  }
};

export const BOONS = {
  bloodEdge: {
    id: 'bloodEdge',
    name: 'Blood Edge',
    icon: '⚔',
    max: 3,
    desc: '+15% weapon damage.',
    flavor: 'The blade remembers every hand that held it.'
  },
  fleetFoot: {
    id: 'fleetFoot',
    name: 'Fleet Foot',
    icon: '➤',
    max: 3,
    desc: '+8% movement speed.',
    flavor: 'Stone cannot catch what the wind has already forgotten.'
  },
  ironSkin: {
    id: 'ironSkin',
    name: 'Iron Skin',
    icon: '◆',
    max: 3,
    desc: '+20 maximum health and heal 20.',
    flavor: 'A body reforged is a body that no longer asks permission.'
  },
  quickening: {
    id: 'quickening',
    name: 'Quickening',
    icon: '⚡',
    max: 3,
    desc: '+10% attack speed.',
    flavor: 'Between one heartbeat and the next, the tower blinks.'
  },
  aetherWell: {
    id: 'aetherWell',
    name: 'Aether Well',
    icon: '✦',
    max: 3,
    desc: '+22 maximum aether and +0.8 aether regeneration.',
    flavor: 'The spire drinks starlight. So can you.'
  },
  eagleEye: {
    id: 'eagleEye',
    name: 'Eagle Eye',
    icon: '◉',
    max: 3,
    desc: '+8% critical chance.',
    flavor: 'Find the seam in every certainty.'
  },
  leech: {
    id: 'leech',
    name: 'Sanguine Thread',
    icon: '❧',
    max: 3,
    desc: '+3% lifesteal on weapon hits.',
    flavor: 'A red ribbon ties the hunter to the hunt.'
  },
  blinkStep: {
    id: 'blinkStep',
    name: 'Blink Step',
    icon: '⟡',
    max: 3,
    desc: 'Dash recharges 18% faster.',
    flavor: 'Distance is a suggestion.'
  },
  arcaneSurge: {
    id: 'arcaneSurge',
    name: 'Arcane Surge',
    icon: '☄',
    max: 3,
    desc: '+28% Aether Lance and Nova damage.',
    flavor: 'The hollow crown is not the only thing that hungers.'
  },
  greed: {
    id: 'greed',
    name: 'Gilded Greed',
    icon: '✧',
    max: 3,
    desc: '+20% shards earned.',
    flavor: 'The tower pays its debts in fragments of dead stars.'
  },
  executioner: {
    id: 'executioner',
    name: 'Executioner',
    icon: '☠',
    max: 2,
    desc: '+30% damage to enemies below 35% health.',
    flavor: 'Mercy is a door the tower sealed long ago.'
  },
  serenity: {
    id: 'serenity',
    name: 'Serene Guard',
    icon: '◇',
    max: 3,
    desc: 'Take 8% less damage.',
    flavor: 'Stillness is the oldest armor.'
  }
};

export const ENEMY_INFO = {
  wisp: {
    id: 'wisp',
    name: 'Hollow Wisp',
    role: 'Ranged',
    threat: 'Low',
    icon: '✧',
    desc: 'Drifting lanterns of dead aether. They keep their distance and spit slow, bright orbs.',
    tell: 'A wisp inhales light before firing. Break line of sight or dash through the shot.'
  },
  hound: {
    id: 'hound',
    name: 'Bramble Hound',
    role: 'Charger',
    threat: 'Medium',
    icon: '❧',
    desc: 'Thorn-grown hunting dogs that circle, then commit to a straight-line charge.',
    tell: 'The hound lowers its head and drags one paw. Sidestep the charge, then punish its recovery.'
  },
  knight: {
    id: 'knight',
    name: 'Cinder Knight',
    role: 'Bruiser',
    threat: 'Medium',
    icon: '♜',
    desc: 'Empty armor animated by an oath it no longer remembers. Telegraphed overhead cleaves.',
    tell: 'A red sigil blooms above its helmet before every cleave. Move behind it.'
  },
  wraith: {
    id: 'wraith',
    name: 'Mirror Wraith',
    role: 'Skirmisher',
    threat: 'High',
    icon: '◈',
    desc: 'A shattered reflection that teleports across the room and fires three-bolt fans.',
    tell: 'It flickers translucent before teleporting. Fan shots leave a gap directly in front.'
  },
  sentinel: {
    id: 'sentinel',
    name: 'Stone Sentinel',
    role: 'Tank',
    threat: 'High',
    icon: '⬢',
    desc: 'A slow shrine guardian. Its ground slam sends a damaging ring across the floor.',
    tell: 'The ring only hurts at its leading edge. Walk toward the sentinel as it expands.'
  },
  moth: {
    id: 'moth',
    name: 'Void Moth',
    role: 'Swarm',
    threat: 'Low',
    icon: '✺',
    desc: 'Fragments of night that flutter in unpredictable arcs and burst on contact.',
    tell: 'They are fragile but erratic. Wide arcs and Nova clear them fastest.'
  },
  warden: {
    id: 'warden',
    name: 'The Ashen Warden',
    role: 'Guardian',
    threat: 'Boss',
    icon: '♛',
    desc: 'The tower’s first jailer, bound in cinder and rust. He tests every hunter who climbs.',
    tell: 'His cleave is wide but slow. Save your dash for the second ring of his ground slam.'
  },
  matriarch: {
    id: 'matriarch',
    name: 'The Verdant Matriarch',
    role: 'Guardian',
    threat: 'Boss',
    icon: '♛',
    desc: 'A garden grown around a broken oath. She summons hounds and blooms poison beneath your feet.',
    tell: 'Poison circles pulse before detonating. Keep moving and cut down her hounds for healing motes.'
  },
  crown: {
    id: 'crown',
    name: 'The Hollow Crown',
    role: 'Final Boss',
    threat: 'Nightmare',
    icon: '♛',
    desc: 'The tower’s will, wearing the shape of every hunter who failed before you.',
    tell: 'The Crown mirrors your own blade. When it raises both hands, the arena itself becomes the attack.'
  }
};

export const CONTRACT_TEMPLATES = [
  {
    id: 'cull',
    title: 'Cull the Hollow',
    stat: 'kills',
    unit: 'denizens',
    min: 12,
    max: 20,
    scale: 4,
    reward: 1
  },
  {
    id: 'rooms',
    title: 'Sanctify the Halls',
    stat: 'rooms',
    unit: 'rooms cleared',
    min: 4,
    max: 8,
    scale: 2,
    reward: 0.9
  },
  {
    id: 'floors',
    title: 'Climb Without Fear',
    stat: 'floors',
    unit: 'floors cleared',
    min: 1,
    max: 2,
    scale: 0.5,
    reward: 1.2
  },
  {
    id: 'bosses',
    title: 'Break the Jailers',
    stat: 'bosses',
    unit: 'guardians felled',
    min: 1,
    max: 1,
    scale: 0.35,
    reward: 1.8
  },
  {
    id: 'boons',
    title: 'Gather Aether',
    stat: 'boons',
    unit: 'aether marks claimed',
    min: 2,
    max: 4,
    scale: 1,
    reward: 0.8
  },
  {
    id: 'shards',
    title: 'Harvest the Spire',
    stat: 'shardsEarned',
    unit: 'shards gathered',
    min: 90,
    max: 150,
    scale: 30,
    reward: 1.1
  },
  {
    id: 'depth',
    title: 'Chart the Unknown',
    stat: 'bestFloor',
    unit: 'floor reached',
    min: 2,
    max: 2,
    scale: 1,
    reward: 1.5,
    absolute: true
  }
];

export const CODEX = {
  loop: [
    {
      title: '01 · Prepare',
      body: 'Return to the Wayfarer’s Rest. Spend aether shards on permanent attributes, forge new weapons, and accept three hunter contracts.'
    },
    {
      title: '02 · Ascend',
      body: 'Enter a procedurally assembled floor. Every room is sealed until its denizens are culled; treasure and shrines tempt you off the critical path.'
    },
    {
      title: '03 · Adapt',
      body: 'Claim Aether Marks after shrines, chests, and guardians. Stack marks to shape each run into a different build.'
    },
    {
      title: '04 · Descend or Die',
      body: 'Open the floor seal, step through the gate, and carry your wounds upward. Death returns you to the Rest, but shards and contract progress remain.'
    }
  ],
  progression: [
    {
      title: 'Hunter License',
      body: 'License experience is earned from floors, guardians, and claimed contracts. It promotes you through D, C, B, A, and S ranks, improving damage and shard yield. Your license is permanent.'
    },
    {
      title: 'Aether Shards',
      body: 'Shards are the only currency that survives death. Use them to raise Vitality, Might, Agility, Aether, and Fortune, or to unlock and upgrade equipment.'
    },
    {
      title: 'Equipment',
      body: 'Weapons define your attack rhythm and reach. Armor changes health, aether, speed, and damage reduction. Charms add a single strong passive. All equipment can be upgraded five times.'
    },
    {
      title: 'Checkpoints',
      body: 'Felling a guardian opens a new ascent point. Future runs may begin at floors 1, 5, or 9. The Hollow Crown waits on floor 12.'
    }
  ],
  quests: [
    {
      title: 'Three Active Contracts',
      body: 'The Rest always posts three contracts. Each tracks a cumulative hunter statistic from the moment it was accepted, so progress survives death.'
    },
    {
      title: 'Claim and Renew',
      body: 'Claim a completed contract from the Sanctum to receive shards and license experience. A fresh, more demanding contract replaces it immediately.'
    },
    {
      title: 'No Failure State',
      body: 'Contracts never expire. They are long-term objectives that reward you for playing the way you already want to play.'
    }
  ],
  bestiary: [
    {
      title: 'The Hollowed',
      body: 'Wisps, hounds, knights, wraiths, sentinels, and moths are fragments of the tower’s memory. Each has a readable tell and a distinct answer.'
    },
    {
      title: 'Guardians',
      body: 'Floor 4: The Ashen Warden. Floor 8: The Verdant Matriarch. Floor 12: The Hollow Crown. Guardians have phases, summon reinforcements, and fill the arena with hazards.'
    },
    {
      title: 'Elites',
      body: 'From floor 5 onward, some denizens are crowned in gold. Elites have double health, hit harder, and drop additional shards.'
    }
  ]
};
