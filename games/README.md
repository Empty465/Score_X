# 게임 모듈 추가

게임 로직은 `games/<id>.js`에 두고, 앱의 화면·점수판과 호스트 API로 연결합니다. 모듈은 해당 게임을 처음 열 때 동적으로 로드됩니다. `template.js`를 복사해 시작할 수 있습니다.

## 모듈 규약

- 게임 ID는 소문자 영문/숫자/하이픈으로 정하고, 화면 ID `view-<id>` 및 점수 키와 동일하게 씁니다.
- `window.Playground`에서 `getBest(id)`, `saveBest(id, value)`, `awardScore(id, points)`, `registerGame(id, lifecycle)`를 사용할 수 있습니다.
- 게임의 DOM 이벤트와 상태는 해당 모듈 안에 둡니다. `registerGame`의 `onLaunch`는 시작 화면 진입 시 초기화, `onShow`/`onHide`는 화면 표시/이탈 처리가 필요할 때 사용합니다.
- 게임 ID, 모듈 경로, 화면/점수판 표시 정보는 `games/catalog.js` 한 곳에 등록합니다. 화면 본문은 `index.html`, 게임별 스타일은 `styles.css`에 추가합니다.
- 서버의 게임 점수 허용 목록, SQLite 제약 및 모듈 제공 경로는 카탈로그에서 파생됩니다. `games/index.js`는 요청된 게임 모듈을 중복 없이 동적 로드합니다.

## 앱 연결 체크리스트

1. `games/<id>.js`에 게임 로직과 `window.Playground.registerGame('<id>', ...)`를 작성합니다. 호스트 API를 통해서만 최고 기록을 저장하고 점수를 제출합니다.
2. `games/catalog.js`에 고유한 ID, 모듈 경로, 화면·카드 표시 정보를 추가합니다. ID와 모듈 경로는 각각 `^[a-z0-9-]+$`, `./games/<id>.js` 규칙을 따라야 합니다.
3. `index.html`에 `id="view-<id>"` 화면을 추가하고, 필요한 스타일을 `styles.css`에 작성합니다. 게임 ID, 카탈로그 중복, 모듈 등록 누락, 화면 누락은 앱/서버 검사와 `npm test`로 확인합니다.
4. 선택한 게임만 지연 로드됩니다. 모듈 로드 또는 `registerGame` 등록에 실패하면 사용자에게 오류를 표시합니다.

기존 게임 예시: `snake.js`, `memory.js`, `reaction.js`, `mole.js`, `baseball.js`, `rocket.js`.
