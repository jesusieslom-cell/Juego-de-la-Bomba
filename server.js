const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./lib/RoomManager');
const Dictionary = require('./lib/Dictionary');
const FragmentGenerator = require('./lib/FragmentGenerator');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize dictionary
const dictionary = new Dictionary();
dictionary.load();

// Initialize fragment generator
const fragmentGen = new FragmentGenerator(dictionary);
fragmentGen.load();

// Room manager
const roomManager = new RoomManager();

// Rate limiting map: socketId -> { count, resetAt }
const rateLimits = new Map();

function checkRateLimit(socketId, limit, windowMs) {
  const now = Date.now();
  let entry = rateLimits.get(socketId);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimits.set(socketId, entry);
  }
  entry.count++;
  return entry.count <= limit;
}

// ─── SOCKET.IO ──────────────────

io.on('connection', (socket) => {
  let playerRoomCode = null;
  let playerToken = null;

  socket.on('room:create', (data) => {
    const { name, token } = data;
    if (!name || !token) {
      socket.emit('room:error', { message: 'Nombre y token requeridos' });
      return;
    }
    playerToken = token;
    const room = roomManager.createRoom(socket.id, name, token);
    playerRoomCode = room.code;
    socket.join(room.code);
    emitSnapshot(room.code);
  });

  socket.on('room:join', (data) => {
    const { roomCode, name, token } = data;
    if (!roomCode || !name || !token) {
      socket.emit('room:error', { message: 'Código, nombre y token requeridos' });
      return;
    }
    playerToken = token;
    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit('room:error', { message: 'Sala no encontrada: ' + roomCode });
      return;
    }

    // Check if reconnecting
    const existing = roomManager.findPlayerByToken(roomCode, token);
    if (existing) {
      // Reconnect
      existing.id = socket.id;
      existing.connected = true;
      existing.name = name;
      playerRoomCode = roomCode;
      socket.join(roomCode);
      emitSnapshot(roomCode);

      // If game in progress and it was their turn and disconnected, cancel grace timer
      if (room.disconnectTimers && room.disconnectTimers[token]) {
        clearTimeout(room.disconnectTimers[token]);
        delete room.disconnectTimers[token];
      }
      return;
    }

    // New player joining
    const result = roomManager.joinRoom(roomCode, socket.id, name, token);
    if (result.error) {
      socket.emit('room:error', { message: result.error });
      return;
    }
    playerRoomCode = roomCode;
    socket.join(roomCode);
    emitSnapshot(roomCode);

    // Announce
    io.to(roomCode).emit('chat:message', {
      playerName: '🔔 Sistema',
      message: `${name} se ha unido`,
      ts: Date.now()
    });
  });

  socket.on('room:leave', () => {
    if (!playerRoomCode) return;
    handleLeave(socket, playerRoomCode, playerToken);
    socket.leave(playerRoomCode);
    playerRoomCode = null;
  });

  socket.on('player:ready', (data) => {
    if (!playerRoomCode) return;
    const room = roomManager.getRoom(playerRoomCode);
    if (!room || room.state !== 'LOBBY') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    player.ready = !!data.ready;
    emitSnapshot(playerRoomCode);
  });

  socket.on('settings:update', (data) => {
    if (!playerRoomCode) return;
    const room = roomManager.getRoom(playerRoomCode);
    if (!room || room.state !== 'LOBBY') return;
    if (room.hostId !== socket.id) return;
    const s = data.settings;
    if (s) {
      room.settings.livesInitial = clamp(parseInt(s.livesInitial) || 3, 1, 10);
      room.settings.timeMin = clamp(parseInt(s.timeMin) || 5, 3, 30);
      room.settings.timeMax = clamp(parseInt(s.timeMax) || 15, 5, 60);
      if (room.settings.timeMax < room.settings.timeMin) room.settings.timeMax = room.settings.timeMin + 2;
      room.settings.minWordLen = clamp(parseInt(s.minWordLen) || 2, 2, 10);
      room.settings.fragLen = ['2','3','4','random'].includes(s.fragLen) ? s.fragLen : 'random';
      room.settings.noRepeat = s.noRepeat !== false && s.noRepeat !== 'false';
    }
    emitSnapshot(playerRoomCode);
  });

  socket.on('game:start', () => {
    if (!playerRoomCode) return;
    const room = roomManager.getRoom(playerRoomCode);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.state !== 'LOBBY' && room.state !== 'GAME_OVER') return;

    // Need at least 2 players
    const totalPlayers = room.players.length + room.spectators.length;
    if (totalPlayers < 2) {
      socket.emit('room:error', { message: 'Se necesitan al menos 2 jugadores' });
      return;
    }

    startGame(playerRoomCode);
  });

  socket.on('game:submitWord', (data) => {
    if (!playerRoomCode || !data || !data.word) return;
    if (!checkRateLimit(socket.id, 5, 1000)) return;

    const room = roomManager.getRoom(playerRoomCode);
    if (!room || room.state !== 'IN_GAME') return;

    const turn = room.currentTurn;
    if (!turn || turn.playerId !== socket.id) {
      socket.emit('game:wordRejected', { reason: 'NOT_YOUR_TURN' });
      return;
    }

    // Check time
    const elapsed = Date.now() - turn.startedAt;
    if (elapsed > turn.durationMs + 500) { // 500ms grace
      socket.emit('game:wordRejected', { reason: 'TIME_OVER' });
      return;
    }

    const result = validateWord(data.word, room);
    if (!result.valid) {
      socket.emit('game:wordRejected', { reason: result.reason });
      return;
    }

    // Word accepted!
    const player = room.players.find(p => p.id === socket.id);
    const playerName = player ? player.name : 'Desconocido';

    if (room.settings.noRepeat) {
      room.usedWords.add(result.normalized);
    }
    if (!room.acceptedWords) room.acceptedWords = [];
    room.acceptedWords.push({ playerName, word: result.normalized });

    io.to(playerRoomCode).emit('game:wordAccepted', {
      playerId: socket.id,
      playerName,
      word: result.normalized
    });

    // Clear explosion timer
    if (room.turnTimer) {
      clearTimeout(room.turnTimer);
      room.turnTimer = null;
    }

    // Next turn
    nextTurn(playerRoomCode, socket.id);
  });

  socket.on('game:typing', (data) => {
    if (!playerRoomCode) return;
    const room = roomManager.getRoom(playerRoomCode);
    if (!room || room.state !== 'IN_GAME') return;
    if (!room.currentTurn || room.currentTurn.playerId !== socket.id) return;

    const player = room.players.find(p => p.id === socket.id);
    socket.to(playerRoomCode).emit('player:typing', {
      playerId: socket.id,
      playerName: player ? player.name : '',
      text: String(data.text || '').substring(0, 40)
    });
  });

  socket.on('chat:send', (data) => {
    if (!playerRoomCode || !data || !data.message) return;
    const room = roomManager.getRoom(playerRoomCode);
    if (!room) return;
    const allPlayers = [...room.players, ...room.spectators];
    const player = allPlayers.find(p => p.id === socket.id);
    if (!player) return;

    io.to(playerRoomCode).emit('chat:message', {
      playerName: player.name,
      message: String(data.message).substring(0, 200),
      ts: Date.now()
    });
  });

  socket.on('room:backToLobby', () => {
    if (!playerRoomCode) return;
    const room = roomManager.getRoom(playerRoomCode);
    if (!room) return;
    // Anyone can request back to lobby, but only process if game is over or host requests
    if (room.state === 'GAME_OVER' || room.hostId === socket.id) {
      room.state = 'LOBBY';
      // Move spectators to players
      room.spectators.forEach(s => {
        s.isSpectator = false;
        s.ready = false;
        room.players.push(s);
      });
      room.spectators = [];
      room.players.forEach(p => {
        p.ready = false;
        p.eliminated = false;
        p.livesLeft = room.settings.livesInitial;
      });
      room.acceptedWords = [];
      if (room.turnTimer) clearTimeout(room.turnTimer);
      room.turnTimer = null;
      room.currentTurn = null;
      emitSnapshot(playerRoomCode);
    }
  });

  socket.on('disconnect', () => {
    if (!playerRoomCode) return;
    handleDisconnect(socket, playerRoomCode, playerToken);
  });
});

