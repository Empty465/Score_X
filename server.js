const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const gameCatalog = require('./games/catalog.js');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const database = new DatabaseSync(path.join(__dirname, 'scores.sqlite'));
if (!Array.isArray(gameCatalog) || gameCatalog.length === 0 ||
    gameCatalog.some((game) => !/^[a-z0-9-]+$/.test(game.id) || game.module !== `./games/${game.id}.js`) ||
    new Set(gameCatalog.map((game) => game.id)).size !== gameCatalog.length) {
  throw new Error('게임 카탈로그가 비어 있거나 잘못 구성되었습니다.');
}
const games = gameCatalog.map((game) => game.id);
const gameSqlList = games.map((game) => `'${game}'`).join(', ');
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
  { id: 'display-name', type: 'display-name', name: '호출명 변경', description: '점수판에 표시되는 크루 이름을 변경합니다.', emoji: 'Aa', price: 250 },
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
  ['/games/catalog.js', ['games/catalog.js', 'text/javascript; charset=utf-8']],
  ['/node_modules/matter-js/build/matter.min.js', ['node_modules/matter-js/build/matter.min.js', 'text/javascript; charset=utf-8']]
]);

database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(name) BETWEEN 1 AND 24),
    display_name TEXT NOT NULL DEFAULT '',
    credits INTEGER NOT NULL DEFAULT 500 CHECK (credits >= 0),
    avatar_id TEXT NOT NULL DEFAULT 'pilot',
    title_id TEXT NOT NULL DEFAULT '',
    background_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS score_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL CHECK (game IN (${gameSqlList})),
    points INTEGER NOT NULL CHECK (points > 0 AND points <= 100000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_cosmetics (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS investment_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stake INTEGER NOT NULL CHECK (stake > 0),
    risk TEXT NOT NULL CHECK (risk IN ('safe', 'balanced', 'high')),
    games_json TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    outcome TEXT NOT NULL DEFAULT '',
    reward INTEGER NOT NULL DEFAULT 0 CHECK (reward >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );
`);

const userColumns = new Set(database.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
if (!userColumns.has('display_name')) database.exec("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
if (!userColumns.has('credits')) database.exec('ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 500 CHECK (credits >= 0)');
if (!userColumns.has('avatar_id')) database.exec("ALTER TABLE users ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'pilot'");
if (!userColumns.has('title_id')) database.exec("ALTER TABLE users ADD COLUMN title_id TEXT NOT NULL DEFAULT ''");
if (!userColumns.has('background_id')) database.exec("ALTER TABLE users ADD COLUMN background_id TEXT NOT NULL DEFAULT ''");
database.exec("UPDATE users SET display_name = name WHERE display_name = ''");

const scoreTable = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'score_events'").get();
if (games.some((game) => !scoreTable.sql.includes(`'${game}'`))) {
  database.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE score_events RENAME TO score_events_previous;
    CREATE TABLE score_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game TEXT NOT NULL CHECK (game IN (${gameSqlList})),
      points INTEGER NOT NULL CHECK (points > 0 AND points <= 100000),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO score_events (id, user_id, game, points, created_at)
      SELECT id, user_id, game, points, created_at FROM score_events_previous;
    DROP TABLE score_events_previous;
    COMMIT;
  `);
}
database.exec('CREATE INDEX IF NOT EXISTS score_events_user_game_idx ON score_events(user_id, game)');

