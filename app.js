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
let investmentOptions = [];
let selectedRisk = null;
let activeInvestment = null;
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
  profileAvatar.title = currentUser?.title || currentUser?.name || '크루 프로필';
  const titleBadge = document.querySelector('#profile-title-badge');
  titleBadge.textContent = currentUser?.title || '';
  titleBadge.hidden = !currentUser?.title;
  document.querySelector('#wallet-balance').textContent = currentUser ? formatPoints(currentUser.credits) : '—';
  document.querySelector('#shop-balance').textContent = currentUser ? formatPoints(currentUser.credits) : '—';
  renderShopItems();
  renderInvestment();

  const rankingList = document.querySelector('#score-rankings');
  const playerRows = data.players.map((player) => {
    const row = document.createElement('li');
    row.className = 'ranking-row';
    if (player.id === currentUser?.id) row.classList.add('is-current-player');
    if (player.backgroundId) row.classList.add(`ranking-bg-${player.backgroundId}`);
    const rank = document.createElement('span');
    rank.className = 'ranking-number';
    rank.textContent = String(player.rank).padStart(2, '0');
    const avatar = document.createElement('span');
    avatar.className = 'ranking-avatar';
    avatar.textContent = player.avatar || '🚀';
    const name = document.createElement('span');
    name.className = 'ranking-name';
    name.textContent = player.name;
    if (player.title) {
      const title = document.createElement('small');
      title.className = 'ranking-title';
      title.textContent = player.title;
      name.append(title);
    }
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
    category.textContent = {
      'display-name': 'CREW ID',
      avatar: 'PROFILE AVATAR',
      title: 'CREW TITLE',
      background: 'RANK BACKGROUND'
    }[item.type] || 'PROFILE ITEM';
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
    const equippedValue = {
      avatar: currentProfile?.avatarId,
      title: currentProfile?.titleId,
      background: currentProfile?.backgroundId
    }[item.type];
    const itemValue = item.avatarId || item.titleId || item.backgroundId;
    const isEquipped = item.type !== 'display-name' && equippedValue === itemValue;
    const hasEnoughCredits = currentProfile && currentProfile.credits >= item.price;
    button.textContent = item.type === 'display-name' ? '이름 변경권 구매' : isEquipped ? '장착 중' : isOwned ? '장착하기' : hasEnoughCredits ? '구매하기' : '크레딧 부족';
    button.disabled = !currentProfile || (item.type !== 'display-name' && isEquipped) || (item.type !== 'display-name' && !isOwned && !hasEnoughCredits) || (item.type === 'display-name' && !hasEnoughCredits);
    form.append(button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const displayName = form.elements.displayName?.value || '';
      if (item.type === 'display-name' && !displayName.trim()) {
        setShopMessage('새 점수판 이름을 입력해 주세요.', true);
        form.elements.displayName?.focus();
        return;
      }
      if (item.type !== 'display-name' && isOwned) {
        equipCosmetic(item.id, button);
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

async function equipCosmetic(itemId, button) {
  if (!activePlayer) return;
  button.disabled = true;
  setShopMessage('프로필 아이템을 적용하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/profile/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activePlayer.id, itemId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '프로필 아이템을 적용하지 못했습니다.');
    currentProfile = result.profile;
    setShopMessage('프로필 아이템을 적용했습니다.');
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
  if (activePlayer) await loadActiveInvestment();
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
    handleInvestmentProgress(result);
    await refreshScoreboard();
    setShopMessage(`임무 보상으로 ${formatPoints(result.creditsEarned)} CR을 획득했습니다.`);
  } catch (error) {
    setPlayerMessage(error.message || '점수 서버에 연결할 수 없습니다.', true);
    return null;
  }
  return earned;
}

function setInvestmentMessage(message, isError = false) {
  const status = document.querySelector('#investment-message');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function renderInvestmentOptions() {
  const container = document.querySelector('#investment-options');
  container.replaceChildren(...investmentOptions.map((option) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `investment-option${selectedRisk === option.id ? ' is-selected' : ''}`;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(selectedRisk === option.id));
    const name = document.createElement('strong');
    name.textContent = option.name;
    const description = document.createElement('span');
    description.className = 'investment-option-description';
    description.textContent = option.description;
    const outcomes = document.createElement('span');
    outcomes.className = 'investment-outcomes';
    outcomes.textContent = option.outcomes
      .map((outcome) => `${outcome.name} ${outcome.chance}% · ×${outcome.multiplier}`)
      .join(' / ');
    card.append(name, description, outcomes);
    card.addEventListener('click', () => {
      selectedRisk = option.id;
      renderInvestmentOptions();
    });
    return card;
  }));
}

function renderInvestment() {
  const balance = currentProfile?.credits || 0;
  const amount = document.querySelector('#investment-amount');
  const number = document.querySelector('#investment-stake-number');
  const max = Math.max(1, balance);
  amount.max = String(max);
  number.max = String(max);
  document.querySelector('#investment-credit-limit').textContent = formatPoints(balance);
  const stake = Math.min(max, Math.max(1, Number(number.value) || 1));
  number.value = String(stake);
  amount.value = String(stake);
  document.querySelector('#investment-amount-value').textContent = formatPoints(stake);
  const form = document.querySelector('#investment-form');
  const progress = document.querySelector('#investment-progress');
  const startButton = document.querySelector('#investment-start');
  form.hidden = Boolean(activeInvestment);
  document.querySelector('#investment-panel-title').textContent = activeInvestment
    ? '투자 임무 진행 중'
    : '투자 규모와 위험 옵션 선택';
  document.querySelector('#investment-panel-copy').textContent = activeInvestment
    ? `${activeInvestment.riskName} 옵션으로 임무를 완료하면 투자 결과를 정산합니다.`
    : '3~5개의 무작위 임무를 완료하면 서버에서 확률에 따라 투자 결과를 정산합니다.';
  form.querySelectorAll('input, button').forEach((element) => {
    element.disabled = !currentProfile || Boolean(activeInvestment);
  });
  startButton.disabled = !currentProfile || Boolean(activeInvestment) || stake > balance || !selectedRisk;
  progress.hidden = !activeInvestment;
  if (!activeInvestment) return;

  const gameNames = Object.fromEntries(scoreGames.map((game) => [game.id, game.label]));
  const nextGame = activeInvestment.games[activeInvestment.progress];
  document.querySelector('#investment-progress-count').textContent = `${activeInvestment.progress} / ${activeInvestment.games.length}`;
  document.querySelector('#investment-progress-copy').textContent =
    `${activeInvestment.riskName} · 투자 ${formatPoints(activeInvestment.stake)} CR · 완료된 임무 ${activeInvestment.progress}개`;
  const sequence = document.querySelector('#investment-sequence');
  sequence.replaceChildren(...activeInvestment.games.map((game, index) => {
    const row = document.createElement('li');
    row.className = index < activeInvestment.progress ? 'is-complete' : index === activeInvestment.progress ? 'is-current' : '';
    row.textContent = `${String(index + 1).padStart(2, '0')} · ${gameNames[game]}`;
    return row;
  }));
  const nextButton = document.querySelector('#investment-next-game');
  nextButton.hidden = !nextGame;
  if (nextGame) {
    nextButton.dataset.launch = nextGame;
    nextButton.innerHTML = `${gameNames[nextGame]} 시작 <span>↗</span>`;
  }
}

async function loadInvestmentOptions() {
  ensureScoreServer();
  const response = await fetch('/api/investment/options');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '투자 옵션을 불러오지 못했습니다.');
  investmentOptions = result.options;
  selectedRisk = result.recommendation;
  renderInvestmentOptions();
  renderInvestment();
}

async function rerollInvestmentOption() {
  try {
    ensureScoreServer();
    const response = await fetch('/api/investment/options');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '투자 옵션을 다시 뽑지 못했습니다.');
    selectedRisk = result.recommendation;
    renderInvestmentOptions();
    setInvestmentMessage('새 위험 옵션을 뽑았습니다. 확률표를 확인해 주세요.');
  } catch (error) {
    setInvestmentMessage(error.message || '투자 옵션을 다시 뽑지 못했습니다.', true);
  }
}

async function loadActiveInvestment() {
  if (!activePlayer) {
    activeInvestment = null;
    renderInvestment();
    return;
  }
  ensureScoreServer();
  const response = await fetch(`/api/investment/active?userId=${encodeURIComponent(activePlayer.id)}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '진행 중인 투자 임무를 불러오지 못했습니다.');
  activeInvestment = result.run;
  renderInvestment();
}

async function startInvestment(event) {
  event.preventDefault();
  if (!activePlayer || !selectedRisk) {
    setInvestmentMessage('플레이어를 등록하고 위험 옵션을 선택해 주세요.', true);
    return;
  }
  const button = document.querySelector('#investment-start');
  button.disabled = true;
  setInvestmentMessage('투자 임무를 준비하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/investment/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: activePlayer.id,
        stake: Number(document.querySelector('#investment-stake-number').value),
        risk: selectedRisk
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '투자 임무를 시작하지 못했습니다.');
    activeInvestment = result.run;
    await refreshScoreboard();
    renderInvestment();
    setInvestmentMessage('투자금이 예치됐습니다. 안내된 임무 순서대로 진행해 주세요.');
  } catch (error) {
    setInvestmentMessage(error.message || '투자 임무를 시작하지 못했습니다.', true);
  }
}

function handleInvestmentProgress(result) {
  if (result.investment) {
    activeInvestment = result.investment.status === 'active' ? result.investment : null;
    renderInvestment();
    if (result.investment.status === 'completed') {
      const dialog = document.querySelector('#investment-result-dialog');
      const outcome = result.investment.outcomeName;
      document.querySelector('#investment-result-title').textContent = `투자 결과 · ${outcome}`;
      document.querySelector('#investment-result-copy').textContent =
        `${formatPoints(result.investment.stake)} CR 투자 · ${result.investment.riskName} · 배율 ×${result.investment.multiplier}`;
      const net = result.investment.reward - result.investment.stake;
      document.querySelector('#investment-result-amount').textContent =
        `${net >= 0 ? '+' : ''}${formatPoints(net)} CR`;
      if (!dialog.open) dialog.showModal();
      setInvestmentMessage('투자 임무를 완료하고 정산했습니다.');
    }
  } else if (result.reroll) {
    selectedRisk = result.reroll;
    renderInvestmentOptions();
    setInvestmentMessage('미투자 임무 완료 보너스로 투자 옵션을 다시 뽑았습니다.');
  }
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
  if (name === 'investment' && activePlayer) {
    loadActiveInvestment().catch((error) => setInvestmentMessage(error.message || '투자 정보를 불러오지 못했습니다.', true));
  }
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-launch]').forEach((button) => button.addEventListener('click', async () => {
  const game = button.dataset.launch;
  await gameModulesReady;
  showView(game);
  gameModules.get(game)?.onLaunch?.();
}));
document.querySelector('#investment-form').addEventListener('submit', startInvestment);
document.querySelector('#investment-reroll').addEventListener('click', rerollInvestmentOption);
document.querySelector('#investment-amount').addEventListener('input', (event) => {
  document.querySelector('#investment-stake-number').value = event.target.value;
  renderInvestment();
});
document.querySelector('#investment-stake-number').addEventListener('input', (event) => {
  const amount = document.querySelector('#investment-amount');
  const value = Math.min(Number(amount.max), Math.max(1, Number(event.target.value) || 1));
  amount.value = String(value);
  document.querySelector('#investment-amount-value').textContent = formatPoints(value);
  renderInvestment();
});
document.querySelector('#investment-next-game').addEventListener('click', async (event) => {
  const game = event.currentTarget.dataset.launch;
  if (!game) return;
  await gameModulesReady;
  showView(game);
  gameModules.get(game)?.onLaunch?.();
});
document.querySelector('#investment-result-confirm').addEventListener('click', () => {
  document.querySelector('#investment-result-dialog').close();
});
loadShopItems().catch((error) => setShopMessage(error.message || '상점에 연결할 수 없습니다.', true));
loadInvestmentOptions().catch((error) => setInvestmentMessage(error.message || '투자 옵션을 불러올 수 없습니다.', true));
renderBests();
document.querySelector('#player-name').value = activePlayer?.accountName || activePlayer?.name || '';
document.querySelector('#player-form').addEventListener('submit', registerPlayer);
renderScoreboard({ players: [], currentUser: null });
refreshScoreboard().catch((error) => setPlayerMessage(error.message || 'SQLite 서버를 실행해 주세요: node server.js', true));

gameModulesReady = import('./games/index.js').catch((error) => {
  setPlayerMessage(error.message || '게임 모듈을 불러오지 못했습니다.', true);
});
