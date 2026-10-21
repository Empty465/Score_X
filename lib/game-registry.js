const fs = require('node:fs');
const path = require('node:path');

const ID_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;
const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD'];
const INPUTS = ['keyboard', 'pointer', 'touch'];
const HUD_KEYS = ['time', 'score', 'lives', 'progress', 'combo', 'status'];
const MAX_SCORE_LIMIT = 100000;
const SUPPORTED_PROTOCOL = 1;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function text(value, name, max) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new Error(`${name}은(는) 1~${max}자의 문자열이어야 합니다.`);
  }
  return value;
}

function subset(value, allowed, fallback, name) {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => !allowed.includes(item)) || new Set(value).size !== value.length) {
    throw new Error(`${name}은(는) ${allowed.join(', ')} 중에서 중복 없이 선택해야 합니다.`);
  }
  return value;
}

function integer(value, name, min, max, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name}은(는) ${min}~${max} 사이의 정수여야 합니다.`);
  return value;
}

// 매니페스트 원본을 검증하고 공개용으로 정규화한다. 잘못되면 사유와 함께 예외를 던진다.
function normalizeManifest(raw, folderName) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('manifest.json은 객체여야 합니다.');
  if (!ID_PATTERN.test(folderName)) throw new Error('폴더 이름은 ^[a-z][a-z0-9_]{1,31}$ 형식이어야 합니다.');
  if (raw.id !== folderName) throw new Error('id가 폴더 이름과 다릅니다.');
  if (raw.protocol !== SUPPORTED_PROTOCOL) throw new Error(`지원하지 않는 protocol 버전입니다. (지원: ${SUPPORTED_PROTOCOL})`);
  const aspectRatio = raw.aspectRatio === undefined ? '16:9' : raw.aspectRatio;
  if (typeof aspectRatio !== 'string' || !/^[1-9]\d?:[1-9]\d?$/.test(aspectRatio)) throw new Error('aspectRatio는 "16:9" 형식이어야 합니다.');
  let thumbnail = null;
  if (raw.thumbnail !== undefined) {
    if (typeof raw.thumbnail !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,63}$/.test(raw.thumbnail) || raw.thumbnail.includes('..')) {
      throw new Error('thumbnail은 폴더 안의 파일 이름이어야 합니다.');
    }
    thumbnail = raw.thumbnail;
  }
  const authors = raw.authors === undefined ? [] : raw.authors;
  if (!Array.isArray(authors) || authors.length > 10 || authors.some((author) => typeof author !== 'string' || author.length > 40)) {
    throw new Error('authors는 문자열 배열(최대 10개)이어야 합니다.');
  }
  return {
    id: raw.id,
    protocol: raw.protocol,
    title: text(raw.title, 'title', 40),
    shortTitle: text(raw.shortTitle, 'shortTitle', 12),
    category: text(raw.category, 'category', 40),
    description: text(raw.description, 'description', 200),
    icon: text(raw.icon, 'icon', 8),
    thumbnail,
    difficulties: subset(raw.difficulties, DIFFICULTIES, ['NORMAL'], 'difficulties'),
    maxScore: integer(raw.maxScore, 'maxScore', 1, MAX_SCORE_LIMIT),
    minDurationMs: integer(raw.minDurationMs, 'minDurationMs', 0, 3600000, 0),
    aspectRatio,
    input: subset(raw.input, INPUTS, ['keyboard'], 'input'),
    hud: subset(raw.hud, HUD_KEYS, [], 'hud'),
    version: raw.version === undefined ? '0.0.0' : text(raw.version, 'version', 20),
    authors,
    entry: `/games/${folderName}/index.html`
  };
}

// games/<id>/manifest.json 을 읽어 게임 목록을 만든다. 기본은 첫 요청 때 한 번만 스캔하고,
// ttlMs를 지정하면 그 주기마다 다시 읽어 재시작 없이 게임을 추가·제거할 수 있다(개발·창작마당용).
function createGameRegistry({ gamesDir, reservedIds = [], ttlMs = Infinity, log = () => {} }) {
  let cache = new Map();
  let scannedAt = 0;
  const reported = new Set();

  function report(key, message) {
    if (reported.has(key)) return;
    reported.add(key);
    log(message);
  }

  function scan() {
    const found = new Map();
    let entries = [];
    try { entries = fs.readdirSync(gamesDir, { withFileTypes: true }); } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(gamesDir, entry.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = normalizeManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), entry.name);
        if (reservedIds.includes(manifest.id)) throw new Error('기존 게임 ID와 충돌합니다.');
        if (!fs.existsSync(path.join(gamesDir, entry.name, 'index.html'))) throw new Error('index.html이 없습니다.');
        found.set(manifest.id, manifest);
      } catch (error) {
        report(`bad:${entry.name}:${error.message}`, `[games] ${entry.name} 제외: ${error.message}`);
      }
    }
    return found;
  }

  function refresh() {
    const now = Date.now();
    if (scannedAt === 0 || now - scannedAt >= ttlMs) {
      cache = scan();
      scannedAt = now;
    }
    return cache;
  }

  return {
    list: () => [...refresh().values()],
    get: (id) => refresh().get(id) || null,
    ids: () => [...refresh().keys()]
  };
}

// /games/<id>/<파일> 요청을 폴더 안의 실제 파일로 변환한다. 허용되지 않으면 null.
function resolveGameAsset(gamesDir, registry, pathname) {
  const match = /^\/games\/([a-z][a-z0-9_]{1,31})\/(.+)$/.exec(pathname);
  if (!match || !registry.get(match[1])) return null;
  let relative;
  try { relative = decodeURIComponent(match[2]); } catch { return null; }
  if (relative.includes('\0') || relative.includes('\\')) return null;
  const segments = relative.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..' || segment.startsWith('.'))) return null;
  const contentType = MIME_TYPES[path.extname(relative).toLowerCase()];
  if (!contentType) return null;
  const root = path.resolve(gamesDir, match[1]);
  const filePath = path.resolve(root, ...segments);
  if (!filePath.startsWith(root + path.sep)) return null;
  return { filePath, contentType };
}

module.exports = { createGameRegistry, normalizeManifest, resolveGameAsset, DIFFICULTIES, SUPPORTED_PROTOCOL };
