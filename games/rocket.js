const { getBest, saveBest, awardScore } = window.Playground;

const rocketCanvas = document.querySelector('#rocket-canvas');
const rocketContext = rocketCanvas.getContext('2d');
const rocketEngine = Matter.Engine.create({ enableSleeping: false });
rocketEngine.gravity.x = 0;
rocketEngine.gravity.y = 1;
rocketEngine.gravity.scale = 0.00009;
const rocketWidth = rocketCanvas.width;
const rocketHeight = rocketCanvas.height;
const rocketPadX = 470;
const rocketPadWidth = 180;
const rocketGroundY = 424;
const rocketStars = Array.from({ length: 70 }, () => ({ x: Math.random() * rocketWidth, y: Math.random() * 320, size: .5 + Math.random() * 1.5, alpha: .25 + Math.random() * .65 }));
const rocketInput = { rotate: 0, thrust: false };
let rocketBody = null;
let rocketPad = null;
let rocketObstacles = [];
let rocketFuel = 100;
let rocketRunning = false;
let rocketFrame = null;
let rocketPoints = 0;
let rocketHudFrame = 0;

function setupRocketWorld() {
  Matter.Composite.clear(rocketEngine.world, false, true);
  rocketPad = Matter.Bodies.rectangle(rocketPadX, rocketGroundY - 10, rocketPadWidth, 12, {
    isStatic: true,
    friction: .9,
    label: 'landing-pad'
  });
  rocketObstacles = [
    Matter.Bodies.rectangle(190, 452, 380, 56, { isStatic: true, label: 'terrain' }),
    Matter.Bodies.rectangle(645, 452, 150, 56, { isStatic: true, label: 'terrain' }),
    Matter.Bodies.rectangle(-14, 220, 28, 440, { isStatic: true, label: 'boundary' }),
    Matter.Bodies.rectangle(734, 220, 28, 440, { isStatic: true, label: 'boundary' })
  ];
  rocketBody = Matter.Bodies.rectangle(270, 112, 22, 38, {
    density: .002,
    friction: .55,
    frictionAir: .002,
    restitution: .02,
    label: 'lander'
  });
  Matter.Body.setVelocity(rocketBody, { x: .15, y: .7 });
  Matter.Composite.add(rocketEngine.world, [...rocketObstacles, rocketPad, rocketBody]);
}

function clearRocketInput() {
  rocketInput.rotate = 0;
  rocketInput.thrust = false;
  document.querySelectorAll('.rocket-control').forEach((button) => button.classList.remove('is-held'));
}

function resetRocket() {
  if (rocketFrame !== null) cancelAnimationFrame(rocketFrame);
  rocketFrame = null;
  rocketRunning = false;
  rocketFuel = 100;
  rocketPoints = 0;
  rocketHudFrame = 0;
  clearRocketInput();
  setupRocketWorld();
  document.querySelector('#rocket-status').textContent = 'READY';
  document.querySelector('#rocket-score').textContent = '—';
  document.querySelector('#rocket-altitude').innerHTML = '—<small> m</small>';
  document.querySelector('#rocket-vertical-speed').innerHTML = '—<small> m/s</small>';
  document.querySelector('#rocket-horizontal-speed').innerHTML = '—<small> m/s</small>';
  document.querySelector('#rocket-fuel-label').textContent = '100%';
  document.querySelector('#rocket-fuel-meter').value = 100;
  document.querySelector('#rocket-overlay-title').textContent = '부스터 회수 준비 완료';
  document.querySelector('#rocket-overlay-copy').textContent = '추력으로 속도를 줄이고 해상 패드에 수직 착륙하세요.';
  document.querySelector('#rocket-start').textContent = '회수 시퀀스 시작 ↗';
  document.querySelector('#rocket-overlay').classList.remove('is-hidden');
  drawRocketScene();
}

