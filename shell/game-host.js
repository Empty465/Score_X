// 메인 화면에서 <scorex-game>을 만들고 HUD·게임오버·오류 이벤트를 화면 어댑터(games/<id>.js)에 연결하는 공용 도우미입니다.
import '/shell/scorex-game.js';

export function mountGame({ id, host, onHud, onGameOver, onError }) {
  let element = null;
  let starting = false;

  function ensure() {
    if (element) return element;
    element = document.createElement('scorex-game');
    element.setAttribute('game-id', id);
    element.addEventListener('scorex-hud', (event) => onHud?.(event.detail.items));
    element.addEventListener('scorex-gameover', (event) => onGameOver?.(event.detail));
    element.addEventListener('scorex-error', (event) => {
      if (event.detail.fatal) onError?.(event.detail.message || '게임을 실행할 수 없어요.');
    });
    host.append(element);
    return element;
  }

  // 시작에 성공하면 true를 돌려줍니다.
  async function start() {
    if (starting) return false;
    starting = true;
    try {
      const game = ensure();
      if (game.state === 'error' || game.state === 'destroyed') await game.load();
      await game.whenReady();
      await game.play();
      return true;
    } catch (error) {
      onError?.(error.message || '잠시 후 다시 시도해 주세요.');
      return false;
    } finally {
      starting = false;
    }
  }

  return {
    ensure,
    start,
    reload() {
      if (!element || element.state === 'loading') return;
      return element.load();
    },
    pause() { element?.pause(); },
    resume() { element?.resume(); }
  };
}
