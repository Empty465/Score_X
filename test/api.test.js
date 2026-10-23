const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const MIN_DURATION_MS = 100;
const GAME_IDS = ['alpha', 'beta', 'gamma', 'delta', 'omega'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startServer(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scorex-api-'));
  const gamesDir = path.join(dir, 'games');
  for (const id of GAME_IDS) {
    fs.mkdirSync(path.join(gamesDir, id), { recursive: true });
    fs.writeFileSync(path.join(gamesDir, id, 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(gamesDir, id, 'manifest.json'), JSON.stringify({
      id, protocol: 1, title: id, shortTitle: id, category: 'TEST', description: id, icon: '🎮', maxScore: 5000, minDurationMs: MIN_DURATION_MS
    }));
  }
  const port = 4200 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: path.join(dir, 'test.sqlite'), GAMES_DIR: gamesDir },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => new Promise((resolve) => {
    child.on('exit', () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 임시 파일 정리 실패는 무시 */ }
      resolve();
    });
    child.kill();
  }));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* 서버 시작 대기 */ }
    await sleep(100);
  }
  const json = async (method, url, body, cookie) => {
    const response = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  return json;
}

async function register(json, loginId, nickname = `닉${loginId}`) {
  const result = await json('POST', '/api/auth/register', { loginId, password: 'password123', passwordConfirm: 'password123', nickname });
  assert.equal(result.status, 201, `가입 실패: ${JSON.stringify(result.body)}`);
  return { cookie: result.headers.get('set-cookie').split(';')[0], user: result.body.user };
}

const credits = async (json, cookie) => (await json('GET', '/api/auth/me', undefined, cookie)).body.user.credits;

async function submitScore(json, cookie, game, points) {
  const play = await json('POST', '/api/plays', { game }, cookie);
  await sleep(MIN_DURATION_MS + 60);
  return json('POST', '/api/scores', { game, points, playId: play.body.playId, durationMs: MIN_DURATION_MS }, cookie);
}

test('회원가입은 입력을 검증하고 환영 재화를 지급하며 민감 정보를 노출하지 않는다', async (t) => {
  const json = await startServer(t);
  const post = (body) => json('POST', '/api/auth/register', body);
  const valid = { loginId: 'user_01', password: 'password123', passwordConfirm: 'password123', nickname: '파일럿' };

  assert.equal((await post({ ...valid, passwordConfirm: 'password124' })).status, 400);
  assert.equal((await post({ ...valid, passwordConfirm: undefined })).status, 400);
  assert.equal((await post({ ...valid, password: 'short', passwordConfirm: 'short' })).status, 400);
  assert.equal((await post({ ...valid, loginId: 'abc' })).status, 400);
  assert.equal((await post({ ...valid, loginId: 'has space' })).status, 400);
  assert.equal((await post({ ...valid, loginId: 'a'.repeat(21) })).status, 400);
  assert.equal((await post({ ...valid, password: 'short' })).status, 400);
  assert.equal((await post({ ...valid, password: 'x'.repeat(65), passwordConfirm: 'x'.repeat(65) })).status, 400);
  assert.equal((await post({ ...valid, nickname: 'a' })).status, 400);
  assert.equal((await post({ ...valid, nickname: 'a'.repeat(17) })).status, 400);
  assert.equal((await post({ ...valid, loginId: 12345678 })).status, 400);

  const created = await post(valid);
  assert.equal(created.status, 201);
  assert.equal(created.body.user.credits, 500);
  assert.equal(created.body.user.name, '파일럿');
  assert.equal(created.body.user.tier, '훈련생');
  const serialized = JSON.stringify(created.body);
  for (const secret of ['password', 'salt', 'hash', 'user_01']) assert.equal(serialized.includes(secret), false, `${secret} 노출 금지`);
  const setCookie = created.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);

  assert.equal((await post({ ...valid, nickname: '다른닉' })).status, 409, '중복 아이디');
  assert.equal((await post({ ...valid, loginId: 'user_02' })).status, 409, '중복 닉네임');
});

