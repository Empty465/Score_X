import { cardArt, builtinOrder } from '/shell/card-art.js';

const gameCatalogById = new Map();
let scoreGames = [];
const titles = {
  home: '게임 홈',
  investment: '투자 센터',
  shop: '재화 상점'
};
const gameNav = document.querySelector('.game-nav');
const gameGrid = document.querySelector('.game-grid');

// 서버의 /api/games(games/*/manifest.json)가 게임 목록의 유일한 출처입니다.
function sortGames(games) {
  const rank = (id) => (builtinOrder.includes(id) ? builtinOrder.indexOf(id) : builtinOrder.length);
  return games.map((game, index) => ({ game, index }))
    .sort((a, b) => rank(a.game.id) - rank(b.game.id) || a.index - b.index)
    .map(({ game }) => game);
}

function buildGenericArt(game) {
  const art = document.createElement('span');
  art.className = 'generic-art-icon';
  art.textContent = game.icon;
  return art;
}

function renderGameMenu(games) {
  scoreGames = sortGames(games);
  scoreGames.forEach((game, index) => {
    const decor = cardArt[game.id];
    gameCatalogById.set(game.id, { ...game, bestDefault: decor?.bestDefault ?? '—' });
    titles[game.id] = game.title;

    const navItem = document.createElement('button');
    navItem.className = 'nav-item';
    navItem.dataset.view = game.id;
    navItem.setAttribute('aria-label', game.title);
    navItem.title = game.title;
    navItem.innerHTML = '<span class="nav-icon"></span><span class="nav-full"></span><span class="nav-short" aria-hidden="true"></span>';
    navItem.querySelector('.nav-icon').textContent = game.icon;
    navItem.querySelector('.nav-full').textContent = game.title;
    navItem.querySelector('.nav-short').textContent = game.shortTitle;
    gameNav.append(navItem);

    const card = document.createElement('article');
    card.className = `game-card card-${decor?.cardClass ?? 'generic'}`;
    card.innerHTML = `
      <div class="card-topline"><span class="game-number"></span><span class="best-chip"><span>★</span> 최고 <b></b></span></div>
      <div class="game-art ${decor?.artClass ?? 'generic-art'}" aria-hidden="true"></div>
      <div class="card-info"><div class="card-title-row"><h3></h3><span class="game-category"></span></div><p></p><button class="play-link">게임 시작 <span>↗</span></button></div>`;
    card.querySelector('.best-chip b').dataset.best = game.id;
    card.querySelector('.play-link').dataset.launch = game.id;
    if (decor) card.querySelector('.game-art').innerHTML = decor.artMarkup;
    else card.querySelector('.game-art').append(buildGenericArt(game));
    card.querySelector('.game-number').textContent = `NO. ${String(index + 1).padStart(2, '0')}`;
    card.querySelector('h3').textContent = game.title;
    card.querySelector('.game-category').textContent = game.category;
    card.querySelector('.card-info p').textContent = game.description;
    gameGrid.append(card);
  });
  renderBests();
}

async function loadGameMenu() {
  ensureScoreServer();
  const response = await fetch('/api/games');
  if (!response.ok) throw new Error('게임 목록을 불러오지 못했습니다.');
  renderGameMenu((await response.json()).games);
}

const breadcrumbCurrent = document.querySelector('#breadcrumb-current');
let activePlayer = null;
let currentProfile = null;
let shopItems = [];
let investmentOptions = [];
let selectedRisk = null;
let activeInvestment = null;
let pendingInvestmentSettlement = null;
let investmentRequestPending = false;
let authMode = 'login';

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());

function getGame(game) {
  const metadata = gameCatalogById.get(game);
  if (!metadata) throw new Error(`등록되지 않은 게임입니다: ${game}`);
  return metadata;
}

function getBest(game) {
  getGame(game);
  try { return localStorage.getItem(`playground-best-${game}`); } catch { return null; }
}

