/* -------------------------------------------------------------
   GAMING HUB - SMART POKER BOTS DECISION ENGINE
------------------------------------------------------------- */

(function() {
  // Define bot personalities based on seat number
  // Tight-Passive (Conservative): checks/calls, folds easily.
  // Tight-Aggressive (Balanced): plays good hands strong, folds weak.
  // Loose-Aggressive (Aggressive): plays many hands, bluffs, raises often.
  
  function getBotPersonality(seat) {
    const types = ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'];
    return types[seat % 3];
  }

  // Evaluates decision based on cards and round context
  function makeDecision(botPlayer, context, callback) {
    const personality = getBotPersonality(botPlayer.seat);
    const { communityCards, currentBet, playerBet, pot, playersCount, minRaise, bbAmount } = context;
    const toCall = currentBet - playerBet;
    const isPreFlop = (communityCards.length === 0);
    
    // Simulating a thinking delay
    const delay = 1000 + Math.random() * 1500; // 1.0 to 2.5 seconds
    
    setTimeout(() => {
      let action = 'check'; // default
      let raiseAmount = 0;

      // 1. Evaluate hand strength
      let handStrength = 0.1; // 0.0 to 1.0 scale
      
      if (isPreFlop) {
        // Pre-flop strength evaluation
        handStrength = evaluatePreFlopStrength(botPlayer.cards);
      } else {
        // Post-flop strength evaluation
        handStrength = evaluatePostFlopStrength(botPlayer.cards, communityCards);
      }

      // Add slight personality deviations / bluffing factors
      if (personality === 'AGGRESSIVE') {
        handStrength += 0.12; // plays looser
        // 12% chance to outright bluff on a weak hand post-flop
        if (!isPreFlop && handStrength < 0.40 && Math.random() < 0.12) {
          handStrength = 0.76; // pretend to have a strong hand
        }
      } else if (personality === 'CONSERVATIVE') {
        handStrength -= 0.08; // plays tighter
      }

      handStrength = Math.max(0, Math.min(1, handStrength));

      // 2. Decide action based on strength, bet facing, and personality
      if (toCall === 0) {
        // No bet facing us: Check or Bet (Raise)
        let betThreshold = 0.70; // Balanced
        if (personality === 'AGGRESSIVE') betThreshold = 0.58;
        if (personality === 'CONSERVATIVE') betThreshold = 0.78;

        if (handStrength > betThreshold) {
          action = 'raise';
          raiseAmount = calculateRaiseAmount(botPlayer.cash, currentBet, minRaise, pot, handStrength, isPreFlop);
        } else {
          action = 'check';
        }
      } else {
        // facing a bet: Fold, Call (Match), or Raise
        const potOdds = toCall / (pot + toCall);
        
        // Decide fold vs call
        let foldThreshold = 0.28; // Balanced
        if (isPreFlop) {
          // Play tighter pre-flop to prevent calling with absolute trash
          foldThreshold = 0.38;
        }

        if (personality === 'CONSERVATIVE') {
          // Tight threshold, especially facing large bets
          foldThreshold += 0.10;
        } else if (personality === 'AGGRESSIVE') {
          // Loose threshold
          foldThreshold -= 0.08;
        }

        // If bet is extremely large compared to their stack, raise threshold to fold
        if (toCall > botPlayer.cash * 0.50) {
          foldThreshold += 0.15;
        }

        if (handStrength < foldThreshold) {
          action = 'fold';
        } else {
          // Call or Raise
          let raiseThreshold = 0.76;
          if (personality === 'AGGRESSIVE') raiseThreshold = 0.65;
          if (personality === 'CONSERVATIVE') raiseThreshold = 0.84;
          
          if (handStrength > raiseThreshold && botPlayer.cash > toCall) {
            action = 'raise';
            raiseAmount = calculateRaiseAmount(botPlayer.cash, currentBet, minRaise, pot, handStrength, isPreFlop);
          } else {
            action = 'match';
          }
        }
      }

      // 3. Fallbacks and integrity checks
      if (action === 'check' && toCall > 0) {
        // Can't check when bet facing, fall back to call or fold
        action = handStrength > 0.30 ? 'match' : 'fold';
      }

      if (action === 'raise') {
        // Ensure raise is at least minRaise, and doesn't exceed stack
        if (raiseAmount < currentBet + minRaise) {
          raiseAmount = currentBet + minRaise;
        }
        if (raiseAmount > botPlayer.cash + playerBet) {
          // Go all-in if raise is larger than cash
          raiseAmount = botPlayer.cash + playerBet;
        }
        
        // If we can't afford the raise but can afford the call
        if (raiseAmount <= currentBet) {
          action = 'match';
        }
      }

      // Execute action
      callback(action, raiseAmount);
    }, delay);
  }

  // Pre-flop pocket card strength (0.0 to 1.0)
  function evaluatePreFlopStrength(pocketCards) {
    if (pocketCards.length < 2) return 0.1;
    
    const c1 = pocketCards[0];
    const c2 = pocketCards[1];
    
    const v1 = Math.max(c1.value, c2.value);
    const v2 = Math.min(c1.value, c2.value);
    
    const isPair = (c1.value === c2.value);
    const isSuited = (c1.suit === c2.suit);
    const connectorDiff = Math.abs(c1.value - c2.value);

    // AA, KK, QQ, JJ, AK
    if (isPair && v1 >= 11) return 0.95; // Premium pairs
    if (isPair && v1 >= 8) return 0.80;  // Medium pairs
    if (isPair) return 0.60;             // Low pairs
    
    if (v1 === 14 && v2 >= 10) return 0.75; // Ace + Face (AK, AQ, AJ, A10)
    if (v1 === 13 && v2 >= 11) return 0.65; // King + Face (KQ, KJ)
    
    if (isSuited && connectorDiff === 1) return 0.60; // Suited connector (e.g. 9h 8h)
    if (connectorDiff === 1) return 0.45;             // Offsuit connector
    if (v1 >= 11) return 0.40;                        // Any high face card
    
    return 0.15; // Low cards
  }

  // Post-flop best combination strength (0.0 to 1.0)
  function evaluatePostFlopStrength(pocketCards, communityCards) {
    // Run the hand evaluator on all 5, 6, or 7 cards
    const all = [...pocketCards, ...communityCards];
    const hand = window.GamingHubPoker.evaluateSevenCards(all);
    
    // Hand rank mapping:
    // 0: High Card -> low strength
    // 1: One Pair -> medium-low
    // 2: Two Pair -> medium
    // 3: Three of a Kind -> medium-high
    // 4: Straight -> high
    // 5: Flush -> high
    // 6: Full House -> premium
    // 7: Four of a Kind -> premium
    // 8: Straight Flush -> premium
    // 9: Royal Flush -> maximum

    switch (hand.rank) {
      case 9: return 1.0;  // Royal Flush
      case 8: return 0.98; // Straight Flush
      case 7: return 0.95; // Four of a Kind
      case 6: return 0.90; // Full House
      case 5: return 0.85; // Flush
      case 4: return 0.80; // Straight
      case 3: return 0.70; // Three of a Kind
      
      case 2: // Two Pair
        // High pair determines strength
        return 0.50 + (hand.tieBreakers[0] / 15) * 0.15; // 0.50 to 0.65
        
      case 1: // One Pair
        // Pair value determines strength
        return 0.25 + (hand.tieBreakers[0] / 15) * 0.20; // 0.25 to 0.45
        
      case 0: // High card
      default:
        // Strength based on top card
        return 0.05 + (hand.tieBreakers[0] / 15) * 0.15; // 0.05 to 0.20
    }
  }

  // Helper to calculate raise amount
  function calculateRaiseAmount(cash, currentBet, minRaise, pot, strength, isPreFlop) {
    const bb = 10;
    const minIncrement = minRaise - currentBet;
    let increment = minIncrement;

    if (isPreFlop) {
      // Pre-flop raises should be based on big blinds
      if (strength > 0.85) {
        increment = bb * 4; // Raise 4x BB
      } else if (strength > 0.70) {
        increment = bb * 3; // Raise 3x BB
      } else {
        increment = bb * 2.5; // Raise 2.5x BB
      }
    } else {
      // Post-flop raises should be based on pot size
      if (strength > 0.85) {
        increment = Math.max(minIncrement, Math.round(pot * 0.65));
      } else if (strength > 0.70) {
        increment = Math.max(minIncrement, Math.round(pot * 0.45));
      } else {
        increment = Math.max(minIncrement, Math.round(pot * 0.30));
      }
    }

    let targetRaise = currentBet + increment;
    
    // Round to nearest chip value ($5 increments)
    targetRaise = Math.round(targetRaise / 5) * 5;

    // Enforce min raise
    if (targetRaise < minRaise) {
      targetRaise = minRaise;
    }

    // Capping logic to prevent premature all-ins:
    // If the hand is not premium (strength <= 0.85), cap the raise at 35% of their remaining stack.
    if (strength <= 0.85 && targetRaise > currentBet + cash * 0.35) {
      targetRaise = currentBet + Math.max(minIncrement, Math.round(cash * 0.35));
      targetRaise = Math.round(targetRaise / 5) * 5;
    }

    return targetRaise;
  }

  // Export Bot Engine
  window.GamingHubBot = {
    makeDecision
  };
})();
