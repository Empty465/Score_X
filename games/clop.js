const { getBest, saveBest, awardScore } = window.Playground;

const clopCanvas = document.querySelector('#clop-canvas');
const clopContext = clopCanvas.getContext('2d');
const clopGoal = 120;
const clopPxPerMeter = 46;
const clopBodyX = 260;
const clopBodyY = 236;
const clopGroundY = 330;
const clopLegLength = 66;
const clopFlipLimit = 0.9;
const clopTimeLimit = 100;
// 언덕: 시작 위치, 길이, 높이(음수는 골짜기). 코사인 곡선으로 부드럽게 이어진다.
const clopHills = [
  { start: 14, length: 22, height: 1.5 },
  { start: 44, length: 18, height: -1.3 },
  { start: 68, length: 24, height: 2.6 },
  { start: 96, length: 14, height: 1.8 },
  { start: 110, length: 10, height: -1.0 }
];

function clopHeight(meter) {
  let total = 0;
  clopHills.forEach(({ start, length, height }) => {
    if (meter > start && meter < start + length) total += height * (1 - Math.cos(2 * Math.PI * (meter - start) / length)) / 2;
  });
  return total;
}

function clopSlope(meter) {
  let total = 0;
  clopHills.forEach(({ start, length, height }) => {
    if (meter > start && meter < start + length) total += height * Math.PI / length * Math.sin(2 * Math.PI * (meter - start) / length);
  });
  return total;
}
// 다리 순서: 앞왼(Q), 앞오(W), 뒤왼(O), 뒤오(P)
const clopLegKeys = ['q', 'w', 'o', 'p'];
const clopHeld = { q: false, w: false, o: false, p: false };
const clopStars = Array.from({ length: 60 }, () => ({ x: Math.random() * 720, y: Math.random() * 230, size: .5 + Math.random() * 1.4, alpha: .25 + Math.random() * .6 }));
let clopState = null;
let clopRunning = false;
let clopFrame = null;
let clopHudFrame = 0;

function createClopState() {
  return { legs: [0.3, -0.3, -0.3, 0.3], theta: 0, omega: 0, distance: 0, flipped: 0 };
}

// 누른 다리는 땅을 뒤로 밀며 전진하고, 뗀 다리는 스스로 앞으로 내딛는다.
// 앞·뒤 지지 다리 수가 다르면 몸이 기울고, 한계를 넘으면 뒤집힌다.
function stepClop(state) {
  if (state.flipped) {
    state.theta += state.flipped * 0.07;
    return;
  }
  const held = clopLegKeys.map((key) => clopHeld[key]);
  const heldCount = held.filter(Boolean).length;
  const thrustScale = heldCount >= 3 ? 0.35 : 1;
  const sweeps = [0, 0, 0, 0];
  held.forEach((isHeld, index) => {
    const before = state.legs[index];
    state.legs[index] = isHeld ? Math.max(-0.8, before - 0.05) : Math.min(0.8, before + 0.07);
    if (isHeld) sweeps[index] = before - state.legs[index];
  });
  state.distance += (sweeps[0] + sweeps[1] + sweeps[2] + sweeps[3]) * thrustScale * 0.5 * Math.max(0.3, Math.min(1.35, 1 - clopSlope(state.distance) * 1.2));

  const frontHeld = Number(held[0]) + Number(held[1]);
  const rearHeld = Number(held[2]) + Number(held[3]);
  const imbalance = (rearHeld - frontHeld) / 2;
  if (heldCount === 0) {
    state.omega += (-1.5 * state.theta) / 60;
    state.omega *= 0.9;
  } else {
    const thrustTorque = (sweeps[2] + sweeps[3] - sweeps[0] - sweeps[1]) * 0.06 * 60;
    const restore = imbalance === 0 ? -1 * state.theta : 0;
    state.omega += (imbalance * 6 + thrustTorque + restore - clopSlope(state.distance) * 1.6) / 60;
    state.omega *= 0.985;
  }
  state.theta += state.omega / 60;
  if (Math.abs(state.theta) > clopFlipLimit) state.flipped = Math.sign(state.theta);
}

