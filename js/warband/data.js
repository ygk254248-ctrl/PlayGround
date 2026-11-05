// Aetherborne: Warband — races, base classes, specialist kits, abilities and foes.
// All names, descriptions and numbers in this file are original to this project.

export const STAT_KEYS = ['might', 'agility', 'vitality', 'intellect', 'spirit', 'presence'];

export const STAT_LABELS = {
  might: '근력',
  agility: '민첩',
  vitality: '체력',
  intellect: '지력',
  spirit: '정신',
  presence: '존재감'
};

export const STAT_SHORT = {
  might: '근',
  agility: '민',
  vitality: '체',
  intellect: '지',
  spirit: '정',
  presence: '존'
};

export const BASE_STATS = {
  might: 8,
  agility: 8,
  vitality: 8,
  intellect: 8,
  spirit: 8,
  presence: 8
};

// ---------------------------------------------------------------------------
// 12 playable races. Races never lock a class; they only shift efficiency.
// ---------------------------------------------------------------------------

export const RACES = [
  {
    id: 'emberkin',
    name: '엠버킨',
    english: 'Emberkin',
    glyph: '✦',
    color: '#ff8a58',
    epithet: '잿불의 후예',
    desc: '불씨를 삼킨 채 태어난 유랑민. 상처가 깊어질수록 몸 안의 화로가 더 뜨겁게 타오른다.',
    mods: { might: 2, vitality: 1 },
    trait: {
      id: 'cinder_blood',
      name: '잿불의 피',
      desc: '생명력이 50% 이하일 때 주는 피해 +15%.'
    }
  },
  {
    id: 'sylvan',
    name: '실반',
    english: 'Sylvan',
    glyph: '❧',
    color: '#72d9a4',
    epithet: '이끼숲의 사냥꾼',
    desc: '나무 사이의 소리를 발소리보다 먼저 읽는 숲의 주민. 적의 시선이 닿기 전에 몸을 비튼다.',
    mods: { agility: 2, spirit: 1 },
    trait: {
      id: 'verdant_step',
      name: '초록 걸음',
      desc: '회피율 +8%, 전투 시작 시 속도 +3.'
    }
  },
  {
    id: 'stoneborn',
    name: '스톤본',
    english: 'Stoneborn',
    glyph: '⬢',
    color: '#b7a58c',
    epithet: '산맥의 기억',
    desc: '오래된 산맥이 사람의 형체를 빌린 존재. 무게를 견디는 일에 태어난 몸이다.',
    mods: { vitality: 2, might: 1 },
    trait: {
      id: 'bedrock',
      name: '기반암',
      desc: '근접 공격으로 받는 피해 -15%.'
    }
  },
  {
    id: 'tidecaller',
    name: '타이드콜러',
    english: 'Tidecaller',
    glyph: '≈',
    color: '#5fc8e8',
    epithet: '조수에 귀 기울이는 자',
    desc: '달의 인장을 몸에 새긴 해안의 혈족. 파도처럼 밀려왔다가 파도처럼 빠져나간다.',
    mods: { intellect: 2, spirit: 1 },
    trait: {
      id: 'tidal_grace',
      name: '조수의 은총',
      desc: '자신의 턴 시작 시 최대 생명력의 3%를 회복.'
    }
  },
  {
    id: 'ashwing',
    name: '애쉬윙',
    english: 'Ashwing',
    glyph: '⌁',
    color: '#d6c4ff',
    epithet: '재의 날개',
    desc: '화산재를 깃으로 삼는 하늘의 방랑자. 높은 곳에서 전장의 흐름을 내려다본다.',
    mods: { agility: 2, intellect: 1 },
    trait: {
      id: 'glide',
      name: '활공',
      desc: '속도 +6, 치명타율 +5%.'
    }
  },
  {
    id: 'duskling',
    name: '더스크링',
    english: 'Duskling',
    glyph: '☾',
    color: '#a98bdc',
    epithet: '황혼의 아이',
    desc: '해가 지는 순간과 함께 태어난 그림자 혈족. 첫 번째 위협을 흐릿한 잔상으로 흘려보낸다.',
    mods: { agility: 2, presence: 1 },
    trait: {
      id: 'umbral_veil',
      name: '그림자 장막',
      desc: '전투마다 첫 번째로 받는 공격을 완전히 회피.'
    }
  },
  {
    id: 'runeblood',
    name: '룬블러드',
    english: 'Runeblood',
    glyph: 'ᛟ',
    color: '#8fb7ff',
    epithet: '혈관에 새겨진 문자',
    desc: '태어날 때부터 피부 아래 룬이 흐르는 학자 혈족. 주문의 비용을 몸으로 일부 대신 지불한다.',
    mods: { intellect: 2, vitality: 1 },
    trait: {
      id: 'runic_echo',
      name: '룬의 메아리',
      desc: '능력 사용 시 소모하는 에테르 -15%.'
    }
  },
  {
    id: 'ironhide',
    name: '아이언하이드',
    english: 'Ironhide',
    glyph: '❖',
    color: '#c6a06a',
    epithet: '철가죽 야수혈',
    desc: '짐승의 조상과 사람의 조상이 만난 혈통. 두꺼운 가죽 아래에 또 하나의 심장이 뛴다.',
    mods: { vitality: 2, might: 1 },
    trait: {
      id: 'thick_hide',
      name: '두꺼운 가죽',
      desc: '최대 생명력 +12%.'
    }
  },
  {
    id: 'sunfolk',
    name: '선포크',
    english: 'Sunfolk',
    glyph: '☀',
    color: '#ffd76e',
    epithet: '새벽의 사제',
    desc: '햇빛을 저장하는 성흔을 지닌 혈족. 그들의 손끝에서 상처가 새벽빛으로 닫힌다.',
    mods: { spirit: 2, presence: 1 },
    trait: {
      id: 'dawnlight',
      name: '새벽빛',
      desc: '자신이 주는 회복량 +20%.'
    }
  },
  {
    id: 'graveborn',
    name: '그레이브본',
    english: 'Graveborn',
    glyph: '☠',
    color: '#9fb7a9',
    epithet: '무덤에서 돌아온 자',
    desc: '죽음의 문턱에서 이름을 되찾은 혈족. 심장은 멎었지만 의지는 아직 뜨겁다.',
    mods: { vitality: 2, intellect: 1 },
    trait: {
      id: 'deathless',
      name: '불사의 고집',
      desc: '전투마다 한 번, 치명적인 피해를 받아도 생명력 1로 버틴다.'
    }
  },
  {
    id: 'mistwalker',
    name: '미스트워커',
    english: 'Mistwalker',
    glyph: '☁',
    color: '#b9d6d9',
    epithet: '안개의 경계인',
    desc: '경계가 흐릿한 곳에서 태어난 혈족. 실체와 안개 사이를 오가며 저주를 흘려보낸다.',
    mods: { spirit: 2, agility: 1 },
    trait: {
      id: 'fade',
      name: '희미해지기',
      desc: '회피율 +6%, 받는 약화 효과 지속시간 -1턴.'
    }
  },
  {
    id: 'forgeborn',
    name: '포지본',
    english: 'Forgeborn',
    glyph: '⚒',
    color: '#e0a46b',
    epithet: '화로의 장인',
    desc: '태초의 화로 옆에서 벼려진 혈족. 무기와 방어구의 의도를 손끝으로 읽는다.',
    mods: { might: 2, vitality: 1 },
    trait: {
      id: 'master_craft',
      name: '장인의 손',
      desc: '방어력 +10%, 장비로 얻는 생명력 +10%.'
    }
  }
];

