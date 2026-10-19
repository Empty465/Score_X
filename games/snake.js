const { getBest, saveBest, awardScore } = window.Playground;

const snakeCanvas = document.querySelector('#snake-canvas');
const snakeContext = snakeCanvas.getContext('2d');
const snakeOverlay = document.querySelector('#snake-overlay');
const snakeScore = document.querySelector('#snake-score');
const snakeGridSize = 21;
let snake = [];
let snakeFood = { x: 15, y: 10 };
let snakeDirection = { x: 1, y: 0 };
let nextSnakeDirection = { x: 1, y: 0 };
let snakeTimer = null;
let snakePoints = 0;
let snakeRunning = false;

function resetSnake() {
  clearInterval(snakeTimer);
  snakeRunning = false;
  snakePoints = 0;
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  snakeDirection = { x: 1, y: 0 };
  nextSnakeDirection = { x: 1, y: 0 };
  snakeScore.textContent = '00';
  document.querySelector('#snake-overlay-title').textContent = '수거 임무 준비';
  document.querySelector('#snake-overlay-copy').textContent = '방향키 또는 WASD로 드론을 조종하세요.';
  document.querySelector('#snake-start').textContent = '임무 시작 ↗';
  snakeOverlay.classList.remove('is-hidden');
  placeSnakeFood();
  drawSnake();
}

function placeSnakeFood() {
  do {
    snakeFood = { x: Math.floor(Math.random() * snakeGridSize), y: Math.floor(Math.random() * snakeGridSize) };
  } while (snake.some((part) => part.x === snakeFood.x && part.y === snakeFood.y));
}

function drawSnake() {
  if (!snakeContext) return;
  const cell = snakeCanvas.width / snakeGridSize;
  snakeContext.clearRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  snakeContext.fillStyle = '#081727';
  snakeContext.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
  snakeContext.strokeStyle = '#122b40';
  snakeContext.lineWidth = 1;
  for (let index = 1; index < snakeGridSize; index += 1) {
    snakeContext.beginPath();
    snakeContext.moveTo(index * cell, 0);
    snakeContext.lineTo(index * cell, snakeCanvas.height);
    snakeContext.stroke();
    snakeContext.beginPath();
    snakeContext.moveTo(0, index * cell);
    snakeContext.lineTo(snakeCanvas.width, index * cell);
    snakeContext.stroke();
  }
  snakeContext.fillStyle = '#ffd27d';
  snakeContext.beginPath();
  snakeContext.arc((snakeFood.x + .5) * cell, (snakeFood.y + .5) * cell, cell * .34, 0, Math.PI * 2);
  snakeContext.fill();
  snake.forEach((part, index) => {
    snakeContext.fillStyle = index === 0 ? '#65e6d1' : `hsl(190 56% ${30 + Math.min(index, 5) * 5}%)`;
    snakeContext.beginPath();
    snakeContext.roundRect(part.x * cell + 1.5, part.y * cell + 1.5, cell - 3, cell - 3, cell * .3);
    snakeContext.fill();
  });
  const head = snake[0];
  snakeContext.fillStyle = '#eafcff';
  snakeContext.beginPath();
  snakeContext.arc((head.x + .65) * cell, (head.y + .34) * cell, 1.7, 0, Math.PI * 2);
  snakeContext.fill();
}

async function finishSnake() {
  clearInterval(snakeTimer);
  snakeRunning = false;
  const previousBest = Number(getBest('snake') || 0);
  if (snakePoints > previousBest) saveBest('snake', snakePoints);
  const earned = await awardScore('snake', snakePoints * 100);
  document.querySelector('#snake-overlay-title').textContent = '수거 임무 종료';
  const receipt = earned === null ? '이름 등록 후 기록돼요.' : `${earned} PTS 기록`;
  document.querySelector('#snake-overlay-copy').textContent = `회수한 파편 ${snakePoints}개 · ${receipt}`;
  document.querySelector('#snake-start').textContent = '다시 출격 ↗';
  snakeOverlay.classList.remove('is-hidden');
}

function tickSnake() {
  snakeDirection = nextSnakeDirection;
  const head = { x: snake[0].x + snakeDirection.x, y: snake[0].y + snakeDirection.y };
  const ateFood = head.x === snakeFood.x && head.y === snakeFood.y;
  if (head.x < 0 || head.x >= snakeGridSize || head.y < 0 || head.y >= snakeGridSize || snake.slice(0, ateFood ? snake.length : -1).some((part) => part.x === head.x && part.y === head.y)) {
    finishSnake();
    return;
  }
  snake.unshift(head);
  if (ateFood) {
    snakePoints += 1;
    snakeScore.textContent = String(snakePoints).padStart(2, '0');
    placeSnakeFood();
  } else {
    snake.pop();
  }
  drawSnake();
}

function changeSnakeDirection(direction) {
  const moves = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const candidate = moves[direction];
  if (!candidate || candidate.x === -snakeDirection.x && candidate.y === -snakeDirection.y) return;
  nextSnakeDirection = candidate;
}

function startSnake() {
  if (snakeRunning) return;
  if (snake.length === 0 || snakeOverlay.classList.contains('is-hidden') === false && document.querySelector('#snake-overlay-title').textContent === '게임 끝!') resetSnake();
  snakeRunning = true;
  snakeOverlay.classList.add('is-hidden');
  snakeTimer = setInterval(tickSnake, 125);
}

document.querySelector('#snake-start').addEventListener('click', startSnake);
document.querySelector('#snake-restart').addEventListener('click', resetSnake);
document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => changeSnakeDirection(button.dataset.direction));
  button.addEventListener('pointerdown', (event) => event.preventDefault());
});
document.addEventListener('keydown', (event) => {
  const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  if (keys[event.key] && document.querySelector('#view-snake').classList.contains('is-visible')) {
    event.preventDefault();
    changeSnakeDirection(keys[event.key]);
  }
});
resetSnake();
window.Playground.registerGame('snake', { onShow: drawSnake });
