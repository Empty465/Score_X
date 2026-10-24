// 기본 게임의 카드 장식(순수 외형)입니다. 여기에 없는 게임은 매니페스트의 icon으로 만든 기본 카드를 사용합니다.
// artMarkup은 신뢰하는 저장소 코드에서만 가져오며, 매니페스트(외부 입력)에서는 읽지 않습니다.
export const cardArt = {
  snake: {
    cardClass: 'snake',
    artClass: 'snake-art',
    artMarkup: '<span class="snake-orbit orbit-one"></span><span class="snake-orbit orbit-two"></span><span class="snake-piece piece-a"></span><span class="snake-piece piece-b"></span><span class="snake-piece piece-c"></span><span class="snake-piece piece-d"></span><span class="snake-food">✳</span>',
    bestDefault: '0'
  },
  memory: {
    cardClass: 'memory',
    artClass: 'memory-art',
    artMarkup: '<span class="memory-tile tile-one">✿</span><span class="memory-tile tile-two">☀</span><span class="memory-tile tile-three">✿</span><span class="memory-tile tile-four">?</span><span class="memory-spark">✦</span>',
    bestDefault: '—'
  },
  reaction: {
    cardClass: 'reaction',
    artClass: 'reaction-art',
    artMarkup: '<span class="reaction-ring ring-one"></span><span class="reaction-ring ring-two"></span><span class="reaction-bolt">↯</span><span class="reaction-dot"></span>',
    bestDefault: '—'
  },
  mole: {
    cardClass: 'mole',
    artClass: 'mole-art',
    artMarkup: '<span class="mole-hole-art hole-art-one">🐹</span><span class="mole-hole-art hole-art-two"></span><span class="mole-hole-art hole-art-three">🐹</span><span class="mole-art-spark">✦</span>',
    bestDefault: '0'
  },
  baseball: {
    cardClass: 'baseball',
    artClass: 'baseball-art',
    artMarkup: '<span class="baseball-number number-one">3</span><span class="baseball-number number-two">7</span><span class="baseball-number number-three">1</span><span class="baseball-hint">?</span>',
    bestDefault: '—'
  },
  rocket: {
    cardClass: 'rocket',
    artClass: 'rocket-art',
    artMarkup: '<span class="rocket-art-orbit"></span><span class="rocket-art-moon"></span><span class="rocket-art-pad"></span><span class="rocket-art-ship">▲</span><span class="rocket-art-flame">▾</span>',
    bestDefault: '—'
  },
  clop: {
    cardClass: 'clop',
    artClass: 'clop-art',
    artMarkup: '<span class="clop-art-ground"></span><span class="clop-art-flag">⚑</span><span class="clop-art-walker">🤖</span>',
    bestDefault: '—'
  },
  galaga: {
    cardClass: 'galaga',
    artClass: 'galaga-art',
    artMarkup: '<span class="galaga-star star-one"></span><span class="galaga-star star-two"></span><span class="galaga-star star-three"></span><span class="galaga-enemy enemy-one">✦</span><span class="galaga-enemy enemy-two">✦</span><span class="galaga-shot shot-one"></span><span class="galaga-shot shot-two"></span><span class="galaga-player">▲</span>',
    bestDefault: '—'
  },
  tetris: {
    cardClass: 'tetris',
    artClass: 'tetris-art',
    artMarkup: '<span class="tetris-stack"><span class="tetris-block block-one"></span><span class="tetris-block block-two"></span><span class="tetris-block block-three"></span><span class="tetris-block block-four"></span><span class="tetris-block block-five"></span><span class="tetris-block block-six"></span><span class="tetris-active"></span></span>',
    bestDefault: '—'
  },
  dino: {
    cardClass: 'dino',
    artClass: 'dino-art',
    artMarkup: '<span class="dino-moon"></span><span class="dino-ground"></span><span class="dino-rock"></span><span class="dino-rover"><i></i><b></b><em></em></span><span class="dino-drone">◆</span><span class="dino-scan"></span>',
    bestDefault: '—'
  }
};

// 메뉴 정렬: 기본 게임은 위 순서대로, 그 외는 서버가 준 순서(폴더 이름순) 뒤에 붙습니다.
export const builtinOrder = Object.keys(cardArt);
