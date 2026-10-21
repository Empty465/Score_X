# Score X 미니게임 통신 프로토콜 명세 (v1 초안)

미니게임을 **iframe + Web Component** 로 분리하고, 메인 Shell과는 **`postMessage` 기반 Event Bus** 로만 데이터를 주고받기 위한 규격입니다.
게임 개발자는 이 문서와 매니페스트 규격만 지키면 DB·서버·인증 구조를 몰라도 독립적으로 개발할 수 있습니다.

> 상태: 초안. 프로토콜 변경은 팀 합의 후 `v`(버전)를 올려 반영합니다.

## 1. 설계 원칙

1. 게임은 **데이터만** 보냅니다. 서버 API 호출, 쿠키, DB, 인증, CR 지급은 모두 Shell의 책임입니다.
2. 게임은 Shell의 DOM을 직접 건드리지 않습니다. 우측 패널·결과창에 필요한 정보는 메시지로 전달합니다.
3. 게임 점수는 신뢰하지 않습니다. 검증은 Shell/서버가 합니다(§7).
4. 게임 추가·제거는 `games/<id>/` 폴더 추가·삭제만으로 이루어지며 Shell 재배포가 필요 없습니다(§2).

## 2. 게임 패키지 구조 (핫플러그)

```
games/
  <game-id>/
    manifest.json     # 필수: 게임 메타데이터 (§3)
    index.html        # 필수: iframe으로 로드되는 진입점
    ...               # 게임이 쓰는 JS/CSS/이미지 (상대 경로)
```

- `<game-id>`는 `^[a-z][a-z0-9_]{1,31}$` 형식이며 `manifest.json`의 `id`와 같아야 합니다.
- 서버는 `games/*/manifest.json`을 스캔하여 `GET /api/games` 로 목록을 제공합니다. 기본은 첫 요청 때 한 번만 스캔하므로 게임을 추가·제거한 뒤에는 서버를 재시작합니다(Shell 코드 재배포는 불필요). 재시작 없이 반영하려면 `GAMES_RESCAN_MS=1000`처럼 재스캔 주기(ms)를 환경변수로 지정합니다(개발·창작마당용). Shell은 이 목록으로 메뉴를 그립니다.
- 폴더를 삭제하면 목록에서 사라지고, 해당 게임 ID의 새 점수 제출은 거부됩니다. 기존 `best_scores`/`score_events` 기록은 보존합니다.
- 서버는 `games/` 하위만 정적 서빙하며 경로 탈출(`..`)을 막습니다.

## 3. 매니페스트 (`manifest.json`)

```json
{
  "id": "clop",
  "protocol": 1,
  "title": "4족 보행 로봇 운영",
  "shortTitle": "보행시험",
  "category": "QUADRUPED TRIAL",
  "description": "Q·W·O·P로 4족 로버의 다리를 움직여 목적지까지 가세요.",
  "icon": "🐾",
  "thumbnail": "thumb.png",
  "difficulties": ["EASY", "NORMAL", "HARD"],
  "maxScore": 5000,
  "minDurationMs": 3000,
  "aspectRatio": "16:9",
  "input": ["keyboard"],
  "hud": ["time"],
  "version": "1.0.0",
  "authors": ["jms"]
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✔ | 폴더명과 동일한 게임 ID |
| `protocol` | ✔ | 게임이 구현한 프로토콜 메이저 버전 (현재 `1`) |
| `title`, `shortTitle`, `category`, `description`, `icon` | ✔ | 카드·메뉴 표시용 텍스트 |
| `thumbnail` | | 카드 이미지(폴더 내 상대 경로). 없으면 `icon` 사용 |
| `difficulties` | | 지원 난이도. 생략 시 `["NORMAL"]` |
| `maxScore` | ✔ | 한 판에 얻을 수 있는 최대 점수. 서버가 초과 제출을 거부 |
| `minDurationMs` | | 한 판의 최소 소요 시간. 미만이면 서버가 거부 |
| `aspectRatio` | | iframe 비율 (`"16:9"`, `"1:1"`, `"4:3"` 등). 기본 `"16:9"` |
| `input` | | `keyboard`, `pointer`, `touch`. Shell이 안내 문구에 사용 |
| `hud` | | 게임이 보낼 HUD 항목 키 목록(§5.3). Shell이 우측 패널 행을 미리 준비 |
| `version`, `authors` | | 정보용 |

매니페스트 검증에 실패한 게임은 목록에서 제외하고 서버 로그에 사유를 남깁니다.

## 4. 통신 방식

### 4.1 iframe 설정

- Shell은 `<scorex-game game-id="...">` Web Component가 iframe을 생성·관리합니다.
- `sandbox="allow-scripts"` 만 사용합니다. **`allow-same-origin`은 사용하지 않습니다.**
  - 게임은 쿠키·`localStorage`·Shell DOM에 접근할 수 없고, 출처는 `"null"` 이 됩니다.
- 게임 코드는 외부 네트워크(서버 API 포함)를 호출하지 않는 것을 원칙으로 합니다. 에셋은 폴더 내 상대 경로만 사용합니다.

### 4.2 핸드셰이크 (MessageChannel)

sandbox 때문에 `event.origin` 검증이 불가능하므로, 최초 1회만 `window.postMessage`를 쓰고 이후에는 전용 `MessageChannel` 포트로만 통신합니다.

```
게임 iframe                         Shell
    | -- {protocol:"scorex", v:1, type:"hello"} ------> |   (window.parent.postMessage, targetOrigin "*")
    |                                                   |   event.source === iframe.contentWindow 확인
    | <-- {type:"welcome", ...} + port2 --------------- |   (iframe.contentWindow.postMessage, [port2])
    | == 이후 모든 메시지는 port1 <-> port2 로만 교환 == |
    | -- ready ----------------------------------------> |