function drawClopScene() {
  const context = clopContext;
  const state = clopState;
  context.clearRect(0, 0, 720, 420);
  const sky = context.createLinearGradient(0, 0, 0, clopGroundY);
  sky.addColorStop(0, '#091626');
  sky.addColorStop(1, '#174a65');
  context.fillStyle = sky;
  context.fillRect(0, 0, 720, clopGroundY);
  clopStars.forEach((star) => {
    context.fillStyle = `rgba(220,240,255,${star.alpha})`;
    context.fillRect(star.x, star.y, star.size, star.size);
  });
  const offset = state.distance * clopPxPerMeter;
  const groundAt = (meter) => clopGroundY - clopHeight(meter) * clopPxPerMeter;
  context.fillStyle = '#1c3a52';
  context.beginPath();
  context.moveTo(0, 420);
  for (let x = 0; x <= 720; x += 6) context.lineTo(x, groundAt(state.distance + (x - clopBodyX) / clopPxPerMeter));
  context.lineTo(720, 420);
  context.closePath();
  context.fill();
  context.strokeStyle = '#65e6d1';
  context.lineWidth = 2;
  context.beginPath();
  for (let x = 0; x <= 720; x += 6) {
    const y = groundAt(state.distance + (x - clopBodyX) / clopPxPerMeter);
    if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();
  context.font = '10px "DM Mono", monospace';
  context.textAlign = 'center';
  for (let meter = 0; meter <= clopGoal; meter += 10) {
    const x = clopBodyX + (meter - state.distance) * clopPxPerMeter;
    if (x < -20 || x > 740) continue;
    const y = groundAt(meter);
    context.fillStyle = '#4a6c88';
    context.fillRect(x, y, 1, 10);
    context.fillText(`${meter}m`, x, y + 24);
  }
  const goalX = clopBodyX + (clopGoal - state.distance) * clopPxPerMeter;
  if (goalX < 760) {
    const goalY = groundAt(clopGoal);
    context.fillStyle = '#65e6d1';
    context.fillRect(goalX, goalY - 90, 3, 90);
    context.fillStyle = '#ff718b';
    context.beginPath();
    context.moveTo(goalX + 3, goalY - 90);
    context.lineTo(goalX + 38, goalY - 76);
    context.lineTo(goalX + 3, goalY - 62);
    context.fill();
  }

  const groundHere = groundAt(state.distance);
  const rotation = state.theta - Math.atan(clopSlope(state.distance));
  const attach = [{ x: 42, far: false }, { x: 42, far: true }, { x: -42, far: false }, { x: -42, far: true }];
  const anyHeld = clopLegKeys.some((key) => clopHeld[key]);
  const legShapes = attach.map((leg, index) => {
    const isHeld = clopHeld[clopLegKeys[index]];
    const angle = state.legs[index];
    const lift = isHeld || !anyHeld ? 0 : 14;
    const hip = { x: leg.x + (leg.far ? 6 : 0), y: 14 };
    const knee = { x: hip.x + Math.sin(angle) * clopLegLength * 0.55 + 6, y: hip.y + Math.cos(angle) * clopLegLength * 0.55 - lift * 0.4 };
    const foot = { x: hip.x + Math.sin(angle) * clopLegLength, y: hip.y + Math.cos(angle) * clopLegLength - lift };
    return { index, far: leg.far, isHeld, hip, knee, foot, grounded: lift === 0 };
  });
  // 지면에 닿은 다리 중 가장 낮은 발이 땅에 닿도록 몸통 높이를 정한다
  const lowestFoot = Math.max(...legShapes.filter((leg) => leg.grounded).map((leg) => leg.foot.x * Math.sin(rotation) + leg.foot.y * Math.cos(rotation)));
  const standingY = groundHere - lowestFoot;
  const fallProgress = state.flipped ? Math.min(1, (Math.abs(state.theta) - clopFlipLimit) / 1.4) : 0;
  const bodyY = standingY + fallProgress * (groundHere - 34 - standingY);
  context.save();
  context.translate(clopBodyX, bodyY);
  context.rotate(rotation);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  [1, 3, 0, 2].forEach((index) => {
    const { far, isHeld, hip, knee, foot } = legShapes[index];
    context.strokeStyle = far ? '#3d7f93' : (isHeld ? '#a6fff0' : '#65e6d1');
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(hip.x, hip.y);
    context.lineTo(knee.x, knee.y);
    context.lineTo(foot.x, foot.y);
    context.stroke();
    context.fillStyle = '#e8f0ef';
    context.fillRect(foot.x - 5, foot.y - 2, 12, 5);
  });
  context.fillStyle = '#dce9f8';
  context.beginPath();
  context.roundRect(-62, -20, 124, 40, 10);
  context.fill();
  context.fillStyle = '#16384c';
  context.fillRect(-48, -10, 56, 14);
  context.fillStyle = '#ffd27d';
  context.beginPath();
  context.arc(42, -6, 9, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ff718b';
  context.fillRect(-22, -30, 3, 12);
  context.fillRect(-26, -34, 11, 5);
  context.restore();
}

function updateClopProgress() {
  const meters = Math.max(0, Math.min(clopGoal, clopState.distance));
  const percent = meters / clopGoal * 100;
  document.querySelector('#clop-progress-fill').style.width = `${percent}%`;
  document.querySelector('#clop-progress-marker').style.left = `${percent}%`;
  document.querySelector('#clop-progress-now').textContent = `현재 ${meters.toFixed(0)}m`;
}

function updateClopReadout() {
  updateClopProgress();
  const meters = Math.max(0, Math.floor(clopState.distance));
  document.querySelector('#clop-distance').innerHTML = `${meters}<small> m</small>`;
  const remaining = Math.max(0, Math.ceil(clopTimeLimit - (clopState.time || 0)));
  document.querySelector('#clop-time').innerHTML = `${remaining}<small> s</small>`;
  document.querySelector('#clop-time').parentElement.classList.toggle('is-danger', clopRunning && remaining <= 10);
  if (clopRunning) document.querySelector('#clop-status').textContent = `WALKING ${remaining}s`;
  const tilt = Math.min(100, Math.round(Math.abs(clopState.theta) / clopFlipLimit * 100));
  document.querySelector('#clop-tilt-meter').value = tilt;
  document.querySelector('#clop-tilt-label').textContent = tilt < 8 ? '수평' : `${clopState.theta > 0 ? '앞숙임' : '뒤들림'} ${tilt}%`;
  document.querySelector('.clop-tilt').classList.toggle('is-danger', tilt > 70);
}

function clearClopInput() {
  Object.keys(clopHeld).forEach((key) => {
    clopHeld[key] = false;
    document.querySelector(`[data-clop-control="${key}"]`)?.classList.remove('is-held');
  });
}

function resetClop() {
  if (clopFrame !== null) cancelAnimationFrame(clopFrame);
  clopFrame = null;
  clopRunning = false;
  clearClopInput();
  clopState = createClopState();
  document.querySelector('#clop-status').textContent = 'READY';
  document.querySelector('#clop-score').textContent = '—';
  updateClopReadout();
  drawClopScene();
}

async function finishClop(reachedGoal, timedOut = false) {
  if (!clopRunning) return;
  clopRunning = false;
  clopFrame = null;
  clearClopInput();
  const meters = Math.max(0, Math.min(clopGoal, clopState.distance));
  const points = Math.round(meters * 10) + (reachedGoal ? 500 : 0);
  document.querySelector('#clop-status').textContent = reachedGoal ? 'ARRIVED' : (timedOut ? 'TIME UP' : 'FLIPPED');
  document.querySelector('#clop-score').textContent = String(points);
  document.querySelector('#clop-distance').innerHTML = `${meters.toFixed(1)}<small> m</small>`;
  updateClopProgress();
  if (points > Number(getBest('clop') || 0)) saveBest('clop', points);
  const earned = await awardScore('clop', points);
  document.querySelector('#clop-overlay-title').textContent = reachedGoal ? '목적지 도착!' : (timedOut ? '시간 종료' : '로버가 뒤집혔습니다');
  document.querySelector('#clop-overlay-copy').textContent = earned === null
    ? `${meters.toFixed(1)} m · 이름 등록 후 점수를 저장할 수 있어요.`
    : `${meters.toFixed(1)} m · ${earned} PTS 기록`;
  document.querySelector('#clop-start').textContent = '다시 도전 ↗';
  document.querySelector('#clop-overlay').classList.remove('is-hidden');
  drawClopScene();
}

function animateClop() {
  if (!clopRunning) {
    clopFrame = null;
    return;
  }
  stepClop(clopState);
  clopState.time = (clopState.time || 0) + 1 / 60;
  if (clopState.distance >= clopGoal) {
    finishClop(true);
    return;
  }
  if (!clopState.flipped && clopState.time >= clopTimeLimit) {
    finishClop(false, true);
    return;
  }
  if (clopState.flipped && Math.abs(clopState.theta) > 2.6) {
    drawClopScene();
    finishClop(false);
    return;
  }
  if (clopRunning) {
    updateClopProgress();
  }
  if (performance.now() - clopHudFrame > 100) {
    updateClopReadout();
    clopHudFrame = performance.now();
  }
  drawClopScene();
  clopFrame = requestAnimationFrame(animateClop);
}

function startClop() {
  if (clopRunning) return;
  resetClop();
  clopRunning = true;
  document.querySelector('#clop-status').textContent = 'WALKING';
  document.querySelector('#clop-overlay').classList.add('is-hidden');
  clopFrame = requestAnimationFrame(animateClop);
}

function setClopControl(control, isPressed) {
  if (!clopRunning) return;
  clopHeld[control] = isPressed;
  document.querySelector(`[data-clop-control="${control}"]`)?.classList.toggle('is-held', isPressed);
}

document.querySelector('#clop-start').addEventListener('click', startClop);
document.querySelector('#clop-reset').addEventListener('click', () => {
  resetClop();
  document.querySelector('#clop-overlay').classList.remove('is-hidden');
});
document.querySelectorAll('[data-clop-control]').forEach((button) => {
  const control = button.dataset.clopControl;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setClopControl(control, true);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => button.addEventListener(eventName, () => setClopControl(control, false)));
});
document.addEventListener('keydown', (event) => {
  const control = event.key.toLowerCase();
  if (!(control in clopHeld) || !document.querySelector('#view-clop').classList.contains('is-visible')) return;
  event.preventDefault();
  setClopControl(control, true);
});
document.addEventListener('keyup', (event) => {
  const control = event.key.toLowerCase();
  if (control in clopHeld) setClopControl(control, false);
});
window.addEventListener('blur', clearClopInput);
resetClop();
window.Playground.registerGame('clop', {
  onShow: () => { drawClopScene(); if (clopRunning && clopFrame === null) clopFrame = requestAnimationFrame(animateClop); },
  onHide: () => { if (clopFrame !== null) cancelAnimationFrame(clopFrame); clopFrame = null; clearClopInput(); }
});
