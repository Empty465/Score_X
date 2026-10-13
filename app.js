const views = [...document.querySelectorAll('.view')];
const navItems = [...document.querySelectorAll('.nav-item')];
const breadcrumbCurrent = document.querySelector('#breadcrumb-current');
const titles = { home: '임무 관제실', investment: '투자 관제실', shop: '재화 상점', snake: '우주 쓰레기 수거', memory: '시스템 오류 복구', reaction: '수동 도킹 시퀀스', mole: '비상 경고등 진압', baseball: '궤도 진입 좌표 해독', rocket: '1단 부스터 회수' };
const bestKeys = { snake: 'playground-best-snake', memory: 'playground-best-memory', reaction: 'playground-best-reaction', mole: 'playground-best-mole', baseball: 'playground-best-baseball', rocket: 'playground-best-rocket' };
const scoreGames = [
  { id: 'snake', label: '우주 쓰레기 수거', icon: '↝' },
  { id: 'memory', label: '시스템 오류 복구', icon: '▦' },
  { id: 'reaction', label: '수동 도킹 시퀀스', icon: '✳' },
  { id: 'mole', label: '비상 경고등 진압', icon: '⌁' },
  { id: 'baseball', label: '궤도 진입 좌표 해독', icon: '#' },
  { id: 'rocket', label: '1단 부스터 회수', icon: '▲' }
];
let activePlayer = null;
let currentProfile = null;
let shopItems = [];
try { activePlayer = JSON.parse(localStorage.getItem('playground-player') || 'null'); } catch { activePlayer = null; }

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

function getBest(game) {
  try { return localStorage.getItem(bestKeys[game] || `playground-best-${game}`); } catch { return null; }
}

function saveBest(game, value) {
  try { localStorage.setItem(bestKeys[game] || `playground-best-${game}`, String(value)); } catch { /* Storage may be unavailable in private browsing. */ }
  renderBests();
}

function renderBests() {
  document.querySelectorAll('[data-best]').forEach((element) => {
    const game = element.dataset.best;
    const value = getBest(game);
    element.textContent = value === null ? (game === 'snake' ? '0' : '—') : value;
  });
}

function formatPoints(points) {
  return new Intl.NumberFormat('ko-KR').format(points);
}

