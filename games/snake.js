// 우주 쓰레기 수거: 게임 본체는 games/snake/ (iframe)에서 실행되고, 이 파일은 시작·종료 오버레이와 점수 제출만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const overlay = document.querySelector('#snake-overlay');
const title = document.querySelector('#snake-overlay-title');
const copy = document.querySelector('#snake-overlay-copy');
const startButton = document.querySelector('#snake-start');
const scoreText = document.querySelector('#snake-score');

function showOverlay(heading, body, label) {
  title.textContent = heading;
  copy.textContent = body;
  startButton.innerHTML = `${label} <span>↗</span>`;
  overlay.classList.remove('is-hidden');
}

const game = mountGame({
  id: 'snake',
  host: document.querySelector('#snake-host'),
  onHud: (items) => {
    if (items.score !== undefined) scoreText.textContent = String(Math.round(items.score / 100)).padStart(2, '0');
  },
  onError: (message) => showOverlay('실행 오류', message, '다시 시도'),
  async onGameOver({ playId, score, durationMs, meta }) {
    const debris = meta && typeof meta.debris === 'number' ? meta.debris : Math.round(score / 100);
    if (debris > Number(getBest('snake') || 0)) saveBest('snake', debris);
    const earned = await awardScore('snake', score, { playId, durationMs });
    showOverlay('수거 임무 종료', `회수한 파편 ${debris}개 · ${earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`}`, '다시 출격');
  }
});

async function begin() {
  scoreText.textContent = '00';
  if (await game.start()) overlay.classList.add('is-hidden');
  else showOverlay('수거 임무 준비', '게임을 시작하지 못했어요. 다시 시도해 주세요.', '임무 시작');
}

startButton.addEventListener('click', begin);
document.querySelector('#snake-restart').addEventListener('click', begin);

function reset() {
  game.reload();
  scoreText.textContent = '00';
  showOverlay('수거 임무 준비', '방향키 또는 WASD로 드론을 조종하세요.', '임무 시작');
}

export default {
  onLaunch: () => { game.ensure(); },
  onStart: begin,
  onShow: () => { game.ensure(); game.resume(); },
  onHide: () => game.pause(),
  onReset: reset
};
