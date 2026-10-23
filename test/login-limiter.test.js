const test = require('node:test');
const assert = require('node:assert/strict');
const { createLoginLimiter } = require('../lib/login-limiter.js');

test('5회 실패 시 1분, 다시 5회 실패 시 10분 동안 제한한다', () => {
  let time = 1_000_000;
  const limiter = createLoginLimiter({ now: () => time });
  const keys = ['ip:1.1.1.1', 'login:abc'];

  for (let i = 0; i < 4; i += 1) limiter.recordFailure(keys);
  assert.equal(limiter.retryAfterMs(keys), 0);
  limiter.recordFailure(keys);
  assert.equal(limiter.retryAfterMs(keys), 60_000);

  time += 59_000;
  assert.equal(limiter.retryAfterMs(keys), 1_000);
  time += 1_000;
  assert.equal(limiter.retryAfterMs(keys), 0);

  for (let i = 0; i < 4; i += 1) limiter.recordFailure(keys);
  assert.equal(limiter.retryAfterMs(keys), 0);
  limiter.recordFailure(keys);
  assert.equal(limiter.retryAfterMs(keys), 600_000);
});

test('성공하면 해당 키의 실패 기록이 지워지고 다른 키에는 영향이 없다', () => {
  const limiter = createLoginLimiter({ now: () => 0 });
  for (let i = 0; i < 4; i += 1) limiter.recordFailure(['login:abc']);
  limiter.recordSuccess(['login:abc']);
  limiter.recordFailure(['login:abc']);
  assert.equal(limiter.retryAfterMs(['login:abc']), 0);

  for (let i = 0; i < 5; i += 1) limiter.recordFailure(['login:other']);
  assert.ok(limiter.retryAfterMs(['login:other']) > 0);
  assert.equal(limiter.retryAfterMs(['login:abc']), 0);
});
