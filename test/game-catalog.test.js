const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createGameRegistry } = require('../lib/game-registry.js');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const registry = createGameRegistry({ gamesDir: path.join(root, 'games') });

test('every built-in game has a manifest, a screen and an adapter with a default lifecycle export', () => {
  const html = read('index.html');
  const ids = registry.ids();
  assert.ok(ids.length >= 7);
  for (const id of ['snake', 'memory', 'reaction', 'mole', 'baseball', 'rocket', 'clop']) {
    assert.ok(ids.includes(id), `${id} manifest is missing`);
    assert.equal(Object.hasOwn(registry.get(id), 'difficulties'), false, `${id} should not expose difficulty options`);
    assert.ok(html.includes(`id="view-${id}"`), `${id} screen is missing`);
    assert.ok(/^export default \{/m.test(read(`games/${id}/adapter.js`)), `${id} adapter must export a default lifecycle`);
    assert.ok(html.includes(`data-best="${id}"`), `${id} screen must show its best record`);
  }
});

test('every game loads its game logic from an external game.js file', () => {
  for (const id of registry.ids()) {
    const html = read(`games/${id}/index.html`);
    const gameJs = read(`games/${id}/game.js`);
    assert.ok(html.includes('<script src="game.js"></script>'), `${id} should load game.js`);
    assert.ok(!/<script\s*>[\s\S]*?<\/script>/.test(html), `${id} should not contain inline scripts`);
    assert.ok(gameJs.trim(), `${id} game.js should not be empty`);
    assert.doesNotThrow(() => new Function(gameJs), `${id} game.js should parse`);
  }
});

test('new orbital mini-games are discovered and implement the game protocol', () => {
  const requiredLogic = {
    galaga: [
      'roundEnemyCount = Math.min(18, 4 + round)',
      'roundEnemyCount - enemies.length',
      'score = Math.min(MAX_SCORE, score + 10 + round * 5)',
      "context.textAlign = 'right'",
      "context.fillText(`LIVES ${'♥ '.repeat(lives)}`, WIDTH - 20, 30)",
      "context.textAlign = 'left'",
      'index < 135',
      'context.ellipse(WIDTH / 2, 385, 205, 90'
    ],
    tetris: [
      'board = [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...remaining]',
      'dropInterval() { return Math.max(120, 850 - (level() - 1) * 70); }'
    ],
    dino: [
      "[' ', 'ArrowUp', 'w', 'W']",
      "['ArrowDown', 's', 'S']",
      'score = Math.min(MAX_SCORE, Math.floor(distance / 100))'
    ]
  };
  for (const id of ['galaga', 'tetris', 'dino']) {
    const manifest = JSON.parse(read(`games/${id}/manifest.json`));
    const html = read(`games/${id}/index.html`);
    const gameJs = read(`games/${id}/game.js`);

    assert.ok(registry.ids().includes(id), `${id} manifest should be discovered`);
    assert.equal(registry.get(id).title, manifest.title);
    assert.ok(registry.get(id).maxScore <= 100000, `${id} maximum score should be server-compatible`);
    assert.ok(html.includes('<script src="game.js"></script>'), `${id} should load its external game script`);
    assert.ok(!/<script>[\s\S]*?<\/script>/.test(html), `${id} should not keep inline game code`);
    assert.ok(gameJs.includes(`Scorex.connect({ gameId: '${id}'`), `${id} should connect to the Score X SDK`);
    assert.ok(gameJs.includes('Scorex.onStart('), `${id} should respond to start`);
    assert.ok(gameJs.includes('Scorex.gameOver('), `${id} should report the result`);
    for (const behavior of requiredLogic[id]) {
      assert.ok(gameJs.includes(behavior), `${id} is missing required behavior: ${behavior}`);
    }
    assert.doesNotThrow(() => new Function(gameJs), `${id} script should parse`);
  }
});

test('new mini-game controls and status indicators are clearly explained', () => {
  const rover = read('games/dino/index.html');
  const roverSource = `${rover}\n${read('games/dino/game.js')}`;
  const roverManifest = JSON.parse(read('games/dino/manifest.json'));
  const defense = read('games/galaga/index.html');
  const defenseSource = `${defense}\n${read('games/galaga/game.js')}`;
  const defenseManifest = JSON.parse(read('games/galaga/manifest.json'));
  const cargo = read('games/tetris/index.html');
  const cargoSource = `${cargo}\n${read('games/tetris/game.js')}`;
  const cargoManifest = JSON.parse(read('games/tetris/manifest.json'));

  assert.ok(rover.includes('Space</kbd> / <kbd>↑</kbd> / <kbd>W</kbd> 점프'));
  assert.ok(rover.includes('숙이기'));
  assert.ok(rover.includes('data-control="duck" aria-label="숙이기"'));
  assert.ok(!rover.includes('progress'));
  assert.ok(!roverManifest.hud.includes('progress'));
  assert.ok(roverSource.includes("const height = bird ? 81 : 30 + Math.floor(rng() * 19)"));
  assert.ok(roverSource.includes('obstacle.y + obstacle.height'));
  assert.ok(roverSource.includes('obstacle.x < 158 && obstacle.x + obstacle.width > 106'));
  assert.ok(roverSource.includes('GROUND - jumpHeight - 5'));
  assert.ok(roverSource.includes('jumpVelocity = 500'));
  assert.ok(roverSource.includes('jumpVelocity -= 1400 * dt'));
  assert.ok(roverManifest.description.includes('드론'));
  assert.ok(roverManifest.description.includes('숙여'));
  assert.ok(roverManifest.description.includes('장애물'));
  assert.equal(defenseManifest.aspectRatio, '5:6');
  assert.ok(defenseSource.includes('<canvas id="canvas" width="480" height="576"'));
  assert.ok(defenseSource.includes('height: calc(100% - 38px)'));
  assert.ok(defenseSource.includes('height: calc(100% - 80px)'));
  assert.ok(defense.includes('<kbd>←</kbd> / <kbd>A</kbd> 왼쪽'));
  assert.ok(defense.includes('<kbd>→</kbd> / <kbd>D</kbd> 오른쪽'));
  assert.ok(!defense.includes('자동 발사</span>'));
  assert.ok(cargo.includes('<kbd>Space</kbd> / <kbd>S</kbd> / <kbd>↓</kbd> 누르는 동안 가속'));
  assert.ok(cargoSource.includes('<canvas id="canvas" width="600" height="1200"'));
  assert.equal(cargoManifest.aspectRatio, '1:2');
  assert.ok(cargo.includes('width: 100%; height: 100%'));
  assert.ok(cargoSource.includes('const CELL = 45'));
  assert.ok(cargoSource.includes('const BOARD_X = 75'));
  assert.ok(cargoSource.includes('const BOARD_Y = 150'));
  assert.ok(cargoSource.includes('context.fillText(\'SCORE\', 20, 57)'));
  assert.ok(cargoSource.includes('context.fillText(\'NEXT\', 425, 28)'));
  assert.ok(cargoSource.includes('(row + col) % 2 === 0 ? \'#142d40\' : \'#122a3c\''));
  assert.ok(cargoSource.includes('context.strokeRect(59.5, 134.5, 481, 931)'));
  assert.ok(cargoSource.includes('height: calc(100% - 72px)'));
  assert.ok(cargoSource.includes("keyActions[event.key] === 'accelerate'"));
  assert.ok(cargoSource.includes('dropInterval() / (accelerating ? 4 : 1)'));
  assert.ok(cargoSource.includes('score + [0, 10, 30, 50, 80][cleared] * level()'));
  assert.ok(!cargoSource.includes('fallProgress'));
  assert.ok(cargoSource.includes('(current.y + y) * CELL'));
  assert.ok(cargo.includes('.controls button[data-action="accelerate"] { width: 64px;'));
  assert.ok(!cargoSource.includes('function hardDrop()'));
  assert.ok(!cargoManifest.hud.includes('progress'));
  for (const game of [rover, defense, cargo]) {
    assert.ok(game.includes('user-select: none'));
    assert.ok(game.includes('-webkit-user-select: none'));
    assert.ok(game.includes('-webkit-touch-callout: none'));
  }
});

test('new mini-games have dedicated home art and desktop gameplay guides', () => {
  const cardArt = read('shell/card-art.js');
  const generic = read('shell/generic-game.js');
  const styles = read('styles.css');
  for (const [id, artClass, guideTitle] of [
    ['galaga', 'galaga-art', '우주선 조작'],
    ['tetris', 'tetris-art', '적재 조작'],
    ['dino', 'dino-art', '로버 조작']
  ]) {
    const manifest = JSON.parse(read(`games/${id}/manifest.json`));
    assert.ok(cardArt.includes(`${id}: {`), `${id} should have a dedicated home-card illustration`);
    assert.ok(cardArt.includes(`artClass: '${artClass}'`), `${id} should use its themed illustration`);
    assert.ok(generic.includes(`${id}: {`), `${id} should have gameplay instructions`);
    assert.ok(generic.includes(`title: '${guideTitle}'`), `${id} should label its control guide`);
    assert.ok(styles.includes(`.card-${id} .game-art`), `${id} should style its home illustration`);
    assert.ok(manifest.description.length <= 30, `${id} should use a short home-card description`);
  }
  assert.ok(styles.includes('.game-guide-controls'));
  assert.ok(styles.includes('.card-galaga .card-info p'));
  assert.match(cardArt, /tetris:[\s\S]*?artMarkup: '<span class="tetris-stack">[\s\S]*?tetris-active[\s\S]*?<\/span>'/);
  assert.ok(styles.includes('.tetris-stack { position: absolute; inset: 12% 34% 10%; overflow: hidden;'));
  assert.ok(styles.includes('.tetris-block.block-three { left: 70%; bottom: 10%; }'));
  assert.ok(styles.includes('.tetris-active { position: absolute; top: 16%; left: 20%; width: 60%;'));
  assert.ok(generic.includes("keys: ['Space', '↑', 'W'], action: '점프'"));
  assert.ok(generic.includes("keys: ['S', '↓'], action: '숙이기'"));
  assert.ok(generic.includes("keys: ['Space', 'S', '↓'], action: '누르는 동안 가속'"));
});

test('game screens expand to the available desktop and portrait-touch space', () => {
  const styles = read('styles.css');
  const component = read('shell/scorex-game.js');
  assert.ok(styles.includes('max-width: 1400px'));
  assert.ok(styles.includes('grid-template-columns: minmax(0, 2fr) minmax(230px, .85fr)'));
  assert.ok(styles.includes('.app-shell:has(.game-view.is-visible)'));
  assert.ok(component.includes("window.matchMedia('(pointer: coarse) and (orientation: portrait)')"));
  assert.ok(component.includes("mobilePortrait && width > height ? '1 / 1'"));
  assert.ok(component.includes('removeEventListener(\'change\', this._onMobilePortraitChange)'));
  assert.ok(styles.includes('#view-tetris .play-layout'));
  assert.ok(styles.includes('calc((100vh - 356px) / 2)'));
  assert.ok(styles.includes('#view-galaga .play-layout'));
  assert.ok(styles.includes('calc((100vh - 356px) * 5 / 6)'));
  assert.ok(styles.includes('#view-tetris .board-wrap'));
  assert.ok(styles.includes('max(190px, calc((100vh - 360px) / 2))'));
  assert.ok(styles.includes('#view-galaga .board-wrap'));
});

test('memory and emergency grids use the available screen instead of a small fixed width', () => {
  const memory = read('games/memory/index.html');
  const mole = read('games/mole/index.html');
  assert.ok(memory.includes('width: min(94%, 680px, 92vh)'));
  assert.ok(!memory.includes('320px'));
  assert.ok(mole.includes('width: min(92%, 620px)'));
});

test('game menu is derived from manifests, not a static catalog', () => {
  const server = read('server.js');
  const app = read('app.js');
  const loader = read('games/index.js');
  assert.ok(!fs.existsSync(path.join(root, 'games', 'catalog.js')));
  assert.ok(!server.includes('catalog'));
  assert.ok(!app.includes('PlaygroundGameCatalog'));
  assert.ok(!app.includes('registerGame'));
  assert.ok(app.includes("fetch('/api/games')"));
  assert.ok(server.includes('gameRegistry.list()'));
  assert.ok(loader.includes('`/games/${id}/adapter.js`'));
  assert.ok(loader.includes('import(moduleUrl)'));
});

test('game launch and manifest APIs do not expose a difficulty selector', () => {
  const app = read('app.js');
  const server = read('server.js');
  const registry = read('lib/game-registry.js');
  const component = read('shell/scorex-game.js');
  const host = read('shell/game-host.js');
  const generic = read('shell/generic-game.js');
  const harness = read('tools/harness.html');
  assert.ok(!registry.includes('DIFFICULTIES'));
  assert.ok(!registry.includes('difficulties:'));
  assert.ok(!server.includes('payload.difficulty'));
  assert.ok(!component.includes('difficulty'));
  assert.ok(!host.includes('difficulty'));
  assert.ok(!generic.includes('difficulty'));
  assert.ok(!harness.includes('difficulty'));
  assert.ok(!app.includes('difficulty'));
});

test('generic game views are inserted before the page footer', () => {
  const app = read('app.js');
  assert.ok(app.includes("const footer = document.querySelector('.page-footer');"));
  assert.ok(app.includes('footer.parentElement.insertBefore(section, footer);'));
});

test('ranking details open only through click or keyboard activation', () => {
  const app = read('app.js');
  const styles = read('styles.css');

  assert.ok(app.includes("container.addEventListener('click'"));
  assert.ok(app.includes("container.addEventListener('keydown'"));
  assert.ok(!app.includes("addEventListener('pointerover'"));
  assert.ok(!app.includes("addEventListener('pointerout'"));
  assert.ok(!styles.includes('.ranking-row:hover .ranking-detail'));
});

test('guest best record displays the locally saved value', () => {
  const app = read('app.js');
  assert.ok(app.includes("const localBest = getBest(game);"));
  assert.ok(app.includes("localBest === null ? getGame(game).bestDefault : formatPoints(Number(localBest))"));
  assert.match(app, /const lifecycle = validateLifecycle\(game\.id, createGenericGame\(game, section\)\);\r?\n  renderBests\(\);/);
});

test('game views load per-game player best-score rankings', () => {
  const app = read('app.js');
  const server = read('server.js');
  const styles = read('styles.css');
  assert.ok(app.includes('refreshGameLeaderboard(name)'));
  assert.ok(app.includes('/api/leaderboard/games/${encodeURIComponent(gameId)}'));
  assert.ok(app.includes("player.isCurrentUser ? ' is-current-player' : ''"));
  assert.ok(app.includes('refreshGameLeaderboard(game);'));
  assert.ok(server.includes('const gameLeaderboardMatch = /^\\/api\\/leaderboard\\/games\\/'));
  assert.ok(styles.includes('.game-leaderboard-row.is-current-player .game-leaderboard-player'));
});

test('investment navigation waits for the player to press the game start button', () => {
  const app = read('app.js');
  assert.match(app, /await openGame\(nextGame, true,[\s\S]*?\}\);/);
  assert.doesNotMatch(app, /await openGame\(nextGame, true,[\s\S]*?\}, true\);/);
  assert.match(app, /await gameElement\.whenReady\(\);[\s\S]*?if \(startImmediately\) await lifecycle\.onStart\?\.\(\);/);
});

