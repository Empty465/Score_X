// 전용 화면·어댑터가 없는 매니페스트 게임을 위한 기본 화면입니다. 신뢰할 수 없는 문자열은 항상 textContent로만 넣습니다.
import { mountGame } from '/shell/game-host.js';

const HUD_LABELS = { time: '시간', score: '점수', lives: '목숨', progress: '진행', combo: '콤보', status: '상태' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createGenericGame(meta, section) {
  const { getBest, saveBest, awardScore } = window.Playground;
  const difficulty = meta.difficulties.includes('NORMAL') ? 'NORMAL' : meta.difficulties[0];

  const back = el('button', 'back-button', '←');
  back.dataset.view = 'home';
  back.setAttribute('aria-label', '임무 목록으로');
  const heading = el('div', 'game-heading');
  const titles = el('div');
  const eyebrow = el('div', 'eyebrow', meta.category);
  titles.append(eyebrow, el('h1', '', meta.title), el('p', 'mission-subtitle', meta.description));
  heading.append(back, titles, el('span', 'heading-mark', meta.icon));

  const host = el('div', 'game-host');
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
  const restart = el('button', 'text-button', '↻ 임무 재시작');
  const side = el('div', 'game-side-panel');
  side.append(hudList, bestRow, el('div', 'divider'), restart);

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

  const game = mountGame({
    id: meta.id,
    host,
    difficulty,
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
    onShow: () => { game.ensure(); game.resume(); },
    onHide: () => game.pause()
  };
}