test('회원탈퇴는 로그인과 비밀번호가 필요하고 계정 데이터를 모두 삭제한다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'leave01', '탈퇴유저');
  const other = await register(json, 'stay01', '남는유저');
  await submitScore(json, cookie, 'reaction', 100);

  assert.equal((await json('POST', '/api/auth/delete', { password: 'password123' })).status, 401, '비로그인');
  assert.equal((await json('POST', '/api/auth/delete', { password: 'wrongpass1' }, cookie)).status, 403);
  assert.equal((await json('POST', '/api/auth/delete', {}, cookie)).status, 403);
  assert.equal((await json('GET', '/api/auth/me', undefined, cookie)).body.user.name, '탈퇴유저', '실패 시 계정 유지');

  const deleted = await json('POST', '/api/auth/delete', { password: 'password123' }, cookie);
  assert.equal(deleted.status, 200);
  assert.match(deleted.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await json('GET', '/api/auth/me', undefined, cookie)).body.user, null);
  assert.equal((await json('POST', '/api/auth/login', { loginId: 'leave01', password: 'password123' })).status, 401);
  assert.equal((await json('GET', '/api/auth/me', undefined, other.cookie)).body.user.name, '남는유저');

  const again = await register(json, 'leave01', '탈퇴유저');
  assert.equal(again.user.credits, 500, '같은 아이디·닉네임으로 재가입 가능');
});

test('로그인 실패가 5회 쌓이면 429로 제한하고 올바른 비밀번호도 잠시 거부한다', async (t) => {
  const json = await startServer(t);
  await register(json, 'brute01', '무차별유저');

  for (let i = 0; i < 5; i += 1) {
    assert.equal((await json('POST', '/api/auth/login', { loginId: 'brute01', password: 'wrongpass1' })).status, 401);
  }
  const locked = await json('POST', '/api/auth/login', { loginId: 'brute01', password: 'password123' });
  assert.equal(locked.status, 429);
  assert.equal(locked.headers.get('retry-after'), '60');
});

test('같은 아이디로 동시에 가입해도 한 계정만 만들어진다', async (t) => {
  const json = await startServer(t);
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) => (
    json('POST', '/api/auth/register', { loginId: 'dupe_01', password: 'password123', passwordConfirm: 'password123', nickname: `동시${index}` })
  )));
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409, 409, 409, 409, 409]);
});

test('로그인·세션·로그아웃이 올바르게 동작한다', async (t) => {
  const json = await startServer(t);
  await register(json, 'login01', '로그인유저');

  assert.equal((await json('POST', '/api/auth/login', { loginId: 'login01', password: 'wrongpass1' })).status, 401);
  assert.equal((await json('POST', '/api/auth/login', { loginId: 'nobody01', password: 'password123' })).status, 401);
  assert.equal((await json('POST', '/api/auth/login', { loginId: 'login01', password: 'x'.repeat(100) })).status, 401);
  assert.equal((await json('POST', '/api/auth/login', {})).status, 401);

  const login = await json('POST', '/api/auth/login', { loginId: 'login01', password: 'password123' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await json('GET', '/api/auth/me', undefined, cookie)).body.user.name, '로그인유저');
  assert.equal((await json('GET', '/api/auth/me')).body.user, null, '게스트는 user가 null');
  assert.equal((await json('GET', '/api/auth/me', undefined, 'sx_session=forged')).body.user, null);

  assert.equal((await json('POST', '/api/auth/logout', {}, cookie)).status, 200);
  assert.equal((await json('GET', '/api/auth/me', undefined, cookie)).body.user, null, '로그아웃한 세션은 무효');
});

