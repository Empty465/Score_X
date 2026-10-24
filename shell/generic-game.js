// 전용 화면·어댑터가 없는 매니페스트 게임을 위한 기본 화면입니다. 신뢰할 수 없는 문자열은 항상 textContent로만 넣습니다.
import { mountGame } from '/shell/game-host.js';

const HUD_LABELS = { time: '시간', score: '점수', lives: '목숨', progress: '진행', combo: '콤보', status: '상태' };
const GAME_GUIDES = {
  galaga: {
    title: '우주선 조작',
    copy: '적 편대의 공격을 피하며 우주선을 좌우로 기동하세요. 무기는 자동으로 발사됩니다.',
    controls: [
      { keys: ['←', 'A'], action: '왼쪽 이동' },
      { keys: ['→', 'D'], action: '오른쪽 이동' }
    ]
  },
  tetris: {
    title: '적재 조작',
    copy: '블록을 회전하고 이동해 가로 줄을 완성하세요. 낙하 가속은 누르는 동안 적용됩니다.',
    controls: [
      { keys: ['←', '→'], action: '이동' },
      { keys: ['↑', 'W'], action: '회전' },
      { keys: ['Space', 'S', '↓'], action: '누르는 동안 가속' }
    ]
  },
  dino: {
    title: '로버 조작',
    copy: '장애물은 점프로 넘고 저공 비행 드론의 스캔은 숙여 피하세요. 오래 주행할수록 기록이 높아집니다.',
    controls: [
      { keys: ['Space', '↑', 'W'], action: '점프' },
      { keys: ['S', '↓'], action: '숙이기' }
    ]
  }
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createGenericGame(meta, section) {
  const { getBest, saveBest, awardScore } = window.Playground;

  const back = el('button', 'back-button', '←');
  back.dataset.view = 'home';
  back.setAttribute('aria-label', '임무 목록으로');
  const heading = el('div', 'game-heading');
  const titles = el('div');
  const eyebrow = el('div', 'eyebrow', meta.category);
  titles.append(eyebrow, el('h1', '', meta.title), el('p', 'mission-subtitle', meta.description));
  heading.append(back, titles, el('span', 'heading-mark', meta.icon));

  const host = el('div', 'game-host');
  host.id = `${meta.id}-host`;
  const overlayTitle = el('h2', '', `${meta.title} 준비`);
  const overlayCopy = el('p', '', meta.description);
  const startButton = el('button', 'primary-button', '임무 시작 ↗');
  const overlay = el('div', 'board-overlay');
  overlay.append(el('div', 'overlay-symbol', meta.icon), overlayTitle, overlayCopy, startButton);
  const caption = el('div', 'board-caption');
  caption.append(el('span', '', meta.category), el('span', 'live-label'));
  const board = el('div', 'board-wrap');
  board.append(caption, host, overlay);

  const hudList = el('div', 'generic-hud');
  const bestValue = el('span');
  bestValue.dataset.best = meta.id;
  const bestRow = el('div', 'record-row');
  bestRow.append(el('span', '', '최고 기록'), el('strong', '', ''));
  bestRow.querySelector('strong').append(bestValue, el('small', '', ' 점'));
  const guide = GAME_GUIDES[meta.id];
  const restart = el('button', 'text-button', '↻ 임무 재시작');
  const side = el('div', 'game-side-panel');
  side.append(hudList, bestRow, el('div', 'divider'));
  if (guide) {
    const guideSection = el('section', 'game-guide');
    guideSection.append(el('h2', 'game-guide-title', guide.title), el('p', 'game-guide-copy', guide.copy));
    const controls = el('div', 'game-guide-controls');
    guide.controls.forEach(({ keys, action }) => {
      const row = el('div', 'game-guide-control');
      const keyList = el('span', 'game-guide-keys');
      keys.forEach((key) => keyList.append(el('kbd', '', key)));
      row.append(keyList, el('span', 'game-guide-action', action));
      controls.append(row);
    });
    guideSection.append(controls);
    side.append(guideSection);
  }
  side.append(restart);

  const layout = el('div', 'play-layout');
  layout.append(board, side);
  section.append(heading, layout);

  const current = getBest(meta.id);
  bestValue.textContent = current === null ? '—' : current;

  function renderHud(items) {
    hudList.replaceChildren(...Object.entries(items)
      .filter(([key]) => key in HUD_LABELS)
      .map(([key, value]) => {
        const row = el('div', 'record-row');
        row.append(el('span', '', HUD_LABELS[key]), el('strong', '', String(value)));
        return row;
      }));
  }

  function showOverlay(heading, body, label) {
    overlayTitle.textContent = heading;
    overlayCopy.textContent = body;
    startButton.textContent = `${label} ↗`;
    overlay.classList.remove('is-hidden');
  }

  function reset() {
    game.reload();
    hudList.replaceChildren();
    showOverlay(`${meta.title} 준비`, meta.description, '임무 시작');
  }

  const game = mountGame({
    id: meta.id,
    host,
    onHud: renderHud,
    onError: (message) => showOverlay('실행 오류', message, '다시 시도'),
    async onGameOver({ playId, score, durationMs }) {
      if (score > Number(getBest(meta.id) || 0)) saveBest(meta.id, score);
      const earned = await awardScore(meta.id, score, { playId, durationMs });
      showOverlay('임무 종료', `${score} PTS · ${earned === null ? '점수 서버 연결 실패' : `${earned} PTS 기록`}`, '다시 시작');
    }
  });

  async function begin() {
    hudList.replaceChildren();
    if (await game.start()) overlay.classList.add('is-hidden');
    else showOverlay('임무 준비', '게임을 시작하지 못했어요. 다시 시도해 주세요.', '임무 시작');
  }

  startButton.addEventListener('click', begin);
  restart.addEventListener('click', begin);

  return {
    onLaunch: () => { game.ensure(); },
    onStart: begin,
    onShow: () => { game.ensure(); game.resume(); },
    onHide: () => game.pause(),
    onReset: reset
  };
}
