/* -------------------------------------------------------------
   HEXANAUT.IO GAME ENGINE
------------------------------------------------------------- */

(function () {
  const GRID_WIDTH = 65;
  const GRID_HEIGHT = 65;
  const HEX_SIZE = 24;

  const hexHeight = HEX_SIZE * 2;
  const hexWidth = Math.sqrt(3) * HEX_SIZE;
  const spacingX = hexWidth;
  const spacingY = hexHeight * 0.75;

  const MAP_WIDTH = GRID_WIDTH * spacingX + hexWidth / 2;
  const MAP_HEIGHT = GRID_HEIGHT * spacingY + hexHeight / 2;

  let canvas = null;
  let ctx = null;
  let minimapCanvas = null;
  let minimapCtx = null;
  let isRunning = false;
  let animationId = null;

  let activeRoom = null;
  let localPlayer = null;
  let playersMap = new Map(); // username -> PlayerObject

  // Grid holding ownership: key "c,r" -> username
  let gridOwnership = {}; 

  let keys = {};
  let mouse = { x: 0, y: 0, isDown: false, screenX: 0, screenY: 0, hasMoved: false };
  let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };

  let totemsList = [];
  let hexanautUsername = null;
  let hexanautTimeLeft = 180;

  let killFeedList = [];
  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#f97316', '#14b8a6', '#6366f1', '#d946ef', '#059669', '#b91c1c', '#1d4ed8'];

  // Neighbor offsets for pointy-topped odd-r offset hex grid
  function getNeighbors(c, r) {
    const list = [];
    if (c > 0) list.push({ c: c - 1, r: r });
    if (c < GRID_WIDTH - 1) list.push({ c: c + 1, r: r });

    const isOdd = (r % 2) !== 0;
    const rows = [r - 1, r + 1];
    for (const nr of rows) {
      if (nr >= 0 && nr < GRID_HEIGHT) {
        list.push({ c: c, r: nr });
        if (isOdd) {
          if (c < GRID_WIDTH - 1) list.push({ c: c + 1, r: nr });
        } else {
          if (c > 0) list.push({ c: c - 1, r: nr });
        }
      }
    }
    return list;
  }

  // Convert Cartesian to Hex
  function pixelToHex(x, y) {
    let r_est = Math.round((y - hexHeight / 2) / spacingY);
    let c_est = Math.round((x - (r_est % 2 === 0 ? hexWidth / 2 : hexWidth)) / spacingX);

    let bestC = 0;
    let bestR = 0;
    let minDist = Infinity;

    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const tc = c_est + dc;
        const tr = r_est + dr;
        if (tc >= 0 && tc < GRID_WIDTH && tr >= 0 && tr < GRID_HEIGHT) {
          const cx = tc * hexWidth + (tr % 2 === 0 ? hexWidth / 2 : hexWidth);
          const cy = tr * spacingY + hexHeight / 2;
          const dx = x - cx;
          const dy = y - cy;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            bestC = tc;
            bestR = tr;
          }
        }
      }
    }
    return { c: bestC, r: bestR };
  }

  // Get hex center position
  function hexToPixel(c, r) {
    const cx = c * hexWidth + (r % 2 === 0 ? hexWidth / 2 : hexWidth);
    const cy = r * spacingY + hexHeight / 2;
    return { x: cx, y: cy };
  }

  // Spawn circles on start
  function getHexCircle(c, r, radius) {
    const list = new Set();
    const queue = [{ c, r, d: 0 }];
    const visited = {};
    visited[`${c},${r}`] = true;
    list.add(`${c},${r}`);

    while (queue.length > 0) {
      const curr = queue.shift();
      if (curr.d >= radius) continue;

      const neighbors = getNeighbors(curr.c, curr.r);
      for (const n of neighbors) {
        const key = `${n.c},${n.r}`;
        if (!visited[key]) {
          visited[key] = true;
          list.add(key);
          queue.push({ c: n.c, r: n.r, d: curr.d + 1 });
        }
      }
    }
    return list;
  }

  function generateSpawnPoints(playersList) {
    const spawnedPositions = [];
    return playersList.map(p => {
      let c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
      let r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
      
      let attempts = 0;
      while (attempts < 50) {
        const pixel = hexToPixel(c, r);
        let tooClose = false;
        for (const pos of spawnedPositions) {
          const dist = Math.hypot(pos.x - pixel.x, pos.y - pixel.y);
          if (dist < 350) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) break;
        c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
        r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
        attempts++;
      }
      
      const pixel = hexToPixel(c, r);
      spawnedPositions.push(pixel);
      
      return {
        ...p,
        spawnPoint: { c, r }
      };
    });
  }

  // Initialize a new game
  function startGame(room, playersList, initialGridOwnership = null, localSpawnPoint = null) {
    activeRoom = room;
    isRunning = true;
    gridOwnership = {};
    playersMap.clear();
    mouse.hasMoved = false;

    totemsList = [
      { type: 'speed', c: 15, r: 15, label: '⚡', name: 'Speed Totem', color: '#eab308', owner: null },
      { type: 'spreading', c: 50, r: 15, label: '🌐', name: 'Spreading Totem', color: '#10b981', owner: null },
      { type: 'spy', c: 32, r: 32, label: '📡', name: 'Spy Dish', color: '#a855f7', owner: null },
      { type: 'teleport', c: 15, r: 50, label: '🌀', name: 'Teleport Gate', color: '#3b82f6', owner: null },
      { type: 'slowing', c: 50, r: 50, label: '❄️', name: 'Slowing Totem', color: '#06b6d4', owner: null }
    ];
    hexanautUsername = null;
    hexanautTimeLeft = 180;

    // Reset overlay headers
    const wastedHeader = document.querySelector('#hex-respawn-overlay h2');
    if (wastedHeader) {
      wastedHeader.innerText = "Wasted";
      wastedHeader.style.color = "#ef4444";
    }

    // Hide any lingering respawn overlays from previous sessions
    const overlay = document.getElementById('hex-respawn-overlay');
    if (overlay) overlay.classList.add('hidden');

    const startMenu = document.getElementById('hex-start-menu-overlay');
    if (startMenu) startMenu.classList.add('hidden');

    canvas = document.getElementById('hexanaut-canvas');
    minimapCanvas = document.getElementById('hexanaut-minimap');

    if (canvas) {
      ctx = canvas.getContext('2d');
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    }
    if (minimapCanvas) {
      minimapCtx = minimapCanvas.getContext('2d');
    }

    // Capture inputs
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    if (canvas) {
      canvas.addEventListener('mousemove', handleMouseMove);
    }

    const selfName = window.GamingHubState.state.currentUser.username;
    
    // Distribute spawn points
    playersList.forEach((p, idx) => {
      // Pick spawn grid coordinate
      let c, r;
      if (p.username === selfName && localSpawnPoint) {
        c = localSpawnPoint.c;
        r = localSpawnPoint.r;
      } else if (p.spawnPoint) {
        c = p.spawnPoint.c;
        r = p.spawnPoint.r;
      } else {
        c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
        r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
        
        // Ensure no overlapping spawn centers using pixel distance (at least 350px)
        let attempts = 0;
        while (attempts < 50) {
          const pixel = hexToPixel(c, r);
          let tooClose = false;
          for (const existing of playersMap.values()) {
            const dist = Math.hypot(existing.x - pixel.x, existing.y - pixel.y);
            if (dist < 350) {
              tooClose = true;
              break;
            }
          }
          if (!tooClose) break;
          c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
          r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
          attempts++;
        }
      }

      const pixel = hexToPixel(c, r);
      let startTerritory;
      if (initialGridOwnership && p.username !== selfName) {
        startTerritory = new Set();
        for (const key in initialGridOwnership) {
          if (initialGridOwnership[key] === p.username) {
            startTerritory.add(key);
          }
        }
      } else {
        startTerritory = getHexCircle(c, r, 3);
      }

      const pObj = {
        username: p.username,
        color: p.color || colors[idx % colors.length],
        x: pixel.x,
        y: pixel.y,
        vx: 0,
        vy: 0,
        angle: Math.random() * Math.PI * 2,
        speed: p.isBot ? 2.8 : 3.5, // Bots are slightly slower than human players to make them manageable
        tail: [], // array of "c,r" keys
        tailSet: new Set(),
        territory: startTerritory,
        kills: 0,
        isBot: p.isBot,
        isDead: false,
        spawnShieldTime: Date.now() + 3000, // 3-second spawn shield
        spawnC: c,
        spawnR: r,
        lastHexKey: `${c},${r}`,
        skin: p.skin || 'classic'
      };

      // Add to ownership grid if not using initial grid ownership
      if (!initialGridOwnership) {
        startTerritory.forEach(key => {
          gridOwnership[key] = p.username;
        });
      }

      playersMap.set(p.username, pObj);
      if (p.username === selfName) {
        localPlayer = pObj;
        camera.x = pObj.x;
        camera.y = pObj.y;
      }
    });

    if (initialGridOwnership) {
      gridOwnership = { ...initialGridOwnership };
      if (localPlayer) {
        localPlayer.territory.forEach(key => {
          gridOwnership[key] = selfName;
        });
      }
    }

    // Update level display
    const lvlEl = document.getElementById('hexanaut-game-level');
    if (lvlEl) lvlEl.innerText = window.GamingHubState.state.currentUser.hexanautLevel || 1;

    // Reset HUD
    updateHUDStats();

    // Start rendering and physics loop
    animationId = requestAnimationFrame(gameLoop);
  }

  function resizeCanvas() {
    if (canvas) {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
  }

  function handleKeyDown(e) {
    keys[e.key.toLowerCase()] = true;
  }
  function handleKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }
  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.screenX = e.clientX - rect.left;
    mouse.screenY = e.clientY - rect.top;
    mouse.hasMoved = true;
  }

  // Main game loop
  function gameLoop() {
    if (!isRunning) return;

    updatePhysics();
    renderGame();
    renderMinimap();
    updateHUDLeaderboard();

    animationId = requestAnimationFrame(gameLoop);
  }

  function hasTotem(username, type) {
    return totemsList.some(t => t.type === type && t.owner === username);
  }

  // Update game physics and logic
  function updatePhysics() {
    if (!localPlayer || localPlayer.isDead) return;

    // Update totem ownership based on grid ownership
    totemsList.forEach(totem => {
      const key = `${totem.c},${totem.r}`;
      totem.owner = gridOwnership[key] || null;
    });

    // Update HUD indicators for local player's totems
    const totemTypes = ['speed', 'spreading', 'spy', 'teleport', 'slowing'];
    totemTypes.forEach(type => {
      const el = document.getElementById(`totem-hud-${type}`);
      if (el) {
        const owned = hasTotem(localPlayer.username, type);
        if (owned) {
          el.style.filter = 'none';
          el.style.opacity = '1';
        } else {
          el.style.filter = 'grayscale(100%)';
          el.style.opacity = '0.3';
        }
      }
    });

    // Teleport Gate effect (warp to safety if Space key is pressed)
    if (keys[' '] && hasTotem(localPlayer.username, 'teleport')) {
      const now = Date.now();
      if (!localPlayer.lastTeleportTime || now - localPlayer.lastTeleportTime > 20000) {
        localPlayer.lastTeleportTime = now;
        if (localPlayer.territory.size > 0) {
          const arr = Array.from(localPlayer.territory);
          const midKey = arr[Math.floor(arr.length / 2)];
          const [tc, tr] = midKey.split(',').map(Number);
          const pix = hexToPixel(tc, tr);
          localPlayer.x = pix.x;
          localPlayer.y = pix.y;
          localPlayer.tail = [];
          localPlayer.tailSet.clear();
          window.GamingHubAudio.play('chip');
          addKillFeedMessage("You teleported back to base!");
        }
      }
    }

    // Determine target movement angle
    let targetAngle = localPlayer.angle;
    let isMoving = true;
    
    // Keyboard inputs
    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy = -1;
    if (keys['s'] || keys['arrowdown']) dy = 1;
    if (keys['a'] || keys['arrowleft']) dx = -1;
    if (keys['d'] || keys['arrowright']) dx = 1;

    if (dx !== 0 || dy !== 0) {
      targetAngle = Math.atan2(dy, dx);
    } else if (canvas && mouse.hasMoved) {
      // Steer towards cursor
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      targetAngle = Math.atan2(mouse.screenY - cy, mouse.screenX - cx);
    } else {
      isMoving = false;
    }

    localPlayer.angle = targetAngle;
    
    // Speed totem check
    const baseSpeed = 3.5;
    let currentSpeed = hasTotem(localPlayer.username, 'speed') ? baseSpeed + 1.0 : baseSpeed;

    // Slowing aura check
    let isLocalSlowed = false;
    for (const other of playersMap.values()) {
      if (other.username !== localPlayer.username && !other.isDead && hasTotem(other.username, 'slowing')) {
        const dist = Math.hypot(localPlayer.x - other.x, localPlayer.y - other.y);
        if (dist < 150) {
          isLocalSlowed = true;
          break;
        }
      }
    }
    localPlayer.speed = isLocalSlowed ? currentSpeed * 0.5 : currentSpeed;

    if (isMoving) {
      localPlayer.vx = Math.cos(targetAngle) * localPlayer.speed;
      localPlayer.vy = Math.sin(targetAngle) * localPlayer.speed;
    } else {
      localPlayer.vx = 0;
      localPlayer.vy = 0;
    }

    localPlayer.x += localPlayer.vx;
    localPlayer.y += localPlayer.vy;

    // Keep within boundaries
    if (localPlayer.x < 10) { localPlayer.x = 10; triggerDeath(localPlayer, "collided with the border"); }
    if (localPlayer.x > MAP_WIDTH - 10) { localPlayer.x = MAP_WIDTH - 10; triggerDeath(localPlayer, "collided with the border"); }
    if (localPlayer.y < 10) { localPlayer.y = 10; triggerDeath(localPlayer, "collided with the border"); }
    if (localPlayer.y > MAP_HEIGHT - 10) { localPlayer.y = MAP_HEIGHT - 10; triggerDeath(localPlayer, "collided with the border"); }

    const hex = pixelToHex(localPlayer.x, localPlayer.y);
    const hexKey = `${hex.c},${hex.r}`;

    if (hexKey !== localPlayer.lastHexKey) {
      localPlayer.lastHexKey = hexKey;
      
      const isOwned = (gridOwnership[hexKey] === localPlayer.username);

      if (isOwned) {
        if (localPlayer.tail.length > 0) {
          // Closed the capture loop!
          executeCapture(localPlayer);
        }
      } else {
        // Draw tail
        if (!localPlayer.tailSet.has(hexKey)) {
          localPlayer.tail.push(hexKey);
          localPlayer.tailSet.add(hexKey);
        } else {
          // Crossed own tail -> self sabotage
          triggerDeath(localPlayer, "cut their own tail");
        }

        // Check if we hit another player's tail
        for (const other of playersMap.values()) {
          if (other.username !== localPlayer.username && !other.isDead) {
            if (other.spawnShieldTime && Date.now() < other.spawnShieldTime) continue; // shielded!
            if (other.tailSet.has(hexKey)) {
              // We killed them!
              triggerDeath(other, `was eliminated by ${localPlayer.username}`);
              localPlayer.kills++;
              updateHUDStats();
              window.GamingHubSync.sendHexanautKill(localPlayer.username, other.username, "cut tail");
            }
          }
        }
      }
    }

    // Broadcast position sync
    window.GamingHubSync.sendHexanautUpdate(
      localPlayer.x,
      localPlayer.y,
      localPlayer.vx,
      localPlayer.vy,
      localPlayer.angle,
      localPlayer.tail
    );

    // Smooth camera track
    camera.targetX = localPlayer.x;
    camera.targetY = localPlayer.y;
    camera.x += (camera.targetX - camera.x) * 0.1;
    camera.y += (camera.targetY - camera.y) * 0.1;

    // Spreading totem capture tick (runs for all players in single player, or by host for bots + local player)
    const isHost = !activeRoom || (activeRoom.hostUsername === localPlayer.username);
    for (const p of playersMap.values()) {
      if (p.isDead) continue;
      
      if (hasTotem(p.username, 'spreading')) {
        p.lastSpreadTick = (p.lastSpreadTick || 0) + 1;
        if (p.lastSpreadTick >= 120) { // approx 2 seconds at 60 FPS
          p.lastSpreadTick = 0;
          
          if (p.username === localPlayer.username || (p.isBot && isHost)) {
            const candidates = [];
            p.territory.forEach(key => {
              const [tc, tr] = key.split(',').map(Number);
              const neighbors = getNeighbors(tc, tr);
              for (const n of neighbors) {
                const nKey = `${n.c},${n.r}`;
                if (gridOwnership[nKey] !== p.username) {
                  candidates.push(nKey);
                }
              }
            });
            
            if (candidates.length > 0) {
              const chosen = candidates[Math.floor(Math.random() * candidates.length)];
              const prevOwner = gridOwnership[chosen];
              if (prevOwner) {
                const prevP = playersMap.get(prevOwner);
                if (prevP) prevP.territory.delete(chosen);
              }
              gridOwnership[chosen] = p.username;
              p.territory.add(chosen);
              
              if (p.username === localPlayer.username) {
                window.GamingHubSync.sendHexanautCapture([chosen]);
              } else {
                postMessageForBot('HEX_ROOM_CAPTURE', p.username, { tiles: [chosen] });
              }
            }
          }
        }
      }
    }

    // Hexanaut Victory Countdown Check
    const totalTiles = GRID_WIDTH * GRID_HEIGHT;
    let maxP = null;
    let maxPct = 0;
    for (const player of playersMap.values()) {
      if (player.isDead) continue;
      const pct = (player.territory.size / totalTiles) * 100;
      if (pct > maxPct) {
        maxPct = pct;
        maxP = player;
      }
    }

    if (maxPct >= 20.0 && maxP) {
      if (hexanautUsername !== maxP.username) {
        hexanautUsername = maxP.username;
        hexanautTimeLeft = 180; // 3 minutes
        addKillFeedMessage(`${maxP.username} is now the HEXANAUT!`);
      } else {
        hexanautTimeLeft -= 1 / 60; // 60 FPS
        if (hexanautTimeLeft <= 0) {
          hexanautTimeLeft = 0;
          triggerVictory(maxP);
        }
      }
    } else {
      if (hexanautUsername !== null) {
        addKillFeedMessage("The HEXANAUT has been dethroned!");
        hexanautUsername = null;
        hexanautTimeLeft = 180;
      }
    }

    // Update Hexanaut timer HUD card
    const timerEl = document.getElementById('hex-hud-hexanaut-timer');
    if (timerEl) {
      if (hexanautUsername) {
        timerEl.classList.remove('hidden');
        const timerVal = document.getElementById('hexanaut-timer-val');
        const timerOwner = document.getElementById('hexanaut-timer-owner');
        
        const mins = Math.floor(hexanautTimeLeft / 60);
        const secs = Math.floor(hexanautTimeLeft % 60);
        if (timerVal) {
          timerVal.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          timerVal.style.color = (hexanautUsername === localPlayer.username) ? '#ef4444' : '#f59e0b';
        }
        if (timerOwner) {
          timerOwner.innerText = `${hexanautUsername} (${maxPct.toFixed(1)}%)`;
        }
      } else {
        timerEl.classList.add('hidden');
      }
    }

    // Simulate bots if we are the host (room owner)
    if (activeRoom && activeRoom.hostUsername === localPlayer.username) {
      updateBots();
    }
  }

  // Capture Territory Algorithm (BFS Flood fill from borders)
  function executeCapture(p) {
    const myNewTerritory = new Set(p.territory);
    p.tail.forEach(t => myNewTerritory.add(t));

    // Outer boundary tiles of the map grid
    const boundaryQueue = [];
    const visited = {};

    // Generate border nodes
    for (let c = 0; c < GRID_WIDTH; c++) {
      const kTop = `${c},0`;
      const kBot = `${c},${GRID_HEIGHT - 1}`;
      if (!myNewTerritory.has(kTop)) { visited[kTop] = true; boundaryQueue.push({ c, r: 0 }); }
      if (!myNewTerritory.has(kBot)) { visited[kBot] = true; boundaryQueue.push({ c, r: GRID_HEIGHT - 1 }); }
    }
    for (let r = 0; r < GRID_HEIGHT; r++) {
      const kLeft = `0,${r}`;
      const kRight = `${GRID_WIDTH - 1},${r}`;
      if (!myNewTerritory.has(kLeft)) { visited[kLeft] = true; boundaryQueue.push({ c: 0, r }); }
      if (!myNewTerritory.has(kRight)) { visited[kRight] = true; boundaryQueue.push({ c: GRID_WIDTH - 1, r }); }
    }

    // Run BFS from borders
    while (boundaryQueue.length > 0) {
      const curr = boundaryQueue.shift();
      const neighbors = getNeighbors(curr.c, curr.r);
      for (const n of neighbors) {
        const key = `${n.c},${n.r}`;
        if (!visited[key] && !myNewTerritory.has(key)) {
          visited[key] = true;
          boundaryQueue.push({ c: n.c, r: n.r });
        }
      }
    }

    // Any cell not reached by BFS and not inside myNewTerritory is enclosed!
    const capturedTiles = [];
    for (let r = 0; r < GRID_HEIGHT; r++) {
      for (let c = 0; c < GRID_WIDTH; c++) {
        const key = `${c},${r}`;
        if (!visited[key]) {
          capturedTiles.push(key);
        }
      }
    }

    // Assign all captured tiles to the player
    capturedTiles.forEach(key => {
      // Remove ownership from previous owner
      const prevOwnerName = gridOwnership[key];
      if (prevOwnerName && prevOwnerName !== p.username) {
        const prevPlayer = playersMap.get(prevOwnerName);
        if (prevPlayer) {
          prevPlayer.territory.delete(key);
          if (prevPlayer.territory.size === 0 && !prevPlayer.isDead) {
            triggerDeath(prevPlayer, "lost all their territory");
          }
        }
      }
      gridOwnership[key] = p.username;
      p.territory.add(key);
    });

    p.tail = [];
    p.tailSet.clear();

    // Broadcast capture update
    window.GamingHubSync.sendHexanautCapture(capturedTiles);

    updateHUDStats();
    window.GamingHubAudio.play('chip');
  }

  function spawnNewJoinedPlayer(username, level, tabId, spawnPoint = null, skin = 'classic') {
    if (playersMap.has(username)) return null;

    let c, r;
    if (spawnPoint) {
      c = spawnPoint.c;
      r = spawnPoint.r;
    } else {
      c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
      r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
      let attempts = 0;
      while (attempts < 50) {
        const pixel = hexToPixel(c, r);
        let tooClose = false;
        for (const existing of playersMap.values()) {
          if (!existing.isDead) {
            const dist = Math.hypot(existing.x - pixel.x, existing.y - pixel.y);
            if (dist < 400) {
              tooClose = true;
              break;
            }
          }
        }
        if (!tooClose) break;
        c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
        r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
        attempts++;
      }
    }

    const pixel = hexToPixel(c, r);
    const startTerritory = getHexCircle(c, r, 3);
    const idx = playersMap.size;
    const color = colors[idx % colors.length];

    const pObj = {
      username: username,
      color: color,
      x: pixel.x,
      y: pixel.y,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      speed: 3.5,
      tail: [],
      tailSet: new Set(),
      territory: startTerritory,
      kills: 0,
      isBot: false,
      isDead: false,
      spawnShieldTime: Date.now() + 3000, // 3-second spawn shield
      spawnC: c,
      spawnR: r,
      lastHexKey: `${c},${r}`,
      skin: skin || 'classic'
    };

    // Add to ownership grid
    startTerritory.forEach(key => {
      gridOwnership[key] = username;
    });

    playersMap.set(username, pObj);
    addKillFeedMessage(`${username} joined the game`);

    return { c, r };
  }

  // Update enemy player coordinates from network updates
  function updateEnemyPlayer(username, data) {
    let enemy = playersMap.get(username);
    if (!enemy) {
      spawnNewJoinedPlayer(username, 1, 'unknown', null, data.skin);
      enemy = playersMap.get(username);
    }
    if (enemy && !enemy.isDead) {
      enemy.x = data.x;
      enemy.y = data.y;
      enemy.vx = data.vx;
      enemy.vy = data.vy;
      enemy.angle = data.angle;
      enemy.skin = data.skin || enemy.skin || 'classic';
      
      // Update tail
      enemy.tail = data.tail || [];
      enemy.tailSet.clear();
      enemy.tail.forEach(t => enemy.tailSet.add(t));
    }
  }

  // Enemy capture sync
  function captureEnemyTerritory(username, tiles) {
    const enemy = playersMap.get(username);
    if (enemy && !enemy.isDead) {
      tiles.forEach(key => {
        const prevOwner = gridOwnership[key];
        if (prevOwner && prevOwner !== username) {
          const prevP = playersMap.get(prevOwner);
          if (prevP) {
            prevP.territory.delete(key);
            if (prevP.territory.size === 0 && !prevP.isDead) {
              triggerDeath(prevP, "lost all their territory");
            }
          }
        }
        gridOwnership[key] = username;
        enemy.territory.add(key);
      });
      enemy.tail = [];
      enemy.tailSet.clear();
      updateHUDStats();
    }
  }

  // Sync kill feed
  function handlePlayerKillEvent(killer, victim, reason) {
    const kil = playersMap.get(killer);
    const vic = playersMap.get(victim);
    if (vic && !vic.isDead) {
      if (vic.spawnShieldTime && Date.now() < vic.spawnShieldTime) return; // shielded!
      triggerDeath(vic, `was eliminated by ${killer}`);
      if (kil) {
        kil.kills++;
      }
      updateHUDStats();
    }
  }

  // Handle player death
  function triggerDeath(p, reason) {
    if (p.isDead) return;
    p.isDead = true;
    p.tail = [];
    p.tailSet.clear();

    // Remove ownership of their tiles
    p.territory.forEach(key => {
      if (gridOwnership[key] === p.username) {
        delete gridOwnership[key];
      }
    });
    p.territory.clear();

    // Add kill feed notice
    addKillFeedMessage(`${p.username} ${reason}`);

    window.GamingHubAudio.play('fold');

    if (p === localPlayer) {
      // Local player died!
      const totalTiles = GRID_WIDTH * GRID_HEIGHT;
      const ownPercent = (localPlayer.maxPercentCaptured || 0);

      // Award coins based on performance
      const coinsGained = Math.round(ownPercent * 1.5) + localPlayer.kills * 2;
      
      // Save stats to state manager
      window.GamingHubState.recordHexanautResult(ownPercent, coinsGained, false);

      // Show death overlay
      const btn = document.getElementById('btn-hexanaut-respawn');
      if (btn) btn.innerText = "Respawn";

      const reasonEl = document.getElementById('hex-death-reason');
      if (reasonEl) {
        const displayReason = reason.replace(/\bwas\b/g, 'were').replace(/\btheir\b/g, 'your');
        reasonEl.innerText = `You ${displayReason}!`;
      }
      const coinsEl = document.getElementById('hex-death-coins');
      if (coinsEl) coinsEl.innerText = coinsGained;

      const overlay = document.getElementById('hex-respawn-overlay');
      if (overlay) overlay.classList.remove('hidden');
    }
  }

  function triggerVictory(p) {
    if (!isRunning) return;
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    const totalTiles = GRID_WIDTH * GRID_HEIGHT;
    const ownPercent = (localPlayer.territory.size / totalTiles) * 100;

    if (p === localPlayer) {
      // Local player won! Reward 200 coins and record win
      const coinsGained = 200 + localPlayer.kills * 2;
      window.GamingHubState.recordHexanautResult(ownPercent, coinsGained, true);

      // Show death overlay as a Victory overlay
      const reasonEl = document.getElementById('hex-death-reason');
      if (reasonEl) reasonEl.innerText = "Victory! You maintained 20% territory and became the HEXANAUT!";
      const coinsEl = document.getElementById('hex-death-coins');
      if (coinsEl) coinsEl.innerText = coinsGained;

      // Rename the header in the overlay to Victory!
      const wastedHeader = document.querySelector('#hex-respawn-overlay h2');
      if (wastedHeader) {
        wastedHeader.innerText = "Victory!";
        wastedHeader.style.color = "#10b981"; // green
      }

      const overlay = document.getElementById('hex-respawn-overlay');
      if (overlay) overlay.classList.remove('hidden');
      
      window.GamingHubAudio.play('deal'); // victory chime
    } else {
      // Bot won the game
      window.GamingHubState.recordHexanautResult(ownPercent, localPlayer.kills * 2, false);

      const reasonEl = document.getElementById('hex-death-reason');
      if (reasonEl) reasonEl.innerText = `Defeat! ${p.username} won the game as the HEXANAUT!`;
      const coinsEl = document.getElementById('hex-death-coins');
      if (coinsEl) coinsEl.innerText = localPlayer.kills * 2;

      const wastedHeader = document.querySelector('#hex-respawn-overlay h2');
      if (wastedHeader) {
        wastedHeader.innerText = "Defeat!";
        wastedHeader.style.color = "#ef4444"; // red
      }

      const overlay = document.getElementById('hex-respawn-overlay');
      if (overlay) overlay.classList.remove('hidden');
    }
    const btn = document.getElementById('btn-hexanaut-respawn');
    if (btn) btn.innerText = "Back to Menu";
  }

  function respawnPlayer() {
    if (!localPlayer) return;

    let c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
    let r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
    let attempts = 0;
    while (attempts < 50) {
      const pixel = hexToPixel(c, r);
      let tooClose = false;
      for (const existing of playersMap.values()) {
        if (!existing.isDead && existing.username !== localPlayer.username) {
          const dist = Math.hypot(existing.x - pixel.x, existing.y - pixel.y);
          if (dist < 400) {
            tooClose = true;
            break;
          }
        }
      }
      if (!tooClose) break;
      c = 5 + Math.floor(Math.random() * (GRID_WIDTH - 10));
      r = 5 + Math.floor(Math.random() * (GRID_HEIGHT - 10));
      attempts++;
    }

    const pixel = hexToPixel(c, r);
    const startTerritory = getHexCircle(c, r, 3);

    localPlayer.x = pixel.x;
    localPlayer.y = pixel.y;
    localPlayer.vx = 0;
    localPlayer.vy = 0;
    localPlayer.angle = Math.random() * Math.PI * 2;
    localPlayer.tail = [];
    localPlayer.tailSet.clear();
    localPlayer.territory = startTerritory;
    localPlayer.isDead = false;
    localPlayer.spawnShieldTime = Date.now() + 3000; // 3-second spawn shield
    localPlayer.lastHexKey = `${c},${r}`;
    mouse.hasMoved = false;

    startTerritory.forEach(key => {
      gridOwnership[key] = localPlayer.username;
    });

    if (activeRoom && window.GamingHubSync && typeof window.GamingHubSync.sendHexanautRespawn === 'function') {
      window.GamingHubSync.sendHexanautRespawn(c, r);
    }

    updateHUDStats();
  }

  function handleEnemyRespawn(username, c, r) {
    const enemy = playersMap.get(username);
    if (enemy) {
      const pixel = hexToPixel(c, r);
      const startTerritory = getHexCircle(c, r, 3);

      enemy.x = pixel.x;
      enemy.y = pixel.y;
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.tail = [];
      enemy.tailSet.clear();
      enemy.territory = startTerritory;
      enemy.isDead = false;
      enemy.spawnShieldTime = Date.now() + 3000;
      enemy.lastHexKey = `${c},${r}`;

      // Remove old territory from grid ownership
      for (const key in gridOwnership) {
        if (gridOwnership[key] === username) {
          delete gridOwnership[key];
        }
      }

      // Add new territory
      startTerritory.forEach(key => {
        gridOwnership[key] = username;
      });

      addKillFeedMessage(`${username} respawned`);
      updateHUDStats();
    }
  }

  // Update Bot AI steering
  function updateBots() {
    for (const bot of playersMap.values()) {
      if (!bot.isBot || bot.isDead) continue;

      const hex = pixelToHex(bot.x, bot.y);
      const hexKey = `${hex.c},${hex.r}`;

      // If key changes, register tail drawing/ownership
      if (hexKey !== bot.lastHexKey) {
        bot.lastHexKey = hexKey;
        const isOwned = (gridOwnership[hexKey] === bot.username);

        if (isOwned) {
          if (bot.tail.length > 0) {
            executeCapture(bot);
            // Broadcast capture
            postMessageForBot('HEX_ROOM_CAPTURE', bot.username, { tiles: Array.from(bot.territory) });
          }
        } else {
          if (!bot.tailSet.has(hexKey)) {
            bot.tail.push(hexKey);
            bot.tailSet.add(hexKey);
          } else {
            triggerDeath(bot, "cut their own tail");
            continue;
          }

          // Check if bot cuts any player's tail
          for (const other of playersMap.values()) {
            if (other.username !== bot.username && !other.isDead) {
              if (other.spawnShieldTime && Date.now() < other.spawnShieldTime) continue; // shielded!
              if (other.tailSet.has(hexKey)) {
                triggerDeath(other, `was eliminated by ${bot.username}`);
                bot.kills++;
                updateHUDStats();
                window.GamingHubSync.sendHexanautKill(bot.username, other.username, "cut tail");
              }
            }
          }
        }
      }

      // Bot Steering AI
      let targetX = MAP_WIDTH / 2;
      let targetY = MAP_HEIGHT / 2;

      const botInOwn = bot.territory.has(hexKey);
      
      if (botInOwn) {
        // Find nearest unclaimed tile or enemy tile outside
        let closestDist = Infinity;
        for (let dr = -6; dr <= 6; dr++) {
          for (let dc = -6; dc <= 6; dc++) {
            const tc = hex.c + dc;
            const tr = hex.r + dr;
            if (tc >= 0 && tc < GRID_WIDTH && tr >= 0 && tr < GRID_HEIGHT) {
              const k = `${tc},${tr}`;
              if (gridOwnership[k] !== bot.username) {
                const pix = hexToPixel(tc, tr);
                const d = Math.hypot(pix.x - bot.x, pix.y - bot.y);
                if (d < closestDist) {
                  closestDist = d;
                  targetX = pix.x;
                  targetY = pix.y;
                }
              }
            }
          }
        }
      } else {
        // Outside territory drawing tail
        if (bot.tail.length < 12) {
          // Keep wandering away, find next unclaimed hex in front of bot
          const fx = bot.x + Math.cos(bot.angle) * 80;
          const fy = bot.y + Math.sin(bot.angle) * 80;
          targetX = Math.max(20, Math.min(MAP_WIDTH - 20, fx));
          targetY = Math.max(20, Math.min(MAP_HEIGHT - 20, fy));
        } else {
          // Tail is too long! Return to base!
          let closestDist = Infinity;
          bot.territory.forEach(k => {
            const parts = k.split(',');
            const tc = parseInt(parts[0]);
            const tr = parseInt(parts[1]);
            const pix = hexToPixel(tc, tr);
            const d = Math.hypot(pix.x - bot.x, pix.y - bot.y);
            if (d < closestDist) {
              closestDist = d;
              targetX = pix.x;
              targetY = pix.y;
            }
          });
        }
      }

      // Check if another player's tail is nearby, and steer to cut it!
      for (const other of playersMap.values()) {
        if (other.username !== bot.username && !other.isDead && other.tail.length > 3) {
          const firstTailKey = other.tail[other.tail.length - 1];
          const parts = firstTailKey.split(',');
          const tc = parseInt(parts[0]);
          const tr = parseInt(parts[1]);
          const pix = hexToPixel(tc, tr);
          const d = Math.hypot(pix.x - bot.x, pix.y - bot.y);
          if (d < 80) { // Chase zone
            targetX = pix.x;
            targetY = pix.y;
          }
        }
      }

      // Calculate steer angle
      let angle = Math.atan2(targetY - bot.y, targetX - bot.x);

      // Avoid own tail collision check (look ahead 3 steps)
      const lookAhead = 25;
      const ax = bot.x + Math.cos(angle) * lookAhead;
      const ay = bot.y + Math.sin(angle) * lookAhead;
      const aheadHex = pixelToHex(ax, ay);
      const aheadKey = `${aheadHex.c},${aheadHex.r}`;

      if (bot.tailSet.has(aheadKey)) {
        // Safe redirect
        angle += Math.PI / 2;
      }

      // Compute speed dynamically based on totems and slowing aura
      const baseSpeed = 2.8;
      let currentSpeed = hasTotem(bot.username, 'speed') ? baseSpeed + 1.0 : baseSpeed;

      // Slowing aura check
      let isBotSlowed = false;
      for (const other of playersMap.values()) {
        if (other.username !== bot.username && !other.isDead && hasTotem(other.username, 'slowing')) {
          const dist = Math.hypot(bot.x - other.x, bot.y - other.y);
          if (dist < 150) {
            isBotSlowed = true;
            break;
          }
        }
      }
      bot.speed = isBotSlowed ? currentSpeed * 0.5 : currentSpeed;

      bot.angle = angle;
      bot.x += Math.cos(angle) * bot.speed;
      bot.y += Math.sin(angle) * bot.speed;

      // Map bounds safe turn back
      if (bot.x < 30 || bot.x > MAP_WIDTH - 30 || bot.y < 30 || bot.y > MAP_HEIGHT - 30) {
        bot.angle = Math.atan2(MAP_HEIGHT / 2 - bot.y, MAP_WIDTH / 2 - bot.x);
        bot.x += Math.cos(bot.angle) * bot.speed;
        bot.y += Math.sin(bot.angle) * bot.speed;
      }

      // Broadcast bot position update
      window.GamingHubSync.sendHexanautUpdate(bot.x, bot.y, Math.cos(bot.angle)*bot.speed, Math.sin(bot.angle)*bot.speed, bot.angle, bot.tail, bot.username);
    }
  }

  // Helper to broadcast bot events over BroadcastChannel
  function postMessageForBot(type, botName, data) {
    if (window.GamingHubSync && typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('gaming_hub_network_channel');
      channel.postMessage({
        type,
        sender: botName,
        timestamp: Date.now(),
        data
      });
      channel.close();
    }
  }

  // Render the Arena on Canvas
  function renderGame() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);

    const viewLeft = camera.x - canvas.width / 2 - hexWidth;
    const viewRight = camera.x + canvas.width / 2 + hexWidth;
    const viewTop = camera.y - canvas.height / 2 - hexHeight;
    const viewBottom = camera.y + canvas.height / 2 + hexHeight;

    ctx.lineWidth = 1;
    for (let r = 0; r < GRID_HEIGHT; r++) {
      for (let c = 0; c < GRID_WIDTH; c++) {
        const cx = c * hexWidth + (r % 2 === 0 ? hexWidth / 2 : hexWidth);
        const cy = r * spacingY + hexHeight / 2;

        if (cx < viewLeft || cx > viewRight || cy < viewTop || cy > viewBottom) {
          continue;
        }

        const owner = gridOwnership[`${c},${r}`];
        if (owner) {
          const player = playersMap.get(owner);
          if (player) {
            ctx.fillStyle = player.color + '4D'; // 30% transparency
            ctx.strokeStyle = player.color + '26'; // 15% opacity outline
            drawHexagon(cx, cy, HEX_SIZE, true, true);
          }
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          drawHexagon(cx, cy, HEX_SIZE, false, true);
        }
      }
    }

    // Draw Totems
    totemsList.forEach(totem => {
      const pix = hexToPixel(totem.c, totem.r);
      if (pix.x < viewLeft || pix.x > viewRight || pix.y < viewTop || pix.y > viewBottom) return;

      // Draw outer glowing aura if owned
      if (totem.owner) {
        const ownerPlayer = playersMap.get(totem.owner);
        if (ownerPlayer) {
          ctx.save();
          ctx.shadowColor = ownerPlayer.color;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = ownerPlayer.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(pix.x, pix.y, 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw main totem circle
      ctx.fillStyle = totem.owner && playersMap.has(totem.owner) ? playersMap.get(totem.owner).color : '#334155';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pix.x, pix.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw label icon
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(totem.label, pix.x, pix.y);

      // Draw totem label name above it
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(totem.name, pix.x, pix.y - 24);
    });

    // Draw Slowing Aura
    for (const player of playersMap.values()) {
      if (player.isDead) continue;
      if (hasTotem(player.username, 'slowing')) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 150, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw active tails
    for (const player of playersMap.values()) {
      if (player.isDead || player.tail.length === 0) continue;

      ctx.strokeStyle = player.color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const pFirst = hexToPixel(parseInt(player.tail[0].split(',')[0]), parseInt(player.tail[0].split(',')[1]));
      ctx.moveTo(pFirst.x, pFirst.y);

      for (let i = 1; i < player.tail.length; i++) {
        const pNode = hexToPixel(parseInt(player.tail[i].split(',')[0]), parseInt(player.tail[i].split(',')[1]));
        ctx.lineTo(pNode.x, pNode.y);
      }
      ctx.lineTo(player.x, player.y);
      ctx.stroke();
    }

    // Draw player characters
    for (const player of playersMap.values()) {
      if (player.isDead) continue;

      // Draw shield aura if active
      if (player.spawnShieldTime && Date.now() < player.spawnShieldTime) {
        ctx.save();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'; // bright blue
        ctx.shadowColor = 'rgba(59, 130, 246, 0.9)';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 17, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = player.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(player.angle) * 14, player.y + Math.sin(player.angle) * 14);
      ctx.lineTo(player.x + Math.cos(player.angle + 2.3) * 6, player.y + Math.sin(player.angle + 2.3) * 6);
      ctx.lineTo(player.x + Math.cos(player.angle - 2.3) * 6, player.y + Math.sin(player.angle - 2.3) * 6);
      ctx.closePath();
      ctx.fill();

      // Render Skin Emojis
      if (player.skin === 'king') {
        ctx.save();
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', player.x, player.y - 12);
        ctx.restore();
      } else if (player.skin === 'ninja') {
        ctx.save();
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🥷', player.x, player.y - 1);
        ctx.restore();
      } else if (player.skin === 'alien') {
        ctx.save();
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👽', player.x, player.y - 1);
        ctx.restore();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(player.username, player.x, player.y - 18);
      ctx.shadowBlur = 0;
    }

    // Spy Dish off-screen indicators
    const spyIndicators = [];
    if (localPlayer && !localPlayer.isDead && hasTotem(localPlayer.username, 'spy')) {
      for (const other of playersMap.values()) {
        if (other.username !== localPlayer.username && !other.isDead) {
          const dx = other.x - camera.x;
          const dy = other.y - camera.y;
          const halfW = canvas.width / 2;
          const halfH = canvas.height / 2;
          if (Math.abs(dx) > halfW - 20 || Math.abs(dy) > halfH - 20) {
            const angle = Math.atan2(dy, dx);
            spyIndicators.push({ angle, color: other.color, username: other.username });
          }
        }
      }
    }

    // Draw boundaries
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    ctx.restore();

    // Render Spy Dish screen indicators
    spyIndicators.forEach(ind => {
      const halfW = canvas.width / 2;
      const halfH = canvas.height / 2;
      const borderDistX = halfW - 40;
      const borderDistY = halfH - 40;
      
      const uX = Math.cos(ind.angle);
      const uY = Math.sin(ind.angle);
      
      let edgeX = 0;
      let edgeY = 0;
      if (Math.abs(uX * borderDistY) > Math.abs(uY * borderDistX)) {
        edgeX = Math.sign(uX) * borderDistX;
        edgeY = edgeX * (uY / uX);
      } else {
        edgeY = Math.sign(uY) * borderDistY;
        edgeX = edgeY * (uX / uY);
      }
      
      const x = edgeX + halfW;
      const y = edgeY + halfH;
      
      ctx.fillStyle = ind.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + uX * 12, y + uY * 12);
      ctx.lineTo(x + Math.cos(ind.angle + 2.3) * 6, y + Math.sin(ind.angle + 2.3) * 6);
      ctx.lineTo(x + Math.cos(ind.angle - 2.3) * 6, y + Math.sin(ind.angle - 2.3) * 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ind.username.substring(0, 4), x, y - 8);
    });
  }

  function drawHexagon(x, y, size, fill = false, stroke = true) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle));
    }
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // Draw Minimap
  function renderMinimap() {
    if (!minimapCtx || !minimapCanvas) return;

    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const scale = minimapCanvas.width / MAP_WIDTH;

    for (let r = 0; r < GRID_HEIGHT; r += 2) {
      for (let c = 0; c < GRID_WIDTH; c += 2) {
        const owner = gridOwnership[`${c},${r}`];
        if (owner) {
          const player = playersMap.get(owner);
          if (player) {
            const pix = hexToPixel(c, r);
            minimapCtx.fillStyle = player.color;
            minimapCtx.fillRect(pix.x * scale, pix.y * scale, 3.5, 3.5);
          }
        }
      }
    }

    // Draw Totems on minimap
    totemsList.forEach(totem => {
      const pix = hexToPixel(totem.c, totem.r);
      minimapCtx.fillStyle = totem.color;
      minimapCtx.strokeStyle = '#ffffff';
      minimapCtx.lineWidth = 1;
      minimapCtx.beginPath();
      minimapCtx.arc(pix.x * scale, pix.y * scale, 3.5, 0, Math.PI * 2);
      minimapCtx.fill();
      minimapCtx.stroke();
    });

    for (const player of playersMap.values()) {
      if (player.isDead) continue;
      minimapCtx.fillStyle = player === localPlayer ? '#ffffff' : '#ef4444';
      minimapCtx.beginPath();
      minimapCtx.arc(player.x * scale, player.y * scale, 3, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  }

  // Update territory percentage
  function updateHUDStats() {
    if (!localPlayer) return;

    const totalTiles = GRID_WIDTH * GRID_HEIGHT;
    const ownTiles = localPlayer.territory.size;
    const percent = (ownTiles / totalTiles) * 100;
    
    localPlayer.maxPercentCaptured = Math.max(localPlayer.maxPercentCaptured || 0, percent);

    const percentEl = document.getElementById('hex-hud-territory-percent');
    if (percentEl) percentEl.innerText = `${percent.toFixed(1)}%`;

    const killsEl = document.getElementById('hex-hud-kills');
    if (killsEl) killsEl.innerText = localPlayer.kills;
  }

  // Top 10 leaderboard
  function updateHUDLeaderboard() {
    const listEl = document.getElementById('hex-hud-leaderboard-list');
    if (!listEl) return;

    const totalTiles = GRID_WIDTH * GRID_HEIGHT;
    const list = Array.from(playersMap.values())
      .map(p => ({
        username: p.username,
        color: p.color,
        percent: (p.territory.size / totalTiles) * 100
      }));

    list.sort((a, b) => b.percent - a.percent);

    listEl.innerHTML = '';
    list.slice(0, 8).forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = `hud-leaderboard-row ${p.username === localPlayer?.username ? 'self' : ''}`;
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:5px;">
          <span style="color: ${p.color}; font-weight:bold;">•</span>
          <span style="max-width: 90px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${idx+1}. ${p.username}</span>
        </div>
        <span>${p.percent.toFixed(1)}%</span>
      `;
      listEl.appendChild(row);
    });
  }

  function addKillFeedMessage(message) {
    const feedEl = document.getElementById('hex-kill-feed');
    if (!feedEl) return;

    const item = document.createElement('div');
    item.className = 'hex-kill-item';
    item.innerText = message;
    feedEl.appendChild(item);

    setTimeout(() => {
      item.style.transition = 'opacity 0.5s ease';
      item.style.opacity = '0';
      setTimeout(() => item.remove(), 500);
    }, 4000);
  }

  function endGame(won) {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    if (canvas) {
      canvas.removeEventListener('mousemove', handleMouseMove);
    }
  }

  // Export engine
  window.GamingHubHexanaut = {
    startGame,
    endGame,
    updateEnemyPlayer,
    captureEnemyTerritory,
    handlePlayerKillEvent,
    respawnPlayer,
    spawnNewJoinedPlayer,
    generateSpawnPoints,
    handleEnemyRespawn,
    getGridOwnership: () => gridOwnership,
    getPlayersMap: () => playersMap,
    getTotemsList: () => totemsList,
    getHexanautState: () => ({ username: hexanautUsername, timeLeft: hexanautTimeLeft })
  };
})();
