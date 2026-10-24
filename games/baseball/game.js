const MAX_ATTEMPTS = 9;
const input = document.querySelector('#input');
const send = document.querySelector('#send');
const message = document.querySelector('#message');
const log = document.querySelector('#log');
let rng = Math.random;
let answer = '';
let attempts = 0;
let running = false;
let paused = false;
let activeMs = 0;
let resumedAt = 0;

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function elapsedMs() { return activeMs + (running && !paused ? Date.now() - resumedAt : 0); }

function setEnabled(on) { input.disabled = !on; send.disabled = !on; if (on) input.focus(); }

function newCode() {
  const digits = [...'123456789'];
  for (let i = digits.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  answer = digits.slice(0, 3).join('');
}

function finish(won) {
  activeMs = elapsedMs();
  running = false;
  setEnabled(false);
  Scorex.hud({ lives: MAX_ATTEMPTS - attempts, status: won ? 'WIN' : 'GAME OVER' });
  Scorex.gameOver({
    score: won ? (10 - attempts) * 100 : 0,
    durationMs: Math.max(1, Math.round(activeMs)),
    result: won ? 'clear' : 'fail',
    meta: { attempts }
  });
}

function submitGuess() {
  if (!running || paused) return;
  const guess = input.value.trim();
  if (!/^[1-9]{3}$/.test(guess) || new Set(guess).size !== 3) {
    message.textContent = '1~9 중 서로 다른 숫자 3개를 입력해야 합니다.';
    input.focus();
    return;
  }
  attempts += 1;
  let position = 0;
  let signal = 0;
  [...guess].forEach((digit, index) => {
    if (digit === answer[index]) position += 1;
    else if (answer.includes(digit)) signal += 1;
  });
  if (attempts === 1) log.replaceChildren();
  const row = document.createElement('li');
  const number = Object.assign(document.createElement('span'), { className: 'num', textContent: String(attempts).padStart(2, '0') });
  const code = document.createElement('strong');
  code.textContent = guess;
  const result = Object.assign(document.createElement('span'), {
    className: 'result',
    textContent: [position ? `좌표 일치 ${position}` : '', signal ? `신호 검출 ${signal}` : ''].filter(Boolean).join(' · ') || '미검출 · 일치 좌표 없음'
  });
  row.append(number, code, result);
  log.prepend(row);
  input.value = '';
  document.querySelector('#attempts').textContent = String(attempts);
  Scorex.hud({ lives: MAX_ATTEMPTS - attempts, status: 'PLAYING' });
  if (position === 3) {
    message.textContent = `${attempts}회 만에 좌표 코드를 해독했습니다.`;
    finish(true);
  } else if (attempts === MAX_ATTEMPTS) {
    message.textContent = `해독 실패 · 보안 코드 ${answer}를 확보하지 못했습니다.`;
    finish(false);
  } else {
    message.textContent = position || signal ? `터미널 응답 · 좌표 일치 ${position} · 신호 검출 ${signal}` : '터미널 응답 · 코드와 일치하는 좌표 신호가 없습니다.';
    input.focus();
  }
}

send.addEventListener('click', submitGuess);
input.addEventListener('keydown', (event) => { if (event.key === 'Enter') submitGuess(); });

Scorex.onInit((init) => {
  rng = seeded(init.seed);
  newCode();
  attempts = 0; activeMs = 0; running = false; paused = false;
  input.value = '';
  document.querySelector('#attempts').textContent = '0';
  log.replaceChildren(Object.assign(document.createElement('li'), { className: 'empty', textContent: '터미널 응답 대기 중 · 첫 코드를 입력하세요.' }));
  message.textContent = '1~9 중 서로 다른 숫자 3개로 보안 코드를 입력하세요.';
});
Scorex.onStart(() => {
  running = true; paused = false; resumedAt = Date.now();
  setEnabled(true);
  Scorex.started();
  Scorex.hud({ lives: MAX_ATTEMPTS, status: 'PLAYING' });
});
Scorex.onPause(() => { if (!running) return; activeMs += Date.now() - resumedAt; paused = true; setEnabled(false); });
Scorex.onResume(() => { if (!running) return; paused = false; resumedAt = Date.now(); setEnabled(true); });
Scorex.onDestroy(() => { running = false; });
Scorex.connect({ gameId: 'baseball', gameVersion: '1.0.0' });