function saveBest(game, value) {
  getGame(game);
  try { localStorage.setItem(`playground-best-${game}`, String(value)); } catch { /* Storage may be unavailable in private browsing. */ }
  renderBests();
}

function renderBests() {
  document.querySelectorAll('[data-best]').forEach((element) => {
    const game = element.dataset.best;
    if (!gameCatalogById.has(game)) return;
    const value = getBest(game);
    element.textContent = value === null ? getGame(game).bestDefault : value;
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

function showMissionResult(game, points, result) {
  const gameName = getGame(game).title;
  const dialog = document.querySelector('#mission-result-dialog');
  const isGuest = result.saved === false;
  document.querySelector('#mission-result-title').textContent = `${gameName} 완료`;
  document.querySelector('#mission-result-copy').textContent = isGuest
    ? '게스트 플레이라 기록과 CR은 저장되지 않습니다. 로그인하면 보상이 쌓여요.'
    : result.isNewBest
      ? '새로운 게임별 최고 점수를 기록했습니다.'
      : '이번 임무 결과와 보상을 확인하세요.';
  document.querySelector('#mission-result-score').textContent = `${formatPoints(points)} PTS`;
  document.querySelector('#mission-result-credits').textContent = `${isGuest ? '' : '+'}${formatPoints(result.creditsEarned)} CR${isGuest ? ' (미저장)' : ''}`;
  document.querySelector('#mission-result-total').textContent = isGuest
    ? '게스트 기록 · 순위에 반영되지 않음'
    : `최고 기록 합산 ${formatPoints(result.totalBestScore)} PTS · ${result.tier}`;
  if (!dialog.open) dialog.showModal();
}

function ensureScoreServer() {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    throw new Error('점수 저장은 점수 서버(node server.js)를 통해 접속해야 이용할 수 있어요.');
  }
}

function renderScoreboard(data) {
  const currentUser = data.currentUser;
  currentProfile = currentUser;
  document.querySelector('#total-score').textContent = formatPoints(currentUser?.total || 0);
  document.querySelector('#total-tier').textContent = currentUser?.tier || '훈련생';
  document.querySelector('#current-player-label').textContent = currentUser
    ? `${currentUser.name} · 기록 ${currentUser.rank}위 · 자산 ${currentUser.creditRank}위`
    : '로그인하면 순위에 참여할 수 있어요. 게스트 기록은 저장되지 않아요.';
  document.querySelector('#player-form').hidden = Boolean(currentUser);
  document.querySelector('#auth-session').hidden = !currentUser;
  const profileAvatar = document.querySelector('.avatar');
  profileAvatar.textContent = currentUser?.avatar || '🚀';
  profileAvatar.setAttribute('aria-label', currentUser ? `${currentUser.name} 프로필` : 'Score X 프로필');
  profileAvatar.title = currentUser?.title || currentUser?.name || 'Score X 프로필';
  const titleBadge = document.querySelector('#profile-title-badge');
  titleBadge.textContent = currentUser?.title || '';
  titleBadge.hidden = !currentUser?.title;
  document.querySelector('#wallet-balance').textContent = currentUser ? formatPoints(currentUser.credits) : '—';
  document.querySelector('#shop-balance').textContent = currentUser ? formatPoints(currentUser.credits) : '—';
  renderShopItems();
  renderInvestment();

  function renderRankingList(container, players, valueKey, unitLabel, emptyMessage, showTier = false, detailType = 'scores') {
    const playerRows = players.map((player) => {
      const row = document.createElement('li');
      row.className = 'ranking-row';
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-expanded', 'false');
      row.setAttribute('aria-label', `${player.rank}위 ${player.name}, ${formatPoints(player[valueKey])} ${unitLabel}. 선택해 상세 정보 보기`);
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
      if (showTier) {
        const tier = document.createElement('small');
        tier.className = 'ranking-tier';
        tier.textContent = player.tier;
        name.append(tier);
      }
      const points = document.createElement('strong');
      points.textContent = formatPoints(player[valueKey]);
      const unit = document.createElement('small');
      unit.textContent = ` ${unitLabel}`;
      points.append(unit);
      row.append(rank, avatar, name, points);
      const details = document.createElement('div');
      details.className = 'ranking-detail';
      details.setAttribute('aria-hidden', 'true');
      if (detailType === 'scores') {
        const heading = document.createElement('strong');
        heading.className = 'ranking-detail-heading';
        heading.textContent = '미니게임별 최고 점수';
        const scores = document.createElement('ul');
        scores.className = 'ranking-detail-list';
        scores.append(...scoreGames.map((game) => {
          const item = document.createElement('li');
          const label = document.createElement('span');
          label.textContent = `${game.icon} ${game.title}`;
          const score = document.createElement('strong');
          score.textContent = formatPoints(player.scores?.[game.id] || 0);
          item.append(label, score);
          return item;
        }));
        details.append(heading, scores);
      } else {
        const investment = player.latestInvestment;
        const heading = document.createElement('strong');
        heading.className = 'ranking-detail-heading';
        heading.textContent = investment ? '최근 투자 결과' : '투자 기록';
        details.append(heading);
        if (investment) {
          const info = document.createElement('p');
          info.className = 'ranking-investment-info';
          info.textContent = `${investment.riskName} · ${formatPoints(investment.stake)} CR 투자`;
          if (investment.status === 'completed') {
            info.textContent += ` · ${formatPoints(investment.reward)} CR 정산`;
            const result = document.createElement('p');
            result.className = 'ranking-investment-result';
            const netDescription = investment.net > 0
              ? `순이익 +${formatPoints(investment.net)} CR`
              : investment.net < 0
                ? `순손실 ${formatPoints(Math.abs(investment.net))} CR`
                : '손익 없음';
            result.textContent = `${investment.outcomeName} · ×${investment.multiplier ?? '—'} · ${netDescription}`;
            details.append(info, result);
          } else {
            const progress = document.createElement('p');
            progress.className = 'ranking-investment-result';
            progress.textContent = `진행 중 · 임무 ${investment.progress}/${investment.gameCount}`;
            details.append(info, progress);
          }
        } else {
          const empty = document.createElement('p');
          empty.className = 'ranking-investment-info';
          empty.textContent = '완료된 투자 기록이 없습니다.';
          details.append(empty);
        }
      }
      row.append(details);
      return row;
    });
    if (playerRows.length === 0) {
      const emptyRow = document.createElement('li');
      emptyRow.className = 'ranking-empty';
      emptyRow.textContent = emptyMessage;
      playerRows.push(emptyRow);
    }
    container.replaceChildren(...playerRows);
  }

  renderRankingList(
    document.querySelector('#score-rankings'),
    data.players,
    'total',
    'PTS',
    '아직 최고 기록이 등록되지 않았어요.',
    true
  );
  renderRankingList(
    document.querySelector('#credit-rankings'),
    data.creditPlayers || [],
    'credits',
    'CR',
    '아직 등록된 플레이어가 없어요.',
    false,
    'investment'
  );

  const gameBreakdown = document.querySelector('#score-game-breakdown');
  gameBreakdown.replaceChildren(...scoreGames.map((game) => {
    const row = document.createElement('li');
    row.className = 'score-game-item';
    const label = document.createElement('span');
    label.textContent = `${game.icon} ${game.title}`;
    const points = document.createElement('strong');
    points.textContent = formatPoints(currentUser?.scores?.[game.id] || 0);
    row.append(label, points);
    return row;
  }));
}

function toggleRankingDetails(row) {
  const expanded = row.classList.toggle('is-expanded');
  row.setAttribute('aria-expanded', String(expanded));
  row.querySelector('.ranking-detail')?.setAttribute('aria-hidden', String(!expanded && !row.matches(':hover, :focus-within')));
}

document.querySelectorAll('#score-rankings, #credit-rankings').forEach((container) => {
  const setDetailsVisibility = (row, visible) => {
    if (row.classList.contains('is-expanded')) return;
    row.querySelector('.ranking-detail')?.setAttribute('aria-hidden', String(!visible));
  };
  container.addEventListener('pointerover', (event) => {
    const row = event.target.closest('.ranking-row[role="button"]');
    if (row && !row.contains(event.relatedTarget)) setDetailsVisibility(row, true);
  });
  container.addEventListener('pointerout', (event) => {
    const row = event.target.closest('.ranking-row[role="button"]');
    if (row && !row.contains(event.relatedTarget)) setDetailsVisibility(row, false);
  });
  container.addEventListener('focusin', (event) => {
    const row = event.target.closest('.ranking-row[role="button"]');
    if (row) setDetailsVisibility(row, true);
  });
  container.addEventListener('focusout', (event) => {
    const row = event.target.closest('.ranking-row[role="button"]');
    if (row && !row.contains(event.relatedTarget)) setDetailsVisibility(row, false);
  });
  container.addEventListener('click', (event) => {
    const row = event.target.closest('.ranking-row[role="button"]');
    if (row) toggleRankingDetails(row);
  });
  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('.ranking-row[role="button"]');
    if (!row) return;
    event.preventDefault();
    toggleRankingDetails(row);
  });
});

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
      'display-name': 'PLAYER ID',
      avatar: 'PROFILE AVATAR',
      title: 'PLAYER TITLE',
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
      input.minLength = 2;
      input.maxLength = 16;
      input.placeholder = currentProfile?.name || '새 닉네임 (2~16자)';
      input.setAttribute('aria-label', '변경할 닉네임');
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
    button.textContent = item.type === 'display-name' ? '닉네임 변경권 구매' : isEquipped ? '장착 중' : isOwned ? '장착하기' : hasEnoughCredits ? '구매하기' : '크레딧 부족';
    button.disabled = !currentProfile || (item.type !== 'display-name' && isEquipped) || (item.type !== 'display-name' && !isOwned && !hasEnoughCredits) || (item.type === 'display-name' && !hasEnoughCredits);
    form.append(button);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const displayName = form.elements.displayName?.value || '';
      if (item.type === 'display-name' && !displayName.trim()) {
        setShopMessage('새 닉네임을 입력해 주세요.', true);
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
  if (!currentProfile) setShopMessage('상점을 이용하려면 먼저 게임 홈에서 로그인하세요.');
  else setShopMessage('미니게임에서 크레딧을 모아 프로필을 꾸며보세요.');
}

