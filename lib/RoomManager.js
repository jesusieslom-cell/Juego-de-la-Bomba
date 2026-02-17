class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(socketId, name, token) {
    const code = this.generateCode();
    const room = {
      code,
      hostId: socketId,
      state: 'LOBBY',
      settings: {
        livesInitial: 3,
        timeMin: 5,
        timeMax: 15,
        minWordLen: 2,
        fragLen: 'random',
        noRepeat: true
      },
      players: [{
        id: socketId,
        name,
        token,
        livesLeft: 3,
        ready: false,
        connected: true,
        eliminated: false,
        isSpectator: false
      }],
      spectators: [],
      currentTurn: null,
      usedWords: new Set(),
      recentFragments: [],
      acceptedWords: [],
      turnTimer: null,
      disconnectTimers: {}
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code) || null;
  }

  deleteRoom(code) {
    const room = this.rooms.get(code);
    if (room && room.turnTimer) clearTimeout(room.turnTimer);
    this.rooms.delete(code);
  }

  findPlayerByToken(roomCode, token) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return room.players.find(p => p.token === token) ||
           room.spectators.find(p => p.token === token) ||
           null;
  }

  joinRoom(roomCode, socketId, name, token) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Sala no encontrada' };

    // Check if already in room
    const existing = this.findPlayerByToken(roomCode, token);
    if (existing) {
      existing.id = socketId;
      existing.connected = true;
      existing.name = name;
      return { player: existing };
    }

    // Check max players (16)
    if (room.players.length + room.spectators.length >= 16) {
      return { error: 'Sala llena (máximo 16 jugadores)' };
    }

    const newPlayer = {
      id: socketId,
      name,
      token,
      livesLeft: room.settings.livesInitial,
      ready: false,
      connected: true,
      eliminated: false,
      isSpectator: false
    };

    if (room.state === 'IN_GAME' || room.state === 'GAME_OVER') {
      // Join as spectator
      newPlayer.isSpectator = true;
      room.spectators.push(newPlayer);
    } else {
      room.players.push(newPlayer);
    }

    return { player: newPlayer };
  }
}

module.exports = RoomManager;