const findUserByName = database.prepare('SELECT id, name, display_name, credits, avatar_id, title_id, background_id FROM users WHERE name = ?');
const findUserById = database.prepare('SELECT id, name, display_name, credits, avatar_id, title_id, background_id FROM users WHERE id = ?');
const insertUser = database.prepare('INSERT INTO users (name, display_name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING');
const insertScore = database.prepare('INSERT INTO score_events (user_id, game, points) VALUES (?, ?, ?)');
const getUserCosmetics = database.prepare('SELECT item_id FROM user_cosmetics WHERE user_id = ?');
const getActiveInvestment = database.prepare("SELECT * FROM investment_runs WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1");
const getPlayers = database.prepare(`
  SELECT
    users.id,
    users.name,
    users.display_name,
    users.credits,
    users.avatar_id,
    users.title_id,
    users.background_id,
    users.created_at,
    COALESCE(SUM(best_scores.best_points), 0) AS total,
    COALESCE(MAX(CASE WHEN best_scores.game = 'snake' THEN best_scores.best_points ELSE 0 END), 0) AS snake,
    COALESCE(MAX(CASE WHEN best_scores.game = 'memory' THEN best_scores.best_points ELSE 0 END), 0) AS memory,
    COALESCE(MAX(CASE WHEN best_scores.game = 'reaction' THEN best_scores.best_points ELSE 0 END), 0) AS reaction,
    COALESCE(MAX(CASE WHEN best_scores.game = 'mole' THEN best_scores.best_points ELSE 0 END), 0) AS mole,
    COALESCE(MAX(CASE WHEN best_scores.game = 'baseball' THEN best_scores.best_points ELSE 0 END), 0) AS baseball,
    COALESCE(MAX(CASE WHEN best_scores.game = 'rocket' THEN best_scores.best_points ELSE 0 END), 0) AS rocket
  FROM users
  LEFT JOIN (
    SELECT user_id, game, MAX(points) AS best_points
    FROM score_events
    GROUP BY user_id, game
  ) AS best_scores ON best_scores.user_id = users.id
  GROUP BY users.id
  ORDER BY total DESC, users.created_at ASC, users.id ASC
`);
const getUserBestScores = database.prepare(`
  SELECT
    COALESCE(SUM(best_scores.best_points), 0) AS total,
    COALESCE(MAX(CASE WHEN best_scores.game = 'snake' THEN best_scores.best_points ELSE 0 END), 0) AS snake,
    COALESCE(MAX(CASE WHEN best_scores.game = 'memory' THEN best_scores.best_points ELSE 0 END), 0) AS memory,
    COALESCE(MAX(CASE WHEN best_scores.game = 'reaction' THEN best_scores.best_points ELSE 0 END), 0) AS reaction,
    COALESCE(MAX(CASE WHEN best_scores.game = 'mole' THEN best_scores.best_points ELSE 0 END), 0) AS mole,
    COALESCE(MAX(CASE WHEN best_scores.game = 'baseball' THEN best_scores.best_points ELSE 0 END), 0) AS baseball,
    COALESCE(MAX(CASE WHEN best_scores.game = 'rocket' THEN best_scores.best_points ELSE 0 END), 0) AS rocket
  FROM (
    SELECT game, MAX(points) AS best_points
    FROM score_events
    WHERE user_id = ?
    GROUP BY game
  ) AS best_scores
`);

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
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

function serializePlayer(row, rank, includeCosmetics = false) {
  const title = titles.find((option) => option.id === row.title_id);
  const total = Number(row.total || 0);
  return {
    id: row.id,
    name: row.display_name || row.name,
    accountName: row.name,
    avatarId: row.avatar_id,
    avatar: avatars.find((avatar) => avatar.id === row.avatar_id)?.emoji || avatars[0].emoji,
    titleId: row.title_id || '',
    title: title ? `${title.emoji} ${title.label}` : '',
    backgroundId: row.background_id || '',
    ...(includeCosmetics ? { ownedCosmetics: getUserCosmetics.all(row.id).map((item) => item.item_id) } : {}),
    rank,
    total,
    tier: getTier(total),
    credits: Number(row.credits || 0),
    scores: Object.fromEntries(games.map((game) => [game, Number(row[game] || 0)]))
  };
}

function getTier(score) {
  if (score >= 3500) return '함장';
  if (score >= 2000) return '개척자';
  if (score >= 1000) return '항해사';
  return '훈련생';
}

function updateUserCredits(userId, credits) {
  database.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(credits, userId);
}

