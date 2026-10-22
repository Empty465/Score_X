# Score X 게임 예제

## 기본 예제: `hello_game/`

새 게임을 만들 때 기준으로 삼을 완성된 최소 패키지입니다. 게임 폴더에는 다음 두 파일만 필요합니다.

- `manifest.json`: 게임 목록 카드와 점수 제한 등 메타데이터
- `index.html`: iframe 안에서 플레이되는 게임 본체와 Scorex SDK 연결

이 두 파일을 `games/<id>/`에 두면 메인 페이지가 시작 화면, HUD, 최고 기록, 재시작, 결과와 점수 제출 UI를 자동으로 제공합니다. 새 게임은 [게임 추가 안내](../games/README.md)와 아래 AI 요청문을 따라 같은 구조로 추가하세요. **예제 폴더 안에만 게임을 만들면 메인 목록에 나타나지 않습니다.**

### AI에게 전달할 요청문

아래 블록과 `examples/hello_game/` 폴더를 함께 전달하세요. `<게임 이름>`과 `<id>`를 바꾸면 됩니다.

> 이 폴더의 파일은 Score X 프로토콜 v1 미니게임 예제야. 구조와 SDK 사용법을 참고해서 `<게임 이름>`을 구현해줘. 게임 ID는 `<id>`야. 완성 파일은 예제 폴더가 아니라 `games/<id>/manifest.json`과 `games/<id>/index.html`로 만들어줘. `<id>`는 폴더명, manifest의 `id`, `Scorex.connect({ gameId })`에 모두 똑같이 사용해. `../../sdk/scorex-sdk.js`를 사용하고 `onInit`, `onStart`, `onPause`, `onResume`, `onDestroy`를 구현해. HUD는 `Scorex.hud()`로, 플레이 종료는 `Scorex.gameOver({ score, durationMs, result, meta })`로 보고해. 매니페스트의 `maxScore`, `minDurationMs`, `hud`와 실제 게임의 점수 상한·플레이 시간·HUD 항목을 일치시켜. 서버 API/DB를 직접 호출하거나 메인 `index.html`, `app.js`, CSS, 어댑터를 수정하지 마. 기본 화면은 플랫폼이 자동 제공하므로 게임 플레이 영역만 구현해도 시작 오버레이, HUD, 최고 기록, 재시작, 결과 및 점수 처리가 표시돼. 테스트 후 서버 재시작으로 게임 목록에 나타나는지와 시작·플레이·종료·재시작을 확인하고 결과를 알려줘.

### 직접 실행

PowerShell을 저장소 루트에서 열고 아직 해당 게임 ID 폴더가 없을 때 실행합니다.

```powershell
Copy-Item -Recurse examples\hello_game games\hello_game
node server.js
```

그다음 `http://localhost:3000`에서 **샘플: 신호 연타**를 플레이할 수 있습니다. 게임 추가 뒤 기본 설정에서는 서버를 재시작해야 목록에 반영됩니다. 개발 중 자동 검색을 원하면 `GAMES_RESCAN_MS=1000`을 설정할 수 있습니다.

## 선택 예제: `dedicated_screen/`

게임 전용 화면을 직접 만들고 싶을 때만 참고하는 고급 예제입니다. `view.html`은 프로젝트 루트 `index.html`의 푸터 앞에 추가할 화면이며, `adapter.js`는 `games/<id>.js`로 옮겨서 쓰는 Shell 어댑터입니다. `adapter-template.js`는 새 어댑터를 작성할 때 복사하는 시작 템플릿입니다. 기본 화면보다 설정할 곳이 많으므로 일반적인 신규 게임에는 필요하지 않습니다. 상세 조건은 [게임 추가 안내](../games/README.md#전용-화면이-필요한-경우-선택)를 참고하세요.

## 예제 파일 계약

- HTML은 `../../sdk/scorex-sdk.js`를 불러옵니다. `games/<id>/` 아래에서도 저장소 루트의 SDK로 연결되는 상대 경로입니다.
- SDK 연결과 종료 메시지 규격은 [프로토콜 명세](../MINIGAME_PROTOCOL.md)를 따릅니다. SDK가 `playId`를 게임 종료 메시지에 첨부합니다.
- 기본 화면은 매니페스트의 `hud` 설정을 읽어 게임 HUD를 표시합니다. `score`를 HUD에 선언하고 게임에서 `Scorex.hud({ score })`를 보내세요.
- `tools/harness.html`은 예제 파일이 아니라 프로토콜을 확인하는 개발 도구라 `tools/`에 유지합니다.