```

- Shell은 `hello`의 발신자가 자신이 만든 iframe의 `contentWindow`인지(`event.source`) 확인하고, 일치하지 않으면 무시합니다.
- 핸드셰이크 이후 `window` 메시지 이벤트로 오는 `scorex` 메시지는 모두 무시합니다.
- `ready`가 **10초 안에** 오지 않으면 Shell은 로딩 실패로 처리하고 iframe을 제거합니다.

### 4.3 메시지 봉투

모든 메시지는 아래 형식입니다.

```json
{ "protocol": "scorex", "v": 1, "id": "m-17", "type": "game_over", "payload": { } }
```

| 필드 | 설명 |
|---|---|
| `protocol` | 항상 `"scorex"` |
| `v` | 프로토콜 메이저 버전(정수). Shell이 지원하지 않는 버전이면 `error` 후 종료 |
| `id` | 송신자가 붙이는 메시지 식별자(문자열). 응답이 필요한 메시지는 `replyTo`에 이 값을 넣음 |
| `type` | 메시지 종류(§5) |
| `payload` | 객체. 타입별 스키마(§5) |

- 알 수 없는 `type`, 형식이 틀린 메시지, 크기 초과(**16KB 초과**) 메시지는 **무시**합니다(로그만 남김).
- 수신 측은 payload를 항상 스키마 기준으로 검증하며, 신뢰하지 않습니다.
- 같은 `type`의 `hud` 메시지는 초당 최대 10회까지만 처리하며, 초과분은 버립니다.

## 5. 메시지 규격

### 5.1 핸드셰이크

| 방향 | type | payload |
|---|---|---|
| 게임→Shell | `hello` | `{ gameId, protocol: 1 }` (window로 전송) |
| Shell→게임 | `welcome` | `{ shellVersion }` + `MessagePort` (window로 전송) |
| 게임→Shell | `ready` | `{ gameVersion, capabilities: ["pause"] }` |

### 5.2 Shell → 게임

| type | payload | 설명 |
|---|---|---|
| `init` | `{ playId, difficulty, seed, locale, theme, viewport:{width,height}, user:{nickname\|null, guest:boolean} }` | `ready` 직후 1회. `seed`는 서버 발급 난수(정수)이며 게임은 이를 사용해 무작위 요소를 생성하는 것을 권장. `user`는 표시용이며 아이디는 전달하지 않음 |
| `start` | `{}` | 게임 시작 명령 (카운트다운 등은 게임 책임) |
| `pause` / `resume` | `{}` | 탭 전환·창 포커스 상실·사용자 일시정지 시 |
| `resize` | `{ width, height }` | iframe 크기 변경 |
| `destroy` | `{}` | 종료 직전 정리 요청. 게임은 타이머·이벤트·오디오를 정리하고 `destroyed`로 응답 |

### 5.3 게임 → Shell

| type | payload | 설명 |
|---|---|---|
| `ready` | §5.1 참고 | 로딩 완료 |
| `started` | `{}` | 실제 플레이 시작 시점(소요 시간 측정 기준) |
| `hud` | `{ items: { <key>: <value> } }` | 우측 패널 표시용 값. 키는 `time`(남은 시간, 초 단위 숫자), `score`, `lives`, `progress`(0~1), `combo`, `status`(문자열 ≤ 40자) 중 선택. 위험 상태는 `danger: true` 키를 같은 `items`에 포함 |
| `game_over` | `{ playId, score, durationMs, result, meta? }` | 한 판 종료. `result`는 `"clear"`, `"fail"`, `"timeout"`, `"quit"` 중 하나. `score`는 0 이상의 정수. `meta`는 게임별 요약(≤ 1KB, 결과창 상세 표시용 문자열/숫자 키-값) |
| `destroyed` | `{}` | `destroy` 요청에 대한 응답 |
| `error` | `{ code, message }` | 복구 불가 오류. Shell이 오류 화면을 표시 |
| `request_resize` | `{ aspectRatio? , height? }` | 필요한 경우 높이/비율 변경 요청(Shell이 허용 범위 내에서만 반영) |

- `game_over`는 **한 playId당 1회만** 처리합니다. 이후 도착한 메시지는 무시합니다.
- 게임은 `init`에서 받은 `playId`를 `game_over`에 그대로 돌려줘야 합니다.
- `hud.items.time` 같은 값은 게임이 책임지고 갱신합니다(Shell은 표시만).

### 5.4 오류 코드

`error.code`: `LOAD_FAILED`, `PROTOCOL_MISMATCH`, `INVALID_STATE`, `UNSUPPORTED`, `INTERNAL`. Shell 로컬 사유(타임아웃, 크래시 감지)는 Shell이 직접 오류 화면을 표시합니다.

## 6. 게임 생명주기

```
Shell: iframe 생성 → (hello 수신) → welcome(port)
게임 : ready
Shell: init → (사용자 시작 조작) → start
게임 : started → hud* → game_over
Shell: 점수 제출·결과창 표시 → 재도전 시 새 playId로 init → start
Shell: 게임 전환/닫기 시 destroy → destroyed 대기(최대 2초) → iframe 제거
```

- 재도전은 iframe을 유지한 채 새 `init`(새 `playId`/`seed`)를 보내는 방식을 기본으로 합니다.
- 게임이 응답하지 않거나 `destroyed`가 늦으면 Shell이 iframe을 강제 제거합니다.

## 7. 점수 신뢰 모델 (Shell/서버 책임)

서버 API: `GET /api/games`(매니페스트 목록), `POST /api/plays {game, difficulty?}` → `{playId, seed, difficulty, startedAt}`(게스트 가능), `POST /api/scores {game, points, playId, durationMs}`. 검증 실패는 400, 이미 사용한 `playId`는 409입니다. 서버 로그에 `[score-rejected]`로 남습니다.

게임이 보낸 `score`는 **참고값**입니다.

1. 플레이 시작: Shell이 서버에 플레이 세션 발급을 요청(`playId`, `seed`, 시작 시각).
2. 게임 종료: Shell이 `game_over`를 받아 서버에 `playId`, `score`, `durationMs`를 제출.
3. 서버 검증:
   - `playId`는 해당 계정(또는 게스트)에게 발급된 미사용 값이어야 하며 **1회만** 사용 가능
   - 매니페스트의 `maxScore` 초과 거부, `minDurationMs` 미만 거부
   - 서버가 측정한 실제 경과 시간과 `durationMs`의 큰 불일치 거부
4. 게스트는 기존 규칙대로 저장하지 않고 연출용 값만 돌려받습니다.

> 한계: 클라이언트가 계산한 점수이므로 완전한 부정 방지는 아닙니다. 서버 시뮬레이션 검증은 범위 밖이며 필요하면 별도 과제로 다룹니다.

## 8. 게임 개발자용 제공물

- [`sdk/scorex-sdk.js`](./sdk/scorex-sdk.js): 핸드셰이크·봉투·검증을 감싼 단일 파일 SDK. 게임 `index.html`에서 `<script src="../../sdk/scorex-sdk.js"></script>`로 불러옵니다(상대 경로라 `games/<id>/`, `examples/<id>/` 어디서든 동작).
  - `Scorex.onInit / onStart / onPause / onResume / onResize / onDestroy(handler)` → `Scorex.connect({ gameId, gameVersion })` → `Scorex.started()`, `Scorex.hud({...})`(초당 약 10회로 제한), `Scorex.gameOver({ score, durationMs, result, meta })`(playId당 1회, `playId`는 자동 첨부), `Scorex.error(code, message)`
- [`shell/scorex-game.js`](./shell/scorex-game.js): Shell용 `<scorex-game game-id="...">` Web Component. 이벤트 `scorex-ready`, `scorex-prepared`, `scorex-started`, `scorex-hud`, `scorex-gameover`, `scorex-error`를 발생시키며, 메서드는 `load()`, `whenReady()`, `prepare(difficulty)`, `start()`, `play(difficulty)`, `pause()`, `resume()`, `destroy()`입니다. 점수 제출은 하지 않고 `scorex-gameover`를 받은 Shell이 `/api/scores`로 제출합니다. 탭이 숨겨지면 자동으로 `pause`/`resume`을 보냅니다.
- [`shell/game-host.js`](./shell/game-host.js): Shell 어댑터(`games/<id>.js`) 공용 도우미. `mountGame({ id, host, difficulty, onHud, onGameOver, onError })`가 `<scorex-game>`을 만들어 붙이고 `{ ensure, start, reload, pause, resume }`을 돌려줍니다. 시작에 성공하면 `start()`는 `true`를 반환합니다.
- [`tools/harness.html`](./tools/harness.html): 목업 Shell 하니스. 서버·DB 없이 게임을 실행하고 메시지 로그, HUD, 서버 검증 시뮬레이션(maxScore·minDurationMs·경과 시간·playId 재사용)을 보여 줍니다.
- [`examples/hello_game/`](./examples/hello_game): 최소 구현 예제 게임(매니페스트 포함).

### 하니스 사용법

저장소 루트에서 정적 서버를 띄우고 게임 폴더를 지정합니다.

```
python -m http.server 8099 --bind 127.0.0.1
# 브라우저: http://127.0.0.1:8099/tools/harness.html?dir=../examples/hello_game
```

내 게임은 `?dir=../games/<id>` 로 열면 됩니다(`manifest.json`, `index.html`이 있는 폴더). 본 서버(`node server.js`)로도 `/tools/harness.html?dir=../games/<id>`로 열 수 있습니다.

## 9. 게임 개발 시 주의

- 외부 CDN·네트워크 호출 금지, 폴더 내 상대 경로 에셋만 사용합니다.
- `window.parent`, `window.top`, 쿠키, `localStorage`에 의존하지 않습니다(sandbox로 차단됨).
- sandbox에 `allow-forms`가 없으므로 `<form>` 제출은 동작하지 않습니다. 버튼 `click`과 입력창 `keydown`(Enter)으로 처리합니다.
- 난수는 `Math.random` 대신 `init.seed`로 시드한 PRNG를 사용합니다.
- 키보드·터치 입력은 iframe 안에서 처리하며, 시작 시 iframe에 포커스를 요청합니다.
- 오디오는 사용자 조작 이후에만 재생합니다(브라우저 자동재생 정책).
- `destroy` 수신 시 모든 타이머·이벤트 리스너·오디오를 정리합니다.

## 10. 현재 구조와의 차이 / 마이그레이션 메모

기존 7개 게임(`clop`, `reaction`, `mole`, `memory`, `baseball`, `snake`, `rocket`)은 모두 iframe으로 이전되었습니다(2026-10-22).

| 항목 | 구 방식 | 현재 |
|---|---|---|
| 게임 로딩 | 동적 import로 Shell DOM 직접 조작 | iframe + `<scorex-game>` + postMessage, 어댑터는 `shell/game-host.js` 사용 |
| HUD | 게임이 Shell DOM 직접 갱신 | `hud` 메시지 → Shell이 표시 |
| 점수 제출 | 게임이 `awardScore` 호출 | `game_over` → Shell 어댑터가 서버에 제출 |
| 점수 검증 | 값을 그대로 수용 | `playId`·`maxScore`·`minDurationMs` 검증 |

남은 사항 없음: 메뉴·카드·기본 게임 화면은 `GET /api/games`(매니페스트)에서 생성되며, `games/catalog.js`는 제거되었습니다. 전용 화면이 필요한 게임만 `index.html`의 `view-<id>`와 `games/<id>.js` 어댑터(default export 생명주기)를 둡니다. 자세한 절차는 [games/README.md](./games/README.md)를 참고합니다.

## 11. 변경 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| v1 초안 | 2026-10-21 | 최초 작성 |
| v1 | 2026-10-22 | 7개 게임 이전 완료, `shell/game-host.js`·sandbox `<form>` 제약 추가 |
