    const WIDTH = 480;
    const HEIGHT = 576;
    const MAX_SCORE = 100000;
    const canvas = document.querySelector('#canvas');
    const context = canvas.getContext('2d');
    const held = new Set();
    let rng = Math.random;
    let enemies = [];
    let playerShots = [];
    let enemyShots = [];
    let playerX = WIDTH / 2;
    let lives = 3;
    let round = 1;
    let roundEnemyCount = 5;
    let score = 0;
    let activeMs = 0;
    let lastAt = 0;
    let shotTimer = 0;
    let enemyShotTimer = 0;
    let invulnerableMs = 0;
    let roundClearMs = 0;
    let running = false;
    let paused = false;
    let frame = null;

    function seeded(seed) {
      let value = seed >>> 0;
      return () => {
        value = (value + 0x6D2B79F5) >>> 0;
        let t = value;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function startRound() {
      roundEnemyCount = Math.min(18, 4 + round);
      enemies = [];
      const columns = Math.min(6, roundEnemyCount);
      for (let index = 0; index < roundEnemyCount; index += 1) {
        enemies.push({
          x: WIDTH / 2 + (index % columns - (columns - 1) / 2) * 62,
          y: 74 + Math.floor(index / columns) * 38,
          width: 30,
          height: 22
        });
      }
      enemyShots = [];
      enemyShotTimer = 900;
      roundClearMs = 0;
    }

    function reset() {
      running = false;
      paused = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      held.clear();
      playerX = WIDTH / 2;
      lives = 3;
      round = 1;
      score = 0;
      activeMs = 0;
      lastAt = 0;
      shotTimer = 0;
      invulnerableMs = 0;
      playerShots = [];
      startRound();
      draw();
    }

    function drawShip(x, y, color, enemy = false) {
      context.fillStyle = color;
      context.beginPath();
      if (enemy) {
        context.moveTo(x, y + 12);
        context.lineTo(x + 15, y);
        context.lineTo(x + 30, y + 12);
        context.lineTo(x + 24, y + 22);
        context.lineTo(x + 6, y + 22);
      } else {
        context.moveTo(x + 16, y);
        context.lineTo(x + 31, y + 32);
        context.lineTo(x + 16, y + 25);
        context.lineTo(x + 1, y + 32);
      }
      context.closePath();
      context.fill();
    }

    function draw() {
      context.fillStyle = '#071525';
      context.fillRect(0, 0, WIDTH, HEIGHT);
      const nebula = context.createRadialGradient(240, 355, 25, 240, 355, 370);
      nebula.addColorStop(0, '#16405b35');
      nebula.addColorStop(1, '#07152500');
      context.fillStyle = nebula;
      context.fillRect(0, 0, WIDTH, HEIGHT);
      for (let index = 0; index < 135; index += 1) {
        const x = (index * 173) % WIDTH;
        const y = (index * 97 + Math.floor(activeMs / (index % 3 === 0 ? 28 : 52))) % HEIGHT;
        const size = index % 13 === 0 ? 3 : index % 4 === 0 ? 2 : 1;
        context.globalAlpha = .35 + (index % 5) * .12;
        context.fillStyle = index % 4 === 0 ? '#78c6df' : '#527b9a';
        context.fillRect(x, y, size, size);
      }
      context.globalAlpha = 1;
      context.strokeStyle = '#15354a55';
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(WIDTH / 2, 385, 205, 90, -.12, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#123149';
      context.fillRect(0, 528, WIDTH, 2);
      context.fillStyle = '#8eb4c6';
      context.font = '16px ui-monospace, monospace';
      context.fillText(`ROUND ${round}`, 20, 30);
      context.fillText(`SCORE ${score}`, 20, 54);
      context.fillText(`LIVES ${'♥ '.repeat(lives)}`, WIDTH - 105, 30);
      enemies.forEach((enemy, index) => drawShip(enemy.x - 15, enemy.y, ['#f27d69', '#e7b55b', '#7ee2cf'][index % 3], true));
      playerShots.forEach((shot) => {
        context.fillStyle = '#a8fff2';
        context.fillRect(shot.x - 2, shot.y - 9, 4, 12);
      });
      enemyShots.forEach((shot) => {
        context.fillStyle = '#ff876f';
        context.beginPath();
        context.arc(shot.x, shot.y, 5, 0, Math.PI * 2);
        context.fill();
      });
      if (!invulnerableMs || Math.floor(activeMs / 100) % 2 === 0) drawShip(playerX - 16, 500, '#79e7d4');
      if (roundClearMs > 0) {
        context.fillStyle = '#b9ffe9';
        context.font = 'bold 24px system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillText(`ROUND ${round} CLEAR`, WIDTH / 2, HEIGHT / 2);
        context.textAlign = 'left';
      }
    }

    function gameOver() {
      if (!running) return;
      running = false;
      paused = false;
      frame = null;
      held.clear();
      draw();
      Scorex.hud({ score, lives, status: 'MISSION END' });
      Scorex.gameOver({ score, durationMs: Math.max(1, Math.round(activeMs)), result: 'fail', meta: { round, lives } });
    }

    function takeHit() {
      if (invulnerableMs > 0) return;
      lives -= 1;
      invulnerableMs = 1300;
      enemyShots = [];
      if (lives <= 0) gameOver();
    }

    function update(delta) {
      const dt = Math.min(delta, 50);
      activeMs += dt;
      if (invulnerableMs > 0) invulnerableMs = Math.max(0, invulnerableMs - dt);
      if (roundClearMs > 0) {
        roundClearMs -= dt;
        if (roundClearMs <= 0) {
          round += 1;
          startRound();
        }
        return;
      }

      const direction = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
      playerX = Math.max(24, Math.min(WIDTH - 24, playerX + direction * 320 * dt / 1000));
      shotTimer -= dt;
      if (shotTimer <= 0) {
        playerShots.push({ x: playerX, y: 500 });
        shotTimer = 230;
      }

      const enemySpeed = Math.min(230, 48 + round * 7 + (roundEnemyCount - enemies.length) * 10);
      let hitEdge = false;
      enemies.forEach((enemy) => {
        enemy.x += enemySpeed * dt / 1000 * (enemy.direction || 1);
        if (enemy.x < 28 || enemy.x > WIDTH - 28) hitEdge = true;
      });
      if (hitEdge) {
        enemies.forEach((enemy) => {
          enemy.direction = -(enemy.direction || 1);
          enemy.x = Math.max(28, Math.min(WIDTH - 28, enemy.x));
          enemy.y += 14;
        });
      }
      if (enemies.some((enemy) => enemy.y > 456)) {
        takeHit();
        enemies.forEach((enemy) => { enemy.y = Math.min(enemy.y, 360); });
      }

      playerShots.forEach((shot) => { shot.y -= 390 * dt / 1000; });
      playerShots = playerShots.filter((shot) => shot.y > 0);
      for (let shotIndex = playerShots.length - 1; shotIndex >= 0; shotIndex -= 1) {
        const shot = playerShots[shotIndex];
        const enemyIndex = enemies.findIndex((enemy) =>
          shot.x >= enemy.x - enemy.width / 2 && shot.x <= enemy.x + enemy.width / 2 &&
          shot.y >= enemy.y && shot.y <= enemy.y + enemy.height
        );
        if (enemyIndex !== -1) {
          enemies.splice(enemyIndex, 1);
          playerShots.splice(shotIndex, 1);
        }
      }

      enemyShotTimer -= dt;
      if (enemyShotTimer <= 0 && enemies.length) {
        const shooter = enemies[Math.floor(rng() * enemies.length)];
        enemyShots.push({ x: shooter.x, y: shooter.y + shooter.height });
        enemyShotTimer = 650 + rng() * 500;
      }
      enemyShots.forEach((shot) => { shot.y += 200 * dt / 1000; });
      enemyShots = enemyShots.filter((shot) => shot.y < HEIGHT);
      if (invulnerableMs <= 0 && enemyShots.some((shot) => Math.abs(shot.x - playerX) < 22 && shot.y >= 496 && shot.y <= 532)) takeHit();

      if (enemies.length === 0 && roundClearMs === 0) {
        score = Math.min(MAX_SCORE, score + 10 + round * 5);
        roundClearMs = 1100;
        Scorex.hud({ score, lives, status: 'ROUND CLEAR' });
      } else if (Math.floor(activeMs / 250) !== Math.floor((activeMs - dt) / 250)) {
        Scorex.hud({ score, lives, status: `ROUND ${round}` });
      }
    }

    function animate(now) {
      if (!running || paused) return;
      const delta = lastAt ? now - lastAt : 0;
      lastAt = now;
      update(delta);
      draw();
      if (running && !paused) frame = requestAnimationFrame(animate);
    }

    function setControl(control, pressed) {
      if (pressed) held.add(control);
      else held.delete(control);
    }

    document.querySelectorAll('[data-control]').forEach((button) => {
      const control = button.dataset.control;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        setControl(control, true);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => {
        button.addEventListener(name, () => setControl(control, false));
      });
    });
    const keyControls = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    document.addEventListener('keydown', (event) => {
      const control = keyControls[event.key];
      if (!control) return;
      event.preventDefault();
      setControl(control, true);
    });
    document.addEventListener('keyup', (event) => {
      if (keyControls[event.key]) setControl(keyControls[event.key], false);
    });
    window.addEventListener('blur', () => held.clear());

    Scorex.onInit((init) => { rng = seeded(init.seed); reset(); });
    Scorex.onStart(() => {
      reset();
      running = true;
      lastAt = performance.now();
      frame = requestAnimationFrame(animate);
      Scorex.started();
      Scorex.hud({ score, lives, status: 'ROUND 1' });
    });
    Scorex.onPause(() => {
      if (!running || paused) return;
      paused = true;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      held.clear();
    });
    Scorex.onResume(() => {
      if (!running || !paused) return;
      paused = false;
      lastAt = performance.now();
      frame = requestAnimationFrame(animate);
    });
    Scorex.onDestroy(() => { running = false; if (frame !== null) cancelAnimationFrame(frame); });
    Scorex.connect({ gameId: 'galaga', gameVersion: '1.0.0' });
  
