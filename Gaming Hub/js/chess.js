/* -------------------------------------------------------------
   COOKED CHESS - CORE RULES ENGINE, AI BOT & ELO SYSTEM
   ------------------------------------------------------------- */

(function() {
  // Piece values for bot evaluation and material calculation
  const PIECE_VALUES = {
    'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000
  };

  // Bot Usernames database (to match ELO rating silently)
  const BOT_NAMES = [
    "AlphaKnight", "RookStar", "PawnPusher99", "CheckmateChamps", "GrandmasterX",
    "ChessMaster2026", "BlitzKing", "BobbyFisherman", "DeepBluePrint", "StockFishy",
    "MagnusMini", "QueenGambiter", "ForkingHell", "CastleDefender", "CheckmateSlayer"
  ];

  // Helper to parse file and rank to index
  function coordinateToIndex(coord) {
    if (!coord || coord.length !== 2) return -1;
    const file = coord.charCodeAt(0) - 97; // a-h -> 0-7
    const rank = 8 - parseInt(coord[1]);   // 1-8 -> 7-0
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return -1;
    return rank * 8 + file;
  }

  // Helper to convert index to coordinate
  function indexToCoordinate(index) {
    if (index < 0 || index > 63) return "";
    const rank = 8 - Math.floor(index / 8);
    const file = String.fromCharCode((index % 8) + 97);
    return file + rank;
  }

  // Create starting chess board layout
  function createInitialBoard() {
    const board = new Array(64).fill(null);
    
    // Black major pieces
    board[0] = 'br'; board[1] = 'bn'; board[2] = 'bb'; board[3] = 'bq';
    board[4] = 'bk'; board[5] = 'bb'; board[6] = 'bn'; board[7] = 'br';
    // Black pawns
    for (let i = 8; i < 16; i++) board[i] = 'bp';

    // White pawns
    for (let i = 48; i < 56; i++) board[i] = 'wp';
    // White major pieces
    board[56] = 'wr'; board[57] = 'wn'; board[58] = 'wb'; board[59] = 'wq';
    board[60] = 'wk'; board[61] = 'wb'; board[62] = 'wn'; board[63] = 'wr';

    return board;
  }

  // Generate random bot profile
  function generateBotProfile(targetRating) {
    const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    // Random deviation between -50 and +50
    const deviation = Math.floor(Math.random() * 101) - 50;
    const rating = Math.max(100, targetRating + deviation);
    return {
      username: name,
      rating: rating,
      isBot: true
    };
  }

  class ChessGame {
    constructor() {
      this.board = createInitialBoard();
      this.turn = 'white'; // 'white' or 'black'
      
      // Castling tracking flags
      this.castlingRights = {
        white: { kingSide: true, queenSide: true },
        black: { kingSide: true, queenSide: true }
      };

      this.moveHistory = []; // [{ from, to, piece, captured, promotion, notation }]
      this.halfmoveClock = 0; // For 50-move rule
      this.isGameOver = false;
      this.gameResult = null; // 'white', 'black', or 'draw'
      this.gameOverReason = ''; // 'checkmate', 'stalemate', 'timeout', 'resignation', 'draw_agreement'
    }

    clone() {
      const copy = new ChessGame();
      copy.board = [...this.board];
      copy.turn = this.turn;
      copy.castlingRights = {
        white: { ...this.castlingRights.white },
        black: { ...this.castlingRights.black }
      };
      copy.moveHistory = [...this.moveHistory];
      copy.halfmoveClock = this.halfmoveClock;
      copy.isGameOver = this.isGameOver;
      copy.gameResult = this.gameResult;
      copy.gameOverReason = this.gameOverReason;
      return copy;
    }

    // Get the color of piece at index
    getPieceColor(index) {
      const piece = this.board[index];
      if (!piece) return null;
      return piece[0] === 'w' ? 'white' : 'black';
    }

    // Get legal moves for the active color at fromIndex
    getLegalMoves(fromIndex) {
      if (this.isGameOver) return [];
      const piece = this.board[fromIndex];
      if (!piece) return [];
      
      const color = piece[0] === 'w' ? 'white' : 'black';
      if (color !== this.turn) return [];

      const pseudoMoves = this.getPseudoLegalMoves(fromIndex);
      
      // Filter out moves that leave own King in check
      return pseudoMoves.filter(toIndex => {
        const gameSim = this.clone();
        gameSim.executeMoveSilent(fromIndex, toIndex);
        return !gameSim.isKingInCheck(color);
      });
    }

    // Verify if King is currently in check
    isKingInCheck(color) {
      // Find King index
      const kingPiece = color === 'white' ? 'wk' : 'bk';
      let kingIndex = -1;
      for (let i = 0; i < 64; i++) {
        if (this.board[i] === kingPiece) {
          kingIndex = i;
          break;
        }
      }

      if (kingIndex === -1) return false;

      // Check if any opponent piece can attack kingIndex
      const opponentColor = color === 'white' ? 'black' : 'white';
      for (let i = 0; i < 64; i++) {
        const p = this.board[i];
        if (!p) continue;
        const pColor = p[0] === 'w' ? 'white' : 'black';
        if (pColor === opponentColor) {
          const attacks = this.getPseudoLegalMoves(i, true); // attacks ignoring king checks
          if (attacks.includes(kingIndex)) {
            return true;
          }
        }
      }
      return false;
    }

    // Execute move silently for check-simulation
    executeMoveSilent(from, to) {
      const piece = this.board[from];
      
      // Handle Castling moves
      if (piece === 'wk' && Math.abs(from - to) === 2) {
        if (to === 62) { // Kingside
          this.board[61] = 'wr'; this.board[63] = null;
        } else if (to === 58) { // Queenside
          this.board[59] = 'wr'; this.board[56] = null;
        }
      } else if (piece === 'bk' && Math.abs(from - to) === 2) {
        if (to === 6) { // Kingside
          this.board[5] = 'br'; this.board[7] = null;
        } else if (to === 2) { // Queenside
          this.board[3] = 'br'; this.board[0] = null;
        }
      }

      // Basic update
      this.board[to] = piece;
      this.board[from] = null;

      // Handle simple promotions
      if (piece === 'wp' && Math.floor(to / 8) === 0) {
        this.board[to] = 'wq';
      } else if (piece === 'bp' && Math.floor(to / 8) === 7) {
        this.board[to] = 'bq';
      }
    }

    // Execute move, toggle turn, calculate outcome
    makeMove(from, to) {
      if (this.isGameOver) return false;
      const piece = this.board[from];
      if (!piece) return false;
      
      const legalMoves = this.getLegalMoves(from);
      if (!legalMoves.includes(to)) return false;

      const color = piece[0] === 'w' ? 'white' : 'black';
      const type = piece[1];
      const captured = this.board[to];

      let notation = '';
      
      // Build algebraic notation prefix
      if (type !== 'p') {
        notation += type.toUpperCase();
      } else {
        if (captured) {
          notation += indexToCoordinate(from)[0]; // e.g. e of exd5
        }
      }
      if (captured) {
        notation += 'x';
      }
      notation += indexToCoordinate(to);

      // Execute on board
      this.executeMoveSilent(from, to);

      // Manage Castling Rights
      if (piece === 'wk') {
        this.castlingRights.white.kingSide = false;
        this.castlingRights.white.queenSide = false;
      } else if (piece === 'bk') {
        this.castlingRights.black.kingSide = false;
        this.castlingRights.black.queenSide = false;
      } else if (piece === 'wr') {
        if (from === 56) this.castlingRights.white.queenSide = false;
        if (from === 63) this.castlingRights.white.kingSide = false;
      } else if (piece === 'br') {
        if (from === 0) this.castlingRights.black.queenSide = false;
        if (from === 7) this.castlingRights.black.kingSide = false;
      }

      // Check if target was a Rook and updates opponent castling
      if (to === 56) this.castlingRights.white.queenSide = false;
      if (to === 63) this.castlingRights.white.kingSide = false;
      if (to === 0) this.castlingRights.black.queenSide = false;
      if (to === 7) this.castlingRights.black.kingSide = false;

      // Halfmove clock / 50-move rule
      if (type === 'p' || captured) {
        this.halfmoveClock = 0;
      } else {
        this.halfmoveClock++;
      }

      // Toggle turn
      this.turn = this.turn === 'white' ? 'black' : 'white';

      // Check / Checkmate detection
      const nextColor = this.turn;
      const isNextInCheck = this.isKingInCheck(nextColor);
      const nextHasMoves = this.hasAnyLegalMoves(nextColor);

      if (isNextInCheck) {
        if (!nextHasMoves) {
          // Checkmate!
          notation += '#';
          this.isGameOver = true;
          this.gameResult = color; // Winner is active player
          this.gameOverReason = 'checkmate';
        } else {
          notation += '+';
        }
      } else {
        if (!nextHasMoves) {
          // Stalemate!
          this.isGameOver = true;
          this.gameResult = 'draw';
          this.gameOverReason = 'stalemate';
        }
      }

      // Push history
      this.moveHistory.push({
        from: indexToCoordinate(from),
        to: indexToCoordinate(to),
        fromIdx: from,
        toIdx: to,
        piece: piece,
        captured: captured,
        notation: notation
      });

      return true;
    }

    // Resign match
    resign(resigningColor) {
      if (this.isGameOver) return;
      this.isGameOver = true;
      this.gameResult = resigningColor === 'white' ? 'black' : 'white';
      this.gameOverReason = 'resignation';
    }

    // Declare draw
    declareDraw(reason) {
      if (this.isGameOver) return;
      this.isGameOver = true;
      this.gameResult = 'draw';
      this.gameOverReason = reason || 'draw_agreement';
    }

    // Trigger Timeout loss
    triggerTimeout(loserColor) {
      if (this.isGameOver) return;
      this.isGameOver = true;
      this.gameResult = loserColor === 'white' ? 'black' : 'white';
      this.gameOverReason = 'timeout';
    }

    // Verify if a color has any legal moves anywhere
    hasAnyLegalMoves(color) {
      for (let i = 0; i < 64; i++) {
        const piece = this.board[i];
        if (!piece) continue;
        const pColor = piece[0] === 'w' ? 'white' : 'black';
        if (pColor === color) {
          const moves = this.getLegalMoves(i);
          if (moves.length > 0) return true;
        }
      }
      return false;
    }

    // Generate pseudo-legal moves (not checking for check-safety)
    getPseudoLegalMoves(from, ignoreKingCastles = false) {
      const piece = this.board[from];
      if (!piece) return [];
      
      const color = piece[0] === 'w' ? 'white' : 'black';
      const type = piece[1];
      const moves = [];

      const row = Math.floor(from / 8);
      const col = from % 8;

      if (type === 'p') {
        // Pawn
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;

        // Move 1 square forward
        const singleStep = from + dir * 8;
        if (singleStep >= 0 && singleStep < 64 && !this.board[singleStep]) {
          moves.push(singleStep);
          // Move 2 squares forward from start
          const doubleStep = from + dir * 16;
          if (row === startRow && !this.board[doubleStep]) {
            moves.push(doubleStep);
          }
        }

        // Capture diagonally
        const targets = [];
        if (col > 0) targets.push(from + dir * 8 - 1);
        if (col < 7) targets.push(from + dir * 8 + 1);

        targets.forEach(t => {
          if (t >= 0 && t < 64) {
            const dest = this.board[t];
            if (dest && dest[0] !== piece[0]) {
              moves.push(t);
            }
          }
        });

      } else if (type === 'n') {
        // Knight jumps
        const jumps = [-17, -15, -10, -6, 6, 10, 15, 17];
        jumps.forEach(j => {
          const t = from + j;
          if (t >= 0 && t < 64) {
            const tRow = Math.floor(t / 8);
            const tCol = t % 8;
            if (Math.abs(tRow - row) <= 2 && Math.abs(tCol - col) <= 2) {
              const dest = this.board[t];
              if (!dest || dest[0] !== piece[0]) {
                moves.push(t);
              }
            }
          }
        });

      } else if (type === 'b' || type === 'r' || type === 'q') {
        // Bishop, Rook, Queen sliding moves
        const dirs = [];
        if (type === 'b' || type === 'q') {
          dirs.push({ r: -1, c: -1 }, { r: -1, c: 1 }, { r: 1, c: -1 }, { r: 1, c: 1 });
        }
        if (type === 'r' || type === 'q') {
          dirs.push({ r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 });
        }

        dirs.forEach(d => {
          let currRow = row + d.r;
          let currCol = col + d.c;
          while (currRow >= 0 && currRow < 8 && currCol >= 0 && currCol < 8) {
            const idx = currRow * 8 + currCol;
            const dest = this.board[idx];
            if (!dest) {
              moves.push(idx);
            } else {
              if (dest[0] !== piece[0]) {
                moves.push(idx);
              }
              break; // Blocked
            }
            currRow += d.r;
            currCol += d.c;
          }
        });

      } else if (type === 'k') {
        // King steps
        const steps = [
          { r: -1, c: -1 }, { r: -1, c: 0 }, { r: -1, c: 1 },
          { r: 0, c: -1 },                    { r: 0, c: 1 },
          { r: 1, c: -1 },  { r: 1, c: 0 },  { r: 1, c: 1 }
        ];

        steps.forEach(s => {
          const currRow = row + s.r;
          const currCol = col + s.c;
          if (currRow >= 0 && currRow < 8 && currCol >= 0 && currCol < 8) {
            const idx = currRow * 8 + currCol;
            const dest = this.board[idx];
            if (!dest || dest[0] !== piece[0]) {
              moves.push(idx);
            }
          }
        });

        // Castling moves (if not in simulation / ignoring recursion check)
        if (!ignoreKingCastles) {
          const rights = color === 'white' ? this.castlingRights.white : this.castlingRights.black;
          const kingRow = color === 'white' ? 7 : 0;
          const kIdx = kingRow * 8 + 4; // d=3, e=4 index
          
          if (from === kIdx && !this.isKingInCheck(color)) {
            // Kingside Castle
            if (rights.kingSide) {
              const f5 = kingRow * 8 + 5;
              const f6 = kingRow * 8 + 6;
              if (!this.board[f5] && !this.board[f6]) {
                // Verify king doesn't pass through attack
                const sim1 = this.clone();
                sim1.executeMoveSilent(from, f5);
                if (!sim1.isKingInCheck(color)) {
                  moves.push(f6);
                }
              }
            }
            // Queenside Castle
            if (rights.queenSide) {
              const f3 = kingRow * 8 + 3;
              const f2 = kingRow * 8 + 2;
              const f1 = kingRow * 8 + 1;
              if (!this.board[f3] && !this.board[f2] && !this.board[f1]) {
                const sim1 = this.clone();
                sim1.executeMoveSilent(from, f3);
                if (!sim1.isKingInCheck(color)) {
                  moves.push(f2);
                }
              }
            }
          }
        }
      }

      return moves;
    }
  }

  // --- CHESS BOT DECISION MAKING ---

  // Simple static evaluation of material balance
  function evaluateBoard(game, color) {
    if (game.isGameOver) {
      if (game.gameResult === 'draw') return 0;
      if (game.gameResult === color) return 100000;
      return -100000;
    }
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const piece = game.board[i];
      if (!piece) continue;
      
      const pColor = piece[0] === 'w' ? 'white' : 'black';
      const type = piece[1];
      const val = PIECE_VALUES[type] || 0;

      // Positional rewards: control of center (d4, e4, d5, e5)
      let posBonus = 0;
      const row = Math.floor(i / 8);
      const col = i % 8;
      if (row >= 3 && row <= 4 && col >= 3 && col <= 4) {
        posBonus = 15; // minor center bonus
      }

      if (pColor === color) {
        score += val + posBonus;
      } else {
        score -= (val + posBonus);
      }
    }
    return score;
  }

  // Minimax with Alpha-Beta Pruning (2-plies deep for speed & safety)
  function minimax(game, depth, alpha, beta, isMaximizing, botColor) {
    if (depth === 0 || game.isGameOver) {
      return evaluateBoard(game, botColor);
    }

    const turnColor = game.turn;
    
    // Gather all legal moves
    const movesList = [];
    for (let i = 0; i < 64; i++) {
      const piece = game.board[i];
      if (piece && (piece[0] === 'w' ? 'white' : 'black') === turnColor) {
        const targets = game.getLegalMoves(i);
        targets.forEach(t => {
          movesList.push({ from: i, to: t });
        });
      }
    }

    if (movesList.length === 0) {
      return evaluateBoard(game, botColor);
    }

    // Sort moves loosely (captures first) to optimize alpha-beta cutoff
    movesList.sort((a, b) => {
      const capA = game.board[a.to] ? 1 : 0;
      const capB = game.board[b.to] ? 1 : 0;
      return capB - capA;
    });

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < movesList.length; i++) {
        const move = movesList[i];
        const nextGame = game.clone();
        nextGame.makeMove(move.from, move.to);
        const evalVal = minimax(nextGame, depth - 1, alpha, beta, false, botColor);
        maxEval = Math.max(maxEval, evalVal);
        alpha = Math.max(alpha, evalVal);
        if (beta <= alpha) break; // Pruning
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (let i = 0; i < movesList.length; i++) {
        const move = movesList[i];
        const nextGame = game.clone();
        nextGame.makeMove(move.from, move.to);
        const evalVal = minimax(nextGame, depth - 1, alpha, beta, true, botColor);
        minEval = Math.min(minEval, evalVal);
        beta = Math.min(beta, evalVal);
        if (beta <= alpha) break; // Pruning
      }
      return minEval;
    }
  }

  // Choose the best move according to the bot's ELO difficulty scaling
  function getBotMove(game, botRating) {
    const turnColor = game.turn;
    
    // Generate all legal moves
    const allLegalMoves = [];
    for (let i = 0; i < 64; i++) {
      const piece = game.board[i];
      if (piece && (piece[0] === 'w' ? 'white' : 'black') === turnColor) {
        const targets = game.getLegalMoves(i);
        targets.forEach(t => {
          allLegalMoves.push({ from: i, to: t });
        });
      }
    }

    if (allLegalMoves.length === 0) return null;

      // Difficulty scaling (blunder rate)
      let randomThreshold = 0.85; // default ELO < 300
      if (botRating >= 1800) {
        randomThreshold = 0.0;   // ELO 1800+ (Master)
      } else if (botRating >= 1500) {
        randomThreshold = 0.02;  // ELO 1500-1800 (Expert)
      } else if (botRating >= 1200) {
        randomThreshold = 0.08;  // ELO 1200-1500 (Advanced)
      } else if (botRating >= 900) {
        randomThreshold = 0.18;  // ELO 900-1200 (Club)
      } else if (botRating >= 600) {
        randomThreshold = 0.30;  // ELO 600-900 (Intermediate)
      } else if (botRating >= 300) {
        randomThreshold = 0.55;  // ELO 300-600 (Casual)
      }

      // Play random move
      if (Math.random() < randomThreshold) {
        return allLegalMoves[Math.floor(Math.random() * allLegalMoves.length)];
      }

      // Play optimized evaluate/minimax move
      let bestMove = null;
      let bestScore = -Infinity;

      // Search depth scales with ELO
      let depth = 1;
      if (botRating >= 1800) {
        depth = 4; // ELO 1800+ (Minimax depth 4)
      } else if (botRating >= 1200) {
        depth = 3; // ELO 1200-1800 (Minimax depth 3)
      } else if (botRating >= 600) {
        depth = 2; // ELO 600-1200 (Minimax depth 2)
      }

      allLegalMoves.forEach(move => {
        const nextGame = game.clone();
        nextGame.makeMove(move.from, move.to);
        const score = minimax(nextGame, depth - 1, -Infinity, Infinity, false, turnColor);
      
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });

    return bestMove || allLegalMoves[Math.floor(Math.random() * allLegalMoves.length)];
  }

  // --- ELO RATING SYSTEM (chess.com model) ---
  function calculateEloChange(playerRating, opponentRating, wonResult, gamesPlayedCount = 10) {
    // wonResult: 1 = win, 0 = loss, 0.5 = draw
    const kFactor = (gamesPlayedCount < 10) ? 100 : 32;
    const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const rawDiff = kFactor * (wonResult - expected);
    return Math.round(rawDiff);
  }

  // Runs minimax search from player perspective to return a search-based evaluation score
  function evaluateBoardSearch(game, depth = 3, color = 'white') {
    const isMaximizing = (game.turn === color);
    return minimax(game, depth, -Infinity, Infinity, isMaximizing, color);
  }

  // Export Core Chess functions
  window.GamingHubChess = {
    ChessGame,
    coordinateToIndex,
    indexToCoordinate,
    generateBotProfile,
    getBotMove,
    calculateEloChange,
    evaluateBoard: (game) => evaluateBoard(game, 'white'), // relative to white
    evaluateBoardSearch: (game, depth = 3, color = 'white') => evaluateBoardSearch(game, depth, color)
  };
})();
