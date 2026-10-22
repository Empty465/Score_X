// 4족 보행 로봇 운영: 게임 본체는 games/clop/ (iframe)에서 실행되고, 이 파일은 Shell 쪽 연결(HUD·결과·점수 제출)만 담당합니다.
import '/shell/scorex-game.js';

const { getBest, saveBest, awardScore } = window.Playground;
const GAME_ID = 'clop';
const GOAL_METERS = 120;

const host = document.querySelector('#clop-host');
const overlay = document.querySelector('#clop-overlay');
const startButton = document.querySelector('#clop-start');
const text = (selector, value) => { document.querySelector(selector).textContent = value; };
const html = (selector, value) => { document.querySelector(selector).innerHTML = value; };

let element = null;
let starting = false;

function showOverlay(title, copy, buttonLabel) {
  text('#clop-overlay-title', title);
  text('#clop-overlay-copy', copy);
  startButton.innerHTML = `${buttonLabel} <span>↗</span>`;
  overlay.classList.remove('is-hidden');
}

function resetPanel() {
  text('#clop-status', 'READY');
  text('#clop-score', '—');
  html('#clop-time', '100<small> s</small>');
  html('#clop-distance', '0<small> m</small>');
  document.querySelector('#clop-time').parentElement.classList.remove('is-danger');
}

function applyHud({ items }) {
  if (items.time !== undefined) html('#clop-time', `${Math.max(0, Math.ceil(items.time))}<small> s</small>`);
  if (items.progress !== undefined) html('#clop-distance', `${Math.floor(items.progress * GOAL_METERS)}<small> m</small>`);
  if (items.score !== undefined) text('#clop-score', String(Math.round(items.score)));
  if (items.status !== undefined) text('#clop-status', items.status);
  if (items.danger !== undefined) document.querySelector('#clop-time').parentElement.classList.toggle('is-danger', items.danger);
}

async function handleGameOver({ playId, score, durationMs, result, meta }) {
  const meters = meta && typeof meta.meters === 'number' ? meta.meters : 0;
  text('#clop-status', result === 'clear' ? 'ARRIVED' : (result === 'timeout' ? 'TIME UP' : 'FLIPPED'));
  text('#clop-score', String(score));
  html('#clop-distance', `${meters.toFixed(1)}<small> m</small>`);
  if (score > Number(getBest(GAME_ID) || 0)) saveBest(GAME_ID, score);
  const earned = await awardScore(GAME_ID, score, { playId, durationMs });
  const title = result === 'clear' ? '목적지 도착!' : (result === 'timeout' ? '시간 종료' : '로버가 뒤집혔습니다');
  showOverlay(
    title,
    earned === null ? `${meters.toFixed(1)} m · 점수 서버에 연결하지 못했어요.` : `${meters.toFixed(1)} m · ${earned} PTS 기록`,
    '다시 도전'
  );
}

function ensureElement() {
  if (element) return element;
  element = document.createElement('scorex-game');
  element.setAttribute('game-id', GAME_ID);
  element.addEventListener('scorex-hud', (event) => applyHud(event.detail));
  element.addEventListener('scorex-gameover', (event) => handleGameOver(event.detail));
  element.addEventListener('scorex-error', (event) => {
    if (event.detail.fatal) showOverlay('게임을 실행할 수 없어요', event.detail.message || '잠시 후 다시 시도해 주세요.', '다시 시도');
  });
  host.append(element);
  return element;
}

function reloadGame() {
  if (element && element.state !== 'loading') element.load();
}

async function start() {
  if (starting) return;
  starting = true;
  try {
    const game = ensureElement();
    if (game.state === 'error' || game.state === 'destroyed') await game.load();
    await game.whenReady();
    resetPanel();
    await game.play('NORMAL');
    overlay.classList.add('is-hidden');
    text('#clop-status', 'WALKING');
  } catch (error) {
    showOverlay('시작하지 못했어요', error.message || '잠시 후 다시 시도해 주세요.', '다시 시도');
  } finally {
    starting = false;
  }
}

startButton.addEventListener('click', start);
document.querySelector('#clop-reset').addEventListener('click', () => {
  reloadGame();
  resetPanel();
  showOverlay('보행 시험 준비 완료', 'Q·W·O·P로 다리 4개를 번갈아 움직여 뒤집히지 않고 120m를 가세요.', '시험 시작');
});

function reset() {
  reloadGame();
  resetPanel();
  showOverlay('보행 시험 준비 완료', 'Q·W·O·P로 다리 4개를 번갈아 움직여 뒤집히지 않고 120m를 가세요.', '시험 시작');
}

export default {
  onStart: start,
  onShow: () => { ensureElement().resume(); },
  onHide: () => { element?.pause(); },
  onReset: reset
};
