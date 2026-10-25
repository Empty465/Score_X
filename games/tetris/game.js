    const WIDTH = 600;
    const HEIGHT = 1200;
    const COLS = 10;
    const ROWS = 20;
    const CELL = 45;
    const BOARD_X = 75;
    const BOARD_Y = 150;
    const MAX_SCORE = 50000;
    const canvas = document.querySelector('#canvas');
    const context = canvas.getContext('2d');
    const hasTouchControls = window.matchMedia('(pointer: coarse)').matches;
    const shapes = {
      I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
      O: [[1,1],[1,1]],
      T: [[0,1,0],[1,1,1],[0,0,0]],
      S: [[0,1,1],[1,1,0],[0,0,0]],
      Z: [[1,1,0],[0,1,1],[0,0,0]],
      J: [[1,0,0],[1,1,1],[0,0,0]],
      L: [[0,0,1],[1,1,1],[0,0,0]]
    };
    const colors = { I: '#55d6d2', O: '#f1c75b', T: '#bd8cf4', S: '#75d78e', Z: '#ed7b77', J: '#6e9ef2', L: '#f29c61' };
    let rng = Math.random;
    let board = [];
    let current = null;
    let nextType = 'T';
    let score = 0;
    let lines = 0;
    let activeMs = 0;
    let dropAccumulator = 0;
    let accelerating = false;
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

    function randomType() { return Object.keys(shapes)[Math.floor(rng() * 7)]; }
    function emptyBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
    function makePiece(type) {
      const shape = shapes[type].map((row) => [...row]);
      return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: 0 };
    }
    function level() { return 1 + Math.floor(lines / 10); }
    function dropInterval() { return Math.max(120, 850 - (level() - 1) * 70); }

    function reset() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      running = false;
      paused = false;
      accelerating = false;
      board = emptyBoard();
      current = null;
      nextType = randomType();
      score = 0;
      lines = 0;
      activeMs = 0;
      dropAccumulator = 0;
      lastAt = 0;
      spawn();
      draw();
    }

    function collides(shape, x, y) {
      for (let row = 0; row < shape.length; row += 1) {
        for (let col = 0; col < shape[row].length; col += 1) {
          if (!shape[row][col]) continue;
          const bx = x + col;
          const by = y + row;
          if (bx < 0 || bx >= COLS || by >= ROWS || by >= 0 && board[by][bx]) return true;
        }
      }
      return false;
    }

    function spawn() {
      current = makePiece(nextType);
      nextType = randomType();
      if (collides(current.shape, current.x, current.y)) finish();
    }

    function rotate() {
      const shape = current.shape.map((_, row) => current.shape.map((line) => line[row]).reverse());
      for (const offset of [0, -1, 1, -2, 2]) {
        if (!collides(shape, current.x + offset, current.y)) {
          current.shape = shape;
          current.x += offset;
          break;
        }
      }
    }

    function move(dx) {
      if (!collides(current.shape, current.x + dx, current.y)) current.x += dx;
    }

    function lockPiece() {
      current.shape.forEach((row, y) => row.forEach((cell, x) => {
        const by = current.y + y;
        const bx = current.x + x;
        if (cell && by >= 0) board[by][bx] = current.type;
      }));
      const remaining = board.filter((row) => row.some((cell) => cell === null));
      const cleared = ROWS - remaining.length;
      if (cleared) {
        board = [...Array.from({ length: cleared }, () => Array(COLS).fill(null)), ...remaining];
        lines += cleared;
        score = Math.min(MAX_SCORE, score + [0, 5, 15, 25, 40][cleared] * level());
        Scorex.hud({ score, status: `LEVEL ${level()}` });
      }
      spawn();
    }

    function dropOne() {
      if (!collides(current.shape, current.x, current.y + 1)) current.y += 1;
      else lockPiece();
    }

    function drawCell(x, y, type, size = CELL) {
      context.fillStyle = colors[type];
      context.fillRect(x + 1, y + 1, size - 2, size - 2);
      context.fillStyle = '#ffffff35';
      context.fillRect(x + 2, y + 2, size - 4, 3);
    }

    function draw() {
      const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
      background.addColorStop(0, '#0b1d2d');
      background.addColorStop(.52, '#081727');
      background.addColorStop(1, '#0c2030');
      context.fillStyle = background;
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.fillStyle = '#10283b';
      context.fillRect(59, 134, 482, 932);
      context.strokeStyle = '#23445a';
      context.lineWidth = 1;
      context.strokeRect(59.5, 134.5, 481, 931);
      context.fillStyle = '#11283b';
      context.fillRect(BOARD_X - 1, BOARD_Y - 1, COLS * CELL + 2, ROWS * CELL + 2);
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          context.fillStyle = (row + col) % 2 === 0 ? '#142d40' : '#122a3c';
          context.fillRect(BOARD_X + col * CELL + 1, BOARD_Y + row * CELL + 1, CELL - 2, CELL - 2);
        }
      }
      context.strokeStyle = '#1d3b50';
      context.lineWidth = 1;
      for (let row = 0; row <= ROWS; row += 1) {
        context.beginPath(); context.moveTo(BOARD_X, BOARD_Y + row * CELL); context.lineTo(BOARD_X + COLS * CELL, BOARD_Y + row * CELL); context.stroke();
      }
      for (let col = 0; col <= COLS; col += 1) {
        context.beginPath(); context.moveTo(BOARD_X + col * CELL, BOARD_Y); context.lineTo(BOARD_X + col * CELL, BOARD_Y + ROWS * CELL); context.stroke();
      }
      board.forEach((row, y) => row.forEach((type, x) => { if (type) drawCell(BOARD_X + x * CELL, BOARD_Y + y * CELL, type); }));
      if (current) current.shape.forEach((row, y) => row.forEach((cell, x) => {
        if (cell) drawCell(BOARD_X + (current.x + x) * CELL, BOARD_Y + (current.y + y) * CELL, current.type);
      }));
      context.fillStyle = '#c5ddeb';
      context.font = '15px ui-monospace, monospace';
      context.fillText('CARGO LOAD', 20, 28);
      context.font = '13px system-ui, sans-serif';
      context.fillStyle = '#87a8bd';
      context.fillText('SCORE', 20, 57);
      context.fillStyle = '#e4f5ff';
      context.font = 'bold 25px ui-monospace, monospace';
      context.fillText(String(score).padStart(6, '0'), 20, 86);
      context.font = '13px system-ui, sans-serif';
      context.fillStyle = '#87a8bd';
      context.fillText('LINES', 175, 57);
      context.fillStyle = '#e4f5ff';
      context.font = 'bold 22px ui-monospace, monospace';
      context.fillText(String(lines), 175, 86);
      context.font = '13px system-ui, sans-serif';
      context.fillStyle = '#87a8bd';
      context.fillText('LOAD RATE', 270, 57);
      context.fillStyle = '#e4f5ff';
      context.font = 'bold 22px ui-monospace, monospace';
      context.fillText(`L${level()}`, 270, 86);
      context.font = '12px system-ui, sans-serif';
      context.fillStyle = '#87a8bd';
      context.fillText('NEXT', 425, 28);
      nextType && shapes[nextType].forEach((row, y) => row.forEach((cell, x) => {
        if (cell) drawCell(432 + x * 20, 38 + y * 20, nextType, 20);
      }));
      if (!hasTouchControls) {
        context.font = '11px system-ui, sans-serif';
        context.fillStyle = '#64859a';
        context.fillText('줄을 채워 화물을 정리하세요', 160, 1105);
      }
    }

    function finish() {
      if (!running) return;
      running = false;
      paused = false;
      accelerating = false;
      frame = null;
      draw();
      Scorex.hud({ score, status: 'LOAD LIMIT' });
      Scorex.gameOver({ score, durationMs: Math.max(1, Math.round(activeMs)), result: 'fail', meta: { lines, level: level() } });
    }

    function animate(now) {
      if (!running || paused) return;
      const delta = lastAt ? Math.min(50, now - lastAt) : 0;
      lastAt = now;
      activeMs += delta;
      dropAccumulator += delta;
      const interval = dropInterval() / (accelerating ? 4 : 1);
      while (dropAccumulator >= interval && running) {
        dropAccumulator -= interval;
        dropOne();
      }
      draw();
      if (running && !paused) frame = requestAnimationFrame(animate);
    }

    function act(action) {
      if (!running || paused || !current) return;
      if (action === 'left') move(-1);
      if (action === 'right') move(1);
      if (action === 'rotate') rotate();
      draw();
    }

    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('pointerdown', (event) => event.preventDefault());
      if (button.dataset.action === 'accelerate') {
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          accelerating = true;
        });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => button.addEventListener(name, () => { accelerating = false; }));
      } else {
        button.addEventListener('click', () => act(button.dataset.action));
      }
    });
    const keyActions = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'rotate', w: 'rotate', W: 'rotate', ArrowDown: 'accelerate', s: 'accelerate', S: 'accelerate', ' ': 'accelerate' };
    document.addEventListener('keydown', (event) => {
      const action = keyActions[event.key];
      if (!action || event.repeat) return;
      event.preventDefault();
      if (action === 'accelerate') accelerating = true;
      else act(action);
    });
    document.addEventListener('keyup', (event) => {
      if (keyActions[event.key] === 'accelerate') accelerating = false;
    });
    window.addEventListener('blur', () => { accelerating = false; });

    Scorex.onInit((init) => { rng = seeded(init.seed); reset(); });
    Scorex.onStart(() => {
      reset();
      running = true;
      lastAt = performance.now();
      frame = requestAnimationFrame(animate);
      Scorex.started();
      Scorex.hud({ score, status: 'LEVEL 1' });
    });
    Scorex.onPause(() => {
      if (!running || paused) return;
      paused = true;
      accelerating = false;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    });
    Scorex.onResume(() => {
      if (!running || !paused) return;
      paused = false;
      lastAt = performance.now();
      frame = requestAnimationFrame(animate);
    });
    Scorex.onDestroy(() => { running = false; accelerating = false; if (frame !== null) cancelAnimationFrame(frame); });
    Scorex.connect({ gameId: 'tetris', gameVersion: '1.0.0' });
  
