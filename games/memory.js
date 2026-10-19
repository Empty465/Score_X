const { getBest, saveBest, awardScore } = window.Playground;

const memorySymbols = ['⚙', '◉', '⌁', '✦', '◇', '☼', '▱', '⬡'];
let memoryOpen = [];
let memoryMatched = 0;
let memoryMoves = 0;
let memorySeconds = 0;
let memoryTimer = null;
let memoryLocked = false;
let memoryStarted = false;

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function resetMemory() {
  clearInterval(memoryTimer);
  memoryOpen = [];
  memoryMatched = 0;
  memoryMoves = 0;
  memorySeconds = 0;
  memoryLocked = false;
  memoryStarted = false;
  document.querySelector('#memory-moves').textContent = '00';
  document.querySelector('#memory-time').textContent = '00:00';
  document.querySelector('#memory-pairs').textContent = '08';
  document.querySelector('#memory-status').textContent = 'READY';
  document.querySelector('#memory-start').textContent = '복구 시작 ↗';
  const deck = [...memorySymbols, ...memorySymbols].sort(() => Math.random() - .5);
  document.querySelector('#memory-grid').innerHTML = deck.map((symbol, index) => `<button class="memory-card" data-symbol="${symbol}" aria-label="${index + 1}번째 카드, 뒤집혀 있음">?</button>`).join('');
  document.querySelectorAll('.memory-card').forEach((card) => card.addEventListener('click', () => flipMemoryCard(card)));
}

function beginMemoryTimer() {
  if (memoryStarted) return;
  memoryStarted = true;
  document.querySelector('#memory-status').textContent = 'PLAYING';
  document.querySelector('#memory-start').textContent = '회로 복구 중';
  memoryTimer = setInterval(() => {
    memorySeconds += 1;
    document.querySelector('#memory-time').textContent = formatTime(memorySeconds);
  }, 1000);
}

function flipMemoryCard(card) {
  if (memoryLocked || card.classList.contains('is-open') || card.classList.contains('is-matched')) return;
  beginMemoryTimer();
  card.classList.add('is-open');
  card.textContent = card.dataset.symbol;
  card.setAttribute('aria-label', `${card.dataset.symbol}, 열린 카드`);
  memoryOpen.push(card);
  if (memoryOpen.length < 2) return;
  memoryMoves += 1;
  document.querySelector('#memory-moves').textContent = String(memoryMoves).padStart(2, '0');
  const [first, second] = memoryOpen;
  if (first.dataset.symbol === second.dataset.symbol) {
    first.classList.add('is-matched');
    second.classList.add('is-matched');
    first.disabled = true;
    second.disabled = true;
    memoryMatched += 1;
    document.querySelector('#memory-pairs').textContent = String(8 - memoryMatched).padStart(2, '0');
    memoryOpen = [];
    if (memoryMatched === 8) finishMemory();
  } else {
    memoryLocked = true;
    setTimeout(() => {
      [first, second].forEach((openCard) => {
        openCard.classList.remove('is-open');
        openCard.textContent = '?';
        openCard.setAttribute('aria-label', '뒤집힌 카드');
      });
      memoryOpen = [];
      memoryLocked = false;
    }, 750);
  }
}

async function finishMemory() {
  clearInterval(memoryTimer);
  document.querySelector('#memory-status').textContent = 'COMPLETE';
  document.querySelector('#memory-start').textContent = '시스템 복구 완료';
  const previousBest = Number(getBest('memory') || Infinity);
  if (memoryMoves < previousBest) saveBest('memory', memoryMoves);
  const earned = await awardScore('memory', Math.max(100, 1200 - memoryMoves * 40 - memorySeconds * 5));
  const receipt = earned === null ? '이름 등록 후 저장' : `${earned} PTS 기록`;
  document.querySelector('#memory-start').textContent = `복구 완료 · ${receipt}`;
}

document.querySelector('#memory-reset').addEventListener('click', resetMemory);
document.querySelector('#memory-start').addEventListener('click', () => {
  if (memoryStarted) return;
  const firstCard = document.querySelector('.memory-card:not(.is-matched)');
  if (firstCard) flipMemoryCard(firstCard);
});
resetMemory();
window.Playground.registerGame('memory', { onLaunch: resetMemory });
