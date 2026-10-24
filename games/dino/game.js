    const WIDTH = 720;
    const HEIGHT = 480;
    const GROUND = 376;
    const MAX_SCORE = 100000;
    const canvas = document.querySelector('#canvas');
    const context = canvas.getContext('2d');
    let rng = Math.random;
    let obstacles = [];
    let distance = 0;
    let score = 0;
    let speed = 250;
    let jumpHeight = 0;
    let jumpVelocity = 0;
    let ducking = false;
    let spawnDistance = 380;
    let activeMs = 0;
    let lastAt = 0;
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

    function reset() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      running = false;
      paused = false;
      obstacles = [];
      distance = 0;
      score = 0;
      speed = 250;
      jumpHeight = 0;
      jumpVelocity = 0;
      ducking = false;
      spawnDistance = 380;
      activeMs = 0;
      lastAt = 0;
      draw();
    }

    function draw() {
      const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, '#132538');
      sky.addColorStop(1, '#283b3b');
      context.fillStyle = sky;
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.fillStyle = '#dbe6c5';
      context.beginPath(); context.arc(590, 96, 33, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#aab998';
      context.beginPath(); context.arc(579, 89, 7, 0, Math.PI * 2); context.arc(603, 105, 10, 0, Math.PI * 2); context.fill();
      for (let index = 0; index < 6; index += 1) {
        const x = (index * 137 - (distance * .12) % WIDTH + WIDTH) % WIDTH;
        context.fillStyle = '#455b5b';
        context.beginPath(); context.ellipse(x, 312 + index % 2 * 18, 44, 12, 0, 0, Math.PI * 2); context.fill();
      }
      context.fillStyle = '#675f4a';
      context.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
      context.strokeStyle = '#b3a57a';
      context.lineWidth = 3;
      context.beginPath(); context.moveTo(0, GROUND); context.lineTo(WIDTH, GROUND); context.stroke();
      for (let index = 0; index < 16; index += 1) {
        const x = (index * 71 - distance % 71 + WIDTH) % WIDTH;
        context.fillStyle = '#a99b70';
        context.fillRect(x, GROUND + 14 + index % 3 * 9, 20, 3);
      }
      obstacles.forEach((obstacle) => {
        if (obstacle.type === 'bird') {
          context.fillStyle = '#e5a15e33';
          context.beginPath();
          context.moveTo(obstacle.x + 12, obstacle.y + 16);
          context.lineTo(obstacle.x + 28, obstacle.y + 16);
          context.lineTo(obstacle.x + obstacle.width - 1, obstacle.y + obstacle.height);
          context.lineTo(obstacle.x + 1, obstacle.y + obstacle.height);
          context.closePath();
          context.fill();
          context.fillStyle = '#e5a15e';
          context.beginPath();
          context.moveTo(obstacle.x, obstacle.y + 13);
          context.lineTo(obstacle.x + 12, obstacle.y + 5);
          context.lineTo(obstacle.x + 25, obstacle.y + 9);
          context.lineTo(obstacle.x + 39, obstacle.y + 2);
          context.lineTo(obstacle.x + 32, obstacle.y + 17);
          context.lineTo(obstacle.x + 16, obstacle.y + 22);
          context.closePath();
          context.fill();
          context.fillStyle = '#f5c889';
          context.fillRect(obstacle.x + 11, obstacle.y + 9, 18, 3);
          context.fillStyle = '#0e1c28';
          context.fillRect(obstacle.x + 30, obstacle.y + 8, 4, 4);
        } else {
          context.fillStyle = '#7fc58e';
          context.fillRect(obstacle.x + 8, obstacle.y, obstacle.width - 16, obstacle.height);
          context.fillRect(obstacle.x, obstacle.y + 14, 12, 24);
          context.fillRect(obstacle.x + obstacle.width - 12, obstacle.y + 24, 12, 22);
          context.fillStyle = '#a5e4a7';
          context.fillRect(obstacle.x + 11, obstacle.y + 5, 4, 8);
        }
      });
      drawRover();
      context.fillStyle = '#dcebd0';
      context.font = '16px ui-monospace, monospace';
      context.fillText(`DISTANCE ${Math.floor(distance)} m`, 20, 31);
      context.fillText(`SCORE ${score}`, 20, 56);
    }

    function drawRover() {
      const baseY = GROUND - jumpHeight;
      const crouched = ducking && jumpHeight === 0;
      const wheelRadius = crouched ? 7 : 9;
      const wheelY = baseY - wheelRadius;
      const bodyX = 103;
      const bodyY = baseY - (crouched ? 25 : 34);
      context.fillStyle = '#243b42';
      [113, 151].forEach((x) => {
        context.beginPath();
        context.arc(x, wheelY, wheelRadius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#a9b8a0';
        context.beginPath();
        context.arc(x, wheelY, 3, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#243b42';
      });
      context.fillStyle = '#d59643';
      context.fillRect(bodyX, bodyY + 12, 58, 12);
      context.fillStyle = '#e6b65e';
      context.fillRect(bodyX + 8, bodyY + 5, 42, 11);
      context.fillStyle = '#557b82';
      context.fillRect(bodyX - 14, bodyY + 3, 13, 17);
      context.fillRect(bodyX + 59, bodyY + 3, 13, 17);
      context.strokeStyle = '#bdd2b4';
      context.lineWidth = 2;
      for (let x = bodyX - 11; x < bodyX - 1; x += 5) {
        context.beginPath(); context.moveTo(x, bodyY + 4); context.lineTo(x, bodyY + 19); context.stroke();
      }
      for (let x = bodyX + 62; x < bodyX + 72; x += 5) {
        context.beginPath(); context.moveTo(x, bodyY + 4); context.lineTo(x, bodyY + 19); context.stroke();
      }
      if (!crouched) {
        context.strokeStyle = '#e6b65e';
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(bodyX + 38, bodyY + 5);
        context.lineTo(bodyX + 38, bodyY - 11);
        context.stroke();
        context.fillStyle = '#f2d57f';
        context.fillRect(bodyX + 31, bodyY - 17, 17, 8);
        context.fillStyle = '#263842';
        context.fillRect(bodyX + 34, bodyY - 15, 4, 4);
      }
      context.fillStyle = '#6a5541';
      context.fillRect(119, baseY - 3, 5, 7);
      context.fillRect(142, baseY - 3, 5, 7);
    }

    function finish() {
      if (!running) return;
      running = false;
      paused = false;
      frame = null;
      ducking = false;
      draw();
      Scorex.hud({ score, status: 'ROVER STOPPED' });
      Scorex.gameOver({ score, durationMs: Math.max(1, Math.round(activeMs)), result: 'fail', meta: { distance: Math.floor(distance) } });
    }

    function jump() {
      if (running && !paused && jumpHeight === 0) {
        jumpVelocity = 500;
        ducking = false;
      }
    }

    function update(delta) {
      const dt = Math.min(delta, 50) / 1000;
      activeMs += dt * 1000;
      speed = Math.min(510, 250 + activeMs / 1000 * 4);
      distance += speed * dt;
      score = Math.min(MAX_SCORE, Math.floor(distance / 100));
      jumpHeight += jumpVelocity * dt;
      if (jumpHeight > 0) jumpVelocity -= 1400 * dt;
      if (jumpHeight <= 0) {
        jumpHeight = 0;
        jumpVelocity = 0;
      }
      obstacles.forEach((obstacle) => { obstacle.x -= speed * dt; });
      obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0);
      spawnDistance -= speed * dt;
      if (spawnDistance <= 0) {
        const bird = activeMs > 6500 && rng() < .28;
        const height = bird ? 81 : 30 + Math.floor(rng() * 19);
        const width = bird ? 40 : 24 + Math.floor(rng() * 18);
        obstacles.push({ type: bird ? 'bird' : 'cactus', x: WIDTH + 12, y: bird ? GROUND - 106 : GROUND - height, width, height });
        spawnDistance = 345 + rng() * 250;
      }
      const roverTop = GROUND - jumpHeight - (ducking && jumpHeight === 0 ? 20 : 27);
      const roverBottom = GROUND - jumpHeight - 5;
      const collided = obstacles.some((obstacle) =>
        obstacle.x < 158 && obstacle.x + obstacle.width > 106 &&
        obstacle.y < roverBottom && obstacle.y + obstacle.height > roverTop
      );
      if (collided) finish();
      if (Math.floor(activeMs / 250) !== Math.floor((activeMs - dt * 1000) / 250)) {
        Scorex.hud({ score, status: 'EXPLORING' });
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

    document.querySelector('[data-control="jump"]').addEventListener('pointerdown', (event) => { event.preventDefault(); jump(); });
    const duckButton = document.querySelector('[data-control="duck"]');
    duckButton.addEventListener('pointerdown', (event) => { event.preventDefault(); duckButton.setPointerCapture(event.pointerId); ducking = true; });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => duckButton.addEventListener(name, () => { ducking = false; }));
    document.addEventListener('keydown', (event) => {
      if ([' ', 'ArrowUp', 'w', 'W'].includes(event.key)) { event.preventDefault(); jump(); }
      if (['ArrowDown', 's', 'S'].includes(event.key)) { event.preventDefault(); ducking = true; }
    });
    document.addEventListener('keyup', (event) => {
      if (['ArrowDown', 's', 'S'].includes(event.key)) ducking = false;
    });
    window.addEventListener('blur', () => { ducking = false; });

    Scorex.onInit((init) => { rng = seeded(init.seed); reset(); });
    Scorex.onStart(() => {
      reset();
      running = true;
      lastAt = performance.now();
      frame = requestAnimationFrame(animate);
      Scorex.started();
      Scorex.hud({ score: 0, status: 'EXPLORING' });
    });
    Scorex.onPause(() => {
      if (!running || paused) return;
      paused = true;
      ducking = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    });
    Scorex.onResume(() => {
      if (!running || !paused) return;
      paused = false;
      lastAt = performance.now();
      frame = requestAnimationFrame(animate);
    });
    Scorex.onDestroy(() => { running = false; if (frame !== null) cancelAnimationFrame(frame); });
    Scorex.connect({ gameId: 'dino', gameVersion: '1.0.0' });
  
