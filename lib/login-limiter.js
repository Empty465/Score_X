const MAX_FAILURES = 5;
const LOCK_STEPS_MS = [60 * 1000, 10 * 60 * 1000];
const IDLE_RESET_MS = 60 * 60 * 1000;

// 비밀번호 검증 실패를 키(IP, 아이디)별로 세어 5회마다 잠근다. 첫 잠금 1분, 이후 10분.
function createLoginLimiter({ now = Date.now } = {}) {
  const entries = new Map();

  function prune(current) {
    for (const [key, entry] of entries) {
      if (entry.lockedUntil <= current && current - entry.lastFailureAt > IDLE_RESET_MS) entries.delete(key);
    }
  }

  function retryAfterMs(keys) {
    const current = now();
    let wait = 0;
    for (const key of keys) {
      const entry = entries.get(key);
      if (entry && entry.lockedUntil > current) wait = Math.max(wait, entry.lockedUntil - current);
    }
    return wait;
  }

  function recordFailure(keys) {
    const current = now();
    prune(current);
    for (const key of keys) {
      const entry = entries.get(key) ?? { failures: 0, locks: 0, lockedUntil: 0, lastFailureAt: 0 };
      entry.failures += 1;
      entry.lastFailureAt = current;
      if (entry.failures >= MAX_FAILURES) {
        entry.failures = 0;
        entry.lockedUntil = current + LOCK_STEPS_MS[Math.min(entry.locks, LOCK_STEPS_MS.length - 1)];
        entry.locks += 1;
      }
      entries.set(key, entry);
    }
  }

  function recordSuccess(keys) {
    for (const key of keys) entries.delete(key);
  }

  return { retryAfterMs, recordFailure, recordSuccess };
}

module.exports = { createLoginLimiter, MAX_FAILURES, LOCK_STEPS_MS };
