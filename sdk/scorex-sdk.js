/*
 * Score X 미니게임 SDK (프로토콜 v1) — iframe 안의 게임에서 사용합니다.
 * 명세: MINIGAME_PROTOCOL.md
 *
 *   Scorex.onInit(({ playId, difficulty, seed, user, viewport }) => { ... });
 *   Scorex.onStart(() => { ... });
 *   Scorex.onPause(() => { ... }); Scorex.onResume(() => { ... });
 *   Scorex.onDestroy(() => { ...타이머·리스너 정리... });
 *   Scorex.connect({ gameId: 'my_game', gameVersion: '1.0.0' });
 *   Scorex.started();
 *   Scorex.hud({ time: 42, score: 120 });
 *   Scorex.gameOver({ score: 300, durationMs: 41000, result: 'clear', meta: { distance: '120m' } });
 */
(function (global) {
  'use strict';

  var PROTOCOL = 'scorex';
  var VERSION = 1;
  var MAX_MESSAGE_BYTES = 16 * 1024;
  var HUD_INTERVAL_MS = 100;
  var RESULTS = ['clear', 'fail', 'timeout', 'quit'];
  var HUD_KEYS = ['time', 'score', 'lives', 'progress', 'combo', 'status', 'danger'];

  var port = null;
  var counter = 0;
  var handlers = { init: [], start: [], pause: [], resume: [], resize: [], destroy: [] };
  var playId = null;
  var finished = false;
  var hudPending = null;
  var hudTimer = null;
  var lastHudAt = 0;
  var config = null;

  function nextId() {
    counter += 1;
    return 'g-' + counter;
  }

  function envelope(type, payload) {
    return { protocol: PROTOCOL, v: VERSION, id: nextId(), type: type, payload: payload || {} };
  }

  function send(type, payload) {
    if (!port) return false;
    var message = envelope(type, payload);
    if (JSON.stringify(message).length > MAX_MESSAGE_BYTES) {
      console.warn('[Scorex] 메시지가 너무 커서 전송하지 않았습니다:', type);
      return false;
    }
    port.postMessage(message);
    return true;
  }

  function emit(name, payload) {
    handlers[name].forEach(function (handler) {
      try { handler(payload); } catch (error) { console.error('[Scorex] ' + name + ' 핸들러 오류', error); }
    });
  }

  function onPortMessage(event) {
    var message = event.data;
    if (!message || message.protocol !== PROTOCOL || message.v !== VERSION || typeof message.type !== 'string') return;
    var payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
    switch (message.type) {
      case 'init':
        playId = typeof payload.playId === 'string' ? payload.playId : null;
        finished = false;
        emit('init', payload);
        break;
      case 'start': emit('start', payload); break;
      case 'pause': emit('pause', payload); break;
      case 'resume': emit('resume', payload); break;
      case 'resize': emit('resize', payload); break;
      case 'destroy':
        emit('destroy', payload);
        flushHud();
        send('destroyed', {});
        break;
      default: break;
    }
  }

  function onWindowMessage(event) {
    var message = event.data;
    if (event.source !== global.parent || !message || message.protocol !== PROTOCOL || message.type !== 'welcome') return;
    if (!event.ports || !event.ports[0] || port) return;
    port = event.ports[0];
    port.onmessage = onPortMessage;
    global.removeEventListener('message', onWindowMessage);
    send('ready', { gameVersion: config.gameVersion, capabilities: config.capabilities });
  }

  function flushHud() {
    if (hudTimer) { clearTimeout(hudTimer); hudTimer = null; }
    if (!hudPending) return;
    var items = hudPending;
    hudPending = null;
    lastHudAt = Date.now();
    send('hud', { items: items });
  }

  var Scorex = {
    onInit: function (handler) { handlers.init.push(handler); },
    onStart: function (handler) { handlers.start.push(handler); },
    onPause: function (handler) { handlers.pause.push(handler); },
    onResume: function (handler) { handlers.resume.push(handler); },
    onResize: function (handler) { handlers.resize.push(handler); },
    onDestroy: function (handler) { handlers.destroy.push(handler); },

    // 핸드셰이크를 시작합니다. 핸들러를 모두 등록한 뒤 한 번만 호출하세요.
    connect: function (options) {
      options = options || {};
      if (!options.gameId) throw new Error('Scorex.connect: gameId가 필요합니다.');
      config = {
        gameId: options.gameId,
        gameVersion: String(options.gameVersion || '0.0.0'),
        capabilities: options.capabilities || ['pause']
      };
      global.addEventListener('message', onWindowMessage);
      global.parent.postMessage(envelope('hello', { gameId: config.gameId, protocol: VERSION }), '*');
    },

    started: function () { return send('started', {}); },

    // 우측 패널 표시값. 초당 약 10회로 제한되며 마지막 값만 전달됩니다.
    hud: function (items) {
      var clean = {};
      Object.keys(items || {}).forEach(function (key) {
        if (HUD_KEYS.indexOf(key) !== -1) clean[key] = items[key];
      });
      hudPending = Object.assign(hudPending || {}, clean);
      var wait = HUD_INTERVAL_MS - (Date.now() - lastHudAt);
      if (wait <= 0) flushHud();
      else if (!hudTimer) hudTimer = setTimeout(flushHud, wait);
    },

    // 한 판 종료. playId당 1회만 전송됩니다.
    gameOver: function (result) {
      result = result || {};
      if (finished) return false;
      var score = Math.floor(Number(result.score));
      var durationMs = Math.floor(Number(result.durationMs));
      if (!Number.isFinite(score) || score < 0) throw new Error('Scorex.gameOver: score는 0 이상의 숫자여야 합니다.');
      if (!Number.isFinite(durationMs) || durationMs < 0) throw new Error('Scorex.gameOver: durationMs는 0 이상의 숫자여야 합니다.');
      if (RESULTS.indexOf(result.result) === -1) throw new Error('Scorex.gameOver: result는 ' + RESULTS.join(', ') + ' 중 하나여야 합니다.');
      flushHud();
      finished = true;
      return send('game_over', { playId: playId, score: score, durationMs: durationMs, result: result.result, meta: result.meta });
    },

    error: function (code, message) { return send('error', { code: code || 'INTERNAL', message: String(message || '').slice(0, 200) }); },
    requestResize: function (options) { return send('request_resize', options || {}); },
    get playId() { return playId; }
  };

  global.Scorex = Scorex;
})(window);
