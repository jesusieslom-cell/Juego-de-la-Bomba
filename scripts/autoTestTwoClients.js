const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

function normalize(word) {
  let w = String(word || '').trim().toLowerCase();
  w = w.replace(/á/g, 'a').nreplace ? w : w; // defensive
  w = w.replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');
  w = w.replace(/[^a-zñ]/g, '');
  return w;
}

// Robust normalize without accidental typo
function norm(word) {
  return String(word || '').trim().toLowerCase()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u')
    .replace(/[^a-zñ]/g, '');
}

const dictPath = path.join(__dirname, '..', 'data', 'spanish_words.txt');
let words = [];
if (fs.existsSync(dictPath)) {
  words = fs.readFileSync(dictPath, 'utf8').split(/\r?\n/).map(norm).filter(Boolean);
  console.log('Loaded dictionary words:', words.length);
} else {
  console.log('No spanish_words.txt found, test will be limited');
}

function findWordContaining(fragment, minLen = 2) {
  const f = norm(fragment);
  if (!f) return null;
  for (const w of words) {
    if (w.length >= minLen && w.includes(f)) return w;
  }
  return null;
}

const SERVER = 'http://localhost:3000';

function genToken() { return 'tok_' + Math.random().toString(36).slice(2, 10); }

async function runTest() {
  return new Promise((resolve) => {
    const token1 = genToken();
    const token2 = genToken();
    const host = io(SERVER, { reconnection: false });
    const client = io(SERVER, { reconnection: false });
    let roomCode = null;
    let started = false;
    let steps = [];

    function log(...a) { console.log('[TEST]', ...a); }

    host.on('connect', () => {
      log('Host connected', host.id);
      host.emit('room:create', { name: 'Host', token: token1 });
    });

    client.on('connect', () => {
      log('Client connected', client.id);
    });

    host.on('room:snapshot', (room) => {
      if (!roomCode) roomCode = room.code;
      log('Host snapshot state=', room.state, 'players=', room.players.length);
      // Once snapshot shows host in room, instruct client to join
      if (room.players && room.players.find(p => p.token === token1) && !room.players.find(p => p.token === token2)) {
        log('Client joining room', room.code);
        client.emit('room:join', { roomCode: room.code, name: 'Player2', token: token2 });
      }
      // When both joined, start game
      const hasBoth = room.players && room.players.find(p => p.token === token1) && room.players.find(p => p.token === token2);
      if (hasBoth && !started) {
        started = true;
        setTimeout(() => { host.emit('game:start'); }, 300);
      }
    });

    client.on('room:snapshot', (room) => {
      log('Client snapshot state=', room.state, 'players=', room.players.length);
    });

    function trySubmit(socket, sid) {
      const room = { /* no direct access */ };
      // We'll rely on listening to game:turnStarted instead
    }

    function setupSubmission(socket, name) {
      socket.on('game:turnStarted', (data) => {
        log(`${name} sees turn for`, data.playerId, 'fragment=', data.fragment);
        if (data.playerId === socket.id) {
          // try find a word
          const candidate = findWordContaining(data.fragment, 2);
          if (candidate) {
            log(name, 'submitting', candidate);
            socket.emit('game:submitWord', { word: candidate });
          } else {
            log(name, 'no candidate found for fragment', data.fragment);
            // let timer expire
          }
        }
      });
    }

    setupSubmission(host, 'Host');
    setupSubmission(client, 'Client');

    // Log accepted/rejected
    [host, client].forEach((s, idx) => {
      s.on('game:wordAccepted', (d) => { log('wordAccepted:', d); });
      s.on('game:wordRejected', (d) => { log('wordRejected:', d); });
      s.on('game:playerExploded', (d) => { log('playerExploded:', d); });
      s.on('game:playerEliminated', (d) => { log('playerEliminated:', d); });
      s.on('game:gameOver', (d) => { log('gameOver:', d); });
    });

    // Timeout overall
    setTimeout(() => {
      log('Test timeout reached, disconnecting');
      host.disconnect(); client.disconnect();
      resolve();
    }, 30000);
  });
}

runTest().then(() => console.log('Test finished'));