function drawRocketScene() {
  const context = rocketContext;
  const sky = context.createLinearGradient(0, 0, 0, rocketHeight);
  sky.addColorStop(0, '#071525');
  sky.addColorStop(.72, '#123b55');
  sky.addColorStop(1, '#24718a');
  context.fillStyle = sky;
  context.fillRect(0, 0, rocketWidth, rocketHeight);
  rocketStars.forEach((star) => {
    context.globalAlpha = star.alpha;
    context.fillStyle = '#d8f5ff';
    context.beginPath();
    context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = 1;
  context.fillStyle = '#a8d8e2';
  context.beginPath();
  context.arc(592, 102, 34, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#74b4c7';
  context.beginPath();
  context.arc(580, 94, 7, 0, Math.PI * 2);
  context.arc(606, 111, 10, 0, Math.PI * 2);
  context.arc(600, 87, 4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#092136';
  context.fillRect(0, rocketGroundY, rocketWidth, rocketHeight - rocketGroundY);
  context.strokeStyle = '#28758a';
  context.lineWidth = 2;
  for (let wave = 0; wave < 7; wave += 1) {
    const y = rocketGroundY + 13 + wave * 7;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(rocketWidth, y);
    context.stroke();
  }
  context.fillStyle = '#b9ced6';
  context.fillRect(0, rocketGroundY, rocketPadX - rocketPadWidth / 2, 5);
  context.fillRect(rocketPadX + rocketPadWidth / 2, rocketGroundY, rocketWidth - rocketPadX - rocketPadWidth / 2, 5);
  context.fillStyle = '#ff765f';
  context.fillRect(rocketPadX - rocketPadWidth / 2, rocketGroundY - 10, rocketPadWidth, 7);
  context.fillStyle = '#f2f6f5';
  for (let stripe = 0; stripe < 5; stripe += 1) context.fillRect(rocketPadX - 64 + stripe * 32, rocketGroundY - 8, 12, 3);

  if (!rocketBody) return;
  context.save();
  context.translate(rocketBody.position.x, rocketBody.position.y);
  context.rotate(rocketBody.angle);
  if (rocketRunning && rocketInput.thrust && rocketFuel > 0) {
    const flameLength = 19 + Math.random() * 10;
    context.fillStyle = '#ff765f';
    context.beginPath();
    context.moveTo(-6, 17);
    context.lineTo(0, 17 + flameLength);
    context.lineTo(6, 17);
    context.closePath();
    context.fill();
    context.fillStyle = '#ffd27d';
    context.beginPath();
    context.moveTo(-3, 17);
    context.lineTo(0, 17 + flameLength * .68);
    context.lineTo(3, 17);
    context.fill();
  }
  context.fillStyle = '#f0f5f4';
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(10, -8);
  context.lineTo(8, 15);
  context.lineTo(-8, 15);
  context.lineTo(-10, -8);
  context.closePath();
  context.fill();
  context.fillStyle = '#ff765f';
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(6, -13);
  context.lineTo(-6, -13);
  context.closePath();
  context.fill();
  context.fillRect(-13, 8, 5, 10);
  context.fillRect(8, 8, 5, 10);
  context.fillStyle = '#80b9c0';
  context.beginPath();
  context.arc(0, -4, 4, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function updateRocketReadout() {
  const velocity = Matter.Body.getVelocity(rocketBody);
  const altitude = Math.max(0, Math.round((rocketGroundY - rocketBody.position.y) / 10));
  document.querySelector('#rocket-altitude').innerHTML = `${altitude}<small> m</small>`;
  document.querySelector('#rocket-vertical-speed').innerHTML = `${Math.max(0, velocity.y).toFixed(1)}<small> m/s</small>`;
  document.querySelector('#rocket-horizontal-speed').innerHTML = `${Math.abs(velocity.x).toFixed(1)}<small> m/s</small>`;
  const heading = Math.round(Math.atan2(Math.sin(rocketBody.angle), Math.cos(rocketBody.angle)) * 180 / Math.PI);
  document.querySelector('#rocket-direction').textContent = `${heading}°`;
  document.querySelector('#rocket-fuel-label').textContent = `${Math.ceil(rocketFuel)}%`;
  document.querySelector('#rocket-fuel-meter').value = rocketFuel;
}

async function finishRocket(safeLanding) {
  if (!rocketRunning) return;
  rocketRunning = false;
  rocketFrame = null;
  clearRocketInput();
  const velocity = Matter.Body.getVelocity(rocketBody);
  const verticalSpeed = Math.max(0, velocity.y);
  const horizontalSpeed = Math.abs(velocity.x);
  const angle = Math.abs(Math.atan2(Math.sin(rocketBody.angle), Math.cos(rocketBody.angle)));
  document.querySelector('#rocket-status').textContent = safeLanding ? 'LANDED' : 'CRASH';
  if (safeLanding) {
    rocketPoints = Math.max(100, Math.round(1200 - verticalSpeed * 120 - horizontalSpeed * 110 - angle * 220));
    document.querySelector('#rocket-score').textContent = String(rocketPoints);
    if (rocketPoints > Number(getBest('rocket') || 0)) saveBest('rocket', rocketPoints);
    const earned = await awardScore('rocket', rocketPoints);
    document.querySelector('#rocket-overlay-title').textContent = '착륙 성공!';
    document.querySelector('#rocket-overlay-copy').textContent = earned === null
      ? `속도 ${verticalSpeed.toFixed(1)} m/s · 이름 등록 후 점수를 저장할 수 있어요.`
      : `속도 ${verticalSpeed.toFixed(1)} m/s · ${earned} PTS 기록`;
  } else {
    document.querySelector('#rocket-score').textContent = '0';
    document.querySelector('#rocket-overlay-title').textContent = '부스터 회수 실패';
    const earned = await awardScore('rocket', 0);
    document.querySelector('#rocket-overlay-copy').textContent = '패드 중앙에서 기체를 수평으로 하고 하강 속도를 낮춰보세요.';
    if (earned !== null) document.querySelector('#rocket-overlay-copy').textContent += ' 결과 보상은 정산되었습니다.';
  }
  document.querySelector('#rocket-start').textContent = '회수 재시도 ↗';
  document.querySelector('#rocket-overlay').classList.remove('is-hidden');
  drawRocketScene();
}

function checkRocketCollision(event) {
  if (!rocketRunning) return;
  let touchedPad = false;
  let touchedHazard = false;
  event.pairs.forEach(({ bodyA, bodyB }) => {
    if (bodyA !== rocketBody && bodyB !== rocketBody) return;
    const other = bodyA === rocketBody ? bodyB : bodyA;
    if (other === rocketPad) touchedPad = true;
    else if (rocketObstacles.includes(other)) touchedHazard = true;
  });
  if (touchedPad) {
    const velocity = Matter.Body.getVelocity(rocketBody);
    const normalizedAngle = Math.atan2(Math.sin(rocketBody.angle), Math.cos(rocketBody.angle));
    const centered = Math.abs(rocketBody.position.x - rocketPadX) <= rocketPadWidth / 2 - 14;
    const safe = centered && velocity.y >= -.2 && velocity.y <= 2.8 && Math.abs(velocity.x) <= 2.4 && Math.abs(normalizedAngle) <= .22;
    finishRocket(safe);
  } else if (touchedHazard) {
    finishRocket(false);
  }
}

Matter.Events.on(rocketEngine, 'collisionStart', checkRocketCollision);

function animateRocket() {
  if (!rocketRunning) {
    rocketFrame = null;
    return;
  }
  if (rocketInput.rotate !== 0) Matter.Body.setAngle(rocketBody, rocketBody.angle + rocketInput.rotate * .018);
  if (rocketInput.thrust && rocketFuel > 0) {
    const force = rocketBody.mass * .00017;
    Matter.Body.applyForce(rocketBody, rocketBody.position, {
      x: Math.sin(rocketBody.angle) * force,
      y: -Math.cos(rocketBody.angle) * force
    });
    rocketFuel = Math.max(0, rocketFuel - .18);
  }
  Matter.Engine.update(rocketEngine, 1000 / 60);
  if (rocketBody.position.y > rocketHeight + 30 || rocketBody.position.x < -5 || rocketBody.position.x > rocketWidth + 5) finishRocket(false);
  if (performance.now() - rocketHudFrame > 100) {
    updateRocketReadout();
    rocketHudFrame = performance.now();
  }
  drawRocketScene();
  if (rocketRunning) rocketFrame = requestAnimationFrame(animateRocket);
}

function startRocket() {
  if (rocketRunning) return;
  resetRocket();
  rocketRunning = true;
  document.querySelector('#rocket-status').textContent = 'FLIGHT';
  document.querySelector('#rocket-overlay').classList.add('is-hidden');
  rocketFrame = requestAnimationFrame(animateRocket);
}

function setRocketControl(control, isPressed) {
  if (!rocketRunning) return;
  if (control === 'left') rocketInput.rotate = isPressed ? -1 : rocketInput.rotate === -1 ? 0 : rocketInput.rotate;
  if (control === 'right') rocketInput.rotate = isPressed ? 1 : rocketInput.rotate === 1 ? 0 : rocketInput.rotate;
  if (control === 'thrust') rocketInput.thrust = isPressed;
  document.querySelector(`[data-rocket-control="${control}"]`)?.classList.toggle('is-held', isPressed);
}

document.querySelector('#rocket-start').addEventListener('click', startRocket);
document.querySelector('#rocket-reset').addEventListener('click', resetRocket);
document.querySelectorAll('[data-rocket-control]').forEach((button) => {
  const control = button.dataset.rocketControl;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setRocketControl(control, true);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((eventName) => button.addEventListener(eventName, () => setRocketControl(control, false)));
});
const rocketKeys = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'thrust', w: 'thrust', W: 'thrust' };
document.addEventListener('keydown', (event) => {
  const control = rocketKeys[event.key];
  if (!control || !document.querySelector('#view-rocket').classList.contains('is-visible')) return;
  event.preventDefault();
  setRocketControl(control, true);
});
document.addEventListener('keyup', (event) => {
  if (rocketKeys[event.key]) setRocketControl(rocketKeys[event.key], false);
});
window.addEventListener('blur', clearRocketInput);
resetRocket();
window.Playground.registerGame('rocket', { onShow: () => { drawRocketScene(); if (rocketRunning && rocketFrame === null) rocketFrame = requestAnimationFrame(animateRocket); }, onHide: () => { if (rocketFrame !== null) cancelAnimationFrame(rocketFrame); rocketFrame = null; clearRocketInput(); } });
