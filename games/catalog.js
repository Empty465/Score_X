const gameCatalog = [
  {
    id: 'snake',
    module: './games/snake.js',
    title: '우주 쓰레기 수거',
    icon: '↝',
    shortTitle: '수거',
    category: 'ORBITAL DEBRIS',
    description: '궤도 파편과 에너지 코어를 회수하세요.',
    cardClass: 'snake',
    artClass: 'snake-art',
    artMarkup: '<span class="snake-orbit orbit-one"></span><span class="snake-orbit orbit-two"></span><span class="snake-piece piece-a"></span><span class="snake-piece piece-b"></span><span class="snake-piece piece-c"></span><span class="snake-piece piece-d"></span><span class="snake-food">✳</span>',
    bestDefault: '0'
  },
  {
    id: 'memory',
    module: './games/memory.js',
    title: '시스템 오류 복구',
    icon: '▦',
    shortTitle: '복구',
    category: 'SYSTEM REBOOT',
    description: '기억을 되살려 회로 짝을 맞추세요.',
    cardClass: 'memory',
    artClass: 'memory-art',
    artMarkup: '<span class="memory-tile tile-one">✿</span><span class="memory-tile tile-two">☀</span><span class="memory-tile tile-three">✿</span><span class="memory-tile tile-four">?</span><span class="memory-spark">✦</span>',
    bestDefault: '—'
  },
  {
    id: 'reaction',
    module: './games/reaction.js',
    title: '수동 도킹 시퀀스',
    icon: '✳',
    shortTitle: '도킹',
    category: 'MANUAL DOCKING',
    description: '레이더 신호에 맞춰 도킹을 완료하세요.',
    cardClass: 'reaction',
    artClass: 'reaction-art',
    artMarkup: '<span class="reaction-ring ring-one"></span><span class="reaction-ring ring-two"></span><span class="reaction-bolt">↯</span><span class="reaction-dot"></span>',
    bestDefault: '—'
  },
  {
    id: 'mole',
    module: './games/mole.js',
    title: '비상 경고등 진압',
    icon: '⌁',
    shortTitle: '경고',
    category: 'EMERGENCY',
    description: '과부하 경고가 켜지면 빠르게 차단하세요.',
    cardClass: 'mole',
    artClass: 'mole-art',
    artMarkup: '<span class="mole-hole-art hole-art-one">🐹</span><span class="mole-hole-art hole-art-two"></span><span class="mole-hole-art hole-art-three">🐹</span><span class="mole-art-spark">✦</span>',
    bestDefault: '0'
  },
  {
    id: 'baseball',
    module: './games/baseball.js',
    title: '궤도 진입 좌표 해독',
    icon: '#',
    shortTitle: '좌표',
    category: 'SECURE TERMINAL',
    description: '터미널 신호를 분석해 9번 안에 숨겨진 보안 코드를 해독하세요.',
    cardClass: 'baseball',
    artClass: 'baseball-art',
    artMarkup: '<span class="baseball-number number-one">3</span><span class="baseball-number number-two">7</span><span class="baseball-number number-three">1</span><span class="baseball-hint">?</span>',
    bestDefault: '—'
  },
  {
    id: 'rocket',
    module: './games/rocket.js',
    title: '1단 부스터 회수',
    icon: '▲',
    shortTitle: '부스터',
    category: 'BOOSTER RECOVERY',
    description: '고도와 속도를 조절해 수직 착륙하세요.',
    cardClass: 'rocket',
    artClass: 'rocket-art',
    artMarkup: '<span class="rocket-art-orbit"></span><span class="rocket-art-moon"></span><span class="rocket-art-pad"></span><span class="rocket-art-ship">▲</span><span class="rocket-art-flame">▾</span>',
    bestDefault: '—'
  }
];

if (typeof window !== 'undefined') window.PlaygroundGameCatalog = gameCatalog;
if (typeof module !== 'undefined' && module.exports) module.exports = gameCatalog;
