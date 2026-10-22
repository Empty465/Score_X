import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const host = document.querySelector('#hello_game-host');
const overlay = document.querySelector('#hello_game-overlay');
const status = document.querySelector('#hello_game-status');
const scoreValue = document.querySelector('#hello_game-score');
const bestValue = document.querySelector('#hello_game-best');
const startButton = document.querySelector('#hello_game-start');

const game = mountGame({
  id: 'hello_game',
  host,
  onHud: (items) => {
    if (items.time !== undefined) status.textContent = `남은 시간 ${items.time}초`;
    if (items.score !== undefined) scoreValue.textContent = String(items.score);
  },
  onError: (message) => {
    status.textContent = message;
    overlay.classList.remove('is-hidden');
  },
  async onGameOver({ playId, score, durationMs }) {
    if (score > Number(getBest('hello_game') || 0)) saveBest('hello_game', score);
    bestValue.textContent = String(getBest('hello_game') ?? '—');
    const earned = await awardScore('hello_game', score, { playId, durationMs });
    status.textContent = earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`;
    startButton.textContent = '다시 시작';
    overlay.classList.remove('is-hidden');
  }
});

async function begin() {
  status.textContent = '게임을 불러오는 중...';
  if (await game.start()) overlay.classList.add('is-hidden');
}

function reset() {
  game.reload();
  status.textContent = '준비';
  scoreValue.textContent = '0';
  bestValue.textContent = String(getBest('hello_game') ?? '—');
  startButton.textContent = '임무 시작';
  overlay.classList.remove('is-hidden');
}

startButton.addEventListener('click', begin);

export default {
  onLaunch: () => { game.ensure(); },
  onStart: begin,
  onShow: () => { game.ensure(); game.resume(); },
  onHide: () => game.pause(),
  onReset: reset
};
