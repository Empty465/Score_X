const assert = require('node:assert/strict');
const fs = require('node:fs');
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
