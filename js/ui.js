/* -------------------------------------------------------------
   GAMING HUB - USER INTERFACE & DOM RENDERING
------------------------------------------------------------- */

(function() {
  let activeTab = 'tab-friends-list';

  // Cooked Chess UI state variables
  let chessGame = null;
  let chessLocalTime = 0; // ms
  let chessOpponentTime = 0; // ms
  let chessClockInterval = null;
  let chessSelectedSquare = null;
  let chessMyColor = 'white';
  let chessOpponentRating = 100;
  let chessOpponentName = 'Opponent';
  let chessIsBot = false;
  let chessAnalysisMoves = [];
  let chessAnalysisIndex = 0;
  let chessIsAnalysisMode = false;
  let chessTimeControl = 'Blitz';

  // Toggle active screen
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(scr => {
      scr.classList.add('hidden');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.remove('hidden');
    }
    
    window.GamingHubState.state.activeScreen = screenId;

    // Hide/show header
    const header = document.getElementById('app-header');
    if (screenId === 'screen-login') {
      header.classList.add('hidden');
    } else {
      header.classList.remove('hidden');
      updateHeader();
    }

    if (screenId === 'screen-dashboard') {
      if (window.GamingHubState.replenishCash()) {
        showToast("Here is a free $1,000 to get you back in the action!");
        updateHeader();
      }
    }

    if (screenId === 'screen-stats') {
      updateStatsPage();
    }
  }

  function showChessInviteModal(sender, timeControl) {
    const modal = document.getElementById('modal-invite-chess');
    if (!modal) return;
    
    document.getElementById('invite-chess-sender-name').innerText = sender;
    document.getElementById('invite-chess-tc').innerText = `${timeControl}`;
    modal.classList.remove('hidden');
    window.GamingHubAudio.play('deal');
  }

  function showNitroInviteModal(sender) {
    const modal = document.getElementById('modal-invite-nitro');
    if (!modal) return;
    
    document.getElementById('invite-nitro-sender-name').innerText = sender;
    modal.classList.remove('hidden');
    window.GamingHubAudio.play('deal');
  }

  function showHexanautInviteModal(sender) {
    const modal = document.getElementById('modal-invite-hexanaut');
    if (!modal) return;
    
    document.getElementById('invite-hexanaut-sender-name').innerText = sender;
    modal.classList.remove('hidden');
    window.GamingHubAudio.play('deal');
  }

  // Update header labels
  function updateHeader() {
    const user = window.GamingHubState.state.currentUser;
    if (user) {
      document.getElementById('hdr-username').innerText = user.username;
      document.getElementById('hdr-avatar').innerText = user.username[0].toUpperCase();
      
      // Update welcome banner stats if on dashboard
      const welcomeName = document.getElementById('welcome-username');
      if (welcomeName) welcomeName.innerText = user.username;
      
      const statCash = document.getElementById('stat-cash');
      if (statCash) statCash.innerText = `$${user.totalCash.toLocaleString()}`;
      
      const statWins = document.getElementById('stat-wins');
      if (statWins) statWins.innerText = user.wins;
      
      const statHands = document.getElementById('stat-hands');
      if (statHands) statHands.innerText = user.handsPlayed;

      const dashNitro = document.getElementById('dash-nitro-stats');
      if (dashNitro) {
        dashNitro.innerText = `Lvl ${user.nitroTypeLevel || 1} (⭐${user.nitroTypeStars || 0})`;
      }

      if (window.GamingHubState.state.activeScreen === 'screen-stats') {
        updateStatsPage();
      }
    }
  }

  function renderPokerLeaderboard() {
    const container = document.getElementById('poker-leaderboard-list');
    if (!container) return;
    container.innerHTML = '';
    
    let accounts = {};
    try {
      const saved = localStorage.getItem('gaming_hub_accounts_db');
      if (saved) accounts = JSON.parse(saved);
    } catch(e) {}
    
    const botUsernames = ['magnusmini', 'hikarufan', 'pokerqueen', 'blunderking', 'rookandroll'];
    const list = Object.values(accounts)
      .filter(acc => acc && acc.username && !botUsernames.includes(acc.username.toLowerCase()))
      .map(acc => ({
        username: acc.username,
        wins: (acc.stats && acc.stats.wins) || 0
      }));
    
    list.sort((a, b) => b.wins - a.wins);
    
    if (list.length === 0) {
      container.innerHTML = '<div class="leaderboard-row empty">No registered players yet.</div>';
      return;
    }
    
    list.forEach((player, index) => {
      const rankNum = index + 1;
      const row = document.createElement('div');
      row.className = `leaderboard-row rank-${rankNum <= 3 ? rankNum : 'other'}`;
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; width:18px;">#${rankNum}</span>
          <strong>${player.username}</strong>
        </div>
        <span style="font-weight:600; color:var(--accent-purple);">${player.wins} Wins</span>
      `;
      container.appendChild(row);
    });
  }

  function renderChessLeaderboard(sortByCategory = 'blitz') {
    const container = document.getElementById('chess-leaderboard-list');
    if (!container) return;
    container.innerHTML = '';
    
    let accounts = {};
    try {
      const saved = localStorage.getItem('gaming_hub_accounts_db');
      if (saved) accounts = JSON.parse(saved);
    } catch(e) {}
    
    const botUsernames = ['magnusmini', 'hikarufan', 'pokerqueen', 'blunderking', 'rookandroll'];
    const list = Object.values(accounts)
      .filter(acc => acc && acc.username && !botUsernames.includes(acc.username.toLowerCase()))
      .map(acc => {
        const ratings = (acc.stats && acc.stats.chessRatings) || { bullet: 100, blitz: 100, rapid: 100 };
        return {
          username: acc.username,
          rating: ratings[sortByCategory] || 100
        };
      });
    
    list.sort((a, b) => b.rating - a.rating);
    
    if (list.length === 0) {
      container.innerHTML = '<div class="leaderboard-row empty">No registered players yet.</div>';
      return;
    }
    
    list.forEach((player, index) => {
      const rankNum = index + 1;
      const row = document.createElement('div');
      row.className = `leaderboard-row rank-${rankNum <= 3 ? rankNum : 'other'}`;
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; width:18px;">#${rankNum}</span>
          <strong>${player.username}</strong>
        </div>
        <span style="font-weight:600; color:var(--color-green);">${player.rating} ELO</span>
      `;
      container.appendChild(row);
    });
  }

  // Update stats page UI
  function updateStatsPage() {
    const user = window.GamingHubState.state.currentUser;
    if (!user) return;

    const statsWins = document.getElementById('stats-poker-wins');
    if (statsWins) statsWins.innerText = user.wins || 0;

    const statsCash = document.getElementById('stats-poker-cash');
    if (statsCash) statsCash.innerText = `$${(user.totalCash || 0).toLocaleString()}`;

    // Rank calculation based on wins
    let rank = "Novice";
    const wins = user.wins || 0;
    if (wins > 100) rank = "God";
    else if (wins > 75) rank = "Legendary";
    else if (wins > 50) rank = "Mythic";
    else if (wins > 30) rank = "Pro";
    else if (wins > 20) rank = "Semi-Pro";
    else if (wins > 10) rank = "Starter";
    
    const statsRank = document.getElementById('stats-poker-rank');
    if (statsRank) statsRank.innerText = rank;

    // History list
    const historyContainer = document.getElementById('poker-history-list');
    if (historyContainer) {
      historyContainer.innerHTML = '';
      const history = user.matchHistory || [];
      if (history.length === 0) {
        historyContainer.innerHTML = '<div class="history-item empty">No matches completed yet.</div>';
      } else {
        history.forEach(item => {
          if (!item || !item.result) return;
          const div = document.createElement('div');
          let dateStr = '';
          try {
            if (item.time) {
              dateStr = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          } catch(e) {
            console.warn("Error parsing date in history:", e);
          }
          const amt = item.amount || 0;
          div.className = `history-item ${item.result.toLowerCase()}`;
          div.innerHTML = `
            <span>Match Result: <strong>${item.result}</strong></span>
            <span style="color:${item.result === 'WIN' ? 'var(--color-green)' : 'var(--color-red)'}; font-weight:600;">
              ${item.result === 'WIN' ? '+' : '-'}$${amt.toLocaleString()}
            </span>
            <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
          `;
          historyContainer.appendChild(div);
        });
      }
    }

    // Chess Stats
    const chessHistory = user.chessHistory || [];
    
    const bulletGames = (user.chessGamesCount && user.chessGamesCount.bullet) || 0;
    const bulletRating = (user.chessRatings && user.chessRatings.bullet) || 100;
    const bulletVal = document.getElementById('stats-chess-bullet');
    if (bulletVal) {
      const bulletHist = chessHistory.filter(h => h.timeControl.toLowerCase() === 'bullet');
      const hasLoss = bulletHist.some(h => h.result === 'LOSS');
      const hasWin = bulletHist.some(h => h.result === 'WIN' || h.result === 'DRAW');
      const isPatternBroken = hasLoss && hasWin;
      if (bulletGames < 10) {
        bulletVal.innerHTML = `${bulletRating} <span style="font-size: 0.75rem; font-weight: 500; opacity: 0.8; color: var(--accent-purple); display: block; margin-top: 0.2rem;">${bulletGames} out of 10 games</span>`;
      } else if (!isPatternBroken) {
        const label = !hasLoss ? 'Calibration (Undefeated)' : 'Calibration (Winless)';
        bulletVal.innerHTML = `${bulletRating} <span style="font-size: 0.75rem; font-weight: 500; opacity: 0.8; color: var(--accent-purple); display: block; margin-top: 0.2rem;">${label}</span>`;
      } else {
        bulletVal.innerHTML = bulletRating;
      }
    }

    const blitzGames = (user.chessGamesCount && user.chessGamesCount.blitz) || 0;
    const blitzRating = (user.chessRatings && user.chessRatings.blitz) || 100;
    const blitzVal = document.getElementById('stats-chess-blitz');
    if (blitzVal) {
      const blitzHist = chessHistory.filter(h => h.timeControl.toLowerCase() === 'blitz');
      const hasLoss = blitzHist.some(h => h.result === 'LOSS');
      const hasWin = blitzHist.some(h => h.result === 'WIN' || h.result === 'DRAW');
      const isPatternBroken = hasLoss && hasWin;
      if (blitzGames < 10) {
        blitzVal.innerHTML = `${blitzRating} <span style="font-size: 0.75rem; font-weight: 500; opacity: 0.8; color: var(--accent-purple); display: block; margin-top: 0.2rem;">${blitzGames} out of 10 games</span>`;
      } else if (!isPatternBroken) {
        const label = !hasLoss ? 'Calibration (Undefeated)' : 'Calibration (Winless)';
        blitzVal.innerHTML = `${blitzRating} <span style="font-size: 0.75rem; font-weight: 500; opacity: 0.8; color: var(--accent-purple); display: block; margin-top: 0.2rem;">${label}</span>`;
      } else {
        blitzVal.innerHTML = blitzRating;
      }
    }

    const gridRapidGames = (user.chessGamesCount && user.chessGamesCount.rapid) || 0;
    const rapidRating = (user.chessRatings && user.chessRatings.rapid) || 100;
    const rapidVal = document.getElementById('stats-chess-rapid');
    if (rapidVal) {
      const rapidHist = chessHistory.filter(h => h.timeControl.toLowerCase() === 'rapid');
      const hasLoss = rapidHist.some(h => h.result === 'LOSS');
      const hasWin = rapidHist.some(h => h.result === 'WIN' || h.result === 'DRAW');
      const isPatternBroken = hasLoss && hasWin;
      if (gridRapidGames < 10) {
        rapidVal.innerHTML = `${rapidRating} <span style="font-size: 0.75rem; font-weight: 500; opacity: 0.8; color: var(--accent-purple); display: block; margin-top: 0.2rem;">${gridRapidGames} out of 10 games</span>`;
      } else if (!isPatternBroken) {
        const label = !hasLoss ? 'Calibration (Undefeated)' : 'Calibration (Winless)';
        rapidVal.innerHTML = `${rapidRating} <span style="font-size: 0.75rem; font-weight: 500; opacity: 0.8; color: var(--accent-purple); display: block; margin-top: 0.2rem;">${label}</span>`;
      } else {
        rapidVal.innerHTML = rapidRating;
      }
    }

    const chessHistoryContainer = document.getElementById('chess-history-list');
    if (chessHistoryContainer) {
      chessHistoryContainer.innerHTML = '';
      const chessHistory = user.chessHistory || [];
      if (chessHistory.length === 0) {
        chessHistoryContainer.innerHTML = '<div class="history-item empty">No chess matches completed yet.</div>';
      } else {
        chessHistory.forEach((item, idx) => {
          if (!item) return;
          const div = document.createElement('div');
          let dateStr = '';
          try {
            if (item.time) {
              dateStr = new Date(item.time).toLocaleDateString([], { month: 'short', day: 'numeric' });
            }
          } catch(e) {}
          
          div.className = `history-item ${item.result.toLowerCase()}`;
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';
          
          div.innerHTML = `
            <div>
              <strong>${item.timeControl} Chess vs ${item.opponent}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">${dateStr} • Result: <strong>${item.result}</strong></div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="color:${item.result === 'WIN' ? 'var(--color-green)' : 'var(--color-red)'}; font-weight:600;">
                ${item.result === 'WIN' ? '+' : ''}${item.ratingChange} ELO
              </span>
              <button class="btn btn-primary btn-sm" style="font-size:0.7rem; padding: 0.2rem 0.5rem;" onclick="window.GamingHubChessUI.startAnalysis(${idx})">Analyze</button>
            </div>
          `;
          chessHistoryContainer.appendChild(div);
        });
      }
    }
    
    // Render leaderboards
    renderPokerLeaderboard();
    const activePill = document.getElementById('chess-leaderboard-pills')?.querySelector('.pill-btn.active');
    const chessSortCat = activePill ? activePill.getAttribute('data-sort-cat') : 'blitz';
    renderChessLeaderboard(chessSortCat);

    // Nitro Stats
    const statsNitroLvl = document.getElementById('stats-nitro-level');
    if (statsNitroLvl) statsNitroLvl.innerText = user.nitroTypeLevel || 1;
    const statsNitroStars = document.getElementById('stats-nitro-stars');
    if (statsNitroStars) statsNitroStars.innerText = `${user.nitroTypeStars || 0} / 3`;
    const statsNitroCoins = document.getElementById('stats-nitro-coins');
    if (statsNitroCoins) statsNitroCoins.innerText = user.nitroTypeCoins || 0;
    
    const statsNitroEquipped = document.getElementById('stats-nitro-equipped');
    if (statsNitroEquipped) {
      const equippedCar = user.nitroTypeEquippedCar || 'rust_bucket';
      const carConfig = SHOP_CARS.find(c => c.id === equippedCar);
      statsNitroEquipped.innerText = carConfig ? `${carConfig.name} (+${(carConfig.boost * 100).toFixed(1)}%)` : 'Rust Bucket (+0.0%)';
    }

    const carsListContainer = document.getElementById('stats-nitro-cars-list');
    if (carsListContainer) {
      carsListContainer.innerHTML = '';
      const owned = user.nitroTypeCars || ['rust_bucket'];
      owned.forEach(carId => {
        const car = SHOP_CARS.find(c => c.id === carId);
        if (car) {
          const span = document.createElement('span');
          span.innerText = car.emoji;
          span.title = `${car.name} (+${(car.boost * 100).toFixed(1)}% Boost)`;
          span.style.fontSize = '1.8rem';
          span.style.background = 'rgba(255,255,255,0.05)';
          span.style.padding = '0.25rem 0.5rem';
          span.style.borderRadius = '6px';
          span.style.border = '1px solid rgba(255,255,255,0.05)';
          carsListContainer.appendChild(span);
        }
      });
    }

    renderNitroLeaderboard();

    // Hexanaut Stats
    const statsHexanautLvl = document.getElementById('stats-hexanaut-level');
    if (statsHexanautLvl) statsHexanautLvl.innerText = user.hexanautLevel || 1;
    const statsHexanautMaxPercent = document.getElementById('stats-hexanaut-max-percent');
    if (statsHexanautMaxPercent) statsHexanautMaxPercent.innerText = `${(user.hexanautMaxPercent || 0).toFixed(1)}%`;
    const statsHexanautCoins = document.getElementById('stats-hexanaut-coins');
    if (statsHexanautCoins) statsHexanautCoins.innerText = user.hexanautCoins || 0;
    const statsHexanautGames = document.getElementById('stats-hexanaut-games');
    if (statsHexanautGames) statsHexanautGames.innerText = user.hexanautGamesCount || 0;
    const statsHexanautWins = document.getElementById('stats-hexanaut-wins');
    if (statsHexanautWins) statsHexanautWins.innerText = user.hexanautWins || 0;

    renderHexanautLeaderboard();

    // Flappy Stats
    const statsFlappyHigh = document.getElementById('stats-flappy-highscore');
    if (statsFlappyHigh) statsFlappyHigh.innerText = user.flappyHighScore || 0;
    const statsFlappyGames = document.getElementById('stats-flappy-games');
    if (statsFlappyGames) statsFlappyGames.innerText = user.flappyGames || 0;

    // TicTacToe Stats
    const statsTTTWins = document.getElementById('stats-tictactoe-wins');
    if (statsTTTWins) statsTTTWins.innerText = user.tictactoeWins || 0;
    const statsTTTLosses = document.getElementById('stats-tictactoe-losses');
    if (statsTTTLosses) statsTTTLosses.innerText = user.tictactoeLosses || 0;
    const statsTTTDraws = document.getElementById('stats-tictactoe-draws');
    if (statsTTTDraws) statsTTTDraws.innerText = user.tictactoeDraws || 0;

    // Snake Stats
    const statsSnakeHigh = document.getElementById('stats-snake-highscore');
    if (statsSnakeHigh) statsSnakeHigh.innerText = user.snakeHighScore || 0;
    const statsSnakeGames = document.getElementById('stats-snake-games');
    if (statsSnakeGames) statsSnakeGames.innerText = user.snakeGames || 0;

    // 2048 Stats
    const stats2048Tile = document.getElementById('stats-2048-tile');
    if (stats2048Tile) stats2048Tile.innerText = user.highest2048Tile || 0;
    const stats2048Games = document.getElementById('stats-2048-games');
    if (stats2048Games) stats2048Games.innerText = user.games2048 || 0;

    // Minesweeper Stats
    const statsMinesTime = document.getElementById('stats-minesweeper-time');
    if (statsMinesTime) statsMinesTime.innerText = `${user.minesweeperFastestTime || 999}s`;
    const statsMinesWins = document.getElementById('stats-minesweeper-wins');
    if (statsMinesWins) statsMinesWins.innerText = user.minesweeperWins || 0;
    const statsMinesGames = document.getElementById('stats-minesweeper-games');
    if (statsMinesGames) statsMinesGames.innerText = user.minesweeperGames || 0;
  }

  // Toast notifications
  function showToast(message, isError = false) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'toast-error' : ''}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    
    // Play alert sound for non-errors
    if (!isError) {
      window.GamingHubAudio.play('deal'); // Soft chime
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px) scale(0.9)';
      setTimeout(() => {
        container.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Friends drawer visibility toggle
  function toggleFriendsDrawer(open) {
    const drawer = document.getElementById('friends-drawer');
    if (open) {
      drawer.classList.add('open');
      renderFriendsList();
    } else {
      drawer.classList.remove('open');
    }
  }

  // Render friends tab inside drawer
  function renderFriendsList() {
    const container = document.getElementById('friends-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    const friends = window.GamingHubState.state.friends;

    if (friends.length === 0) {
      container.innerHTML = '<li class="section-desc text-center">No friends added yet.</li>';
      return;
    }

    // Sort: Online first, then alphabetical
    const sorted = [...friends].sort((a,b) => {
      if (a.online !== b.online) return b.online - a.online;
      return a.username.localeCompare(b.username);
    });

    sorted.forEach(friend => {
      const li = document.createElement('li');
      li.className = 'friend-item';
      
      const initial = friend.username[0].toUpperCase();
      const statusText = friend.online ? 'Online' : 'Offline';
      const statusClass = friend.online ? 'online' : 'offline';
      
      li.innerHTML = `
        <div class="friend-meta">
          <div class="avatar avatar-sm">${initial}</div>
          <div class="friend-info">
            <span class="friend-name">${friend.username}</span>
            <span class="friend-status ${statusClass}">
              <span class="status-dot"></span>${statusText}
            </span>
          </div>
        </div>
        <div class="friend-actions-btns">
          <button class="btn btn-secondary btn-sm btn-friend-chat" data-name="${friend.username}" title="Chat">💬</button>
          ${friend.online ? `
            <button class="btn btn-primary btn-sm btn-friend-invite" data-name="${friend.username}" title="Invite to Poker">♠️</button>
            <button class="btn btn-primary btn-sm btn-friend-invite-chess" data-name="${friend.username}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); margin-left: 0.25rem;" title="Invite to Chess">♟️</button>
            <button class="btn btn-primary btn-sm btn-friend-invite-nitro" data-name="${friend.username}" style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); margin-left: 0.25rem;" title="Invite to Nitro Type">🏎️</button>
            <button class="btn btn-primary btn-sm btn-friend-invite-hexanaut" data-name="${friend.username}" style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); margin-left: 0.25rem;" title="Invite to Hexanaut.io">🟢</button>
          ` : ''}
          <button class="btn btn-secondary btn-sm btn-friend-remove" data-name="${friend.username}" title="Remove Friend" style="color: var(--color-red); border-color: rgba(239, 68, 68, 0.3);">✕</button>
        </div>
      `;
      
      container.appendChild(li);
    });
  }

  // Open active chat panel with a friend
  function openChat(friendUsername) {
    window.GamingHubState.state.activeChatFriend = friendUsername;
    
    // Switch tab to Chat
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === 'tab-chats') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    document.querySelectorAll('.tab-panel').forEach(panel => {
      if (panel.id === 'tab-chats') {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    document.getElementById('no-chat-selected').classList.add('hidden');
    
    const chatPanel = document.getElementById('active-chat-panel');
    chatPanel.classList.remove('hidden');
    
    document.getElementById('chat-header-username').innerText = friendUsername;
    
    updateActiveChat();
  }

  // Redraw messages inside chat panel
  function updateActiveChat() {
    const friendUsername = window.GamingHubState.state.activeChatFriend;
    if (!friendUsername) return;

    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = '';
    const friend = window.GamingHubState.state.friends.find(f => f.username.toLowerCase() === friendUsername.toLowerCase());
    
    if (friend && friend.chatHistory) {
      friend.chatHistory.forEach(msg => {
        const bubble = document.createElement('div');
        const isSent = (msg.sender !== friend.username);
        bubble.className = `msg-bubble ${isSent ? 'msg-sent' : 'msg-received'}`;
        bubble.innerText = msg.text;
        container.appendChild(bubble);
      });
    }

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  // Show Game Invite popup modal
  let inviteTimer = null;
  function showInviteModal(senderUsername) {
    if (inviteTimer) {
      clearTimeout(inviteTimer);
      inviteTimer = null;
    }

    const modal = document.getElementById('modal-invite');
    document.getElementById('invite-sender-name').innerText = senderUsername;
    modal.classList.remove('hidden');
    
    const clearTimer = () => {
      if (inviteTimer) {
        clearTimeout(inviteTimer);
        inviteTimer = null;
      }
    };

    // Hook up buttons once
    document.getElementById('btn-accept-invite').onclick = () => {
      clearTimer();
      modal.classList.add('hidden');
      window.GamingHubSync.respondToInvite(senderUsername, true);
    };
    
    document.getElementById('btn-decline-invite').onclick = () => {
      clearTimer();
      modal.classList.add('hidden');
      window.GamingHubSync.respondToInvite(senderUsername, false);
    };

    // 15 seconds timer
    inviteTimer = setTimeout(() => {
      inviteTimer = null;
      modal.classList.add('hidden');
      window.GamingHubSync.respondToInvite(senderUsername, false);
      
      const tooLateModal = document.getElementById('modal-too-late');
      if (tooLateModal) {
        tooLateModal.classList.remove('hidden');
      }
    }, 15000);
  }

  // Show Friend Request popup modal
  function showFriendRequestModal(senderUsername) {
    const modal = document.getElementById('modal-friend-request');
    document.getElementById('friend-request-sender-name').innerText = senderUsername;
    modal.classList.remove('hidden');
    
    // Hook up buttons once
    document.getElementById('btn-accept-friend').onclick = () => {
      modal.classList.add('hidden');
      window.GamingHubSync.respondToFriendRequest(senderUsername, true);
    };
    
    document.getElementById('btn-decline-friend').onclick = () => {
      modal.classList.add('hidden');
      window.GamingHubSync.respondToFriendRequest(senderUsername, false);
    };
  }

  // Render Matchmaking Screen
  function renderMatchmakingLobby(playersList, secondsLeft, isChess = false) {
    const timerEl = document.getElementById('matchmaking-timer');
    if (timerEl) {
      timerEl.innerText = secondsLeft > 0 ? secondsLeft : 'GO';
    }

    const grid = document.getElementById('lobby-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (isChess === 'hexanaut') {
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(90px, 1fr))';
      grid.style.maxHeight = '280px';
      grid.style.overflowY = 'auto';
      grid.style.paddingRight = '5px';
    } else {
      grid.style.gridTemplateColumns = '';
      grid.style.maxHeight = '';
      grid.style.overflowY = '';
      grid.style.paddingRight = '';
    }

    let maxSlots = 8;
    const sub = document.querySelector('#screen-matchmaking .subtitle');
    if (isChess === 'hexanaut') {
      maxSlots = Math.max(20, playersList.length);
      if (maxSlots > 30) maxSlots = 30;
      if (sub) sub.innerText = `Hexanaut.io • 20 to 30 Players Required (Current: ${playersList.length})`;
    } else if (isChess === 'nitro') {
      maxSlots = 5;
      if (sub) sub.innerText = `Nitro Type • 5 Players Required`;
    } else if (isChess === 'chess' || isChess === true) {
      maxSlots = 2;
      if (sub) sub.innerText = `Cooked Chess • 2 Players Required`;
    } else {
      if (sub) sub.innerText = `Texas Hold'em Poker • 8 Players Required`;
    }

    for (let i = 0; i < maxSlots; i++) {
      const slot = document.createElement('div');
      
      if (i < playersList.length) {
        const player = playersList[i];
        slot.className = 'lobby-slot filled';
        
        let statText = '$1,000';
        if (isChess === 'nitro' || isChess === 'hexanaut') {
          statText = `Level ${player.level || 1}`;
        } else if (isChess === 'chess' || isChess === true) {
          statText = `Rating: ${player.rating || 100}`;
        }

        if (isChess === 'hexanaut') {
          slot.style.padding = '0.5rem 0.25rem';
          slot.innerHTML = `
            <div class="avatar avatar-md" style="font-size:0.9rem; width: 32px; height: 32px; margin-bottom: 4px;">${player.username[0].toUpperCase()}</div>
            <div class="lobby-slot-name" style="font-size:0.7rem; max-width:80px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-bottom: 2px;">${player.username}</div>
            <div style="font-size:0.65rem;color:var(--accent-gold);">${statText}</div>
          `;
        } else {
          slot.innerHTML = `
            <div class="avatar avatar-md">${player.username[0].toUpperCase()}</div>
            <div class="lobby-slot-name">${player.username}</div>
            <div style="font-size:0.7rem;color:var(--accent-gold);">${statText}</div>
          `;
        }
      } else {
        slot.className = 'lobby-slot searching';
        if (isChess === 'hexanaut') {
          slot.style.padding = '0.5rem 0.25rem';
          slot.innerHTML = `
            <div class="avatar avatar-md searching" style="font-size:0.9rem; width: 32px; height: 32px; margin-bottom: 4px;">?</div>
            <div class="lobby-slot-name" style="font-size:0.7rem; color:var(--text-muted);">Searching...</div>
          `;
        } else {
          slot.innerHTML = `
            <div class="avatar avatar-md">?</div>
            <div class="lobby-slot-name" style="color:var(--text-muted);">Searching...</div>
          `;
        }
      }
      
      grid.appendChild(slot);
    }
  }

  // Render Poker Table Board State
  function renderGameScreen() {
    // Only render if we are actually on the game screen!
    if (window.GamingHubState.state.activeScreen !== 'screen-game') return;

    const gamePlayers = window.GamingHubPoker.getPlayers();
    if (gamePlayers.length === 0) return;

    const localUser = window.GamingHubState.state.currentUser.username;
    
    // Check if the local player is busted/lost
    const localP = gamePlayers.find(p => p.username === localUser);
    if (localP && localP.busted) {
      // Set activeScreen to dashboard immediately to prevent any re-entry or repeated toasts
      window.GamingHubState.state.activeScreen = 'screen-dashboard';
      
      if (window.GamingHubPoker && window.GamingHubPoker.settleMatch) {
        window.GamingHubPoker.settleMatch(false);
      }
      
      try {
        window.GamingHubSync.leaveActiveRoom();
      } catch (e) {
        console.error("Error leaving active room:", e);
      }
      try {
        window.GamingHubPoker.stopGame();
      } catch (e) {
        console.error("Error stopping poker game:", e);
      }
      
      showScreen('screen-dashboard');
      showToast("You ran out of chips and were kicked out of the game!");
      return;
    }

    // Find index of local player to calculate relative seating offset
    const localIndex = gamePlayers.findIndex(p => p.username === localUser);
    const seatingOffset = localIndex >= 0 ? localIndex : 0;

    // Draw Seats
    const seatsContainer = document.getElementById('player-seats');
    seatsContainer.innerHTML = '';

    for (let i = 0; i < 8; i++) {
      // Map UI seat index to rotated player index
      const playerIndex = (seatingOffset + i) % 8;
      const p = gamePlayers[playerIndex];
      
      if (!p || p.busted) continue;

      const seatDiv = document.createElement('div');
      seatDiv.className = `player-seat seat-${i}`;
      
      const isDealer = (playerIndex === window.GamingHubPoker.getDealerSeatIndex());
      const isActive = (playerIndex === window.GamingHubPoker.getActiveSeatIndex());
      const isFolded = p.folded;
      const isBusted = p.busted;
      const hasAction = p.lastAction !== '' && p.lastAction !== 'SB' && p.lastAction !== 'BB';
      
      // Cards layout HTML
      let cardsHTML = '';
      if (!isBusted && !isFolded && p.cards && p.cards.length === 2) {
        cardsHTML = `
          <div class="player-cards">
            ${getCardHTML(p.cards[0], p.username === localUser)}
            ${getCardHTML(p.cards[1], p.username === localUser)}
          </div>
        `;
      }

      // Check if they placed a bet in front of them
      let betHTML = '';
      if (p.bet > 0) {
        betHTML = `<div class="bet-bubble">$${p.bet}</div>`;
      }

      // Check if they have an active action bubble
      let actionBubbleHTML = '';
      if (hasAction) {
        actionBubbleHTML = `<div class="action-bubble">${p.lastAction}</div>`;
      }

      // Small blind or big blind markers
      let blindBadgeHTML = '';
      if (p.lastAction === 'SB') blindBadgeHTML = '<span class="blind-badge">SB</span>';
      if (p.lastAction === 'BB') blindBadgeHTML = '<span class="blind-badge">BB</span>';

      // Turn timer badge
      let turnTimerHTML = '';
      if (isActive && window.GamingHubPoker.getTurnSecondsLeft() > 0) {
        turnTimerHTML = `<div class="turn-timer-badge">${window.GamingHubPoker.getTurnSecondsLeft()}s</div>`;
      }

      seatDiv.innerHTML = `
        ${betHTML}
        <div class="player-panel ${isActive ? 'active-turn' : ''} ${isFolded ? 'folded' : ''} ${isBusted ? 'busted' : ''}">
          <div class="player-seat-avatar">
            <div class="seat-avatar-icon">${p.username[0].toUpperCase()}</div>
            ${isDealer ? '<span class="dealer-button">D</span>' : ''}
            ${blindBadgeHTML}
            ${turnTimerHTML}
          </div>
          <div class="player-panel-name">${p.username}</div>
          <div class="player-panel-chips">${isBusted ? 'BUSTED' : `$${p.cash}`}</div>
          ${cardsHTML}
          ${actionBubbleHTML}
        </div>
      `;

      seatsContainer.appendChild(seatDiv);
    }

    // Render Community Cards
    const commCards = window.GamingHubPoker.getCommunityCards();
    for (let i = 0; i < 5; i++) {
      const slot = document.getElementById(`comm-${i+1}`);
      if (slot) {
        if (i < commCards.length) {
          slot.innerHTML = getCardHTML(commCards[i], true);
          slot.className = 'card-slot';
        } else {
          slot.innerHTML = '';
          slot.className = 'card-slot card-placeholder';
        }
      }
    }

    // Render Pot
    const potVal = window.GamingHubPoker.getPot();
    document.getElementById('pot-amount').innerText = `$${potVal}`;
    document.getElementById('game-pot-val').innerText = `$${potVal}`;
    
    // Draw visual chips stack in center
    renderPotChipsVisual(potVal);

    // Show/Hide turn actions controls panel
    const controlsPanel = document.getElementById('poker-controls');
    const activePlayerIndex = window.GamingHubPoker.getActiveSeatIndex();
    const activePlayer = gamePlayers[activePlayerIndex];
    const isOurTurn = (activePlayer && activePlayer.username === localUser && !activePlayer.folded && !activePlayer.busted && window.GamingHubPoker.getRoundName() !== 'SHOWDOWN');

    if (isOurTurn) {
      controlsPanel.classList.remove('hidden');
      setupTurnControls(activePlayer);
    } else {
      controlsPanel.classList.add('hidden');
      document.getElementById('raise-panel').classList.add('hidden');
    }
  }

  // Draw stacked chips on felt table
  function renderPotChipsVisual(potAmount) {
    const container = document.getElementById('pot-chips-visual');
    if (!container) return;
    container.innerHTML = '';

    // Standard chips value stacks
    const stackTypes = [
      { val: 100, color: 'black' },
      { val: 50, color: 'blue' },
      { val: 25, color: 'green' },
      { val: 10, color: 'red' },
      { val: 5, color: 'white' }
    ];

    let remainder = potAmount;
    let chipCount = 0;

    stackTypes.forEach(s => {
      const count = Math.floor(remainder / s.val);
      remainder %= s.val;
      
      if (count > 0 && chipCount < 10) { // Limit rendering to prevent lag
        const chip = document.createElement('div');
        chip.className = `chip-graphic chip-${s.color}`;
        chip.style.transform = `translateY(-${chipCount * 3}px)`;
        chip.style.position = 'absolute';
        chip.innerText = s.val;
        container.appendChild(chip);
        chipCount++;
      }
    });
  }

  // Generate playing card HTML structure
  function getCardHTML(card, visible) {
    if (!visible) {
      return '<div class="playing-card card-back"></div>';
    }
    const isRed = card.suit === '♥' || card.suit === '♦';
    const suitClass = isRed ? 'card-red' : 'card-black';
    return `
      <div class="playing-card ${suitClass}">
        <div class="card-corner">
          <span>${card.name}</span>
          <span>${card.suit}</span>
        </div>
        <div class="card-suit-large">${card.suit}</div>
      </div>
    `;
  }

  // Configure action buttons when it is our turn
  function setupTurnControls(p) {
    const currentBet = window.GamingHubPoker.getCurrentBet();
    const minRaise = window.GamingHubPoker.getMinRaise();
    const toCall = currentBet - p.bet;
    
    const btnFold = document.getElementById('btn-fold');
    const btnCheck = document.getElementById('btn-check');
    const btnMatch = document.getElementById('btn-match');
    const btnRaise = document.getElementById('btn-raise');

    // 1. Fold is always allowed
    btnFold.disabled = false;

    // 2. Check is only valid if there is no bet to match
    if (toCall === 0) {
      btnCheck.classList.remove('hidden');
      btnCheck.disabled = false;
      
      btnMatch.classList.add('hidden');
    } else {
      btnCheck.classList.add('hidden');
      
      btnMatch.classList.remove('hidden');
      btnMatch.innerText = p.cash <= toCall ? `All-in ($${p.cash})` : `Call ($${toCall})`;
      btnMatch.disabled = false;
    }

    // 3. Raise is only valid if we have more money than the call cost
    if (p.cash > toCall) {
      btnRaise.classList.remove('hidden');
      btnRaise.disabled = false;
      
      // Max raise is our remaining cash + what we've already bet this round
      const maxLimit = p.cash + p.bet; 
      // minRaise from the engine is the absolute next minimum bet amount
      let minLimit = Math.min(minRaise, maxLimit);

      // Setup raise slider panel options
      const slider = document.getElementById('raise-slider');
      const numInput = document.getElementById('raise-num-input');
      const minLabel = document.getElementById('raise-min-val');
      const maxLabel = document.getElementById('raise-max-val');
      const panel = document.getElementById('raise-panel');
      const isPanelOpen = panel && !panel.classList.contains('hidden');

      slider.min = minLimit;
      slider.max = maxLimit;
      slider.step = 5;
      if (!isPanelOpen) {
        slider.value = minLimit;
      }

      numInput.min = minLimit;
      numInput.max = maxLimit;
      if (!isPanelOpen) {
        numInput.value = minLimit;
      }

      minLabel.innerText = `$${minLimit}`;
      maxLabel.innerText = `$${maxLimit}`;
      
      if (!isPanelOpen) {
        btnRaise.innerText = `Raise ($${minLimit}+)`;
      } else {
        btnRaise.innerText = `Raise ($${slider.value})`;
      }

      // Update on slider slide
      slider.oninput = () => {
        numInput.value = slider.value;
        btnRaise.innerText = `Raise ($${slider.value})`;
      };
      
      // Update on input box change
      numInput.oninput = () => {
        let val = parseInt(numInput.value) || minLimit;
        if (val < minLimit) val = minLimit;
        if (val > maxLimit) val = maxLimit;
        slider.value = val;
        btnRaise.innerText = `Raise ($${val})`;
      };

    } else {
      btnRaise.classList.add('hidden');
    }
  }

  // Draw HUD bottom chip stack graphic
  function renderPlayerHUDChips(cash) {
    const container = document.getElementById('hud-chips-breakdown');
    if (!container) return;
    container.innerHTML = '';

    const stackTypes = [
      { val: 100, label: '100', color: 'black' },
      { val: 50, label: '50', color: 'blue' },
      { val: 25, label: '25', color: 'green' },
      { val: 10, label: '10', color: 'red' },
      { val: 5, label: '5', color: 'white' }
    ];

    let remainder = cash;

    stackTypes.forEach(s => {
      const count = Math.floor(remainder / s.val);
      remainder %= s.val;
      
      const stack = document.createElement('div');
      stack.className = 'chip-stack-indicator';
      
      // Stack visual representation
      let stackHTML = '';
      if (count > 0) {
        // Draw up to 4 overlapping pills
        const height = Math.min(4, count);
        stackHTML = `<div style="position:relative; height: 35px; width: 30px;">`;
        for (let i = 0; i < height; i++) {
          stackHTML += `
            <div class="chip-graphic chip-${s.color}" style="position:absolute; bottom:${i * 3}px; left:0; margin:0;">
              ${s.label}
            </div>
          `;
        }
        stackHTML += `</div>`;
      } else {
        stackHTML = `<div class="chip-graphic chip-${s.color}" style="opacity:0.1; filter: grayscale(1);">${s.label}</div>`;
      }
      
      stack.innerHTML = `
        ${stackHTML}
        <span style="font-size:0.6rem; margin-top:2px;">x${count}</span>
      `;
      container.appendChild(stack);
    });
  }

  // Show Showdown winners details
  function showShowdownModal(winners, commCards) {
    const modal = document.getElementById('modal-showdown');
    if (!modal) return;

    const title = document.getElementById('showdown-title');
    const desc = document.getElementById('showdown-desc');
    const cardsRow = document.getElementById('showdown-winner-cards');

    cardsRow.innerHTML = '';

    // Multiple winners or single
    let winnersNames = winners.map(w => w.player.username).join(', ');
    title.innerText = winners.length > 1 ? `Split Pot!` : `Winner!`;
    desc.innerText = `${winnersNames} won with ${winners[0].handInfo.text}`;

    // Draw the winning 5 cards
    const winningCards = winners[0].handInfo.cards;
    winningCards.forEach(c => {
      cardsRow.innerHTML += getCardHTML(c, true);
    });

    modal.classList.remove('hidden');
    
    // Auto-dismiss handler button
    document.getElementById('btn-showdown-continue').onclick = () => {
      modal.classList.add('hidden');
      if (window.GamingHubPoker.isHost()) {
        window.GamingHubPoker.startNewHand();
      }
    };
  }

  // Bind screen action buttons and form submission triggers
  function bindEvents() {
    // Auth Tabs Toggling (Log In vs Sign Up)
    document.querySelectorAll('#auth-tabs .auth-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const targetPanelId = btn.getAttribute('data-tab');
        
        // Remove active class from all tab buttons and add to clicked
        document.querySelectorAll('#auth-tabs .auth-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Hide all auth panels and show targeted panel
        document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
        const targetPanel = document.getElementById(targetPanelId);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      };
    });

    // Password Visibility Toggle Click Handler
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.btn-toggle-password');
      if (toggleBtn) {
        e.preventDefault();
        const targetInputId = toggleBtn.getAttribute('data-target');
        const input = document.getElementById(targetInputId);
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            toggleBtn.innerText = 'Hide';
          } else {
            input.type = 'password';
            toggleBtn.innerText = 'Show';
          }
        }
      }
    });

    // Sound Button
    const btnSound = document.getElementById('btn-sound');
    if (btnSound) {
      btnSound.onclick = () => {
        const active = window.GamingHubAudio.toggle();
        btnSound.style.opacity = active ? '1' : '0.4';
        showToast(active ? 'Sound Enabled' : 'Sound Muted');
      };
    }

    // Friends Drawer Toggle Button
    const btnFriends = document.getElementById('btn-friends');
    if (btnFriends) {
      btnFriends.onclick = () => {
        toggleFriendsDrawer(true);
        // Reset notification badge
        const badge = document.getElementById('badge-friends');
        if (badge) {
          badge.classList.add('hidden');
          badge.innerText = '0';
        }
      };
    }

    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    if (btnCloseDrawer) {
      btnCloseDrawer.onclick = () => {
        toggleFriendsDrawer(false);
      };
    }

    // Drawer Tabs Toggle
    document.querySelectorAll('.drawer-tabs .tab-btn').forEach(btn => {
      btn.onclick = () => {
        const targetTab = btn.getAttribute('data-tab');
        
        // Update active tab header
        document.querySelectorAll('.drawer-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active tab view
        document.querySelectorAll('.drawer-content .tab-panel').forEach(p => p.classList.remove('active'));
        const tabEl = document.getElementById(targetTab);
        if (tabEl) {
          tabEl.classList.add('active');
        }
        
        if (targetTab === 'tab-friends-list') {
          renderFriendsList();
        }
      };
    });

    // Handle Chat Friend click delegation
    const friendsListContainer = document.getElementById('friends-list-container');
    if (friendsListContainer) {
      friendsListContainer.onclick = (e) => {
        const chatBtn = e.target.closest('.btn-friend-chat');
        const inviteBtn = e.target.closest('.btn-friend-invite');
        const inviteChessBtn = e.target.closest('.btn-friend-invite-chess');
        const inviteNitroBtn = e.target.closest('.btn-friend-invite-nitro');
        const inviteHexanautBtn = e.target.closest('.btn-friend-invite-hexanaut');
        const removeBtn = e.target.closest('.btn-friend-remove');

        if (chatBtn) {
          const fName = chatBtn.getAttribute('data-name');
          openChat(fName);
        } else if (inviteBtn) {
          const fName = inviteBtn.getAttribute('data-name');
          toggleFriendsDrawer(false);
          window.GamingHubSync.startMatchmaking(true, [fName]);
          showToast(`Poker invitation sent to ${fName}`);
        } else if (inviteChessBtn) {
          const fName = inviteChessBtn.getAttribute('data-name');
          toggleFriendsDrawer(false);
          setupTcButtons.forEach(tc => {
            const btn = document.getElementById(tc.id);
            if (btn) btn.setAttribute('data-invite-friend', fName);
          });
          const modal = document.getElementById('modal-chess-setup');
          if (modal) modal.classList.remove('hidden');
        } else if (inviteNitroBtn) {
          const fName = inviteNitroBtn.getAttribute('data-name');
          toggleFriendsDrawer(false);
          window.GamingHubSync.startNitroMatchmaking(true, fName);
          showToast(`Nitro Type invitation sent to ${fName}`);
        } else if (inviteHexanautBtn) {
          const fName = inviteHexanautBtn.getAttribute('data-name');
          toggleFriendsDrawer(false);
          window.GamingHubSync.startHexanautMatchmaking(true, fName);
          showToast(`Hexanaut.io invitation sent to ${fName}`);
        } else if (removeBtn) {
          const fName = removeBtn.getAttribute('data-name');
          if (confirm(`Remove ${fName} from your friends list?`)) {
            const res = window.GamingHubState.removeFriend(fName);
            if (res.success) {
              showToast(`${fName} has been removed.`);
              renderFriendsList();
            } else {
              showToast(res.message, true);
            }
          }
        }
      };
    }

    // Back to chats thread selector list
    const btnBackToChats = document.getElementById('btn-back-to-chats');
    if (btnBackToChats) {
      btnBackToChats.onclick = () => {
        // Clear active chat state
        window.GamingHubState.state.activeChatFriend = null;
        
        // Hide active chat and show "no chat selected" inside chats panel
        const activeChatPanel = document.getElementById('active-chat-panel');
        if (activeChatPanel) activeChatPanel.classList.add('hidden');
        const noChatSelected = document.getElementById('no-chat-selected');
        if (noChatSelected) noChatSelected.classList.remove('hidden');

        // Switch active drawer tab back to Friends tab
        document.querySelectorAll('.drawer-tabs .tab-btn').forEach(btn => {
          if (btn.getAttribute('data-tab') === 'tab-friends-list') {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        
        document.querySelectorAll('.drawer-content .tab-panel').forEach(panel => {
          if (panel.id === 'tab-friends-list') {
            panel.classList.add('active');
          } else {
            panel.classList.remove('active');
          }
        });
        
        // Redraw friends list
        renderFriendsList();
      };
    }

    // Chat sending message form
    const formChatSend = document.getElementById('form-chat-send');
    if (formChatSend) {
      formChatSend.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input ? input.value.trim() : '';
        const friend = window.GamingHubState.state.activeChatFriend;
        
        if (text && friend) {
          window.GamingHubSync.sendChatMessage(friend, text);
          if (input) input.value = '';
          updateActiveChat();
        }
      };
    }

    // Add Friend Form
    const formAddFriend = document.getElementById('form-add-friend');
    if (formAddFriend) {
      formAddFriend.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('input-friend-search');
        const fName = input ? input.value.trim() : '';
        const feedback = document.getElementById('add-friend-feedback');
        
        if (fName) {
          const res = window.GamingHubState.addFriend(fName);
          if (feedback) {
            feedback.innerText = res.message;
            feedback.className = `feedback-msg ${res.success ? 'success' : 'error'}`;
          }
          
          if (res.success) {
            if (input) input.value = '';
            renderFriendsList();
            // Broadcast presence ping to detect if they are online in another tab
            window.GamingHubSync.sendFriendRequest(fName);
          }
        }
      };
    }

    // Find Match Button (Matchmaking Lobby)
    const btnPlayPoker = document.getElementById('btn-play-poker');
    if (btnPlayPoker) {
      btnPlayPoker.onclick = () => {
        window.GamingHubSync.startMatchmaking(false);
      };
    }

    // Play Against Friends Button (Opens friends list drawer)
    const btnPlayAgainstFriends = document.getElementById('btn-play-against-friends');
    if (btnPlayAgainstFriends) {
      btnPlayAgainstFriends.onclick = () => {
        toggleFriendsDrawer(true);
        // Select Friends tab inside the drawer
        const tabBtn = document.querySelector('.drawer-tabs .tab-btn[data-tab="tab-friends-list"]');
        if (tabBtn) {
          tabBtn.click();
        }
        showToast("Invite an online friend to play poker against them!");
      };
    }

    // Cancel Matchmaking
    const btnCancelMatchmaking = document.getElementById('btn-cancel-matchmaking');
    if (btnCancelMatchmaking) {
      btnCancelMatchmaking.onclick = () => {
        if (window.GamingHubSync.activeChessRoom()) {
          window.GamingHubSync.cancelChessMatchmaking();
        } else if (window.GamingHubSync.activeHexanautRoom && window.GamingHubSync.activeHexanautRoom()) {
          window.GamingHubSync.cancelHexanautMatchmaking();
        } else if (window.GamingHubSync.activeNitroRoom && window.GamingHubSync.activeNitroRoom()) {
          window.GamingHubSync.cancelNitroMatchmaking();
        } else {
          window.GamingHubSync.cancelMatchmaking();
        }
      };
    }

    // Cooked Chess Card buttons
    const btnPlayChess = document.getElementById('btn-play-chess');
    if (btnPlayChess) {
      btnPlayChess.onclick = (e) => {
        e.stopPropagation();
        const modal = document.getElementById('modal-chess-setup');
        if (modal) modal.classList.remove('hidden');
      };
    }

    const btnChessChallengeFriend = document.getElementById('btn-chess-challenge-friend');
    if (btnChessChallengeFriend) {
      btnChessChallengeFriend.onclick = (e) => {
        e.stopPropagation();
        toggleFriendsDrawer(true);
        // Select Friends tab inside the drawer
        const tabBtn = document.querySelector('.drawer-tabs .tab-btn[data-tab="tab-friends-list"]');
        if (tabBtn) {
          tabBtn.click();
        }
        showToast("Invite an online friend to play Cooked Chess against them!");
      };
    }

    const btnChessSetupClose = document.getElementById('btn-chess-setup-close');
    if (btnChessSetupClose) {
      btnChessSetupClose.onclick = () => {
        const modal = document.getElementById('modal-chess-setup');
        if (modal) modal.classList.add('hidden');
      };
    }

    // Matchmaking time control selection triggers
    const setupTcButtons = [
      { id: 'btn-chess-tc-bullet', label: 'Bullet' },
      { id: 'btn-chess-tc-blitz', label: 'Blitz' },
      { id: 'btn-chess-tc-rapid', label: 'Rapid' }
    ];

    setupTcButtons.forEach(tc => {
      const btn = document.getElementById(tc.id);
      if (btn) {
        btn.onclick = () => {
          const modal = document.getElementById('modal-chess-setup');
          if (modal) modal.classList.add('hidden');
          
          const targetFriend = btn.getAttribute('data-invite-friend');
          if (targetFriend) {
            btn.removeAttribute('data-invite-friend');
            window.GamingHubSync.startChessMatchmaking(true, targetFriend, tc.label);
          } else {
            window.GamingHubSync.startChessMatchmaking(false, null, tc.label);
          }
        };
      }
    });

    // Accept / Decline Chess Invites
    const btnAcceptInviteChess = document.getElementById('btn-accept-invite-chess');
    if (btnAcceptInviteChess) {
      btnAcceptInviteChess.onclick = () => {
        window.GamingHubSync.respondToChessInvite(true);
        const modal = document.getElementById('modal-invite-chess');
        if (modal) modal.classList.add('hidden');
      };
    }

    const btnDeclineInviteChess = document.getElementById('btn-decline-invite-chess');
    if (btnDeclineInviteChess) {
      btnDeclineInviteChess.onclick = () => {
        window.GamingHubSync.respondToChessInvite(false);
        const modal = document.getElementById('modal-invite-chess');
        if (modal) modal.classList.add('hidden');
      };
    }

    // Accept / Decline Nitro Invites
    const btnAcceptInviteNitro = document.getElementById('btn-accept-invite-nitro');
    if (btnAcceptInviteNitro) {
      btnAcceptInviteNitro.onclick = () => {
        window.GamingHubSync.respondToNitroInvite(true);
        const modal = document.getElementById('modal-invite-nitro');
        if (modal) modal.classList.add('hidden');
      };
    }

    const btnDeclineInviteNitro = document.getElementById('btn-decline-invite-nitro');
    if (btnDeclineInviteNitro) {
      btnDeclineInviteNitro.onclick = () => {
        window.GamingHubSync.respondToNitroInvite(false);
        const modal = document.getElementById('modal-invite-nitro');
        if (modal) modal.classList.add('hidden');
      };
    }

    // Accept / Decline Hexanaut Invites
    const btnAcceptInviteHexanaut = document.getElementById('btn-accept-invite-hexanaut');
    if (btnAcceptInviteHexanaut) {
      btnAcceptInviteHexanaut.onclick = () => {
        window.GamingHubSync.respondToHexanautInvite(true);
        const modal = document.getElementById('modal-invite-hexanaut');
        if (modal) modal.classList.add('hidden');
      };
    }

    const btnDeclineInviteHexanaut = document.getElementById('btn-decline-invite-hexanaut');
    if (btnDeclineInviteHexanaut) {
      btnDeclineInviteHexanaut.onclick = () => {
        window.GamingHubSync.respondToHexanautInvite(false);
        const modal = document.getElementById('modal-invite-hexanaut');
        if (modal) modal.classList.add('hidden');
      };
    }

    // Resign and Draw buttons in-game
    const btnChessResign = document.getElementById('btn-chess-resign');
    if (btnChessResign) {
      btnChessResign.onclick = () => {
        if (confirm("Are you sure you want to resign this game?")) {
          window.GamingHubSync.sendChessResign();
          window.GamingHubChessUI.localResign();
        }
      };
    }

    const btnChessDraw = document.getElementById('btn-chess-draw');
    if (btnChessDraw) {
      btnChessDraw.onclick = () => {
        window.GamingHubSync.sendChessDrawOffer();
        showToast("Draw offer sent to opponent.");
      };
    }

    // Chess GameOver close
    const btnChessGameoverClose = document.getElementById('btn-chess-gameover-close');
    if (btnChessGameoverClose) {
      btnChessGameoverClose.onclick = () => {
        const modal = document.getElementById('modal-chess-gameover');
        if (modal) modal.classList.add('hidden');
        window.GamingHubSync.leaveActiveChessRoom();
        showScreen('screen-dashboard');
      };
    }

    const btnChessAnalyze = document.getElementById('btn-chess-analyze');
    if (btnChessAnalyze) {
      btnChessAnalyze.onclick = () => {
        const modal = document.getElementById('modal-chess-gameover');
        if (modal) modal.classList.add('hidden');
        window.GamingHubChessUI.startAnalysis(0);
      };
    }

    // Leave Chess
    const btnLeaveChess = document.getElementById('btn-leave-chess');
    if (btnLeaveChess) {
      btnLeaveChess.onclick = () => {
        if (confirm("Are you sure you want to leave this game? (This will count as a loss/resignation)")) {
          window.GamingHubSync.leaveActiveChessRoom();
          showScreen('screen-dashboard');
        }
      };
    }

    // Analysis control buttons
    const btnAnalysisFirst = document.getElementById('btn-analysis-first');
    if (btnAnalysisFirst) {
      btnAnalysisFirst.onclick = () => {
        if (chessIsAnalysisMode) jumpToAnalysisStep(0);
      };
    }
    const btnAnalysisPrev = document.getElementById('btn-analysis-prev');
    if (btnAnalysisPrev) {
      btnAnalysisPrev.onclick = () => {
        if (chessIsAnalysisMode) jumpToAnalysisStep(Math.max(0, chessAnalysisIndex - 1));
      };
    }
    const btnAnalysisNext = document.getElementById('btn-analysis-next');
    if (btnAnalysisNext) {
      btnAnalysisNext.onclick = () => {
        if (chessIsAnalysisMode) jumpToAnalysisStep(Math.min(chessAnalysisMoves.length, chessAnalysisIndex + 1));
      };
    }
    const btnAnalysisLast = document.getElementById('btn-analysis-last');
    if (btnAnalysisLast) {
      btnAnalysisLast.onclick = () => {
        if (chessIsAnalysisMode) jumpToAnalysisStep(chessAnalysisMoves.length);
      };
    }

    // Raise Button slider popover visibility
    const btnRaise = document.getElementById('btn-raise');
    if (btnRaise) {
      btnRaise.onclick = (e) => {
        e.stopPropagation();
        const panel = document.getElementById('raise-panel');
        if (panel) panel.classList.toggle('hidden');
      };
    }

    // Click outside raise panel dismisses it
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('raise-panel');
      if (panel && !panel.classList.contains('hidden') && !e.target.closest('.raise-wrapper')) {
        panel.classList.add('hidden');
      }
    });

    // Raise Confirm
    const btnRaiseConfirm = document.getElementById('btn-raise-confirm');
    if (btnRaiseConfirm) {
      btnRaiseConfirm.onclick = () => {
        const numInput = document.getElementById('raise-num-input');
        const val = numInput ? parseInt(numInput.value) : 0;
        if (val) {
          const localPlayerName = window.GamingHubState.state.currentUser?.username || '';
          window.GamingHubPoker.processPlayerTurn(localPlayerName, 'raise', val);
          const panel = document.getElementById('raise-panel');
          if (panel) panel.classList.add('hidden');
        }
      };
    }

    // Turn Actions clicks
    const btnFold = document.getElementById('btn-fold');
    if (btnFold) {
      btnFold.onclick = () => {
        const localPlayerName = window.GamingHubState.state.currentUser?.username || '';
        window.GamingHubPoker.processPlayerTurn(localPlayerName, 'fold');
      };
    }
    const btnCheck = document.getElementById('btn-check');
    if (btnCheck) {
      btnCheck.onclick = () => {
        const localPlayerName = window.GamingHubState.state.currentUser?.username || '';
        window.GamingHubPoker.processPlayerTurn(localPlayerName, 'check');
      };
    }
    const btnMatch = document.getElementById('btn-match');
    if (btnMatch) {
      btnMatch.onclick = () => {
        const localPlayerName = window.GamingHubState.state.currentUser?.username || '';
        window.GamingHubPoker.processPlayerTurn(localPlayerName, 'match');
      };
    }

    // Leave game
    const btnLeaveGame = document.getElementById('btn-leave-game');
    if (btnLeaveGame) {
      btnLeaveGame.onclick = () => {
        if (window.GamingHubPoker && window.GamingHubPoker.settleMatch) {
          window.GamingHubPoker.settleMatch(false);
        }
        window.GamingHubSync.leaveActiveRoom();
        showScreen('screen-dashboard');
      };
    }

    // Close too late modal
    const btnCloseTooLate = document.getElementById('btn-close-too-late');
    if (btnCloseTooLate) {
      btnCloseTooLate.onclick = () => {
        const tooLateModal = document.getElementById('modal-too-late');
        if (tooLateModal) tooLateModal.classList.add('hidden');
      };
    }

    // Stats navigation
    const btnStatsNav = document.getElementById('btn-stats-nav');
    if (btnStatsNav) {
      btnStatsNav.onclick = () => {
        showScreen('screen-stats');
      };
    }

    const btnStatsBack = document.getElementById('btn-stats-back');
    if (btnStatsBack) {
      btnStatsBack.onclick = () => {
        showScreen('screen-dashboard');
      };
    }

    const logoNav = document.getElementById('logo-nav');
    if (logoNav) {
      logoNav.onclick = () => {
        const user = window.GamingHubState.state.currentUser;
        if (user) {
          showScreen('screen-dashboard');
        } else {
          showScreen('screen-login');
        }
      };
    }

    // Stats Game Tabs Toggling
    document.querySelectorAll('#stats-tabs-nav .stats-tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#stats-tabs-nav .stats-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tabId = btn.getAttribute('data-game-tab');
        document.querySelectorAll('.stats-panel').forEach(p => p.classList.remove('active'));
        
        const activeTabIds = ['stats-poker', 'stats-chess', 'stats-nitro', 'stats-hexanaut', 'stats-flappy', 'stats-tictactoe', 'stats-snake', 'stats-2048', 'stats-minesweeper'];
        if (activeTabIds.includes(tabId)) {
          const panel = document.getElementById(tabId);
          if (panel) panel.classList.add('active');
          if (tabId === 'stats-nitro') {
            renderNitroLeaderboard();
          } else if (tabId === 'stats-hexanaut') {
            renderHexanautLeaderboard();
          }
        } else {
          // Update game title in locked panel
          const gameTitle = btn.innerText.replace(/[^\w\s-]/g, '').trim(); // Remove emoji
          const lockedPanel = document.getElementById('stats-locked-panel');
          if (lockedPanel) {
            const h3 = lockedPanel.querySelector('h3');
            if (h3) h3.innerText = `${gameTitle} Stats Locked`;
            lockedPanel.classList.add('active');
          }
        }
      };
    });

     const btnPlayHexanaut = document.getElementById('btn-play-hexanaut');
     if (btnPlayHexanaut) {
       btnPlayHexanaut.onclick = () => {
         showScreen('screen-hexanaut');
         const iframe = document.getElementById('hexanaut-iframe');
         if (iframe) {
           iframe.src = 'https://hexanaut.io/';
         }
       };
     }

     const btnLeaveHexanaut = document.getElementById('btn-leave-hexanaut');
     if (btnLeaveHexanaut) {
       btnLeaveHexanaut.onclick = () => {
         const iframe = document.getElementById('hexanaut-iframe');
         if (iframe) {
           iframe.src = 'about:blank';
         }
         showScreen('screen-dashboard');
       };
     }

    const btnHexanautChallengeFriend = document.getElementById('btn-hexanaut-challenge-friend');
    if (btnHexanautChallengeFriend) {
      btnHexanautChallengeFriend.onclick = (e) => {
        e.stopPropagation();
        toggleFriendsDrawer(true);
        const tabBtn = document.querySelector('.drawer-tabs .tab-btn[data-tab="tab-friends-list"]');
        if (tabBtn) {
          tabBtn.click();
        }
        showToast("Invite an online friend to a Hexanaut.io battle!");
      };
    }

     // 5 NEW MINI-GAMES BUTTON BINDINGS
     // 1. Flappy Bird
     const btnPlayFlappy = document.getElementById('btn-play-flappy');
     if (btnPlayFlappy) {
       btnPlayFlappy.onclick = () => {
         showScreen('screen-flappy');
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.flappy) {
           window.GamingHubMiniGames.flappy.start();
         }
       };
     }
     const btnLeaveFlappy = document.getElementById('btn-leave-flappy');
     if (btnLeaveFlappy) {
       btnLeaveFlappy.onclick = () => {
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.flappy) {
           window.GamingHubMiniGames.flappy.stop();
         }
         showScreen('screen-dashboard');
       };
     }

     // 2. Tic Tac Toe
     const btnPlayTicTacToe = document.getElementById('btn-play-tictactoe');
     if (btnPlayTicTacToe) {
       btnPlayTicTacToe.onclick = () => {
         showScreen('screen-tictactoe');
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.tictactoe) {
           window.GamingHubMiniGames.tictactoe.start();
         }
       };
     }
     const btnLeaveTicTacToe = document.getElementById('btn-leave-tictactoe');
     if (btnLeaveTicTacToe) {
       btnLeaveTicTacToe.onclick = () => {
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.tictactoe) {
           window.GamingHubMiniGames.tictactoe.stop();
         }
         showScreen('screen-dashboard');
       };
     }

     // 3. Snake Arena
     const btnPlaySnake = document.getElementById('btn-play-snake');
     if (btnPlaySnake) {
       btnPlaySnake.onclick = () => {
         showScreen('screen-snake');
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.snake) {
           window.GamingHubMiniGames.snake.start();
         }
       };
     }
     const btnLeaveSnake = document.getElementById('btn-leave-snake');
     if (btnLeaveSnake) {
       btnLeaveSnake.onclick = () => {
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.snake) {
           window.GamingHubMiniGames.snake.stop();
         }
         showScreen('screen-dashboard');
       };
     }

     // 4. 2048 Puzzle
     const btnPlay2048 = document.getElementById('btn-play-2048');
     if (btnPlay2048) {
       btnPlay2048.onclick = () => {
         showScreen('screen-2048');
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.g2048) {
           window.GamingHubMiniGames.g2048.start();
         }
       };
     }
     const btnLeave2048 = document.getElementById('btn-leave-2048');
     if (btnLeave2048) {
       btnLeave2048.onclick = () => {
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.g2048) {
           window.GamingHubMiniGames.g2048.stop();
         }
         showScreen('screen-dashboard');
       };
     }

     // 5. Minesweeper
     const btnPlayMinesweeper = document.getElementById('btn-play-minesweeper');
     if (btnPlayMinesweeper) {
       btnPlayMinesweeper.onclick = () => {
         showScreen('screen-minesweeper');
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.minesweeper) {
           window.GamingHubMiniGames.minesweeper.start();
         }
       };
     }
     const btnLeaveMinesweeper = document.getElementById('btn-leave-minesweeper');
     if (btnLeaveMinesweeper) {
       btnLeaveMinesweeper.onclick = () => {
         if (window.GamingHubMiniGames && window.GamingHubMiniGames.minesweeper) {
           window.GamingHubMiniGames.minesweeper.stop();
         }
         showScreen('screen-dashboard');
       };
     }

    // Nitro Type play and shop buttons
    const btnPlayNitro = document.getElementById('btn-play-nitro');
    if (btnPlayNitro) {
      btnPlayNitro.onclick = () => {
        window.GamingHubSync.startNitroMatchmaking();
      };
    }

    const btnNitroChallengeFriend = document.getElementById('btn-nitro-challenge-friend');
    if (btnNitroChallengeFriend) {
      btnNitroChallengeFriend.onclick = (e) => {
        e.stopPropagation();
        toggleFriendsDrawer(true);
        const tabBtn = document.querySelector('.drawer-tabs .tab-btn[data-tab="tab-friends-list"]');
        if (tabBtn) {
          tabBtn.click();
        }
        showToast("Invite an online friend to a Nitro Type race!");
      };
    }

    const btnNitroShop = document.getElementById('btn-nitro-shop');
    if (btnNitroShop) {
      btnNitroShop.onclick = () => {
        showScreen('screen-nitro-shop');
        renderCarShop();
      };
    }

    const btnLeaveNitro = document.getElementById('btn-leave-nitro');
    if (btnLeaveNitro) {
      btnLeaveNitro.onclick = () => {
        if (confirm("Are you sure you want to leave this race? (This will count as a loss)")) {
          window.GamingHubSync.leaveActiveNitroRoom();
          showScreen('screen-dashboard');
        }
      };
    }

    const btnNitroResultsClose = document.getElementById('btn-nitro-results-close');
    if (btnNitroResultsClose) {
      btnNitroResultsClose.onclick = () => {
        const modal = document.getElementById('modal-nitro-results');
        if (modal) modal.classList.add('hidden');
        showScreen('screen-dashboard');
      };
    }

    // Log Out button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.onclick = () => {
        // Notify friends we are going offline
        window.GamingHubSync.sendPing(false);
        // Clear active room and profile state
        window.GamingHubSync.leaveActiveRoom();
        window.GamingHubState.logoutUser();
        // Redirect to login screen
        showScreen('screen-login');
        showToast("Logged out successfully.");
      };
    }
  }

  // --- CHESS UI LOGIC AND ENGINE CONTROLLERS ---

  function formatClockTime(timeMs) {
    const totalSecs = Math.ceil(timeMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function updateClocksUI() {
    const clockLocal = document.getElementById(chessMyColor === 'white' ? 'clock-white' : 'clock-black');
    const clockOpp = document.getElementById(chessMyColor === 'white' ? 'clock-black' : 'clock-white');
    
    if (clockLocal) {
      clockLocal.innerText = formatClockTime(chessLocalTime);
      clockLocal.className = 'chess-timer';
      if (chessGame && chessGame.turn === chessMyColor) {
        clockLocal.classList.add('active-clock');
      }
      if (chessLocalTime <= 30000) clockLocal.classList.add('warning-clock');
      if (chessLocalTime <= 10000) clockLocal.classList.add('danger-clock');
    }
    
    if (clockOpp) {
      clockOpp.innerText = formatClockTime(chessOpponentTime);
      clockOpp.className = 'chess-timer';
      if (chessGame && chessGame.turn !== chessMyColor) {
        clockOpp.classList.add('active-clock');
      }
      if (chessOpponentTime <= 30000) clockOpp.classList.add('warning-clock');
      if (chessOpponentTime <= 10000) clockOpp.classList.add('danger-clock');
    }
  }

  function handleGameOverTimeLoss(loserColor) {
    if (!chessGame || chessGame.isGameOver) return;
    chessGame.triggerTimeout(loserColor);
    window.GamingHubAudio.play('deal');
    handleChessGameOver();
  }

  function handleChessGameOver() {
    if (chessClockInterval) {
      clearInterval(chessClockInterval);
      chessClockInterval = null;
    }
    
    const selfUser = window.GamingHubState.state.currentUser;
    const tcKey = chessTimeControl.toLowerCase();
    const selfRating = (selfUser.chessRatings && selfUser.chessRatings[tcKey]) || 100;
    const gamesPlayed = (selfUser.chessGamesCount && selfUser.chessGamesCount[tcKey]) || 0;
    
    // Check if calibration pattern is broken (both at least one win/draw and at least one loss in history)
    const history = (selfUser.chessHistory || []).filter(h => h.timeControl.toLowerCase() === tcKey);
    const hasLoss = history.some(h => h.result === 'LOSS');
    const hasWinOrDraw = history.some(h => h.result === 'WIN' || h.result === 'DRAW');
    const isPatternBroken = hasLoss && hasWinOrDraw;
    
    const useK100 = (gamesPlayed < 10) || !isPatternBroken;
    const gamesCountParam = useK100 ? 0 : 10;
    
    const result = chessGame.gameResult;
    let won = false;
    let resultText = '';
    
    if (result === chessMyColor) {
      won = true;
      resultText = 'You Won!';
    } else if (result === 'draw') {
      resultText = 'Draw Match';
    } else {
      resultText = 'You Lost';
    }
    
    const scoreVal = won ? 1 : (result === 'draw' ? 0.5 : 0);
    const eloChange = window.GamingHubChess.calculateEloChange(selfRating, chessOpponentRating, scoreVal, gamesCountParam);
    
    // Save locally
    const movesList = chessGame.moveHistory.map(m => ({ from: m.from, to: m.to }));
    window.GamingHubState.recordChessMatch(chessTimeControl, won, chessOpponentName, eloChange, movesList);
    
    // Show GameOver Modal
    const modal = document.getElementById('modal-chess-gameover');
    if (modal) {
      document.getElementById('chess-gameover-title').innerText = resultText;
      document.getElementById('chess-gameover-desc').innerText = `Game Over by ${chessGame.gameOverReason}.`;
      
      const totalGamesAfter = gamesPlayed + 1;
      let eloText = `${won ? '+' : ''}${eloChange} ELO (${selfRating + eloChange} ELO)`;
      if (totalGamesAfter <= 10) {
        eloText += `\n[Placement Game ${totalGamesAfter} of 10]`;
      } else if (useK100) {
        const label = !hasLoss ? 'Undefeated' : 'Winless';
        eloText += `\n[Calibration Game ${totalGamesAfter} - ${label}]`;
      }
      
      document.getElementById('chess-gameover-elo').innerText = eloText;
      modal.classList.remove('hidden');
    }
  }

  const CHESS_UNICODE = {
    'wk': '♚', 'wq': '♛', 'wr': '♜', 'wb': '♝', 'wn': '♞', 'wp': '♟',
    'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
  };

  function redrawChessBoard() {
    const boardGrid = document.getElementById('chess-board-grid');
    if (!boardGrid) return;
    
    boardGrid.innerHTML = '';
    
    const inCheckColor = chessGame.turn;
    const activeKingInCheck = chessGame.isKingInCheck(inCheckColor);
    const kingPiece = inCheckColor === 'white' ? 'wk' : 'bk';
    
    let activeLegalMoves = [];
    if (chessSelectedSquare !== null) {
      activeLegalMoves = chessGame.getLegalMoves(chessSelectedSquare);
    }
    
    const lastMove = chessGame.moveHistory[chessGame.moveHistory.length - 1];
    
    for (let r = 0; r < 8; r++) {
      const row = (chessMyColor === 'black') ? 7 - r : r;
      for (let c = 0; c < 8; c++) {
        const col = (chessMyColor === 'black') ? 7 - c : c;
        const idx = row * 8 + col;
        
        const square = document.createElement('div');
        const isLight = (row + col) % 2 === 0;
        square.className = `chess-square ${isLight ? 'light' : 'dark'}`;
        square.dataset.index = idx;
        square.dataset.coord = window.GamingHubChess.indexToCoordinate(idx);
        
        if (idx === chessSelectedSquare) {
          square.classList.add('selected');
        }
        if (lastMove && (idx === lastMove.fromIdx || idx === lastMove.toIdx)) {
          square.classList.add('last-move');
        }
        if (activeKingInCheck && chessGame.board[idx] === kingPiece) {
          square.classList.add('in-check');
        }
        if (activeLegalMoves.includes(idx)) {
          square.classList.add('legal-target');
          if (chessGame.board[idx]) {
            square.classList.add('has-piece');
          }
        }
        
        const piece = chessGame.board[idx];
        if (piece) {
          const pieceEl = document.createElement('div');
          const isWhitePiece = piece[0] === 'w';
          pieceEl.className = `chess-piece ${isWhitePiece ? 'white-piece' : 'black-piece'}`;
          pieceEl.innerText = CHESS_UNICODE[piece];
          
          if (!chessIsAnalysisMode && chessGame.turn === chessMyColor && isWhitePiece === (chessMyColor === 'white')) {
            pieceEl.onclick = (e) => {
              e.stopPropagation();
              chessSelectedSquare = idx;
              redrawChessBoard();
            };
          }
          square.appendChild(pieceEl);
        }
        
        if (activeLegalMoves.includes(idx)) {
          square.onclick = () => {
            const fromIdx = chessSelectedSquare;
            const toIdx = idx;
            
            const success = chessGame.makeMove(fromIdx, toIdx);
            if (success) {
              window.GamingHubAudio.play('deal');
              chessSelectedSquare = null;
              
              if (!chessIsBot) {
                window.GamingHubSync.sendChessMove(fromIdx, toIdx);
              }
              
              redrawChessBoard();
              updateMovesNotationUI();
              updateClocksUI();
              
              if (chessIsBot && !chessGame.isGameOver) {
                setTimeout(triggerBotTurn, Math.random() * 1000 + 500);
              }
              
              if (chessGame.isGameOver) {
                handleChessGameOver();
              }
            }
          };
        } else {
          square.onclick = () => {
            chessSelectedSquare = null;
            redrawChessBoard();
          };
        }
        
        boardGrid.appendChild(square);
      }
    }
  }

  function triggerBotTurn() {
    if (!chessGame || chessGame.isGameOver) return;
    const move = window.GamingHubChess.getBotMove(chessGame, chessOpponentRating);
    if (move) {
      chessGame.makeMove(move.from, move.to);
      window.GamingHubAudio.play('deal');
      redrawChessBoard();
      updateMovesNotationUI();
      updateClocksUI();
      if (chessGame.isGameOver) {
        handleChessGameOver();
      }
    }
  }

  function updateMovesNotationUI() {
    const list = document.getElementById('chess-moves-list');
    if (!list) return;
    
    list.innerHTML = '';
    const history = chessGame.moveHistory;
    
    for (let i = 0; i < history.length; i += 2) {
      const whiteMove = history[i];
      const blackMove = history[i+1];
      const stepNum = Math.floor(i/2) + 1;
      
      const wEl = document.createElement('div');
      wEl.className = 'chess-notation-move';
      wEl.innerText = `${stepNum}. ${whiteMove.notation}`;
      if (chessIsAnalysisMode && chessAnalysisIndex === i + 1) {
        wEl.classList.add('active-notation');
      }
      wEl.onclick = () => {
        if (chessIsAnalysisMode) {
          jumpToAnalysisStep(i + 1);
        }
      };
      list.appendChild(wEl);
      
      if (blackMove) {
        const bEl = document.createElement('div');
        bEl.className = 'chess-notation-move';
        bEl.innerText = blackMove.notation;
        if (chessIsAnalysisMode && chessAnalysisIndex === i + 2) {
          bEl.classList.add('active-notation');
        }
        bEl.onclick = () => {
          if (chessIsAnalysisMode) {
            jumpToAnalysisStep(i + 2);
          }
        };
        list.appendChild(bEl);
      }
    }
  }

  function jumpToAnalysisStep(index) {
    chessAnalysisIndex = index;
    
    const playSim = new window.GamingHubChess.ChessGame();
    for (let i = 0; i < index; i++) {
      const move = chessAnalysisMoves[i];
      const fIdx = window.GamingHubChess.coordinateToIndex(move.from);
      const tIdx = window.GamingHubChess.coordinateToIndex(move.to);
      playSim.makeMove(fIdx, tIdx);
    }
    
    const originalGame = chessGame;
    chessGame = playSim;
    redrawChessBoard();
    updateMovesNotationUI();
    chessGame = originalGame;
    
    const score = window.GamingHubChess.evaluateBoardSearch(playSim, 3, 'white');
    updateEvalBarUI(score);
    
    const commentEl = document.getElementById('chess-analysis-comment');
    if (commentEl) {
      if (index === 0) {
        commentEl.innerHTML = `<div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <div>Evaluation: <strong>0.0</strong></div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">Starting Board</div>
        </div>`;
      } else {
        // Construct the game state BEFORE the played move
        const prevGame = new window.GamingHubChess.ChessGame();
        for (let i = 0; i < index - 1; i++) {
          const move = chessAnalysisMoves[i];
          const fIdx = window.GamingHubChess.coordinateToIndex(move.from);
          const tIdx = window.GamingHubChess.coordinateToIndex(move.to);
          prevGame.makeMove(fIdx, tIdx);
        }
        
        const activeColor = prevGame.turn;
        
        // played move
        const playedMoveObj = chessAnalysisMoves[index - 1];
        const playedFromIdx = window.GamingHubChess.coordinateToIndex(playedMoveObj.from);
        const playedToIdx = window.GamingHubChess.coordinateToIndex(playedMoveObj.to);
        
        const playedGame = prevGame.clone();
        playedGame.makeMove(playedFromIdx, playedToIdx);
        const playedScore = window.GamingHubChess.evaluateBoardSearch(playedGame, 3, 'white');
        
        // Find best move via minimax 2000 ELO (depth 4)
        const bestMove = window.GamingHubChess.getBotMove(prevGame, 2000);
        let bestScore = playedScore;
        let bestMoveText = "";
        
        if (bestMove) {
          const bestGame = prevGame.clone();
          bestGame.makeMove(bestMove.from, bestMove.to);
          bestScore = window.GamingHubChess.evaluateBoardSearch(bestGame, 3, 'white');
          bestMoveText = window.GamingHubChess.indexToCoordinate(bestMove.from) + " → " + window.GamingHubChess.indexToCoordinate(bestMove.to);
        }
        
        // Evaluation loss relative to the active player's turn
        let evalLoss = 0;
        if (activeColor === 'white') {
          evalLoss = bestScore - playedScore;
        } else {
          evalLoss = playedScore - bestScore;
        }
        
        let badgeColor = '';
        let badgeText = '';
        let commentText = '';
        
        // Math difference evaluation
        if (evalLoss <= 0) {
          badgeColor = '#10b981'; // Green
          badgeText = 'Best Move';
          commentText = `Played ${playedMoveObj.from} → ${playedMoveObj.to}, which is the optimal continuation.`;
        } else if (evalLoss <= 20) {
          badgeColor = '#10b981'; // Green
          badgeText = 'Excellent';
          commentText = `Played ${playedMoveObj.from} → ${playedMoveObj.to}, a very strong choice.`;
        } else if (evalLoss <= 60) {
          badgeColor = '#3b82f6'; // Blue
          badgeText = 'Good';
          commentText = `Played ${playedMoveObj.from} → ${playedMoveObj.to}. A solid move.`;
        } else if (evalLoss <= 160) {
          badgeColor = '#f59e0b'; // Orange
          badgeText = 'Mistake';
          commentText = `Played ${playedMoveObj.from} → ${playedMoveObj.to}. Best was <span style="font-weight:700; color:#10b981;">${bestMoveText}</span>.`;
        } else {
          badgeColor = '#ef4444'; // Red
          badgeText = 'Blunder';
          commentText = `Played ${playedMoveObj.from} → ${playedMoveObj.to}. Best was <span style="font-weight:700; color:#10b981;">${bestMoveText}</span>.`;
        }
        
        let displayScoreText = (score / 100.0).toFixed(1);
        if (score >= 90000) {
          displayScoreText = 'M';
        } else if (score <= -90000) {
          displayScoreText = '-M';
        } else if (score > 0) {
          displayScoreText = '+' + displayScoreText;
        }
        
        commentEl.innerHTML = `<div style="display: flex; flex-direction: column; gap: 0.35rem;">
          <div>Evaluation: <strong>${displayScoreText}</strong></div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">${badgeText}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted);">${commentText}</span>
          </div>
        </div>`;
      }
    }
  }

  function updateEvalBarUI(score) {
    const isBlack = (chessMyColor === 'black');
    const localScore = isBlack ? -score : score;
    
    const clamped = Math.max(-800, Math.min(800, localScore));
    const bottomPercentage = ((clamped + 800) / 1600) * 100;
    const topPercentage = 100 - bottomPercentage;
    
    const barWhite = document.getElementById('chess-eval-white');
    const barBlack = document.getElementById('chess-eval-black');
    const valText = document.getElementById('chess-eval-value');
    const barContainer = document.getElementById('chess-eval-bar');
    
    if (barContainer) {
      if (isBlack) {
        barContainer.style.flexDirection = 'column-reverse'; // Black is bottom, White is top
      } else {
        barContainer.style.flexDirection = 'column'; // White is bottom, Black is top
      }
    }
    
    if (isBlack) {
      if (barBlack) barBlack.style.height = `${bottomPercentage}%`;
      if (barWhite) barWhite.style.height = `${topPercentage}%`;
    } else {
      if (barWhite) barWhite.style.height = `${bottomPercentage}%`;
      if (barBlack) barBlack.style.height = `${topPercentage}%`;
    }
    
    if (valText) {
      if (score >= 90000) {
        valText.innerText = 'M';
      } else if (score <= -90000) {
        valText.innerText = '-M';
      } else {
        const val = score / 100.0;
        valText.innerText = (val > 0 ? '+' : '') + val.toFixed(1);
      }
    }
  }

  function startAnalysis(historyIdx) {
    const user = window.GamingHubState.state.currentUser;
    if (!user || !user.chessHistory) return;
    
    const item = user.chessHistory[historyIdx];
    if (!item) return;
    
    chessIsAnalysisMode = true;
    
    const evalContainer = document.getElementById('chess-eval-container');
    if (evalContainer) {
      evalContainer.classList.remove('hidden');
    }
    
    chessTimeControl = item.timeControl;
    chessOpponentName = item.opponent;
    chessOpponentRating = 100;
    chessMyColor = 'white';
    
    chessAnalysisMoves = item.moves || [];
    
    showScreen('screen-chess');
    
    document.getElementById('chess-game-actions').classList.add('hidden');
    document.getElementById('chess-analysis-controls').classList.remove('hidden');
    
    jumpToAnalysisStep(chessAnalysisMoves.length);
  }

  window.GamingHubChessUI = {
    startGame: (room) => {
      chessGame = new window.GamingHubChess.ChessGame();
      chessMyColor = room.myColor;
      chessIsBot = room.players.some(p => p.isBot);
      chessTimeControl = room.timeControl;
      
      const evalContainer = document.getElementById('chess-eval-container');
      if (evalContainer) {
        evalContainer.classList.add('hidden');
      }
      
      const opp = room.players.find(p => p.username !== window.GamingHubState.state.currentUser.username) || room.players[0];
      chessOpponentName = opp.username;
      chessOpponentRating = opp.rating || 100;
      
      let totalTime = 180;
      if (room.timeControl === 'Bullet') totalTime = 60;
      else if (room.timeControl === 'Rapid') totalTime = 600;
      
      chessLocalTime = totalTime * 1000;
      chessOpponentTime = totalTime * 1000;
      
      chessIsAnalysisMode = false;
      chessSelectedSquare = null;
      
      document.getElementById('chess-opp-name').innerText = chessOpponentName;
      document.getElementById('chess-opp-rating').innerText = chessOpponentRating;
      document.getElementById('chess-opp-hud-name').innerText = chessOpponentName;
      document.getElementById('chess-opp-hud-rating').innerText = chessOpponentRating;
      document.getElementById('chess-opp-avatar').innerText = chessOpponentName[0].toUpperCase();
      
      document.getElementById('chess-local-hud-name').innerText = window.GamingHubState.state.currentUser.username;
      const tcKey = room.timeControl.toLowerCase();
      const selfRating = window.GamingHubState.state.currentUser.chessRatings[tcKey] || 100;
      document.getElementById('chess-local-hud-rating').innerText = selfRating;
      document.getElementById('chess-local-avatar').innerText = window.GamingHubState.state.currentUser.username[0].toUpperCase();
      
      document.getElementById('chess-tc-label').innerText = `${room.timeControl} (${totalTime/60} Min)`;
      
      document.getElementById('chess-analysis-controls').classList.add('hidden');
      document.getElementById('chess-game-actions').classList.remove('hidden');
      
      document.getElementById('chess-moves-list').innerHTML = '';
      
      if (chessClockInterval) clearInterval(chessClockInterval);
      chessClockInterval = setInterval(() => {
        if (chessGame.isGameOver) {
          clearInterval(chessClockInterval);
          return;
        }
        
        const activeColor = chessGame.turn;
        const myActive = (activeColor === chessMyColor);
        
        if (myActive) {
          chessLocalTime = Math.max(0, chessLocalTime - 1000);
          if (chessLocalTime <= 0) {
            clearInterval(chessClockInterval);
            handleGameOverTimeLoss(chessMyColor);
          }
        } else {
          chessOpponentTime = Math.max(0, chessOpponentTime - 1000);
          if (chessOpponentTime <= 0) {
            clearInterval(chessClockInterval);
            handleGameOverTimeLoss(activeColor);
          }
        }
        updateClocksUI();
      }, 1000);
      
      redrawChessBoard();
      updateMovesNotationUI();
      updateClocksUI();
      
      if (chessIsBot && chessGame.turn !== chessMyColor) {
        setTimeout(triggerBotTurn, Math.random() * 1000 + 500);
      }
    },
    
    stopGame: () => {
      if (chessClockInterval) {
        clearInterval(chessClockInterval);
        chessClockInterval = null;
      }
    },
    
    receiveSyncedMove: (from, to) => {
      if (chessGame && !chessGame.isGameOver) {
        chessGame.makeMove(from, to);
        window.GamingHubAudio.play('deal');
        redrawChessBoard();
        updateMovesNotationUI();
        updateClocksUI();
        if (chessGame.isGameOver) {
          handleChessGameOver();
        }
      }
    },
    
    receiveSyncedResign: (senderName) => {
      if (chessGame && !chessGame.isGameOver) {
        const color = senderName === chessOpponentName ? (chessMyColor === 'white' ? 'black' : 'white') : chessMyColor;
        chessGame.resign(color);
        redrawChessBoard();
        handleChessGameOver();
      }
    },
    
    receiveSyncedDrawOffer: (senderName) => {
      if (confirm(`${senderName} offers a draw. Accept?`)) {
        window.GamingHubSync.sendChessDrawResponse(true);
        chessGame.declareDraw('draw_agreement');
        redrawChessBoard();
        handleChessGameOver();
      } else {
        window.GamingHubSync.sendChessDrawResponse(false);
      }
    },
    
    receiveSyncedDrawResponse: (senderName, accepted) => {
      if (accepted) {
        showToast("Draw offer accepted!");
        chessGame.declareDraw('draw_agreement');
        redrawChessBoard();
        handleChessGameOver();
      } else {
        showToast("Draw offer declined.");
      }
    },
    
    localResign: () => {
      if (chessGame && !chessGame.isGameOver) {
        chessGame.resign(chessMyColor);
        redrawChessBoard();
        handleChessGameOver();
      }
    },
    
    startAnalysis
  };

  // --- NITRO TYPE GAME ENGINE ---
  let nitroActiveRoom = null;
  let nitroStartTime = null;
  let nitroElapsedTime = 0;
  let nitroTypingTimer = null;
  let nitroParagraph = '';
  let nitroCorrectCharCount = 0;
  let nitroTotalKeystrokes = 0;
  let nitroCorrectKeystrokes = 0;
  let nitroFinished = false;
  let nitroBotIntervals = [];
  let nitroLocalLaneIndex = 0;
  let nitroCarBoost = 0;
  let nitroFinishedPlayers = [];
  let nitroPlayersProgress = {};

  const SHOP_CARS = [
    { id: 'rust_bucket', name: 'Rust Bucket', emoji: '🚜', tier: 'Trash', cost: 0, boost: 0.00, desc: 'A rusty old bucket. Slow but gets you from A to B.' },
    { id: 'shopping_cart', name: 'Shopping Cart', emoji: '🛒', tier: 'Trash', cost: 30, boost: 0.01, desc: 'A wobbly wheel, but surprisingly aerodynamic.' },
    { id: 'cardboard_cruiser', name: 'Cardboard Cruiser', emoji: '📦', tier: 'Trash', cost: 40, boost: 0.01, desc: 'Literally a cardboard box with wheels drawn on.' },
    { id: 'tricycle', name: 'Lil Tricycle', emoji: '🚲', tier: 'Trash', cost: 50, boost: 0.01, desc: 'Three wheels of fury. Ring the bell!' },
    { id: 'lemon_beetle', name: 'Lemon Beetle', emoji: '🚗', tier: 'Trash', cost: 60, boost: 0.01, desc: 'Squeaks at every turn, but it has character.' },
    { id: 'electric_scooter', name: 'e-Scooter', emoji: '🛴', tier: 'Modest', cost: 75, boost: 0.02, desc: 'Silent but agile. Watch out for potholes.' },
    { id: 'pizza_van', name: 'Pizza Delivery', emoji: '🍕', tier: 'Modest', cost: 85, boost: 0.02, desc: 'Smells like pepperoni. Decent acceleration.' },
    { id: 'taxi', name: 'City Taxi', emoji: '🚕', tier: 'Modest', cost: 95, boost: 0.02, desc: 'Always in a hurry. Comes with a metered fare.' },
    { id: 'retro_sedan', name: 'Retro Sedan', emoji: '🚙', tier: 'Modest', cost: 110, boost: 0.02, desc: 'A classic 90s ride in pristine condition.' },
    { id: 'delivery_truck', name: 'Postal Truck', emoji: '🚚', tier: 'Modest', cost: 115, boost: 0.02, desc: 'Delivering packages at moderate typing speeds.' },
    { id: 'police_cruiser', name: 'Interceptor', emoji: '🚓', tier: 'Fire', cost: 125, boost: 0.035, desc: 'Equipped with flashing sirens and aggressive styling.' },
    { id: 'hot_rod', name: 'Hot Rod', emoji: '🏎️', tier: 'Fire', cost: 130, boost: 0.035, desc: 'Flames painted on the side make it go faster!' },
    { id: 'fire_engine', name: 'Fire Engine', emoji: '🚒', tier: 'Fire', cost: 135, boost: 0.035, desc: 'Fires up the lane! Sirens blaring and typing blazing.' },
    { id: 'super_bike', name: 'Super Bike', emoji: '🏍️', tier: 'Fire', cost: 140, boost: 0.035, desc: 'Two wheels, maximum lean, and blazing acceleration.' },
    { id: 'neon_drifter', name: 'Neon Drifter', emoji: '⚡', tier: 'Fire', cost: 145, boost: 0.035, desc: 'Glows in the dark. Perfect for night races.' },
    { id: 'warp_ship', name: 'Warp Ship', emoji: '🛸', tier: 'God', cost: 200, boost: 0.05, desc: 'Bypasses traffic via wormholes. Out-of-this-world WPM boost.' },
    { id: 'golden_hyper', name: 'Golden Hypercar', emoji: '👑', tier: 'God', cost: 250, boost: 0.05, desc: 'Plated in pure 24k gold. Unmatched prestige.' },
    { id: 'stealth_bomber', name: 'Stealth Fighter', emoji: '✈️', tier: 'God', cost: 350, boost: 0.05, desc: 'Breaking the sound barrier silently. Absolutely elite.' },
    { id: 'millenium_racer', name: 'Millennium Racer', emoji: '🚀', tier: 'God', cost: 480, boost: 0.05, desc: 'Out of this world speed. Lightyears ahead.' }
  ];

  const PARAGRAPHS = [
    "The quick brown fox jumps over the lazy dog. This classical phrase contains every letter in the English alphabet. Typing it repeatedly is a great way to warm up your fingers. Speed and accuracy are both critical for victory.",
    "Space exploration has captured human imagination for decades. We dream of walking on distant planets and searching for alien life. New rockets are being designed to carry astronauts further than ever before. The future of humanity lies among the stars.",
    "Deep in the tropical rainforest, a hidden waterfall cascades into a crystal-clear pool. Colorful parrots fly between the giant green trees, filling the air with their loud calls. Small frogs hide under damp leaves to stay cool in the midday heat. It is a vibrant ecosystem full of life and mystery.",
    "The digital age has transformed the way we communicate and work. Information now travels around the globe in a fraction of a second. Programming languages allow us to build incredible software and games. Learning to type quickly is an essential skill in this modern world.",
    "A warm cup of coffee is the perfect way to start a quiet morning. The rich aroma fills the kitchen as the sun begins to rise. Outside the window, birds sing their morning songs in the garden. Today holds endless possibilities and new opportunities to learn.",
    "High up in the snow-capped mountains, the air is crisp and clean. Skiers glide gracefully down the steep slopes, leaving smooth tracks behind them. The winter landscape looks like a beautiful painting covered in white. At night, everyone gathers around a warm fireplace.",
    "Ocean currents play a crucial role in regulating our planet's climate. They transport warm water from the equator to the freezing poles. Beneath the surface, vast coral reefs support a diverse array of marine species. Protecting these fragile underwater environments is more important than ever.",
    "The ancient library was filled with thousands of dusty leather books. Scholars from far away came to study the rare manuscripts and maps. Dim candlelight flickered against the stone walls, creating long shadows. Every page held secrets of history waiting to be rediscovered.",
    "Electric cars are becoming increasingly popular on roads worldwide. They produce zero emissions and help reduce air pollution in busy cities. Advanced batteries allow them to travel long distances on a single charge. The transition to clean energy is accelerating rapidly.",
    "Gardening is a relaxing hobby that connects us with the natural world. Digging in the rich soil and planting seeds brings a sense of peace. With daily watering and sunlight, tiny green shoots soon emerge. Harvesting your own fresh vegetables is incredibly rewarding.",
    "Artificial intelligence is changing many aspects of our daily lives. Smart assistants can answer questions and organize our busy schedules. Machine learning models analyze complex data to solve difficult scientific problems. The potential benefits and challenges of this technology are immense.",
    "A bustling city street is full of energy and diverse sights. Street musicians play lively tunes as people hurry past on the sidewalks. Food vendors sell delicious snacks that fill the air with tempting smells. Neon lights turn the evening into a colorful display.",
    "Exploring the wilderness requires careful preparation and the right gear. Hikers must carry enough fresh water and navigate using a reliable map. Setting up a campsite before sunset ensures a safe and comfortable night. The quiet sounds of nature help you fall asleep under the stars.",
    "Modern architecture often combines sleek glass panels with strong steel beams. Green roofs covered in grass help insulate buildings and absorb rainwater. Large windows let in abundant natural light to create open spaces. These designs aim to blend functionality with environmental sustainability.",
    "Playing a musical instrument requires patience, practice, and dedication. Repeating scales and chords helps build muscle memory in your fingers. Over time, separate notes blend together into a beautiful melody. The joy of creating music makes all the hard work worthwhile.",
    "Cooking a delicious meal is both a creative art and a science. Balancing different spices and fresh ingredients creates complex flavors. The sizzle of food in a hot pan is a satisfying sound. Sharing a home-cooked dinner with good friends makes the experience even better.",
    "The history of video games is filled with rapid technological innovation. Simple arcade games of the past have evolved into immersive virtual worlds. Players can now connect and cooperate with others from all over the globe. The industry continues to push the boundaries of storytelling and graphics.",
    "A calm lake reflects the colors of the sunset like a giant mirror. A gentle breeze creates tiny ripples across the golden surface. A lone canoe glides quietly near the shore, disturbing the silence. It is the perfect moment to pause and appreciate the beauty of nature.",
    "Renewable energy sources like wind and solar power are growing fast. Giant wind turbines spin gracefully on hillsides to generate clean electricity. Solar panels cover house roofs, converting sunlight directly into usable power. Investing in these clean technologies is key to a sustainable future.",
    "Learning a new language opens doors to different cultures and perspectives. It allows you to speak with people you otherwise could not understand. Practice speaking every day, even if you make small mistakes at first. Consistency is the most important factor in achieving fluency."
  ];

  function getPlayerCarEmoji(username) {
    try {
      const saved = localStorage.getItem('gaming_hub_accounts_db');
      if (saved) {
        const db = JSON.parse(saved);
        const userKey = username.toLowerCase();
        if (db[userKey] && db[userKey].stats && db[userKey].stats.nitroTypeEquippedCar) {
          const equipped = db[userKey].stats.nitroTypeEquippedCar;
          const car = SHOP_CARS.find(c => c.id === equipped);
          if (car) return car.emoji;
        }
      }
    } catch (e) {
      console.warn("Failed to get player car emoji:", e);
    }
    return '🚜';
  }

  function renderCarShop() {
    const user = window.GamingHubState.state.currentUser;
    if (!user) return;

    const balanceEl = document.getElementById('shop-coins-val');
    if (balanceEl) balanceEl.innerText = user.nitroTypeCoins || 0;

    const grid = document.getElementById('shop-cars-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const ownedCars = user.nitroTypeCars || ['rust_bucket'];
    const equippedCar = user.nitroTypeEquippedCar || 'rust_bucket';

    SHOP_CARS.forEach(car => {
      const card = document.createElement('div');
      const isOwned = ownedCars.includes(car.id);
      const isEquipped = (equippedCar === car.id);

      card.className = `car-card ${isEquipped ? 'equipped' : ''}`;
      
      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button class="btn btn-secondary shop-action-btn" disabled>Equipped</button>`;
      } else if (isOwned) {
        btnHtml = `<button class="btn btn-primary shop-action-btn" onclick="window.GamingHubNitroUI.handleEquipCar('${car.id}')">Equip</button>`;
      } else {
        const hasEnough = (user.nitroTypeCoins || 0) >= car.cost;
        btnHtml = `<button class="btn btn-primary shop-action-btn" ${hasEnough ? '' : 'disabled'} onclick="window.GamingHubNitroUI.handlePurchaseCar('${car.id}', ${car.cost})">Buy (${car.cost} 🪙)</button>`;
      }

      card.innerHTML = `
        <span class="car-tier-badge car-tier-${car.tier.toLowerCase()}">${car.tier}</span>
        <div class="car-sprite">${car.emoji}</div>
        <div class="car-name">${car.name}</div>
        <p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; min-height: 36px; margin: 0;">${car.desc}</p>
        <div class="car-boost-info">
          <span>Boost: +${(car.boost * 100).toFixed(1)}%</span>
          <span>${isOwned ? 'Owned' : car.cost + ' 🪙'}</span>
        </div>
        ${btnHtml}
      `;
      grid.appendChild(card);
    });
  }

  function renderHexanautLeaderboard() {
    const container = document.getElementById('hexanaut-leaderboard-list');
    if (!container) return;
    container.innerHTML = '';

    let accounts = {};
    try {
      const saved = localStorage.getItem('gaming_hub_accounts_db');
      if (saved) accounts = JSON.parse(saved);
    } catch(e) {}

    const botUsernames = ['magnusmini', 'hikarufan', 'pokerqueen', 'blunderking', 'rookandroll'];
    const list = Object.values(accounts)
      .filter(acc => acc && acc.username && !botUsernames.includes(acc.username.toLowerCase()))
      .map(acc => ({
        username: acc.username,
        maxPercent: (acc.stats && acc.stats.hexanautMaxPercent) !== undefined ? acc.stats.hexanautMaxPercent : 0
      }));

    list.sort((a, b) => b.maxPercent - a.maxPercent);

    if (list.length === 0) {
      container.innerHTML = '<div class="leaderboard-row empty">No registered players yet.</div>';
      return;
    }

    list.forEach((player, index) => {
      const rankNum = index + 1;
      const row = document.createElement('div');
      row.className = `leaderboard-row rank-${rankNum <= 3 ? rankNum : 'other'}`;
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; width:18px;">#${rankNum}</span>
          <strong>${player.username}</strong>
        </div>
        <span style="font-weight:600; color:var(--accent-gold);">${(player.maxPercent || 0).toFixed(1)}%</span>
      `;
      container.appendChild(row);
    });
  }

  function renderNitroLeaderboard() {
    const container = document.getElementById('nitro-leaderboard-list');
    if (!container) return;
    container.innerHTML = '';

    let accounts = {};
    try {
      const saved = localStorage.getItem('gaming_hub_accounts_db');
      if (saved) accounts = JSON.parse(saved);
    } catch(e) {}

    const botUsernames = ['magnusmini', 'hikarufan', 'pokerqueen', 'blunderking', 'rookandroll'];
    const list = Object.values(accounts)
      .filter(acc => acc && acc.username && !botUsernames.includes(acc.username.toLowerCase()))
      .map(acc => ({
        username: acc.username,
        level: (acc.stats && acc.stats.nitroTypeLevel) !== undefined ? acc.stats.nitroTypeLevel : 1
      }));

    list.sort((a, b) => b.level - a.level);

    if (list.length === 0) {
      container.innerHTML = '<div class="leaderboard-row empty">No registered players yet.</div>';
      return;
    }

    list.forEach((player, index) => {
      const rankNum = index + 1;
      const row = document.createElement('div');
      row.className = `leaderboard-row rank-${rankNum <= 3 ? rankNum : 'other'}`;
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight:700; width:18px;">#${rankNum}</span>
          <strong>${player.username}</strong>
        </div>
        <span style="font-weight:600; color:#ec4899;">Level ${player.level}</span>
      `;
      container.appendChild(row);
    });
  }

  window.GamingHubNitroUI = {
    activeRoom: () => nitroActiveRoom,
    handlePurchaseCar: (carId, cost) => {
      window.GamingHubState.purchaseCar(carId, cost);
      window.GamingHubAudio.play('chip');
      renderCarShop();
      window.GamingHubUI.showToast(`Purchased ${carId.replace('_', ' ')}!`);
    },

    handleEquipCar: (carId) => {
      window.GamingHubState.equipCar(carId);
      window.GamingHubAudio.play('deal');
      renderCarShop();
      window.GamingHubUI.showToast(`Equipped new car!`);
    },

    receiveSyncedProgress: (username, progress, wpm) => {
      if (!nitroActiveRoom) return;
      nitroPlayersProgress[username] = progress;
      
      const pIndex = nitroActiveRoom.players.findIndex(p => p.username === username);
      if (pIndex !== -1) {
        const lane = document.getElementById('nitro-lane-' + pIndex);
        if (lane) {
          const wpmEl = lane.querySelector('.lane-player-wpm');
          if (wpmEl) wpmEl.innerText = `${Math.round(wpm)} WPM`;
          const carEl = document.getElementById('racer-car-' + pIndex);
          if (carEl) {
            carEl.style.left = `calc(${progress * 100}% - 32px)`;
          }
        }
        if (progress >= 1.0 && !nitroFinishedPlayers.includes(username)) {
          nitroFinishedPlayers.push(username);
        }
      }
    },

    startGame: (activeRoom) => {
      nitroActiveRoom = activeRoom;
      nitroStartTime = null;
      nitroElapsedTime = 0;
      nitroFinished = false;
      nitroCorrectCharCount = 0;
      nitroTotalKeystrokes = 0;
      nitroCorrectKeystrokes = 0;
      nitroFinishedPlayers = [];
      nitroPlayersProgress = {};

      if (nitroTypingTimer) {
        clearInterval(nitroTypingTimer);
        nitroTypingTimer = null;
      }
      nitroBotIntervals.forEach(clearInterval);
      nitroBotIntervals = [];

      const localUser = window.GamingHubState.state.currentUser;
      if (!localUser) return;

      const lvlSpan = document.getElementById('nitro-race-level');
      if (lvlSpan) lvlSpan.innerText = localUser.nitroTypeLevel || 1;
      const starsSpan = document.getElementById('nitro-race-stars');
      if (starsSpan) starsSpan.innerText = `${localUser.nitroTypeStars || 0}/3`;

      const equippedCar = localUser.nitroTypeEquippedCar || 'rust_bucket';
      const carConfig = SHOP_CARS.find(c => c.id === equippedCar);
      nitroCarBoost = carConfig ? carConfig.boost : 0;

      const roomHash = activeRoom.roomId.split('_').pop();
      const seed = parseInt(roomHash) || Date.now();
      const paragraphIndex = seed % PARAGRAPHS.length;
      nitroParagraph = PARAGRAPHS[paragraphIndex];

      const paragraphBox = document.getElementById('nitro-paragraph-box');
      if (paragraphBox) {
        paragraphBox.innerHTML = '';
        for (let i = 0; i < nitroParagraph.length; i++) {
          const span = document.createElement('span');
          span.innerText = nitroParagraph[i];
          span.id = 'nitro-char-' + i;
          paragraphBox.appendChild(span);
        }
        const firstChar = document.getElementById('nitro-char-0');
        if (firstChar) firstChar.classList.add('char-current');
      }

      const players = activeRoom.players;
      nitroLocalLaneIndex = players.findIndex(p => p.username === localUser.username);

      for (let i = 0; i < 5; i++) {
        const lane = document.getElementById('nitro-lane-' + i);
        if (lane) {
          if (i < players.length) {
            lane.classList.remove('hidden');
            const player = players[i];
            const nameEl = lane.querySelector('.lane-player-name');
            if (nameEl) nameEl.innerText = `${player.username} (Lvl ${player.level})`;
            const wpmEl = lane.querySelector('.lane-player-wpm');
            if (wpmEl) wpmEl.innerText = '0 WPM';
            const carEl = document.getElementById('racer-car-' + i);
            if (carEl) {
              carEl.style.left = '0%';
              carEl.innerText = player.isBot ? '🚗' : getPlayerCarEmoji(player.username);
            }
          } else {
            lane.classList.add('hidden');
          }
        }
      }

      const input = document.getElementById('nitro-type-input');
      if (input) {
        input.value = '';
        input.disabled = true;
      }

      const liveWpm = document.getElementById('nitro-live-wpm');
      if (liveWpm) liveWpm.innerText = '0';
      const liveAcc = document.getElementById('nitro-live-acc');
      if (liveAcc) liveAcc.innerText = '100%';

      let countdown = 3;
      const msgEl = document.getElementById('nitro-message');
      if (msgEl) {
        msgEl.innerText = `Warm up your fingers! Race starts in ${countdown}...`;
      }
      window.GamingHubAudio.play('chip');

      const countdownTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          if (msgEl) msgEl.innerText = `Warm up your fingers! Race starts in ${countdown}...`;
          window.GamingHubAudio.play('chip');
        } else {
          clearInterval(countdownTimer);
          if (msgEl) msgEl.innerText = 'GO!';
          window.GamingHubAudio.play('shuffle');
          if (input) {
            input.disabled = false;
            input.focus();
          }
          nitroStartTime = Date.now();
          window.GamingHubNitroUI.startRaceLoops();
        }
      }, 1000);
    },

    startRaceLoops: () => {
      const input = document.getElementById('nitro-type-input');
      let lastVal = '';

      if (input) {
        input.oninput = () => {
          if (nitroFinished || !nitroStartTime) {
            input.value = '';
            return;
          }

          let val = input.value;
          let errIdx = val.length;
          for (let i = 0; i < val.length; i++) {
            if (val[i] !== nitroParagraph[i]) {
              errIdx = i;
              break;
            }
          }

          // Enforce redo: block typing beyond the first incorrect character
          if (val.length > errIdx + 1) {
            val = val.substring(0, errIdx + 1);
            input.value = val;
          }

          if (val.length > lastVal.length) {
            nitroTotalKeystrokes++;
            const charTyped = val[val.length - 1];
            const targetChar = nitroParagraph[val.length - 1];
            if (charTyped === targetChar && errIdx === val.length) {
              nitroCorrectKeystrokes++;
            }
          }
          lastVal = val;

          for (let i = 0; i < nitroParagraph.length; i++) {
            const charSpan = document.getElementById('nitro-char-' + i);
            if (!charSpan) continue;
            charSpan.className = '';
            if (i < errIdx) {
              charSpan.classList.add('char-correct');
            } else if (i < val.length) {
              charSpan.classList.add('char-incorrect');
            }
            if (i === val.length) {
              charSpan.classList.add('char-current');
            }
          }

          nitroCorrectCharCount = errIdx;
          let progress = (nitroCorrectCharCount / nitroParagraph.length) * (1 + nitroCarBoost);
          if (progress > 1.0) progress = 1.0;

          const localCar = document.getElementById('racer-car-' + nitroLocalLaneIndex);
          if (localCar) {
            localCar.style.left = `calc(${progress * 100}% - 32px)`;
          }

          const elapsedSecs = (Date.now() - nitroStartTime) / 1000;
          const minutes = elapsedSecs / 60;
          const wpm = minutes > 0 ? Math.round((nitroCorrectCharCount / 5) / minutes) : 0;
          
          const lane = document.getElementById('nitro-lane-' + nitroLocalLaneIndex);
          if (lane) {
            const wpmEl = lane.querySelector('.lane-player-wpm');
            if (wpmEl) wpmEl.innerText = `${wpm} WPM`;
          }

          window.GamingHubSync.sendNitroProgress(progress, wpm);

          if (nitroCorrectCharCount === nitroParagraph.length) {
            nitroFinished = true;
            input.disabled = true;
            
            const localUsername = window.GamingHubState.state.currentUser.username;
            if (!nitroFinishedPlayers.includes(localUsername)) {
              nitroFinishedPlayers.push(localUsername);
            }

            setTimeout(() => {
              window.GamingHubNitroUI.endRace();
            }, 1000);
          }
        };
      }

      nitroTypingTimer = setInterval(() => {
        if (nitroFinished || !nitroStartTime) return;

        const elapsedSecs = (Date.now() - nitroStartTime) / 1000;
        const minutes = elapsedSecs / 60;
        const wpm = minutes > 0 ? Math.round((nitroCorrectCharCount / 5) / minutes) : 0;
        const accuracy = nitroTotalKeystrokes > 0 ? Math.round((nitroCorrectKeystrokes / nitroTotalKeystrokes) * 100) : 100;

        const liveWpm = document.getElementById('nitro-live-wpm');
        if (liveWpm) liveWpm.innerText = wpm;
        const liveAcc = document.getElementById('nitro-live-acc');
        if (liveAcc) liveAcc.innerText = accuracy + '%';

        nitroActiveRoom.players.forEach((player, idx) => {
          if (player.isBot) {
            if (!player.wpm) {
              const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;
              if (selfLevel <= 3) {
                // Strictly no more than 13 WPM for level 3 or below
                player.wpm = 5 + (idx * 2);
              } else {
                // Spacing is at least 5 + idx * 2 to keep them distinct at very low levels
                const minWpm = 5 + (idx * 2);
                const calculatedWpm = selfLevel - 10 + (idx * 4.5) + Math.random() * 1.0;
                player.wpm = Math.round(Math.max(minWpm, calculatedWpm));
              }
            }

            const botProgress = player.progress || 0;
            if (botProgress < 1.0) {
              const charPerSec = (player.wpm * 5) / 60;
              const jitter = 0.8 + Math.random() * 0.4;
              const inc = (charPerSec * 0.1 / nitroParagraph.length) * jitter;
              const nextProgress = Math.min(1.0, botProgress + inc);
              player.progress = nextProgress;

              const carEl = document.getElementById('racer-car-' + idx);
              if (carEl) {
                carEl.style.left = `calc(${nextProgress * 100}% - 32px)`;
              }

              const lane = document.getElementById('nitro-lane-' + idx);
              if (lane) {
                const wpmEl = lane.querySelector('.lane-player-wpm');
                if (wpmEl) wpmEl.innerText = `${Math.round(player.wpm)} WPM`;
              }

              if (nextProgress >= 1.0) {
                if (!nitroFinishedPlayers.includes(player.username)) {
                  nitroFinishedPlayers.push(player.username);
                }
              }
            }
          }
        });
      }, 100);
    },

    endRace: () => {
      if (nitroTypingTimer) {
        clearInterval(nitroTypingTimer);
        nitroTypingTimer = null;
      }
      nitroBotIntervals.forEach(clearInterval);
      nitroBotIntervals = [];

      const localUser = window.GamingHubState.state.currentUser;
      if (!localUser) return;

      const finalStandings = [...nitroFinishedPlayers];
      
      const remaining = nitroActiveRoom.players
        .filter(p => !finalStandings.includes(p.username))
        .map(p => {
          let progress = 0;
          if (p.username === localUser.username) {
            progress = (nitroCorrectCharCount / nitroParagraph.length) * (1 + nitroCarBoost);
          } else if (p.isBot) {
            progress = p.progress || 0;
          } else {
            progress = nitroPlayersProgress[p.username] || 0;
          }
          return { username: p.username, progress };
        })
        .sort((a, b) => b.progress - a.progress);

      remaining.forEach(p => finalStandings.push(p.username));

      const myPlace = finalStandings.indexOf(localUser.username) + 1;

      let level = localUser.nitroTypeLevel || 1;
      let stars = localUser.nitroTypeStars || 0;
      let coinsGained = 0;
      let starsGained = 0;

      if (myPlace === 1) {
        starsGained = 3;
        coinsGained = 3;
      } else if (myPlace === 2) {
        starsGained = 2;
        coinsGained = 2;
      } else if (myPlace === 3) {
        starsGained = 1;
        coinsGained = 1;
      } else if (myPlace === 4) {
        starsGained = -1;
        coinsGained = 0;
      } else if (myPlace === 5) {
        starsGained = -2;
        coinsGained = 0;
      }

      let nextStars = stars + starsGained;
      let nextLevel = level;
      let leveledUp = false;

      if (nextStars >= 3) {
        nextLevel = Math.min(100, level + 1);
        nextStars = 0;
        leveledUp = true;
        coinsGained += 3;
      } else if (nextStars < 0) {
        nextStars = 0;
      }

      window.GamingHubState.recordNitroTypeResult(myPlace, nextLevel, nextStars, coinsGained);

      if (myPlace <= 3) {
        window.GamingHubAudio.play('shuffle');
      } else {
        window.GamingHubAudio.play('deal');
      }

      const titleEl = document.getElementById('nitro-results-title');
      if (titleEl) {
        let suffix = 'th';
        if (myPlace === 1) suffix = 'st';
        else if (myPlace === 2) suffix = 'nd';
        else if (myPlace === 3) suffix = 'rd';
        titleEl.innerText = `${myPlace}${suffix} Place!`;
      }

      const descEl = document.getElementById('nitro-results-desc');
      if (descEl) {
        if (leveledUp) {
          descEl.innerText = `Leveled up to Level ${nextLevel}! 🎉`;
        } else {
          descEl.innerText = `Keep racing to level up! Current: Lvl ${nextLevel} (⭐${nextStars}/3)`;
        }
      }

      const rewardCoinsEl = document.getElementById('nitro-reward-coins');
      if (rewardCoinsEl) rewardCoinsEl.innerText = `+${coinsGained} 🪙`;

      const rewardStarsEl = document.getElementById('nitro-reward-stars');
      if (rewardStarsEl) {
        rewardStarsEl.innerText = `${starsGained >= 0 ? '+' : ''}${starsGained} ⭐`;
        rewardStarsEl.style.color = starsGained >= 0 ? '#a78bfa' : '#ef4444';
      }

      for (let i = 1; i <= 3; i++) {
        const slot = document.getElementById('nitro-star-' + i);
        if (slot) {
          if (i <= nextStars) {
            slot.innerText = '★';
            slot.style.color = 'var(--accent-gold)';
          } else {
            slot.innerText = '☆';
            slot.style.color = 'var(--text-muted)';
          }
        }
      }

      const lvlUpText = document.getElementById('nitro-level-up-text');
      if (lvlUpText) {
        if (leveledUp) {
          lvlUpText.classList.remove('hidden');
          lvlUpText.innerText = `LEVEL UP! LEVEL ${nextLevel}`;
        } else {
          lvlUpText.classList.add('hidden');
        }
      }

      const listContainer = document.getElementById('nitro-placements-list');
      if (listContainer) {
        listContainer.innerHTML = '';
        finalStandings.forEach((username, rankIdx) => {
          const rNum = rankIdx + 1;
          const playerObj = nitroActiveRoom.players.find(p => p.username === username);
          
          let wpm = 0;
          if (username === localUser.username) {
            const elapsedSecs = (Date.now() - nitroStartTime) / 1000;
            const minutes = elapsedSecs / 60;
            wpm = minutes > 0 ? Math.round((nitroCorrectCharCount / 5) / minutes) : 0;
          } else if (playerObj && playerObj.isBot) {
            wpm = playerObj.wpm || 0;
          } else {
            wpm = playerObj ? playerObj.wpm || 50 : 50;
          }

          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.style.alignItems = 'center';
          row.style.padding = '8px 12px';
          row.style.background = username === localUser.username ? 'rgba(138,43,226,0.15)' : 'rgba(255,255,255,0.02)';
          row.style.border = username === localUser.username ? '1px solid var(--accent-purple)' : '1px solid rgba(255,255,255,0.05)';
          row.style.borderRadius = '6px';
          row.style.marginBottom = '6px';

          row.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:800; color:var(--text-muted); width:20px;">#${rNum}</span>
              <strong>${username} ${playerObj && playerObj.isBot ? '(Bot)' : ''}</strong>
            </div>
            <span style="font-weight:700; color:var(--accent-gold);">${Math.round(wpm)} WPM</span>
          `;
          listContainer.appendChild(row);
        });
      }

      const resultsModal = document.getElementById('modal-nitro-results');
      if (resultsModal) resultsModal.classList.remove('hidden');
    }
  };

  // Export UI Renderer
  window.GamingHubUI = {
    showScreen,
    updateHeader,
    showToast,
    renderFriendsList,
    updateActiveChat,
    showInviteModal,
    showChessInviteModal,
    showNitroInviteModal,
    showHexanautInviteModal,
    showFriendRequestModal,
    renderMatchmakingLobby,
    renderGameScreen,
    showShowdownModal,
    bindEvents,
    renderHexanautLeaderboard,
    sortChessLeaderboard: (category) => {
      const pills = document.getElementById('chess-leaderboard-pills');
      if (pills) {
        pills.querySelectorAll('.pill-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.getAttribute('data-sort-cat') === category) {
            btn.classList.add('active');
          }
        });
      }
      renderChessLeaderboard(category);
    },
    init: () => {
      bindEvents();
      // Update chip stack visualization regularly
      setInterval(() => {
        const user = window.GamingHubState.state.currentUser;
        if (user && window.GamingHubState.state.activeScreen === 'screen-game') {
          const gamePlayers = window.GamingHubPoker.getPlayers();
          const localP = gamePlayers.find(p => p.username === user.username);
          if (localP) {
            renderPlayerHUDChips(localP.cash);
          }
        }
      }, 500);
    }
  };
})();