async function purchaseShopItem(itemId, displayName, button) {
  if (!activePlayer) {
    setShopMessage('상점을 이용하려면 먼저 게임 홈에서 로그인하세요.', true);
    return;
  }
  button.disabled = true;
  setShopMessage('구매를 처리하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/shop/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, displayName })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '구매를 완료하지 못했습니다.');
    currentProfile = result.profile;
    setShopMessage(`${result.profile.name} 프로필을 업데이트했습니다.`);
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
      body: JSON.stringify({ itemId })
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
  ensureScoreServer();
  const response = await fetch('/api/leaderboard');
  if (!response.ok) throw new Error('점수판을 불러오지 못했습니다.');
  const data = await response.json();
  activePlayer = data.currentUser;
  renderScoreboard(data);
  setPlayerMessage(data.currentUser
    ? `${data.currentUser.name}님의 점수판을 불러왔어요.`
    : '서버 연결됨 · 로그인 없이 플레이하면 게스트로 기록이 저장되지 않아요.');
  await loadActiveInvestment();
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === 'register';
  document.querySelector('#auth-nickname').hidden = !isRegister;
  document.querySelector('#auth-nickname').required = isRegister;
  document.querySelector('#auth-password').autocomplete = isRegister ? 'new-password' : 'current-password';
  document.querySelector('#auth-submit').firstChild.textContent = isRegister ? '가입하기 ' : '로그인 ';
  document.querySelector('#auth-toggle').textContent = isRegister ? '로그인으로' : '회원가입';
}

async function submitAuth(event) {
  event.preventDefault();
  const form = document.querySelector('#player-form');
  const submit = document.querySelector('#auth-submit');
  const isRegister = authMode === 'register';
  const body = {
    loginId: form.elements.loginId.value.trim(),
    password: form.elements.password.value
  };
  if (isRegister) body.nickname = form.elements.nickname.value.trim();
  submit.disabled = true;
  setPlayerMessage(isRegister ? '계정을 만들고 있습니다.' : '로그인하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '인증에 실패했습니다.');
    form.reset();
    setAuthMode('login');
    await refreshScoreboard();
    setPlayerMessage(isRegister
      ? `${result.user.name}님, 가입을 환영합니다. 환영 보상 500 CR을 지급했어요.`
      : `${result.user.name}님, 다시 오신 것을 환영합니다.`);
  } catch (error) {
    setPlayerMessage(error.message || '점수 서버에 연결할 수 없습니다.', true);
  } finally {
    submit.disabled = false;
  }
}

async function logout() {
  try {
    ensureScoreServer();
    await fetch('/api/auth/logout', { method: 'POST' });
    await refreshScoreboard();
    setPlayerMessage('로그아웃했습니다.');
  } catch (error) {
    setPlayerMessage(error.message || '로그아웃하지 못했습니다.', true);
  }
}

async function awardScore(game, points, play = {}) {
  const earned = Math.max(0, Math.floor(points));
  try {
    ensureScoreServer();
    const response = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, points: earned, ...(play.playId ? { playId: play.playId, durationMs: play.durationMs } : {}) })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '점수 저장에 실패했습니다.');
    handleInvestmentProgress(result);
    showMissionResult(game, earned, result);
    if (result.saved) {
      await refreshScoreboard();
      setShopMessage(`임무 보상으로 ${formatPoints(result.creditsEarned)} CR을 획득했습니다.`);
    } else {
      setPlayerMessage('게스트 플레이 결과는 저장되지 않아요. 로그인하면 기록과 보상이 쌓입니다.');
    }
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
  document.querySelector('#investment-cancel-option').hidden = !selectedRisk;
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
    element.disabled = !currentProfile || Boolean(activeInvestment) || investmentRequestPending;
  });
  startButton.disabled = !currentProfile || Boolean(activeInvestment) || investmentRequestPending || stake > balance || !selectedRisk;
  progress.hidden = !activeInvestment;
  if (!activeInvestment) return;

  const gameNames = Object.fromEntries(scoreGames.map((game) => [game.id, game.title]));
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

