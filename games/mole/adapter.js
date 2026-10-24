// 비상 경고등 진압: 게임 본체는 games/mole/ (iframe)에서 실행되고, 이 파일은 점수 제출과 사이드 패널 표시만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const startButton = document.querySelector('#mole-start');
const overlay = document.querySelector('#mole-overlay');
const text = (selector, value) => { document.querySelector(selector).textContent = value; };

function setButton(label) { startButton.innerHTML = `${label} <span>↗</span>`; }
function showOverlay(title, copy) {
  text('#mole-overlay-title', title);
  text('#mole-overlay-copy', copy);
  overlay.classList.remove('is-hidden');
}
function hideOverlay() { overlay.classList.add('is-hidden'); }

const game = mountGame({
  id: 'mole',
  host: document.querySelector('#mole-host'),
  onHud: (items) => {
    if (items.time !== undefined) document.querySelector('#mole-time').innerHTML = `${String(Math.max(0, Math.ceil(items.time))).padStart(2, '0')}<small> 초</small>`;
    if (items.score !== undefined) text('#mole-score', String(Math.round(items.score / 20)).padStart(2, '0'));
  },
  onError: (message) => {
    text('#mole-status', 'ERROR');
    setButton('다시 시도');
    showOverlay('경고 진압을 불러오지 못했어요', message);
  },
  async onGameOver({ playId, score, durationMs, meta }) {
    const hits = meta && typeof meta.hits === 'number' ? meta.hits : Math.round(score / 20);
    text('#mole-status', 'COMPLETE');
    text('#mole-score', String(hits).padStart(2, '0'));
    if (hits > Number(getBest('mole') || 0)) saveBest('mole', hits);
    const earned = await awardScore('mole', score, { playId, durationMs });
    setButton(`${hits}회 차단 · ${earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`}`);
    showOverlay('경고 진압 완료', `${hits}회 차단 · ${earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`}`);
  }
});

async function begin() {
  hideOverlay();
  text('#mole-status', 'PLAYING');
  text('#mole-score', '00');
  document.querySelector('#mole-time').innerHTML = '20<small> 초</small>';
  setButton('경고를 차단하세요!');
  if (!await game.start()) {
    setButton('다시 시도');
    if (overlay.classList.contains('is-hidden')) {
      text('#mole-status', 'READY');
      showOverlay('임무를 시작하지 못했어요', '잠시 후 다시 시도해 주세요.');
    }
  }
}

startButton.addEventListener('click', begin);

function reset() {
  game.reload();
  text('#mole-status', 'READY');
  text('#mole-score', '00');
  document.querySelector('#mole-time').innerHTML = '20<small> 초</small>';
  setButton('임무 시작');
  showOverlay('경고 진압 준비', '한 번에 1~3개 켜지는 비상 스위치를 모두 눌러 경고를 차단하세요.');
}

export default {
  onLaunch: () => { game.ensure(); },
  onStart: begin,
  onShow: () => { game.ensure(); game.resume(); },
  onHide: () => game.pause(),
  onReset: reset
};
