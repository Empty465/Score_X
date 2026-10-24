// 시스템 오류 복구: 게임 본체는 games/memory/ (iframe)에서 실행되고, 이 파일은 점수 제출과 사이드 패널 표시만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const startButton = document.querySelector('#memory-start');
const overlay = document.querySelector('#memory-overlay');
const text = (selector, value) => { document.querySelector(selector).textContent = value; };
const pad = (value) => String(value).padStart(2, '0');

function setButton(label) { startButton.innerHTML = `${label} <span>↗</span>`; }
function showOverlay(title, copy) {
  text('#memory-overlay-title', title);
  text('#memory-overlay-copy', copy);
  overlay.classList.remove('is-hidden');
}
function hideOverlay() { overlay.classList.add('is-hidden'); }

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
  onError: (message) => {
    text('#memory-status', 'ERROR');
    setButton('다시 시도');
    showOverlay('회로를 불러오지 못했어요', message);
  },
  async onGameOver({ playId, score, durationMs, meta }) {
    const moves = meta && typeof meta.moves === 'number' ? meta.moves : 0;
    text('#memory-status', 'COMPLETE');
    text('#memory-moves', pad(moves));
    text('#memory-pairs', '00');
    setButton('다시 도전');
    if (moves < Number(getBest('memory') || Infinity)) saveBest('memory', moves);
    const earned = await awardScore('memory', score, { playId, durationMs });
    showOverlay('시스템 복구 완료', earned === null ? '복구 기록을 저장하지 못했어요. 다시 도전할 수 있습니다.' : `${moves}회 만에 복구했어요 · ${earned} PTS 기록`);
  }
});

async function begin() {
  hideOverlay();
  resetPanel();
  text('#memory-status', 'PLAYING');
  setButton('회로 복구 중');
  if (!await game.start()) {
    setButton('다시 시도');
    if (overlay.classList.contains('is-hidden')) {
      text('#memory-status', 'READY');
      showOverlay('게임을 시작하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  }
}

startButton.addEventListener('click', begin);

document.querySelector('#memory-reset').addEventListener('click', () => {
  game.reload();
  resetPanel();
  setButton('복구 시작');
  showOverlay('회로 복구 준비', '같은 시스템 아이콘을 찾아 제어 회로를 복구하세요.');
});

function reset() {
  game.reload();
  resetPanel();
  setButton('복구 시작');
  showOverlay('회로 복구 준비', '같은 시스템 아이콘을 찾아 제어 회로를 복구하세요.');
}

export default {
  onLaunch: () => { game.ensure(); },
  onStart: begin,
  onShow: () => { game.ensure(); game.resume(); },
  onHide: () => game.pause(),
  onReset: reset
};
