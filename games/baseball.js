// 궤도 진입 좌표 해독: 게임 본체는 games/baseball/ (iframe)에서 실행되고, 이 파일은 점수 제출과 사이드 패널 표시만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const resetButton = document.querySelector('#baseball-reset');
const remaining = document.querySelector('#baseball-remaining');
let started = false;

function setButton(label) { resetButton.innerHTML = `${label} <span>↻</span>`; }

const game = mountGame({
  id: 'baseball',
  host: document.querySelector('#baseball-host'),
  onHud: (items) => {
    if (items.lives !== undefined) remaining.textContent = String(Math.max(0, items.lives)).padStart(2, '0');
  },
  onError: (message) => setButton(message),
  async onGameOver({ playId, score, durationMs, meta, result }) {
    const attempts = meta && typeof meta.attempts === 'number' ? meta.attempts : 9;
    const best = Number(getBest('baseball') || 0);
    if (result === 'clear' && (!best || attempts < best)) saveBest('baseball', attempts);
    const earned = await awardScore('baseball', score, { playId, durationMs });
    setButton(earned === null ? '점수 서버 연결 실패 · 새 코드 발급' : '새 보안 코드 발급');
  }
});

async function begin() {
  remaining.textContent = '09';
  setButton('새 보안 코드 발급');
  if (!await game.start()) setButton('다시 시도');
}

resetButton.addEventListener('click', begin);

export default {
onLaunch: () => { game.ensure(); },
onShow: () => { game.ensure(); game.resume(); },
onHide: () => game.pause()
};
