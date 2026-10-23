const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomInt, randomBytes, createHash, scryptSync, timingSafeEqual } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createGameRegistry, resolveGameAsset } = require('./lib/game-registry.js');

const host = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const port = Number(process.env.PORT || 3000);
const databasePath = process.env.DB_PATH || path.join(__dirname, 'DB', 'scorex.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
const gamesDirectory = process.env.GAMES_DIR || path.join(__dirname, 'games');
const gameRegistry = createGameRegistry({
  gamesDir: gamesDirectory,
  ttlMs: Number(process.env.GAMES_RESCAN_MS) > 0 ? Number(process.env.GAMES_RESCAN_MS) : Infinity,
  log: (message) => console.warn(message)
});
const allGameIds = () => gameRegistry.ids();
const PLAY_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DURATION_TOLERANCE_MS = 2000;
const SESSION_COOKIE = 'sx_session';
const SESSION_DAYS = 30;
const WELCOME_CREDITS = 500;
const avatars = [
  { id: 'pilot', label: '조종사', emoji: '🚀', price: 0 },
  { id: 'moon', label: '달 탐사자', emoji: '🌙', price: 120 },
  { id: 'planet', label: '행성 탐사자', emoji: '🪐', price: 180 },
  { id: 'satellite', label: '위성 통신원', emoji: '🛰️', price: 240 },
  { id: 'star', label: '항성 관측자', emoji: '🌟', price: 300 },
  { id: 'ufo', label: '미확인 비행체', emoji: '🛸', price: 360 }
];
const titles = [
  { id: 'title-orbit', label: '궤도 개척자', emoji: '✦', price: 180 },
  { id: 'title-vanguard', label: '선발대', emoji: '⚡', price: 260 },
  { id: 'title-stargazer', label: '별의 기록자', emoji: '✧', price: 340 }
];
const backgrounds = [
  { id: 'background-aurora', label: '오로라 항로', emoji: '🌌', price: 220, color: '#164c64' },
  { id: 'background-nebula', label: '성운 지대', emoji: '🪐', price: 300, color: '#493366' },
  { id: 'background-solar', label: '태양 관측소', emoji: '☀️', price: 380, color: '#614226' }
];
const shopItems = [
  { id: 'display-name', type: 'display-name', name: '닉네임 변경권', description: '점수판에 표시되는 닉네임을 변경합니다.', emoji: 'Aa', price: 250 },
  ...avatars.filter((avatar) => avatar.id !== 'pilot').map((avatar) => ({
    id: `avatar-${avatar.id}`,
    type: 'avatar',
    name: `${avatar.label} 프로필`,
    description: '점수판과 프로필에 표시할 아바타를 잠금 해제합니다.',
    emoji: avatar.emoji,
    price: avatar.price,
    avatarId: avatar.id
  })),
  ...titles.map((title) => ({
    id: title.id,
    type: 'title',
    name: title.label,
    description: '관제실 프로필과 점수판 이름 옆에 표시됩니다.',
    emoji: title.emoji,
    price: title.price,
    titleId: title.id
  })),
  ...backgrounds.map((background) => ({
    id: background.id,
    type: 'background',
    name: background.label,
    description: '점수판에서 내 크루의 순위를 돋보이게 합니다.',
    emoji: background.emoji,
    price: background.price,
    backgroundId: background.id,
    color: background.color
  }))
];
const investmentRisks = [
  {
    id: 'safe',
    name: '저위험 · 저수익',
    description: '원금 보전 확률이 높고, 손실 폭이 작습니다.',
    outcomes: [
      { id: 'full_loss', name: '전액 손실', chance: 5, multiplier: 0 },
      { id: 'partial_loss', name: '일부 손실', chance: 15, multiplier: 0.5 },
      { id: 'break_even', name: '본전', chance: 45, multiplier: 1 },
      { id: 'small_gain', name: '소량 이득', chance: 30, multiplier: 1.5 },
      { id: 'big_gain', name: '대량 이득', chance: 5, multiplier: 2 }
    ]
  },
  {
    id: 'balanced',
    name: '균형형',
    description: '손실과 수익 기회를 고르게 배분합니다.',
    outcomes: [
      { id: 'full_loss', name: '전액 손실', chance: 15, multiplier: 0 },
      { id: 'partial_loss', name: '일부 손실', chance: 20, multiplier: 0.5 },
      { id: 'break_even', name: '본전', chance: 25, multiplier: 1 },
      { id: 'small_gain', name: '소량 이득', chance: 25, multiplier: 1.5 },
      { id: 'big_gain', name: '대량 이득', chance: 15, multiplier: 2 }
    ]
  },
  {
    id: 'high',
    name: '고위험 · 고수익',
    description: '전액 손실 위험이 크지만 최고 배율이 높습니다.',
    outcomes: [
      { id: 'full_loss', name: '전액 손실', chance: 35, multiplier: 0 },
      { id: 'partial_loss', name: '일부 손실', chance: 20, multiplier: 0.5 },
      { id: 'break_even', name: '본전', chance: 10, multiplier: 1 },
      { id: 'small_gain', name: '소량 이득', chance: 15, multiplier: 1.5 },
      { id: 'big_gain', name: '대량 이득', chance: 20, multiplier: 2.5 }
    ]
  }
];
const publicFiles = new Map([
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/games/index.js', ['games/index.js', 'text/javascript; charset=utf-8']],
  ['/sdk/scorex-sdk.js', ['sdk/scorex-sdk.js', 'text/javascript; charset=utf-8']],
  ['/shell/scorex-game.js', ['shell/scorex-game.js', 'text/javascript; charset=utf-8']],
  ['/shell/game-host.js', ['shell/game-host.js', 'text/javascript; charset=utf-8']],
  ['/shell/generic-game.js', ['shell/generic-game.js', 'text/javascript; charset=utf-8']],
  ['/shell/card-art.js', ['shell/card-art.js', 'text/javascript; charset=utf-8']],
  ['/tools/harness.html', ['tools/harness.html', 'text/html; charset=utf-8']]
]);

// 이름 기반의 이전 스키마(users)는 계정 체계와 호환되지 않으므로 폐기하고 새로 만든다.
const hasLegacySchema = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
if (hasLegacySchema) {
  database.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS investment_runs;
    DROP TABLE IF EXISTS user_cosmetics;
    DROP TABLE IF EXISTS score_events;
    DROP TABLE IF EXISTS users;
  `);
}

database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login_id TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS profiles (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(nickname) BETWEEN 2 AND 16),
    avatar_id TEXT NOT NULL DEFAULT 'pilot',
    title_id TEXT NOT NULL DEFAULT '',
    background_id TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS wallets (
    account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0)
  );
  CREATE TABLE IF NOT EXISTS credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reason TEXT NOT NULL,
    ref TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS attendance_claims (
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    claim_date TEXT NOT NULL,
    reward INTEGER NOT NULL CHECK (reward BETWEEN 100 AND 500),
    claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, claim_date)
  );
  CREATE TABLE IF NOT EXISTS best_scores (
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    game TEXT NOT NULL,
    best_points INTEGER NOT NULL CHECK (best_points >= 0),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, game)
  );
  CREATE TABLE IF NOT EXISTS score_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    game TEXT NOT NULL,
    points INTEGER NOT NULL CHECK (points >= 0 AND points <= 100000),
    credits_earned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_cosmetics (
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (account_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS investment_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    stake INTEGER NOT NULL CHECK (stake > 0),
    risk TEXT NOT NULL CHECK (risk IN ('safe', 'balanced', 'high')),
    games_json TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    outcome TEXT NOT NULL DEFAULT '',
    reward INTEGER NOT NULL DEFAULT 0 CHECK (reward >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS play_sessions (
    play_id TEXT PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    game TEXT NOT NULL,
    seed INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    used_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS score_events_account_game_idx ON score_events(account_id, game);
  CREATE INDEX IF NOT EXISTS credit_ledger_account_idx ON credit_ledger(account_id, id);
  CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions(account_id);
`);

if (database.prepare('PRAGMA table_info(play_sessions)').all().some((column) => column.name === 'difficulty')) {
  database.exec('ALTER TABLE play_sessions DROP COLUMN difficulty');
}

const investmentRunsSchema = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'investment_runs'").get().sql;
if (!investmentRunsSchema.includes("'cancelled'")) {
  database.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE investment_runs RENAME TO investment_runs_legacy;
    CREATE TABLE investment_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      stake INTEGER NOT NULL CHECK (stake > 0),
      risk TEXT NOT NULL CHECK (risk IN ('safe', 'balanced', 'high')),
      games_json TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
      outcome TEXT NOT NULL DEFAULT '',
      reward INTEGER NOT NULL DEFAULT 0 CHECK (reward >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );
    INSERT INTO investment_runs (id, account_id, stake, risk, games_json, progress, status, outcome, reward, created_at, completed_at)
      SELECT id, account_id, stake, risk, games_json, progress, status, outcome, reward, created_at, completed_at
      FROM investment_runs_legacy;
    DROP TABLE investment_runs_legacy;
    COMMIT;
  `);
}

const profileSelect = `
  SELECT accounts.id, profiles.nickname, profiles.avatar_id, profiles.title_id, profiles.background_id, wallets.credits
  FROM accounts
  JOIN profiles ON profiles.account_id = accounts.id
  JOIN wallets ON wallets.account_id = accounts.id
`;
const findProfileById = database.prepare(`${profileSelect} WHERE accounts.id = ?`);
const getAllProfiles = database.prepare(`${profileSelect} ORDER BY accounts.id`);
const findAccountByLogin = database.prepare('SELECT id, password_hash, password_salt FROM accounts WHERE login_id = ?');
const findNickname = database.prepare('SELECT account_id FROM profiles WHERE nickname = ?');
const insertAccount = database.prepare('INSERT INTO accounts (login_id, password_hash, password_salt) VALUES (?, ?, ?)');
const insertProfile = database.prepare('INSERT INTO profiles (account_id, nickname) VALUES (?, ?)');
const insertWallet = database.prepare('INSERT INTO wallets (account_id, credits) VALUES (?, 0)');
const insertSession = database.prepare('INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)');
const findSession = database.prepare('SELECT account_id FROM sessions WHERE token_hash = ? AND expires_at > ?');
const deleteSession = database.prepare('DELETE FROM sessions WHERE token_hash = ?');
const deleteExpiredSessions = database.prepare('DELETE FROM sessions WHERE expires_at <= ?');
const getWalletCredits = database.prepare('SELECT credits FROM wallets WHERE account_id = ?');
const getAttendanceClaim = database.prepare('SELECT reward FROM attendance_claims WHERE account_id = ? AND claim_date = ?');
const insertLedger = database.prepare('INSERT INTO credit_ledger (account_id, delta, balance_after, reason, ref) VALUES (?, ?, ?, ?, ?)');
const insertScore = database.prepare('INSERT INTO score_events (account_id, game, points, credits_earned) VALUES (?, ?, ?, ?)');
const upsertBestScore = database.prepare(`
  INSERT INTO best_scores (account_id, game, best_points) VALUES (?, ?, ?)
  ON CONFLICT(account_id, game) DO UPDATE SET best_points = excluded.best_points, updated_at = CURRENT_TIMESTAMP
  WHERE excluded.best_points > best_scores.best_points
`);
const getAccountBests = database.prepare('SELECT game, best_points FROM best_scores WHERE account_id = ?');
const getAllBests = database.prepare('SELECT account_id, game, best_points FROM best_scores');
const getUserCosmetics = database.prepare('SELECT item_id FROM user_cosmetics WHERE account_id = ?');
const getActiveInvestment = database.prepare("SELECT * FROM investment_runs WHERE account_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1");
const getLatestInvestment = database.prepare('SELECT * FROM investment_runs WHERE account_id = ? ORDER BY id DESC LIMIT 1');
const insertPlay = database.prepare('INSERT INTO play_sessions (play_id, account_id, game, seed, started_at) VALUES (?, ?, ?, ?, ?)');
const findPlay = database.prepare('SELECT * FROM play_sessions WHERE play_id = ?');
const markPlayUsed = database.prepare('UPDATE play_sessions SET used_at = ? WHERE play_id = ? AND used_at IS NULL');
const deleteStalePlays = database.prepare('DELETE FROM play_sessions WHERE started_at < ?');

class ScoreRejection extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// 제출된 점수가 서버가 발급한 플레이 세션과 매니페스트 규칙에 맞는지 검사한다. 사용 처리는 하지 않는다.
function validatePlay(payload, points, game, accountId) {
  const manifest = gameRegistry.get(game);
  if (payload.playId === undefined || payload.playId === null) {
    if (manifest) throw new ScoreRejection('이 게임은 플레이 세션(playId)이 필요합니다.');
    return null;
  }
  const play = typeof payload.playId === 'string' ? findPlay.get(payload.playId) : null;
  const now = Date.now();
  const reject = (message, status = 400) => {
    console.warn(`[score-rejected] game=${game} account=${accountId ?? 'guest'} points=${points} reason=${message}`);
    throw new ScoreRejection(message, status);
  };
  if (!play || play.game !== game || (play.account_id ?? null) !== (accountId ?? null)) reject('유효하지 않은 플레이 세션입니다.');
  if (play.used_at !== null) reject('이미 제출된 플레이 세션입니다.', 409);
  const elapsed = now - Number(play.started_at);
  if (elapsed > PLAY_MAX_AGE_MS) reject('만료된 플레이 세션입니다.');
  if (manifest) {
    const durationMs = payload.durationMs;
    if (!Number.isInteger(durationMs) || durationMs < 0) reject('플레이 시간(durationMs) 형식이 올바르지 않습니다.');
    if (points > manifest.maxScore) reject('게임의 최대 점수를 초과했습니다.');
    if (elapsed < manifest.minDurationMs || durationMs < manifest.minDurationMs) reject('플레이 시간이 너무 짧습니다.');
    if (durationMs > elapsed + DURATION_TOLERANCE_MS) reject('보고된 플레이 시간이 실제 경과 시간보다 깁니다.');
  }
  return play;
}

function consumePlay(play) {
  if (play && markPlayUsed.run(Date.now(), play.play_id).changes !== 1) throw new ScoreRejection('이미 제출된 플레이 세션입니다.', 409);
}

function runInTransaction(work) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

// 잔액 변경은 항상 이 함수로만 하고, 변동 내역을 원장에 남긴다. 트랜잭션 안에서 호출해야 한다.
function adjustCredits(accountId, delta, reason, ref = '') {
  const updated = database.prepare('UPDATE wallets SET credits = credits + ? WHERE account_id = ? AND credits + ? >= 0')
    .run(delta, accountId, delta);
  if (updated.changes !== 1) throw new Error('보유 크레딧이 부족합니다.');
  const balance = Number(getWalletCredits.get(accountId).credits);
  insertLedger.run(accountId, delta, balance, reason, String(ref));
  return balance;
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function readSessionToken(request) {
  for (const part of (request.headers.cookie || '').split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) return value.join('=');
  }
  return null;
}

function getAuthenticatedAccountId(request) {
  const token = readSessionToken(request);
  if (!token) return null;
  return findSession.get(hashToken(token), Date.now())?.account_id ?? null;
}

function sessionCookie(request, value, maxAgeSeconds) {
  const secure = request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function startSession(request, accountId) {
  const token = randomBytes(32).toString('hex');
  deleteExpiredSessions.run(Date.now());
  insertSession.run(hashToken(token), accountId, Date.now() + SESSION_DAYS * 86400000);
  return sessionCookie(request, token, SESSION_DAYS * 86400);
}

function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) reject(new Error('요청 크기가 너무 큽니다.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('올바른 JSON 형식이 아닙니다.')); }
    });
    request.on('error', reject);
  });
}

function getTier(score) {
  if (score >= 3500) return '함장';
  if (score >= 2000) return '개척자';
  if (score >= 1000) return '항해사';
  return '훈련생';
}

function bestsToScores(rows) {
  const scores = Object.fromEntries(allGameIds().map((game) => [game, 0]));
  rows.forEach((row) => { if (row.game in scores) scores[row.game] = Number(row.best_points); });
  return scores;
}

function serializePlayer(row, scores, includeCosmetics = false) {
  const title = titles.find((option) => option.id === row.title_id);
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  return {
    id: row.id,
    name: row.nickname,
    avatarId: row.avatar_id,
    avatar: avatars.find((avatar) => avatar.id === row.avatar_id)?.emoji || avatars[0].emoji,
    titleId: row.title_id || '',
    title: title ? `${title.emoji} ${title.label}` : '',
    backgroundId: row.background_id || '',
    ...(includeCosmetics ? { ownedCosmetics: getUserCosmetics.all(row.id).map((item) => item.item_id) } : {}),
    rank: null,
    total,
    tier: getTier(total),
    credits: Number(row.credits || 0),
    scores
  };
}

function buildProfile(accountId) {
  const row = findProfileById.get(accountId);
  return serializePlayer(row, bestsToScores(getAccountBests.all(accountId)), true);
}

function loadPlayers() {
  const bestsByAccount = new Map();
  getAllBests.all().forEach((row) => {
    if (!bestsByAccount.has(row.account_id)) bestsByAccount.set(row.account_id, []);
    bestsByAccount.get(row.account_id).push(row);
  });
  const players = getAllProfiles.all().map((row) => serializePlayer(row, bestsToScores(bestsByAccount.get(row.id) || [])));
  const byScore = [...players].sort((left, right) => right.total - left.total || left.id - right.id);
  const byCredits = [...players].sort((left, right) => right.credits - left.credits || left.id - right.id);
  byScore.forEach((player, index) => { player.rank = index + 1; });
  byCredits.forEach((player, index) => { player.creditRank = index + 1; });
  return { byScore, byCredits };
}

function serializeInvestment(row) {
  if (!row) return null;
  const risk = investmentRisks.find((option) => option.id === row.risk);
  const outcome = risk?.outcomes.find((item) => item.id === row.outcome);
  return {
    id: row.id,
    stake: Number(row.stake),
    risk: row.risk,
    riskName: risk?.name || '',
    outcomeName: row.status === 'cancelled' ? '투자 취소' : outcome?.name || '',
    multiplier: row.status === 'cancelled' ? null : outcome?.multiplier ?? null,
    net: Number(row.reward) - Number(row.stake),
    games: JSON.parse(row.games_json),
    progress: Number(row.progress),
    status: row.status,
    outcome: row.outcome,
    reward: Number(row.reward)
  };
}

function serializeInvestmentSummary(row) {
  if (!row) return null;
  const risk = investmentRisks.find((option) => option.id === row.risk);
  const outcome = risk?.outcomes.find((item) => item.id === row.outcome);
  const stake = Number(row.stake);
  const reward = Number(row.reward);
  return {
    status: row.status,
    stake,
    reward,
    riskName: risk?.name || '',
    outcomeName: row.status === 'cancelled' ? '투자 취소' : outcome?.name || '',
    multiplier: row.status === 'cancelled' ? null : outcome?.multiplier ?? null,
    net: reward - stake,
    progress: Number(row.progress),
    gameCount: JSON.parse(row.games_json).length
  };
}

function chooseOutcome(riskId) {
  const risk = investmentRisks.find((option) => option.id === riskId);
  const draw = randomInt(100);
  let threshold = 0;
  return risk.outcomes.find((outcome) => {
    threshold += outcome.chance;
    return draw < threshold;
  });
}

function shuffledGames() {
  const result = gameRegistry.ids();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result.slice(0, randomInt(3, 6));
}

function validateNickname(value) {
  const nickname = typeof value === 'string' ? value.trim() : '';
  return nickname.length >= 2 && nickname.length <= 16 ? nickname : null;
}

function getAttendanceDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function handleApi(request, response, url) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { status: 'ok', database: 'sqlite' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/register') {
    const payload = await readJson(request);
    const loginId = typeof payload.loginId === 'string' ? payload.loginId.trim() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';
    const nickname = validateNickname(payload.nickname);
    if (!/^[A-Za-z0-9_]{4,20}$/.test(loginId)) {
      sendJson(response, 400, { error: '아이디는 영문, 숫자, 밑줄(_) 4~20자로 입력해 주세요.' });
      return;
    }
    if (password.length < 8 || password.length > 64) {
      sendJson(response, 400, { error: '비밀번호는 8자 이상 64자 이하로 입력해 주세요.' });
      return;
    }
    if (!nickname) {
      sendJson(response, 400, { error: '닉네임은 2자 이상 16자 이하로 입력해 주세요.' });
      return;
    }
    const salt = randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const created = runInTransaction(() => {
      if (findAccountByLogin.get(loginId)) return { error: '이미 사용 중인 아이디입니다.' };
      if (findNickname.get(nickname)) return { error: '이미 사용 중인 닉네임입니다.' };
      const accountId = Number(insertAccount.run(loginId, passwordHash, salt).lastInsertRowid);
      insertProfile.run(accountId, nickname);
      insertWallet.run(accountId);
      adjustCredits(accountId, WELCOME_CREDITS, 'welcome');
      return { accountId };
    });
    if (created.error) {
      sendJson(response, 409, { error: created.error });
      return;
    }
    sendJson(response, 201, { user: buildProfile(created.accountId) }, { 'Set-Cookie': startSession(request, created.accountId) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const payload = await readJson(request);
    const loginId = typeof payload.loginId === 'string' ? payload.loginId.trim() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';
    const account = loginId && password.length <= 64 ? findAccountByLogin.get(loginId) : null;
    if (!account || !verifyPassword(password, account.password_salt, account.password_hash)) {
      sendJson(response, 401, { error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }
    sendJson(response, 200, { user: buildProfile(account.id) }, { 'Set-Cookie': startSession(request, account.id) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = readSessionToken(request);
    if (token) deleteSession.run(hashToken(token));
    sendJson(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    const accountId = getAuthenticatedAccountId(request);
    sendJson(response, 200, { user: accountId ? buildProfile(accountId) : null });
    return;
  }

  if ((request.method === 'GET' && url.pathname === '/api/attendance/status') ||
      (request.method === 'POST' && url.pathname === '/api/attendance/claim')) {
    const accountId = getAuthenticatedAccountId(request);
    if (!accountId) {
      sendJson(response, 401, { error: '로그인이 필요합니다.' });
      return;
    }
    const claimDate = getAttendanceDate();
    if (request.method === 'GET') {
      const claim = getAttendanceClaim.get(accountId, claimDate);
      sendJson(response, 200, { date: claimDate, eligible: !claim });
      return;
    }
    const claim = runInTransaction(() => {
      if (getAttendanceClaim.get(accountId, claimDate)) {
        return { status: 409, error: '오늘 출석 보상은 이미 받았습니다.' };
      }
      const reward = randomInt(100, 501);
      database.prepare('INSERT INTO attendance_claims (account_id, claim_date, reward) VALUES (?, ?, ?)')
        .run(accountId, claimDate, reward);
      const credits = adjustCredits(accountId, reward, 'attendance_daily', claimDate);
      return { reward, credits, date: claimDate };
    });
    if (claim.error) {
      sendJson(response, claim.status, { error: claim.error });
      return;
    }
    sendJson(response, 200, claim);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/shop/items') {
    sendJson(response, 200, { items: shopItems });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/investment/options') {
    sendJson(response, 200, {
      options: investmentRisks,
      recommendation: investmentRisks[randomInt(investmentRisks.length)].id
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
    const { byScore, byCredits } = loadPlayers();
    const accountId = getAuthenticatedAccountId(request);
    const currentUser = accountId ? byScore.find((player) => player.id === accountId) || null : null;
    if (currentUser) currentUser.ownedCosmetics = getUserCosmetics.all(currentUser.id).map((item) => item.item_id);
    sendJson(response, 200, {
      players: byScore.slice(0, 10),
      creditPlayers: byCredits.slice(0, 10).map((player) => ({
        ...player,
        rank: player.creditRank,
        latestInvestment: serializeInvestmentSummary(getLatestInvestment.get(player.id))
      })),
      currentUser
    });
    return;
  }

  const gameLeaderboardMatch = /^\/api\/leaderboard\/games\/([a-z][a-z0-9_]{1,31})$/.exec(url.pathname);
  if (request.method === 'GET' && gameLeaderboardMatch) {
    const game = gameLeaderboardMatch[1];
    if (!gameRegistry.get(game)) {
      sendJson(response, 404, { error: '알 수 없는 게임입니다.' });
      return;
    }
    const accountId = getAuthenticatedAccountId(request);
    const players = loadPlayers().byScore
      .filter((player) => player.scores[game] > 0)
      .sort((left, right) => right.scores[game] - left.scores[game] || left.id - right.id)
      .map((player, index) => ({
        rank: index + 1,
        isCurrentUser: player.id === accountId,
        name: player.name,
        avatar: player.avatar,
        title: player.title,
        backgroundId: player.backgroundId,
        score: player.scores[game]
      }));
    sendJson(response, 200, { game, players });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/games') {
    const games = gameRegistry.list().map((manifest) => ({
      ...manifest,
      adapter: fs.existsSync(path.join(gamesDirectory, `${manifest.id}.js`))
    }));
    sendJson(response, 200, { protocol: 1, games });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/plays') {
    const payload = await readJson(request);
    const manifest = gameRegistry.get(payload.game);
    if (!manifest) {
      sendJson(response, 400, { error: '알 수 없는 게임입니다.' });
      return;
    }
    const playId = randomBytes(16).toString('hex');
    const seed = randomInt(1, 2 ** 31);
    const now = Date.now();
    deleteStalePlays.run(now - PLAY_MAX_AGE_MS);
    insertPlay.run(playId, getAuthenticatedAccountId(request), payload.game, seed, now);
    sendJson(response, 201, { playId, game: payload.game, seed, startedAt: now });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/scores') {
    const payload = await readJson(request);
    const points = Number(payload.points);
    if (!allGameIds().includes(payload.game) || !Number.isInteger(points) || points < 0 || points > 100000) {
      sendJson(response, 400, { error: '게임 점수 정보가 올바르지 않습니다.' });
      return;
    }
    const creditsEarned = Math.max(1, Math.floor(points / 100));
    const accountId = getAuthenticatedAccountId(request);
    const play = validatePlay(payload, points, payload.game, accountId);
    if (!accountId) {
      // 게스트 플레이: 결과 연출용 값만 돌려주고 아무것도 저장하지 않는다.
      runInTransaction(() => consumePlay(play));
      sendJson(response, 200, { saved: false, guest: true, score: points, creditsEarned, reroll: null, investment: null });
      return;
    }
    let investment = null;
    let reroll = null;
    const outcome = runInTransaction(() => {
      consumePlay(play);
      const previousBest = Number(getAccountBests.all(accountId).find((row) => row.game === payload.game)?.best_points || 0);
      const scoreId = Number(insertScore.run(accountId, payload.game, points, creditsEarned).lastInsertRowid);
      if (points > previousBest) upsertBestScore.run(accountId, payload.game, points);
      adjustCredits(accountId, creditsEarned, 'mission_reward', `score:${scoreId}`);
      const activeRun = getActiveInvestment.get(accountId);
      investment = serializeInvestment(activeRun);
      if (activeRun) {
        const sequence = JSON.parse(activeRun.games_json);
        if (sequence[Number(activeRun.progress)] === payload.game) {
          const nextProgress = Number(activeRun.progress) + 1;
          if (nextProgress === sequence.length) {
            const result = chooseOutcome(activeRun.risk);
            const reward = Math.floor(Number(activeRun.stake) * result.multiplier);
            database.prepare(`
              UPDATE investment_runs
              SET progress = ?, status = 'completed', outcome = ?, reward = ?, completed_at = CURRENT_TIMESTAMP
              WHERE id = ? AND status = 'active'
            `).run(nextProgress, result.id, reward, activeRun.id);
            if (reward > 0) adjustCredits(accountId, reward, 'investment_payout', `run:${activeRun.id}`);
            investment = {
              ...serializeInvestment({ ...activeRun, progress: nextProgress, status: 'completed', outcome: result.id, reward }),
              outcomeName: result.name,
              multiplier: result.multiplier
            };
          } else {
            database.prepare("UPDATE investment_runs SET progress = ? WHERE id = ? AND status = 'active'")
              .run(nextProgress, activeRun.id);
            investment = serializeInvestment({ ...activeRun, progress: nextProgress });
          }
        }
      } else {
        reroll = investmentRisks[randomInt(investmentRisks.length)].id;
      }
      return { previousBest };
    });
    const scores = bestsToScores(getAccountBests.all(accountId));
    const totalBestScore = Object.values(scores).reduce((sum, value) => sum + value, 0);
    sendJson(response, 201, {
      saved: true,
      score: points,
      creditsEarned,
      credits: Number(getWalletCredits.get(accountId).credits),
      bestScore: scores[payload.game],
      isNewBest: points > outcome.previousBest,
      totalBestScore,
      tier: getTier(totalBestScore),
      investment,
      reroll
    });
    return;
  }

  // 이 아래의 API는 로그인한 계정만 사용할 수 있다.
  const accountId = getAuthenticatedAccountId(request);
  if (!accountId) {
    sendJson(response, 401, { error: '로그인이 필요합니다.' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/investment/active') {
    sendJson(response, 200, { run: serializeInvestment(getActiveInvestment.get(accountId)) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/investment/cancel') {
    const cancelled = runInTransaction(() => {
      const run = getActiveInvestment.get(accountId);
      if (!run) return { error: '취소할 진행 중인 투자가 없습니다.' };
      const refund = Math.floor(Number(run.stake) / 2);
      const updated = database.prepare(`
        UPDATE investment_runs
        SET status = 'cancelled', outcome = 'cancelled', reward = ?, completed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active'
      `).run(refund, run.id);
      if (updated.changes !== 1) return { error: '투자 상태가 변경되어 취소할 수 없습니다.' };
      if (refund > 0) adjustCredits(accountId, refund, 'investment_cancel_refund', `run:${run.id}`);
      return {
        run: serializeInvestment(database.prepare('SELECT * FROM investment_runs WHERE id = ?').get(run.id)),
        refund,
        credits: Number(getWalletCredits.get(accountId).credits)
      };
    });
    if (cancelled.error) {
      sendJson(response, 409, { error: cancelled.error });
      return;
    }
    sendJson(response, 200, cancelled);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/investment/start') {
    const payload = await readJson(request);
    const stake = Number(payload.stake);
    const risk = investmentRisks.find((option) => option.id === payload.risk);
    if (!Number.isInteger(stake) || stake < 1) {
      sendJson(response, 400, { error: '투자 재화는 1 CR 이상 입력해 주세요.' });
      return;
    }
    if (!risk) {
      sendJson(response, 400, { error: '투자 위험 옵션이 올바르지 않습니다.' });
      return;
    }
    const started = runInTransaction(() => {
      if (getActiveInvestment.get(accountId)) return { status: 409, error: '진행 중인 투자 임무를 먼저 완료해 주세요.' };
      if (Number(getWalletCredits.get(accountId).credits) < stake) {
        return { status: 400, error: '보유 크레딧보다 큰 금액은 투자할 수 없습니다.' };
      }
      const runId = Number(database.prepare('INSERT INTO investment_runs (account_id, stake, risk, games_json) VALUES (?, ?, ?, ?)')
        .run(accountId, stake, risk.id, JSON.stringify(shuffledGames())).lastInsertRowid);
      adjustCredits(accountId, -stake, 'investment_stake', `run:${runId}`);
      return { runId };
    });
    if (started.error) {
      sendJson(response, started.status, { error: started.error });
      return;
    }
    sendJson(response, 201, {
      run: serializeInvestment(database.prepare('SELECT * FROM investment_runs WHERE id = ?').get(started.runId)),
      credits: Number(getWalletCredits.get(accountId).credits)
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/shop/purchase') {
    const payload = await readJson(request);
    const item = shopItems.find((shopItem) => shopItem.id === payload.itemId);
    if (!item) {
      sendJson(response, 400, { error: '상점 상품을 찾을 수 없습니다.' });
      return;
    }
    let nickname = '';
    if (item.type === 'display-name') {
      nickname = validateNickname(payload.displayName);
      if (!nickname) {
        sendJson(response, 400, { error: '닉네임은 2자 이상 16자 이하로 입력해 주세요.' });
        return;
      }
    }
    const purchase = runInTransaction(() => {
      if (item.type === 'display-name') {
        const holder = findNickname.get(nickname);
        if (holder && holder.account_id === accountId) return { status: 400, error: '현재 사용 중인 닉네임입니다.' };
        if (holder) return { status: 409, error: '이미 사용 중인 닉네임입니다.' };
      } else if (getUserCosmetics.all(accountId).some((owned) => owned.item_id === item.id)) {
        return { status: 409, error: '이미 보유한 아이템입니다.' };
      }
      if (Number(getWalletCredits.get(accountId).credits) < item.price) {
        return { status: 400, error: '보유 크레딧이 부족합니다.' };
      }
      adjustCredits(accountId, -item.price, 'shop_purchase', item.id);
      if (item.type === 'display-name') {
        database.prepare('UPDATE profiles SET nickname = ? WHERE account_id = ?').run(nickname, accountId);
      } else {
        database.prepare('INSERT INTO user_cosmetics (account_id, item_id) VALUES (?, ?)').run(accountId, item.id);
      }
      return {};
    });
    if (purchase.error) {
      sendJson(response, purchase.status, { error: purchase.error });
      return;
    }
    sendJson(response, 200, { purchased: item.id, profile: buildProfile(accountId) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/profile/equip') {
    const payload = await readJson(request);
    const item = shopItems.find((option) => option.id === payload.itemId && option.type !== 'display-name');
    if (!item || !getUserCosmetics.all(accountId).some((owned) => owned.item_id === item.id)) {
      sendJson(response, 403, { error: '해당 아이템을 먼저 구매해 주세요.' });
      return;
    }
    const equippedColumn = { avatar: 'avatar_id', title: 'title_id', background: 'background_id' }[item.type];
    const equippedValue = item.avatarId || item.titleId || item.backgroundId;
    database.prepare(`UPDATE profiles SET ${equippedColumn} = ? WHERE account_id = ?`).run(equippedValue, accountId);
    sendJson(response, 200, { profile: buildProfile(accountId) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/profile/avatar') {
    const payload = await readJson(request);
    const avatar = avatars.find((option) => option.id === payload.avatarId);
    if (!avatar || (avatar.id !== 'pilot' && !getUserCosmetics.all(accountId).some((owned) => owned.item_id === `avatar-${avatar.id}`))) {
      sendJson(response, 403, { error: '해당 프로필 아이콘을 먼저 구매해 주세요.' });
      return;
    }
    database.prepare('UPDATE profiles SET avatar_id = ? WHERE account_id = ?').run(avatar.id, accountId);
    sendJson(response, 200, { profile: buildProfile(accountId) });
    return;
  }

  sendJson(response, 404, { error: '요청한 API를 찾을 수 없습니다.' });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  if (url.pathname.startsWith('/api/')) {
    try { await handleApi(request, response, url); } catch (error) {
      if (!response.headersSent) sendJson(response, error.status || 400, { error: error.message || '요청을 처리하지 못했습니다.' });
      else response.destroy();
    }
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const gameAsset = resolveGameAsset(gamesDirectory, gameRegistry, pathname);
  if (gameAsset) {
    // sandbox iframe의 출처는 null 이므로 게임 에셋은 CORS를 허용해야 한다.
    fs.readFile(gameAsset.filePath, (error, contents) => {
      if (error) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': gameAsset.contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff'
      });
      response.end(request.method === 'HEAD' ? undefined : contents);
    });
    return;
  }
  // 화면 어댑터(games/<id>.js)는 저장소의 최상위 파일만 제공합니다. 외부 게임 폴더 안의 스크립트는 iframe 안에서만 실행됩니다.
  const adapterMatch = /^\/games\/([a-z][a-z0-9_]{1,31})\.js$/.exec(pathname);
  const gameModule = adapterMatch && gameRegistry.get(adapterMatch[1]) && fs.existsSync(path.join(gamesDirectory, `${adapterMatch[1]}.js`))
    ? { id: adapterMatch[1] }
    : null;
  const asset = publicFiles.get(pathname) || (gameModule
    ? [`games/${gameModule.id}.js`, 'text/javascript; charset=utf-8']
    : null);
  if (!asset) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const [fileName, contentType] = asset;
  fs.readFile(path.join(__dirname, fileName), (error, contents) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Unable to read application file');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : contents);
  });
});

server.listen(port, host, () => {
  console.log(`Playground running at http://${host}:${port}`);
  console.log(`SQLite database: ${databasePath}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