async function loadActiveInvestment() {
  if (!activePlayer) {
    activeInvestment = null;
    renderInvestment();
    return;
  }
  ensureScoreServer();
  const response = await fetch('/api/investment/active');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '진행 중인 투자 임무를 불러오지 못했습니다.');
  activeInvestment = result.run;
  renderInvestment();
}

async function startInvestment(event) {
  event.preventDefault();
  if (!activePlayer || !selectedRisk) {
    setInvestmentMessage('투자는 로그인 후 이용할 수 있어요. 위험 옵션도 선택해 주세요.', true);
    return;
  }
  const stake = Number(document.querySelector('#investment-stake-number').value);
  const option = investmentOptions.find((item) => item.id === selectedRisk);
  if (!option || !Number.isInteger(stake) || stake < 1 || stake > (currentProfile?.credits || 0)) {
    setInvestmentMessage('투자 금액과 위험 옵션을 다시 확인해 주세요.', true);
    return;
  }
  document.querySelector('#investment-confirm-stake').textContent = `${formatPoints(stake)} CR`;
  document.querySelector('#investment-confirm-risk').textContent = option.name;
  document.querySelector('#investment-confirm-dialog').showModal();
}

async function confirmInvestmentStart() {
  if (investmentRequestPending || !activePlayer || !selectedRisk) return;
  const stake = Number(document.querySelector('#investment-stake-number').value);
  const option = investmentOptions.find((item) => item.id === selectedRisk);
  if (!option || !Number.isInteger(stake) || stake < 1 || stake > (currentProfile?.credits || 0)) {
    setInvestmentMessage('투자 금액과 위험 옵션을 다시 확인해 주세요.', true);
    return;
  }
  investmentRequestPending = true;
  renderInvestment();
  setInvestmentMessage('투자 임무를 준비하고 있습니다.');
  try {
    ensureScoreServer();
    const response = await fetch('/api/investment/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stake,
        risk: selectedRisk
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '투자 임무를 시작하지 못했습니다.');
    activeInvestment = result.run;
    await refreshScoreboard();
    renderInvestment();
    setInvestmentMessage('투자금이 예치됐습니다. 아래 시작 버튼을 눌러 첫 임무를 진행해 주세요.');
  } catch (error) {
    setInvestmentMessage(error.message || '투자 임무를 시작하지 못했습니다.', true);
  } finally {
    investmentRequestPending = false;
    renderInvestment();
  }
}

