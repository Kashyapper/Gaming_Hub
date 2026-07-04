/* -------------------------------------------------------------
   GAMING HUB - BROADCASTCHANNEL SYNC LAYER (MULTIPLAYER)
------------------------------------------------------------- */

(function() {
  const CHANNEL_NAME = 'gaming_hub_network_channel';
  let channel = null;
  let matchmakingTimeout = null;
  let matchmakingStartTime = 0;
  let matchedPlayers = []; // List of real players found during matchmaking
  let activeGameRoom = null; // { roomId, players: [], hostUsername }

  let chessMatchmakingTimeout = null;
  let chessMatchedPlayers = [];
  let activeChessRoom = null;
  let chessTimeControl = 'Blitz';
  let lastChessInviteTabId = null;

  let nitroMatchmakingTimeout = null;
  let nitroMatchedPlayers = [];
  let activeNitroRoom = null;

  let usedParagraphIndices = [];
  try {
    const saved = localStorage.getItem('gaming_hub_nitro_used_paragraphs');
    if (saved) usedParagraphIndices = JSON.parse(saved);
  } catch (e) {}

  function getNextUniqueParagraphIndex() {
    let available = [];
    for (let i = 0; i < 20; i++) {
      if (!usedParagraphIndices.includes(i)) {
        available.push(i);
      }
    }
    if (available.length === 0) {
      usedParagraphIndices = [];
      for (let i = 0; i < 20; i++) {
        available.push(i);
      }
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    usedParagraphIndices.push(idx);
    try {
      localStorage.setItem('gaming_hub_nitro_used_paragraphs', JSON.stringify(usedParagraphIndices));
    } catch(e) {}
    return idx;
  }

  // Initialize BroadcastChannel with fallback for strict or private environments
  function init() {
    if (channel) return;
    
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = handleNetworkMessage;
      } catch (e) {
        console.warn("Failed to create BroadcastChannel:", e);
        setupInMemoryChannelFallback();
      }
    } else {
      setupInMemoryChannelFallback();
    }
    
    // Broadcast that we are online
    sendPing(true);
    
    // Listen for tab closing to broadcast offline status and leave game if active
    window.addEventListener('beforeunload', () => {
      if (activeGameRoom) {
        if (window.GamingHubPoker && window.GamingHubPoker.settleMatch) {
          window.GamingHubPoker.settleMatch(false);
        }
        postMessage('GAME_LEAVE', { roomId: activeGameRoom.roomId, senderTabId: getTabId() });
        activeGameRoom = null;
      }
      sendPing(false);
    });
  }

  function setupInMemoryChannelFallback() {
    console.warn("Falling back to in-memory local network emulator.");
    channel = {
      postMessage: (data) => {
        const event = new CustomEvent('mock_broadcast_message', { detail: data });
        window.dispatchEvent(event);
      },
      close: () => {}
    };
    
    window.addEventListener('mock_broadcast_message', (e) => {
      // Run asynchronously to mimic network
      setTimeout(() => {
        handleNetworkMessage({ data: e.detail });
      }, 0);
    });
  }

  // Helper to send message over BroadcastChannel
  function postMessage(type, data = {}) {
    if (!channel) return;
    const sender = window.GamingHubState.state.currentUser ? window.GamingHubState.state.currentUser.username : 'Guest';
    channel.postMessage({
      type,
      sender,
      timestamp: Date.now(),
      data
    });
  }

  // Ping/Pong presence sync
  function sendPing(isOnline) {
    if (!window.GamingHubState.state.currentUser) return;
    const user = window.GamingHubState.state.currentUser;
    postMessage(isOnline ? 'PRESENCE_PING' : 'PRESENCE_BYE', {
      stats: {
        cash: user.totalCash || 1000,
        wins: user.wins || 0,
        hands: user.handsPlayed || 0
      }
    });
  }

  // Broadcast current stats
  function broadcastStats() {
    if (!window.GamingHubState.state.currentUser) return;
    postMessage('STATS_UPDATE', {
      stats: {
        cash: window.GamingHubState.state.currentUser.totalCash,
        wins: window.GamingHubState.state.currentUser.wins,
        hands: window.GamingHubState.state.currentUser.handsPlayed
      }
    });
  }

  // Send a chat message to a friend
  function sendChatMessage(friendUsername, text) {
    const sender = window.GamingHubState.state.currentUser.username;
    // Add locally
    window.GamingHubState.addChatMessage(friendUsername, sender, text);
    // Broadcast to other tabs
    postMessage('CHAT_MSG', {
      recipient: friendUsername,
      text: text
    });
  }

  // Send a friend request (adds directly, triggers response)
  function sendFriendRequest(friendUsername) {
    postMessage('FRIEND_REQ', {
      recipient: friendUsername
    });
  }

  let lastInviteTabId = null;

  // Send game invite
  function sendGameInvite(friendUsername) {
    postMessage('GAME_INVITE', {
      recipient: friendUsername,
      tabId: getTabId()
    });
  }

  // Respond to game invite
  function respondToInvite(senderUsername, accepted) {
    postMessage('GAME_INVITE_RESPONSE', {
      recipient: senderUsername,
      accepted: accepted,
      tabId: getTabId()
    });
    if (accepted) {
      // Transition player to matchmaking screen
      window.GamingHubUI.showScreen('screen-matchmaking');
      activeGameRoom = {
        roomId: 'room_waiting', // Overwritten on GAME_START
        players: matchedPlayers,
        hostUsername: senderUsername,
        hostTabId: lastInviteTabId || 'host'
      };
      
      const selfName = window.GamingHubState.state.currentUser.username;
      
      matchedPlayers = [
        { username: senderUsername, cash: 1000, isBot: false, tabId: lastInviteTabId || 'host' },
        { username: selfName, cash: 1000, isBot: false, tabId: getTabId() }
      ];
      window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, 0);
    }
  }

  // Respond to friend request
  function respondToFriendRequest(senderUsername, accepted) {
    if (accepted) {
      window.GamingHubState.addFriend(senderUsername);
      window.GamingHubState.updateFriendStatus(senderUsername, true);
      window.GamingHubUI.renderFriendsList();
      window.GamingHubUI.showToast(`You accepted ${senderUsername}'s friend request!`);
      postMessage('FRIEND_ACCEPT', {
        recipient: senderUsername
      });
    } else {
      window.GamingHubUI.showToast(`Declined friend request from ${senderUsername}.`);
      postMessage('FRIEND_DECLINE', {
        recipient: senderUsername
      });
    }
  }

  // Matchmaking: Start Searching
  function startMatchmaking(isFriendlyHost = false, invitees = []) {
    matchedPlayers = [];
    
    // Add ourself first
    const selfName = window.GamingHubState.state.currentUser.username;
    
    matchedPlayers.push({
      username: selfName,
      cash: 1000,
      isBot: false,
      tabId: getTabId()
    });

    matchmakingStartTime = Date.now();

    if (isFriendlyHost) {
      // Friendly host: We invite specific friends. We wait for their accepts.
      activeGameRoom = {
        roomId: 'room_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        players: matchedPlayers,
        hostUsername: selfName,
        hostTabId: getTabId(),
        isFriendly: true
      };
      
      // Send invite to everyone
      invitees.forEach(friend => {
        sendGameInvite(friend);
      });
      
      // Update UI to show waiting lobby
      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, 0);
      
      // Start 15s friendly filling with bots
      startMatchmakingTimer(true);
    } else {
      // Regular matchmaking: Broadcast query to find other players searching
      postMessage('MATCH_SEARCH', {
        tabId: getTabId(),
        cash: 1000
      });
      
      // Update UI to show matchmaking screen
      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, 15);
      
      // Start 15s countdown
      startMatchmakingTimer(false);
    }
  }

  // Matchmaking countdown timer
  function startMatchmakingTimer(isFriendly) {
    if (matchmakingTimeout) {
      clearInterval(matchmakingTimeout);
      matchmakingTimeout = null;
    }
    
    let secondsLeft = 15;
    matchmakingTimeout = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(matchmakingTimeout);
        matchmakingTimeout = null;
        // Timeout reached! Fill remaining seats with bots and launch game
        launchGameWithBots();
      } else {
        // Broadcast search again periodically to catch late searchers
        if (!isFriendly) {
          postMessage('MATCH_SEARCH', {
            tabId: getTabId(),
            cash: 1000
          });
        }
        window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, secondsLeft);
      }
    }, 1000);
  }

  // Cancel matchmaking search
  function cancelMatchmaking() {
    if (matchmakingTimeout) {
      clearInterval(matchmakingTimeout);
      matchmakingTimeout = null;
    }
    // Broadcast that we left matchmaking
    postMessage('MATCH_CANCEL', {
      tabId: getTabId()
    });
    activeGameRoom = null;
    window.GamingHubUI.showScreen('screen-dashboard');
  }

  // Fill empty spots (up to 8) with bots and start game
  function launchGameWithBots() {
    // Only the Host launches the game.
    const selfName = window.GamingHubState.state.currentUser.username;
    
    let isHost = false;
    let hostUsername = '';
    let hostTabId = '';
    if (activeGameRoom && activeGameRoom.hostUsername) {
      isHost = (activeGameRoom.hostTabId === getTabId() || (activeGameRoom.hostUsername === selfName && !activeGameRoom.hostTabId));
      hostUsername = activeGameRoom.hostUsername;
      hostTabId = activeGameRoom.hostTabId || 'host';
    } else {
      // Sort players by tabId to find host in public matchmaking
      const realPlayers = [...matchedPlayers];
      if (realPlayers.length > 0) {
        realPlayers.sort((a,b) => a.tabId.localeCompare(b.tabId));
        const hostPlayer = realPlayers[0];
        isHost = (hostPlayer.tabId === getTabId());
        hostUsername = hostPlayer.username;
        hostTabId = hostPlayer.tabId;
      }
    }

    if (!isHost) {
      // If we are not the host, wait for the host to send GAME_START
      return;
    }

    const roomId = activeGameRoom ? activeGameRoom.roomId : 'room_' + Date.now();
    
    // Large list of realistic player usernames to look like random online matchmaking players
    const botPool = [
      'Alex_P', 'SarahM', 'Jack99', 'Emma_S', 'Dave_R', 'Ryan21', 'Chloe_K', 'Chris_T', 'Jason_D', 'Jess_M', 
      'Liam_H', 'Olivia_F', 'Noah_W', 'Ava_R', 'Lucas_B', 'Mia_C', 'Ethan_D', 'Sophia_G', 'Mason_K', 'Isabella_L', 
      'Logan_P', 'Amelia_V', 'Jacob_N', 'Evelyn_F', 'Oliver_G', 'Harper_T', 'Daniel_C', 'Lily_R', 'Henry_S', 'Ella_W', 
      'Jackson_M', 'Avery_B', 'Sebastian_Z', 'Sofia_K', 'Aiden_L', 'Charlotte_V', 'Matthew_D', 'Aria_H', 'Samuel_F', 'Scarlett_C', 
      'David_Y', 'Victoria_G', 'Joseph_W', 'Grace_R', 'Carter_N', 'Chloe_M', 'Owen_L', 'Penelope_B', 'Wyatt_P', 'Layla_S', 
      'John_F', 'Lillian_J', 'Jack_D', 'Nora_V', 'Luke_M', 'Zoey_A', 'Dylan_O', 'Audrey_W', 'Leo_T', 'Stella_R', 
      'Isaiah_K', 'Zoe_B'
    ];

    // Filter out names matching any real players to avoid duplicates
    const realPlayerNames = matchedPlayers.map(p => p.username.toLowerCase());
    const availableBots = botPool.filter(name => !realPlayerNames.includes(name.toLowerCase()));
    
    // Shuffle the available bot names
    for (let i = availableBots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableBots[i], availableBots[j]] = [availableBots[j], availableBots[i]];
    }

    const gamePlayers = [...matchedPlayers];
    let botIndex = 0;
    while (gamePlayers.length < 8) {
      let bName = availableBots[botIndex % availableBots.length];
      gamePlayers.push({
        username: bName,
        cash: 1000, // Starts with exactly $1000
        isBot: true,
        tabId: 'bot_' + botIndex
      });
      botIndex++;
    }

    activeGameRoom = {
      roomId,
      players: gamePlayers,
      hostUsername,
      hostTabId
    };

    // Broadcast room details to all real players
    postMessage('GAME_START', {
      roomId: roomId,
      players: gamePlayers,
      hostUsername,
      hostTabId
    });

    // Switch UI to game screen for host
    window.GamingHubUI.showScreen('screen-game');

    // Start local poker game engine
    window.GamingHubPoker.startGame(gamePlayers, selfName, true);
  }

  // --- CHESS MATCHMAKING FUNCTIONS ---

  function startChessMatchmaking(isFriendlyHost = false, invitee = null, timeControl = 'Blitz') {
    chessMatchedPlayers = [];
    chessTimeControl = timeControl;

    const selfName = window.GamingHubState.state.currentUser.username;
    const tcKey = timeControl.toLowerCase();
    const selfRating = (window.GamingHubState.state.currentUser.chessRatings && window.GamingHubState.state.currentUser.chessRatings[tcKey]) || 100;

    chessMatchedPlayers.push({
      username: selfName,
      rating: selfRating,
      isBot: false,
      tabId: getTabId()
    });

    matchmakingStartTime = Date.now();

    if (isFriendlyHost) {
      activeChessRoom = {
        roomId: 'chess_room_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        players: chessMatchedPlayers,
        hostUsername: selfName,
        hostTabId: getTabId(),
        timeControl: timeControl,
        isFriendly: true
      };

      postMessage('CHESS_INVITE', {
        recipient: invitee,
        timeControl: timeControl,
        tabId: getTabId()
      });

      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(chessMatchedPlayers, 0, true);
      startChessMatchmakingTimer(true);
    } else {
      postMessage('CHESS_SEARCH', {
        tabId: getTabId(),
        rating: selfRating,
        timeControl: timeControl
      });

      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(chessMatchedPlayers, 15, true);
      startChessMatchmakingTimer(false);
    }
  }

  function startChessMatchmakingTimer(isFriendly) {
    if (chessMatchmakingTimeout) {
      clearInterval(chessMatchmakingTimeout);
      chessMatchmakingTimeout = null;
    }

    let secondsLeft = 15;
    chessMatchmakingTimeout = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(chessMatchmakingTimeout);
        chessMatchmakingTimeout = null;
        launchChessGameWithBot();
      } else {
        if (!isFriendly) {
          const tcKey = chessTimeControl.toLowerCase();
          const selfRating = (window.GamingHubState.state.currentUser.chessRatings && window.GamingHubState.state.currentUser.chessRatings[tcKey]) || 100;
          postMessage('CHESS_SEARCH', {
            tabId: getTabId(),
            rating: selfRating,
            timeControl: chessTimeControl
          });
        }
        window.GamingHubUI.renderMatchmakingLobby(chessMatchedPlayers, secondsLeft, true);
      }
    }, 1000);
  }

  function cancelChessMatchmaking() {
    if (chessMatchmakingTimeout) {
      clearInterval(chessMatchmakingTimeout);
      chessMatchmakingTimeout = null;
    }
    postMessage('CHESS_CANCEL', {
      tabId: getTabId()
    });
    activeChessRoom = null;
    window.GamingHubUI.showScreen('screen-dashboard');
  }

  function launchChessGameWithBot() {
    const selfName = window.GamingHubState.state.currentUser.username;
    const tcKey = chessTimeControl.toLowerCase();
    const selfRating = (window.GamingHubState.state.currentUser.chessRatings && window.GamingHubState.state.currentUser.chessRatings[tcKey]) || 100;

    // Generate matched bot
    const bot = window.GamingHubChess.generateBotProfile(selfRating);
    bot.tabId = 'bot_chess';

    const gamePlayers = [chessMatchedPlayers[0], bot];
    const roomId = 'chess_room_' + Date.now();
    
    // Randomize colors: White or Black
    const isWhite = Math.random() < 0.5;

    activeChessRoom = {
      roomId: roomId,
      players: gamePlayers,
      hostUsername: selfName,
      hostTabId: getTabId(),
      timeControl: chessTimeControl,
      myColor: isWhite ? 'white' : 'black'
    };

    window.GamingHubUI.showScreen('screen-chess');
    window.GamingHubChessUI.startGame(activeChessRoom);
  }

  function launchChessGameWithHuman() {
    // Determine host: player with lower lexicographical tabId is host
    const selfName = window.GamingHubState.state.currentUser.username;
    const sorted = [...chessMatchedPlayers].sort((a,b) => a.tabId.localeCompare(b.tabId));
    const isFriendlyHost = (activeChessRoom && activeChessRoom.isFriendly && activeChessRoom.hostTabId === getTabId());
    const isHost = isFriendlyHost || (sorted[0].tabId === getTabId());

    if (!isHost) return;

    if (chessMatchmakingTimeout) {
      clearInterval(chessMatchmakingTimeout);
      chessMatchmakingTimeout = null;
    }

    const roomId = activeChessRoom ? activeChessRoom.roomId : 'chess_room_' + Date.now();
    
    // Assign colors randomly
    const whitePlayer = Math.random() < 0.5 ? sorted[0] : sorted[1];

    activeChessRoom = {
      roomId: roomId,
      players: sorted,
      hostUsername: selfName,
      hostTabId: getTabId(),
      timeControl: chessTimeControl,
      myColor: whitePlayer.tabId === getTabId() ? 'white' : 'black'
    };

    postMessage('CHESS_START', {
      roomId: roomId,
      players: sorted,
      hostUsername: selfName,
      hostTabId: getTabId(),
      timeControl: chessTimeControl,
      whitePlayerTabId: whitePlayer.tabId
    });

    window.GamingHubUI.showScreen('screen-chess');
    window.GamingHubChessUI.startGame(activeChessRoom);
  }

  function respondToChessInvite(accepted) {
    const selfName = window.GamingHubState.state.currentUser.username;
    const tcKey = chessTimeControl.toLowerCase();
    const selfRating = (window.GamingHubState.state.currentUser.chessRatings && window.GamingHubState.state.currentUser.chessRatings[tcKey]) || 100;

    postMessage('CHESS_INVITE_RESPONSE', {
      recipient: activeChessRoom ? activeChessRoom.hostUsername : '',
      accepted: accepted,
      tabId: getTabId(),
      rating: selfRating
    });

    if (accepted && activeChessRoom) {
      // Add host to matched players
      chessMatchedPlayers = [{
        username: activeChessRoom.hostUsername,
        rating: 100, // updated via CHESS_START
        isBot: false,
        tabId: lastChessInviteTabId
      }, {
        username: selfName,
        rating: selfRating,
        isBot: false,
        tabId: getTabId()
      }];
    } else {
      activeChessRoom = null;
    }
  }

  // --- NITRO TYPE MATCHMAKING FUNCTIONS ---

  let lastNitroInviteTabId = null;

  function startNitroMatchmaking(isFriendlyHost = false, invitee = null) {
    nitroMatchedPlayers = [];
    const selfName = window.GamingHubState.state.currentUser.username;
    const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;

    nitroMatchedPlayers.push({
      username: selfName,
      level: selfLevel,
      isBot: false,
      tabId: getTabId()
    });

    matchmakingStartTime = Date.now();

    if (isFriendlyHost) {
      activeNitroRoom = {
        roomId: 'nitro_room_' + Date.now() + '_' + getNextUniqueParagraphIndex(),
        players: nitroMatchedPlayers,
        hostUsername: selfName,
        hostTabId: getTabId(),
        isFriendly: true
      };

      postMessage('NITRO_INVITE', {
        recipient: invitee,
        tabId: getTabId()
      });

      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(nitroMatchedPlayers, 15, 'nitro');
      startNitroMatchmakingTimer(true);
    } else {
      postMessage('NITRO_SEARCH', {
        tabId: getTabId(),
        level: selfLevel
      });

      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(nitroMatchedPlayers, 15, 'nitro');
      startNitroMatchmakingTimer(false);
    }
  }

  function startNitroMatchmakingTimer(isFriendly = false) {
    if (nitroMatchmakingTimeout) {
      clearInterval(nitroMatchmakingTimeout);
      nitroMatchmakingTimeout = null;
    }

    let secondsLeft = 15;
    nitroMatchmakingTimeout = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(nitroMatchmakingTimeout);
        nitroMatchmakingTimeout = null;
        launchNitroGameWithBot();
      } else {
        if (!isFriendly) {
          const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;
          postMessage('NITRO_SEARCH', {
            tabId: getTabId(),
            level: selfLevel
          });
        }
        window.GamingHubUI.renderMatchmakingLobby(nitroMatchedPlayers, secondsLeft, 'nitro');
      }
    }, 1000);
  }

  function cancelNitroMatchmaking() {
    if (nitroMatchmakingTimeout) {
      clearInterval(nitroMatchmakingTimeout);
      nitroMatchmakingTimeout = null;
    }
    postMessage('NITRO_CANCEL', {
      tabId: getTabId()
    });
    activeNitroRoom = null;
    window.GamingHubUI.showScreen('screen-dashboard');
  }

  function respondToNitroInvite(accepted) {
    if (activeNitroRoom && activeNitroRoom.isFriendly) {
      const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;
      postMessage('NITRO_INVITE_RESPONSE', {
        recipient: activeNitroRoom.hostUsername,
        accepted: accepted,
        level: selfLevel,
        tabId: getTabId()
      });
      if (accepted) {
        // Wait for NITRO_START from host
      } else {
        activeNitroRoom = null;
      }
    }
  }

  function launchNitroGameWithBot() {
    const selfName = window.GamingHubState.state.currentUser.username;
    const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;

    // We need 5 players total. Fill empty slots with bots.
    const gamePlayers = [...nitroMatchedPlayers];
    
    // bot names from a list
    const botNames = ['SpeedySam', 'TypeMaster5000', 'TurboTypewriter', 'KeyboardCat', 'BlazingFingers', 'DriftKing', 'ShiftGears', 'ShiftKeys', 'WpmWizard', 'AccurateAl'];
    
    while (gamePlayers.length < 5) {
      const bName = botNames[Math.floor(Math.random() * botNames.length)] + '_' + Math.floor(Math.random()*100);
      // ensure unique name
      if (gamePlayers.some(p => p.username === bName)) continue;

      // Bot level within 10 of player level
      const botLvl = Math.max(1, Math.min(100, selfLevel + Math.floor(Math.random() * 21) - 10));
      
      gamePlayers.push({
        username: bName,
        level: botLvl,
        isBot: true,
        tabId: 'bot_' + Math.random().toString(36).substr(2, 9)
      });
    }

    const roomId = 'nitro_room_' + Date.now() + '_' + getNextUniqueParagraphIndex();
    activeNitroRoom = {
      roomId: roomId,
      players: gamePlayers,
      hostUsername: selfName,
      hostTabId: getTabId()
    };

    window.GamingHubUI.showScreen('screen-nitro');
    window.GamingHubNitroUI.startGame(activeNitroRoom);
  }

  function launchNitroGameWithHuman() {
    const selfName = window.GamingHubState.state.currentUser.username;
    const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;
    // Determine host: player with lower lexicographical tabId is host
    const sorted = [...nitroMatchedPlayers].sort((a,b) => a.tabId.localeCompare(b.tabId));
    const isFriendlyHost = (activeNitroRoom && activeNitroRoom.isFriendly && activeNitroRoom.hostTabId === getTabId());
    const isHost = isFriendlyHost || (sorted[0].tabId === getTabId());

    if (!isHost) return;

    if (nitroMatchmakingTimeout) {
      clearInterval(nitroMatchmakingTimeout);
      nitroMatchmakingTimeout = null;
    }

    // Fill empty slots with bots up to 5 players
    const gamePlayers = [...sorted];
    const botNames = ['SpeedySam', 'TypeMaster5000', 'TurboTypewriter', 'KeyboardCat', 'BlazingFingers', 'DriftKing', 'ShiftGears', 'ShiftKeys', 'WpmWizard', 'AccurateAl'];
    
    while (gamePlayers.length < 5) {
      const bName = botNames[Math.floor(Math.random() * botNames.length)] + '_' + Math.floor(Math.random()*100);
      if (gamePlayers.some(p => p.username === bName)) continue;
      const botLvl = Math.max(1, Math.min(100, selfLevel + Math.floor(Math.random() * 21) - 10));
      gamePlayers.push({
        username: bName,
        level: botLvl,
        isBot: true,
        tabId: 'bot_' + Math.random().toString(36).substr(2, 9)
      });
    }

    const roomId = 'nitro_room_' + Date.now() + '_' + getNextUniqueParagraphIndex();
    
    activeNitroRoom = {
      roomId: roomId,
      players: gamePlayers,
      hostUsername: selfName,
      hostTabId: getTabId()
    };

    postMessage('NITRO_START', {
      roomId: roomId,
      players: gamePlayers,
      hostUsername: selfName,
      hostTabId: getTabId()
    });

    window.GamingHubUI.showScreen('screen-nitro');
    window.GamingHubNitroUI.startGame(activeNitroRoom);
  }

  function sendNitroProgress(progress, wpm) {
    if (activeNitroRoom) {
      postMessage('NITRO_PROGRESS', {
        roomId: activeNitroRoom.roomId,
        progress: progress,
        wpm: wpm
      });
    }
  }

  // --- HEXANAUT.IO MATCHMAKING FUNCTIONS ---
  let hexanautMatchedPlayers = [];
  let hexanautMatchmakingTimeout = null;
  let activeHexanautRoom = null;
  let hexanautMatchmakingStartTime = 0;

  let lastHexanautInviteTabId = null;
  let isSearchingHexanaut = false;

  function playHexanautInstant(nickname, server, skin) {
    hexanautMatchedPlayers = [];
    isSearchingHexanaut = true;
    
    if (window.GamingHubState.state.currentUser) {
      window.GamingHubState.state.currentUser.username = nickname;
      window.GamingHubState.saveUserProfile();
    }
    
    const selfName = nickname;
    const selfLevel = window.GamingHubState.state.currentUser ? (window.GamingHubState.state.currentUser.hexanautLevel || 1) : 1;

    hexanautMatchedPlayers.push({
      username: selfName,
      level: selfLevel,
      isBot: false,
      tabId: getTabId(),
      skin: skin || 'classic'
    });

    activeHexanautRoom = null;

    // Discovery ping
    postMessage('HEX_ROOM_DISCOVER', {
      tabId: getTabId(),
      username: selfName,
      level: selfLevel
    });

    // Fast 300ms wait for active rooms
    setTimeout(() => {
      if (!activeHexanautRoom) {
        const rId = 'hex_room_' + Date.now();
        activeHexanautRoom = {
          roomId: rId,
          players: [...hexanautMatchedPlayers],
          hostUsername: selfName,
          hostTabId: getTabId(),
          status: 'waiting'
        };
        launchHexanautGame();
      } else {
        postMessage('HEX_ROOM_JOIN', {
          roomId: activeHexanautRoom.roomId,
          hostTabId: activeHexanautRoom.hostTabId,
          tabId: getTabId(),
          username: selfName,
          level: selfLevel,
          skin: skin || 'classic'
        });
      }
      
      const startMenu = document.getElementById('hex-start-menu-overlay');
      if (startMenu) startMenu.classList.add('hidden');
    }, 300);
  }

  function startHexanautMatchmaking(isFriendlyHost = false, invitee = null) {
    hexanautMatchedPlayers = [];
    isSearchingHexanaut = true;
    const selfName = window.GamingHubState.state.currentUser.username;
    const selfLevel = window.GamingHubState.state.currentUser.hexanautLevel || 1;

    hexanautMatchedPlayers.push({
      username: selfName,
      level: selfLevel,
      isBot: false,
      tabId: getTabId()
    });

    hexanautMatchmakingStartTime = Date.now();
    activeHexanautRoom = null;

    if (isFriendlyHost) {
      activeHexanautRoom = {
        roomId: 'hex_room_' + Date.now(),
        players: [...hexanautMatchedPlayers],
        hostUsername: selfName,
        hostTabId: getTabId(),
        isFriendly: true,
        status: 'waiting'
      };

      postMessage('HEX_INVITE', {
        recipient: invitee,
        tabId: getTabId()
      });

      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(hexanautMatchedPlayers, 15, 'hexanaut');
      startHexanautMatchmakingTimer(15);
    } else {
      postMessage('HEX_ROOM_DISCOVER', {
        tabId: getTabId(),
        username: selfName,
        level: selfLevel
      });

      window.GamingHubUI.showScreen('screen-matchmaking');
      window.GamingHubUI.renderMatchmakingLobby(hexanautMatchedPlayers, 15, 'hexanaut');

      setTimeout(() => {
        if (!activeHexanautRoom) {
          const rId = 'hex_room_' + Date.now();
          activeHexanautRoom = {
            roomId: rId,
            players: [...hexanautMatchedPlayers],
            hostUsername: selfName,
            hostTabId: getTabId(),
            status: 'waiting'
          };
          startHexanautMatchmakingTimer(15);
        }
      }, 1500);
    }
  }

  function respondToHexanautInvite(accepted) {
    if (activeHexanautRoom && activeHexanautRoom.isFriendly) {
      const selfLevel = window.GamingHubState.state.currentUser.hexanautLevel || 1;
      postMessage('HEX_INVITE_RESPONSE', {
        recipient: activeHexanautRoom.hostUsername,
        accepted: accepted,
        level: selfLevel,
        tabId: getTabId()
      });
      if (!accepted) {
        activeHexanautRoom = null;
      }
    }
  }

  function startHexanautMatchmakingTimer(secondsLeft) {
    if (hexanautMatchmakingTimeout) {
      clearInterval(hexanautMatchmakingTimeout);
    }
    
    let timer = secondsLeft;
    hexanautMatchmakingTimeout = setInterval(() => {
      timer--;
      if (timer <= 0) {
        clearInterval(hexanautMatchmakingTimeout);
        hexanautMatchmakingTimeout = null;
        
        if (activeHexanautRoom && activeHexanautRoom.hostTabId === getTabId()) {
          launchHexanautGame();
        }
      } else {
        if (activeHexanautRoom && activeHexanautRoom.hostTabId === getTabId()) {
          postMessage('HEX_ROOM_INFO', {
            roomId: activeHexanautRoom.roomId,
            hostUsername: activeHexanautRoom.hostUsername,
            hostTabId: activeHexanautRoom.hostTabId,
            playersCount: activeHexanautRoom.players.length,
            status: activeHexanautRoom.status
          });
        }
        window.GamingHubUI.renderMatchmakingLobby(hexanautMatchedPlayers, timer, 'hexanaut');
      }
    }, 1000);
  }

  function cancelHexanautMatchmaking() {
    isSearchingHexanaut = false;
    if (hexanautMatchmakingTimeout) {
      clearInterval(hexanautMatchmakingTimeout);
      hexanautMatchmakingTimeout = null;
    }
    if (activeHexanautRoom) {
      postMessage('HEX_ROOM_LEAVE', {
        roomId: activeHexanautRoom.roomId,
        tabId: getTabId(),
        username: window.GamingHubState.state.currentUser.username
      });
    }
    activeHexanautRoom = null;
    window.GamingHubUI.showScreen('screen-dashboard');
  }

  function launchHexanautGame() {
    isSearchingHexanaut = false;
    const finalPlayers = [...activeHexanautRoom.players];
    const botNames = ['HexLord', 'GridRunner', 'TailCutter', 'BaseGuard', 'AreaMaster', 'BorderPatrol', 'GridSwiper', 'TailBlazer', 'HexHero', 'LoopMaker', 'Conqueror', 'ZoneGrabber', 'Nautic', 'ApexHex', 'Territorian', 'GridSlider', 'BaseBuilder', 'LoopStar', 'TrailBlaze', 'HexanautX'];
    const colors = ['#f43f5e', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#f97316', '#14b8a6', '#6366f1', '#d946ef', '#059669', '#b91c1c', '#1d4ed8', '#7c2d12', '#0f766e', '#6d28d9', '#a21caf', '#15803d', '#b45309', '#0369a1', '#be185d', '#4d7c0f', '#4338ca', '#be123c', '#0369a1', '#c2410c', '#312e81'];

    while (finalPlayers.length < 20) {
      const bName = botNames[Math.floor(Math.random() * botNames.length)] + '_' + Math.floor(Math.random()*100);
      if (finalPlayers.some(p => p.username === bName)) continue;
      finalPlayers.push({
        username: bName,
        level: Math.max(1, (window.GamingHubState.state.currentUser.hexanautLevel || 1) + Math.floor(Math.random()*6) - 3),
        isBot: true,
        tabId: 'bot_' + Math.random().toString(36).substr(2, 5)
      });
    }

    finalPlayers.forEach((p, index) => {
      p.color = colors[index % colors.length];
    });

    let playersWithSpawns = finalPlayers;
    if (window.GamingHubHexanaut && typeof window.GamingHubHexanaut.generateSpawnPoints === 'function') {
      playersWithSpawns = window.GamingHubHexanaut.generateSpawnPoints(finalPlayers);
    }

    activeHexanautRoom.players = playersWithSpawns;
    activeHexanautRoom.status = 'playing';

    postMessage('HEX_ROOM_START', {
      roomId: activeHexanautRoom.roomId,
      players: playersWithSpawns
    });

    window.GamingHubUI.showScreen('screen-hexanaut');
    window.GamingHubHexanaut.startGame(activeHexanautRoom, playersWithSpawns);
  }

  function sendHexanautRespawn(c, r) {
    if (activeHexanautRoom) {
      const currentUser = window.GamingHubState.state.currentUser;
      const username = currentUser ? currentUser.username : 'Guest';
      postMessage('HEX_PLAYER_RESPAWN', {
        roomId: activeHexanautRoom.roomId,
        username: username,
        c: c,
        r: r
      });
    }
  }

  function sendHexanautUpdate(x, y, vx, vy, angle, tail, username = null) {
    if (activeHexanautRoom) {
      const uName = username || (window.GamingHubState.state.currentUser ? window.GamingHubState.state.currentUser.username : 'Guest');
      const playerObj = window.GamingHubHexanaut ? window.GamingHubHexanaut.getPlayersMap().get(uName) : null;
      const skin = playerObj ? playerObj.skin : 'classic';
      postMessage('HEX_ROOM_UPDATE', {
        roomId: activeHexanautRoom.roomId,
        username: uName,
        skin,
        x, y, vx, vy, angle, tail
      });
    }
  }

  function sendHexanautCapture(tiles) {
    if (activeHexanautRoom) {
      postMessage('HEX_ROOM_CAPTURE', {
        roomId: activeHexanautRoom.roomId,
        tiles
      });
    }
  }

  function sendHexanautKill(killer, victim, reason) {
    if (activeHexanautRoom) {
      postMessage('HEX_ROOM_KILL', {
        roomId: activeHexanautRoom.roomId,
        killer, victim, reason
      });
    }
  }

  function leaveActiveHexanautRoom() {
    if (activeHexanautRoom) {
      try {
        postMessage('HEX_ROOM_LEAVE', {
          roomId: activeHexanautRoom.roomId,
          tabId: getTabId(),
          username: window.GamingHubState.state.currentUser.username
        });
      } catch (e) {}
      activeHexanautRoom = null;
    }
  }

  // Get a unique tab ID for this browser tab session
  let tabId = null;
  function getTabId() {
    if (!tabId) {
      tabId = 'tab_' + Math.random().toString(36).substr(2, 9);
    }
    return tabId;
  }

  // Handle incoming network actions
  function handleNetworkMessage(event) {
    const msg = event.data;
    const selfUser = window.GamingHubState.state.currentUser;
    if (!selfUser) return; // Ignore messages if not logged in yet

    // Ignore messages sent by ourselves
    if (msg.sender === selfUser.username && (msg.data.tabId === undefined || msg.data.tabId === getTabId())) {
      return;
    }

    switch (msg.type) {
      case 'CHESS_INVITE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          lastChessInviteTabId = msg.data.tabId;
          chessTimeControl = msg.data.timeControl;
          
          activeChessRoom = {
            roomId: 'chess_room_' + Date.now(),
            players: [],
            hostUsername: msg.sender,
            hostTabId: msg.data.tabId,
            timeControl: msg.data.timeControl,
            isFriendly: true
          };
          window.GamingHubUI.showChessInviteModal(msg.sender, msg.data.timeControl);
        }
        break;

      case 'CHESS_INVITE_RESPONSE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          if (msg.data.accepted) {
            window.GamingHubUI.showToast(`${msg.sender} accepted your chess invitation!`);
            const alreadyIn = chessMatchedPlayers.find(p => p.username === msg.sender);
            if (!alreadyIn) {
              const oppRating = msg.data.rating || 100;
              chessMatchedPlayers.push({
                username: msg.sender,
                rating: oppRating,
                isBot: false,
                tabId: msg.data.tabId
              });
              window.GamingHubUI.renderMatchmakingLobby(chessMatchedPlayers, 0, true);
            }
            launchChessGameWithHuman();
          } else {
            window.GamingHubUI.showToast(`${msg.sender} declined your chess invitation.`);
            activeChessRoom = null;
          }
        }
        break;

      case 'CHESS_SEARCH':
        if (chessMatchmakingTimeout && !(activeChessRoom && activeChessRoom.isFriendly)) {
          if (msg.data.timeControl === chessTimeControl) {
            const exists = chessMatchedPlayers.find(p => p.username === msg.sender && p.tabId === msg.data.tabId);
            if (!exists) {
              chessMatchedPlayers.push({
                username: msg.sender,
                rating: msg.data.rating || 100,
                isBot: false,
                tabId: msg.data.tabId
              });
              window.GamingHubUI.renderMatchmakingLobby(chessMatchedPlayers, 15, true);
              
              const tcKey = chessTimeControl.toLowerCase();
              const selfRating = (window.GamingHubState.state.currentUser.chessRatings && window.GamingHubState.state.currentUser.chessRatings[tcKey]) || 100;
              postMessage('CHESS_SEARCH_REPLY', {
                tabId: getTabId(),
                rating: selfRating,
                timeControl: chessTimeControl
              });

              const sorted = [...chessMatchedPlayers].sort((a,b) => a.tabId.localeCompare(b.tabId));
              if (sorted[0].tabId === getTabId()) {
                launchChessGameWithHuman();
              }
            }
          }
        }
        break;

      case 'CHESS_SEARCH_REPLY':
        if (chessMatchmakingTimeout && !(activeChessRoom && activeChessRoom.isFriendly)) {
          if (msg.data.timeControl === chessTimeControl) {
            const exists = chessMatchedPlayers.find(p => p.username === msg.sender && p.tabId === msg.data.tabId);
            if (!exists) {
              chessMatchedPlayers.push({
                username: msg.sender,
                rating: msg.data.rating || 100,
                isBot: false,
                tabId: msg.data.tabId
              });
              window.GamingHubUI.renderMatchmakingLobby(chessMatchedPlayers, 15, true);

              const sorted = [...chessMatchedPlayers].sort((a,b) => a.tabId.localeCompare(b.tabId));
              if (sorted[0].tabId === getTabId()) {
                launchChessGameWithHuman();
              }
            }
          }
        }
        break;

      case 'CHESS_CANCEL':
        if (chessMatchmakingTimeout) {
          chessMatchedPlayers = chessMatchedPlayers.filter(p => !(p.username === msg.sender && p.tabId === msg.data.tabId));
          window.GamingHubUI.renderMatchmakingLobby(chessMatchedPlayers, 15, true);
        }
        break;

      case 'CHESS_START':
        const weAreInChess = msg.data.players.find(p => p.username === selfUser.username && p.tabId === getTabId());
        if (weAreInChess) {
          if (chessMatchmakingTimeout) {
            clearInterval(chessMatchmakingTimeout);
            chessMatchmakingTimeout = null;
          }
          activeChessRoom = {
            roomId: msg.data.roomId,
            players: msg.data.players,
            hostUsername: msg.data.hostUsername,
            hostTabId: msg.data.hostTabId,
            timeControl: msg.data.timeControl,
            myColor: msg.data.whitePlayerTabId === getTabId() ? 'white' : 'black'
          };
          window.GamingHubUI.showScreen('screen-chess');
          window.GamingHubChessUI.startGame(activeChessRoom);
        }
        break;

      case 'CHESS_MOVE':
        if (activeChessRoom && activeChessRoom.roomId === msg.data.roomId) {
          window.GamingHubChessUI.receiveSyncedMove(msg.data.from, msg.data.to);
        }
        break;

      case 'CHESS_RESIGN':
        if (activeChessRoom && activeChessRoom.roomId === msg.data.roomId) {
          window.GamingHubChessUI.receiveSyncedResign(msg.sender);
        }
        break;

      case 'CHESS_DRAW_OFFER':
        if (activeChessRoom && activeChessRoom.roomId === msg.data.roomId) {
          window.GamingHubChessUI.receiveSyncedDrawOffer(msg.sender);
        }
        break;

      case 'CHESS_DRAW_RESPONSE':
        if (activeChessRoom && activeChessRoom.roomId === msg.data.roomId) {
          window.GamingHubChessUI.receiveSyncedDrawResponse(msg.sender, msg.data.accepted);
        }
        break;

      case 'NITRO_SEARCH':
        if (nitroMatchmakingTimeout) {
          const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;
          if (Math.abs(msg.data.level - selfLevel) <= 10) {
            const exists = nitroMatchedPlayers.find(p => p.username === msg.sender && p.tabId === msg.data.tabId);
            if (!exists) {
              nitroMatchedPlayers.push({
                username: msg.sender,
                level: msg.data.level,
                isBot: false,
                tabId: msg.data.tabId
              });
              window.GamingHubUI.renderMatchmakingLobby(nitroMatchedPlayers, 15, 'nitro');
              
              postMessage('NITRO_SEARCH_REPLY', {
                tabId: getTabId(),
                level: selfLevel
              });

              if (nitroMatchedPlayers.length >= 5) {
                launchNitroGameWithHuman();
              }
            }
          }
        }
        break;

      case 'NITRO_SEARCH_REPLY':
        if (nitroMatchmakingTimeout) {
          const selfLevel = window.GamingHubState.state.currentUser.nitroTypeLevel || 1;
          if (Math.abs(msg.data.level - selfLevel) <= 10) {
            const exists = nitroMatchedPlayers.find(p => p.username === msg.sender && p.tabId === msg.data.tabId);
            if (!exists) {
              nitroMatchedPlayers.push({
                username: msg.sender,
                level: msg.data.level,
                isBot: false,
                tabId: msg.data.tabId
              });
              window.GamingHubUI.renderMatchmakingLobby(nitroMatchedPlayers, 15, 'nitro');

              if (nitroMatchedPlayers.length >= 5) {
                launchNitroGameWithHuman();
              }
            }
          }
        }
        break;

      case 'NITRO_INVITE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          lastNitroInviteTabId = msg.data.tabId;
          
          activeNitroRoom = {
            roomId: 'nitro_room_' + Date.now(),
            players: [],
            hostUsername: msg.sender,
            hostTabId: msg.data.tabId,
            isFriendly: true
          };
          window.GamingHubUI.showNitroInviteModal(msg.sender);
        }
        break;

      case 'NITRO_INVITE_RESPONSE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          if (msg.data.accepted) {
            window.GamingHubUI.showToast(`${msg.sender} accepted your Nitro Type invitation!`);
            const alreadyIn = nitroMatchedPlayers.find(p => p.username === msg.sender);
            if (!alreadyIn) {
              nitroMatchedPlayers.push({
                username: msg.sender,
                level: msg.data.level || 1,
                isBot: false,
                tabId: msg.data.tabId
              });
              window.GamingHubUI.renderMatchmakingLobby(nitroMatchedPlayers, 15, 'nitro');
            }
            launchNitroGameWithHuman();
          } else {
            window.GamingHubUI.showToast(`${msg.sender} declined your Nitro Type invitation.`);
            activeNitroRoom = null;
          }
        }
        break;

      case 'NITRO_CANCEL':
        if (nitroMatchmakingTimeout) {
          nitroMatchedPlayers = nitroMatchedPlayers.filter(p => !(p.username === msg.sender && p.tabId === msg.data.tabId));
          window.GamingHubUI.renderMatchmakingLobby(nitroMatchedPlayers, 15, 'nitro');
        }
        break;

      case 'NITRO_START':
        const weAreInNitro = msg.data.players.find(p => p.username === selfUser.username && p.tabId === getTabId());
        if (weAreInNitro) {
          if (nitroMatchmakingTimeout) {
            clearInterval(nitroMatchmakingTimeout);
            nitroMatchmakingTimeout = null;
          }
          activeNitroRoom = {
            roomId: msg.data.roomId,
            players: msg.data.players,
            hostUsername: msg.data.hostUsername,
            hostTabId: msg.data.hostTabId
          };
          window.GamingHubUI.showScreen('screen-nitro');
          window.GamingHubNitroUI.startGame(activeNitroRoom);
        }
        break;

      case 'NITRO_PROGRESS':
        if (activeNitroRoom && activeNitroRoom.roomId === msg.data.roomId) {
          window.GamingHubNitroUI.receiveSyncedProgress(msg.sender, msg.data.progress, msg.data.wpm);
        }
        break;

      case 'HEX_INVITE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          lastHexanautInviteTabId = msg.data.tabId;
          activeHexanautRoom = {
            roomId: 'hex_room_invite',
            hostUsername: msg.sender,
            hostTabId: msg.data.tabId,
            isFriendly: true
          };
          window.GamingHubUI.showHexanautInviteModal(msg.sender);
        }
        break;

      case 'HEX_INVITE_RESPONSE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          if (msg.data.accepted) {
            window.GamingHubUI.showToast(`${msg.sender} accepted your Hexanaut.io invitation!`);
            if (activeHexanautRoom && activeHexanautRoom.isFriendly) {
              if (hexanautMatchmakingTimeout) {
                clearInterval(hexanautMatchmakingTimeout);
                hexanautMatchmakingTimeout = null;
              }
              const exists = activeHexanautRoom.players.some(p => p.username === msg.sender && p.tabId === msg.data.tabId);
              if (!exists) {
                activeHexanautRoom.players.push({
                  username: msg.sender,
                  level: msg.data.level || 1,
                  isBot: false,
                  tabId: msg.data.tabId
                });
              }
              launchHexanautGame();
            }
          } else {
            window.GamingHubUI.showToast(`${msg.sender} declined your Hexanaut.io invitation.`);
            activeHexanautRoom = null;
          }
        }
        break;

      case 'HEX_ROOM_DISCOVER':
        if (activeHexanautRoom && activeHexanautRoom.hostTabId === getTabId()) {
          postMessage('HEX_ROOM_INFO', {
            roomId: activeHexanautRoom.roomId,
            hostUsername: activeHexanautRoom.hostUsername,
            hostTabId: activeHexanautRoom.hostTabId,
            playersCount: activeHexanautRoom.players.length,
            status: activeHexanautRoom.status
          });
        }
        break;

      case 'HEX_ROOM_INFO':
        if (isSearchingHexanaut && !activeHexanautRoom) {
          if (msg.data.playersCount < 30) {
            activeHexanautRoom = {
              roomId: msg.data.roomId,
              status: 'joining'
            };
            postMessage('HEX_ROOM_JOIN', {
              roomId: msg.data.roomId,
              hostTabId: msg.data.hostTabId,
              tabId: getTabId(),
              username: selfUser.username,
              level: selfUser.hexanautLevel || 1
            });
          }
        }
        break;

      case 'HEX_ROOM_JOIN':
        if (activeHexanautRoom && activeHexanautRoom.hostTabId === getTabId() && activeHexanautRoom.roomId === msg.data.roomId) {
          if (activeHexanautRoom.players.length < 30) {
            const exists = activeHexanautRoom.players.some(p => p.username === msg.data.username && p.tabId === msg.data.tabId);
            if (!exists) {
              const newPlayerObj = {
                username: msg.data.username,
                level: msg.data.level || 1,
                isBot: false,
                tabId: msg.data.tabId
              };
              activeHexanautRoom.players.push(newPlayerObj);
              
              let spawnPt = null;
              if (activeHexanautRoom.status === 'playing') {
                if (window.GamingHubHexanaut) {
                  spawnPt = window.GamingHubHexanaut.spawnNewJoinedPlayer(newPlayerObj.username, newPlayerObj.level, newPlayerObj.tabId);
                  if (spawnPt) {
                    newPlayerObj.spawnPoint = spawnPt;
                  }
                }
              }

              postMessage('HEX_ROOM_JOIN_REPLY', {
                roomId: activeHexanautRoom.roomId,
                recipient: msg.data.username,
                recipientTabId: msg.data.tabId,
                accepted: true,
                players: activeHexanautRoom.players,
                status: activeHexanautRoom.status,
                hostTabId: activeHexanautRoom.hostTabId,
                gridOwnership: (activeHexanautRoom.status === 'playing' && window.GamingHubHexanaut) ? window.GamingHubHexanaut.getGridOwnership() : null,
                spawnPoint: spawnPt
              });

              if (activeHexanautRoom.status === 'playing') {
                postMessage('HEX_PLAYER_JOINED', {
                  roomId: activeHexanautRoom.roomId,
                  player: newPlayerObj,
                  spawnPoint: spawnPt
                });
              } else {
                hexanautMatchedPlayers = activeHexanautRoom.players;
                window.GamingHubUI.renderMatchmakingLobby(hexanautMatchedPlayers, 15, 'hexanaut');

                postMessage('HEX_ROOM_INFO', {
                  roomId: activeHexanautRoom.roomId,
                  hostUsername: activeHexanautRoom.hostUsername,
                  hostTabId: activeHexanautRoom.hostTabId,
                  playersCount: activeHexanautRoom.players.length,
                  status: activeHexanautRoom.status
                });

                if (activeHexanautRoom.players.length === 30) {
                  if (hexanautMatchmakingTimeout) {
                    clearInterval(hexanautMatchmakingTimeout);
                    hexanautMatchmakingTimeout = null;
                  }
                  launchHexanautGame();
                }
              }
            }
          } else {
            postMessage('HEX_ROOM_JOIN_REPLY', {
              roomId: msg.data.roomId,
              recipient: msg.data.username,
              recipientTabId: msg.data.tabId,
              accepted: false
            });
          }
        }
        break;

      case 'HEX_ROOM_JOIN_REPLY':
        if (msg.data.recipient === selfUser.username && msg.data.recipientTabId === getTabId()) {
          if (msg.data.accepted) {
            activeHexanautRoom = {
              roomId: msg.data.roomId,
              hostUsername: msg.sender,
              hostTabId: msg.data.hostTabId,
              status: msg.data.status || 'waiting'
            };
            isSearchingHexanaut = false;
            if (activeHexanautRoom.status === 'playing') {
              if (hexanautMatchmakingTimeout) {
                clearInterval(hexanautMatchmakingTimeout);
                hexanautMatchmakingTimeout = null;
              }
              window.GamingHubUI.showScreen('screen-hexanaut');
              window.GamingHubHexanaut.startGame(activeHexanautRoom, msg.data.players, msg.data.gridOwnership, msg.data.spawnPoint);
            } else {
              hexanautMatchedPlayers = msg.data.players;
              window.GamingHubUI.renderMatchmakingLobby(hexanautMatchedPlayers, 15, 'hexanaut');
            }
          } else {
            if (activeHexanautRoom && activeHexanautRoom.roomId === msg.data.roomId) {
              activeHexanautRoom = null;
            }
          }
        }
        break;

      case 'HEX_ROOM_LEAVE':
        if (activeHexanautRoom && activeHexanautRoom.hostTabId === getTabId() && activeHexanautRoom.roomId === msg.data.roomId) {
          activeHexanautRoom.players = activeHexanautRoom.players.filter(p => p.username !== msg.data.username || p.tabId !== msg.data.tabId);
          hexanautMatchedPlayers = activeHexanautRoom.players;
          window.GamingHubUI.renderMatchmakingLobby(hexanautMatchedPlayers, 15, 'hexanaut');
          
          postMessage('HEX_ROOM_INFO', {
            roomId: activeHexanautRoom.roomId,
            hostUsername: activeHexanautRoom.hostUsername,
            hostTabId: activeHexanautRoom.hostTabId,
            playersCount: activeHexanautRoom.players.length,
            status: activeHexanautRoom.status
          });
        }
        break;

      case 'HEX_ROOM_START':
        const weAreInHex = msg.data.players.some(p => p.username === selfUser.username && p.tabId === getTabId());
        if (weAreInHex) {
          if (hexanautMatchmakingTimeout) {
            clearInterval(hexanautMatchmakingTimeout);
            hexanautMatchmakingTimeout = null;
          }
          activeHexanautRoom = {
            roomId: msg.data.roomId,
            players: msg.data.players,
            hostUsername: msg.sender,
            status: 'playing'
          };
          window.GamingHubUI.showScreen('screen-hexanaut');
          window.GamingHubHexanaut.startGame(activeHexanautRoom, msg.data.players);
        }
        break;

      case 'HEX_PLAYER_JOINED':
        if (activeHexanautRoom && activeHexanautRoom.roomId === msg.data.roomId && activeHexanautRoom.status === 'playing') {
          const exists = activeHexanautRoom.players.some(p => p.username === msg.data.player.username);
          if (!exists) {
            activeHexanautRoom.players.push(msg.data.player);
          }
          if (window.GamingHubHexanaut) {
            window.GamingHubHexanaut.spawnNewJoinedPlayer(msg.data.player.username, msg.data.player.level, msg.data.player.tabId, msg.data.spawnPoint);
          }
        }
        break;

      case 'HEX_ROOM_UPDATE':
        if (activeHexanautRoom && activeHexanautRoom.status === 'playing') {
          if (window.GamingHubHexanaut) {
            const updateName = msg.data.username || msg.sender;
            const currentUser = window.GamingHubState.state.currentUser;
            if (currentUser && updateName === currentUser.username) {
              break;
            }
            window.GamingHubHexanaut.updateEnemyPlayer(updateName, msg.data);
          }
        }
        break;

      case 'HEX_ROOM_CAPTURE':
        if (activeHexanautRoom && activeHexanautRoom.status === 'playing') {
          if (window.GamingHubHexanaut) {
            window.GamingHubHexanaut.captureEnemyTerritory(msg.sender, msg.data.tiles);
          }
        }
        break;

      case 'HEX_ROOM_KILL':
        if (activeHexanautRoom && activeHexanautRoom.status === 'playing') {
          if (window.GamingHubHexanaut) {
            window.GamingHubHexanaut.handlePlayerKillEvent(msg.data.killer, msg.data.victim, msg.data.reason);
          }
        }
        break;

      case 'HEX_PLAYER_RESPAWN':
        if (activeHexanautRoom && activeHexanautRoom.status === 'playing') {
          if (window.GamingHubHexanaut && typeof window.GamingHubHexanaut.handleEnemyRespawn === 'function') {
            window.GamingHubHexanaut.handleEnemyRespawn(msg.data.username, msg.data.c, msg.data.r);
          }
        }
        break;

      case 'PRESENCE_PING':
        // Mark friend online, reply with pong
        if (window.GamingHubState.updateFriendStatus(msg.sender, true, msg.data.stats)) {
          window.GamingHubUI.renderFriendsList();
        }
        postMessage('PRESENCE_PONG', {
          stats: {
            cash: selfUser.totalCash,
            wins: selfUser.wins,
            hands: selfUser.handsPlayed
          }
        });
        break;

      case 'PRESENCE_PONG':
        if (window.GamingHubState.updateFriendStatus(msg.sender, true, msg.data.stats)) {
          window.GamingHubUI.renderFriendsList();
        }
        break;

      case 'PRESENCE_BYE':
        if (window.GamingHubState.updateFriendStatus(msg.sender, false)) {
          window.GamingHubUI.renderFriendsList();
        }
        break;

      case 'STATS_UPDATE':
        if (window.GamingHubState.updateFriendStatus(msg.sender, true, msg.data.stats)) {
          window.GamingHubUI.renderFriendsList();
        }
        break;

      case 'CHAT_MSG':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          window.GamingHubState.addChatMessage(msg.sender, msg.sender, msg.data.text);
          window.GamingHubUI.renderFriendsList();
          window.GamingHubUI.updateActiveChat();
          // Play card audio or visual alert
          window.GamingHubUI.showToast(`New chat from ${msg.sender}`);
        }
        break;

      case 'FRIEND_REQ':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          window.GamingHubUI.showFriendRequestModal(msg.sender);
        }
        break;

      case 'FRIEND_DECLINE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          window.GamingHubUI.showToast(`${msg.sender} declined your friend request.`, true);
        }
        break;

      case 'FRIEND_ACCEPT':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          window.GamingHubState.updateFriendStatus(msg.sender, true);
          window.GamingHubUI.showToast(`${msg.sender} accepted your friend request!`);
          window.GamingHubUI.renderFriendsList();
        }
        break;

      case 'GAME_INVITE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          lastInviteTabId = msg.data.tabId;
          // Show invitation modal dialog
          window.GamingHubUI.showInviteModal(msg.sender);
        }
        break;

      case 'GAME_INVITE_RESPONSE':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          if (msg.data.accepted) {
            window.GamingHubUI.showToast(`${msg.sender} accepted your invitation!`);
            // Add friend to matched players
            const alreadyIn = matchedPlayers.find(p => p.username === msg.sender);
            if (!alreadyIn) {
              matchedPlayers.push({
                username: msg.sender,
                cash: 1000,
                isBot: false,
                tabId: msg.data.tabId || ('remote_' + msg.sender)
              });
              window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, 0);
            }
          } else {
            window.GamingHubUI.showToast(`${msg.sender} declined your invitation.`);
          }
        }
        break;

      case 'MATCH_SEARCH':
        // If we are searching, respond!
        const isFriendly = activeGameRoom && activeGameRoom.isFriendly;
        if (matchmakingTimeout && !isFriendly) {
          // Add sender to matched players
          const exists = matchedPlayers.find(p => p.username === msg.sender && p.tabId === msg.data.tabId);
          if (!exists) {
            matchedPlayers.push({
              username: msg.sender,
              cash: 1000,
              isBot: false,
              tabId: msg.data.tabId
            });
            window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, 15);
            // Reply with match pong
            postMessage('MATCH_SEARCH_REPLY', {
              tabId: getTabId(),
              cash: 1000
            });
          }
        }
        break;

      case 'MATCH_SEARCH_REPLY':
        if (matchmakingTimeout && !(activeGameRoom && activeGameRoom.isFriendly)) {
          const exists = matchedPlayers.find(p => p.username === msg.sender && p.tabId === msg.data.tabId);
          if (!exists) {
            matchedPlayers.push({
              username: msg.sender,
              cash: 1000,
              isBot: false,
              tabId: msg.data.tabId
            });
            window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, 15);
          }
        }
        break;

      case 'MATCH_CANCEL':
        if (matchmakingTimeout) {
          matchedPlayers = matchedPlayers.filter(p => !(p.username === msg.sender && p.tabId === msg.data.tabId));
          window.GamingHubUI.renderMatchmakingLobby(matchedPlayers, 15);
        }
        break;

      case 'GAME_START':
        // Check if we are part of this room
        const weAreIn = msg.data.players.find(p => p.username === selfUser.username && p.tabId === getTabId());
        if (weAreIn) {
          if (matchmakingTimeout) {
            clearInterval(matchmakingTimeout);
            matchmakingTimeout = null;
          }
          activeGameRoom = {
            roomId: msg.data.roomId,
            players: msg.data.players,
            hostUsername: msg.data.hostUsername,
            hostTabId: msg.data.hostTabId
          };
          window.GamingHubUI.showScreen('screen-game');
          // Boot game engine locally, but marked as non-host (client mode)
          window.GamingHubPoker.startGame(msg.data.players, selfUser.username, false);
        }
        break;

      case 'GAME_STATE_UPDATE':
        if (activeGameRoom && activeGameRoom.roomId === msg.data.roomId) {
          // If we are not the host, apply the state directly
          const selfIsHost = (activeGameRoom.hostTabId ? (activeGameRoom.hostTabId === getTabId()) : (activeGameRoom.hostUsername === selfUser.username));
          if (!selfIsHost) {
            window.GamingHubPoker.receiveSyncedState(msg.data.state);
          }
        }
        break;

      case 'GAME_DEAL_PRIVATE_CARDS':
        if (msg.data.recipient.toLowerCase() === selfUser.username.toLowerCase()) {
          // Client receive pocket cards
          window.GamingHubPoker.receivePrivateCards(msg.data.cards);
        }
        break;

      case 'GAME_PLAYER_ACTION':
        if (activeGameRoom && activeGameRoom.roomId === msg.data.roomId) {
          const selfIsHost = (activeGameRoom.hostTabId ? (activeGameRoom.hostTabId === getTabId()) : (activeGameRoom.hostUsername === selfUser.username));
          if (selfIsHost) {
            // Host processes client action
            window.GamingHubPoker.processPlayerTurn(msg.sender, msg.data.actionType, msg.data.raiseAmount);
          }
        }
        break;

      case 'GAME_LEAVE':
        if (activeGameRoom && activeGameRoom.roomId === msg.data.roomId) {
          // Find player in our local activeGameRoom list and mark them as bot
          const roomPlayer = activeGameRoom.players.find(p => p.username === msg.sender && p.tabId === msg.data.senderTabId);
          if (roomPlayer) {
            roomPlayer.isBot = true;
          }

          // Let poker engine handle the player exit
          window.GamingHubPoker.handlePlayerExit(msg.sender);

          // If the player who left was the host, migrate the host role
          const isHostSender = activeGameRoom.hostTabId ? (activeGameRoom.hostTabId === msg.data.senderTabId) : (activeGameRoom.hostUsername === msg.sender);
          if (isHostSender) {
            const remainingRealPlayers = activeGameRoom.players.filter(p => !p.isBot && !(p.username === msg.sender && p.tabId === msg.data.senderTabId));
            
            // Sort remaining players by tabId to choose the next host deterministically
            remainingRealPlayers.sort((a, b) => a.tabId.localeCompare(b.tabId));

            if (remainingRealPlayers.length > 0) {
              const nextHost = remainingRealPlayers[0];
              activeGameRoom.hostUsername = nextHost.username;
              activeGameRoom.hostTabId = nextHost.tabId;
              
              if (nextHost.tabId === getTabId()) {
                // We are the new host!
                window.GamingHubPoker.setHost(true);
                window.GamingHubPoker.triggerHostTurn();
              }
            }
          }
        }
        break;
    }
  }

  // Export Sync Manager
  window.GamingHubSync = {
    init,
    sendPing,
    broadcastStats,
    sendChatMessage,
    sendFriendRequest,
    sendGameInvite,
    respondToInvite,
    respondToFriendRequest,
    startMatchmaking,
    cancelMatchmaking,
    getTabId,
    activeRoom: () => activeGameRoom,
    leaveActiveRoom: () => {
      if (activeGameRoom) {
        try {
          postMessage('GAME_LEAVE', { roomId: activeGameRoom.roomId, senderTabId: getTabId() });
        } catch (e) {
          console.error("Failed to send GAME_LEAVE message:", e);
        }
        activeGameRoom = null;
      }
      try {
        window.GamingHubPoker.stopGame();
      } catch (e) {
        console.error("Failed to stop local game engine:", e);
      }
    },
    broadcastGameState: (roomId, stateObj) => {
      postMessage('GAME_STATE_UPDATE', { roomId, state: stateObj });
    },
    broadcastPrivateDeal: (recipient, cards) => {
      postMessage('GAME_DEAL_PRIVATE_CARDS', { recipient, cards });
    },
    sendPlayerAction: (actionType, raiseAmount = 0) => {
      if (activeGameRoom) {
        postMessage('GAME_PLAYER_ACTION', {
          roomId: activeGameRoom.roomId,
          actionType,
          raiseAmount
        });
      }
    },
    
    // CHESS SYNC EXPORTS
    startChessMatchmaking,
    cancelChessMatchmaking,
    respondToChessInvite,
    activeChessRoom: () => activeChessRoom,
    leaveActiveChessRoom: () => {
      if (activeChessRoom) {
        try {
          postMessage('CHESS_RESIGN', { roomId: activeChessRoom.roomId });
        } catch (e) {}
        activeChessRoom = null;
      }
      try {
        window.GamingHubChessUI.stopGame();
      } catch (e) {}
    },
    sendChessMove: (from, to) => {
      if (activeChessRoom) {
        postMessage('CHESS_MOVE', {
          roomId: activeChessRoom.roomId,
          from,
          to
        });
      }
    },
    sendChessResign: () => {
      if (activeChessRoom) {
        postMessage('CHESS_RESIGN', {
          roomId: activeChessRoom.roomId
        });
      }
    },
    sendChessDrawOffer: () => {
      if (activeChessRoom) {
        postMessage('CHESS_DRAW_OFFER', {
          roomId: activeChessRoom.roomId
        });
      }
    },
    sendChessDrawResponse: (accepted) => {
      if (activeChessRoom) {
        postMessage('CHESS_DRAW_RESPONSE', {
          roomId: activeChessRoom.roomId,
          accepted
        });
      }
    },
    
    // NITRO TYPE SYNC EXPORTS
    startNitroMatchmaking,
    cancelNitroMatchmaking,
    respondToNitroInvite,
    sendNitroProgress,
    activeNitroRoom: () => activeNitroRoom,
    leaveActiveNitroRoom: () => {
      if (activeNitroRoom) {
        try {
          postMessage('NITRO_CANCEL', { tabId: getTabId() });
        } catch (e) {}
        activeNitroRoom = null;
      }
    },

    // HEXANAUT SYNC EXPORTS
    playHexanautInstant,
    startHexanautMatchmaking,
    cancelHexanautMatchmaking,
    respondToHexanautInvite,
    sendHexanautUpdate,
    sendHexanautCapture,
    sendHexanautKill,
    sendHexanautRespawn,
    activeHexanautRoom: () => activeHexanautRoom,
    setActiveHexanautRoom: (room) => { activeHexanautRoom = room; },
    leaveActiveHexanautRoom
  };
})();