test('로그인이 필요한 API는 게스트 요청을 401로 거부한다', async (t) => {
  const json = await startServer(t);
  for (const [method, url, body] of [
    ['GET', '/api/investment/active'],
    ['POST', '/api/investment/start', { stake: 10, risk: 'safe' }],
    ['POST', '/api/investment/cancel', {}],
    ['POST', '/api/shop/purchase', { itemId: 'avatar-moon' }],
    ['POST', '/api/profile/equip', { itemId: 'avatar-moon' }],
    ['POST', '/api/profile/avatar', { avatarId: 'moon' }],
    ['POST', '/api/attendance/claim', {}]
  ]) {
    assert.equal((await json(method, url, body)).status, 401, `${method} ${url}`);
  }
});

test('출석 보상은 동시에 여러 번 요청해도 하루 한 번만 지급된다', async (t) => {
  const json = await startServer(t);
  const { cookie, user } = await register(json, 'attend01');

  const results = await Promise.all(Array.from({ length: 8 }, () => json('POST', '/api/attendance/claim', {}, cookie)));
  const successes = results.filter((result) => result.status === 200);
  assert.equal(successes.length, 1);
  assert.equal(results.filter((result) => result.status === 409).length, 7);
  const { reward } = successes[0].body;
  assert.ok(reward >= 100 && reward <= 500);
  assert.equal(await credits(json, cookie), user.credits + reward, '보상은 한 번만 반영');
  assert.equal((await json('GET', '/api/attendance/status', undefined, cookie)).body.eligible, false);

  const other = await register(json, 'attend02');
  assert.equal((await json('POST', '/api/attendance/claim', {}, other.cookie)).status, 200, '다른 계정은 별도로 수령 가능');
});

test('상점 구매는 재화를 차감하고 중복 구매·재화 부족·동시 구매를 막는다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'shop001');
  const buy = (itemId, extra = {}) => json('POST', '/api/shop/purchase', { itemId, ...extra }, cookie);

  assert.equal((await buy('no-such-item')).status, 400);
  const moon = await buy('avatar-moon');
  assert.equal(moon.status, 200);
  assert.equal(moon.body.profile.credits, 380);
  assert.ok(moon.body.profile.ownedCosmetics.includes('avatar-moon'));
  assert.equal((await buy('avatar-moon')).status, 409, '이미 보유한 아이템');
  assert.equal(await credits(json, cookie), 380);

  const results = await Promise.all(Array.from({ length: 5 }, () => buy('title-orbit')));
  assert.equal(results.filter((result) => result.status === 200).length, 1, '같은 상품 동시 구매는 한 번만');
  assert.equal(await credits(json, cookie), 380 - 180);

  assert.equal((await buy('background-solar')).status, 400, '재화 부족(200 < 380)');
  assert.equal(await credits(json, cookie), 200, '실패한 구매는 재화를 바꾸지 않음');
});

test('잔액을 넘는 상품을 동시에 구매해도 잔액이 음수가 되지 않는다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'shop002');
  const results = await Promise.all([
    json('POST', '/api/shop/purchase', { itemId: 'avatar-ufo' }, cookie),
    json('POST', '/api/shop/purchase', { itemId: 'background-solar' }, cookie),
    json('POST', '/api/shop/purchase', { itemId: 'background-nebula' }, cookie)
  ]);
  const balance = await credits(json, cookie);
  assert.ok(balance >= 0, `잔액이 음수: ${balance}`);
  const spent = 500 - balance;
  const paid = results.map((result, index) => (result.status === 200 ? [360, 380, 300][index] : 0)).reduce((sum, value) => sum + value, 0);
  assert.equal(spent, paid, '차감액은 성공한 구매의 합과 같아야 함');
  assert.ok(results.filter((result) => result.status === 200).length <= 1);
});

test('닉네임 변경권은 중복·현재 닉네임·형식을 검증한다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'nick001', '원래닉');
  await register(json, 'nick002', '남의닉');
  const rename = (displayName) => json('POST', '/api/shop/purchase', { itemId: 'display-name', displayName }, cookie);

  assert.equal((await rename('')).status, 400);
  assert.equal((await rename('a')).status, 400);
  assert.equal((await rename('원래닉')).status, 400, '현재 닉네임');
  assert.equal((await rename('남의닉')).status, 409, '다른 사람이 쓰는 닉네임');
  assert.equal(await credits(json, cookie), 500, '실패한 변경은 재화를 쓰지 않음');

  const done = await rename('새닉네임');
  assert.equal(done.status, 200);
  assert.equal(done.body.profile.name, '새닉네임');
  assert.equal(done.body.profile.credits, 250);
});