async function launchNextInvestmentGame() {
  const nextGame = activeInvestment?.games[activeInvestment.progress];
  if (!nextGame) return;
  await openGame(nextGame, true, (message) => {
    showView('investment');
    setInvestmentMessage(message, true);
  }, true);
}

function handleInvestmentProgress(result) {
  if (result.investment) {
    activeInvestment = result.investment.status === 'active' ? result.investment : null;
    renderInvestment();
    if (result.investment.status === 'completed') {
      pendingInvestmentSettlement = result.investment;
      setInvestmentMessage('투자 임무를 완료하고 정산했습니다.');
    }
  } else if (result.reroll) {
    selectedRisk = result.reroll;
    renderInvestmentOptions();
    setInvestmentMessage('미투자 임무 완료 보너스로 투자 옵션을 다시 뽑았습니다.');
  }
}

function continueInvestmentRun() {
  showView('investment');
  if (pendingInvestmentSettlement) {
    const investment = pendingInvestmentSettlement;
    pendingInvestmentSettlement = null;
    document.querySelector('#investment-result-title').textContent = `투자 결과 · ${investment.outcomeName}`;
    document.querySelector('#investment-result-copy').textContent =
      `${formatPoints(investment.stake)} CR 투자 · ${investment.riskName} · 배율 ×${investment.multiplier}`;
    const net = investment.reward - investment.stake;
    document.querySelector('#investment-result-amount').textContent =
      `${net >= 0 ? '+' : ''}${formatPoints(net)} CR`;
    document.querySelector('#investment-result-dialog').showModal();
  }
}
const gameModules = new Map();
const gameLoads = new Map();
let gameLoader = null;
window.Playground = { getBest, saveBest, awardScore };

