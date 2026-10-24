const SYMBOLS = ['⚙', '◉', '⌁', '✦', '◇', '☼', '▱', '⬡'];
const grid = document.querySelector('#grid');
let cards = [];
let rng = Math.random;
let open = [];
let matched = 0;
let moves = 0;
let locked = false;
let running = false;
let paused = false;
let seconds = 0;
let activeMs = 0;
let resumedAt = 0;
let timer = null;
let flipBack = null;

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

function format(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function elapsedMs() { return activeMs + (running && !paused ? Date.now() - resumedAt : 0); }

function sendHud() {
  Scorex.hud({ score: moves, progress: matched / 8, status: format(seconds) });
}

function build() {
  const deck = [...SYMBOLS, ...SYMBOLS];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  grid.replaceChildren(...deck.map((symbol, index) => {
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.disabled = true;
    card.dataset.symbol = symbol;
    card.textContent = '?';
    card.setAttribute('aria-label', `${index + 1}번째 카드, 뒤집혀 있음`);
    card.addEventListener('click', () => flip(card));
    return card;
  }));
  cards = [...grid.children];
}

function setEnabled(on) {
  cards.forEach((card) => { card.disabled = !on || card.classList.contains('matched'); });
}

function flip(card) {
  if (!running || paused || locked || card.classList.contains('open') || card.classList.contains('matched')) return;
  card.classList.add('open');
  card.textContent = card.dataset.symbol;
  open.push(card);
  if (open.length < 2) return;
  moves += 1;
  const [first, second] = open;
  if (first.dataset.symbol === second.dataset.symbol) {
    [first, second].forEach((c) => { c.classList.add('matched'); c.disabled = true; });
    matched += 1;
    open = [];
    sendHud();
    if (matched === 8) finish();
  } else {
    locked = true;
    sendHud();
    flipBack = setTimeout(hideOpen, 750);
  }
}

function hideOpen() {
  open.forEach((c) => { c.classList.remove('open'); c.textContent = '?'; });
  open = [];
  locked = false;
  flipBack = null;
}

function finish() {
  clearInterval(timer);
  const durationMs = Math.round(elapsedMs());
  running = false;
  activeMs = durationMs;
  setEnabled(false);
  Scorex.gameOver({
    score: Math.max(100, 1200 - moves * 40 - seconds * 5),
    durationMs,
    result: 'clear',
    meta: { moves, seconds }
  });
}

function startTimer() {
  resumedAt = Date.now();
  timer = setInterval(() => { seconds += 1; sendHud(); }, 1000);
}

Scorex.onInit((init) => {
  rng = seeded(init.seed);
  clearInterval(timer);
  clearTimeout(flipBack);
  open = []; matched = 0; moves = 0; seconds = 0; activeMs = 0; locked = false; running = false; paused = false;
  build();
});
Scorex.onStart(() => {
  running = true; paused = false;
  setEnabled(true);
  Scorex.started();
  sendHud();
  startTimer();
});
Scorex.onPause(() => {
  if (!running) return;
  activeMs += Date.now() - resumedAt;
  paused = true;
  clearInterval(timer);
  setEnabled(false);
});
Scorex.onResume(() => {
  if (!running) return;
  paused = false;
  setEnabled(true);
  startTimer();
});
Scorex.onDestroy(() => { clearInterval(timer); clearTimeout(flipBack); running = false; });

build();
Scorex.connect({ gameId: 'memory', gameVersion: '1.0.0' });