// ─── GAME LOGIC ─────────────────

function startGame(roomCode) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  // Move spectators to players
  room.spectators.forEach(s => {
    s.isSpectator = false;
    s.ready = false;
    room.players.push(s);
  });
  room.spectators = [];

  // Reset
  room.state = 'IN_GAME';
  room.usedWords = new Set();
  room.recentFragments = [];
  room.acceptedWords = [];
  room.players.forEach(p => {
    p.livesLeft = room.settings.livesInitial;
    p.eliminated = false;
    p.ready = false;
  });
  if (!room.disconnectTimers) room.disconnectTimers = {};

  emitSnapshot(roomCode);

  // Pick random starting player
  const alivePlayers = room.players.filter(p => !p.eliminated);
  const startPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  startTurn(roomCode, startPlayer.id);
}

function startTurn(roomCode, playerId) {
  const room = roomManager.getRoom(roomCode);
  if (!room || room.state !== 'IN_GAME') return;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  // Generate fragment
  const fragLen = getFragmentLength(room.settings.fragLen);
  const fragment = fragmentGen.getFragment(fragLen, room.recentFragments);
  room.recentFragments.push(fragment);
  if (room.recentFragments.length > 20) room.recentFragments.shift();

  // Random duration
  const timeMin = room.settings.timeMin * 1000;
  const timeMax = room.settings.timeMax * 1000;
  const durationMs = timeMin + Math.floor(Math.random() * (timeMax - timeMin + 1));

  const now = Date.now();
  room.currentTurn = {
    playerId,
    playerName: player.name,
    fragment,
    durationMs,
    startedAt: now
  };

  io.to(roomCode).emit('game:turnStarted', {
    playerId,
    playerName: player.name,
    fragment,
    durationMs,
    serverNow: now,
    startedAt: now
  });

  // Set explosion timer
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.turnTimer = setTimeout(() => {
    handleExplosion(roomCode, playerId);
  }, durationMs);
}

