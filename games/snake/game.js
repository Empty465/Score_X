const GRID = 21;
const TICK_MS = 125;
const canvas = document.querySelector('#canvas');
const context = canvas.getContext('2d');
let rng = Math.random;
let snake = [];
let food = { x: 15, y: 10 };
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let timer = null;
let points = 0;
let ticks = 0;
let running = false;

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

function placeFood() {
  do {
    food = { x: Math.floor(rng() * GRID), y: Math.floor(rng() * GRID) };
  } while (snake.some((part) => part.x === food.x && part.y === food.y));
}

function reset() {
  clearInterval(timer);
  running = false;
  points = 0;
  ticks = 0;
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  placeFood();
  draw();
}

function draw() {
  const cell = canvas.width / GRID;
  context.fillStyle = '#081727';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#122b40';
  context.lineWidth = 1;
  for (let index = 1; index < GRID; index += 1) {
    context.beginPath();
    context.moveTo(index * cell, 0);
    context.lineTo(index * cell, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, index * cell);
    context.lineTo(canvas.width, index * cell);
    context.stroke();
  }
  context.fillStyle = '#ffd27d';
  context.beginPath();
  context.arc((food.x + .5) * cell, (food.y + .5) * cell, cell * .34, 0, Math.PI * 2);
  context.fill();
  snake.forEach((part, index) => {
    context.fillStyle = index === 0 ? '#65e6d1' : `hsl(190 56% ${30 + Math.min(index, 5) * 5}%)`;
    context.beginPath();
    context.roundRect(part.x * cell + 1.5, part.y * cell + 1.5, cell - 3, cell - 3, cell * .3);
    context.fill();
  });
  const head = snake[0];
  context.fillStyle = '#eafcff';
  context.beginPath();
  context.arc((head.x + .65) * cell, (head.y + .34) * cell, 1.7, 0, Math.PI * 2);
  context.fill();
}

function finish() {
  clearInterval(timer);
  running = false;
  Scorex.hud({ score: points * 50, status: 'GAME OVER' });
  Scorex.gameOver({ score: points * 50, durationMs: Math.max(1, ticks * TICK_MS), result: 'fail', meta: { debris: points } });
}

function tick() {
  ticks += 1;
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  const ate = head.x === food.x && head.y === food.y;
  if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID || snake.slice(0, ate ? snake.length : -1).some((part) => part.x === head.x && part.y === head.y)) {
    finish();
    return;
  }
  snake.unshift(head);
  if (ate) {
    points += 1;
    placeFood();
    Scorex.hud({ score: points * 50, status: 'PLAYING' });
  } else {
    snake.pop();
  }
  draw();
}

function turn(name) {
  const moves = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const candidate = moves[name];
  if (!candidate || candidate.x === -direction.x && candidate.y === -direction.y) return;
  nextDirection = candidate;
}

document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => turn(button.dataset.direction));
  button.addEventListener('pointerdown', (event) => event.preventDefault());
});
document.addEventListener('keydown', (event) => {
  const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  if (keys[event.key]) { event.preventDefault(); turn(keys[event.key]); }
});

Scorex.onInit((init) => { rng = seeded(init.seed); reset(); });
Scorex.onStart(() => {
  reset();
  running = true;
  timer = setInterval(tick, TICK_MS);
  Scorex.started();
  Scorex.hud({ score: 0, status: 'PLAYING' });
});
Scorex.onPause(() => { if (running) { clearInterval(timer); timer = null; } });
Scorex.onResume(() => { if (running && !timer) timer = setInterval(tick, TICK_MS); });
Scorex.onDestroy(() => { clearInterval(timer); running = false; });
Scorex.connect({ gameId: 'snake', gameVersion: '1.0.0' });
