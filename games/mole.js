// 비상 경고등 진압: 게임 본체는 games/mole/ (iframe)에서 실행되고, 이 파일은 점수 제출과 사이드 패널 표시만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const startButton = document.querySelector('#mole-start');
const text = (selector, value) => { document.querySelector(selector).textContent = value; };

function setButton(label) { startButton.innerHTML = `${label} <span>↗</span>`; }

const game = mountGame({
  id: 'mole',
  host: document.querySelector('#mole-host'),
  onHud: (items) => {
    if (items.time !== undefined) document.querySelector('#mole-time').innerHTML = `${String(Math.max(0, Math.ceil(items.time))).padStart(2, '0')}<small> 초</small>`;
    if (items.score !== undefined) text('#mole-score', String(Math.round(items.score / 20)).padStart(2, '0'));
  },
  onError: (message) => { text('#mole-status', 'ERROR'); setButton(message); },
  async onGameOver({ playId, score, durationMs, meta }) {
    const hits = meta && typeof meta.hits === 'number' ? meta.hits : Math.round(score / 20);
    text('#mole-status', 'COMPLETE');
    text('#mole-score', String(hits).padStart(2, '0'));
    if (hits > Number(getBest('mole') || 0)) saveBest('mole', hits);
    const earned = await awardScore('mole', score, { playId, durationMs });
    setButton(`${hits}회 차단 · ${earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`}`);
  }
});

startButton.addEventListener('click', async () => {
  text('#mole-status', 'PLAYING');
  text('#mole-score', '00');
  document.querySelector('#mole-time').innerHTML = '20<small> 초</small>';
  setButton('경고를 차단하세요!');
  if (!await game.start()) { text('#mole-status', 'READY'); setButton('다시 시도'); }
});

export default {
onLaunch: () => { game.ensure(); },
onShow: () => { game.ensure(); game.resume(); },
onHide: () => game.pause()
};
