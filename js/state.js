/* -------------------------------------------------------------
   GAMING HUB - STATE MANAGEMENT & PERSISTENCE
------------------------------------------------------------- */

(function() {
  const LOCAL_STORAGE_KEY = 'gaming_hub_user_profile';
  const FRIENDS_STORAGE_KEY = 'gaming_hub_friends_list';
  const ACCOUNTS_STORAGE_KEY = 'gaming_hub_accounts_db';

  // Default state structure
  const state = {
    currentUser: null, // { username: '', totalCash: 1000, wins: 0, handsPlayed: 0 }
    friends: [],       // Array of { username: '', stats: { cash: 1000, wins: 0, hands: 0 }, online: false, chatHistory: [] }
    activeChatFriend: null, // username of current active chat window
    currentRoom: null, // Active game room state
    activeScreen: 'screen-login',
    soundEnabled: true
  };

  function cleanFriendsList() {
    if (state.friends && Array.isArray(state.friends)) {
      const initialLength = state.friends.length;
      state.friends = state.friends.filter(f => {
        if (!f || !f.username) return false;
        const name = f.username.toLowerCase().trim();
        return name !== 'lucky lucy' && name !== 'pokerbotbob';
      });
      if (state.friends.length !== initialLength) {
        saveFriends();
        if (state.currentUser) {
          const key = state.currentUser.username.toLowerCase();
          try {
            localStorage.setItem(`${FRIENDS_STORAGE_KEY}_${key}`, JSON.stringify(state.friends));
          } catch (e) {
            console.warn("Failed to save friends list for user:", e);
          }
        }
      }
    }
  }

  // Load state from sessionStorage and localStorage
  function loadState() {
    // Load User Profile from sessionStorage (tab-specific)
    try {
      const savedUser = sessionStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedUser) {
        state.currentUser = JSON.parse(savedUser);
        
        if (!state.currentUser.chessRatings) {
          state.currentUser.chessRatings = { bullet: 100, blitz: 100, rapid: 100 };
        }
        if (!state.currentUser.chessGamesCount) {
          state.currentUser.chessGamesCount = { bullet: 0, blitz: 0, rapid: 0 };
        }
        if (!state.currentUser.chessHistory) {
          state.currentUser.chessHistory = [];
        }
        if (state.currentUser.nitroTypeLevel === undefined) {
          state.currentUser.nitroTypeLevel = 1;
        }
        if (state.currentUser.nitroTypeStars === undefined) {
          state.currentUser.nitroTypeStars = 0;
        }
        if (state.currentUser.nitroTypeCoins === undefined) {
          state.currentUser.nitroTypeCoins = 0;
        }
        if (!state.currentUser.nitroTypeCars) {
          state.currentUser.nitroTypeCars = ['rust_bucket'];
        }
        if (!state.currentUser.nitroTypeEquippedCar) {
          state.currentUser.nitroTypeEquippedCar = 'rust_bucket';
        }
        if (state.currentUser.hexanautLevel === undefined) {
          state.currentUser.hexanautLevel = 1;
        }
        if (state.currentUser.hexanautCoins === undefined) {
          state.currentUser.hexanautCoins = 0;
        }
        if (state.currentUser.hexanautMaxPercent === undefined) {
          state.currentUser.hexanautMaxPercent = 0;
        }
        if (state.currentUser.hexanautGamesCount === undefined) {
          state.currentUser.hexanautGamesCount = 0;
        }
        if (state.currentUser.hexanautWins === undefined) {
          state.currentUser.hexanautWins = 0;
        }
        
        // Force reset player 1 / player1 cash to 1k
        const key = state.currentUser.username.toLowerCase();
        if (key === 'player 1' || key === 'player1') {
          state.currentUser.totalCash = 1000;
          state.currentUser.wins = 0;
          state.currentUser.matchHistory = [];
          sessionStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.currentUser));
          
          const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
          if (savedAccounts) {
            const accounts = JSON.parse(savedAccounts);
            if (accounts[key]) {
              accounts[key].stats.cash = 1000;
              accounts[key].stats.wins = 0;
              accounts[key].stats.matchHistory = [];
              localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
            }
          }
        }
        console.log("loadState: currentUser loaded from sessionStorage:", state.currentUser);
      }
    } catch (e) {
      console.warn("Failed to parse user profile from sessionStorage, resetting...", e);
      sessionStorage.removeItem(LOCAL_STORAGE_KEY);
      state.currentUser = null;
    }

    // Load Friends
    if (state.currentUser) {
      // Load user-specific friends from localStorage with global fallback
      try {
        const key = state.currentUser.username.toLowerCase();
        const userFriendsKey = `${FRIENDS_STORAGE_KEY}_${key}`;
        let savedFriends = localStorage.getItem(userFriendsKey);
        
        // Fallback to global key if user-specific is empty
        if (!savedFriends) {
          savedFriends = localStorage.getItem(FRIENDS_STORAGE_KEY);
        }
        
        console.log(`loadState: Loading user-specific friends from localStorage, value:`, savedFriends);
        if (savedFriends) {
          state.friends = JSON.parse(savedFriends);
          cleanFriendsList();
        } else {
          state.friends = [];
        }
      } catch (e) {
        console.error("Failed to load user friends:", e);
        state.friends = [];
      }
    } else {
      // Not logged in: load from sessionStorage with global localStorage fallback
      try {
        let savedFriends = sessionStorage.getItem(FRIENDS_STORAGE_KEY);
        if (!savedFriends) {
          savedFriends = localStorage.getItem(FRIENDS_STORAGE_KEY);
        }
        console.log("loadState: Loading guest friends, value:", savedFriends);
        if (savedFriends) {
          state.friends = JSON.parse(savedFriends);
          cleanFriendsList();
        } else {
          state.friends = [];
        }
      } catch (e) {
        state.friends = [];
      }
    }
  }

  function seedDefaultFriends() {
    // No bot friends by default; friends list starts empty as requested
    state.friends = [];
    saveFriends();
  }

  // Save User Profile to sessionStorage
  function saveUserProfile() {
    if (state.currentUser) {
      try {
        sessionStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.currentUser));
      } catch (e) {
        console.warn("sessionStorage write blocked:", e);
      }
      
      // Update account DB automatically
      try {
        const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
        if (savedAccounts) {
          const accounts = JSON.parse(savedAccounts);
          const key = state.currentUser.username.toLowerCase();
          if (accounts[key]) {
            accounts[key].stats = {
              cash: state.currentUser.totalCash,
              wins: state.currentUser.wins,
              hands: state.currentUser.handsPlayed,
              matchHistory: state.currentUser.matchHistory || [],
              chessRatings: state.currentUser.chessRatings || { bullet: 100, blitz: 100, rapid: 100 },
              chessGamesCount: state.currentUser.chessGamesCount || { bullet: 0, blitz: 0, rapid: 0 },
              chessHistory: state.currentUser.chessHistory || [],
              nitroTypeLevel: state.currentUser.nitroTypeLevel || 1,
              nitroTypeStars: state.currentUser.nitroTypeStars || 0,
              nitroTypeCoins: state.currentUser.nitroTypeCoins || 0,
              nitroTypeCars: state.currentUser.nitroTypeCars || ['rust_bucket'],
              nitroTypeEquippedCar: state.currentUser.nitroTypeEquippedCar || 'rust_bucket',
              hexanautLevel: state.currentUser.hexanautLevel || 1,
              hexanautCoins: state.currentUser.hexanautCoins || 0,
              hexanautMaxPercent: state.currentUser.hexanautMaxPercent || 0,
              hexanautGamesCount: state.currentUser.hexanautGamesCount || 0,
              hexanautWins: state.currentUser.hexanautWins || 0
            };
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
          }
        }
      } catch (e) {
        console.warn("Failed to update stats in accounts database:", e);
      }
    }
  }

  // Save Friends to appropriate storage (Both user-specific and global fallback keys)
  function saveFriends() {
    try {
      // Save globally as fallback
      localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(state.friends));
      
      if (state.currentUser) {
        const key = state.currentUser.username.toLowerCase();
        const userFriendsKey = `${FRIENDS_STORAGE_KEY}_${key}`;
        console.log(`saveFriends: Saving friends list for ${state.currentUser.username} to localStorage key [${userFriendsKey}] and fallback [${FRIENDS_STORAGE_KEY}]:`, state.friends);
        localStorage.setItem(userFriendsKey, JSON.stringify(state.friends));
      } else {
        console.log("saveFriends: Saving guest friends list to sessionStorage:", state.friends);
        sessionStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(state.friends));
      }
    } catch (e) {
      console.warn("Storage write blocked:", e);
    }
  }

  // Login or Register a user account with a password
  function registerOrLoginUser(username, password, mode = 'login') {
    username = username.trim();
    password = password.trim();
    if (!username || !password) {
      return { success: false, message: 'Username and password cannot be empty.' };
    }

    let accounts = {};
    try {
      const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (savedAccounts) {
        accounts = JSON.parse(savedAccounts);
      }
    } catch (e) {
      console.warn("Failed to load accounts database:", e);
    }

    const key = username.toLowerCase();
    
    if (mode === 'login') {
      // Check if account exists
      if (!accounts[key]) {
        return { success: false, message: 'Account does not exist. Please sign up!' };
      }
      // Login check
      if (accounts[key].password === password) {
        // Force reset player 1 / player1 cash to 1k
        if (key === 'player 1' || key === 'player1') {
          accounts[key].stats.cash = 1000;
          accounts[key].stats.wins = 0;
          accounts[key].stats.matchHistory = [];
          localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        }

        // Successful login: load stored stats
        state.currentUser = {
          username: accounts[key].username,
          totalCash: accounts[key].stats.cash,
          wins: accounts[key].stats.wins,
          handsPlayed: accounts[key].stats.hands,
          matchHistory: accounts[key].stats.matchHistory || [],
          chessRatings: accounts[key].stats.chessRatings || { bullet: 100, blitz: 100, rapid: 100 },
          chessGamesCount: accounts[key].stats.chessGamesCount || { bullet: 0, blitz: 0, rapid: 0 },
          chessHistory: accounts[key].stats.chessHistory || [],
          nitroTypeLevel: accounts[key].stats.nitroTypeLevel !== undefined ? accounts[key].stats.nitroTypeLevel : 1,
          nitroTypeStars: accounts[key].stats.nitroTypeStars !== undefined ? accounts[key].stats.nitroTypeStars : 0,
          nitroTypeCoins: accounts[key].stats.nitroTypeCoins !== undefined ? accounts[key].stats.nitroTypeCoins : 0,
          nitroTypeCars: accounts[key].stats.nitroTypeCars || ['rust_bucket'],
          nitroTypeEquippedCar: accounts[key].stats.nitroTypeEquippedCar || 'rust_bucket',
          hexanautLevel: accounts[key].stats.hexanautLevel !== undefined ? accounts[key].stats.hexanautLevel : 1,
          hexanautCoins: accounts[key].stats.hexanautCoins !== undefined ? accounts[key].stats.hexanautCoins : 0,
          hexanautMaxPercent: accounts[key].stats.hexanautMaxPercent !== undefined ? accounts[key].stats.hexanautMaxPercent : 0,
          hexanautGamesCount: accounts[key].stats.hexanautGamesCount !== undefined ? accounts[key].stats.hexanautGamesCount : 0,
          hexanautWins: accounts[key].stats.hexanautWins !== undefined ? accounts[key].stats.hexanautWins : 0
        };
        saveUserProfile();
        
        // Load their specific friends list if saved
        try {
          const userFriendsKey = `${FRIENDS_STORAGE_KEY}_${key}`;
          let savedFriends = localStorage.getItem(userFriendsKey);
          if (!savedFriends) {
            savedFriends = localStorage.getItem(FRIENDS_STORAGE_KEY);
          }
          if (savedFriends) {
            state.friends = JSON.parse(savedFriends);
            cleanFriendsList();
          } else {
            state.friends = [];
          }
        } catch (err) {
          state.friends = [];
        }
        
        return { success: true, isNew: false };
      } else {
        return { success: false, message: 'Incorrect password for this username!' };
      }
    } else {
      // Signup mode: check if account exists
      if (accounts[key]) {
        return { success: false, message: 'Username is already taken!' };
      }
      
      // Register new account
      const newAccount = {
        username: username,
        password: password,
        stats: { 
          cash: 1000, 
          wins: 0, 
          hands: 0, 
          matchHistory: [],
          chessRatings: { bullet: 100, blitz: 100, rapid: 100 },
          chessGamesCount: { bullet: 0, blitz: 0, rapid: 0 },
          chessHistory: [],
          nitroTypeLevel: 1,
          nitroTypeStars: 0,
          nitroTypeCoins: 0,
          nitroTypeCars: ['rust_bucket'],
          nitroTypeEquippedCar: 'rust_bucket',
          hexanautLevel: 1,
          hexanautCoins: 0,
          hexanautMaxPercent: 0,
          hexanautGamesCount: 0,
          hexanautWins: 0
        }
      };
      accounts[key] = newAccount;
      
      try {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
      } catch (e) {
        console.warn("Failed to write to accounts database:", e);
      }

      state.currentUser = {
        username: username,
        totalCash: 1000,
        wins: 0,
        handsPlayed: 0,
        matchHistory: [],
        chessRatings: { bullet: 100, blitz: 100, rapid: 100 },
        chessGamesCount: { bullet: 0, blitz: 0, rapid: 0 },
        chessHistory: [],
        nitroTypeLevel: 1,
        nitroTypeStars: 0,
        nitroTypeCoins: 0,
        nitroTypeCars: ['rust_bucket'],
        nitroTypeEquippedCar: 'rust_bucket',
        hexanautLevel: 1,
        hexanautCoins: 0,
        hexanautMaxPercent: 0,
        hexanautGamesCount: 0,
        hexanautWins: 0
      };
      saveUserProfile();
      state.friends = [];
      saveFriends();
      
      return { success: true, isNew: true };
    }
  }

  // Log Out current user
  function logoutUser() {
    // Save friends list specific to this user before clearing
    if (state.currentUser) {
      const key = state.currentUser.username.toLowerCase();
      try {
        localStorage.setItem(`${FRIENDS_STORAGE_KEY}_${key}`, JSON.stringify(state.friends));
      } catch (e) {
        console.warn("Failed to save friends list for user:", e);
      }
    }
    
    state.currentUser = null;
    state.friends = [];
    state.activeChatFriend = null;
    state.currentRoom = null;
    
    try {
      sessionStorage.removeItem(LOCAL_STORAGE_KEY);
      sessionStorage.removeItem(FRIENDS_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(FRIENDS_STORAGE_KEY);
    } catch (e) {
      console.warn("Failed to clear current session storage:", e);
    }
  }

  // Add a friend (Real only)
  function addFriend(username) {
    username = username.trim();
    if (!username) return { success: false, message: 'Username cannot be empty.' };
    if (state.currentUser && username.toLowerCase() === state.currentUser.username.toLowerCase()) {
      return { success: false, message: 'You cannot add yourself.' };
    }

    // Check if already friends
    const exists = state.friends.find(f => f.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      return { success: false, message: `${username} is already in your friends list.` };
    }

    const newFriend = {
      username: username,
      stats: { cash: 1000, wins: 0, hands: 0 },
      online: false,
      chatHistory: [],
      isVirtual: false
    };
    state.friends.push(newFriend);
    saveFriends();
    return { success: true, friend: newFriend, message: `Friend request sent to ${username}!` };
  }

  // Remove a friend
  function removeFriend(username) {
    username = username.trim();
    if (!username) return { success: false, message: 'Username cannot be empty.' };

    const initialLength = state.friends.length;
    state.friends = state.friends.filter(f => f.username.toLowerCase() !== username.toLowerCase());
    
    if (state.friends.length < initialLength) {
      saveFriends();
      if (state.currentUser) {
        const key = state.currentUser.username.toLowerCase();
        try {
          localStorage.setItem(`${FRIENDS_STORAGE_KEY}_${key}`, JSON.stringify(state.friends));
        } catch (e) {
          console.warn("Failed to save friends list for user:", e);
        }
      }
      return { success: true };
    }
    return { success: false, message: 'Friend not found in list.' };
  }

  // Add chat message to history
  function addChatMessage(friendUsername, sender, text) {
    const friend = state.friends.find(f => f.username.toLowerCase() === friendUsername.toLowerCase());
    if (friend) {
      const message = {
        sender: sender,
        text: text,
        timestamp: Date.now()
      };
      friend.chatHistory.push(message);
      saveFriends();
      return message;
    }
    return null;
  }

  // Update a friend's online status
  function updateFriendStatus(username, online, stats = null) {
    const friend = state.friends.find(f => f.username.toLowerCase() === username.toLowerCase());
    if (friend) {
      friend.online = online;
      if (stats) {
        friend.stats = { ...friend.stats, ...stats };
      }
      saveFriends();
      return true;
    }
    return false;
  }

  // Record game statistics for the current user
  function recordGameStats(won, chipsDiff) {
    if (state.currentUser) {
      state.currentUser.handsPlayed += 1;
      if (won) {
        state.currentUser.wins += 1;
      }
      state.currentUser.totalCash = Math.max(0, state.currentUser.totalCash + chipsDiff);
      saveUserProfile();
      
      // Update account DB
      try {
        const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
        if (savedAccounts) {
          const accounts = JSON.parse(savedAccounts);
          const key = state.currentUser.username.toLowerCase();
          if (accounts[key]) {
            accounts[key].stats = {
              cash: state.currentUser.totalCash,
              wins: state.currentUser.wins,
              hands: state.currentUser.handsPlayed,
              matchHistory: state.currentUser.matchHistory || [],
              chessRatings: state.currentUser.chessRatings || { bullet: 100, blitz: 100, rapid: 100 },
              chessHistory: state.currentUser.chessHistory || []
            };
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
          }
        }
      } catch (e) {
        console.warn("Failed to update stats in accounts database:", e);
      }
      
      // Also broadcast updated stats to any online friends in other tabs
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
    }
  }

  // Record match outcomes (Poker match end or bust)
  function recordMatchOutcome(won, cashDiff) {
    if (state.currentUser) {
      if (won) {
        state.currentUser.wins += 1;
      }
      state.currentUser.totalCash = Math.max(0, state.currentUser.totalCash + cashDiff);
      
      // Update match history
      if (!state.currentUser.matchHistory) {
        state.currentUser.matchHistory = [];
      }
      state.currentUser.matchHistory.unshift({
        result: won ? 'WIN' : 'LOSS',
        amount: Math.abs(cashDiff),
        time: Date.now()
      });
      // Keep only last 10 matches
      if (state.currentUser.matchHistory.length > 10) {
        state.currentUser.matchHistory.pop();
      }

      saveUserProfile();
      
      // Update account DB
      try {
        const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
        if (savedAccounts) {
          const accounts = JSON.parse(savedAccounts);
          const key = state.currentUser.username.toLowerCase();
          if (accounts[key]) {
            accounts[key].stats = {
              cash: state.currentUser.totalCash,
              wins: state.currentUser.wins,
              hands: state.currentUser.handsPlayed,
              matchHistory: state.currentUser.matchHistory,
              chessRatings: state.currentUser.chessRatings || { bullet: 100, blitz: 100, rapid: 100 },
              chessHistory: state.currentUser.chessHistory || []
            };
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
          }
        }
      } catch (e) {
        console.warn("Failed to update stats in accounts database:", e);
      }
      
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
    }
  }

  // Replenish player cash to 1000 if they run out of chips
  function replenishCash() {
    if (state.currentUser && state.currentUser.totalCash <= 0) {
      state.currentUser.totalCash = 1000;
      saveUserProfile();
      
      // Update accounts DB
      try {
        const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
        if (savedAccounts) {
          const accounts = JSON.parse(savedAccounts);
          const key = state.currentUser.username.toLowerCase();
          if (accounts[key]) {
            accounts[key].stats.cash = 1000;
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
          }
        }
      } catch (e) {
        console.warn("Failed to update accounts database on replenishment:", e);
      }
      
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
      
      return true;
    }
    return false;
  }

  // Record Chess match outcome
  function recordChessMatch(timeControl, won, opponentName, eloChange, moves) {
    if (state.currentUser) {
      if (!state.currentUser.chessRatings) {
        state.currentUser.chessRatings = { bullet: 100, blitz: 100, rapid: 100 };
      }
      if (!state.currentUser.chessGamesCount) {
        state.currentUser.chessGamesCount = { bullet: 0, blitz: 0, rapid: 0 };
      }
      if (!state.currentUser.chessHistory) {
        state.currentUser.chessHistory = [];
      }
      
      const tcKey = timeControl.toLowerCase(); // 'bullet', 'blitz', 'rapid'
      state.currentUser.chessGamesCount[tcKey] = (state.currentUser.chessGamesCount[tcKey] || 0) + 1;
      
      const oldRating = state.currentUser.chessRatings[tcKey] || 100;
      const newRating = Math.max(100, oldRating + eloChange);
      state.currentUser.chessRatings[tcKey] = newRating;
      
      state.currentUser.chessHistory.unshift({
        timeControl: timeControl, // 'Bullet', 'Blitz', 'Rapid'
        result: won ? 'WIN' : 'LOSS',
        opponent: opponentName,
        ratingChange: eloChange,
        newRating: newRating,
        time: Date.now(),
        moves: moves // Array of moves like: [{from: 'e2', to: 'e4'}, ...]
      });
      
      if (state.currentUser.chessHistory.length > 20) {
        state.currentUser.chessHistory.pop();
      }
      
      saveUserProfile();
      
      // Update account DB
      try {
        const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
        if (savedAccounts) {
          const accounts = JSON.parse(savedAccounts);
          const key = state.currentUser.username.toLowerCase();
          if (accounts[key]) {
            accounts[key].stats = {
              cash: state.currentUser.totalCash,
              wins: state.currentUser.wins,
              hands: state.currentUser.handsPlayed,
              matchHistory: state.currentUser.matchHistory,
              chessRatings: state.currentUser.chessRatings,
              chessGamesCount: state.currentUser.chessGamesCount,
              chessHistory: state.currentUser.chessHistory
            };
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
          }
        }
      } catch (e) {
        console.warn("Failed to update chess stats in accounts database:", e);
      }
      
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
    }
  }

  // No bot simulator active as user wants real friends only
  function startVirtualStatusSimulator() {}

  function seedCompetitorAccounts() {
    try {
      const savedAccounts = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      let accounts = {};
      if (savedAccounts) {
        accounts = JSON.parse(savedAccounts);
      }
      
      const competitors = {
        'magnusmini': {
          username: 'MagnusMini',
          password: 'mockpassword123',
          stats: {
            cash: 120000,
            wins: 25,
            hands: 210,
            matchHistory: [],
            chessRatings: { bullet: 1100, blitz: 1200, rapid: 1250 },
            chessGamesCount: { bullet: 10, blitz: 10, rapid: 10 },
            chessHistory: []
          }
        },
        'hikarufan': {
          username: 'HikaruFan',
          password: 'mockpassword123',
          stats: {
            cash: 18000,
            wins: 12,
            hands: 140,
            matchHistory: [],
            chessRatings: { bullet: 900, blitz: 850, rapid: 750 },
            chessGamesCount: { bullet: 10, blitz: 10, rapid: 10 },
            chessHistory: []
          }
        },
        'pokerqueen': {
          username: 'PokerQueen',
          password: 'mockpassword123',
          stats: {
            cash: 95000,
            wins: 42,
            hands: 450,
            matchHistory: [],
            chessRatings: { bullet: 300, blitz: 450, rapid: 500 },
            chessGamesCount: { bullet: 10, blitz: 10, rapid: 10 },
            chessHistory: []
          }
        },
        'blunderking': {
          username: 'BlunderKing',
          password: 'mockpassword123',
          stats: {
            cash: 5000,
            wins: 8,
            hands: 90,
            matchHistory: [],
            chessRatings: { bullet: 350, blitz: 250, rapid: 200 },
            chessGamesCount: { bullet: 10, blitz: 10, rapid: 10 },
            chessHistory: []
          }
        },
        'rookandroll': {
          username: 'RookAndRoll',
          password: 'mockpassword123',
          stats: {
            cash: 24000,
            wins: 18,
            hands: 190,
            matchHistory: [],
            chessRatings: { bullet: 500, blitz: 600, rapid: 650 },
            chessGamesCount: { bullet: 10, blitz: 10, rapid: 10 },
            chessHistory: []
          }
        }
      };
      
      // Instead of seeding competitors, clean them up from DB so only real players remain!
      const competitorKeys = ['magnusmini', 'hikarufan', 'pokerqueen', 'blunderking', 'rookandroll'];
      let deletedAny = false;
      competitorKeys.forEach(k => {
        if (accounts[k]) {
          delete accounts[k];
          deletedAny = true;
        }
      });
      if (deletedAny) {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        console.log("seedCompetitorAccounts: Cleaned competitor accounts from database.");
      }
    } catch (e) {
      console.warn("Failed to clean competitor accounts:", e);
    }
  }

  function recordNitroTypeResult(place, levelAfter, starsAfter, coinsGained) {
    if (state.currentUser) {
      state.currentUser.nitroTypeLevel = levelAfter;
      state.currentUser.nitroTypeStars = starsAfter;
      state.currentUser.nitroTypeCoins = (state.currentUser.nitroTypeCoins || 0) + coinsGained;
      saveUserProfile();
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
    }
  }

  function recordHexanautResult(percent, coinsGained, won) {
    if (state.currentUser) {
      state.currentUser.hexanautGamesCount = (state.currentUser.hexanautGamesCount || 0) + 1;
      state.currentUser.hexanautMaxPercent = Math.max(state.currentUser.hexanautMaxPercent || 0, percent);
      state.currentUser.hexanautCoins = (state.currentUser.hexanautCoins || 0) + coinsGained;
      state.currentUser.nitroTypeCoins = (state.currentUser.nitroTypeCoins || 0) + coinsGained;
      if (won) {
        state.currentUser.hexanautLevel = (state.currentUser.hexanautLevel || 1) + 1;
        state.currentUser.hexanautWins = (state.currentUser.hexanautWins || 0) + 1;
      }
      saveUserProfile();
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
    }
  }

  function purchaseCar(carId, cost) {
    if (state.currentUser) {
      state.currentUser.nitroTypeCoins = Math.max(0, (state.currentUser.nitroTypeCoins || 0) - cost);
      if (!state.currentUser.nitroTypeCars) {
        state.currentUser.nitroTypeCars = ['rust_bucket'];
      }
      if (!state.currentUser.nitroTypeCars.includes(carId)) {
        state.currentUser.nitroTypeCars.push(carId);
      }
      saveUserProfile();
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
    }
  }

  function equipCar(carId) {
    if (state.currentUser) {
      if (!state.currentUser.nitroTypeCars) {
        state.currentUser.nitroTypeCars = ['rust_bucket'];
      }
      if (state.currentUser.nitroTypeCars.includes(carId)) {
        state.currentUser.nitroTypeEquippedCar = carId;
        saveUserProfile();
        if (window.GamingHubSync) {
          window.GamingHubSync.broadcastStats();
        }
      }
    }
  }

  function recordMiniGameResult(gameId, score, winStatus = null) {
    if (state.currentUser) {
      if (gameId === 'flappy') {
        state.currentUser.flappyHighScore = Math.max(state.currentUser.flappyHighScore || 0, score);
        state.currentUser.flappyGames = (state.currentUser.flappyGames || 0) + 1;
      } else if (gameId === 'snake') {
        state.currentUser.snakeHighScore = Math.max(state.currentUser.snakeHighScore || 0, score);
        state.currentUser.snakeGames = (state.currentUser.snakeGames || 0) + 1;
      } else if (gameId === '2048') {
        state.currentUser.highest2048Tile = Math.max(state.currentUser.highest2048Tile || 0, score);
        state.currentUser.games2048 = (state.currentUser.games2048 || 0) + 1;
      } else if (gameId === 'tictactoe') {
        state.currentUser.tictactoeGames = (state.currentUser.tictactoeGames || 0) + 1;
        if (winStatus === 'win') {
          state.currentUser.tictactoeWins = (state.currentUser.tictactoeWins || 0) + 1;
        } else if (winStatus === 'loss') {
          state.currentUser.tictactoeLosses = (state.currentUser.tictactoeLosses || 0) + 1;
        } else if (winStatus === 'draw') {
          state.currentUser.tictactoeDraws = (state.currentUser.tictactoeDraws || 0) + 1;
        }
      } else if (gameId === 'minesweeper') {
        state.currentUser.minesweeperGames = (state.currentUser.minesweeperGames || 0) + 1;
        if (winStatus === 'win') {
          state.currentUser.minesweeperFastestTime = Math.min(state.currentUser.minesweeperFastestTime || 999, score);
          state.currentUser.minesweeperWins = (state.currentUser.minesweeperWins || 0) + 1;
        }
      }
      
      let coins = 0;
      if (gameId === 'flappy' || gameId === 'snake') {
        coins = Math.floor(score / 5);
      } else if (gameId === '2048') {
        coins = Math.floor(score / 128);
      } else if (gameId === 'tictactoe' && winStatus === 'win') {
        coins = 15;
      } else if (gameId === 'minesweeper' && winStatus === 'win') {
        coins = 30;
      }
      
      if (coins > 0) {
        state.currentUser.hexanautCoins = (state.currentUser.hexanautCoins || 0) + coins;
        state.currentUser.nitroTypeCoins = (state.currentUser.nitroTypeCoins || 0) + coins;
      }

      saveUserProfile();
      if (window.GamingHubSync) {
        window.GamingHubSync.broadcastStats();
      }
      return coins;
    }
    return 0;
  }

  // Invoke cleaning logic
  seedCompetitorAccounts();

  // Export State Manager
  window.GamingHubState = {
    state,
    load: loadState,
    saveUserProfile,
    saveFriends,
    registerOrLoginUser,
    logoutUser,
    addFriend,
    removeFriend,
    addChatMessage,
    updateFriendStatus,
    recordGameStats,
    recordMatchOutcome,
    recordChessMatch,
    replenishCash,
    startVirtualStatusSimulator,
    recordNitroTypeResult,
    purchaseCar,
    equipCar,
    recordHexanautResult,
    recordMiniGameResult
  };
})();
