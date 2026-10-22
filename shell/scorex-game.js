/*
 * <scorex-game game-id="clop"> — 미니게임 iframe을 생성하고 postMessage 프로토콜(v1)로 통신하는 Web Component.
 * 명세: MINIGAME_PROTOCOL.md
 *
 * 사용:
 *   const el = document.createElement('scorex-game');
 *   el.setAttribute('game-id', 'clop');
 *   el.addEventListener('scorex-hud', (e) => ...e.detail.items);
 *   el.addEventListener('scorex-gameover', (e) => ...e.detail);   // { playId, score, durationMs, result, meta }
 *   container.append(el);
 *   await el.whenReady();
 *   await el.play('NORMAL');
 *
 * 점수 제출은 이 컴포넌트가 하지 않습니다. Shell이 scorex-gameover 이벤트를 받아 서버에 제출합니다.
 */
const PROTOCOL = 'scorex';
const VERSION = 1;
const READY_TIMEOUT_MS = 10000;
const DESTROY_TIMEOUT_MS = 2000;
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_META_BYTES = 1024;
const HUD_MIN_INTERVAL_MS = 100;
const RESULTS = ['clear', 'fail', 'timeout', 'quit'];

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host { display: block; width: 100%; }
    .frame { position: relative; width: 100%; aspect-ratio: var(--ratio, 16 / 9); background: #050b14; border-radius: 6px; overflow: hidden; }
    iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #050b14; }
    .overlay { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; padding: 16px;
      text-align: center; color: #cfe3f5; font: 13px/1.5 system-ui, sans-serif; background: #050b14e6; }
    .overlay.is-visible { display: flex; }
    .overlay.is-error { color: #ff8f8f; }
  </style>
  <div class="frame" part="frame">
    <div class="overlay" part="overlay" role="status" aria-live="polite"></div>
  </div>
`;

function envelope(type, payload = {}) {
  envelope.counter = (envelope.counter || 0) + 1;
  return { protocol: PROTOCOL, v: VERSION, id: `s-${envelope.counter}`, type, payload };
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

class ScorexGame extends HTMLElement {
  static get observedAttributes() { return ['game-id']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(template.content.cloneNode(true));
    this.frame = this.shadowRoot.querySelector('.frame');
    this.overlay = this.shadowRoot.querySelector('.overlay');
    this.manifest = null; // 외부에서 직접 지정하면 /api/games 조회를 건너뜁니다 (하니스용)
    this.playProvider = null; // async (game) => ({ playId, seed }); 지정하지 않으면 POST /api/plays
    this.user = { nickname: null, guest: true };
    this.theme = 'dark';
    this.state = 'idle';
    this._iframe = null;
    this._port = null;
    this._play = null;
    this._readyWaiters = [];
    this._destroyWaiter = null;
    this._timers = new Map();
    this._lastHudAt = 0;
    this._autoPaused = false;
    this._onWindowMessage = (event) => this._handleHandshake(event);
    this._onVisibility = () => this._handleVisibility();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'game-id' && this.isConnected && oldValue !== newValue) this.load();
  }

  connectedCallback() {
    if (this.getAttribute('game-id') && this.state === 'idle') this.load();
  }

  disconnectedCallback() { this._teardown(); }

  get gameId() { return this.getAttribute('game-id'); }

  whenReady() {
    if (['ready', 'prepared', 'playing', 'paused', 'over'].includes(this.state)) return Promise.resolve();
    if (this.state === 'error' || this.state === 'destroyed') return Promise.reject(new Error('게임을 사용할 수 없는 상태입니다.'));
    return new Promise((resolve, reject) => this._readyWaiters.push({ resolve, reject }));
  }

  async load() {
    this._teardown();
    this._setState('loading');
    this._showOverlay('게임을 불러오는 중...');
    try {
      const manifest = this.manifest || await this._fetchManifest();
      this.manifest = manifest;
      this.frame.style.setProperty('--ratio', String(manifest.aspectRatio || '16:9').replace(':', ' / '));
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.setAttribute('title', manifest.title);
      this._iframe = iframe;
      window.addEventListener('message', this._onWindowMessage);
      document.addEventListener('visibilitychange', this._onVisibility);
      this._observeSize(iframe);
      this._later(() => this._fail('LOAD_FAILED', '게임이 제한 시간 안에 준비되지 않았습니다.'), READY_TIMEOUT_MS, 'ready');
      iframe.src = manifest.entry;
      this.frame.prepend(iframe);
    } catch (error) {
      this._fail('LOAD_FAILED', error.message || '게임을 불러오지 못했습니다.');
    }
  }

  async prepare() {
    this._requireState(['ready', 'over', 'prepared'], 'prepare');
    const play = await (this.playProvider ? this.playProvider(this.manifest.id) : this._requestPlay());
    if (!isObject(play) || typeof play.playId !== 'string' || !Number.isInteger(play.seed)) throw new Error('플레이 세션 정보가 올바르지 않습니다.');
    // 비동기 대기 중에 컴포넌트가 정리되었을 수 있다.
    this._requireState(['ready', 'over', 'prepared'], 'prepare');
    this._play = { playId: play.playId, seed: play.seed, finished: false };
    const rect = this._iframe.getBoundingClientRect();
    this._send('init', {
      playId: this._play.playId,
      seed: this._play.seed,
      locale: navigator.language || 'ko-KR',
      theme: this.theme,
      viewport: { width: Math.round(rect.width), height: Math.round(rect.height) },
      user: { nickname: this.user.nickname ?? null, guest: Boolean(this.user.guest) }
    });
    this._setState('prepared');
    this._emit('scorex-prepared', { playId: this._play.playId, seed: this._play.seed });
    return this._play;
  }

  start() {
    this._requireState(['prepared'], 'start');
    this._send('start');
    this._setState('playing');
    // 키보드 입력이 iframe 안의 게임으로 전달되도록 포커스를 넘긴다.
    this._iframe?.focus();
  }

  async play() {
    await this.whenReady();
    await this.prepare();
    this.start();
  }

  pause() {
    if (this.state !== 'playing') return;
    this._send('pause');
    this._setState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this._send('resume');
    this._setState('playing');
  }

  async destroy() {
    if (this.state === 'destroyed') return;
    if (this._port && this._iframe) {
      const acknowledged = new Promise((resolve) => { this._destroyWaiter = resolve; });
      const timeout = new Promise((resolve) => this._later(resolve, DESTROY_TIMEOUT_MS, 'destroy'));
      this._send('destroy');
      await Promise.race([acknowledged, timeout]);
    }
    this._teardown();
    this._setState('destroyed');
  }

  _setState(state) {
    this.state = state;
    this.dataset.state = state;
    if (state === 'ready') {
      this._hideOverlay();
      this._readyWaiters.splice(0).forEach((waiter) => waiter.resolve());
    }
  }

  _requireState(allowed, action) {
    if (!allowed.includes(this.state)) throw new Error(`${action}은(는) '${this.state}' 상태에서 호출할 수 없습니다.`);
  }

  async _fetchManifest() {
    const base = this.getAttribute('api-base') || '';
    const response = await fetch(`${base}/api/games`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('게임 목록을 불러오지 못했습니다.');
    const body = await response.json();
    const manifest = (body.games || []).find((game) => game.id === this.gameId);
    if (!manifest) throw new Error(`등록되지 않은 게임입니다: ${this.gameId}`);
    return manifest;
  }

  async _requestPlay() {
    const base = this.getAttribute('api-base') || '';
    const response = await fetch(`${base}/api/plays`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: this.manifest.id })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || '플레이 세션을 발급받지 못했습니다.');
    return body;
  }

  _later(callback, ms, key) {
    const timer = setTimeout(() => { this._timers.delete(timer); callback(); }, ms);
    this._timers.set(timer, key);
    return timer;
  }

  _clearTimer(key) {
    for (const [timer, timerKey] of this._timers) {
      if (timerKey === key) { clearTimeout(timer); this._timers.delete(timer); }
    }
  }

  _observeSize(iframe) {
    if (typeof ResizeObserver === 'undefined') return;
    this._resizeObserver = new ResizeObserver(() => {
      if (!this._port) return;
      const rect = iframe.getBoundingClientRect();
      this._send('resize', { width: Math.round(rect.width), height: Math.round(rect.height) });
    });
    this._resizeObserver.observe(iframe);
  }

  _handleVisibility() {
    if (document.hidden && this.state === 'playing') {
      this._autoPaused = true;
      this.pause();
    } else if (!document.hidden && this._autoPaused) {
      this._autoPaused = false;
      this.resume();
    }
  }

  // sandbox iframe의 origin은 "null" 이므로 event.source 로 발신자를 확인하고, 이후에는 전용 포트로만 통신한다.
  _handleHandshake(event) {
    if (!this._iframe || event.source !== this._iframe.contentWindow || this._port) return;
    const message = event.data;
    if (!isObject(message) || message.protocol !== PROTOCOL || message.type !== 'hello') return;
    if (message.v !== VERSION || !isObject(message.payload) || message.payload.protocol !== VERSION) {
      this._fail('PROTOCOL_MISMATCH', '게임이 지원하는 프로토콜 버전이 맞지 않습니다.');
      return;
    }
    if (message.payload.gameId !== this.manifest.id) {
      this._fail('LOAD_FAILED', '게임 ID가 매니페스트와 일치하지 않습니다.');
      return;
    }
    const channel = new MessageChannel();
    this._port = channel.port1;
    this._port.onmessage = (portEvent) => this._handlePortMessage(portEvent.data);
    this._iframe.contentWindow.postMessage(envelope('welcome', { shellVersion: VERSION }), '*', [channel.port2]);
  }

  _handlePortMessage(message) {
    if (!isObject(message) || message.protocol !== PROTOCOL || message.v !== VERSION || typeof message.type !== 'string') return;
    let size = 0;
    try { size = JSON.stringify(message).length; } catch { return; }
    if (size > MAX_MESSAGE_BYTES) {
      console.warn('[scorex-game] 크기 초과 메시지를 무시했습니다:', message.type);
      return;
    }
    const payload = isObject(message.payload) ? message.payload : {};
    switch (message.type) {
      case 'ready':
        if (this.state !== 'loading') return;
        this._clearTimer('ready');
        this.capabilities = Array.isArray(payload.capabilities) ? payload.capabilities.filter((item) => typeof item === 'string').slice(0, 8) : [];
        this._setState('ready');
        this._emit('scorex-ready', { gameVersion: String(payload.gameVersion || '') });
        break;
      case 'started':
        if (this.state === 'playing') this._emit('scorex-started', {});
        break;
      case 'hud': this._handleHud(payload); break;
      case 'game_over': this._handleGameOver(payload); break;
      case 'destroyed':
        if (this._destroyWaiter) { this._destroyWaiter(); this._destroyWaiter = null; }
        break;
      case 'error':
        this._fail(String(payload.code || 'INTERNAL').slice(0, 32), String(payload.message || '게임에서 오류가 발생했습니다.').slice(0, 200));
        break;
      case 'request_resize': this._handleRequestResize(payload); break;
      default:
        console.warn('[scorex-game] 알 수 없는 메시지를 무시했습니다:', message.type);
    }
  }

  _handleHud(payload) {
    if (!['playing', 'paused'].includes(this.state) || !isObject(payload.items)) return;
    const now = Date.now();
    if (now - this._lastHudAt < HUD_MIN_INTERVAL_MS) return;
    this._lastHudAt = now;
    const allowed = new Set([...(this.manifest.hud || []), 'danger']);
    const items = {};
    for (const [key, value] of Object.entries(payload.items)) {
      if (!allowed.has(key)) continue;
      if (key === 'status') { if (typeof value === 'string') items.status = value.slice(0, 40); }
      else if (key === 'danger') { if (typeof value === 'boolean') items.danger = value; }
      else if (key === 'progress') { if (typeof value === 'number' && Number.isFinite(value)) items.progress = Math.min(1, Math.max(0, value)); }
      else if (typeof value === 'number' && Number.isFinite(value)) items[key] = value;
    }
    if (Object.keys(items).length > 0) this._emit('scorex-hud', { items });
  }

  _handleGameOver(payload) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    const play = this._play;
    if (!play || play.finished || payload.playId !== play.playId) return;
    const { score, durationMs, result } = payload;
    let meta = null;
    if (payload.meta !== undefined) {
      if (!isObject(payload.meta) || JSON.stringify(payload.meta).length > MAX_META_BYTES
        || Object.values(payload.meta).some((value) => !['string', 'number', 'boolean'].includes(typeof value))) {
        console.warn('[scorex-game] 잘못된 meta를 무시했습니다.');
      } else {
        meta = payload.meta;
      }
    }
    if (!Number.isInteger(score) || score < 0 || score > this.manifest.maxScore
      || !Number.isInteger(durationMs) || durationMs < 0 || !RESULTS.includes(result)) {
      this._emit('scorex-error', { code: 'INVALID_STATE', message: 'game_over 값이 올바르지 않아 무시했습니다.', fatal: false });
      return;
    }
    play.finished = true;
    this._setState('over');
    this._emit('scorex-gameover', { playId: play.playId, score, durationMs, result, meta });
  }

  _handleRequestResize(payload) {
    if (typeof payload.aspectRatio !== 'string' || !/^[1-9]\d?:[1-9]\d?$/.test(payload.aspectRatio)) return;
    const [width, height] = payload.aspectRatio.split(':').map(Number);
    const ratio = width / height;
    if (ratio < 0.5 || ratio > 3) return;
    this.frame.style.setProperty('--ratio', `${width} / ${height}`);
  }

  _send(type, payload) {
    if (!this._port) return false;
    this._port.postMessage(envelope(type, payload));
    return true;
  }

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  _showOverlay(text, isError = false) {
    this.overlay.textContent = text;
    this.overlay.classList.toggle('is-error', isError);
    this.overlay.classList.add('is-visible');
  }

  _hideOverlay() { this.overlay.classList.remove('is-visible'); }

  _fail(code, message) {
    if (this.state === 'error' || this.state === 'destroyed') return;
    this._teardown();
    this._setState('error');
    this._showOverlay(message, true);
    this._readyWaiters.splice(0).forEach((waiter) => waiter.reject(new Error(message)));
    this._emit('scorex-error', { code, message, fatal: true });
  }

  _teardown() {
    window.removeEventListener('message', this._onWindowMessage);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._timers.forEach((_key, timer) => clearTimeout(timer));
    this._timers.clear();
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    if (this._port) { this._port.onmessage = null; this._port.close(); this._port = null; }
    if (this._iframe) { this._iframe.remove(); this._iframe = null; }
    if (this._destroyWaiter) { this._destroyWaiter(); this._destroyWaiter = null; }
    this._play = null;
    this._autoPaused = false;
  }
}

if (!customElements.get('scorex-game')) customElements.define('scorex-game', ScorexGame);
export { ScorexGame };