test('mobile debris-collection controls are enlarged and arranged as a directional cross', () => {
  const game = read('games/snake/index.html');
  assert.match(game, /canvas \{[^}]*flex: 0 1 auto; width: min\(100%, 100vh\)/);
  assert.match(game, /@media \(pointer: coarse\) \{[\s\S]*?canvas \{ width: min\(100%, calc\(100vh - 190px\)\); max-height: calc\(100% - 184px\); \}/);
  assert.match(game, /\.dpad \{[^}]*grid-template: repeat\(3, 54px\) \/ repeat\(3, 54px\)/);
  assert.match(game, /\.dpad button \{[^}]*width: 54px; height: 54px/);
  for (const [direction, area] of [['up', '1 / 2'], ['left', '2 / 1'], ['down', '3 / 2'], ['right', '2 / 3']]) {
    assert.ok(game.includes(`.dpad [data-direction="${direction}"] { grid-area: ${area}; }`));
  }
  assert.match(game, /@media \(pointer: coarse\) \{[\s\S]*?\.dpad \{ display: grid; \}/);
});

test('emergency warning game spawns groups of one to three lights with extra response time', () => {
  const game = read('games/mole/index.html');
  const gameJs = read('games/mole/game.js');
  const adapter = read('games/mole/adapter.js');
  assert.ok(gameJs.includes('let active = new Set();'));
  assert.ok(gameJs.includes('const count = roll < .62 ? 1 : roll < .92 ? 2 : 3;'));
  assert.ok(gameJs.includes('active.add(available.splice(candidateIndex, 1)[0]);'));
  assert.ok(gameJs.includes('active.delete(index);'));
  assert.ok(gameJs.includes('600 + count * 300 + rng() * 250'));
  assert.ok(game.includes('<script src="game.js"></script>'));
  assert.ok(adapter.includes('한 번에 1~3개 켜지는 비상 스위치를 모두 눌러'));
});

test('daily attendance reward uses a scratch dialog and server-claimed check-in', () => {
  const app = read('app.js');
  const server = read('server.js');
  const html = read('index.html');
  const styles = read('styles.css');
  assert.ok(server.includes('CREATE TABLE IF NOT EXISTS attendance_claims'));
  assert.ok(server.includes("url.pathname === '/api/attendance/status'"));
  assert.ok(server.includes("url.pathname === '/api/attendance/claim'"));
  assert.ok(server.includes("adjustCredits(accountId, reward, 'attendance_daily', claimDate)"));
  assert.ok(app.includes("fetch('/api/attendance/status')"));
  assert.ok(app.includes("fetch('/api/attendance/claim', { method: 'POST' })"));
  assert.ok(app.includes("attendanceScratchCanvas.addEventListener('pointermove'"));
  assert.ok(html.includes('id="attendance-scratch-canvas"'));
  assert.ok(styles.includes('#attendance-scratch-canvas {'));
});

test('hello_game example is discoverable after copying it into games/', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scorex-example-'));
  try {
    assert.deepEqual(
      fs.readdirSync(path.join(root, 'examples', 'hello_game')).sort(),
      ['index.html', 'manifest.json'],
      'basic example should be a self-contained two-file game package'
    );
    const gamesDir = path.join(tempRoot, 'games');
    fs.mkdirSync(gamesDir);
    fs.cpSync(path.join(root, 'examples', 'hello_game'), path.join(gamesDir, 'hello_game'), { recursive: true });

    const sample = createGameRegistry({ gamesDir }).get('hello_game');
    assert.ok(sample, 'copied example should be included in the game registry');
    assert.equal(sample.entry, '/games/hello_game/index.html');
    assert.equal(sample.maxScore, 1000);
    assert.equal(sample.minDurationMs, 10000);

    const html = fs.readFileSync(path.join(gamesDir, 'hello_game', 'index.html'), 'utf8');
    assert.ok(html.includes('../../sdk/scorex-sdk.js'));
    assert.ok(html.includes("Scorex.connect({ gameId: 'hello_game'"));
    assert.ok(html.includes('const DURATION_MS = 10000;'));
    assert.ok(html.includes('const MAX_SCORE = 1000;'));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('dedicated-screen example includes a matching adapter and view markup', () => {
  const adapter = read('examples/dedicated_screen/adapter.js');
  const template = read('examples/dedicated_screen/adapter-template.js');
  const view = read('examples/dedicated_screen/view.html');
  const guide = read('examples/README.md');

  assert.ok(adapter.includes("id: 'hello_game'"));
  assert.ok(adapter.includes("document.querySelector('#hello_game-host')"));
  assert.ok(/^export default \{/m.test(adapter));
  assert.ok(view.includes('id="view-hello_game"'));
  assert.ok(view.includes('id="hello_game-host"'));
  assert.ok(view.includes('id="hello_game-start"'));
  assert.ok(guide.includes('시작 화면'));
  assert.ok(guide.includes('재시작'));
  assert.ok(guide.includes('최고 기록'));
  assert.ok(guide.includes('games/<id>/manifest.json'));
  assert.ok(template.includes("import { mountGame } from '/shell/game-host.js';"));
  assert.ok(!fs.existsSync(path.join(root, 'games', 'template.js')));
  assert.ok(!fs.existsSync(path.join(root, 'examples', 'hello_game', 'adapter.js')));
  assert.ok(!fs.existsSync(path.join(root, 'examples', 'hello_game', 'dedicated-view.html')));
});
