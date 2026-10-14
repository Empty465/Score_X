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
  document.querySelector('#baseball-message').textContent = '좌표 보안 코드 3자리를 입력하세요.';
  document.querySelector('#guess-log').innerHTML = '<li class="guess-empty">보안 터미널 대기 중...</li>';
  document.querySelector('#baseball-input').focus();
}

async function submitBaseballGuess(event) {
  event.preventDefault();
  if (baseballFinished) return;
  const guess = baseballInput.value.trim();
  const message = document.querySelector('#baseball-message');
  if (!/^[1-9]{3}$/.test(guess) || new Set(guess).size !== 3) {
    message.textContent = '1부터 9까지 서로 다른 숫자 세 개로 코드를 입력하세요.';
    baseballInput.focus();
    return;
  }

  baseballAttempts += 1;
  let strikes = 0;
  let balls = 0;
  [...guess].forEach((digit, index) => {
    if (digit === baseballAnswer[index]) strikes += 1;
    else if (baseballAnswer.includes(digit)) balls += 1;
  });
  const log = document.querySelector('#guess-log');
  if (baseballAttempts === 1) log.innerHTML = '';
  const row = document.createElement('li');
  row.innerHTML = `<span class="guess-number">${String(baseballAttempts).padStart(2, '0')}</span><strong>${guess}</strong><span class="guess-result">${strikes ? `${strikes} 스트라이크` : ''}${strikes && balls ? ' · ' : ''}${balls ? `${balls} 볼` : ''}${!strikes && !balls ? '아웃' : ''}</span>`;
  log.prepend(row);
  baseballInput.value = '';
  document.querySelector('#baseball-attempts').textContent = String(baseballAttempts);
  document.querySelector('#baseball-remaining').textContent = String(9 - baseballAttempts).padStart(2, '0');

  if (strikes === 3) {
    baseballFinished = true;
    document.querySelector('#baseball-status').textContent = 'WIN';
    const earned = await awardScore('baseball', (10 - baseballAttempts) * 100);
    const receipt = earned === null ? '이름 등록 후 점수를 저장할 수 있어요.' : `+${earned}P 적립`;
    message.textContent = `${baseballAttempts}회 만에 좌표 코드를 해독했습니다. ${receipt}`;
    if (baseballAttempts < Number(getBest('baseball') || Infinity)) saveBest('baseball', baseballAttempts);
  } else if (baseballAttempts === 9) {
    baseballFinished = true;
    document.querySelector('#baseball-status').textContent = 'GAME OVER';
    message.textContent = `해독 시도가 끝났습니다. 접근 코드는 ${baseballAnswer}입니다.`;
  } else {
    message.textContent = strikes || balls ? `터미널 응답 · ${strikes} 스트라이크, ${balls} 볼` : '접근 거부 · 일치하는 좌표가 없습니다.';
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
