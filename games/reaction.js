// 수동 도킹 시퀀스: 게임 본체는 games/reaction/ (iframe)에서 실행되고, 이 파일은 점수 제출과 사이드 패널 표시만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const startButton = document.querySelector('#reaction-start');
const text = (selector, value) => { document.querySelector(selector).textContent = value; };

function setButton(label) { startButton.innerHTML = `${label} <span>↗</span>`; }

const game = mountGame({
  id: 'reaction',
  host: document.querySelector('#reaction-host'),
  onHud: (items) => { if (items.status) text('#reaction-status', items.status); },
  onError: (message) => { text('#reaction-status', 'ERROR'); setButton('다시 시도'); text('#reaction-hint', message); },
  async onGameOver({ playId, score, durationMs, meta }) {
    const elapsed = meta && typeof meta.elapsed === 'number' ? meta.elapsed : 1000 - score;
    document.querySelector('#reaction-score').innerHTML = `${elapsed}<small> ms</small>`;
    if (elapsed < Number(getBest('reaction') || Infinity)) saveBest('reaction', elapsed);
    const earned = await awardScore('reaction', score, { playId, durationMs });
    text('#reaction-hint', earned === null ? '점수 서버에 연결하지 못했어요.' : `${earned} PTS 기록 · 다시 도전해 기록을 줄여봐요`);
    setButton('다시 도전');
  }
});

startButton.addEventListener('click', async () => {
  text('#reaction-status', 'WAIT');
  text('#reaction-hint', '도킹 신호 전까지 대기하세요.');
  setButton('신호 대기 중');
  if (!await game.start()) setButton('다시 시도');
});

export default {
onLaunch: () => { game.ensure(); },
onShow: () => { game.ensure(); game.resume(); },
onHide: () => game.pause()
};
