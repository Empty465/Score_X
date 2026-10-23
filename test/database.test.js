const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createDatabase } = require('../lib/database.js');

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test('local database fallback is asynchronous and uses its configured file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorex-database-'));
  const localPath = path.join(dir, 'local.sqlite');
  const script = `
    const assert = require('node:assert/strict');
    const { createDatabase } = require(${JSON.stringify(path.join(__dirname, '..', 'lib', 'database.js'))});
    (async () => {
      const database = createDatabase();
      try {
        assert.equal(database.kind, 'sqlite');
        assert.equal(database.target, ${JSON.stringify(localPath)});
        await database.exec('CREATE TABLE values_table (value INTEGER NOT NULL)');
        await database.prepare('INSERT INTO values_table (value) VALUES (?)').run(42);
        assert.deepEqual(await database.prepare('SELECT value FROM values_table').get(), { value: 42 });
      } finally {
        await database.close();
      }
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  `;
  const env = { ...process.env, DB_PATH: localPath };
  delete env.TURSO_DATABASE_URL;
  delete env.TURSO_AUTH_TOKEN;
  try {
    const child = spawnSync(process.execPath, ['-e', script], { env, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Turso configuration requires both environment variables', async () => {
  await withEnvironment({ TURSO_DATABASE_URL: 'libsql://scorex.turso.io', TURSO_AUTH_TOKEN: undefined }, () => {
    assert.throws(() => createDatabase(), /TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN/);
  });
});

test('Turso target logging omits the authentication token', async () => {
  await withEnvironment({
    TURSO_DATABASE_URL: 'libsql://scorex.turso.io',
    TURSO_AUTH_TOKEN: 'secret-token',
    DB_PATH: undefined
  }, async () => {
    const database = createDatabase();
    try {
      assert.equal(database.kind, 'turso');
      assert.equal(database.target, 'libsql://scorex.turso.io');
      assert.equal(database.target.includes('secret-token'), false);
    } finally {
      await database.close();
    }
  });
});