function validateLifecycle(id, lifecycle) {
  if (!lifecycle || typeof lifecycle !== 'object' ||
      ['onLaunch', 'onStart', 'onShow', 'onHide', 'onReset'].some((method) => lifecycle[method] !== undefined && typeof lifecycle[method] !== 'function')) {
    throw new Error(`잘못된 게임 생명주기입니다: ${id}`);
  }
  return lifecycle;
}

// 전용 화면(index.html의 view-<id>)과 games/<id>.js 어댑터가 모두 있으면 그것을, 아니면 매니페스트만으로 기본 화면을 만듭니다.
async function loadLifecycle(game) {
  const customView = document.querySelector(`#view-${game.id}`);
  if (customView && game.adapter) {
    gameLoader ??= import('/games/index.js');
    const loader = await gameLoader;
    const module = await loader.loadGameModule(game.id);
    return validateLifecycle(game.id, module.default);
  }
  const section = customView || document.createElement('section');
  if (!customView) {
    section.className = 'view game-view';
    section.id = `view-${game.id}`;
    document.querySelector('#view-shop').parentElement.append(section);
  }
  const { createGenericGame } = await import('/shell/generic-game.js');
  return validateLifecycle(game.id, createGenericGame(game, section));
}

function showView(name) {
  const target = document.querySelector(`#view-${name}`);
  if (!Object.hasOwn(titles, name) || !target) {
    throw new Error(`등록되지 않은 화면입니다: ${name}`);
  }
  const previous = document.querySelector('.view.is-visible');
  const previousGame = previous?.id.replace(/^view-/, '');
  if (previousGame && previousGame !== name && gameCatalogById.has(previousGame)) {
    const lifecycle = gameModules.get(previousGame);
    lifecycle?.onHide?.();
    lifecycle?.onReset?.();
  }
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('is-visible', view === target));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.view === name));
  breadcrumbCurrent.textContent = titles[name];
  gameModules.get(name)?.onShow?.();
  if (name === 'investment' && activePlayer) {
    loadActiveInvestment().catch((error) => setInvestmentMessage(error.message || '투자 정보를 불러오지 못했습니다.', true));
  }
}