function setPlayerMessage(message, isError = false) {
  const status = document.querySelector('#player-message');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function ensureScoreServer() {
  if (location.protocol !== 'http:' || location.port !== '3000') {
    throw new Error('점수 저장은 http://127.0.0.1:3000 에서 이용할 수 있어요.');
  }
}

function renderScoreboard(data) {
  const currentUser = data.currentUser;
  currentProfile = currentUser;
  document.querySelector('#total-score').textContent = formatPoints(currentUser?.total || 0);
  document.querySelector('#current-player-label').textContent = currentUser
    ? `${currentUser.name} · ${currentUser.rank}위`
    : activePlayer ? `${activePlayer.name} · 기록을 불러오는 중` : '이름을 등록하면 순위에 참여할 수 있어요.';
  const profileAvatar = document.querySelector('.avatar');
  profileAvatar.textContent = currentUser?.avatar || '🚀';
  profileAvatar.setAttribute('aria-label', currentUser ? `${currentUser.name} 프로필` : '크루 프로필');
  document.querySelector('#wallet-balance').textContent = currentUser ? formatPoints(currentUser.credits) : '—';
  document.querySelector('#shop-balance').textContent = currentUser ? formatPoints(currentUser.credits) : '—';
  renderShopItems();

  const rankingList = document.querySelector('#score-rankings');
  const playerRows = data.players.map((player) => {
    const row = document.createElement('li');
    row.className = 'ranking-row';
    if (player.id === currentUser?.id) row.classList.add('is-current-player');
    const rank = document.createElement('span');
    rank.className = 'ranking-number';
    rank.textContent = String(player.rank).padStart(2, '0');
    const avatar = document.createElement('span');
    avatar.className = 'ranking-avatar';
    avatar.textContent = player.avatar || '🚀';
    const name = document.createElement('span');
    name.className = 'ranking-name';
    name.textContent = player.name;
    const points = document.createElement('strong');
    points.textContent = formatPoints(player.total);
    const unit = document.createElement('small');
    unit.textContent = ' PTS';
    points.append(unit);
    row.append(rank, avatar, name, points);
    return row;
  });
  if (playerRows.length === 0) {
    const emptyRow = document.createElement('li');
    emptyRow.className = 'ranking-empty';
    emptyRow.textContent = '아직 등록된 플레이어가 없어요.';
    playerRows.push(emptyRow);
  }
  rankingList.replaceChildren(...playerRows);

  const gameBreakdown = document.querySelector('#score-game-breakdown');
  gameBreakdown.replaceChildren(...scoreGames.map((game) => {
    const row = document.createElement('li');
    row.className = 'score-game-item';
    const label = document.createElement('span');
    label.textContent = `${game.icon} ${game.label}`;
    const points = document.createElement('strong');
    points.textContent = formatPoints(currentUser?.scores?.[game.id] || 0);
    row.append(label, points);
    return row;
  }));
}

function setShopMessage(message, isError = false) {
  const status = document.querySelector('#shop-message');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function renderShopItems() {
  const container = document.querySelector('#shop-items');
  if (!container) return;
  container.replaceChildren();
  if (shopItems.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'shop-empty';
    empty.textContent = '상점 상품을 불러오는 중입니다.';
    container.append(empty);
    return;
  }

  const owned = new Set(currentProfile?.ownedCosmetics || []);
  shopItems.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'shop-item';
    const preview = document.createElement('div');
    preview.className = 'shop-item-preview';
    preview.textContent = item.emoji;
    const category = document.createElement('span');
    category.className = 'shop-item-category';
    category.textContent = item.type === 'display-name' ? 'CREW ID' : 'PROFILE ICON';
    const title = document.createElement('h3');
    title.textContent = item.name;
    const description = document.createElement('p');
    description.textContent = item.description;
    const price = document.createElement('div');
    price.className = 'shop-item-price';
    const priceLabel = document.createElement('span');
    priceLabel.textContent = '가격';
    const priceAmount = document.createElement('strong');
    priceAmount.textContent = `◇ ${formatPoints(item.price)} `;
    const priceUnit = document.createElement('small');
    priceUnit.textContent = 'CR';
    priceAmount.append(priceUnit);
    price.append(priceLabel, priceAmount);
    card.append(preview, category, title, description, price);

    const form = document.createElement('form');
    form.className = item.type === 'display-name' ? 'shop-item-form has-name-input' : 'shop-item-form';
    form.dataset.itemId = item.id;
    if (item.type === 'display-name') {
      const input = document.createElement('input');
      input.name = 'displayName';
      input.type = 'text';
      input.maxLength = 24;
      input.placeholder = currentProfile?.name || '새 점수판 이름';
      input.setAttribute('aria-label', '변경할 점수판 이름');
      form.append(input);
    }
    const button = document.createElement('button');
    button.className = 'shop-buy-button';
    button.type = 'submit';
    const isOwned = owned.has(item.id);
    const isEquipped = item.type === 'avatar' && currentProfile?.avatarId === item.avatarId;
    const hasEnoughCredits = currentProfile && currentProfile.credits >= item.price;
    button.textContent = item.type === 'display-name' ? '이름 변경권 구매' : isEquipped ? '장착 중' : isOwned ? '장착하기' : hasEnoughCredits ? '구매하기' : '크레딧 부족';
    button.disabled = !currentProfile || (item.type === 'avatar' && isEquipped) || (item.type === 'avatar' && !isOwned && !hasEnoughCredits) || (item.type === 'display-name' && !hasEnoughCredits);
    if (item.type === 'avatar') button.dataset.avatarId = item.avatarId;
    form.append(button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const displayName = form.elements.displayName?.value || '';
      if (item.type === 'display-name' && !displayName.trim()) {
        setShopMessage('새 점수판 이름을 입력해 주세요.', true);
        form.elements.displayName?.focus();
        return;
      }
      if (item.type === 'avatar' && isOwned) {
        equipAvatar(item.avatarId, button);
      } else {
        purchaseShopItem(item.id, displayName, button);
      }
    });
    card.append(form);
    container.append(card);
  });
}

async function loadShopItems() {
  ensureScoreServer();
  const response = await fetch('/api/shop/items');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '상점 상품을 불러오지 못했습니다.');
  shopItems = result.items;
  renderShopItems();
  if (!currentProfile) setShopMessage('상점을 이용하려면 먼저 관제실에서 플레이어 이름을 등록하세요.');
  else setShopMessage('미니게임에서 크레딧을 모아 크루 프로필을 꾸며보세요.');
}

