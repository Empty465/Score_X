const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const database = new DatabaseSync(path.join(__dirname, 'scores.sqlite'));
const games = ['snake', 'memory', 'reaction', 'mole', 'baseball', 'rocket'];
const avatars = [
  { id: 'pilot', label: '조종사', emoji: '🚀', price: 0 },
  { id: 'moon', label: '달 탐사자', emoji: '🌙', price: 120 },
  { id: 'planet', label: '행성 탐사자', emoji: '🪐', price: 180 },
  { id: 'satellite', label: '위성 통신원', emoji: '🛰️', price: 240 },
  { id: 'star', label: '항성 관측자', emoji: '🌟', price: 300 },
  { id: 'ufo', label: '미확인 비행체', emoji: '🛸', price: 360 }
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
  }))
];
const publicFiles = new Map([
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/games/index.js', ['games/index.js', 'text/javascript; charset=utf-8']],
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS score_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL CHECK (game IN ('snake', 'memory', 'reaction', 'mole', 'baseball', 'rocket')),
    points INTEGER NOT NULL CHECK (points > 0 AND points <= 100000),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_cosmetics (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item_id)
  );
`);

const userColumns = new Set(database.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
if (!userColumns.has('display_name')) database.exec("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
if (!userColumns.has('credits')) database.exec('ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 500 CHECK (credits >= 0)');
if (!userColumns.has('avatar_id')) database.exec("ALTER TABLE users ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'pilot'");
database.exec("UPDATE users SET display_name = name WHERE display_name = ''");

const scoreTable = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'score_events'").get();
if (!scoreTable.sql.includes("'rocket'")) {
  database.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE score_events RENAME TO score_events_previous;
    CREATE TABLE score_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game TEXT NOT NULL CHECK (game IN ('snake', 'memory', 'reaction', 'mole', 'baseball', 'rocket')),
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

const findUserByName = database.prepare('SELECT id, name, display_name, credits, avatar_id FROM users WHERE name = ?');
const findUserById = database.prepare('SELECT id, name, display_name, credits, avatar_id FROM users WHERE id = ?');
const insertUser = database.prepare('INSERT INTO users (name, display_name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING');
const insertScore = database.prepare('INSERT INTO score_events (user_id, game, points) VALUES (?, ?, ?)');
const getUserCosmetics = database.prepare('SELECT item_id FROM user_cosmetics WHERE user_id = ?');
const getPlayers = database.prepare(`
  SELECT
    users.id,
    users.name,
    users.display_name,
    users.credits,
    users.avatar_id,
    users.created_at,
    COALESCE(SUM(score_events.points), 0) AS total,
    COALESCE(SUM(CASE WHEN score_events.game = 'snake' THEN score_events.points ELSE 0 END), 0) AS snake,
    COALESCE(SUM(CASE WHEN score_events.game = 'memory' THEN score_events.points ELSE 0 END), 0) AS memory,
    COALESCE(SUM(CASE WHEN score_events.game = 'reaction' THEN score_events.points ELSE 0 END), 0) AS reaction,
    COALESCE(SUM(CASE WHEN score_events.game = 'mole' THEN score_events.points ELSE 0 END), 0) AS mole,
    COALESCE(SUM(CASE WHEN score_events.game = 'baseball' THEN score_events.points ELSE 0 END), 0) AS baseball,
    COALESCE(SUM(CASE WHEN score_events.game = 'rocket' THEN score_events.points ELSE 0 END), 0) AS rocket
  FROM users
  LEFT JOIN score_events ON score_events.user_id = users.id
  GROUP BY users.id
  ORDER BY total DESC, users.created_at ASC, users.id ASC
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
  return {
    id: row.id,
    name: row.display_name || row.name,
    accountName: row.name,
    credits: Number(row.credits),
    avatarId: row.avatar_id,
    avatar: avatars.find((avatar) => avatar.id === row.avatar_id)?.emoji || avatars[0].emoji,
    ...(includeCosmetics ? { ownedCosmetics: getUserCosmetics.all(row.id).map((item) => item.item_id) } : {}),
    rank,
    total: Number(row.total),
    scores: Object.fromEntries(games.map((game) => [game, Number(row[game])]))
  };
}

function updateUserCredits(userId, credits) {
  database.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(credits, userId);
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

  if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
    const rows = getPlayers.all();
    const players = rows.map((row) => serializePlayer(row, null));
    players.forEach((player, index) => { player.rank = index + 1; });
    const userId = Number(url.searchParams.get('userId'));
    const currentUser = Number.isInteger(userId) ? players.find((player) => player.id === userId) || null : null;
    if (currentUser) currentUser.ownedCosmetics = getUserCosmetics.all(currentUser.id).map((item) => item.item_id);
    sendJson(response, 200, {
      players: players.slice(0, 10),
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
    database.exec('BEGIN IMMEDIATE');
    try {
      if (points > 0) insertScore.run(userId, payload.game, points);
      updateUserCredits(userId, creditsEarned);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
    sendJson(response, 201, { saved: true, creditsEarned, credits: Number(findUserById.get(userId).credits) });
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
      sendJson(response, 409, { error: '이미 보유한 프로필 아이콘입니다.' });
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
        sendJson(response, 409, { error: '이미 보유한 프로필 아이콘입니다.' });
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

  if (request.method === 'POST' && url.pathname === '/api/profile/avatar') {
    const payload = await readJson(request);
    const userId = Number(payload.userId);
    const avatar = avatars.find((option) => option.id === payload.avatarId);
    if (!Number.isInteger(userId) || !findUserById.get(userId)) {
      sendJson(response, 400, { error: '플레이어를 먼저 등록해 주세요.' });
      return;
    }
    if (!avatar || (avatar.id !== 'pilot' && !getUserCosmetics.all(userId).some((item) => item.item_id === `avatar-${avatar.id}`))) {
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
  const gameModule = pathname.match(/^\/games\/([a-z0-9-]+)\.js$/);
  const asset = publicFiles.get(pathname) || (gameModule
    ? [`games/${gameModule[1]}.js`, 'text/javascript; charset=utf-8']
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