const arena = document.querySelector('#arena');
const text = document.querySelector('#text');
const hint = document.querySelector('#hint');
let rng = Math.random;
let state = 'idle';
let timer = null;
let startedAt = 0;
let readyAt = 0;
let paused = false;

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function show(name, title, note, status) {
  state = name;
  arena.className = name === 'waiting' || name === 'ready' || name === 'result' ? name : '';
  text.textContent = title;
  hint.textContent = note;
  if (status) Scorex.hud({ status });
}

function arm() {
  clearTimeout(timer);
  show('waiting', '초록색이 될 때까지 기다려요', '도킹 신호 전까지 대기하세요.', 'WAIT');
  timer = setTimeout(() => {
    if (state !== 'waiting' || paused) return;
    readyAt = performance.now();
    show('ready', '지금 클릭!', '결합 신호가 점등되었습니다.', 'GO!');
  }, 1200 + rng() * 2200);
}

arena.addEventListener('click', () => {
  if (paused) return;
  if (state === 'waiting') {
    // 너무 일찍 누르면 같은 플레이 안에서 대기를 다시 시작한다.
    clearTimeout(timer);
    show('early', '신호보다 빨랐습니다!', '잠시 후 다시 대기합니다.', 'FALSE START');
    timer = setTimeout(arm, 1000);
    return;
  }
  if (state !== 'ready') return;
  const elapsed = Math.round(performance.now() - readyAt);
  show('result', `${elapsed} ms`, '도킹 성공', 'RESULT');
  Scorex.gameOver({
    score: Math.max(1, Math.min(999, 1000 - elapsed)),
    durationMs: Math.round(performance.now() - startedAt),
    result: 'clear',
    meta: { elapsed }
  });
});

Scorex.onInit((init) => {
  rng = seeded(init.seed);
  clearTimeout(timer);
  show('idle', '도킹 신호 대기', '결합 신호가 점등되면 확인하세요.');
});
Scorex.onStart(() => {
  startedAt = performance.now();
  Scorex.started();
  arm();
});
Scorex.onPause(() => { paused = true; });
Scorex.onResume(() => {
  paused = false;
  // 일시정지 중에 신호가 지나갔다면 대기를 다시 시작한다.
  if (state === 'waiting' || state === 'ready') arm();
});
Scorex.onDestroy(() => clearTimeout(timer));
Scorex.connect({ gameId: 'reaction', gameVersion: '1.0.0' });