// ---------------------------------------------------------------------------
// 12 base classes. Each class carries three specialist kit slots. Only the
// representative kit is unsealed in this build; the other two remain data-only
// so future steps can unlock them without a schema change.
// ---------------------------------------------------------------------------

export const CLASSES = [
  {
    id: 'fighter',
    name: '파이터',
    english: 'Fighter',
    glyph: '⚔',
    color: '#e9a36a',
    role: '전열 딜러',
    roleEn: 'Frontline Striker',
    desc: '무기 하나를 몸의 일부처럼 다루는 전사. 화려한 주문보다 확실한 타격과 안정적인 전선 유지에 강하다.',
    keyStats: ['might', 'vitality'],
    mods: { might: 2, vitality: 1 },
    weapons: ['검', '도끼', '장창'],
    armor: ['중갑', '경갑'],
    attackKind: 'physical',
    attackReach: 'front',
    ability: {
      id: 'momentum_cleave',
      name: '관성 베기',
      desc: '전열의 적 하나를 1.65배로 베고, 다음 공격의 위력을 높인다.',
      cost: 8,
      cooldown: 2,
      target: 'enemy',
      kind: 'physical',
      power: 1.65,
      reach: 'front',
      special: 'momentum'
    },
    kits: [
      {
        id: 'vanguard_blade',
        name: '선봉의 칼날',
        english: 'Vanguard Blade',
        classId: 'fighter',
        representative: true,
        role: '전열 돌파',
        pros: ['무기 피해 +15%', '치명타율 +10%'],
        cons: ['방어력 -10%'],
        equipment: '양손 검·도끼만 사용. 방패 사용 불가.',
        allowedWeapons: ['양손검', '양손도끼'],
        allowedArmor: ['중갑', '경갑'],
        ability: {
          id: 'press_the_line',
          name: '전선 압박',
          desc: '전열의 적 하나를 1.9배로 내리친다. 처치하면 즉시 한 번 더 행동할 수 있다.',
          cost: 10,
          cooldown: 3,
          target: 'enemy',
          kind: 'physical',
          power: 1.9,
          reach: 'front',
          special: 'execute_chain'
        }
      },
      {
        id: 'iron_chorus',
        name: '강철의 후렴',
        classId: 'fighter',
        representative: false,
        role: '방어형 검사',
        pros: ['방패 사용 가능', '아군 보호 시 방어력 +15%'],
        cons: ['이동 속도 -10%'],
        equipment: '한손 검·방패. 중갑 필수.',
        allowedWeapons: ['한손검', '방패'],
        allowedArmor: ['중갑'],
        ability: { name: '철벽 합창', desc: '아군 전원의 방어력을 잠시 끌어올린다.' }
      },
      {
        id: 'red_tempo',
        name: '붉은 박자',
        classId: 'fighter',
        representative: false,
        role: '연격 딜러',
        pros: ['공격마다 속도 증가', '연속 공격 피해 +12%'],
        cons: ['최대 생명력 -10%'],
        equipment: '경갑과 한손 무기만 사용.',
        allowedWeapons: ['한손검', '도끼'],
        allowedArmor: ['경갑'],
        ability: { name: '박자 끊기', desc: '빠른 연격으로 적의 다음 행동을 늦춘다.' }
      }
    ]
  },
  {
    id: 'guardian',
    name: '가디언',
    english: 'Guardian',
    glyph: '🛡',
    color: '#7fb3e8',
    role: '탱커 · 보호자',
    roleEn: 'Protector',
    desc: '아군 앞에 서는 것을 사명으로 삼는 방패병. 도발과 보호막으로 적의 의도를 자기 몸쪽으로 돌린다.',
    keyStats: ['vitality', 'spirit'],
    mods: { vitality: 2, spirit: 1 },
    weapons: ['철퇴', '검', '방패'],
    armor: ['중갑', '경갑'],
    attackKind: 'physical',
    attackReach: 'front',
    ability: {
      id: 'aegis_call',
      name: '수호의 외침',
      desc: '모든 적을 2턴간 도발하고, 자신에게 최대 생명력 25%의 보호막을 부여한다.',
      cost: 10,
      cooldown: 3,
      target: 'allEnemies',
      kind: 'debuff',
      status: { id: 'taunt', turns: 2, value: 1 },
      selfStatus: { id: 'shield', turns: 2, value: 0.25 },
      special: 'aegis_call'
    },
    kits: [
      {
        id: 'bulwark_ash',
        name: '잿빛 방벽',
        english: 'Bulwark of Ash',
        classId: 'guardian',
        representative: true,
        role: '아군 보호',
        pros: ['보호막 효과 +20%', '후열 아군이 받는 피해 -15%'],
        cons: ['속도 -15%'],
        equipment: '중갑과 방패 필수. 양손 무기 사용 불가.',
        allowedWeapons: ['철퇴', '한손검', '방패'],
        allowedArmor: ['중갑'],
        ability: {
          id: 'ashen_aegis',
          name: '잿빛 수호진',
          desc: '모든 아군에게 최대 생명력 15%의 보호막을 부여하고, 자신이 2턴간 모든 적을 도발한다.',
          cost: 12,
          cooldown: 3,
          target: 'allAllies',
          kind: 'buff',
          status: { id: 'shield', turns: 3, value: 0.15 },
          special: 'ashen_aegis'
        }
      },
      {
        id: 'oath_of_stone',
        name: '돌의 서약',
        classId: 'guardian',
        representative: false,
        role: '반격 탱커',
        pros: ['피격 시 반격', '방어력 +20%'],
        cons: ['공격력 -15%'],
        equipment: '방패와 중갑만 사용.',
        allowedWeapons: ['방패', '철퇴'],
        allowedArmor: ['중갑'],
        ability: { name: '서약의 반향', desc: '자신을 공격한 적에게 신성 피해를 돌려준다.' }
      },
      {
        id: 'lantern_warden',
        name: '등불의 파수꾼',
        classId: 'guardian',
        representative: false,
        role: '치유형 수호자',
        pros: ['턴마다 아군 최저 생명력 회복', '정신 +2'],
        cons: ['최대 에테르 -10%'],
        equipment: '철퇴와 성물. 중갑 또는 경갑.',
        allowedWeapons: ['철퇴', '성물'],
        allowedArmor: ['중갑', '경갑'],
        ability: { name: '등불 지키기', desc: '아군 하나를 보호하고 생명력을 회복시킨다.' }
      }
    ]
  },
  {
    id: 'ranger',
    name: '레인저',
    english: 'Ranger',
    glyph: '🏹',
    color: '#8fd18a',
    role: '원거리 · 추적자',
    roleEn: 'Ranged Controller',
    desc: '먼 곳의 흔적을 읽고 표적을 표시하는 사냥꾼. 특정 적을 지목해 파티 전체의 화력을 집중시킨다.',
    keyStats: ['agility', 'spirit'],
    mods: { agility: 2, spirit: 1 },
    weapons: ['활', '석궁', '단검'],
    armor: ['경갑', '중갑'],
    attackKind: 'physical',
    attackReach: 'any',
    ability: {
      id: 'marked_quarry',
      name: '표적 지정',
      desc: '적 하나에게 1.1배 원거리 피해를 주고 3턴간 표식을 남겨 받는 피해를 25% 높인다.',
      cost: 7,
      cooldown: 2,
      target: 'enemy',
      kind: 'physical',
      power: 1.1,
      reach: 'any',
      status: { id: 'mark', turns: 3, value: 0.25 }
    },
    kits: [
      {
        id: 'tidewatch_tracker',
        name: '조수추적자',
        english: 'Tidewatch Tracker',
        classId: 'ranger',
        representative: true,
        role: '표적 집중',
        pros: ['표식 대상에게 주는 피해 +20%', '치명타율 +8%'],
        cons: ['근접 공격 피해 -10%'],
        equipment: '활만 사용. 중갑 사용 불가.',
        allowedWeapons: ['활'],
        allowedArmor: ['경갑'],
        ability: {
          id: 'tidal_volley',
          name: '조수 연사',
          desc: '무작위 적에게 0.5배 원거리 공격을 4회 가한다. 표식 대상에게는 피해가 20% 증가한다.',
          cost: 12,
          cooldown: 3,
          target: 'randomEnemies',
          kind: 'physical',
          power: 0.5,
          hits: 4,
          reach: 'any',
          special: 'marked_bonus'
        }
      },
      {
        id: 'thorn_scout',
        name: '가시 정찰병',
        classId: 'ranger',
        representative: false,
        role: '함정·기습',
        pros: ['전투 시작 시 적 하나 기절', '민첩 +2'],
        cons: ['최대 생명력 -10%'],
        equipment: '단검과 단궁. 경갑만.',
        allowedWeapons: ['단검', '단궁'],
        allowedArmor: ['경갑'],
        ability: { name: '가시 함정', desc: '적의 발을 묶고 지속 피해를 남긴다.' }
      },
      {
        id: 'moon_hound',
        name: '달빛 사냥개',
        classId: 'ranger',
        representative: false,
        role: '추격 딜러',
        pros: ['속도 +15%', '도주한 적 추격 피해 +25%'],
        cons: ['방어력 -10%'],
        equipment: '활과 경갑. 방패 사용 불가.',
        allowedWeapons: ['활'],
        allowedArmor: ['경갑'],
        ability: { name: '달빛 추격', desc: '표식된 적에게 연속 사격을 퍼붓는다.' }
      }
    ]
  },
  {
    id: 'cleric',
    name: '클레릭',
    english: 'Cleric',
    glyph: '✚',
    color: '#f2d58a',
    role: '치유 · 보호',
    roleEn: 'Healer',
    desc: '새벽의 성흔을 통해 상처를 닫는 사제. 언데드와 부패한 존재에게 특히 강한 빛을 내뿜는다.',
    keyStats: ['spirit', 'vitality'],
    mods: { spirit: 2, vitality: 1 },
    weapons: ['철퇴', '지팡이'],
    armor: ['중갑', '법의'],
    attackKind: 'magic',
    attackReach: 'any',
    ability: {
      id: 'dawn_mend',
      name: '새벽의 치유',
      desc: '모든 아군을 회복하고 약화 효과 하나를 정화한다. 언데드에게는 회복량이 20% 증가한다.',
      cost: 12,
      cooldown: 3,
      target: 'allAllies',
      kind: 'heal',
      power: 0.9,
      cleanse: 1,
      special: 'dawn_mend'
    },
    kits: [
      {
        id: 'dawnkeeper',
        name: '새벽지기',
        english: 'Dawnkeeper',
        classId: 'cleric',
        representative: true,
        role: '집중 치유',
        pros: ['주는 회복량 +20%', '언데드에게 주는 피해 +25%'],
        cons: ['물리 피해 -15%'],
        equipment: '철퇴·지팡이만 사용. 날붙이 사용 불가.',
        allowedWeapons: ['철퇴', '지팡이'],
        allowedArmor: ['중갑', '법의'],
        ability: {
          id: 'sunlit_prayer',
          name: '햇빛 기도',
          desc: '아군 하나를 크게 회복시키고 3턴간 재생을 부여하며 약화 효과를 정화한다.',
          cost: 10,
          cooldown: 2,
          target: 'ally',
          kind: 'heal',
          power: 1.35,
          cleanse: 2,
          status: { id: 'regen', turns: 3, value: 0.06 },
          special: 'undead_bane'
        }
      },
      {
        id: 'ash_confessor',
        name: '재의 고해사',
        classId: 'cleric',
        representative: false,
        role: '정화·심판',
        pros: ['약화 효과 정화 시 아군 회복', '정신 +2'],
        cons: ['최대 생명력 -10%'],
        equipment: '철퇴와 성물. 중갑만.',
        allowedWeapons: ['철퇴', '성물'],
        allowedArmor: ['중갑'],
        ability: { name: '고해의 불꽃', desc: '적의 강화 효과를 불태워 정화한다.' }
      },
      {
        id: 'grave_lantern',
        name: '무덤 등불',
        classId: 'cleric',
        representative: false,
        role: '언데드 사냥',
        pros: ['언데드에게 주는 피해 +40%', '어둠 저항 +20%'],
        cons: ['아군 회복량 -10%'],
        equipment: '지팡이와 성물. 법의만.',
        allowedWeapons: ['지팡이', '성물'],
        allowedArmor: ['법의'],
        ability: { name: '무덤의 빛', desc: '언데드 적 전체에 정화의 빛을 내린다.' }
      }
    ]
  },
  {
    id: 'druid',
    name: '드루이드',
    english: 'Druid',
    glyph: '❧',
    color: '#7fd6a1',
    role: '자연마법 · 지속피해',
    roleEn: 'Nature Controller',
    desc: '숲과 짐승의 언어를 빌려 싸우는 자연의 대변자. 독과 가시, 변신으로 전장을 서서히 잠식한다.',
    keyStats: ['spirit', 'intellect'],
    mods: { spirit: 2, intellect: 1 },
    weapons: ['지팡이', '발톱'],
    armor: ['경갑', '법의'],
    attackKind: 'magic',
    attackReach: 'any',
    ability: {
      id: 'briar_bloom',
      name: '가시 개화',
      desc: '모든 적에게 0.7배 자연 피해를 주고 3턴간 독을 부여한다.',
      cost: 12,
      cooldown: 3,
      target: 'allEnemies',
      kind: 'magic',
      power: 0.7,
      status: { id: 'poison', turns: 3, value: 0.045 }
    },
    kits: [
      {
        id: 'briarheart',
        name: '가시심장',
        english: 'Briarheart',
        classId: 'druid',
        representative: true,
        role: '속박 · 지속피해',
        pros: ['독 피해 +25%', '최대 생명력 +10%'],
        cons: ['화염 피해 저항 -20%'],
        equipment: '자연 무기·지팡이만 사용. 금속 갑옷 불가.',
        allowedWeapons: ['발톱', '지팡이'],
        allowedArmor: ['법의'],
        ability: {
          id: 'bramble_cage',
          name: '가시 우리',
          desc: '적 하나를 1턴간 기절시키고 3턴간 독을 부여하며 0.6배 자연 피해를 준다.',
          cost: 11,
          cooldown: 3,
          target: 'enemy',
          kind: 'magic',
          power: 0.6,
          statuses: [
            { id: 'stun', turns: 1, value: 1, chance: 0.8 },
            { id: 'poison', turns: 3, value: 0.05 }
          ]
        }
      },
      {
        id: 'moonbeast',
        name: '월야의 짐승',
        classId: 'druid',
        representative: false,
        role: '변신 돌격',
        pros: ['변신 중 근력 +3', '근접 피해 +20%'],
        cons: ['변신 중 주문 사용 불가'],
        equipment: '자연 무기만. 갑옷 불가.',
        allowedWeapons: ['발톱'],
        allowedArmor: [],
        ability: { name: '월야 변신', desc: '짐승의 형체로 변해 전열을 찢는다.' }
      },
      {
        id: 'seed_priest',
        name: '씨앗 사제',
        classId: 'druid',
        representative: false,
        role: '재생 지원',
        pros: ['아군 재생 효과 +25%', '정신 +2'],
        cons: ['공격 능력 -10%'],
        equipment: '지팡이와 의식 도구. 법의만.',
        allowedWeapons: ['지팡이'],
        allowedArmor: ['법의'],
        ability: { name: '씨앗의 노래', desc: '아군 전원에게 재생의 씨앗을 심는다.' }
      }
    ]
  },
  {
    id: 'shaman',
    name: '샤먼',
    english: 'Shaman',
    glyph: '✧',
    color: '#c3a0ff',
    role: '지원 · 방해',
    roleEn: 'Spirit Support',
    desc: '정령과 선조의 목소리를 빌려 아군을 북돋우고 적의 흐름을 끊는 영매. 직접 싸우기보다 판을 바꾼다.',
    keyStats: ['spirit', 'presence'],
    mods: { spirit: 1, presence: 1, vitality: 1 },
    weapons: ['토템', '철퇴'],
    armor: ['중갑', '경갑'],
    attackKind: 'magic',
    attackReach: 'any',
    ability: {
      id: 'ancestor_ward',
      name: '선조의 수호',
      desc: '모든 아군의 방어력을 20%, 공격력을 15% 높인다. 2턴 지속.',
      cost: 12,
      cooldown: 3,
      target: 'allAllies',
      kind: 'buff',
      statuses: [
        { id: 'defenseUp', turns: 2, value: 0.2 },
        { id: 'powerUp', turns: 2, value: 0.15 }
      ]
    },
    kits: [
      {
        id: 'ancestor_voice',
        name: '선조의 목소리',
        english: "Ancestor's Voice",
        classId: 'shaman',
        representative: true,
        role: '강화 · 회복',
        pros: ['강화 효과 지속시간 +1턴', '최대 에테르 +10%'],
        cons: ['직접 피해 -10%'],
        equipment: '토템·철퇴만 사용. 중갑 또는 경갑.',
        allowedWeapons: ['토템', '철퇴'],
        allowedArmor: ['중갑', '경갑'],
        ability: {
          id: 'spirit_link',
          name: '정령 연결',
          desc: '아군 하나의 공격력을 30%, 속도를 20% 높이고 3턴간 공격 시 생명력을 회복하게 한다.',
          cost: 12,
          cooldown: 3,
          target: 'ally',
          kind: 'buff',
          statuses: [
            { id: 'powerUp', turns: 3, value: 0.3 },
            { id: 'haste', turns: 3, value: 0.2 },
            { id: 'lifesteal', turns: 3, value: 0.1 }
          ]
        }
      },
      {
        id: 'storm_caller',
        name: '폭풍소환사',
        classId: 'shaman',
        representative: false,
        role: '번개 방해',
        pros: ['감전 효과 +25%', '지력 +1'],
        cons: ['방어력 -10%'],
        equipment: '토템과 지팡이. 경갑만.',
        allowedWeapons: ['토템', '지팡이'],
        allowedArmor: ['경갑'],
        ability: { name: '폭풍 부름', desc: '적 전체에 번개를 내리고 감전시킨다.' }
      },
      {
        id: 'bone_oracle',
        name: '뼈 예언자',
        classId: 'shaman',
        representative: false,
        role: '저주 · 예지',
        pros: ['적 약화 지속 +1턴', '존재감 +2'],
        cons: ['최대 생명력 -10%'],
        equipment: '토템과 뼈 의식 도구. 법의만.',
        allowedWeapons: ['토템'],
        allowedArmor: ['법의'],
        ability: { name: '뼈의 예언', desc: '적의 다음 행동을 봉쇄하고 약화시킨다.' }
      }
    ]
  },
  {
    id: 'mage',
    name: '메이지',
    english: 'Mage',
    glyph: '✦',
    color: '#8f9dff',
    role: '광역 마법',
    roleEn: 'Arcane Artillery',
    desc: '주문을 배우고 준비해 결정적인 순간에 터뜨리는 학자. 준비된 주문의 위력은 전장을 바꾼다.',
    keyStats: ['intellect', 'spirit'],
    mods: { intellect: 2, spirit: 1 },
    weapons: ['지팡이', '마법봉'],
    armor: ['법의'],
    attackKind: 'magic',
    attackReach: 'any',
    ability: {
      id: 'prism_burst',
      name: '프리즘 폭발',
      desc: '모든 적에게 1.0배 마법 피해를 주고 2턴간 화상을 부여한다.',
      cost: 14,
      cooldown: 3,
      target: 'allEnemies',
      kind: 'magic',
      power: 1,
      status: { id: 'burn', turns: 2, value: 0.05 }
    },
    kits: [
      {
        id: 'prism_scholar',
        name: '프리즘 학자',
        english: 'Prism Scholar',
        classId: 'mage',
        representative: true,
        role: '광역 폭격',
        pros: ['주문 피해 +20%', '주문 비용 -15%'],
        cons: ['최대 생명력 -20%'],
        equipment: '지팡이·마법봉만 사용. 법의 필수.',
        allowedWeapons: ['지팡이', '마법봉'],
        allowedArmor: ['법의'],
        ability: {
          id: 'prismatic_barrage',
          name: '프리즘 연격',
          desc: '무작위 적에게 0.7배 마법 피해를 3회 가하고 화상 또는 감전을 부여한다.',
          cost: 15,
          cooldown: 3,
          target: 'randomEnemies',
          kind: 'magic',
          power: 0.7,
          hits: 3,
          statuses: [
            { id: 'burn', turns: 2, value: 0.04, chance: 0.5 },
            { id: 'shock', turns: 2, value: 0.15, chance: 0.5 }
          ]
        }
      },
      {
        id: 'chrono_scribe',
        name: '시간의 필경사',
        classId: 'mage',
        representative: false,
        role: '행동 조작',
        pros: ['아군 속도 +15%', '주문 재사용 대기 -1'],
        cons: ['최대 에테르 -10%'],
        equipment: '마법봉과 시간 모래. 법의만.',
        allowedWeapons: ['마법봉'],
        allowedArmor: ['법의'],
        ability: { name: '시간 각주', desc: '아군 하나의 행동 순서를 앞당긴다.' }
      },
      {
        id: 'void_cartographer',
        name: '공허 지도제작자',
        classId: 'mage',
        representative: false,
        role: '디버프 마법',
        pros: ['적 저항 감소', '지력 +2'],
        cons: ['치명타율 -5%'],
        equipment: '지팡이와 공허 지도. 법의만.',
        allowedWeapons: ['지팡이'],
        allowedArmor: ['법의'],
        ability: { name: '공허 지도', desc: '적의 방어를 지워 지속 피해를 증폭시킨다.' }
      }
    ]
  },
  {
    id: 'sorcerer',
    name: '소서러',
    english: 'Sorcerer',
    glyph: '☄',
    color: '#ff7fa8',
    role: '폭발 마법',
    roleEn: 'Burst Caster',
    desc: '주문을 준비하지 않고 혈통에 새겨진 힘을 직접 터뜨리는 마법사. 제한된 주문을 반복해 순간 화력을 만든다.',
    keyStats: ['intellect', 'presence'],
    mods: { intellect: 2, presence: 1 },
    weapons: ['지팡이', '보주'],
    armor: ['법의'],
    attackKind: 'magic',
    attackReach: 'any',
    ability: {
      id: 'wild_cascade',
      name: '야성의 폭류',
      desc: '무작위 적에게 0.6배 마법 피해를 3회 가한다. 치명타가 터지면 에테르를 2 회복한다.',
      cost: 14,
      cooldown: 3,
      target: 'randomEnemies',
      kind: 'magic',
      power: 0.6,
      hits: 3,
      special: 'wild_echo'
    },
    kits: [
      {
        id: 'wild_ember',
        name: '야생 잿불',
        english: 'Wild Ember',
        classId: 'sorcerer',
        representative: true,
        role: '순간 폭딜',
        pros: ['주문 치명타율 +25%', '20% 확률로 주문이 한 번 더 발동'],
        cons: ['주문 사용 시 10% 확률로 반동 피해'],
        equipment: '보주·지팡이만 사용. 갑옷 불가.',
        allowedWeapons: ['보주', '지팡이'],
        allowedArmor: [],
        ability: {
          id: 'ember_cascade',
          name: '잿불 연쇄',
          desc: '무작위 적에게 0.55배 마법 피해를 4회 가한다. 치명타마다 에테르를 3 회복한다.',
          cost: 14,
          cooldown: 3,
          target: 'randomEnemies',
          kind: 'magic',
          power: 0.55,
          hits: 4,
          special: 'ember_cascade'
        }
      },
      {
        id: 'storm_blood',
        name: '폭풍의 혈통',
        classId: 'sorcerer',
        representative: false,
        role: '감전 폭격',
        pros: ['감전 적에게 피해 +20%', '민첩 +1'],
        cons: ['최대 생명력 -10%'],
        equipment: '지팡이만. 법의만.',
        allowedWeapons: ['지팡이'],
        allowedArmor: ['법의'],
        ability: { name: '혈통 폭풍', desc: '적 전체에 연쇄 번개를 방출한다.' }
      },
      {
        id: 'mirror_spark',
        name: '거울 불꽃',
        classId: 'sorcerer',
        representative: false,
        role: '반사 마법',
        pros: ['피격 시 주문 반사', '정신 +1'],
        cons: ['방어력 -15%'],
        equipment: '보주와 거울 조각. 갑옷 불가.',
        allowedWeapons: ['보주'],
        allowedArmor: [],
        ability: { name: '거울 불꽃', desc: '받은 피해의 일부를 마법으로 되돌린다.' }
      }
    ]
  },
  {
    id: 'spellsword',
    name: '스펠소드',
    english: 'Spellsword',
    glyph: '⚔',
    color: '#7fd8d1',
    role: '전투 마법사',
    roleEn: 'Hybrid Duelist',
    desc: '검과 주문을 한 호흡으로 엮는 전투 마법사. 무기 공격에 마법을 실어 적의 방어를 갈라낸다.',
    keyStats: ['might', 'intellect'],
    mods: { might: 1, intellect: 2 },
    weapons: ['검', '지팡이'],
    armor: ['중갑', '경갑'],
    attackKind: 'physical',
    attackReach: 'front',
    ability: {
      id: 'runed_edge',
      name: '룬 검격',
      desc: '전열의 적에게 물리 1.2배와 마법 0.8배 피해를 주고 2턴간 감전시킨다.',
      cost: 10,
      cooldown: 2,
      target: 'enemy',
      kind: 'mixed',
      power: 1.2,
      magicPower: 0.8,
      reach: 'front',
      status: { id: 'shock', turns: 2, value: 0.15 }
    },
    kits: [
      {
        id: 'runeblade_duelist',
        name: '룬검 결투가',
        english: 'Runeblade Duelist',
        classId: 'spellsword',
        representative: true,
        role: '혼합 딜러',
        pros: ['혼합 피해 +15%', '적 강화 효과 해제'],
        cons: ['받는 회복량 -10%'],
        equipment: '한손검과 집중 도구만 사용. 중갑 또는 경갑.',
        allowedWeapons: ['한손검', '집중도구'],
        allowedArmor: ['중갑', '경갑'],
        ability: {
          id: 'sunder_sigil',
          name: '문양 분쇄',
          desc: '적 하나에게 물리 1.3배와 마법 1.0배 피해를 주고 강화 효과를 해제하며 감전시킨다.',
          cost: 10,
          cooldown: 2,
          target: 'enemy',
          kind: 'mixed',
          power: 1.3,
          magicPower: 1,
          reach: 'any',
          status: { id: 'shock', turns: 2, value: 0.15 },
          special: 'dispel'
        }
      },
      {
        id: 'frost_warden',
        name: '서리 검객',
        classId: 'spellsword',
        representative: false,
        role: '냉기 제어',
        pros: ['적 속도 감소', '정신 +1'],
        cons: ['공격 속도 -10%'],
        equipment: '검과 냉기 성물. 중갑만.',
        allowedWeapons: ['한손검', '성물'],
        allowedArmor: ['중갑'],
        ability: { name: '서리 문양', desc: '적을 얼려 행동을 늦추고 방어를 낮춘다.' }
      },
      {
        id: 'ember_blade',
        name: '잿불 검사',
        classId: 'spellsword',
        representative: false,
        role: '화염 연격',
        pros: ['공격 시 화상 부여', '근력 +1'],
        cons: ['최대 에테르 -10%'],
        equipment: '양손검과 화염 성물. 경갑만.',
        allowedWeapons: ['양손검', '성물'],
        allowedArmor: ['경갑'],
        ability: { name: '잿불 검무', desc: '검에 불을 실어 적 전열을 태운다.' }
      }
    ]
  },
  {
    id: 'thief',
    name: '시프',
    english: 'Thief',
    glyph: '🗡',
    color: '#c0a6ff',
    role: '함정 · 기습',
    roleEn: 'Trapfinder / Assassin',
    desc: '함정을 읽고 자물쇠를 속이며 적의 급소를 노리는 책략가. 전장에서는 낮은 생명력의 적을 정리한다.',
    keyStats: ['agility', 'presence'],
    mods: { agility: 2, presence: 1 },
    weapons: ['단검', '단궁'],
    armor: ['경갑'],
    attackKind: 'physical',
    attackReach: 'any',
    ability: {
      id: 'shadow_strike',
      name: '그림자 습격',
      desc: '적 하나를 1.7배로 찌른다. 치명타율 +30%, 생명력 50% 이하 적에게 피해 +50%.',
      cost: 8,
      cooldown: 2,
      target: 'enemy',
      kind: 'physical',
      power: 1.7,
      reach: 'any',
      special: 'shadow_strike'
    },
    kits: [
      {
        id: 'nightglass_cutpurse',
        name: '밤유리 소매치기',
        english: 'Nightglass Cutpurse',
        classId: 'thief',
        representative: true,
        role: '암살 · 금화',
        pros: ['치명타율 +25%', '전리품 금화 +15%'],
        cons: ['최대 생명력 -15%'],
        equipment: '단검·단궁만 사용. 경갑 필수.',
        allowedWeapons: ['단검', '단궁'],
        allowedArmor: ['경갑'],
        ability: {
          id: 'nightglass_strike',
          name: '밤유리 찌르기',
          desc: '적 하나의 방어를 절반 무시하고 2.2배 피해를 준다. 적중 시 금화를 훔친다.',
          cost: 10,
          cooldown: 3,
          target: 'enemy',
          kind: 'physical',
          power: 2.2,
          reach: 'any',
          pierce: 0.5,
          special: 'steal'
        }
      },
      {
        id: 'lock_whisper',
        name: '자물쇠 속삭임',
        classId: 'thief',
        representative: false,
        role: '탐사 · 보물',
        pros: ['함정 피해 무효', '보물 상자 추가 보상'],
        cons: ['전투 피해 -10%'],
        equipment: '단검과 도구. 경갑만.',
        allowedWeapons: ['단검'],
        allowedArmor: ['경갑'],
        ability: { name: '자물쇠 속삭임', desc: '적의 보호를 풀고 아군의 다음 공격을 돕는다.' }
      },
      {
        id: 'poison_ledger',
        name: '독 장부',
        classId: 'thief',
        representative: false,
        role: '독살',
        pros: ['독 피해 +30%', '민첩 +1'],
        cons: ['방어력 -10%'],
        equipment: '단검과 독병. 경갑만.',
        allowedWeapons: ['단검'],
        allowedArmor: ['경갑'],
        ability: { name: '독 장부', desc: '적의 약점을 기록해 독을 중첩시킨다.' }
      }
    ]
  },
  {
    id: 'bard',
    name: '바드',
    english: 'Bard',
    glyph: '♪',
    color: '#ffb3d1',
    role: '파티 지원',
    roleEn: 'Party Buffer',
    desc: '노래와 마법으로 파티 전체의 박자를 맞추는 지원가. 공격보다 아군의 능력을 끌어올리는 데 능하다.',
    keyStats: ['presence', 'spirit'],
    mods: { presence: 2, spirit: 1 },
    weapons: ['악기', '검'],
    armor: ['경갑', '중갑'],
    attackKind: 'magic',
    attackReach: 'any',
    ability: {
      id: 'rallying_verse',
      name: '전진의 시',
      desc: '모든 아군의 공격력을 20%, 치명타율을 10% 높이고 약화 효과를 정화한다. 3턴 지속.',
      cost: 10,
      cooldown: 3,
      target: 'allAllies',
      kind: 'buff',
      statuses: [
        { id: 'powerUp', turns: 3, value: 0.2 },
        { id: 'critUp', turns: 3, value: 0.1 }
      ],
      cleanse: 1
    },
    kits: [
      {
        id: 'resonance_conductor',
        name: '공명 지휘자',
        english: 'Resonance Conductor',
        classId: 'bard',
        representative: true,
        role: '파티 강화',
        pros: ['강화 효과 +20%', '에테르 재생 +10%'],
        cons: ['무기 피해 -20%'],
        equipment: '악기·경검만 사용. 경갑 필수.',
        allowedWeapons: ['악기', '경검'],
        allowedArmor: ['경갑'],
        ability: {
          id: 'anthem_of_steel',
          name: '강철의 노래',
          desc: '모든 아군의 공격력을 25%, 속도를 15% 높이고 최대 생명력 8%를 회복한다. 3턴 지속.',
          cost: 12,
          cooldown: 3,
          target: 'allAllies',
          kind: 'buff',
          heal: 0.08,
          statuses: [
            { id: 'powerUp', turns: 3, value: 0.25 },
            { id: 'haste', turns: 3, value: 0.15 }
          ]
        }
      },
      {
        id: 'dirge_weaver',
        name: '비가 직조자',
        classId: 'bard',
        representative: false,
        role: '저주 · 약화',
        pros: ['적 약화 효과 +20%', '존재감 +2'],
        cons: ['아군 회복량 -10%'],
        equipment: '악기와 검. 경갑만.',
        allowedWeapons: ['악기', '경검'],
        allowedArmor: ['경갑'],
        ability: { name: '비가의 실', desc: '적 전체의 공격력을 낮추고 침묵시킨다.' }
      },
      {
        id: 'dawn_choir',
        name: '새벽 합창단',
        classId: 'bard',
        representative: false,
        role: '회복 합창',
        pros: ['아군 회복량 +20%', '정신 +1'],
        cons: ['최대 생명력 -10%'],
        equipment: '악기와 성물. 경갑만.',
        allowedWeapons: ['악기', '성물'],
        allowedArmor: ['경갑'],
        ability: { name: '새벽 합창', desc: '노래로 아군 전원의 상처를 닫는다.' }
      }
    ]
  },
  {
    id: 'monk',
    name: '몽크',
    english: 'Monk',
    glyph: '✊',
    color: '#f0c98a',
    role: '기동 · 자기강화',
    roleEn: 'Mobile Skirmisher',
    desc: '맨몸과 호흡을 무기로 삼는 수행자. 빠른 연격과 회피로 적의 허를 찌르고 스스로를 단련한다.',
    keyStats: ['agility', 'spirit'],
    mods: { agility: 2, spirit: 1 },
    weapons: ['맨손', '지팡이'],
    armor: [],
    attackKind: 'physical',
    attackReach: 'front',
    ability: {
      id: 'flowing_palm',
      name: '흐르는 장법',
      desc: '전열의 적에게 0.55배 공격을 3회 가하고 2턴간 자신의 속도를 20% 높인다.',
      cost: 8,
      cooldown: 2,
      target: 'enemy',
      kind: 'physical',
      power: 0.55,
      hits: 3,
      reach: 'front',
      selfStatus: { id: 'haste', turns: 2, value: 0.2 }
    },
    kits: [
      {
        id: 'temple_wind',
        name: '사원의 바람',
        english: 'Temple Wind',
        classId: 'monk',
        representative: true,
        role: '연격 · 회피',
        pros: ['비무장 피해 +20%', '회피율 +15%'],
        cons: ['갑옷 착용 불가'],
        equipment: '맨손·지팡이만 사용. 모든 갑옷 착용 불가.',
        allowedWeapons: ['맨손', '지팡이'],
        allowedArmor: [],
        ability: {
          id: 'cyclone_palm',
          name: '회오리 장법',
          desc: '무작위 적에게 0.5배 공격을 4회 가하고 2턴간 회피율을 20% 높인다.',
          cost: 10,
          cooldown: 3,
          target: 'randomEnemies',
          kind: 'physical',
          power: 0.5,
          hits: 4,
          selfStatus: { id: 'evadeUp', turns: 2, value: 0.2 }
        }
      },
      {
        id: 'iron_breath',
        name: '강철 호흡',
        classId: 'monk',
        representative: false,
        role: '반격 · 생존',
        pros: ['피격 시 반격', '최대 생명력 +15%'],
        cons: ['속도 -10%'],
        equipment: '맨손과 경갑. 무기 불가.',
        allowedWeapons: ['맨손'],
        allowedArmor: ['경갑'],
        ability: { name: '강철 호흡', desc: '호흡을 가다듬어 받은 피해를 되돌린다.' }
      },
      {
        id: 'four_gates',
        name: '사문의 춤',
        classId: 'monk',
        representative: false,
        role: '속도 · 연격',
        pros: ['속도 +20%', '연격 피해 +15%'],
        cons: ['방어력 -15%'],
        equipment: '맨손만. 갑옷 불가.',
        allowedWeapons: ['맨손'],
        allowedArmor: [],
        ability: { name: '사문의 춤', desc: '네 방향에서 연속 공격을 가한다.' }
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Status effects
// ---------------------------------------------------------------------------

export const STATUSES = {
  taunt: { name: '도발', glyph: '!', type: 'debuff' },
  mark: { name: '표식', glyph: '◎', type: 'debuff' },
  poison: { name: '독', glyph: '☠', type: 'dot' },
  burn: { name: '화상', glyph: '🔥', type: 'dot' },
  regen: { name: '재생', glyph: '✚', type: 'hot' },
  slow: { name: '둔화', glyph: '⌛', type: 'debuff' },
  haste: { name: '가속', glyph: '»', type: 'buff' },
  powerUp: { name: '강화', glyph: '↑', type: 'buff' },
  defenseUp: { name: '수호', glyph: '◆', type: 'buff' },
  critUp: { name: '집중', glyph: '◉', type: 'buff' },
  weaken: { name: '약화', glyph: '↓', type: 'debuff' },
  shock: { name: '감전', glyph: 'ϟ', type: 'debuff' },
  stun: { name: '기절', glyph: '✶', type: 'control' },
  shield: { name: '보호막', glyph: '▣', type: 'shield' },
  evadeUp: { name: '회피', glyph: '≈', type: 'buff' },
  lifesteal: { name: '흡혈', glyph: '❧', type: 'buff' },
  guard: { name: '방어', glyph: '◈', type: 'buff' },
  silence: { name: '침묵', glyph: '×', type: 'control' }
};

// ---------------------------------------------------------------------------
// Foes
// ---------------------------------------------------------------------------

export const ENEMIES = {
  wisp: {
    id: 'wisp',
    name: '공허의 등불',
    glyph: '✧',
    color: '#9fd6ff',
    role: '원거리 술사',
    hp: 0.78,
    power: 0.8,
    spell: 1.18,
    defense: 0.55,
    resolve: 0.8,
    speed: 1.08,
    ability: {
      name: '공허 파편',
      desc: '무작위 아군 2명에게 마법 피해를 준다.',
      target: 'randomEnemies',
      kind: 'magic',
      power: 0.8,
      hits: 2,
      cooldown: 2
    }
  },
  hound: {
    id: 'hound',
    name: '가시 사냥개',
    glyph: '❧',
    color: '#c8d96f',
    role: '돌격수',
    hp: 0.92,
    power: 1.12,
    spell: 0.4,
    defense: 0.72,
    resolve: 0.45,
    speed: 1.16,
    ability: {
      name: '가시 돌진',
      desc: '전열 아군 하나에게 큰 피해를 주고 출혈을 남긴다.',
      target: 'enemy',
      kind: 'physical',
      power: 1.4,
      status: { id: 'poison', turns: 2, value: 0.035 },
      cooldown: 2
    }
  },
  knight: {
    id: 'knight',
    name: '잿빛 기사',
    glyph: '♜',
    color: '#ff9e7a',
    role: '중장 보병',
    hp: 1.3,
    power: 1.08,
    spell: 0.45,
    defense: 1.22,
    resolve: 0.72,
    speed: 0.82,
    ability: {
      name: '재의 일격',
      desc: '전열 아군 하나를 강하게 내리치고 방어를 낮춘다.',
      target: 'enemy',
      kind: 'physical',
      power: 1.35,
      status: { id: 'weaken', turns: 2, value: 0.15 },
      cooldown: 2
    }
  },
  wraith: {
    id: 'wraith',
    name: '거울 망령',
    glyph: '◈',
    color: '#c0a6ff',
    role: '교란 술사',
    hp: 0.72,
    power: 0.7,
    spell: 1.22,
    defense: 0.55,
    resolve: 1.02,
    speed: 1.18,
    ability: {
      name: '거울 파열',
      desc: '무작위 아군 3명에게 마법 피해를 주고 표식을 남긴다.',
      target: 'randomEnemies',
      kind: 'magic',
      power: 0.62,
      hits: 3,
      status: { id: 'mark', turns: 2, value: 0.2 },
      cooldown: 2
    }
  },
  sentinel: {
    id: 'sentinel',
    name: '돌의 파수꾼',
    glyph: '⬢',
    color: '#b7a58c',
    role: '수호 병기',
    hp: 1.55,
    power: 0.92,
    spell: 0.55,
    defense: 1.4,
    resolve: 0.95,
    speed: 0.72,
    ability: {
      name: '지진 파동',
      desc: '모든 아군에게 물리 피해를 주고 속도를 낮춘다.',
      target: 'allEnemies',
      kind: 'physical',
      power: 0.72,
      status: { id: 'slow', turns: 2, value: 0.3 },
      cooldown: 3
    }
  },
  moth: {
    id: 'moth',
    name: '공허 나방',
    glyph: '✺',
    color: '#d8c4ff',
    role: '군집',
    hp: 0.6,
    power: 0.72,
    spell: 1.0,
    defense: 0.42,
    resolve: 0.62,
    speed: 1.3,
    ability: {
      name: '공허 가루',
      desc: '모든 아군에게 작은 마법 피해를 준다.',
      target: 'allEnemies',
      kind: 'magic',
      power: 0.48,
      cooldown: 2
    }
  },
  warden: {
    id: 'warden',
    name: '잿빛 감시관',
    glyph: '♛',
    color: '#ffb36b',
    role: '층의 수호자',
    boss: true,
    hp: 4.6,
    power: 1.18,
    spell: 0.9,
    defense: 1.3,
    resolve: 1.05,
    speed: 0.9,
    abilities: [
      {
        name: '잿빛 판결',
        desc: '모든 아군에게 물리 피해를 주고 화상을 부여한다.',
        target: 'allEnemies',
        kind: 'physical',
        power: 0.85,
        status: { id: 'burn', turns: 2, value: 0.04 },
        cooldown: 2
      },
      {
        name: '사슬 끌기',
        desc: '전열 아군 하나를 끌어와 큰 피해를 준다.',
        target: 'enemy',
        kind: 'physical',
        power: 1.8,
        status: { id: 'stun', turns: 1, value: 1, chance: 0.35 },
        cooldown: 3
      }
    ]
  },
  crown: {
    id: 'crown',
    name: '공허의 왕관',
    glyph: '♛',
    color: '#ffd479',
    role: '최종 수호자',
    boss: true,
    hp: 6.4,
    power: 1.3,
    spell: 1.2,
    defense: 1.35,
    resolve: 1.25,
    speed: 1.02,
    abilities: [
      {
        name: '왕관의 칙령',
        desc: '모든 아군에게 마법 피해를 주고 공격력을 낮춘다.',
        target: 'allEnemies',
        kind: 'magic',
        power: 0.95,
        status: { id: 'weaken', turns: 2, value: 0.2 },
        cooldown: 2
      },
      {
        name: '거울 왕좌',
        desc: '무작위 아군 4명에게 마법 피해를 주고 표식을 남긴다.',
        target: 'randomEnemies',
        kind: 'magic',
        power: 0.7,
        hits: 4,
        status: { id: 'mark', turns: 2, value: 0.2 },
        cooldown: 3
      }
    ]
  }
};

export const ENCOUNTER_POOLS = {
  1: ['wisp', 'hound', 'moth', 'knight', 'wisp', 'hound'],
  2: ['hound', 'knight', 'wisp', 'wraith', 'moth', 'sentinel'],
  3: ['knight', 'sentinel', 'wraith', 'wisp', 'hound', 'moth'],
  4: ['wraith', 'sentinel', 'knight', 'wisp', 'moth', 'hound'],
  5: ['knight', 'wraith', 'sentinel', 'wisp', 'hound', 'moth']
};

export const FLOORS = [
  {
    id: 1,
    name: '잿빛 금고',
    english: 'The Cinder Vaults',
    desc: '식은 화로와 부서진 사슬이 늘어선 첫 번째 층. 공허의 등불이 어둠 속에서 숨을 쉰다.',
    accent: '#ff9a58',
    accent2: '#e1534d',
    floor: '#24161a',
    floorAlt: '#2c1a1f',
    wall: '#3a2426',
    wallTop: '#5a3530',
    fog: '#100a0d'
  },
  {
    id: 2,
    name: '이끼 낀 성소',
    english: 'The Verdant Reliquary',
    desc: '뿌리가 성벽을 삼킨 버려진 성소. 가시 사냥개의 울음이 복도 끝에서 메아리친다.',
    accent: '#65e0b6',
    accent2: '#c5d96f',
    floor: '#14211e',
    floorAlt: '#182925',
    wall: '#243831',
    wallTop: '#345046',
    fog: '#09110f'
  },
  {
    id: 3,
    name: '별의 첨탑',
    english: 'The Astral Spire',
    desc: '천장이 별자리로 열린 첨탑. 거울 망령이 부서진 반사 속에서 걸어 나온다.',
    accent: '#a38bff',
    accent2: '#68c9ff',
    floor: '#17182b',
    floorAlt: '#1d1e35',
    wall: '#2a2b4b',
    wallTop: '#41436b',
    fog: '#0a0a14'
  },
  {
    id: 4,
    name: '공허의 회랑',
    english: 'The Hollow Gallery',
    desc: '초상화 속 눈동자가 움직이는 회랑. 왕관의 의지가 벽마다 스며 있다.',
    accent: '#ffd479',
    accent2: '#ff6e9d',
    floor: '#211523',
    floorAlt: '#291a2b',
    wall: '#3b2540',
    wallTop: '#5c3763',
    fog: '#0c060d'
  },
  {
    id: 5,
    name: '왕관의 심장',
    english: 'The Crown’s Heart',
    desc: '탑의 가장 깊은 곳. 공허의 왕관이 모든 실패한 탐험가의 형체를 빌려 기다린다.',
    accent: '#ffd479',
    accent2: '#ff6e9d',
    floor: '#1b1020',
    floorAlt: '#24152b',
    wall: '#33203a',
    wallTop: '#55305c',
    fog: '#08040a'
  }
];

export function floorData(floor) {
  return FLOORS[Math.min(FLOORS.length - 1, Math.max(0, floor - 1))];
}

export function classById(id) {
  return CLASSES.find((c) => c.id === id);
}

export function raceById(id) {
  return RACES.find((r) => r.id === id);
}

export function kitById(classId, kitId) {
  const cls = classById(classId);
  return cls?.kits.find((k) => k.id === kitId) || null;
}

export function representativeKit(classId) {
  return classById(classId)?.kits.find((k) => k.representative) || null;
}

export const NAME_POOL = [
  '리라', '카엘', '세린', '도른', '미라', '아셀', '베일', '타린', '유나', '로웬',
  '이든', '시온', '하루', '네리스', '오르가', '벨크', '사피아', '레온', '쿠르', '아린'
];

export const TITLE_NAMES = [
  '잿불의', '새벽의', '공허의', '이끼의', '별의', '왕관의', '무덤의', '철의', '안개의', '달의'
];
