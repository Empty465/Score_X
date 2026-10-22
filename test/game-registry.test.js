const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { normalizeManifest, createGameRegistry, resolveGameAsset } = require('../lib/game-registry.js');

const validManifest = {
  id: 'demo_game',
  protocol: 1,
  title: '데모',
  shortTitle: '데모',
  category: 'DEMO',
  description: '테스트용 게임',
  icon: '★',
  difficulties: ['EASY', 'NORMAL'],
  maxScore: 500,
  minDurationMs: 300
};

function writeGame(dir, id, manifest) {
  fs.mkdirSync(path.join(dir, id), { recursive: true });
  fs.writeFileSync(path.join(dir, id, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dir, id, 'index.html'), '<!doctype html><title>demo</title>');
  fs.writeFileSync(path.join(dir, id, 'game.js'), 'console.log(1)');
}

test('manifest validation normalizes defaults and rejects bad input', () => {
  const normalized = normalizeManifest(validManifest, 'demo_game');
  assert.equal(normalized.entry, '/games/demo_game/index.html');
  assert.equal(normalized.aspectRatio, '16:9');
  assert.deepEqual(normalized.input, ['keyboard']);
  assert.throws(() => normalizeManifest({ ...validManifest, id: 'other' }, 'demo_game'), /폴더/);
  assert.throws(() => normalizeManifest({ ...validManifest, protocol: 2 }, 'demo_game'), /protocol/);
  assert.throws(() => normalizeManifest({ ...validManifest, maxScore: 0 }, 'demo_game'), /maxScore/);
  assert.throws(() => normalizeManifest({ ...validManifest, maxScore: 100001 }, 'demo_game'), /maxScore/);
  assert.throws(() => normalizeManifest({ ...validManifest, difficulties: ['EXTREME'] }, 'demo_game'), /difficulties/);
  assert.throws(() => normalizeManifest({ ...validManifest, thumbnail: '../x.png' }, 'demo_game'), /thumbnail/);
});

test('registry skips invalid or conflicting games and picks up additions and removals', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sx-games-'));
  const logs = [];
  const registry = createGameRegistry({ gamesDir: dir, reservedIds: ['snake'], ttlMs: 0, log: (message) => logs.push(message) });
  assert.deepEqual(registry.ids(), []);
  writeGame(dir, 'demo_game', validManifest);
  writeGame(dir, 'snake', { ...validManifest, id: 'snake' });
  writeGame(dir, 'broken_game', { ...validManifest, id: 'broken_game', maxScore: -1 });
  assert.deepEqual(registry.ids(), ['demo_game']);
  assert.equal(logs.length, 2);
  fs.rmSync(path.join(dir, 'demo_game'), { recursive: true });
  assert.deepEqual(registry.ids(), []);
  fs.rmSync(dir, { recursive: true });
});

test('registry scans once by default and rescans only when ttlMs is set', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sx-games-'));
  const once = createGameRegistry({ gamesDir: dir });
  assert.deepEqual(once.ids(), []);
  writeGame(dir, 'demo_game', validManifest);
  assert.deepEqual(once.ids(), []);
  assert.deepEqual(createGameRegistry({ gamesDir: dir, ttlMs: 0 }).ids(), ['demo_game']);
  fs.rmSync(dir, { recursive: true });
});

test('asset resolver blocks traversal, dotfiles and unknown types', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sx-games-'));
  writeGame(dir, 'demo_game', validManifest);
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'x');
  const registry = createGameRegistry({ gamesDir: dir, ttlMs: 0 });
  assert.ok(resolveGameAsset(dir, registry, '/games/demo_game/index.html'));
  assert.ok(resolveGameAsset(dir, registry, '/games/demo_game/game.js'));
  assert.equal(resolveGameAsset(dir, registry, '/games/demo_game/../secret.txt'), null);
  assert.equal(resolveGameAsset(dir, registry, '/games/demo_game/%2e%2e/secret.txt'), null);
  assert.equal(resolveGameAsset(dir, registry, '/games/demo_game/..%2fsecret.txt'), null);
  assert.equal(resolveGameAsset(dir, registry, '/games/demo_game/a%5Cb.js'), null);
  assert.equal(resolveGameAsset(dir, registry, '/games/demo_game/.hidden.js'), null);
  assert.equal(resolveGameAsset(dir, registry, '/games/demo_game/manifest.exe'), null);
  assert.equal(resolveGameAsset(dir, registry, '/games/unknown_game/index.html'), null);
  fs.rmSync(dir, { recursive: true });
});