function serializeInvestment(row) {
  if (!row) return null;
  const risk = investmentRisks.find((option) => option.id === row.risk);
  return {
    id: row.id,
    stake: Number(row.stake),
    risk: row.risk,
    riskName: risk?.name || '',
    games: JSON.parse(row.games_json),
    progress: Number(row.progress),
    status: row.status,
    outcome: row.outcome,
    reward: Number(row.reward)
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
  const result = [...games];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result.slice(0, randomInt(3, 6));
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

  if (request.method === 'POST' && url.pathname === '/api/users') {
    const payload = await readJson(request);
    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!name || name.length > 24) {
      sendJson(response, 400, { error: '이름은 1자 이상 24자 이하로 입력해 주세요.' });
      return;
    }
    insertUser.run(name, name);
    const user = findUserByName.get(name);
    sendJson(response, 200, { user: serializePlayer({ ...user, total: 0, ...Object.fromEntries(games.map((game) => [game, 0])) }, null, true) });
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

  if (request.method === 'GET' && url.pathname === '/api/investment/active') {
    const userId = Number(url.searchParams.get('userId'));
    const user = Number.isInteger(userId) ? findUserById.get(userId) : null;
    if (!user) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    sendJson(response, 200, { run: serializeInvestment(getActiveInvestment.get(userId)) });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/investment/start') {
    const payload = await readJson(request);
    const userId = Number(payload.userId);
    const stake = Number(payload.stake);
    const risk = investmentRisks.find((option) => option.id === payload.risk);
    const user = Number.isInteger(userId) ? findUserById.get(userId) : null;
    if (!user) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    if (!Number.isInteger(stake) || stake < 1) {
      sendJson(response, 400, { error: '투자 재화는 1 CR 이상 입력해 주세요.' });
      return;
    }
    if (!risk) {
      sendJson(response, 400, { error: '투자 위험 옵션이 올바르지 않습니다.' });
      return;
    }
    if (getActiveInvestment.get(userId)) {
      sendJson(response, 409, { error: '진행 중인 투자 임무를 먼저 완료해 주세요.' });
      return;
    }
    database.exec('BEGIN IMMEDIATE');
    try {
      const debit = database.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?')
        .run(stake, userId, stake);
      if (debit.changes !== 1) throw new Error('보유 크레딧보다 큰 금액은 투자할 수 없습니다.');
      const insert = database.prepare('INSERT INTO investment_runs (user_id, stake, risk, games_json) VALUES (?, ?, ?, ?)')
        .run(userId, stake, risk.id, JSON.stringify(shuffledGames()));
      database.exec('COMMIT');
      sendJson(response, 201, {
        run: serializeInvestment(database.prepare('SELECT * FROM investment_runs WHERE id = ?').get(Number(insert.lastInsertRowid))),
        credits: Number(findUserById.get(userId).credits)
      });
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
    const rows = getPlayers.all();
    const scorePlayers = rows.map((row, index) => serializePlayer(row, index + 1));
    const creditsById = new Map(
      [...scorePlayers]
        .sort((left, right) => right.credits - left.credits || left.id - right.id)
        .map((player, index) => [player.id, index + 1])
    );
    scorePlayers.forEach((player) => { player.creditRank = creditsById.get(player.id); });
    const creditPlayers = [...scorePlayers]
      .sort((left, right) => right.credits - left.credits || left.id - right.id)
      .map((player, index) => ({ ...player, rank: index + 1 }));
    const userId = Number(url.searchParams.get('userId'));
    const currentUser = Number.isInteger(userId) ? scorePlayers.find((player) => player.id === userId) || null : null;
    if (currentUser) currentUser.ownedCosmetics = getUserCosmetics.all(currentUser.id).map((item) => item.item_id);
    sendJson(response, 200, {
      players: scorePlayers.slice(0, 10),
      creditPlayers: creditPlayers.slice(0, 10),
      currentUser
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/scores') {
    const payload = await readJson(request);
    const userId = Number(payload.userId);
    const points = Number(payload.points);
    if (!Number.isInteger(userId) || !findUserById.get(userId)) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    if (!games.includes(payload.game) || !Number.isInteger(points) || points < 0 || points > 100000) {
      sendJson(response, 400, { error: '게임 점수 정보가 올바르지 않습니다.' });
      return;
    }
    const creditsEarned = Math.max(1, Math.floor(points / 100));
    const previousBest = Number(getUserBestScores.get(userId)?.[payload.game] || 0);
    const activeRun = getActiveInvestment.get(userId);
    let investment = serializeInvestment(activeRun);
    let reroll = null;
    database.exec('BEGIN IMMEDIATE');
    try {
      if (points > 0) insertScore.run(userId, payload.game, points);
      updateUserCredits(userId, creditsEarned);
      if (activeRun) {
        const sequence = JSON.parse(activeRun.games_json);
        if (sequence[Number(activeRun.progress)] === payload.game) {
          const nextProgress = Number(activeRun.progress) + 1;
          if (nextProgress === sequence.length) {
            const outcome = chooseOutcome(activeRun.risk);
            const reward = Math.floor(Number(activeRun.stake) * outcome.multiplier);
            database.prepare(`
              UPDATE investment_runs
              SET progress = ?, status = 'completed', outcome = ?, reward = ?, completed_at = CURRENT_TIMESTAMP
              WHERE id = ? AND status = 'active'
            `).run(nextProgress, outcome.id, reward, activeRun.id);
            if (reward > 0) updateUserCredits(userId, reward);
            investment = {
              ...serializeInvestment({ ...activeRun, progress: nextProgress, status: 'completed', outcome: outcome.id, reward }),
              outcomeName: outcome.name,
              multiplier: outcome.multiplier
            };
          } else {
            database.prepare('UPDATE investment_runs SET progress = ? WHERE id = ? AND status = \'active\'')
              .run(nextProgress, activeRun.id);
            investment = serializeInvestment({ ...activeRun, progress: nextProgress });
          }
        }
      } else {
        reroll = investmentRisks[randomInt(investmentRisks.length)].id;
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    const updatedBestScores = getUserBestScores.get(userId);
    sendJson(response, 201, {
      saved: true,
      score: points,
      creditsEarned,
      credits: Number(findUserById.get(userId).credits),
      bestScore: Math.max(previousBest, points),
      isNewBest: points > previousBest,
      totalBestScore: Number(updatedBestScores.total),
      tier: getTier(Number(updatedBestScores.total)),
      investment,
      reroll
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/shop/purchase') {
    const payload = await readJson(request);
    const userId = Number(payload.userId);
    const item = shopItems.find((shopItem) => shopItem.id === payload.itemId);
    const user = Number.isInteger(userId) ? findUserById.get(userId) : null;
    if (!user) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    if (!item) {
      sendJson(response, 400, { error: '상점 상품을 찾을 수 없습니다.' });
      return;
    }
    let displayName = '';
    if (item.type === 'display-name') {
      displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
      if (!displayName || displayName.length > 24) {
        sendJson(response, 400, { error: '표시 이름은 1자 이상 24자 이하로 입력해 주세요.' });
        return;
      }
    } else if (getUserCosmetics.all(userId).some((owned) => owned.item_id === item.id)) {
      sendJson(response, 409, { error: '이미 보유한 아이템입니다.' });
      return;
    }
    if (Number(user.credits) < item.price) {
      sendJson(response, 400, { error: '보유 크레딧이 부족합니다.' });
      return;
    }

    database.exec('BEGIN IMMEDIATE');
    try {
      const debit = database.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?')
        .run(item.price, userId, item.price);
      if (debit.changes !== 1) throw new Error('보유 크레딧이 부족합니다.');
      if (item.type === 'display-name') {
        database.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName, userId);
      } else {
        database.prepare('INSERT INTO user_cosmetics (user_id, item_id) VALUES (?, ?)')
          .run(userId, item.id);
      }
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        sendJson(response, 409, { error: '이미 보유한 아이템입니다.' });
        return;
      }
      throw error;
    }
    const updated = findUserById.get(userId);
    sendJson(response, 200, {
      purchased: item.id,
      profile: serializePlayer({ ...updated, total: 0, ...Object.fromEntries(games.map((game) => [game, 0])) }, null, true)
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/profile/equip') {
    const payload = await readJson(request);
    const userId = Number(payload.userId);
    const item = shopItems.find((option) => option.id === payload.itemId && option.type !== 'display-name');
    const user = Number.isInteger(userId) ? findUserById.get(userId) : null;
    if (!user) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    if (!item || !getUserCosmetics.all(userId).some((owned) => owned.item_id === item.id)) {
      sendJson(response, 403, { error: '해당 아이템을 먼저 구매해 주세요.' });
      return;
    }
    const equippedColumn = { avatar: 'avatar_id', title: 'title_id', background: 'background_id' }[item.type];
    const equippedValue = item.avatarId || item.titleId || item.backgroundId;
    database.prepare(`UPDATE users SET ${equippedColumn} = ? WHERE id = ?`).run(equippedValue, userId);
    const updated = findUserById.get(userId);
    sendJson(response, 200, {
      profile: serializePlayer({ ...updated, total: 0, ...Object.fromEntries(games.map((game) => [game, 0])) }, null, true)
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/profile/avatar') {
    const payload = await readJson(request);
    const avatar = avatars.find((option) => option.id === payload.avatarId);
    const userId = Number(payload.userId);
    const user = Number.isInteger(userId) ? findUserById.get(userId) : null;
    if (!user) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    if (!avatar || (avatar.id !== 'pilot' && !getUserCosmetics.all(userId).some((owned) => owned.item_id === `avatar-${avatar.id}`))) {
      sendJson(response, 403, { error: '해당 프로필 아이콘을 먼저 구매해 주세요.' });
      return;
    }
    database.prepare('UPDATE users SET avatar_id = ? WHERE id = ?').run(avatar.id, userId);
    const updated = findUserById.get(userId);
    sendJson(response, 200, {
      profile: serializePlayer({ ...updated, total: 0, ...Object.fromEntries(games.map((game) => [game, 0])) }, null, true)
    });
    return;
  }

  sendJson(response, 404, { error: '요청한 API를 찾을 수 없습니다.' });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  if (url.pathname.startsWith('/api/')) {
    try { await handleApi(request, response, url); } catch (error) {
      if (!response.headersSent) sendJson(response, 400, { error: error.message || '요청을 처리하지 못했습니다.' });
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
  const gameModule = gameCatalog.find((game) => pathname === game.module.slice(1));
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
  console.log(`SQLite database: ${path.join(__dirname, 'scores.sqlite')}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);