test('프로필 장착은 보유한 아이템만 허용한다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'equip01');
  await json('POST', '/api/attendance/claim', {}, cookie);
  const equip = (itemId) => json('POST', '/api/profile/equip', { itemId }, cookie);
  const avatar = (avatarId) => json('POST', '/api/profile/avatar', { avatarId }, cookie);

  assert.equal((await equip('avatar-moon')).status, 403);
  assert.equal((await equip('display-name')).status, 403);
  assert.equal((await avatar('moon')).status, 403);
  assert.equal((await avatar('nope')).status, 403);
  assert.equal((await avatar('pilot')).status, 200, '기본 아바타는 항상 가능');

  await json('POST', '/api/shop/purchase', { itemId: 'avatar-moon' }, cookie);
  await json('POST', '/api/shop/purchase', { itemId: 'title-orbit' }, cookie);
  await json('POST', '/api/shop/purchase', { itemId: 'background-aurora' }, cookie);
  assert.equal((await equip('avatar-moon')).body.profile.avatarId, 'moon');
  assert.equal((await equip('title-orbit')).body.profile.titleId, 'title-orbit');
  const background = await equip('background-aurora');
  assert.equal(background.body.profile.backgroundId, 'background-aurora');
  assert.equal((await avatar('pilot')).body.profile.avatarId, 'pilot');
});

test('투자 시작은 입력을 검증하고 재화를 차감하며 동시에 두 번 시작할 수 없다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'invest01');
  const start = (body) => json('POST', '/api/investment/start', body, cookie);

  assert.equal((await start({ stake: 0, risk: 'safe' })).status, 400);
  assert.equal((await start({ stake: -5, risk: 'safe' })).status, 400);
  assert.equal((await start({ stake: 1.5, risk: 'safe' })).status, 400);
  assert.equal((await start({ stake: 'abc', risk: 'safe' })).status, 400);
  assert.equal((await start({ stake: 10, risk: 'nope' })).status, 400);
  assert.equal((await start({ stake: 501, risk: 'safe' })).status, 400, '보유 재화 초과');
  assert.equal(await credits(json, cookie), 500);

  const results = await Promise.all(Array.from({ length: 5 }, () => start({ stake: 100, risk: 'balanced' })));
  assert.equal(results.filter((result) => result.status === 201).length, 1);
  assert.equal(results.filter((result) => result.status === 409).length, 4);
  const run = results.find((result) => result.status === 201).body.run;
  assert.equal(run.status, 'active');
  assert.ok(run.games.length >= 3 && run.games.length <= 5);
  assert.equal(await credits(json, cookie), 400, '투자금은 한 번만 차감');
  assert.equal((await json('GET', '/api/investment/active', undefined, cookie)).body.run.id, run.id);
});

test('투자 취소는 투자금의 절반(소수 내림)을 환급하며 동시에 여러 번 취소해도 한 번만 처리된다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'cancel01');
  assert.equal((await json('POST', '/api/investment/cancel', {}, cookie)).status, 409, '진행 중인 투자가 없음');

  assert.equal((await json('POST', '/api/investment/start', { stake: 51, risk: 'safe' }, cookie)).status, 201);
  assert.equal(await credits(json, cookie), 449);
  const results = await Promise.all(Array.from({ length: 5 }, () => json('POST', '/api/investment/cancel', {}, cookie)));
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  const cancelled = results.find((result) => result.status === 200).body;
  assert.equal(cancelled.refund, 25);
  assert.equal(cancelled.run.status, 'cancelled');
  assert.equal(await credits(json, cookie), 449 + 25, '환급은 한 번만');
  assert.equal((await json('GET', '/api/investment/active', undefined, cookie)).body.run, null);
  assert.equal((await json('POST', '/api/investment/start', { stake: 10, risk: 'high' }, cookie)).status, 201, '취소 후 새 투자 가능');
});

