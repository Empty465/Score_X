const { getBest, saveBest, awardScore } = window.Playground;

const moleButtons = [...document.querySelectorAll('.mole-hole')];
let moleActiveIndex = -1;
let moleScore = 0;
let moleSecondsLeft = 20;
let moleTimer = null;
let moleSpawnTimer = null;
let moleRunning = false;

function renderMole() {
  moleButtons.forEach((button, index) => {
    button.classList.toggle('is-active', index === moleActiveIndex);
    button.disabled = !moleRunning;
  });
}

function resetMole() {
  clearInterval(moleTimer);
  clearTimeout(moleSpawnTimer);
  moleRunning = false;
  moleActiveIndex = -1;
  moleScore = 0;
  moleSecondsLeft = 20;
  document.querySelector('#mole-score').textContent = '00';
  document.querySelector('#mole-time').innerHTML = '20<small> 초</small>';
  document.querySelector('#mole-status').textContent = 'READY';
  document.querySelector('#mole-start').textContent = '임무 시작 ↗';
  renderMole();
}

function showNextMole() {
  if (!moleRunning) return;
  const nextIndex = Math.floor(Math.random() * moleButtons.length);
  moleActiveIndex = nextIndex === moleActiveIndex ? (nextIndex + 1) % moleButtons.length : nextIndex;
  renderMole();
  moleSpawnTimer = setTimeout(showNextMole, 650 + Math.random() * 500);
}

async function finishMole() {
  clearInterval(moleTimer);
  clearTimeout(moleSpawnTimer);
  moleRunning = false;
  moleActiveIndex = -1;
  document.querySelector('#mole-status').textContent = 'COMPLETE';
  const earned = await awardScore('mole', moleScore * 20);
  const receipt = earned === null ? '이름 등록 후 저장' : `${earned} PTS 기록`;
  document.querySelector('#mole-start').textContent = `${moleScore}회 차단 · ${receipt}`;
  if (moleScore > Number(getBest('mole') || 0)) saveBest('mole', moleScore);
  renderMole();
}

function startMole() {
  if (moleRunning) return;
  resetMole();
  moleRunning = true;
  document.querySelector('#mole-status').textContent = 'PLAYING';
  document.querySelector('#mole-start').textContent = '경고를 차단하세요!';
  showNextMole();
  moleTimer = setInterval(() => {
    moleSecondsLeft -= 1;
    document.querySelector('#mole-time').innerHTML = `${String(moleSecondsLeft).padStart(2, '0')}<small> 초</small>`;
    if (moleSecondsLeft <= 0) finishMole();
  }, 1000);
}

moleButtons.forEach((button, index) => button.addEventListener('click', () => {
  if (!moleRunning || index !== moleActiveIndex) return;
  moleScore += 1;
  document.querySelector('#mole-score').textContent = String(moleScore).padStart(2, '0');
  clearTimeout(moleSpawnTimer);
  moleActiveIndex = -1;
  renderMole();
  moleSpawnTimer = setTimeout(showNextMole, 120);
}));
document.querySelector('#mole-start').addEventListener('click', startMole);
resetMole();
window.Playground.registerGame('mole', { onLaunch: resetMole });