function handleExplosion(roomCode, playerId) {
  const room = roomManager.getRoom(roomCode);
  if (!room || room.state !== 'IN_GAME') return;

  const player = room.players.find(p => p.id === playerId);
  if (!player || player.eliminated) return;

  player.livesLeft--;

  io.to(roomCode).emit('game:playerExploded', {
    playerId,
    playerName: player.name,
    livesLeft: player.livesLeft
  });

  if (player.livesLeft <= 0) {
    player.eliminated = true;
    io.to(roomCode).emit('game:playerEliminated', {
      playerId,
      playerName: player.name
    });
  }

  // Check game over
  const alivePlayers = room.players.filter(p => !p.eliminated);
  if (alivePlayers.length <= 1) {
    room.state = 'GAME_OVER';
    if (room.turnTimer) clearTimeout(room.turnTimer);
    room.turnTimer = null;
    const winner = alivePlayers[0];
    io.to(roomCode).emit('game:gameOver', {
      winnerId: winner ? winner.id : null,
      winnerName: winner ? winner.name : 'Nadie'
    });
    return;
  }

  // Next turn (exclude exploded player if possible)
  nextTurn(roomCode, playerId);
}

function nextTurn(roomCode, excludePlayerId) {
  const room = roomManager.getRoom(roomCode);
  if (!room || room.state !== 'IN_GAME') return;

  const alivePlayers = room.players.filter(p => !p.eliminated);
  if (alivePlayers.length <= 1) {
    room.state = 'GAME_OVER';
    if (room.turnTimer) clearTimeout(room.turnTimer);
    const winner = alivePlayers[0];
    io.to(roomCode).emit('game:gameOver', {
      winnerId: winner ? winner.id : null,
      winnerName: winner ? winner.name : 'Nadie'
    });
    return;
  }

  // Pick next player (random, excluding current)
  let candidates = alivePlayers.filter(p => p.id !== excludePlayerId);
  if (candidates.length === 0) candidates = alivePlayers;
  const nextPlayer = candidates[Math.floor(Math.random() * candidates.length)];

  setTimeout(() => {
    startTurn(roomCode, nextPlayer.id);
  }, 300);
}

function getFragmentLength(setting) {
  if (setting === 'random') {
    // Weighted: 20% len 2, 60% len 3, 20% len 4
    const r = Math.random();
    if (r < 0.2) return 2;
    if (r < 0.8) return 3;
    return 4;
  }
  return parseInt(setting) || 3;
}

function normalizeWord(word) {
  let w = word.trim().toLowerCase();
  // Remove accents except ñ
  w = w.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
       .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');
  // Keep only a-z and ñ
  w = w.replace(/[^a-zñ]/g, '');
  return w;
}

