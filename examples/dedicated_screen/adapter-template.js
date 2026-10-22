// 전용 화면이 필요한 게임의 Shell 어댑터 템플릿입니다.
import { mountGame } from '/shell/game-host.js';

const { getBest, saveBest, awardScore } = window.Playground;

const game = mountGame({
  id: 'mygame',
  host: document.querySelector('#mygame-host'),
  onHud: (items) => { /* items.score 등을 화면에 표시 */ },
  onError: (message) => { /* 오류 안내 */ },
  async onGameOver({ playId, score, durationMs }) {
    if (score > Number(getBest('mygame') || 0)) saveBest('mygame', score);
    await awardScore('mygame', score, { playId, durationMs });
  }
});

document.querySelector('#mygame-start').addEventListener('click', () => game.start());

export default {
  onLaunch: () => { game.ensure(); },
  onShow: () => { game.ensure(); game.resume(); },
  onHide: () => game.pause()
};
