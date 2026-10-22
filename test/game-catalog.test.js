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

test('hello_game example is discoverable after copying it into games/', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scorex-example-'));
  try {
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