function validateWord(word, room) {
  const normalized = normalizeWord(word);
  const fragment = room.currentTurn.fragment;

  // Min length
  if (normalized.length < room.settings.minWordLen) {
    return { valid: false, reason: 'TOO_SHORT' };
  }

  // Must contain fragment
  if (!normalized.includes(fragment)) {
    return { valid: false, reason: 'MISSING_FRAGMENT' };
  }

  // Must be in dictionary
  if (!dictionary.has(normalized)) {
    return { valid: false, reason: 'NOT_IN_DICTIONARY' };
  }

  // No repeat
  if (room.settings.noRepeat && room.usedWords.has(normalized)) {
    return { valid: false, reason: 'ALREADY_USED' };
  }

  return { valid: true, normalized };
}

function handleLeave(socket, roomCode, token) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const player = roomManager.findPlayerByToken(roomCode, token) ||
                 room.players.find(p => p.id === socket.id) ||
                 room.spectators.find(p => p.id === socket.id);

  if (!player) return;
  const playerName = player.name;

  // Remove from players/spectators
  room.players = room.players.filter(p => p.token !== player.token && p.id !== socket.id);
  room.spectators = room.spectators.filter(p => p.token !== player.token && p.id !== socket.id);

  io.to(roomCode).emit('chat:message', {
    playerName: '🔔 Sistema',
    message: `${playerName} salió de la sala`,
    ts: Date.now()
  });

  // If host left, assign new host
  if (room.hostId === socket.id || room.hostId === player.id) {
    const allP = [...room.players, ...room.spectators];
    if (allP.length > 0) {
      room.hostId = allP[0].id;
    }
  }

  // If no players left, delete room
  if (room.players.length === 0 && room.spectators.length === 0) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    roomManager.deleteRoom(roomCode);
    return;
  }

  // If game in progress and was their turn
  if (room.state === 'IN_GAME' && room.currentTurn && room.currentTurn.playerId === socket.id) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    handleExplosion(roomCode, socket.id);
  }

  // Check if only 1 alive player remains in game
  if (room.state === 'IN_GAME') {
    const alivePlayers = room.players.filter(p => !p.eliminated);
    if (alivePlayers.length <= 1) {
      room.state = 'GAME_OVER';
      if (room.turnTimer) clearTimeout(room.turnTimer);
      const winner = alivePlayers[0];
      io.to(roomCode).emit('game:gameOver', {
        winnerId: winner ? winner.id : null,
        winnerName: winner ? winner.name : 'Nadie'
      });
      return;
    }
  }

  emitSnapshot(roomCode);
}

function handleDisconnect(socket, roomCode, token) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const player = roomManager.findPlayerByToken(roomCode, token) ||
                 room.players.find(p => p.id === socket.id) ||
                 room.spectators.find(p => p.id === socket.id);

  if (player) {
    player.connected = false;
  }

  // If in game and is their turn, give 2s grace period
  if (room.state === 'IN_GAME' && room.currentTurn && room.currentTurn.playerId === socket.id) {
    if (!room.disconnectTimers) room.disconnectTimers = {};
    const pToken = token || socket.id;
    room.disconnectTimers[pToken] = setTimeout(() => {
      // Still disconnected? Explode
      if (player && !player.connected) {
        if (room.turnTimer) clearTimeout(room.turnTimer);
        handleExplosion(roomCode, player.id);
      }
      delete room.disconnectTimers[pToken];
    }, 2000);
  }

  // In lobby, remove after 30s if still disconnected
  if (room.state === 'LOBBY') {
    setTimeout(() => {
      if (player && !player.connected) {
        handleLeave(socket, roomCode, token);
      }
    }, 30000);
  }
}

function emitSnapshot(roomCode) {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const snapshot = {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    settings: room.settings,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      livesLeft: p.livesLeft,
      ready: p.ready,
      connected: p.connected,
      eliminated: p.eliminated,
      isSpectator: false,
      token: p.token
    })),
    spectators: room.spectators.map(p => ({
      id: p.id,
      name: p.name,
      livesLeft: 0,
      ready: false,
      connected: p.connected,
      eliminated: false,
      isSpectator: true,
      token: p.token
    })),
    currentTurn: room.currentTurn ? {
      playerId: room.currentTurn.playerId,
      fragment: room.currentTurn.fragment,
      durationMs: room.currentTurn.durationMs,
      startedAt: room.currentTurn.startedAt
    } : null,
    acceptedWords: room.acceptedWords || []
  };

  io.to(roomCode).emit('room:snapshot', snapshot);
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

// ─── START SERVER ──────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 Juego de la Bomba - Servidor corriendo en http://localhost:${PORT}\n`);
});
