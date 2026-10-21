// 게임 화면 어댑터 템플릿(전용 화면이 필요한 경우만). 게임 본체는 games/<id>/ 폴더(iframe)에 두고,
// 이 파일은 Shell 쪽 연결만 맡습니다. 실제 예시는 snake.js를 참고하세요.
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