test('투자 임무는 지정된 순서의 게임을 끝내야 진행되고 마지막에 정산된다', async (t) => {
  const json = await startServer(t);
  const { cookie } = await register(json, 'flow001');
  const stake = 100;
  const started = await json('POST', '/api/investment/start', { stake, risk: 'safe' }, cookie);
  assert.equal(started.status, 201);
  const { games } = started.body.run;
  let expectedCredits = 500 - stake;

  // 순서가 아닌 게임을 해도 진행도는 올라가지 않는다.
  const outOfOrder = await submitScore(json, cookie, games[1], 100);
  assert.equal(outOfOrder.status, 201);
  expectedCredits += outOfOrder.body.creditsEarned;
  assert.equal(outOfOrder.body.investment.progress, 0);
  assert.equal(outOfOrder.body.reroll, null);

  let last;
  for (const [index, game] of games.entries()) {
    last = await submitScore(json, cookie, game, 100);
    assert.equal(last.status, 201);
    expectedCredits += last.body.creditsEarned;
    assert.equal(last.body.investment.progress, index + 1);
    assert.equal(last.body.investment.status, index + 1 === games.length ? 'completed' : 'active');
  }
  const { reward, outcome, multiplier } = last.body.investment;
  assert.ok(['full_loss', 'partial_loss', 'break_even', 'small_gain', 'big_gain'].includes(outcome));
  assert.equal(reward, Math.floor(stake * multiplier));
  expectedCredits += reward;
  assert.equal(await credits(json, cookie), expectedCredits, '재화 = 시작 - 투자금 + 점수 보상 + 정산금');
  assert.equal((await json('GET', '/api/investment/active', undefined, cookie)).body.run, null);

  const afterwards = await submitScore(json, cookie, games[0], 100);
  assert.equal(afterwards.body.investment, null, '완료된 투자는 더 이상 진행되지 않음');
  assert.ok(afterwards.body.reroll, '미투자 상태에서는 다음 투자 옵션 추천');
  const ledgerTotal = expectedCredits + afterwards.body.creditsEarned;
  assert.equal(await credits(json, cookie), ledgerTotal);
});

test('랭킹은 게임별 최고 기록 합산·티어·보유 재화 기준으로 계산된다', async (t) => {
  const json = await startServer(t);
  const alice = await register(json, 'rank001', '앨리스');
  const bob = await register(json, 'rank002', '밥먹자');
  assert.equal((await submitScore(json, alice.cookie, 'alpha', 600)).status, 201);
  assert.equal((await submitScore(json, alice.cookie, 'alpha', 300)).status, 201, '낮은 점수는 최고 기록을 바꾸지 않음');
  assert.equal((await submitScore(json, alice.cookie, 'beta', 500)).status, 201);
  assert.equal((await submitScore(json, bob.cookie, 'alpha', 400)).status, 201);

  const board = await json('GET', '/api/leaderboard', undefined, alice.cookie);
  assert.equal(board.status, 200);
  assert.deepEqual(board.body.players.map((player) => [player.rank, player.name, player.total]), [[1, '앨리스', 1100], [2, '밥먹자', 400]]);
  assert.equal(board.body.players[0].tier, '항해사');
  assert.equal(board.body.players[1].tier, '훈련생');
  assert.equal(board.body.currentUser.name, '앨리스');

  const aliceCredits = 500 + 6 + 3 + 5;
  const bobCredits = 500 + 4;
  assert.deepEqual(board.body.creditPlayers.map((player) => [player.rank, player.name, player.credits]), [[1, '앨리스', aliceCredits], [2, '밥먹자', bobCredits]]);
  assert.equal(board.body.creditPlayers[0].total, 1100, '재화는 최고 기록 합산에 포함되지 않음');
  assert.equal((await json('GET', '/api/leaderboard')).body.currentUser, null);
});
