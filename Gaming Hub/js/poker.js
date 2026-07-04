/* -------------------------------------------------------------
   GAMING HUB - TEXAS HOLD'EM POKER ENGINE
------------------------------------------------------------- */

(function() {
  // Game state
  let players = [];       // Array of player objects: { username, cash, isBot, seat, bet, folded, busted, cards: [], lastAction: '' }
  let deck = [];          // Cards deck: array of { suit, value }
  let communityCards = [];// Max 5 cards
  let currentPot = 0;
  let activeSeatIndex = 0;
  let dealerSeatIndex = 0;
  let currentBet = 0;     // The bet amount to match in the current round
  let minRaise = 10;
  let previousBet = 0;    // Bet prior to the last raise (used to calculate min raise)
  let roundName = 'WAITING'; // 'PRE_FLOP', 'FLOP', 'TURN', 'RIVER', 'SHOWDOWN', 'ENDED'
  let hostMode = false;   // Is this tab hosting the game engine?
  let localPlayerName = '';
  let betsPlacedThisRound = {}; // Map of seat -> amount bet in the current sub-round
  let playersWhoActed = new Set(); // Seats of players who have made a decision since the last bet increase
  let turnSecondsLeft = 0;
  let turnTimerInterval = null;
  let matchSettled = false;

  function settleMatch(won) {
    if (matchSettled) return;
    matchSettled = true;
    if (window.GamingHubState && window.GamingHubState.recordMatchOutcome) {
      window.GamingHubState.recordMatchOutcome(won, won ? 7000 : -1000);
    }
  }

  function clearTurnTimer() {
    if (turnTimerInterval) {
      clearInterval(turnTimerInterval);
      turnTimerInterval = null;
    }
    turnSecondsLeft = 0;
  }

  const SUITS = ['♠', '♥', '♦', '♣'];
  const VALUES = [
    { name: '2', value: 2 }, { name: '3', value: 3 }, { name: '4', value: 4 }, { name: '5', value: 5 },
    { name: '6', value: 6 }, { name: '7', value: 7 }, { name: '8', value: 8 }, { name: '9', value: 9 },
    { name: '10', value: 10 }, { name: 'J', value: 11 }, { name: 'Q', value: 12 }, { name: 'K', value: 13 },
    { name: 'A', value: 14 }
  ];

  // Starting game
  function startGame(gamePlayers, localUser, isHost) {
    localPlayerName = localUser;
    hostMode = isHost;
    clearTurnTimer();
    matchSettled = false;
    
    // Convert input list of players into game structure
    players = gamePlayers.map((p, index) => ({
      username: p.username,
      cash: 1000, // Starting stack is always exactly $1,000 for everyone
      isBot: p.isBot,
      seat: index,
      bet: 0,
      folded: false,
      busted: false,
      cards: [],
      lastAction: ''
    }));

    communityCards = [];
    currentPot = 0;
    currentBet = 0;
    previousBet = 0;
    dealerSeatIndex = 0; // Rotate starting seat
    
    if (hostMode) {
      startNewHand();
    }
  }

  // Prepares a new hand
  function startNewHand() {
    clearTurnTimer();
    // Reset players for new hand
    let activeCount = 0;
    players.forEach(p => {
      p.bet = 0;
      p.folded = false;
      p.cards = [];
      p.lastAction = '';
      if (p.cash <= 0) {
        p.busted = true;
      } else {
        activeCount++;
      }
    });

    // Check if game is ended
    if (activeCount <= 1) {
      roundName = 'ENDED';
      const winner = players.find(p => !p.busted);
      const msg = winner ? `${winner.username} wins the tournament!` : 'Game Over!';
      updateGameMessage(msg);
      broadcastState();
      
      // Settle the match outcome
      if (winner && winner.username === localPlayerName) {
        settleMatch(true);
      } else {
        settleMatch(false);
      }
      return;
    }

    communityCards = [];
    currentPot = 0;
    currentBet = 0;
    previousBet = 0;
    betsPlacedThisRound = {};
    playersWhoActed.clear();

    // Rotate dealer button to next non-busted player
    do {
      dealerSeatIndex = (dealerSeatIndex + 1) % 8;
    } while (players[dealerSeatIndex].busted);

    // Create and shuffle deck
    createDeck();
    shuffleDeck();

    // Blinds setup
    // Small Blind is next active player after dealer
    let sbSeat = getNextActiveSeat(dealerSeatIndex);
    // Big Blind is next active player after Small Blind
    let bbSeat = getNextActiveSeat(sbSeat);

    // Small blind puts in $5, Big blind puts in $10
    placeBlindBet(sbSeat, 5, 'SB');
    placeBlindBet(bbSeat, 10, 'BB');

    currentBet = 10;
    previousBet = 10;
    minRaise = 20;

    // Deal 2 cards to each player
    players.forEach(p => {
      if (!p.busted) {
        p.cards = [drawCard(), drawCard()];
      }
    });

    // Send private cards to real players
    players.forEach(p => {
      if (!p.isBot && !p.busted) {
        if (p.username === localPlayerName) {
          // Keep locally
        } else {
          // Send to other tabs
          window.GamingHubSync.broadcastPrivateDeal(p.username, p.cards);
        }
      }
    });

    // Action starts after Big Blind
    activeSeatIndex = getNextActiveSeat(bbSeat);
    roundName = 'PRE_FLOP';
    updateGameMessage("Pre-flop betting round...");
    
    // Play card deal sound
    window.GamingHubAudio.play('deal');

    broadcastState();
    
    // Trigger turn check if it is a bot's turn
    triggerActiveTurn();
  }

  function createDeck() {
    deck = [];
    SUITS.forEach(suit => {
      VALUES.forEach(val => {
        deck.push({ suit, name: val.name, value: val.value });
      });
    });
  }

  function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  function drawCard() {
    return deck.pop();
  }

  function placeBlindBet(seatIndex, amount, label) {
    const p = players[seatIndex];
    const betAmount = Math.min(p.cash, amount);
    p.cash -= betAmount;
    p.bet = betAmount;
    p.lastAction = label;
    currentPot += betAmount;
    betsPlacedThisRound[seatIndex] = betAmount;
  }

  // Get next active non-folded, non-busted player seat index
  function getNextActiveSeat(fromSeat) {
    let seat = fromSeat;
    for (let i = 0; i < 8; i++) {
      seat = (seat + 1) % 8;
      if (!players[seat].busted && !players[seat].folded) {
        return seat;
      }
    }
    return fromSeat;
  }

  // Check if current betting round is complete
  function isBettingRoundComplete() {
    // A betting round is complete if:
    // 1. All active (non-folded, non-busted) players have acted.
    // 2. All active players have bet the same amount (except all-ins).
    const activePlayers = players.filter(p => !p.busted && !p.folded);
    
    // If only 1 player remains active, the round is complete
    if (activePlayers.length <= 1) return true;

    // Check if everyone has bet the matching current bet (or is all-in)
    const allMatching = activePlayers.every(p => {
      const isAllIn = (p.cash === 0);
      return p.bet === currentBet || isAllIn;
    });

    // Check if everyone has acted since the last raise / since round started
    const everyoneActed = activePlayers.every(p => playersWhoActed.has(p.seat));

    return allMatching && everyoneActed;
  }

  // Progress to next game round (Flop, Turn, River, Showdown)
  function progressRound() {
    // Reset player bets for next sub-round
    players.forEach(p => {
      p.bet = 0;
      p.lastAction = '';
    });
    currentBet = 0;
    previousBet = 0;
    minRaise = 10;
    betsPlacedThisRound = {};
    playersWhoActed.clear();

    // Check if only one player remains (others folded)
    const activePlayers = players.filter(p => !p.busted && !p.folded);
    if (activePlayers.length === 1) {
      declareSingleWinner(activePlayers[0]);
      return;
    }

    // Progress based on round
    if (roundName === 'PRE_FLOP') {
      roundName = 'FLOP';
      communityCards.push(drawCard(), drawCard(), drawCard());
      activeSeatIndex = getNextActiveSeat(dealerSeatIndex);
      updateGameMessage("Flop dealt. Community cards updated.");
      window.GamingHubAudio.play('deal');
    } else if (roundName === 'FLOP') {
      roundName = 'TURN';
      communityCards.push(drawCard());
      activeSeatIndex = getNextActiveSeat(dealerSeatIndex);
      updateGameMessage("Turn dealt.");
      window.GamingHubAudio.play('deal');
    } else if (roundName === 'TURN') {
      roundName = 'RIVER';
      communityCards.push(drawCard());
      activeSeatIndex = getNextActiveSeat(dealerSeatIndex);
      updateGameMessage("River dealt. Final betting round!");
      window.GamingHubAudio.play('deal');
    } else if (roundName === 'RIVER') {
      roundName = 'SHOWDOWN';
      runShowdown();
      return;
    }

    broadcastState();
    triggerActiveTurn();
  }

  // Trigger turn for bots if active player is a bot
  function triggerActiveTurn() {
    clearTurnTimer();

    if (!hostMode || roundName === 'SHOWDOWN' || roundName === 'ENDED') return;

    const activePlayer = players[activeSeatIndex];
    if (!activePlayer || activePlayer.folded || activePlayer.busted) return;

    if (activePlayer.isBot) {
      turnSecondsLeft = 0;
      broadcastState();

      // Let Bot make choice after a delay
      window.GamingHubBot.makeDecision(activePlayer, {
        communityCards,
        currentBet,
        playerBet: activePlayer.bet,
        pot: currentPot,
        playersCount: players.filter(p => !p.busted && !p.folded).length,
        minRaise,
        bbAmount: 10
      }, (action, raiseVal) => {
        processPlayerTurn(activePlayer.username, action, raiseVal);
      });
    } else {
      // Start 20-second countdown for human player
      turnSecondsLeft = 20;
      broadcastState();

      turnTimerInterval = setInterval(() => {
        turnSecondsLeft--;
        if (turnSecondsLeft <= 0) {
          clearTurnTimer();
          // Auto fold the player
          updateGameMessage(`${activePlayer.username} timed out and folded.`);
          processPlayerTurn(activePlayer.username, 'fold');
        } else {
          broadcastState();
        }
      }, 1000);
    }
  }

  // Process a action (Check, Fold, Match, Raise)
  function processPlayerTurn(username, actionType, raiseAmount = 0) {
    if (!hostMode) {
      // Client mode: send action to host via channel
      window.GamingHubSync.sendPlayerAction(actionType, raiseAmount);
      return;
    }

    clearTurnTimer();

    const p = players.find(x => x.username === username);
    if (!p || p.seat !== activeSeatIndex) return;

    let actionLabel = '';
    
    if (actionType === 'fold') {
      p.folded = true;
      p.lastAction = 'Fold';
      actionLabel = 'Fold';
      window.GamingHubAudio.play('fold');
    } 
    else if (actionType === 'check') {
      // Check is only valid if there is no bet to match
      if (p.bet === currentBet) {
        p.lastAction = 'Check';
        actionLabel = 'Check';
        playersWhoActed.add(p.seat);
        window.GamingHubAudio.play('check');
      } else {
        // Force fold if tried to check when facing a bet
        p.folded = true;
        p.lastAction = 'Fold';
        actionLabel = 'Fold';
        window.GamingHubAudio.play('fold');
      }
    } 
    else if (actionType === 'match') {
      // Matching/Calling
      const callAmount = currentBet - p.bet;
      const actualBet = Math.min(p.cash, callAmount);
      p.cash -= actualBet;
      p.bet += actualBet;
      currentPot += actualBet;
      p.lastAction = p.cash === 0 ? 'All-in' : 'Call';
      actionLabel = p.lastAction;
      playersWhoActed.add(p.seat);
      window.GamingHubAudio.play('chip');
    } 
    else if (actionType === 'raise') {
      // Raising to a absolute total amount
      const raiseDiff = raiseAmount - p.bet;
      const actualRaise = Math.min(p.cash, raiseDiff);
      
      p.cash -= actualRaise;
      p.bet += actualRaise;
      currentPot += actualRaise;
      
      // Update bet benchmarks
      previousBet = currentBet;
      currentBet = p.bet;
      minRaise = currentBet + (currentBet - previousBet);
      if (minRaise < currentBet + 10) minRaise = currentBet + 10;

      p.lastAction = p.cash === 0 ? 'All-in' : 'Raise';
      actionLabel = p.lastAction;

      // Reset acting list for other players, since bet increased
      playersWhoActed.clear();
      playersWhoActed.add(p.seat);
      window.GamingHubAudio.play('chip');
    }

    // Set message
    updateGameMessage(`${p.username}: ${actionLabel}`);

    // If game ended because everyone else folded
    const activePlayers = players.filter(p => !p.busted && !p.folded);
    if (activePlayers.length === 1) {
      declareSingleWinner(activePlayers[0]);
      return;
    }

    // If betting round is complete
    if (isBettingRoundComplete()) {
      // Delay round progression for visual smooth transitions
      setTimeout(() => {
        progressRound();
      }, 1200);
    } else {
      // Move to next active player
      activeSeatIndex = getNextActiveSeat(activeSeatIndex);
      broadcastState();
      
      // Trigger turn if bot
      setTimeout(() => {
        triggerActiveTurn();
      }, 800);
    }
  }

  // Handle single winner from folders
  function declareSingleWinner(winner) {
    updateGameMessage(`${winner.username} wins pot of $${currentPot}!`);
    winner.cash += currentPot;
    window.GamingHubAudio.play('win');



    roundName = 'SHOWDOWN';
    broadcastState();
    
    // Auto start next round after 4 seconds
    setTimeout(() => {
      if (roundName === 'SHOWDOWN') {
        startNewHand();
      }
    }, 4000);
  }

  // Run showdown card evaluations
  function runShowdown() {
    clearTurnTimer();
    updateGameMessage("Showdown! Comparing hands...");
    
    const activePlayers = players.filter(p => !p.busted && !p.folded);
    
    // Evaluate hands
    const evaluated = activePlayers.map(p => {
      const allSeven = [...communityCards, ...p.cards];
      const bestHand = evaluateSevenCards(allSeven);
      return {
        player: p,
        handInfo: bestHand // { rank, tieBreakers, text, cards }
      };
    });

    // Sort by hand quality descending
    evaluated.sort((a, b) => {
      // First compare rank
      if (a.handInfo.rank !== b.handInfo.rank) {
        return b.handInfo.rank - a.handInfo.rank;
      }
      // If ranks equal, compare tie-breakers
      for (let i = 0; i < a.handInfo.tieBreakers.length; i++) {
        if (a.handInfo.tieBreakers[i] !== b.handInfo.tieBreakers[i]) {
          return b.handInfo.tieBreakers[i] - a.handInfo.tieBreakers[i];
        }
      }
      return 0;
    });

    // Check if there are ties
    const winners = [evaluated[0]];
    for (let i = 1; i < evaluated.length; i++) {
      if (compareHandInfos(evaluated[0].handInfo, evaluated[i].handInfo) === 0) {
        winners.push(evaluated[i]);
      } else {
        break;
      }
    }

    // Split pot
    const share = Math.floor(currentPot / winners.length);
    winners.forEach(w => {
      w.player.cash += share;
    });

    // Play audio
    window.GamingHubAudio.play('win');

    // Build showdown report
    let winnerNamesStr = winners.map(w => w.player.username).join(', ');
    let bestHandText = winners[0].handInfo.text;
    updateGameMessage(`${winnerNamesStr} wins with ${bestHandText}!`);



    // Trigger modal showdown popup on UI
    if (window.GamingHubUI) {
      window.GamingHubUI.showShowdownModal(winners, communityCards);
    }

    // Reset bets
    players.forEach(p => {
      p.bet = 0;
    });
    
    broadcastState();
  }

  function compareHandInfos(h1, h2) {
    if (h1.rank !== h2.rank) return h1.rank - h2.rank; // Ascending comparison
    for (let i = 0; i < h1.tieBreakers.length; i++) {
      if (h1.tieBreakers[i] !== h2.tieBreakers[i]) {
        return h1.tieBreakers[i] - h2.tieBreakers[i];
      }
    }
    return 0;
  }

  // Syncing state receiver for client tabs
  function receiveSyncedState(stateObj) {
    communityCards = stateObj.communityCards;
    currentPot = stateObj.pot;
    currentBet = stateObj.currentBet;
    activeSeatIndex = stateObj.activeSeatIndex;
    dealerSeatIndex = stateObj.dealerSeatIndex;
    roundName = stateObj.roundName;
    minRaise = stateObj.minRaise;
    turnSecondsLeft = stateObj.turnSecondsLeft || 0;

    // Apply player details
    stateObj.players.forEach(sp => {
      const localPlayer = players.find(p => p.username === sp.username);
      if (localPlayer) {
        localPlayer.cash = sp.cash;
        localPlayer.bet = sp.bet;
        localPlayer.folded = sp.folded;
        localPlayer.busted = sp.busted;
        localPlayer.isBot = sp.isBot;
        localPlayer.lastAction = sp.lastAction;
        
        // Only accept cards if they are broadcasted or we already know them
        if (sp.username !== localPlayerName && sp.cards && sp.cards.length > 0) {
          localPlayer.cards = sp.cards;
        }
      }
    });

    updateGameMessage(stateObj.message);

    if (window.GamingHubUI) {
      window.GamingHubUI.renderGameScreen();
    }
  }

  // Syncing pocket cards deal for client tab
  function receivePrivateCards(cards) {
    const localP = players.find(p => p.username === localPlayerName);
    if (localP) {
      localP.cards = cards;
    }
    if (window.GamingHubUI) {
      window.GamingHubUI.renderGameScreen();
    }
  }

  // Handle client exiting
  function handlePlayerExit(username) {
    const p = players.find(x => x.username === username);
    if (p) {
      p.isBot = true;
      updateGameMessage(`${username} left the game. Bot took over.`);
      
      if (hostMode) {
        broadcastState();
        triggerActiveTurn();
      }
    }
  }

  // Broadcast state over sync channel
  function broadcastState() {
    if (!hostMode) return;
    
    // Prepare public list of players (hide pocket cards of other real players unless showdown)
    const publicPlayers = players.map(p => {
      const isShowdown = (roundName === 'SHOWDOWN');
      const showPocketCards = isShowdown || p.username === localPlayerName || (p.isBot && isShowdown);
      
      return {
        username: p.username,
        cash: p.cash,
        isBot: p.isBot,
        bet: p.bet,
        folded: p.folded,
        busted: p.busted,
        lastAction: p.lastAction,
        cards: showPocketCards ? p.cards : []
      };
    });

    const activeRoom = window.GamingHubSync.activeRoom();
    if (activeRoom) {
      window.GamingHubSync.broadcastGameState(activeRoom.roomId, {
        pot: currentPot,
        communityCards,
        players: publicPlayers,
        activeSeatIndex,
        dealerSeatIndex,
        currentBet,
        minRaise,
        roundName,
        turnSecondsLeft,
        message: document.getElementById('game-message').innerText
      });
    }

    if (window.GamingHubUI) {
      window.GamingHubUI.renderGameScreen();
    }
  }

  function updateGameMessage(text) {
    const msgEl = document.getElementById('game-message');
    if (msgEl) {
      msgEl.innerText = text;
    }
  }

  // -------------------------------------------------------------
  // POKER HAND EVALUATOR (Texas Hold'em 5-of-7 logic)
  // -------------------------------------------------------------

  function evaluateSevenCards(cards7) {
    // Generate all combinations of 5 from 7
    const combos = [];
    generateCombinations(cards7, 5, 0, [], combos);
    
    // Evaluate all combinations
    const evaluated = combos.map(evaluateFiveCards);
    
    // Sort and return the best combo
    evaluated.sort((a, b) => {
      if (a.rank !== b.rank) return b.rank - a.rank;
      for (let i = 0; i < a.tieBreakers.length; i++) {
        if (a.tieBreakers[i] !== b.tieBreakers[i]) {
          return b.tieBreakers[i] - a.tieBreakers[i];
        }
      }
      return 0;
    });

    return evaluated[0];
  }

  function generateCombinations(arr, size, start, current, result) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      generateCombinations(arr, size, i + 1, current, result);
      current.pop();
    }
  }

  // Evaluates a 5-card hand and returns hand rank + tiebreakers
  function evaluateFiveCards(hand) {
    // Sort hand by card value descending
    hand.sort((a,b) => b.value - a.value);

    const isFlush = hand.every(c => c.suit === hand[0].suit);
    
    // Check for straight
    let isStraight = false;
    let straightHighVal = 0;
    
    // Standard straight
    const valuesConsecutive = (
      hand[0].value - hand[1].value === 1 &&
      hand[1].value - hand[2].value === 1 &&
      hand[2].value - hand[3].value === 1 &&
      hand[3].value - hand[4].value === 1
    );

    if (valuesConsecutive) {
      isStraight = true;
      straightHighVal = hand[0].value;
    } else {
      // Ace-low straight (5, 4, 3, 2, Ace)
      // Sorted A is at index 0 (14), then 5, 4, 3, 2
      if (hand[0].value === 14 && hand[1].value === 5 && hand[2].value === 4 && hand[3].value === 3 && hand[4].value === 2) {
        isStraight = true;
        straightHighVal = 5;
      }
    }

    // Rank frequencies
    const counts = {};
    hand.forEach(c => { counts[c.value] = (counts[c.value] || 0) + 1; });
    
    const freqs = Object.entries(counts).map(([val, count]) => ({
      val: parseInt(val),
      count
    }));

    // Sort by count descending, then val descending
    freqs.sort((a,b) => {
      if (a.count !== b.count) return b.count - a.count;
      return b.val - a.val;
    });

    const f0 = freqs[0];
    const f1 = freqs[1];

    // Ranks:
    // Royal/Straight Flush: 8
    // Four of a Kind: 7
    // Full House: 6
    // Flush: 5
    // Straight: 4
    // Three of a kind: 3
    // Two Pair: 2
    // One Pair: 1
    // High Card: 0

    if (isFlush && isStraight) {
      if (straightHighVal === 14) {
        return { rank: 9, tieBreakers: [14], text: 'Royal Flush', cards: hand };
      }
      return { rank: 8, tieBreakers: [straightHighVal], text: 'Straight Flush', cards: hand };
    }

    if (f0.count === 4) {
      return { rank: 7, tieBreakers: [f0.val, f1.val], text: `Four of a Kind (${getValueName(f0.val)}s)`, cards: hand };
    }

    if (f0.count === 3 && f1.count === 2) {
      return { rank: 6, tieBreakers: [f0.val, f1.val], text: `Full House (${getValueName(f0.val)}s full of ${getValueName(f1.val)}s)`, cards: hand };
    }

    if (isFlush) {
      const tieBreakers = hand.map(c => c.value);
      return { rank: 5, tieBreakers: tieBreakers, text: `Flush (${getValueName(hand[0].value)} High)`, cards: hand };
    }

    if (isStraight) {
      return { rank: 4, tieBreakers: [straightHighVal], text: `Straight (${getValueName(straightHighVal)} High)`, cards: hand };
    }

    if (f0.count === 3) {
      return { rank: 3, tieBreakers: [f0.val, freqs[1].val, freqs[2].val], text: `Three of a Kind (${getValueName(f0.val)}s)`, cards: hand };
    }

    if (f0.count === 2 && f1.count === 2) {
      return { rank: 2, tieBreakers: [f0.val, f1.val, freqs[2].val], text: `Two Pair (${getValueName(f0.val)}s and ${getValueName(f1.val)}s)`, cards: hand };
    }

    if (f0.count === 2) {
      return { rank: 1, tieBreakers: [f0.val, freqs[1].val, freqs[2].val, freqs[3].val], text: `One Pair of ${getValueName(f0.val)}s`, cards: hand };
    }

    const tieBreakers = hand.map(c => c.value);
    return { rank: 0, tieBreakers: tieBreakers, text: `High Card ${getValueName(hand[0].value)}`, cards: hand };
  }

  function getValueName(value) {
    const item = VALUES.find(v => v.value === value);
    return item ? item.name : value;
  }

  function stopGame() {
    clearTurnTimer();
    players = [];
    communityCards = [];
    currentPot = 0;
    activeSeatIndex = 0;
    dealerSeatIndex = 0;
    currentBet = 0;
    roundName = 'WAITING';
    hostMode = false;
  }

  // Export Poker Module
  window.GamingHubPoker = {
    startGame,
    startNewHand,
    processPlayerTurn,
    receiveSyncedState,
    receivePrivateCards,
    handlePlayerExit,
    evaluateSevenCards,
    setHost: (isHost) => { hostMode = isHost; },
    stopGame,
    settleMatch,
    triggerHostTurn: () => {
      if (hostMode) {
        broadcastState();
        triggerActiveTurn();
      }
    },
    getTurnSecondsLeft: () => turnSecondsLeft,
    // Read-only accessors
    getPlayers: () => players,
    getCommunityCards: () => communityCards,
    getPot: () => currentPot,
    getActiveSeatIndex: () => activeSeatIndex,
    getDealerSeatIndex: () => dealerSeatIndex,
    getCurrentBet: () => currentBet,
    getMinRaise: () => minRaise,
    getRoundName: () => roundName,
    isHost: () => hostMode
  };
})();
