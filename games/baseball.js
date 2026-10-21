const { getBest, saveBest, awardScore } = window.Playground;

let baseballAnswer = '';
let baseballAttempts = 0;
let baseballFinished = false;
const baseballInput = document.querySelector('#baseball-input');

function resetBaseball() {
  baseballAnswer = [...'123456789'].sort(() => Math.random() - .5).slice(0, 3).join('');
  baseballAttempts = 0;
  baseballFinished = false;
  baseballInput.value = '';
  baseballInput.disabled = false;
  document.querySelector('#baseball-form button').disabled = false;
  document.querySelector('#baseball-status').textContent = 'PLAYING';
  document.querySelector('#baseball-attempts').textContent = '0';
  document.querySelector('#baseball-remaining').textContent = '09';
  document.querySelector('#baseball-message').textContent = '1~9 중 서로 다른 숫자 3개로 보안 코드를 입력하세요.';
  document.querySelector('#guess-log').replaceChildren(Object.assign(document.createElement('li'), {
    className: 'guess-empty',
    textContent: '터미널 응답 대기 중 · 첫 코드를 입력하세요.'
  }));
  document.querySelector('#baseball-input').focus();
}

async function submitBaseballGuess(event) {
  event.preventDefault();
  if (baseballFinished) return;
  const guess = baseballInput.value.trim();
  const message = document.querySelector('#baseball-message');
  if (!/^[1-9]{3}$/.test(guess) || new Set(guess).size !== 3) {
    message.textContent = '1~9 중 서로 다른 숫자 3개를 입력해야 합니다.';
    baseballInput.focus();
    return;
  }

  baseballAttempts += 1;
  let positionMatches = 0;
  let coordinateSignals = 0;
  [...guess].forEach((digit, index) => {
    if (digit === baseballAnswer[index]) positionMatches += 1;
    else if (baseballAnswer.includes(digit)) coordinateSignals += 1;
  });
  const log = document.querySelector('#guess-log');
  if (baseballAttempts === 1) log.replaceChildren();
  const row = document.createElement('li');
  const attempt = document.createElement('span');
  attempt.className = 'guess-number';
  attempt.textContent = String(baseballAttempts).padStart(2, '0');
  const code = document.createElement('strong');
  code.textContent = guess;
  const result = document.createElement('span');
  result.className = 'guess-result';
  result.textContent = [
    positionMatches ? `좌표 일치 ${positionMatches}` : '',
    coordinateSignals ? `신호 검출 ${coordinateSignals}` : ''
  ].filter(Boolean).join(' · ') || '미검출 · 일치 좌표 없음';
  row.append(attempt, code, result);
  log.prepend(row);
  baseballInput.value = '';
  document.querySelector('#baseball-attempts').textContent = String(baseballAttempts);
  document.querySelector('#baseball-remaining').textContent = String(9 - baseballAttempts).padStart(2, '0');

  if (positionMatches === 3) {
    baseballFinished = true;
    document.querySelector('#baseball-status').textContent = 'WIN';
    const earned = await awardScore('baseball', (10 - baseballAttempts) * 100);
    const receipt = earned === null ? '점수 서버에 연결하지 못했어요.' : `${earned} PTS 기록`;
    message.textContent = `${baseballAttempts}회 만에 좌표 코드를 해독했습니다. ${receipt}`;
    if (baseballAttempts < Number(getBest('baseball') || Infinity)) saveBest('baseball', baseballAttempts);
  } else if (baseballAttempts === 9) {
    baseballFinished = true;
    document.querySelector('#baseball-status').textContent = 'GAME OVER';
    await awardScore('baseball', 0);
    message.textContent = `해독 실패 · 보안 코드 ${baseballAnswer}를 확보하지 못했습니다.`;
  } else {
    message.textContent = positionMatches || coordinateSignals
      ? `터미널 응답 · 좌표 일치 ${positionMatches} · 신호 검출 ${coordinateSignals}`
      : '터미널 응답 · 코드와 일치하는 좌표 신호가 없습니다.';
  }
  if (baseballFinished) {
    baseballInput.disabled = true;
    document.querySelector('#baseball-form button').disabled = true;
  } else {
    baseballInput.focus();
  }
}

document.querySelector('#baseball-form').addEventListener('submit', submitBaseballGuess);
document.querySelector('#baseball-reset').addEventListener('click', resetBaseball);
resetBaseball();
window.Playground.registerGame('baseball', { onLaunch: () => { resetBaseball(); setTimeout(() => baseballInput.focus(), 0); } });
