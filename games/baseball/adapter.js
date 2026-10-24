// 궤도 진입 좌표 해독: 게임 본체는 games/baseball/ (iframe)에서 실행되고, 이 파일은 점수 제출과 사이드 패널 표시만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const resetButton = document.querySelector('#baseball-reset');
const overlay = document.querySelector('#baseball-overlay');
const remaining = document.querySelector('#baseball-remaining');
const text = (selector, value) => { document.querySelector(selector).textContent = value; };

function setButton(label) { resetButton.innerHTML = `${label} <span>↗</span>`; }
function showOverlay(title, copy) {
  text('#baseball-overlay-title', title);
  text('#baseball-overlay-copy', copy);
  overlay.classList.remove('is-hidden');
}
function hideOverlay() { overlay.classList.add('is-hidden'); }

const game = mountGame({
  id: 'baseball',
  host: document.querySelector('#baseball-host'),
  onHud: (items) => {
    if (items.lives !== undefined) remaining.textContent = String(Math.max(0, items.lives)).padStart(2, '0');
    if (items.status !== undefined) text('#baseball-status', items.status);
  },
  onError: (message) => {
    text('#baseball-status', 'ERROR');
    setButton('다시 시도');
    showOverlay('터미널을 불러오지 못했어요', message);
  },
  async onGameOver({ playId, score, durationMs, meta, result }) {
    const attempts = meta && typeof meta.attempts === 'number' ? meta.attempts : 9;
    const best = Number(getBest('baseball') || 0);
    if (result === 'clear' && (!best || attempts < best)) saveBest('baseball', attempts);
    const earned = await awardScore('baseball', score, { playId, durationMs });
    text('#baseball-status', result === 'clear' ? 'DECODED' : 'FAILED');
    setButton('새 코드로 재도전');
    showOverlay(result === 'clear' ? '좌표 해독 완료' : '해독 시도 종료', `${attempts}회 사용 · ${earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`}`);
  }
});

async function begin() {
  hideOverlay();
  text('#baseball-status', 'PLAYING');
  remaining.textContent = '09';
  setButton('해독 중');
  if (!await game.start()) {
    setButton('다시 시도');
    if (overlay.classList.contains('is-hidden')) {
      text('#baseball-status', 'READY');
      showOverlay('해독을 시작하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  }
}

resetButton.addEventListener('click', begin);

function reset() {
  game.reload();
  remaining.textContent = '09';
  text('#baseball-status', 'READY');
  setButton('해독 시작');
  showOverlay('좌표 해독 준비', '세 자리 보안 코드를 해독해 진입 경로를 확보하세요.');
}

export default {
  onLaunch: () => { game.ensure(); },
  onStart: begin,
  onShow: () => { game.ensure(); game.resume(); },
  onHide: () => game.pause(),
  onReset: reset
};
