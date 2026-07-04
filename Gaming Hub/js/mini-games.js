/**
 * Gaming Hub Mini-Games Layer
 * Contains engines for: Flappy Bird, Tic Tac Toe (AI), Snake, 2048, and Minesweeper.
 */
(function() {
  // Global reference
  window.GamingHubMiniGames = {
    flappy: { start: startFlappy, stop: stopFlappy },
    tictactoe: { start: startTicTacToe, stop: stopTicTacToe },
    snake: { start: startSnake, stop: stopSnake },
    g2048: { start: start2048, stop: stop2048 },
    minesweeper: { start: startMinesweeper, stop: stopMinesweeper }
  };

  // ==========================================
  // 1. FLAPPY BIRD ENGINE
  // ==========================================
  let flappyCtx, flappyCanvas, flappyLoopId;
  let flappyRunning = false;
  let flappyScore = 0;
  let flappyBird = { x: 50, y: 150, radius: 12, velocity: 0, gravity: 0.4, jump: -6.5 };
  let flappyPipes = [];
  let flappyFrameCount = 0;

  function startFlappy() {
    flappyCanvas = document.getElementById('flappy-canvas');
    if (!flappyCanvas) return;
    flappyCtx = flappyCanvas.getContext('2d');
    flappyRunning = false;
    flappyScore = 0;
    flappyPipes = [];
    flappyFrameCount = 0;
    flappyBird.y = 150;
    flappyBird.velocity = 0;

    document.getElementById('flappy-score-val').innerText = '0';
    const high = window.GamingHubState.state.currentUser ? (window.GamingHubState.state.currentUser.flappyHighScore || 0) : 0;
    document.getElementById('flappy-highscore-val').innerText = high;

    document.getElementById('flappy-start-overlay').style.display = 'flex';
    document.getElementById('btn-start-flappy').onclick = () => {
      document.getElementById('flappy-start-overlay').style.display = 'none';
      flappyRunning = true;
      runFlappyLoop();
    };

    window.addEventListener('keydown', handleFlappyKey);
    flappyCanvas.addEventListener('mousedown', handleFlappyClick);
    flappyCanvas.addEventListener('touchstart', handleFlappyClick);

    // Initial render
    drawFlappyScene();
  }

  function stopFlappy() {
    flappyRunning = false;
    if (flappyLoopId) {
      cancelAnimationFrame(flappyLoopId);
      flappyLoopId = null;
    }
    window.removeEventListener('keydown', handleFlappyKey);
    if (flappyCanvas) {
      flappyCanvas.removeEventListener('mousedown', handleFlappyClick);
      flappyCanvas.removeEventListener('touchstart', handleFlappyClick);
    }
  }

  function handleFlappyKey(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!flappyRunning) {
        document.getElementById('btn-start-flappy').click();
      } else {
        flappyBird.velocity = flappyBird.jump;
        window.GamingHubAudio.play('chip');
      }
    }
  }

  function handleFlappyClick(e) {
    e.preventDefault();
    if (!flappyRunning) {
      document.getElementById('btn-start-flappy').click();
    } else {
      flappyBird.velocity = flappyBird.jump;
      window.GamingHubAudio.play('chip');
    }
  }

  function runFlappyLoop() {
    if (!flappyRunning) return;
    updateFlappyPhysics();
    drawFlappyScene();
    flappyLoopId = requestAnimationFrame(runFlappyLoop);
  }

  function updateFlappyPhysics() {
    flappyFrameCount++;
    flappyBird.velocity += flappyBird.gravity;
    flappyBird.y += flappyBird.velocity;

    // Boundary check
    if (flappyBird.y + flappyBird.radius >= flappyCanvas.height || flappyBird.y - flappyBird.radius <= 0) {
      endFlappyGame();
      return;
    }

    // Spawn pipes
    if (flappyFrameCount % 100 === 0) {
      const gap = 120;
      const minHeight = 40;
      const maxHeight = flappyCanvas.height - gap - minHeight;
      const height = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
      flappyPipes.push({
        x: flappyCanvas.width,
        topHeight: height,
        bottomY: height + gap,
        width: 50,
        passed: false
      });
    }

    // Move pipes & collision
    for (let i = flappyPipes.length - 1; i >= 0; i--) {
      const pipe = flappyPipes[i];
      pipe.x -= 2;

      // Score check
      if (!pipe.passed && pipe.x + pipe.width < flappyBird.x) {
        pipe.passed = true;
        flappyScore++;
        document.getElementById('flappy-score-val').innerText = flappyScore;
        window.GamingHubAudio.play('deal');
      }

      // Collision check
      if (flappyBird.x + flappyBird.radius > pipe.x && flappyBird.x - flappyBird.radius < pipe.x + pipe.width) {
        if (flappyBird.y - flappyBird.radius < pipe.topHeight || flappyBird.y + flappyBird.radius > pipe.bottomY) {
          endFlappyGame();
          return;
        }
      }

      // Cleanup offscreen pipes
      if (pipe.x + pipe.width < 0) {
        flappyPipes.splice(i, 1);
      }
    }
  }

  function drawFlappyScene() {
    // Clear canvas with beautiful gradient sky
    const sky = flappyCtx.createLinearGradient(0, 0, 0, flappyCanvas.height);
    sky.addColorStop(0, '#1e3a8a');
    sky.addColorStop(1, '#3b82f6');
    flappyCtx.fillStyle = sky;
    flappyCtx.fillRect(0, 0, flappyCanvas.width, flappyCanvas.height);

    // Draw pipes with glowing outlines
    flappyCtx.fillStyle = '#10b981';
    flappyCtx.strokeStyle = '#ffffff';
    flappyCtx.lineWidth = 2;
    for (const pipe of flappyPipes) {
      // Top pipe
      flappyCtx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
      flappyCtx.strokeRect(pipe.x, -5, pipe.width, pipe.topHeight + 5);

      // Bottom pipe
      flappyCtx.fillRect(pipe.x, pipe.bottomY, pipe.width, flappyCanvas.height - pipe.bottomY);
      flappyCtx.strokeRect(pipe.x, pipe.bottomY, pipe.width, flappyCanvas.height - pipe.bottomY + 5);
    }

    // Draw bird with custom skin/emoji look
    flappyCtx.save();
    flappyCtx.translate(flappyBird.x, flappyBird.y);
    // Rotate bird based on velocity
    let angle = Math.min(Math.PI / 4, Math.max(-Math.PI / 6, flappyBird.velocity * 0.05));
    flappyCtx.rotate(angle);
    
    // Draw body
    flappyCtx.fillStyle = '#f59e0b';
    flappyCtx.beginPath();
    flappyCtx.arc(0, 0, flappyBird.radius, 0, Math.PI * 2);
    flappyCtx.fill();
    flappyCtx.stroke();

    // Eye
    flappyCtx.fillStyle = '#ffffff';
    flappyCtx.beginPath();
    flappyCtx.arc(4, -3, 3, 0, Math.PI * 2);
    flappyCtx.fill();
    flappyCtx.fillStyle = '#000000';
    flappyCtx.beginPath();
    flappyCtx.arc(5, -3, 1, 0, Math.PI * 2);
    flappyCtx.fill();

    // Beak
    flappyCtx.fillStyle = '#ef4444';
    flappyCtx.beginPath();
    flappyCtx.moveTo(10, 0);
    flappyCtx.lineTo(15, -2);
    flappyCtx.lineTo(12, 3);
    flappyCtx.closePath();
    flappyCtx.fill();

    flappyCtx.restore();
  }

  function endFlappyGame() {
    flappyRunning = false;
    window.GamingHubAudio.play('victory');
    const coinsGained = window.GamingHubState.recordMiniGameResult('flappy', flappyScore);
    
    // Show toast
    if (window.GamingHubUI && typeof window.GamingHubUI.showToast === 'function') {
      window.GamingHubUI.showToast(`Game Over! Earned ${coinsGained} coins!`);
    }

    document.getElementById('flappy-start-overlay').style.display = 'flex';
    document.getElementById('flappy-start-overlay').querySelector('h2').innerText = 'GAME OVER';
    document.getElementById('flappy-start-overlay').querySelector('p').innerHTML = `Final Score: <strong>${flappyScore}</strong><br/>Coins Earned: +${coinsGained} 🪙`;
    document.getElementById('btn-start-flappy').innerText = 'RESTART GAME';
    stopFlappy();
  }


  // ==========================================
  // 2. TIC TAC TOE ENGINE (UNBEATABLE MINIMAX AI)
  // ==========================================
  let tttBoard = ['', '', '', '', '', '', '', '', ''];
  let tttPlayer = 'X';
  let tttAI = 'O';
  let tttActive = true;

  function startTicTacToe() {
    tttBoard = ['', '', '', '', '', '', '', '', ''];
    tttPlayer = 'X';
    tttActive = true;
    document.getElementById('ttt-status').innerText = 'YOUR TURN (X)';
    
    // Load stats
    const u = window.GamingHubState.state.currentUser;
    document.getElementById('ttt-wins-val').innerText = u ? (u.tictactoeWins || 0) : 0;
    document.getElementById('ttt-losses-val').innerText = u ? (u.tictactoeLosses || 0) : 0;
    document.getElementById('ttt-draws-val').innerText = u ? (u.tictactoeDraws || 0) : 0;

    const cells = document.querySelectorAll('.ttt-cell');
    cells.forEach(cell => {
      cell.innerText = '';
      cell.style.background = 'rgba(15,23,42,0.85)';
      cell.onclick = (e) => handleTTTClick(e.target);
    });

    document.getElementById('btn-reset-ttt').onclick = () => {
      startTicTacToe();
    };
  }

  function stopTicTacToe() {
    tttActive = false;
  }

  function handleTTTClick(cell) {
    const idx = parseInt(cell.getAttribute('data-index'));
    if (tttBoard[idx] !== '' || !tttActive) return;

    makeTTTMove(idx, tttPlayer);
    
    if (checkTTTWin(tttBoard, tttPlayer)) {
      endTTTGame('win');
      return;
    }
    if (tttBoard.every(c => c !== '')) {
      endTTTGame('draw');
      return;
    }

    // AI Turn
    tttActive = false;
    document.getElementById('ttt-status').innerText = 'COMPUTING...';
    setTimeout(() => {
      const bestIdx = getTTTBestMove();
      makeTTTMove(bestIdx, tttAI);
      
      if (checkTTTWin(tttBoard, tttAI)) {
        endTTTGame('loss');
        return;
      }
      if (tttBoard.every(c => c !== '')) {
        endTTTGame('draw');
        return;
      }
      
      tttActive = true;
      document.getElementById('ttt-status').innerText = 'YOUR TURN (X)';
    }, 400);
  }

  function makeTTTMove(idx, player) {
    tttBoard[idx] = player;
    const cell = document.querySelector(`.ttt-cell[data-index="${idx}"]`);
    if (cell) {
      cell.innerText = player;
      cell.style.color = player === 'X' ? '#3b82f6' : '#ec4899';
      cell.style.textShadow = player === 'X' ? '0 0 10px rgba(59,130,246,0.5)' : '0 0 10px rgba(236,72,153,0.5)';
      window.GamingHubAudio.play('chip');
    }
  }

  function checkTTTWin(board, p) {
    const combos = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    return combos.some(c => c.every(idx => board[idx] === p));
  }

  function getTTTBestMove() {
    let bestScore = -Infinity;
    let move = 4; // center fallback
    for (let i = 0; i < 9; i++) {
      if (tttBoard[i] === '') {
        tttBoard[i] = tttAI;
        let score = minimaxTTT(tttBoard, 0, false);
        tttBoard[i] = '';
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }

  function minimaxTTT(board, depth, isMaximizing) {
    if (checkTTTWin(board, tttAI)) return 10 - depth;
    if (checkTTTWin(board, tttPlayer)) return depth - 10;
    if (board.every(c => c !== '')) return 0;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
          board[i] = tttAI;
          let score = minimaxTTT(board, depth + 1, false);
          board[i] = '';
          bestScore = Math.max(bestScore, score);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === '') {
          board[i] = tttPlayer;
          let score = minimaxTTT(board, depth + 1, true);
          board[i] = '';
          bestScore = Math.min(bestScore, score);
        }
      }
      return bestScore;
    }
  }

  function endTTTGame(outcome) {
    tttActive = false;
    window.GamingHubAudio.play('victory');
    const coins = window.GamingHubState.recordMiniGameResult('tictactoe', 0, outcome);
    
    // Update labels
    const u = window.GamingHubState.state.currentUser;
    document.getElementById('ttt-wins-val').innerText = u ? (u.tictactoeWins || 0) : 0;
    document.getElementById('ttt-losses-val').innerText = u ? (u.tictactoeLosses || 0) : 0;
    document.getElementById('ttt-draws-val').innerText = u ? (u.tictactoeDraws || 0) : 0;

    if (outcome === 'win') {
      document.getElementById('ttt-status').innerText = 'YOU WON! 🎉';
      document.getElementById('ttt-status').style.color = '#10b981';
      window.GamingHubUI.showToast(`Victory! Earned ${coins} coins!`);
    } else if (outcome === 'loss') {
      document.getElementById('ttt-status').innerText = 'YOU LOST!';
      document.getElementById('ttt-status').style.color = '#ef4444';
      window.GamingHubUI.showToast(`Defeat! Try again!`);
    } else {
      document.getElementById('ttt-status').innerText = "IT'S A DRAW!";
      document.getElementById('ttt-status').style.color = 'var(--text-muted)';
      window.GamingHubUI.showToast(`Draw match!`);
    }
  }


  // ==========================================
  // 3. SNAKE ARENA ENGINE
  // ==========================================
  let snakeCanvas, snakeCtx, snakeTimerId;
  let snakeRunning = false;
  let snakeScore = 0;
  let snakeCells = [];
  let snakeFood = { x: 0, y: 0 };
  let snakeDir = 'right';
  let snakeGridSize = 20;

  function startSnake() {
    snakeCanvas = document.getElementById('snake-canvas');
    if (!snakeCanvas) return;
    snakeCtx = snakeCanvas.getContext('2d');
    snakeRunning = false;
    snakeScore = 0;
    snakeDir = 'right';
    snakeCells = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 }
    ];

    document.getElementById('snake-score-val').innerText = '0';
    const high = window.GamingHubState.state.currentUser ? (window.GamingHubState.state.currentUser.snakeHighScore || 0) : 0;
    document.getElementById('snake-highscore-val').innerText = high;

    placeSnakeFood();
    document.getElementById('snake-start-overlay').style.display = 'flex';
    document.getElementById('btn-start-snake').onclick = () => {
      document.getElementById('snake-start-overlay').style.display = 'none';
      snakeRunning = true;
      runSnakeLoop();
    };

    window.addEventListener('keydown', handleSnakeKey);
    drawSnakeScene();
  }

  function stopSnake() {
    snakeRunning = false;
    if (snakeTimerId) {
      clearInterval(snakeTimerId);
      snakeTimerId = null;
    }
    window.removeEventListener('keydown', handleSnakeKey);
  }

  function handleSnakeKey(e) {
    if (!snakeRunning) return;
    if ((e.code === 'ArrowUp' || e.code === 'KeyW') && snakeDir !== 'down') snakeDir = 'up';
    if ((e.code === 'ArrowDown' || e.code === 'KeyS') && snakeDir !== 'up') snakeDir = 'down';
    if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && snakeDir !== 'right') snakeDir = 'left';
    if ((e.code === 'ArrowRight' || e.code === 'KeyD') && snakeDir !== 'left') snakeDir = 'right';
  }

  function runSnakeLoop() {
    if (snakeTimerId) clearInterval(snakeTimerId);
    snakeTimerId = setInterval(() => {
      if (!snakeRunning) return;
      updateSnakePhysics();
      drawSnakeScene();
    }, 100);
  }

  function updateSnakePhysics() {
    let headX = snakeCells[0].x;
    let headY = snakeCells[0].y;

    if (snakeDir === 'up') headY--;
    if (snakeDir === 'down') headY++;
    if (snakeDir === 'left') headX--;
    if (snakeDir === 'right') headX++;

    const wCells = snakeCanvas.width / snakeGridSize;
    const hCells = snakeCanvas.height / snakeGridSize;
    
    if (headX < 0 || headX >= wCells || headY < 0 || headY >= hCells || snakeCells.some(c => c.x === headX && c.y === headY)) {
      endSnakeGame();
      return;
    }

    const newHead = { x: headX, y: headY };
    snakeCells.unshift(newHead);

    if (headX === snakeFood.x && headY === snakeFood.y) {
      snakeScore += 10;
      document.getElementById('snake-score-val').innerText = snakeScore;
      window.GamingHubAudio.play('deal');
      placeSnakeFood();
    } else {
      snakeCells.pop();
    }
  }

  function placeSnakeFood() {
    const wCells = snakeCanvas.width / snakeGridSize;
    const hCells = snakeCanvas.height / snakeGridSize;
    let x = Math.floor(Math.random() * wCells);
    let y = Math.floor(Math.random() * hCells);
    while (snakeCells.some(c => c.x === x && c.y === y)) {
      x = Math.floor(Math.random() * wCells);
      y = Math.floor(Math.random() * hCells);
    }
    snakeFood = { x, y };
  }

  function drawSnakeScene() {
    snakeCtx.fillStyle = '#0f172a';
    snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);

    snakeCells.forEach((c, index) => {
      snakeCtx.fillStyle = index === 0 ? '#10b981' : '#059669';
      snakeCtx.strokeStyle = '#ffffff';
      snakeCtx.lineWidth = 1.5;
      snakeCtx.fillRect(c.x * snakeGridSize, c.y * snakeGridSize, snakeGridSize, snakeGridSize);
      snakeCtx.strokeRect(c.x * snakeGridSize, c.y * snakeGridSize, snakeGridSize, snakeGridSize);
    });

    snakeCtx.save();
    snakeCtx.fillStyle = '#ef4444';
    snakeCtx.shadowColor = '#ef4444';
    snakeCtx.shadowBlur = 10;
    snakeCtx.beginPath();
    snakeCtx.arc(
      snakeFood.x * snakeGridSize + snakeGridSize / 2,
      snakeFood.y * snakeGridSize + snakeGridSize / 2,
      snakeGridSize / 2 - 2,
      0,
      Math.PI * 2
    );
    snakeCtx.fill();
    snakeCtx.restore();
  }

  function endSnakeGame() {
    snakeRunning = false;
    window.GamingHubAudio.play('victory');
    const coins = window.GamingHubState.recordMiniGameResult('snake', snakeScore);
    
    if (window.GamingHubUI && typeof window.GamingHubUI.showToast === 'function') {
      window.GamingHubUI.showToast(`Game Over! Earned ${coins} coins!`);
    }

    document.getElementById('snake-start-overlay').style.display = 'flex';
    document.getElementById('snake-start-overlay').querySelector('h2').innerText = 'GAME OVER';
    document.getElementById('snake-start-overlay').querySelector('p').innerHTML = `Final Score: <strong>${snakeScore}</strong><br/>Coins Earned: +${coins} 🪙`;
    document.getElementById('btn-start-snake').innerText = 'RESTART ARENA';
    stopSnake();
  }


  // ==========================================
  // 4. 2048 SLIDING PUZZLE
  // ==========================================
  let board2048Grid = [
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0]
  ];
  let score2048 = 0;
  let history2048 = [];
  let g2048Active = false;

  function start2048() {
    board2048Grid = [
      [0,0,0,0],
      [0,0,0,0],
      [0,0,0,0],
      [0,0,0,0]
    ];
    score2048 = 0;
    history2048 = [];
    g2048Active = true;

    document.getElementById('score2048-val').innerText = '0';
    const high = window.GamingHubState.state.currentUser ? (window.GamingHubState.state.currentUser.highest2048Tile || 0) : 0;
    document.getElementById('highest2048-val').innerText = high;

    addRandomTile2048();
    addRandomTile2048();
    render2048Board();

    window.addEventListener('keydown', handle2048Key);

    document.getElementById('btn-undo-2048').onclick = () => {
      undo2048();
    };
    document.getElementById('btn-reset-2048').onclick = () => {
      start2048();
    };
  }

  function stop2048() {
    g2048Active = false;
    window.removeEventListener('keydown', handle2048Key);
  }

  function addRandomTile2048() {
    let emptyCells = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board2048Grid[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length > 0) {
      const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      board2048Grid[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  function render2048Board() {
    const container = document.getElementById('board2048');
    if (!container) return;
    container.innerHTML = '';

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = board2048Grid[r][c];
        const cell = document.createElement('div');
        cell.style.cssText = 'width:72px; height:72px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.4rem; transition: all 0.15s; border: 1px solid rgba(255,255,255,0.03);';
        
        if (val === 0) {
          cell.style.background = 'rgba(15,23,42,0.6)';
          cell.innerText = '';
        } else {
          cell.innerText = val;
          let bg = '#1e293b';
          if (val === 2) bg = 'hsl(30, 20%, 50%)';
          else if (val === 4) bg = 'hsl(30, 40%, 45%)';
          else if (val === 8) bg = 'hsl(20, 60%, 45%)';
          else if (val === 16) bg = 'hsl(15, 80%, 45%)';
          else if (val === 32) bg = 'hsl(10, 90%, 45%)';
          else if (val === 64) bg = 'hsl(0, 100%, 45%)';
          else if (val === 128) bg = 'hsl(45, 100%, 40%)';
          else if (val === 256) bg = 'hsl(50, 100%, 45%)';
          else if (val === 512) bg = 'hsl(55, 100%, 50%)';
          else if (val === 1024) bg = 'hsl(260, 80%, 50%)';
          else if (val === 2048) bg = 'hsl(280, 100%, 50%)';
          
          cell.style.background = bg;
          cell.style.color = '#fff';
          cell.style.boxShadow = `0 0 10px ${bg}`;
        }
        container.appendChild(cell);
      }
    }
  }

  function handle2048Key(e) {
    if (!g2048Active) return;
    let moved = false;
    const backup = JSON.stringify(board2048Grid);

    if (e.code === 'ArrowUp' || e.code === 'KeyW') { moved = slide2048Up(); e.preventDefault(); }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') { moved = slide2048Down(); e.preventDefault(); }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { moved = slide2048Left(); e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { moved = slide2048Right(); e.preventDefault(); }

    if (moved) {
      history2048.push({ board: JSON.parse(backup), score: score2048 });
      addRandomTile2048();
      render2048Board();
      window.GamingHubAudio.play('chip');

      let maxVal = 0;
      for (let r=0; r<4; r++) {
        for (let c=0; c<4; c++) {
          maxVal = Math.max(maxVal, board2048Grid[r][c]);
        }
      }
      window.GamingHubState.recordMiniGameResult('2048', maxVal);
      document.getElementById('highest2048-val').innerText = window.GamingHubState.state.currentUser.highest2048Tile;

      if (check2048GameOver()) {
        window.GamingHubUI.showToast("No moves left! Game Over.");
        g2048Active = false;
      }
    }
  }

  function undo2048() {
    if (history2048.length > 0) {
      const last = history2048.pop();
      board2048Grid = last.board;
      score2048 = last.score;
      document.getElementById('score2048-val').innerText = score2048;
      render2048Board();
      window.GamingHubAudio.play('chip');
      g2048Active = true;
    }
  }

  function slide2048Row(row) {
    let filtered = row.filter(val => val !== 0);
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i+1]) {
        filtered[i] *= 2;
        score2048 += filtered[i];
        document.getElementById('score2048-val').innerText = score2048;
        filtered.splice(i+1, 1);
      }
    }
    while (filtered.length < 4) {
      filtered.push(0);
    }
    return filtered;
  }

  function slide2048Left() {
    let changed = false;
    for (let r = 0; r < 4; r++) {
      const orig = [...board2048Grid[r]];
      const res = slide2048Row(orig);
      if (JSON.stringify(res) !== JSON.stringify(board2048Grid[r])) changed = true;
      board2048Grid[r] = res;
    }
    return changed;
  }

  function slide2048Right() {
    let changed = false;
    for (let r = 0; r < 4; r++) {
      const orig = [...board2048Grid[r]].reverse();
      const res = slide2048Row(orig).reverse();
      if (JSON.stringify(res) !== JSON.stringify(board2048Grid[r])) changed = true;
      board2048Grid[r] = res;
    }
    return changed;
  }

  function slide2048Up() {
    let changed = false;
    for (let c = 0; c < 4; c++) {
      const col = [board2048Grid[0][c], board2048Grid[1][c], board2048Grid[2][c], board2048Grid[3][c]];
      const res = slide2048Row(col);
      for (let r = 0; r < 4; r++) {
        if (board2048Grid[r][c] !== res[r]) changed = true;
        board2048Grid[r][c] = res[r];
      }
    }
    return changed;
  }

  function slide2048Down() {
    let changed = false;
    for (let c = 0; c < 4; c++) {
      const col = [board2048Grid[0][c], board2048Grid[1][c], board2048Grid[2][c], board2048Grid[3][c]].reverse();
      const res = slide2048Row(col).reverse();
      for (let r = 0; r < 4; r++) {
        if (board2048Grid[r][c] !== res[r]) changed = true;
        board2048Grid[r][c] = res[r];
      }
    }
    return changed;
  }

  function check2048GameOver() {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board2048Grid[r][c] === 0) return false;
        if (r < 3 && board2048Grid[r][c] === board2048Grid[r+1][c]) return false;
        if (c < 3 && board2048Grid[r][c] === board2048Grid[r][c+1]) return false;
      }
    }
    return true;
  }


  // ==========================================
  // 5. MINESWEEPER ENGINE
  // ==========================================
  let minesBoard = [];
  let minesRows = 9, minesCols = 9, minesCount = 10;
  let minesTimerInterval = null;
  let minesTimeElapsed = 0;
  let minesActive = false;
  let minesRevealedCount = 0;

  function startMinesweeper() {
    const diff = document.getElementById('mines-difficulty').value;
    if (diff === 'easy') {
      minesRows = 9; minesCols = 9; minesCount = 10;
    } else if (diff === 'medium') {
      minesRows = 12; minesCols = 12; minesCount = 20;
    } else {
      minesRows = 15; minesCols = 15; minesCount = 35;
    }

    minesActive = true;
    minesTimeElapsed = 0;
    minesRevealedCount = 0;
    document.getElementById('mines-count-val').innerText = minesCount;
    document.getElementById('mines-time-val').innerText = '0';

    if (minesTimerInterval) clearInterval(minesTimerInterval);
    minesTimerInterval = setInterval(() => {
      if (minesActive) {
        minesTimeElapsed++;
        document.getElementById('mines-time-val').innerText = minesTimeElapsed;
      }
    }, 1000);

    buildMinesGrid();
    renderMinesGrid();

    document.getElementById('btn-reset-mines').onclick = () => {
      startMinesweeper();
    };
    document.getElementById('mines-difficulty').onchange = () => {
      startMinesweeper();
    };
  }

  function stopMinesweeper() {
    minesActive = false;
    if (minesTimerInterval) {
      clearInterval(minesTimerInterval);
      minesTimerInterval = null;
    }
  }

  function buildMinesGrid() {
    minesBoard = [];
    for (let r = 0; r < minesRows; r++) {
      const row = [];
      for (let c = 0; c < minesCols; c++) {
        row.push({
          r, c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0
        });
      }
      minesBoard.push(row);
    }

    let placed = 0;
    while (placed < minesCount) {
      const r = Math.floor(Math.random() * minesRows);
      const c = Math.floor(Math.random() * minesCols);
      if (!minesBoard[r][c].isMine) {
        minesBoard[r][c].isMine = true;
        placed++;
      }
    }

    for (let r = 0; r < minesRows; r++) {
      for (let c = 0; c < minesCols; c++) {
        if (minesBoard[r][c].isMine) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < minesRows && nc >= 0 && nc < minesCols) {
              if (minesBoard[nr][nc].isMine) count++;
            }
          }
        }
        minesBoard[r][c].neighborMines = count;
      }
    }
  }

  function renderMinesGrid() {
    const container = document.getElementById('mines-board');
    if (!container) return;
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${minesCols}, 28px)`;

    for (let r = 0; r < minesRows; r++) {
      for (let c = 0; c < minesCols; c++) {
        const cell = minesBoard[r][c];
        const btn = document.createElement('div');
        btn.style.cssText = 'width:28px; height:28px; background:rgba(255,255,255,0.08); border-radius:4px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.9rem; cursor:pointer; user-select:none; border:1px solid rgba(255,255,255,0.02); transition: background 0.15s;';
        
        btn.onclick = () => revealMinesCell(r, c);
        
        btn.oncontextmenu = (e) => {
          e.preventDefault();
          flagMinesCell(r, c);
        };

        if (cell.isRevealed) {
          btn.style.background = 'rgba(15,23,42,0.8)';
          if (cell.isMine) {
            btn.innerText = '💣';
            btn.style.background = '#ef4444';
          } else if (cell.neighborMines > 0) {
            btn.innerText = cell.neighborMines;
            let color = '#3b82f6';
            if (cell.neighborMines === 2) color = '#10b981';
            if (cell.neighborMines === 3) color = '#f59e0b';
            if (cell.neighborMines >= 4) color = '#ec4899';
            btn.style.color = color;
          } else {
            btn.innerText = '';
          }
        } else if (cell.isFlagged) {
          btn.innerText = '🚩';
          btn.style.color = '#ef4444';
        } else {
          btn.innerText = '';
        }

        container.appendChild(btn);
      }
    }
  }

  function revealMinesCell(r, c) {
    if (!minesActive) return;
    const cell = minesBoard[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;
    window.GamingHubAudio.play('chip');

    if (cell.isMine) {
      endMinesweeperGame(false);
      return;
    }

    minesRevealedCount++;
    if (cell.neighborMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < minesRows && nc >= 0 && nc < minesCols) {
            revealMinesCell(nr, nc);
          }
        }
      }
    }

    renderMinesGrid();

    const totalCells = minesRows * minesCols;
    if (minesRevealedCount === totalCells - minesCount) {
      endMinesweeperGame(true);
    }
  }

  function flagMinesCell(r, c) {
    if (!minesActive) return;
    const cell = minesBoard[r][c];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    window.GamingHubAudio.play('deal');
    
    let flags = 0;
    for (let row = 0; row < minesRows; row++) {
      for (let col = 0; col < minesCols; col++) {
        if (minesBoard[row][col].isFlagged) flags++;
      }
    }
    document.getElementById('mines-count-val').innerText = Math.max(0, minesCount - flags);

    renderMinesGrid();
  }

  function endMinesweeperGame(won) {
    minesActive = false;
    if (minesTimerInterval) {
      clearInterval(minesTimerInterval);
      minesTimerInterval = null;
    }

    for (let r = 0; r < minesRows; r++) {
      for (let c = 0; c < minesCols; c++) {
        if (minesBoard[r][c].isMine) {
          minesBoard[r][c].isRevealed = true;
        }
      }
    }
    renderMinesGrid();

    window.GamingHubAudio.play('victory');

    if (won) {
      const coins = window.GamingHubState.recordMiniGameResult('minesweeper', minesTimeElapsed, 'win');
      window.GamingHubUI.showToast(`Victory! Cleared in ${minesTimeElapsed}s! Earned ${coins} coins!`);
    } else {
      window.GamingHubUI.showToast(`Boom! Hit a mine! Game Over.`);
    }
  }
})();