async function purchaseShopItem(itemId, displayName, button) {
  if (!activePlayer) {
    setShopMessage('상점을 이용하려면 먼저 관제실에서 플레이어 이름을 등록하세요.', true);
    return;
  }
  button.disabled = true;
  setShopMessage('구매를 처리하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/shop/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activePlayer.id, itemId, displayName })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '구매를 완료하지 못했습니다.');
    currentProfile = result.profile;
    setShopMessage(`${result.profile.name} 크루 프로필을 업데이트했습니다.`);
    await refreshScoreboard();
  } catch (error) {
    setShopMessage(error.message || '구매를 완료하지 못했습니다.', true);
  } finally {
    renderShopItems();
  }
}

async function equipAvatar(avatarId, button) {
  if (!activePlayer) return;
  button.disabled = true;
  setShopMessage('프로필 아이콘을 적용하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activePlayer.id, avatarId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '프로필 아이콘을 적용하지 못했습니다.');
    currentProfile = result.profile;
    setShopMessage('프로필 아이콘을 적용했습니다.');
    await refreshScoreboard();
  } catch (error) {
    setShopMessage(error.message || '프로필 아이콘을 적용하지 못했습니다.', true);
  } finally {
    renderShopItems();
  }
}

async function refreshScoreboard() {
  const query = activePlayer ? `?userId=${encodeURIComponent(activePlayer.id)}` : '';
  ensureScoreServer();
  const response = await fetch(`/api/leaderboard${query}`);
  if (!response.ok) throw new Error('점수판을 불러오지 못했습니다.');
  const data = await response.json();
  renderScoreboard(data);
  setPlayerMessage(data.currentUser
    ? `${data.currentUser.name}님의 점수판을 불러왔어요.`
    : '서버 연결됨 · 이름을 등록해 순위에 참여하세요.');
}

async function registerPlayer(event) {
  event.preventDefault();
  const form = document.querySelector('#player-form');
  const input = document.querySelector('#player-name');
  const button = form.querySelector('button');
  button.disabled = true;
  setPlayerMessage('이름을 확인하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.value.trim() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '이름 등록에 실패했습니다.');
    activePlayer = result.user;
    localStorage.setItem('playground-player', JSON.stringify(activePlayer));
    setPlayerMessage(`${activePlayer.name}님, 기록을 불러왔어요.`);
    await refreshScoreboard();
  } catch (error) {
    setPlayerMessage(error.message || '점수 서버에 연결할 수 없습니다.', true);
  } finally {
    button.disabled = false;
  }
}

async function awardScore(game, points) {
  const earned = Math.max(0, Math.floor(points));
  if (!activePlayer) {
    setPlayerMessage('점수를 저장하려면 먼저 플레이어 이름을 등록하세요.', true);
    return null;
  }
  try {
    ensureScoreServer();
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activePlayer.id, game, points: earned })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '점수 저장에 실패했습니다.');
    await refreshScoreboard();
    setShopMessage(`임무 보상으로 ${formatPoints(result.creditsEarned)} CR을 획득했습니다.`);
  } catch (error) {
    setPlayerMessage(error.message || '점수 서버에 연결할 수 없습니다.', true);
    return null;
  }
  return earned;
}

const gameModules = new Map();
let gameModulesReady = Promise.resolve();
window.Playground = {
  getBest,
  saveBest,
  awardScore,
  registerGame(id, lifecycle) {
    gameModules.set(id, lifecycle);
  }
};

function showView(name) {
  views.forEach((view) => view.classList.toggle('is-visible', view.id === `view-${name}`));
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
  breadcrumbCurrent.textContent = titles[name];
  gameModules.forEach((lifecycle, id) => {
    if (id === name) lifecycle.onShow?.();
    else lifecycle.onHide?.();
  });
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-launch]').forEach((button) => button.addEventListener('click', async () => {
  const game = button.dataset.launch;
  await gameModulesReady;
  showView(game);
  gameModules.get(game)?.onLaunch?.();
}));
loadShopItems().catch((error) => setShopMessage(error.message || '상점에 연결할 수 없습니다.', true));
renderBests();
document.querySelector('#player-name').value = activePlayer?.accountName || activePlayer?.name || '';
document.querySelector('#player-form').addEventListener('submit', registerPlayer);
renderScoreboard({ players: [], currentUser: null });
refreshScoreboard().catch((error) => setPlayerMessage(error.message || 'SQLite 서버를 실행해 주세요: node server.js', true));

gameModulesReady = import('./games/index.js').catch((error) => {
  setPlayerMessage(error.message || '게임 모듈을 불러오지 못했습니다.', true);
});
