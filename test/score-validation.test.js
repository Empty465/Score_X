const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MIN_DURATION_MS = 200;

async function startServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorex-score-'));
  const gamesDir = path.join(dir, 'games');
  for (const [id, maxScore] of [['alpha', 500], ['beta', 500]]) {
    fs.mkdirSync(path.join(gamesDir, id), { recursive: true });
    fs.writeFileSync(path.join(gamesDir, id, 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(gamesDir, id, 'manifest.json'), JSON.stringify({
      id, protocol: 1, title: id, shortTitle: id, category: 'TEST', description: id, icon: '🎮', maxScore, minDurationMs: MIN_DURATION_MS
    }));
  }
  const port = 3700 + Math.floor(Math.random() * 300);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: path.join(dir, 'test.sqlite'), GAMES_DIR: gamesDir },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(() => new Promise((resolve) => {
    child.on('exit', () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 임시 파일 정리 실패는 무시 */ }
      resolve();
    });
    child.kill();
  }));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* 서버 시작 대기 */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const json = async (method, url, body, cookie) => {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  return { json, rejectedLogCount: () => (stderr.match(/\[score-rejected\]/g) || []).length };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function registerUser(json, loginId) {
  const reg = await json('POST', '/api/auth/register', { loginId, password: 'password123', passwordConfirm: 'password123', privacyConsent: true, nickname: `유저${loginId.slice(-3)}` });
  assert.equal(reg.status, 201);
  return { cookie: reg.headers.get('set-cookie').split(';')[0], credits: reg.body.user.credits };
}

test('점수 제출 본문 형식을 엄격하게 검증하고 세션은 소모하지 않는다', async (t) => {
  const { json } = await startServer(t);
  const { cookie } = await registerUser(json, 'format01');
  const play = (await json('POST', '/api/plays', { game: 'alpha' }, cookie)).body.playId;
  await sleep(MIN_DURATION_MS + 100);
  const valid = { game: 'alpha', points: 100, playId: play, durationMs: MIN_DURATION_MS };

  const badBodies = [
    { ...valid, points: '100' },
    { ...valid, points: true },
    { ...valid, points: null },
    { ...valid, points: [] },
    { ...valid, points: 1.5 },
    { ...valid, points: -1 },
    { ...valid, points: 100001 },
    { game: valid.game, playId: play, durationMs: valid.durationMs },
    { ...valid, game: ['alpha'] },
    { ...valid, game: 'unknown' },
    { ...valid, playId: { id: play } },
    { ...valid, durationMs: '250' },
    { ...valid, durationMs: 250.5 },
    { ...valid, durationMs: -5 },
    [valid]
  ];
  for (const body of badBodies) {
    const result = await json('POST', '/api/scores', body, cookie);
    assert.equal(result.status, 400, `거부되어야 함: ${JSON.stringify(body)}`);
  }

  const ok = await json('POST', '/api/scores', valid, cookie);
  assert.equal(ok.status, 201, '형식 오류로 거부된 뒤에도 정상 제출은 가능해야 함');
});

test('playId 없음·남의 세션·다른 게임 세션·최대 점수 초과를 거부하고 로그를 남긴다', async (t) => {
  const { json, rejectedLogCount } = await startServer(t);
  const alice = await registerUser(json, 'alice01');
  const bob = await registerUser(json, 'bobby01');
  const alicePlay = (await json('POST', '/api/plays', { game: 'alpha' }, alice.cookie)).body.playId;
  await sleep(MIN_DURATION_MS + 100);
  const submit = (body, cookie) => json('POST', '/api/scores', { points: 10, durationMs: MIN_DURATION_MS, ...body }, cookie);

  assert.equal((await submit({ game: 'alpha' }, alice.cookie)).status, 400);
  assert.equal((await submit({ game: 'alpha', playId: 'nope' }, alice.cookie)).status, 400);
  assert.equal((await submit({ game: 'alpha', playId: alicePlay }, bob.cookie)).status, 400);
  assert.equal((await submit({ game: 'alpha', playId: alicePlay })).status, 400);
  assert.equal((await submit({ game: 'beta', playId: alicePlay }, alice.cookie)).status, 400);
  assert.equal((await submit({ game: 'alpha', playId: alicePlay, points: 501 }, alice.cookie)).status, 400);
  assert.equal((await submit({ game: 'alpha', playId: alicePlay, durationMs: 99999 }, alice.cookie)).status, 400);
  assert.equal((await json('POST', '/api/scores', { game: 'alpha', points: '10' }, alice.cookie)).status, 400);

  await sleep(50);
  assert.ok(rejectedLogCount() >= 8, `거부 로그가 남아야 함 (현재 ${rejectedLogCount()}건)`);
  assert.equal((await submit({ game: 'alpha', playId: alicePlay }, alice.cookie)).status, 201, '거부는 정상 소유자의 세션을 소모하지 않아야 함');
});

test('같은 playId를 동시에 여러 번 제출해도 한 번만 반영된다', async (t) => {
  const { json } = await startServer(t);
  const { cookie, credits } = await registerUser(json, 'race001');
  const playId = (await json('POST', '/api/plays', { game: 'alpha' }, cookie)).body.playId;
  await sleep(MIN_DURATION_MS + 100);

  const body = { game: 'alpha', points: 300, playId, durationMs: MIN_DURATION_MS };
  const results = await Promise.all(Array.from({ length: 8 }, () => json('POST', '/api/scores', body, cookie)));
  const statuses = results.map((result) => result.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409]);

  const me = await json('GET', '/api/auth/me', undefined, cookie);
  assert.equal(me.body.user.credits, credits + 3, '보상은 한 번만 지급되어야 함');
});

test('점수 저장은 보상 지급과 최고 기록 갱신을 정확히 수행한다', async (t) => {
  const { json } = await startServer(t);
  const { cookie, credits } = await registerUser(json, 'reward01');
  const plays = [];
  for (let index = 0; index < 3; index += 1) plays.push((await json('POST', '/api/plays', { game: 'alpha' }, cookie)).body.playId);
  await sleep(MIN_DURATION_MS + 100);
  const submit = (playId, points) => json('POST', '/api/scores', { game: 'alpha', points, playId, durationMs: MIN_DURATION_MS }, cookie);

  const first = await submit(plays[0], 250);
  assert.equal(first.body.creditsEarned, 2);
  assert.equal(first.body.bestScore, 250);
  assert.equal(first.body.isNewBest, true);

  const lower = await submit(plays[1], 40);
  assert.equal(lower.body.creditsEarned, 1, '완료 시 최소 1 CR');
  assert.equal(lower.body.bestScore, 250, '낮은 점수가 최고 기록을 낮추면 안 됨');
  assert.equal(lower.body.isNewBest, false);

  const higher = await submit(plays[2], 480);
  assert.equal(higher.body.bestScore, 480);
  assert.equal(higher.body.credits, credits + 2 + 1 + 4);
});

test('게스트 점수는 저장되지 않고 세션은 한 번만 쓸 수 있다', async (t) => {
  const { json } = await startServer(t);
  const playId = (await json('POST', '/api/plays', { game: 'alpha' })).body.playId;
  await sleep(MIN_DURATION_MS + 100);
  const body = { game: 'alpha', points: 120, playId, durationMs: MIN_DURATION_MS };

  const first = await json('POST', '/api/scores', body);
  assert.equal(first.status, 200);
  assert.equal(first.body.saved, false);
  assert.equal((await json('POST', '/api/scores', body)).status, 409);

  const leaderboard = await json('GET', '/api/leaderboard/games/alpha');
  assert.deepEqual(leaderboard.body.players, []);
});