async function openGame(id, shouldLaunch, onError = (message) => {
  showView('home');
  setPlayerMessage(message, true);
}, startImmediately = false) {
  try {
    const game = getGame(id);
    if (!gameLoads.has(id) && !gameModules.has(id)) {
      const loading = loadLifecycle(game).then((lifecycle) => {
        gameModules.set(id, lifecycle);
        return lifecycle;
      }).catch((error) => {
        gameLoads.delete(id);
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`${game.title} 모듈 로드 실패: ${reason}`);
      });
      gameLoads.set(id, loading);
    }
    const lifecycle = gameModules.get(id) || await gameLoads.get(id);
    showView(id);
    if (shouldLaunch) lifecycle.onLaunch?.();
    if (startImmediately) await lifecycle.onStart?.();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onError(message);
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  const view = button.dataset.view;
  if (gameCatalogById.has(view)) openGame(view, false);
  else showView(view);
});
gameGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-launch]');
  if (button) openGame(button.dataset.launch, true);
});
document.querySelector('#investment-form').addEventListener('submit', startInvestment);
document.querySelector('#investment-cancel-option').addEventListener('click', () => {
  selectedRisk = null;
  renderInvestmentOptions();
  renderInvestment();
  setInvestmentMessage('위험 옵션 선택을 취소했습니다.');
});
document.querySelector('#investment-confirm-cancel').addEventListener('click', () => {
  document.querySelector('#investment-confirm-dialog').close();
});
document.querySelector('#investment-confirm-submit').addEventListener('click', () => {
  document.querySelector('#investment-confirm-dialog').close();
  confirmInvestmentStart();
});
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
document.querySelector('#investment-next-game').addEventListener('click', async () => {
  await launchNextInvestmentGame();
});
document.querySelector('#investment-result-confirm').addEventListener('click', () => {
  document.querySelector('#investment-result-dialog').close();
});
document.querySelector('#investment-result-dialog').addEventListener('close', () => showView('investment'));
document.querySelector('#mission-result-confirm').addEventListener('click', () => {
  document.querySelector('#mission-result-dialog').close();
});
document.querySelector('#mission-result-dialog').addEventListener('close', continueInvestmentRun);
loadShopItems().catch((error) => setShopMessage(error.message || '상점에 연결할 수 없습니다.', true));
loadInvestmentOptions().catch((error) => setInvestmentMessage(error.message || '투자 옵션을 불러올 수 없습니다.', true));
document.querySelector('#player-form').addEventListener('submit', submitAuth);
document.querySelector('#auth-toggle').addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));
document.querySelector('#logout-button').addEventListener('click', logout);
renderScoreboard({ players: [], currentUser: null });
// 게임 목록을 먼저 받아야 점수판의 게임별 항목이 채워집니다.
loadGameMenu()
  .catch((error) => setPlayerMessage(error.message || '게임 목록을 불러오지 못했습니다.', true))
  .then(() => refreshScoreboard())
  .catch((error) => setPlayerMessage(error.message || 'SQLite 서버를 실행해 주세요: node server.js', true));