test('server issues play sessions and validates score submissions', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sx-e2e-'));
  const gamesDir = path.join(dir, 'games');
  const databasePath = path.join(dir, 'test.sqlite');
  writeGame(gamesDir, 'demo_game', validManifest);
  const legacyDatabase = new DatabaseSync(databasePath);
  legacyDatabase.exec(`
    CREATE TABLE accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE profiles (
      account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(nickname) BETWEEN 2 AND 16),
      avatar_id TEXT NOT NULL DEFAULT 'pilot',
      title_id TEXT NOT NULL DEFAULT '',
      background_id TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE wallets (
      account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0)
    );
    CREATE TABLE investment_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      stake INTEGER NOT NULL CHECK (stake > 0),
      risk TEXT NOT NULL CHECK (risk IN ('safe', 'balanced', 'high')),
      games_json TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
      outcome TEXT NOT NULL DEFAULT '',
      reward INTEGER NOT NULL DEFAULT 0 CHECK (reward >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
    INSERT INTO accounts (id, login_id, password_hash, password_salt) VALUES (1, 'legacy', 'hash', 'salt');
    INSERT INTO profiles (account_id, nickname) VALUES (1, '기존유저');
    INSERT INTO wallets (account_id, credits) VALUES (1, 40);
    INSERT INTO investment_runs (account_id, stake, risk, games_json, progress, status, outcome, reward)
      VALUES (1, 40, 'safe', '[\"demo_game\"]', 1, 'completed', 'break_even', 40);
  `);
  legacyDatabase.close();
  const port = 3200 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), DB_PATH: databasePath, GAMES_DIR: gamesDir, GAMES_RESCAN_MS: '1000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => {
    child.kill();
    return new Promise((resolve) => child.on('exit', () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 임시 파일 정리 실패는 무시 */ }
      resolve();
    }));
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${base}/api/games`)).ok) break; } catch { /* 서버 시작 대기 */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const json = async (method, url, body, cookie) => {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const list = await json('GET', '/api/games');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.games.map((game) => game.id), ['demo_game']);
  const migratedLeaderboard = await json('GET', '/api/leaderboard');
  const migratedInvestment = migratedLeaderboard.body.creditPlayers.find((player) => player.name === '기존유저').latestInvestment;
  assert.equal(migratedInvestment.status, 'completed');
  assert.equal(migratedInvestment.stake, 40);

  const asset = await fetch(`${base}/games/demo_game/game.js`);
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('access-control-allow-origin'), '*');
  assert.equal((await fetch(`${base}/games/demo_game/%2e%2e/%2e%2e/server.js`)).status, 404);
  for (const route of ['/sdk/scorex-sdk.js', '/shell/scorex-game.js', '/tools/harness.html']) {
    assert.equal((await fetch(base + route)).status, 200, `${route} must be served`);
  }

  assert.equal((await json('POST', '/api/plays', { game: 'nope' })).status, 400);
  assert.equal((await json('POST', '/api/plays', { game: 'demo_game', difficulty: 'HARD' })).status, 400);

  // playId 없이 점수를 보낼 수 없다.
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 100 })).status, 400);

  const reg = await json('POST', '/api/auth/register', { loginId: 'tester01', password: 'password123', nickname: '테스터' });
  assert.equal(reg.status, 201);
  const cookie = reg.headers.get('set-cookie').split(';')[0];

  const play = await json('POST', '/api/plays', { game: 'demo_game', difficulty: 'EASY' }, cookie);
  assert.equal(play.status, 201);
  assert.equal(play.body.difficulty, 'EASY');
  assert.ok(Number.isInteger(play.body.seed));

  // 너무 짧은 플레이, 최대 점수 초과, 실제 경과보다 긴 시간 보고는 거부한다.
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 100, playId: play.body.playId, durationMs: 400 }, cookie)).status, 400);
  await sleep(450);
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 501, playId: play.body.playId, durationMs: 400 }, cookie)).status, 400);
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 100, playId: play.body.playId, durationMs: 99999 }, cookie)).status, 400);

  const ok = await json('POST', '/api/scores', { game: 'demo_game', points: 100, playId: play.body.playId, durationMs: 400 }, cookie);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.saved, true);
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 100, playId: play.body.playId, durationMs: 400 }, cookie)).status, 409);
  const gameLeaderboard = await json('GET', '/api/leaderboard/games/demo_game');
  assert.equal(gameLeaderboard.status, 200);
  assert.deepEqual(gameLeaderboard.body.players.map((player) => [player.rank, player.name, player.score]), [[1, '테스터', 100]]);
  assert.equal((await json('GET', '/api/leaderboard/games/unknown_game')).status, 404);

  // 다른 계정이나 게스트는 남의 세션을 쓸 수 없다.
  const other = await json('POST', '/api/plays', { game: 'demo_game' }, cookie);
  await sleep(450);
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 50, playId: other.body.playId, durationMs: 400 })).status, 400);

  // 게스트도 세션을 받을 수 있고 점수는 저장되지 않는다.
  const guestPlay = await json('POST', '/api/plays', { game: 'demo_game' });
  await sleep(450);
  const guest = await json('POST', '/api/scores', { game: 'demo_game', points: 50, playId: guestPlay.body.playId, durationMs: 400 });
  assert.equal(guest.status, 200);
  assert.equal(guest.body.saved, false);
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 50, playId: guestPlay.body.playId, durationMs: 400 })).status, 409);

  const investment = await json('POST', '/api/investment/start', { stake: 50, risk: 'safe' }, cookie);
  assert.equal(investment.status, 201);
  const investmentGame = investment.body.run.games[0];
  const investmentPlay = await json('POST', '/api/plays', { game: investmentGame, difficulty: 'EASY' }, cookie);
  await sleep(450);
  const investmentScore = await json('POST', '/api/scores', {
    game: investmentGame,
    points: 100,
    playId: investmentPlay.body.playId,
    durationMs: 400
  }, cookie);
  assert.equal(investmentScore.status, 201);
  assert.equal(investmentScore.body.investment.status, 'completed');
  const leaderboard = await json('GET', '/api/leaderboard', undefined, cookie);
  const creditRank = leaderboard.body.creditPlayers.find((player) => player.id === leaderboard.body.currentUser.id);
  assert.equal(creditRank.latestInvestment.status, 'completed');
  assert.equal(creditRank.latestInvestment.stake, 50);
  assert.equal(typeof creditRank.latestInvestment.outcomeName, 'string');
  assert.equal(typeof creditRank.latestInvestment.net, 'number');

  const cancellableInvestment = await json('POST', '/api/investment/start', { stake: 51, risk: 'balanced' }, cookie);
  assert.equal(cancellableInvestment.status, 201);
  const cancellation = await json('POST', '/api/investment/cancel', {}, cookie);
  assert.equal(cancellation.status, 200);
  assert.equal(cancellation.body.refund, 25);
  assert.equal(cancellation.body.credits, cancellableInvestment.body.credits + 25);
  assert.equal(cancellation.body.run.status, 'cancelled');
  assert.equal(cancellation.body.run.reward, 25);
  assert.equal((await json('POST', '/api/investment/cancel', {}, cookie)).status, 409);
  const cancelledLeaderboard = await json('GET', '/api/leaderboard', undefined, cookie);
  const cancelledCreditRank = cancelledLeaderboard.body.creditPlayers
    .find((player) => player.id === cancelledLeaderboard.body.currentUser.id);
  assert.equal(cancelledCreditRank.latestInvestment.status, 'cancelled');
  assert.equal(cancelledCreditRank.latestInvestment.net, -26);

  // 폴더를 지우면 목록에서 사라지고 점수 제출도 거부된다.
  fs.rmSync(path.join(gamesDir, 'demo_game'), { recursive: true });
  await sleep(1100);
  assert.deepEqual((await json('GET', '/api/games')).body.games, []);
  assert.equal((await json('POST', '/api/scores', { game: 'demo_game', points: 10, playId: other.body.playId, durationMs: 400 }, cookie)).status, 400);

  // 매니페스트가 없는 카탈로그 게임은 레거시 경로 없이 거부된다.
  assert.equal((await json('POST', '/api/scores', { game: 'rocket', points: 120 }, cookie)).status, 400);
});
