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
    assert.ok(html.includes(`id="view-${id}"`), `${id} screen is missing`);
    assert.ok(/^export default \{/m.test(read(`games/${id}.js`)), `${id} adapter must export a default lifecycle`);
    assert.ok(html.includes(`data-best="${id}"`), `${id} screen must show its best record`);
  }
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
  assert.ok(loader.includes('import(moduleUrl)'));
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
  assert.match(game, /\.dpad \{[^}]*grid-template: repeat\(3, 54px\) \/ repeat\(3, 54px\)/);
  assert.match(game, /\.dpad button \{[^}]*width: 54px; height: 54px/);
  for (const [direction, area] of [['up', '1 / 2'], ['left', '2 / 1'], ['down', '3 / 2'], ['right', '2 / 3']]) {
    assert.ok(game.includes(`.dpad [data-direction="${direction}"] { grid-area: ${area}; }`));
  }
  assert.match(game, /@media \(pointer: coarse\) \{ \.dpad \{ display: grid; \} \}/);
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
