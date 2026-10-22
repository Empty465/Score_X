# 게임 추가하기

게임은 `games/<id>/` 폴더(iframe에서 실행)와 `manifest.json`만 있으면 메뉴·카드·기본 게임 화면이 자동으로 만들어집니다. `examples/`는 템플릿 보관용이라 게임 목록에 직접 표시되지 않습니다. 샘플을 바탕으로 새 게임을 만들거나 AI에게 전달할 요청문은 [examples/README.md](../examples/README.md)를 참고하세요. 통신 규격은 [MINIGAME_PROTOCOL.md](../MINIGAME_PROTOCOL.md)를 따릅니다.

## 최소 구성 (코드 수정 없음)

1. `games/<id>/manifest.json`과 `games/<id>/index.html`을 만듭니다(`examples/hello_game/` 참고). ID는 `^[a-z][a-z0-9_]{1,31}$`이며 폴더 이름 및 `Scorex.connect({ gameId })` 값과 같아야 합니다.
2. 프로토콜 v1 SDK(`../../sdk/scorex-sdk.js`)를 사용하고 `Scorex.onInit/onStart` 등 생명주기 핸들러를 등록한 뒤 `Scorex.connect()`를 호출합니다. 게임 종료는 `Scorex.gameOver()`로 알립니다. 게임 본체에서 서버 API나 Shell DOM을 직접 사용하지 않습니다.
3. 서버가 `GET /api/games`로 목록을 내려주면 앱이 메뉴, 카드, 기본 게임 화면(시작 버튼, HUD, 최고 기록, 결과)을 생성합니다. 기본 설정은 서버 시작 시 목록을 읽으므로 게임을 추가한 뒤 서버를 재시작합니다. 개발 중 자동 반영은 `GAMES_RESCAN_MS=1000`을 사용할 수 있습니다.
4. 점수는 `game_over` 메시지로 보내면 Shell이 `playId`와 함께 서버에 제출합니다. 게임별 최고 점수는 `best_scores`에 게임 ID 단위로 저장되어 별도 서버 수정이 필요 없습니다.

기본 카드는 매니페스트의 `icon`을 큰 글리프로 보여 줍니다.

## 전용 화면이 필요한 경우 (선택)

기본 화면 대신 게임별 사이드 패널·오버레이가 필요하면 다음을 추가합니다. 기본 게임 7종이 이 방식입니다.

- `index.html`에 `id="view-<id>"` 화면을 추가합니다. 게임이 들어갈 자리에는 `<div class="game-host" id="<id>-host"></div>`를 둡니다.
- `games/<id>.js` 어댑터를 만듭니다. `shell/game-host.js`의 `mountGame({ id, host, difficulty, onHud, onGameOver, onError })`로 게임을 올리고, 모듈의 **default export**로 생명주기 `{ onLaunch, onStart, onShow, onHide, onReset }`를 내보냅니다. `onStart`와 `onReset`은 선택 항목이며, 투자 시퀀스의 자동 시작과 화면 이탈 시 초기 상태 복귀에 사용합니다. `template.js`를 복사해 시작합니다.
- `window.Playground`에서 `getBest(id)`, `saveBest(id, value)`, `awardScore(id, points, { playId, durationMs })`를 사용합니다.
- 화면 `view-<id>`와 어댑터 `games/<id>.js`가 **둘 다** 있을 때만 전용 방식으로 동작하고, 아니면 기본 화면을 씁니다. 서버는 `GET /api/games`의 `adapter` 필드로 어댑터 존재 여부를 알려 줍니다.
- 카드 장식(`shell/card-art.js`)은 선택 사항이며, 없으면 `icon` 기반 기본 카드가 사용됩니다.

## 주의

- iframe은 `sandbox="allow-scripts"`라 `<form>` 제출, `localStorage`, `window.parent`를 쓸 수 없습니다.
- 어댑터는 저장소의 `games/<id>.js` 최상위 파일만 Shell 출처에서 실행됩니다. 외부 게임 폴더의 스크립트는 iframe 안에서만 실행됩니다.
- 어댑터는 선택한 게임만 지연 로드되며, 로드에 실패하면 사용자에게 오류를 표시합니다.
