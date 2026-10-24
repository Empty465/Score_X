const DURATION_SEC = 20;
const grid = document.querySelector('#grid');
const holes = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement('button');
  button.className = 'hole';
  button.type = 'button';
  button.disabled = true;
  button.setAttribute('aria-label', `${index + 1}번 비상 스위치`);
  button.innerHTML = '<span>!</span>';
  button.addEventListener('click', () => hit(index));
  grid.append(button);
  return button;
});
let rng = Math.random;
let active = new Set();
let score = 0;
let ticks = 0;
let running = false;
let paused = false;
let timer = null;
let spawn = null;

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

function render() {
  holes.forEach((button, index) => {
    button.classList.toggle('active', active.has(index));
    button.disabled = !running || paused;
  });
}

function stopTimers() { clearInterval(timer); clearTimeout(spawn); timer = null; spawn = null; }

function next() {
  if (!running || paused) return;
  const roll = rng();
  const count = roll < .62 ? 1 : roll < .92 ? 2 : 3;
  const available = Array.from({ length: holes.length }, (_, index) => index);
  active = new Set();
  for (let index = 0; index < count; index += 1) {
    const candidateIndex = Math.floor(rng() * available.length);
    active.add(available.splice(candidateIndex, 1)[0]);
  }
  render();
  spawn = setTimeout(() => {
    active.clear();
    render();
    spawn = setTimeout(next, 120);
  }, 600 + count * 300 + rng() * 250);
}

function hit(index) {
  if (!running || paused || !active.has(index)) return;
  score += 1;
  active.delete(index);
  render();
  Scorex.hud({ score: score * 20 });
  if (active.size === 0) {
    clearTimeout(spawn);
    spawn = setTimeout(next, 120);
  }
}

function startTimers() {
  next();
  timer = setInterval(() => {
    ticks += 1;
    Scorex.hud({ time: DURATION_SEC - ticks, score: score * 20, danger: DURATION_SEC - ticks <= 5 });
    if (ticks >= DURATION_SEC) finish();
  }, 1000);
}

function finish() {
  stopTimers();
  running = false;
  active.clear();
  render();
  Scorex.gameOver({ score: score * 20, durationMs: ticks * 1000, result: 'clear', meta: { hits: score } });
}

Scorex.onInit((init) => {
  rng = seeded(init.seed);
  stopTimers();
  running = false; paused = false; active.clear(); score = 0; ticks = 0;
  render();
});
Scorex.onStart(() => {
  running = true; paused = false; score = 0; ticks = 0;
  render();
  Scorex.started();
  Scorex.hud({ time: DURATION_SEC, score: 0 });
  startTimers();
});
Scorex.onPause(() => { if (!running) return; paused = true; stopTimers(); active.clear(); render(); });
Scorex.onResume(() => { if (!running) return; paused = false; render(); startTimers(); });
Scorex.onDestroy(() => { stopTimers(); running = false; });
Scorex.connect({ gameId: 'mole', gameVersion: '1.0.0' });
