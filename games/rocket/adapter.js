// 1단 부스터 회수: 게임 본체와 물리 엔진은 games/rocket/ (iframe)에서 실행되고, 이 파일은 시작·종료 오버레이와 점수 제출만 담당합니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;
const overlay = document.querySelector('#rocket-overlay');
const title = document.querySelector('#rocket-overlay-title');
const copy = document.querySelector('#rocket-overlay-copy');
const startButton = document.querySelector('#rocket-start');
const status = document.querySelector('#rocket-status');
const score = document.querySelector('#rocket-score');

function showOverlay(heading, body, label) {
  title.textContent = heading;
  copy.textContent = body;
  startButton.innerHTML = `${label} <span>↗</span>`;
  overlay.classList.remove('is-hidden');
}

const game = mountGame({
  id: 'rocket',
  host: document.querySelector('#rocket-host'),
  onHud: (items) => {
    if (items.status !== undefined) status.textContent = items.status;
    if (items.progress !== undefined) {
      document.querySelector('#rocket-fuel-label').textContent = `${Math.ceil(items.progress * 100)}%`;
      document.querySelector('#rocket-fuel-meter').value = items.progress * 100;
    }
  },
  onError: (message) => showOverlay('실행 오류', message, '다시 시도'),
  async onGameOver({ playId, score: points, durationMs, result, meta }) {
    const landed = result === 'clear';
    status.textContent = landed ? 'LANDED' : 'CRASH';
    score.textContent = String(points);
    if (landed && points > Number(getBest('rocket') || 0)) saveBest('rocket', points);
    const earned = await awardScore('rocket', points, { playId, durationMs });
    if (landed) {
      const speed = meta && typeof meta.vy === 'number' ? `속도 ${meta.vy.toFixed(1)} m/s · ` : '';
      showOverlay('착륙 성공!', earned === null ? `${speed}점수 서버에 연결하지 못했어요.` : `${speed}${earned} PTS 기록`, '회수 재시도');
    } else {
      showOverlay('부스터 회수 실패', `패드 중앙에서 기체를 수평으로 하고 하강 속도를 낮춰보세요.${earned === null ? '' : ' 결과 보상은 정산되었습니다.'}`, '회수 재시도');
    }
  }
});

async function begin() {
  status.textContent = 'FLIGHT';
  score.textContent = '—';
  if (await game.start()) overlay.classList.add('is-hidden');
  else showOverlay('부스터 회수 준비 완료', '게임을 시작하지 못했어요. 다시 시도해 주세요.', '회수 시퀀스 시작');
}

startButton.addEventListener('click', begin);
document.querySelector('#rocket-reset').addEventListener('click', begin);

function reset() {
  game.reload();
  status.textContent = 'READY';
  score.textContent = '—';
  document.querySelector('#rocket-fuel-label').textContent = '100%';
  document.querySelector('#rocket-fuel-meter').value = 100;
  showOverlay('부스터 회수 준비 완료', '추력으로 속도를 줄이고 해상 착륙 패드에 수직 착륙하세요.', '회수 시퀀스 시작');
}

export default {
  onLaunch: () => { game.ensure(); },
  onStart: begin,
  onShow: () => { game.ensure(); game.resume(); },
  onHide: () => game.pause(),
  onReset: reset
};
