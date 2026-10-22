# 전용 화면 어댑터 예제

이 폴더는 게임별 화면과 Shell 어댑터를 직접 만들 때 참고하는 선택 예제입니다. 기본적인 새 게임은 이 예제 없이 `manifest.json`과 `index.html`만으로 추가하세요. 플랫폼이 시작·재시작, HUD, 최고 기록, 결과·점수 제출 UI를 자동으로 구성합니다.

## 파일 역할

- `view.html`: 프로젝트 루트 `index.html`에 추가할 전용 게임 화면 조각입니다. `id="view-hello_game"`과 어댑터가 조회하는 화면 요소 ID가 서로 일치해야 합니다. 페이지 푸터 앞에 둡니다.
- `adapter.js`: `games/hello_game.js`에 둘 Shell 출처 어댑터입니다. `mountGame()`으로 iframe 게임을 연결하고 HUD, 오류, 종료, 최고 기록, 점수 제출을 처리합니다.
- `adapter-template.js`: 자체 전용 어댑터를 새로 작성할 때 복사해 시작할 수 있는 최소 템플릿입니다.

## 적용 시 주의

이 파일들을 게임 폴더 안에 복사하는 것만으로 전용 화면이 활성화되지는 않습니다. 게임 manifest 및 게임 본체는 여전히 `games/hello_game/`에 두고, 화면 조각은 루트 `index.html`에 통합하고, 어댑터는 `games/hello_game.js`로 둬야 합니다. 게임 ID를 바꾸면 view ID, DOM ID, 어댑터의 게임 ID도 함께 변경하세요.

두 Shell 파일 변경이 필요 없도록 하려면 전용 화면을 추가하지 말고 플랫폼의 자동 기본 화면을 사용하세요.
