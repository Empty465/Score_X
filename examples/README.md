# 미니게임 예제 사용법

`hello_game/`은 현재 Score X 프로토콜 v1과 `sdk/scorex-sdk.js`를 사용하는 실행 가능한 예제입니다. 예제 폴더 자체는 메인 페이지의 게임 목록에 나타나지 않습니다. 서버는 `games/<id>/manifest.json`만 검색하므로, 실제 게임은 반드시 `games/<id>/` 아래에 추가해야 합니다.

## 샘플을 메인 페이지에서 실행하기

저장소 루트에서 PowerShell을 열어 예제를 게임 폴더로 복사합니다.

```powershell
Copy-Item -Recurse examples\hello_game games\hello_game
node server.js
```

브라우저에서 `http://localhost:3000`을 열면 **샘플: 신호 연타**가 게임 목록에 표시됩니다. 이미 `games\hello_game`이 있으면 덮어쓰지 말고, 새 게임용 폴더를 만들어 주세요. 게임 추가 후 서버를 재시작해야 합니다. 개발 중에는 `GAMES_RESCAN_MS=1000`으로 자동 재검색을 켤 수 있습니다.

## 다른 AI에게 새 게임 요청하기

아래 요청문을 프로젝트를 연 AI에 전달하고 `<게임 이름>`과 `<id>`를 바꾸세요.

> 새 미니게임 `<게임 이름>`을 추가해줘. 먼저 `games/README.md`, `examples/README.md`, `examples/hello_game`과 비슷한 기존 게임을 확인하고 현재 프로토콜 v1을 따라줘. 게임 ID는 `<id>`야. 실제 파일은 `games/<id>/manifest.json`과 `games/<id>/index.html`에 만들어줘. `examples/` 아래에만 만들면 메인 페이지에 나타나지 않아. 폴더명, 매니페스트의 `id`, `Scorex.connect({ gameId })`를 모두 `<id>`로 맞춰. `../../sdk/scorex-sdk.js`를 사용하고 `onInit`, `onStart`, `onPause`, `onResume`, `onDestroy` 생명주기를 처리해. HUD와 종료 결과는 SDK로 보내고 서버 API나 DB를 직접 호출하지 마. 기본 메인 게임 화면에서 바로 즐길 수 있게 하고, 전용 화면이 꼭 필요한 경우에만 어댑터를 추가해. 기존 게임과 관계없는 수정이나 의존성 추가는 하지 마. 테스트를 실행하고 서버 재시작 후 `http://localhost:3000`의 목록 표시, 시작, 플레이, 종료, 점수 결과까지 확인한 뒤 수정 파일과 테스트 결과를 알려줘.

## 현재 예제 계약

- `manifest.json`의 `id`는 폴더명과 같아야 하며, SDK 연결 시 `gameId`와도 같아야 합니다.
- HTML은 상대 경로 `../../sdk/scorex-sdk.js`로 SDK를 가져옵니다. `games/<id>/`와 복사된 예제 폴더에서 모두 저장소 루트의 SDK를 가리킵니다.
- 시작·일시정지·재개·정리 처리는 `Scorex.onStart`, `Scorex.onPause`, `Scorex.onResume`, `Scorex.onDestroy`에서 합니다.
- 게임 종료는 `Scorex.gameOver({ score, durationMs, result, meta })`로 한 번만 보고합니다. `playId`는 SDK가 현재 플레이 세션 값으로 자동 첨부합니다.
- 허용된 매니페스트 필드와 메시지 형식은 [프로토콜 명세](../MINIGAME_PROTOCOL.md)를 따릅니다.
