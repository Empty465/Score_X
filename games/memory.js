// 시스템 오류 복구: 게임 본체는 games/memory/ (iframe)에서 실행되고, 이 파일은 점수 제출과 사이드 패널 표시만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const startButton = document.querySelector('#memory-start');
const text = (selector, value) => { document.querySelector(selector).textContent = value; };
const pad = (value) => String(value).padStart(2, '0');

function setButton(label) { startButton.innerHTML = `${label} <span>↗</span>`; }

function resetPanel() {
  text('#memory-moves', '00');
  text('#memory-time', '00:00');
  text('#memory-pairs', '08');
  text('#memory-status', 'READY');
}

const game = mountGame({
  id: 'memory',
  host: document.querySelector('#memory-host'),
  onHud: (items) => {
    if (items.score !== undefined) text('#memory-moves', pad(items.score));
    if (items.progress !== undefined) text('#memory-pairs', pad(8 - Math.round(items.progress * 8)));
    if (items.status !== undefined) text('#memory-time', items.status);
  },
  onError: (message) => { text('#memory-status', 'ERROR'); setButton(message); },
  async onGameOver({ playId, score, durationMs, meta }) {
    const moves = meta && typeof meta.moves === 'number' ? meta.moves : 0;
    text('#memory-status', 'COMPLETE');
    text('#memory-moves', pad(moves));
    text('#memory-pairs', '00');
    setButton('시스템 복구 완료');
    if (moves < Number(getBest('memory') || Infinity)) saveBest('memory', moves);
    const earned = await awardScore('memory', score, { playId, durationMs });
    setButton(`복구 완료 · ${earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`}`);
  }
});

startButton.addEventListener('click', async () => {
  resetPanel();
  text('#memory-status', 'PLAYING');
  setButton('회로 복구 중');
  if (!await game.start()) { text('#memory-status', 'READY'); setButton('다시 시도'); }
});

document.querySelector('#memory-reset').addEventListener('click', () => {
  game.reload();
  resetPanel();
  setButton('복구 시작');
});

export default {
onLaunch: () => { game.ensure(); },
onShow: () => { game.ensure(); game.resume(); },
onHide: () => game.pause()
};
