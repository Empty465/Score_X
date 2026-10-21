const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const catalog = require('../games/catalog.js');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('game catalog has unique valid IDs and module paths', () => {
  const ids = catalog.map((game) => game.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const game of catalog) {
    assert.match(game.id, /^[a-z0-9-]+$/);
    assert.equal(game.module, `./games/${game.id}.js`);
    for (const key of ['title', 'icon', 'shortTitle', 'category', 'description', 'cardClass', 'artClass', 'bestDefault']) {
      assert.equal(typeof game[key], 'string', `${game.id}.${key} must be text`);
      assert.ok(game[key].length > 0, `${game.id}.${key} cannot be empty`);
    }
    assert.equal(typeof game.artMarkup, 'string');
    assert.ok(fs.existsSync(path.join(root, 'games', `${game.id}.js`)));
  }
});

test('every catalog game has a screen and registers with the host API', () => {
  const html = read('index.html');
  for (const game of catalog) {
    assert.ok(html.includes(`id="view-${game.id}"`), `${game.id} screen is missing`);
    assert.ok(read(`games/${game.id}.js`).includes(`registerGame('${game.id}'`), `${game.id} registration is missing`);
  }
});

test('server and frontend derive game registration from the shared catalog', () => {
  const server = read('server.js');
  const app = read('app.js');
  const loader = read('games/index.js');
  assert.ok(server.includes("require('./games/catalog.js')"));
  assert.ok(server.includes('gameCatalog.find((game) => pathname === game.module.slice(1))'));
  assert.ok(!server.includes("const games = ['snake'"));
  assert.ok(app.includes('window.PlaygroundGameCatalog'));
  assert.ok(app.includes('loadGameModule(game.module)'));
  assert.ok(loader.includes('new URL(modulePath, document.baseURI)'));
  assert.ok(loader.includes('import(moduleUrl)'));
  assert.ok(!app.includes("import('./games/index.js').catch"));
});
