import express from 'express';
import http from 'http';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import { Server as SocketServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import { GameState, RoomSettings, Player, WordPack, GamePhase, RoomStats } from './src/types';
import { BUILT_IN_PACKS } from './src/wordPacks';
import { initDatabase, saveRoom, loadRoom, logMatch, cleanStaleRooms } from './db';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// Set up compression for fast bundle delivery
app.use(compression());

// Set up Helmet with cross-origin friendly production settings
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Body parser with size limits to prevent DDoS / malformed payload exploits
app.use(express.json({ limit: '15kb' }));

// Parse secure origins from environment variables to prevent cross-origin exploits
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().toLowerCase())
  : [];
if (process.env.APP_URL) allowedOrigins.push(process.env.APP_URL.trim().toLowerCase());
if (process.env.CLIENT_URL) allowedOrigins.push(process.env.CLIENT_URL.trim().toLowerCase());
if (process.env.VITE_API_URL) allowedOrigins.push(process.env.VITE_API_URL.trim().toLowerCase());

// Add default production and local domains
allowedOrigins.push('https://skyfallcustom.vercel.app');
allowedOrigins.push('https://skyfallcustom.onrender.com');
allowedOrigins.push('http://localhost:3000');
allowedOrigins.push('http://localhost:5173');
allowedOrigins.push('http://127.0.0.1:3000');
allowedOrigins.push('http://127.0.0.1:5173');

// Deduplicate and filter empty values
const cleanAllowedOrigins = Array.from(new Set(allowedOrigins.filter(Boolean)));

// Express CORS middleware applied to all endpoints
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    const lowerOrigin = origin.toLowerCase().trim();
    if (cleanAllowedOrigins.includes(lowerOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else {
    if (cleanAllowedOrigins.length > 0) {
      res.setHeader('Access-Control-Allow-Origin', cleanAllowedOrigins[0]);
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Dedicated health-check endpoint as required
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    roomsCount: rooms.size,
  });
});

// Room Validation Endpoint - never trust roomId from client
app.get('/api/room/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId.toUpperCase().trim();
    const room = await loadAndCacheRoom(roomId);
    if (!room) {
      return res.status(200).json({ exists: false });
    }
    const activeConnectedCount = room.players.filter(p => !p.isDev && p.isConnected).length;
    res.status(200).json({
      exists: true,
      roomId: room.roomId,
      phase: room.phase,
      isFull: activeConnectedCount >= room.settings.maxPlayers,
      settings: {
        roomName: room.settings.roomName,
        maxPlayers: room.settings.maxPlayers,
        allowSpectators: room.settings.allowSpectators
      }
    });
  } catch (err) {
    console.error('Error validating room:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dynamic SEO / Discord invite preview handler
app.get('/join/:roomId', async (req, res) => {
  const roomId = req.params.roomId.toUpperCase().trim();
  const distPath = path.join(process.cwd(), 'dist');
  let htmlPath = path.join(distPath, 'index.html');
  if (process.env.NODE_ENV !== 'production') {
    htmlPath = path.join(process.cwd(), 'index.html');
  }
  
  try {
    const room = await loadAndCacheRoom(roomId);
    let title = 'Join Room - Spyfall';
    let description = 'Join the ultimate social deduction game! Uncover the spy or blend in with the civilians.';
    
    if (room) {
      title = `Join ${room.settings.roomName} - Spyfall`;
      description = `You have been invited to join a game of Spyfall in room ${roomId}. Current phase: ${room.phase}. Click to play!`;
    } else {
      title = 'Room Not Found - Spyfall';
      description = 'This invite link is invalid or the room has expired.';
    }

    const fs = await import('fs');
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf8');
      const metaTags = `
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://skyfallcustom.vercel.app/join/${roomId}" />
  <meta property="og:image" content="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&auto=format&fit=crop&q=80" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
`;
      // Replace title and inject OG tags
      html = html.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
      html = html.replace('</head>', `${metaTags}</head>`);
      return res.send(html);
    }
  } catch (err) {
    console.error('Error generating Discord preview:', err);
  }
  res.sendFile(htmlPath);
});

// Setup Socket.IO with clean, secure allowed origins and transports
const io = new SocketServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const lowerOrigin = origin.toLowerCase().trim();
      if (cleanAllowedOrigins.includes(lowerOrigin)) {
        callback(null, true);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          console.warn(`Blocked Socket.IO connection from disallowed origin: ${origin}`);
          callback(new Error('Blocked by CORS policy'));
        }
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
  pingInterval: 10000,
  pingTimeout: 5000,
  allowEIO3: true, // legacy socket.io client compatibility
});

// In-Memory Database for rooms
const rooms = new Map<string, GameState & {
  timerInterval: NodeJS.Timeout | null;
  disconnectTimeouts: Map<string, NodeJS.Timeout>;
  // Server-only fields
  actualSpies: string[]; // list of spy player ids
  questionOrder: string[]; // list of player ids in order of asking
  currentQuestionIndex: number;
  votesMap: Map<string, string>; // voterId -> targetId
  readySet: Set<string>; // players ready for next phase
  forcedSpyPlayerIds?: string[];
  forcedSecretWord?: string;
}>();

// Generate unique room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Check if room code already exists
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

// Default room settings
const DEFAULT_SETTINGS: RoomSettings = {
  winningScore: 5,
  discussionTimer: 300, // 5 minutes default
  votingTimer: 60,
  spyGuessTimer: 45,
  numSpies: 1,
  maxPlayers: 12,
  isPrivate: false,
  roomName: 'Social Deduction Room',
  readyCheck: true,
  randomQuestionOrder: true,
  autoNextRound: false,
  hideVotesUntilReveal: true,
  allowSpectators: true,
  manualStart: false,
  activePacks: ['classic'],
  multiplePacksEnabled: false,
};

// Default stats
const DEFAULT_STATS: RoomStats = {
  gamesPlayed: 0,
  spyWins: 0,
  civilianWins: 0,
  mostCorrectVotes: [],
  highestAccuracy: 0,
};

// Create Bot-Hosted Room Endpoint
app.get('/api/create-bot-room', (req, res) => {
  try {
    const roomId = generateRoomCode();
    const botHostPlayer: Player = {
      id: 'P-bot-dot',
      name: '🤖 Agent Bot',
      isHost: true,
      isReady: true,
      score: 0,
      wins: 0,
      isConnected: true,
      votesReceived: 0,
      correctVotes: 0,
      totalVotesCast: 0,
    };

    rooms.set(roomId, {
      roomId,
      phase: 'LOBBY',
      players: [botHostPlayer],
      settings: { ...DEFAULT_SETTINGS, roomName: "🤖 Bot's Room", maxPlayers: 12 },
      currentRound: 0,
      timerValue: 0,
      secretWord: '',
      spies: [],
      customPacks: [],
      stats: { ...DEFAULT_STATS },
      timerInterval: null,
      disconnectTimeouts: new Map(),
      actualSpies: [],
      questionOrder: [],
      currentQuestionIndex: 0,
      votesMap: new Map(),
      readySet: new Set(),
    });

    // Save to DB (non-blocking)
    saveRoom(roomId, "🤖 Bot's Room", { ...DEFAULT_SETTINGS, roomName: "🤖 Bot's Room" }, { ...DEFAULT_STATS }, []).catch(err => {
      console.error(`Failed to save bot room ${roomId}:`, err);
    });

    console.log(`Bot room created via API: ${roomId}`);
    res.status(200).json({ success: true, roomId });
  } catch (err) {
    console.error('Error in create-bot-room endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/create-bot-room', (req, res) => {
  try {
    const roomId = generateRoomCode();
    const botHostPlayer: Player = {
      id: 'P-bot-dot',
      name: '🤖 Agent Bot',
      isHost: true,
      isReady: true,
      score: 0,
      wins: 0,
      isConnected: true,
      votesReceived: 0,
      correctVotes: 0,
      totalVotesCast: 0,
    };

    rooms.set(roomId, {
      roomId,
      phase: 'LOBBY',
      players: [botHostPlayer],
      settings: { ...DEFAULT_SETTINGS, roomName: "🤖 Bot's Room", maxPlayers: 12 },
      currentRound: 0,
      timerValue: 0,
      secretWord: '',
      spies: [],
      customPacks: [],
      stats: { ...DEFAULT_STATS },
      timerInterval: null,
      disconnectTimeouts: new Map(),
      actualSpies: [],
      questionOrder: [],
      currentQuestionIndex: 0,
      votesMap: new Map(),
      readySet: new Set(),
    });

    // Save to DB (non-blocking)
    saveRoom(roomId, "🤖 Bot's Room", { ...DEFAULT_SETTINGS, roomName: "🤖 Bot's Room" }, { ...DEFAULT_STATS }, []).catch(err => {
      console.error(`Failed to save bot room ${roomId}:`, err);
    });

    console.log(`Bot room created via API: ${roomId}`);
    res.status(200).json({ success: true, roomId });
  } catch (err) {
    console.error('Error in create-bot-room endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clean up disconnected player
function handleDisconnectGrace(roomId: string, playerId: string) {
  if (playerId === 'P-bot-dot') return;
  const room = rooms.get(roomId);
  if (!room) return;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return;

  player.isConnected = false;
  console.log(`Player ${player.name} (${playerId}) disconnected from room ${roomId}. Grace period started.`);

  // Broadcast player disconnected state
  broadcastState(roomId);

  // Set timeout to fully remove player / migrate host if they don't reconnect
  const timeout = setTimeout(() => {
    const r = rooms.get(roomId);
    if (!r) return;

    r.disconnectTimeouts.delete(playerId);
    r.players = r.players.filter(p => p.id !== playerId);
    console.log(`Player ${player.name} (${playerId}) removed from room ${roomId} after grace timeout.`);

    // If lobby is empty, destroy room
    if (r.players.filter(p => p.isConnected).length === 0) {
      if (r.timerInterval) clearInterval(r.timerInterval);
      rooms.delete(roomId);
      console.log(`Room ${roomId} destroyed because all players left.`);
      return;
    }

    // Host migration
    if (player.isHost) {
      const nextHost = r.players.find(p => p.isConnected && p.id !== 'P-bot-dot');
      if (nextHost) {
        nextHost.isHost = true;
        console.log(`Host migrated to ${nextHost.name} in room ${roomId}.`);
      }
    }

    // Clean up game status if phase is active
    if (r.phase !== 'LOBBY' && r.phase !== 'END_GAME') {
      // If we don't have enough players (e.g. less than 1) or if the spy left
      const activePlayers = r.players.filter(p => p.role !== 'spectator');
      const activeSpies = activePlayers.filter(p => r.actualSpies.includes(p.id));

      if (activePlayers.length < 1 || activeSpies.length === 0) {
        // Reset to lobby
        r.phase = 'LOBBY';
        if (r.timerInterval) clearInterval(r.timerInterval);
        r.timerInterval = null;
        r.players.forEach(p => {
          p.isReady = false;
          p.role = undefined;
          p.votedFor = null;
        });
        r.actualSpies = [];
        r.readySet.clear();
        io.to(roomId).emit('trigger_sfx', { type: 'defeat' });
      }
    }

    broadcastState(roomId);
  }, 15000); // 15 second grace period to reconnect

  room.disconnectTimeouts.set(playerId, timeout);
}

// Helper to automatically advance bot turn if active speaker
function checkAndAdvanceBotTurn(roomId: string) {
  const room = rooms.get(roomId);
  if (!room || room.phase !== 'DISCUSSION') return;
  const currentSpeakerId = room.questionOrder[room.currentQuestionIndex];
  if (currentSpeakerId === 'P-bot-dot') {
    setTimeout(() => {
      const r = rooms.get(roomId);
      if (!r || r.phase !== 'DISCUSSION') return;
      if (r.questionOrder[r.currentQuestionIndex] === 'P-bot-dot') {
        r.currentQuestionIndex = (r.currentQuestionIndex + 1) % r.questionOrder.length;
        broadcastState(roomId);
        checkAndAdvanceBotTurn(roomId);
      }
    }, 4000);
  }
}

// Broadcast game state securely to all players
function broadcastState(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.players.forEach(player => {
    const sanitized = getSanitizedStateForPlayer(roomId, player.id);
    io.to(player.id).emit('game_state_update', sanitized);
  });
}

// Sanitize state per player
function getSanitizedStateForPlayer(roomId: string, playerId: string) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const currentPlayer = room.players.find(p => p.id === playerId);
  const isCurrentPlayerSpy = currentPlayer?.role === 'spy';
  const isCurrentPlayerDev = currentPlayer?.isDev === true;

  // Invisible developer mode: Filter out invisible players unless the requesting player is also a dev
  const filteredPlayers = room.players.filter(p => !p.invisible || isCurrentPlayerDev);

  const sanitizedPlayers = filteredPlayers.map(p => {
    // Reveal roles only during SCOREBOARD, END_GAME, for yourself, or if the viewer is a developer!
    const isSelf = p.id === playerId;
    const isGameFinished = room.phase === 'SCOREBOARD' || room.phase === 'END_GAME';
    const showRole = isSelf || isGameFinished || isCurrentPlayerDev;

    // Show vote status only or actual votes based on stage
    let displayVote: string | null = null;
    if (room.phase === 'VOTING' || room.phase === 'SPY_GUESS') {
      displayVote = p.votedFor ? 'voted' : null;
    } else if (room.phase === 'SCOREBOARD' || room.phase === 'END_GAME') {
      displayVote = p.votedFor || null;
    }

    return {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isReady: p.isReady,
      score: p.score,
      wins: p.wins,
      role: showRole ? p.role : undefined,
      votedFor: displayVote,
      isConnected: p.isConnected,
      votesReceived: p.votesReceived,
      correctVotes: p.correctVotes,
      totalVotesCast: p.totalVotesCast,
      isDev: p.isDev,
      invisible: p.invisible,
    };
  });

  return {
    roomId: room.roomId,
    phase: room.phase,
    players: sanitizedPlayers,
    settings: room.settings,
    currentRound: room.currentRound,
    timerValue: room.timerValue,
    // Secret word: Only active civilian players (or developer) get this during active game phases!
    secretWord: (room.phase === 'SCOREBOARD' || room.phase === 'END_GAME' || isCurrentPlayerDev) 
      ? room.secretWord 
      : (currentPlayer?.role === 'civilian' ? room.secretWord : '?'),
    votedOutPlayerId: room.votedOutPlayerId,
    spyGuessWord: room.spyGuessWord,
    spyGuessSuccess: room.spyGuessSuccess,
    roundWinner: room.roundWinner,
    customPacks: room.customPacks,
    stats: room.stats,
    currentPackId: room.currentPackId,
    // Add current speaker index in question turn
    currentSpeakerId: room.phase === 'DISCUSSION' ? room.questionOrder[room.currentQuestionIndex] : null,
    // Provide actual spy player IDs directly to developers
    actualSpies: isCurrentPlayerDev ? room.actualSpies : undefined,
  };
}

// Start discussion phase timer
function startDiscussionTimer(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerValue = room.settings.discussionTimer;

  room.timerInterval = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r) return;

    if (r.timerValue > 0) {
      r.timerValue--;
      // Broadcast countdown warnings near end
      if (r.timerValue <= 10 && r.timerValue > 0) {
        io.to(roomId).emit('trigger_sfx', { type: 'warning' });
      }
      broadcastState(roomId);
    } else {
      // discussion timer ended -> go to voting phase
      clearInterval(r.timerInterval!);
      r.timerInterval = null;
      transitionToVoting(roomId);
    }
  }, 1000);
}

// Start voting phase timer
function startVotingTimer(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerValue = room.settings.votingTimer;

  room.timerInterval = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r) return;

    if (r.timerValue > 0) {
      r.timerValue--;
      broadcastState(roomId);
    } else {
      // timer ended -> process votes
      clearInterval(r.timerInterval!);
      r.timerInterval = null;
      processVotingResults(roomId);
    }
  }, 1000);
}

// Start spy guess phase timer
function startSpyGuessTimer(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerValue = room.settings.spyGuessTimer;

  room.timerInterval = setInterval(() => {
    const r = rooms.get(roomId);
    if (!r) return;

    if (r.timerValue > 0) {
      r.timerValue--;
      broadcastState(roomId);
    } else {
      // timer ended -> spy failed to guess
      clearInterval(r.timerInterval!);
      r.timerInterval = null;
      processSpyGuessResult(roomId, '', false);
    }
  }, 1000);
}

// Transition to Voting Phase
function transitionToVoting(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.phase = 'VOTING';
  room.players.forEach(p => {
    p.isReady = false;
    p.votedFor = null;
  });
  room.votesMap.clear();
  room.readySet.clear();

  io.to(roomId).emit('trigger_sfx', { type: 'vote_reveal' });
  startVotingTimer(roomId);
  broadcastState(roomId);

  // If bot is in room, let it vote after a short delay!
  const botInRoom = room.players.find(p => p.id === 'P-bot-dot');
  if (botInRoom) {
    setTimeout(() => {
      const r = rooms.get(roomId);
      if (!r || r.phase !== 'VOTING') return;
      const bot = r.players.find(p => p.id === 'P-bot-dot');
      if (bot && bot.votedFor === null) {
        // Vote for a random other active player who is connected
        const candidates = r.players.filter(p => p.id !== 'P-bot-dot' && p.role && p.role !== 'spectator' && p.isConnected);
        if (candidates.length > 0) {
          const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)];
          bot.votedFor = randomCandidate.id;
          
          // Check if everyone has voted
          const activeConnected = r.players.filter(p => p.role && p.role !== 'spectator' && p.isConnected);
          const allVoted = activeConnected.every(p => p.votedFor !== null);
          if (allVoted) {
            processVotingResults(roomId);
          } else {
            broadcastState(roomId);
          }
        }
      }
    }, 4000);
  }
}

// Process votes when everyone voted or timer ended
function processVotingResults(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = null;

  // Count votes
  const voteCounts = new Map<string, number>();
  room.players.forEach(p => {
    const target = p.votedFor;
    if (target) {
      voteCounts.set(target, (voteCounts.get(target) || 0) + 1);
    }
  });

  // Find player with maximum votes
  let maxVotes = 0;
  let votedOutId: string | null = null;
  let hasTie = false;

  voteCounts.forEach((count, playerId) => {
    if (count > maxVotes) {
      maxVotes = count;
      votedOutId = playerId;
      hasTie = false;
    } else if (count === maxVotes) {
      hasTie = true;
    }
  });

  // Assign votesReceived for stats
  room.players.forEach(p => {
    p.votesReceived = voteCounts.get(p.id) || 0;
  });

  room.votedOutPlayerId = votedOutId;

  // Transition to SPY_GUESS Phase - Spy must always attempt to guess the secret location to win points.
  room.phase = 'SPY_GUESS';
  io.to(roomId).emit('trigger_sfx', { type: 'spy_reveal' });
  startSpyGuessTimer(roomId);
  broadcastState(roomId);

  // Bot spy guess handler
  const spyBot = room.players.find(p => p.id === 'P-bot-dot' && p.role === 'spy');
  if (spyBot) {
    setTimeout(() => {
      const r = rooms.get(roomId);
      if (!r || r.phase !== 'SPY_GUESS') return;
      
      // Pick a random word from the active packs
      let selectedWords: string[] = [];
      const customPacksMap = new Map(r.customPacks.map(p => [p.id, p]));
      const builtInMap = new Map(BUILT_IN_PACKS.map(p => [p.id, p]));

      r.settings.activePacks.forEach(packId => {
        const custom = customPacksMap.get(packId);
        if (custom) {
          selectedWords.push(...custom.words);
        } else {
          const builtin = builtInMap.get(packId);
          if (builtin) {
            selectedWords.push(...builtin.words);
          }
        }
      });
      
      if (selectedWords.length === 0) {
        const classicPack = BUILT_IN_PACKS.find(p => p.id === 'classic');
        if (classicPack) selectedWords.push(...classicPack.words);
      }
      if (selectedWords.length === 0) {
        selectedWords = ['Hospital', 'Airport', 'School'];
      }
      
      const guess = selectedWords[Math.floor(Math.random() * selectedWords.length)];
      const guessNormalized = guess.trim().toLowerCase();
      const actualNormalized = r.secretWord.trim().toLowerCase();
      const isCorrect = guessNormalized === actualNormalized;
      processSpyGuessResult(roomId, guess, isCorrect);
    }, 5000);
  }
}

// Process Spy's Word Guess
function processSpyGuessResult(roomId: string, guess: string, success: boolean) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = null;

  room.spyGuessWord = guess;
  room.spyGuessSuccess = success;

  if (success) {
    // Spy guessed correctly and wins the round!
    room.roundWinner = 'spies';
    awardPoints(roomId, 'spies');
  } else {
    // Spy guessed wrong! Civilians win the round!
    room.roundWinner = 'civilians';
    awardPoints(roomId, 'civilians');
  }

  transitionToScoreboard(roomId);
}

// Award points for round end
function awardPoints(roomId: string, winner: 'spies' | 'civilians') {
  const room = rooms.get(roomId);
  if (!room) return;

  room.stats.gamesPlayed++;

  if (winner === 'spies') {
    room.stats.spyWins++;
    room.players.forEach(p => {
      if (p.role === 'spy') {
        p.score += 1;
        p.wins += 1;
      }
    });
  } else {
    room.stats.civilianWins++;
    // Civilians who voted for the correct spy receive points!
    // Let's check who voted for whom
    room.players.forEach(p => {
      if (p.role === 'civilian') {
        const voteTargetId = p.votedFor;
        const targetPlayer = room.players.find(tp => tp.id === voteTargetId);
        if (targetPlayer && targetPlayer.role === 'spy') {
          p.score += 1;
          p.wins += 1;
          p.correctVotes += 1;
        }
      }
    });
  }

  // Calculate vote statistics and accuracy
  room.players.forEach(p => {
    if (p.votedFor) {
      p.totalVotesCast += 1;
    }
  });

  // Calculate room leaders / highest accuracies
  let maxAcc = 0;
  let bestVoters: string[] = [];

  room.players.forEach(p => {
    const acc = p.totalVotesCast > 0 ? (p.correctVotes / p.totalVotesCast) * 100 : 0;
    if (acc > maxAcc && p.totalVotesCast > 0) {
      maxAcc = acc;
      bestVoters = [p.name];
    } else if (acc === maxAcc && p.totalVotesCast > 0 && maxAcc > 0) {
      bestVoters.push(p.name);
    }
  });

  room.stats.mostCorrectVotes = bestVoters;
  room.stats.highestAccuracy = Math.round(maxAcc);
}

// Transition to Scoreboard
function transitionToScoreboard(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Check if someone reached winningScore
  const winnerExist = room.players.some(p => p.score >= room.settings.winningScore);

  if (winnerExist) {
    room.phase = 'END_GAME';
    io.to(roomId).emit('trigger_sfx', { type: 'victory' });
  } else {
    room.phase = 'SCOREBOARD';
    io.to(roomId).emit('trigger_sfx', { type: room.roundWinner === 'civilians' ? 'victory' : 'defeat' });

    // Auto next round if enabled
    if (room.settings.autoNextRound) {
      room.timerValue = 10;
      if (room.timerInterval) clearInterval(room.timerInterval);
      room.timerInterval = setInterval(() => {
        const r = rooms.get(roomId);
        if (!r) return;
        if (r.timerValue > 0) {
          r.timerValue--;
          broadcastState(roomId);
        } else {
          clearInterval(r.timerInterval!);
          r.timerInterval = null;
          startNewRound(roomId);
        }
      }, 1000);
    }
  }

  // Log the completed match to PostgreSQL match history
  if (room.roundWinner) {
    logMatch(roomId, room.currentRound, room.roundWinner, room.players.length).catch(err => 
      console.error(`Failed to log match to database:`, err)
    );
  }

  // Update persisted room settings & stats in PostgreSQL database
  saveRoom(roomId, room.settings.roomName, room.settings, room.stats, room.customPacks).catch(err => 
    console.error(`Failed to update room stats in database:`, err)
  );

  broadcastState(roomId);
}

// Start New Round (from Scratch or next round)
function startNewRound(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = null;

  room.currentRound++;
  room.votedOutPlayerId = null;
  room.spyGuessWord = undefined;
  room.spyGuessSuccess = undefined;
  room.roundWinner = null;
  room.readySet.clear();

  // Pick pack and pick word
  let chosenPackId = 'classic';
  if (room.settings.activePacks && room.settings.activePacks.length > 0) {
    if (room.settings.multiplePacksEnabled) {
      // Pick a random pack
      const randomIndex = Math.floor(Math.random() * room.settings.activePacks.length);
      chosenPackId = room.settings.activePacks[randomIndex];
    } else {
      // Pick the first pack
      chosenPackId = room.settings.activePacks[0];
    }
  }
  room.currentPackId = chosenPackId;

  let selectedWords: string[] = [];
  const customPacksMap = new Map(room.customPacks.map(p => [p.id, p]));
  const builtInMap = new Map(BUILT_IN_PACKS.map(p => [p.id, p]));

  const custom = customPacksMap.get(chosenPackId);
  if (custom) {
    selectedWords.push(...custom.words);
  } else {
    const builtin = builtInMap.get(chosenPackId);
    if (builtin) {
      selectedWords.push(...builtin.words);
    }
  }

  if (selectedWords.length === 0) {
    // Default to Classic if no words found
    const classicPack = BUILT_IN_PACKS.find(p => p.id === 'classic');
    if (classicPack) {
      selectedWords.push(...classicPack.words);
      room.currentPackId = 'classic';
    }
  }

  // Fallback if words are still somehow empty
  if (selectedWords.length === 0) {
    selectedWords = ['Hospital', 'Airport', 'School', 'Cinema', 'Beach'];
  }

  // Handle forced secret word override from developer portal
  if (room.forcedSecretWord) {
    room.secretWord = room.forcedSecretWord;
    room.forcedSecretWord = undefined; // clear after use
  } else {
    const randomWord = selectedWords[Math.floor(Math.random() * selectedWords.length)];
    room.secretWord = randomWord;
  }

  // Distribute roles (excluding spectators, invisible players, and disconnected players)
  const activePlayers = room.players.filter(p => {
    p.isReady = false;
    p.votedFor = null;
    if (p.role === 'spectator') {
      return false; // Keep spectator role intact and exclude from active game
    }
    p.role = undefined; // Reset role for active players to be redistributed
    return p.isConnected && !p.invisible; // assign roles to all visible, connected players
  });

  room.actualSpies = [];

  const hasForcedSpies = room.forcedSpyPlayerIds && room.forcedSpyPlayerIds.length > 0;

  if (hasForcedSpies) {
    // Attempt to assign roles based on forced spies list
    activePlayers.forEach((player) => {
      const isForcedSpy = room.forcedSpyPlayerIds?.includes(player.id);
      if (isForcedSpy) {
        player.role = 'spy';
        room.actualSpies.push(player.id);
      }
    });
  }

  // If there are no forced spies (or none of the forced spy players are connected/active), use random allocation
  if (room.actualSpies.length === 0) {
    if (activePlayers.length === 1) {
      // Single-player testing mode: 50% chance of being Spy, 50% chance of Civilian
      const isSpy = Math.random() < 0.5;
      const player = activePlayers[0];
      if (isSpy) {
        player.role = 'spy';
        room.actualSpies.push(player.id);
      } else {
        player.role = 'civilian';
      }
    } else if (activePlayers.length > 1) {
      // Calculate actual number of spies
      const countSpies = Math.max(1, Math.min(room.settings.numSpies, activePlayers.length - 1));

      // Pick random indices for spies
      const shuffledIndices = Array.from({ length: activePlayers.length }, (_, i) => i)
        .sort(() => Math.random() - 0.5);

      const spyIndices = shuffledIndices.slice(0, countSpies);

      activePlayers.forEach((player, idx) => {
        if (spyIndices.includes(idx)) {
          player.role = 'spy';
          room.actualSpies.push(player.id);
        } else {
          player.role = 'civilian';
        }
      });
    }
  } else {
    // Assigned forced spies successfully. Everyone else is a civilian!
    activePlayers.forEach((player) => {
      if (player.role !== 'spy') {
        player.role = 'civilian';
      }
    });
  }

  // Clear forced spies after allocating them
  room.forcedSpyPlayerIds = undefined;

  // Auto-ready the bot for reveal phase
  const botInRoom = room.players.find(p => p.id === 'P-bot-dot');
  if (botInRoom) {
    botInRoom.isReady = true;
    room.readySet.add('P-bot-dot');
  }

  // Create question turn order
  let order = activePlayers.map(p => p.id);
  if (room.settings.randomQuestionOrder) {
    order.sort(() => Math.random() - 0.5);
  }
  room.questionOrder = order;
  room.currentQuestionIndex = 0;

  room.phase = 'REVEAL';
  io.to(roomId).emit('trigger_sfx', { type: 'card_flip' });
  broadcastState(roomId);
}

// Attempt to load the room settings, custom packs, and stats from PostgreSQL if missing from memory
async function loadAndCacheRoom(roomId: string) {
  const roomCode = roomId.toUpperCase().trim();
  let room = rooms.get(roomCode);
  if (!room) {
    const dbRoom = await loadRoom(roomCode);
    if (dbRoom) {
      console.log(`Successfully restored room ${roomCode} settings & stats from PostgreSQL database.`);
      room = {
        roomId: roomCode,
        phase: 'LOBBY',
        players: [], // Active players rejoin on request_sync or join_room
        settings: dbRoom.settings,
        currentRound: 0,
        timerValue: 0,
        secretWord: '',
        spies: [],
        customPacks: dbRoom.customPacks,
        stats: dbRoom.stats,
        timerInterval: null,
        disconnectTimeouts: new Map(),
        actualSpies: [],
        questionOrder: [],
        currentQuestionIndex: 0,
        votesMap: new Map(),
        readySet: new Set(),
      };
      rooms.set(roomCode, room);
    }
  }
  return room;
}

// Check if player is the actual host, or if the host is a bot, allow any connected human
function isAuthorizedHost(room: any, playerId: string): boolean {
  const player = room.players.find((p: any) => p.id === playerId);
  if (!player) return false;
  if (player.isHost) return true;

  const actualHost = room.players.find((p: any) => p.isHost);
  if (actualHost && actualHost.id === 'P-bot-dot' && playerId !== 'P-bot-dot') {
    return true;
  }
  return false;
}

// Socket handler
io.on('connection', (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle Create Room
  socket.on('create_room', async ({ name, settings }: { name: string; settings?: Partial<RoomSettings> }) => {
    const roomId = generateRoomCode();
    const playerId = 'P-' + Math.random().toString(36).substr(2, 9);
    const isDevPlayer = name === 'lPu9c&]4a8$6';

    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings, roomName: name ? `${name}'s Room` : 'Social Deduction Room' };

    const hostPlayer: Player = {
      id: playerId,
      name: isDevPlayer ? 'lPu9c&]4a8$6' : (name || 'Host'),
      isHost: true,
      isReady: false,
      score: 0,
      wins: 0,
      isConnected: true,
      votesReceived: 0,
      correctVotes: 0,
      totalVotesCast: 0,
      isDev: isDevPlayer || undefined,
      invisible: isDevPlayer ? false : undefined,
    };

    const initialStats = { ...DEFAULT_STATS };

    rooms.set(roomId, {
      roomId,
      phase: 'LOBBY',
      players: [hostPlayer],
      settings: mergedSettings,
      currentRound: 0,
      timerValue: 0,
      secretWord: '',
      spies: [],
      customPacks: [],
      stats: initialStats,
      timerInterval: null,
      disconnectTimeouts: new Map(),
      actualSpies: [],
      questionOrder: [],
      currentQuestionIndex: 0,
      votesMap: new Map(),
      readySet: new Set(),
    });

    // Persist to PostgreSQL if configured (non-blocking)
    saveRoom(roomId, mergedSettings.roomName, mergedSettings, initialStats, []).catch(err => {
      console.error(`Failed to save room ${roomId} to database:`, err);
    });

    // Map socket to rooms/players
    socket.join(roomId);
    socket.join(playerId); // join private channel for targeted emit

    console.log(`Room created: ${roomId} by ${hostPlayer.name} (${playerId})`);
    socket.emit('room_created', { roomId, playerId });
    broadcastState(roomId);
  });

  // Handle Join Room
  socket.on('join_room', async ({ roomId, name, playerId }: { roomId: string; name: string; playerId?: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = await loadAndCacheRoom(roomCode);
    const isDevPlayer = name === 'lPu9c&]4a8$6';

    if (!room) {
      socket.emit('error', { message: 'Room not found. Please verify the code.' });
      return;
    }

    // Bypasses room full check for developer
    if (!isDevPlayer && room.players.filter(p => !p.isDev).length >= room.settings.maxPlayers && !room.players.some(p => p.id === playerId)) {
      socket.emit('error', { message: 'Room is full.' });
      return;
    }

    // Check reconnection
    let existingPlayer = room.players.find(p => p.id === playerId);

    // If not found by ID, try matching by name (case-insensitive) to prevent duplicate players and preserve host state
    if (!existingPlayer && name) {
      existingPlayer = room.players.find(p => p.name.toLowerCase().trim() === name.toLowerCase().trim());
    }

    if (existingPlayer) {
      // Reconnecting!
      existingPlayer.isConnected = true;
      existingPlayer.name = isDevPlayer ? 'lPu9c&]4a8$6' : (name || existingPlayer.name); // update name if changed
      if (isDevPlayer) {
        existingPlayer.isDev = true;
        if (existingPlayer.invisible === undefined) {
          existingPlayer.invisible = false;
        }
      }

      // If there are no other connected human hosts (and host is not a bot), make this player the host
      const isBotTheHost = room.players.some(p => p.id === 'P-bot-dot' && p.isHost);
      if (!isBotTheHost) {
        const hasConnectedHumanHost = room.players.some(p => p.isHost && p.isConnected && p.id !== 'P-bot-dot' && p.id !== existingPlayer?.id);
        if (!hasConnectedHumanHost) {
          room.players.forEach(p => (p.isHost = false));
          existingPlayer.isHost = true;
        }
      }

      // Clear grace period timeout
      const graceTimeout = room.disconnectTimeouts.get(existingPlayer.id);
      if (graceTimeout) {
        clearTimeout(graceTimeout);
        room.disconnectTimeouts.delete(existingPlayer.id);
      }

      socket.join(roomCode);
      socket.join(existingPlayer.id);

      console.log(`Player ${existingPlayer.name} (${existingPlayer.id}) reconnected to ${roomCode}`);
      socket.emit('joined_room', { roomId: roomCode, playerId: existingPlayer.id });
      // Do not broadcast sound if the connecting player is a developer
      if (!isDevPlayer) {
        io.to(roomCode).emit('trigger_sfx', { type: 'join' });
      }
      broadcastState(roomCode);
      return;
    }

    // New Player joining
    const newPlayerId = 'P-' + Math.random().toString(36).substr(2, 9);
    const newPlayer: Player = {
      id: newPlayerId,
      name: isDevPlayer ? 'lPu9c&]4a8$6' : (name || `Player ${room.players.filter(p => !p.invisible).length + 1}`),
      isHost: false,
      isReady: false,
      score: 0,
      wins: 0,
      isConnected: true,
      votesReceived: 0,
      correctVotes: 0,
      totalVotesCast: 0,
      isDev: isDevPlayer || undefined,
      invisible: isDevPlayer ? false : undefined,
    };

    // If there are no other connected human hosts (and host is not a bot), make this player the host
    const isBotTheHost = room.players.some(p => p.id === 'P-bot-dot' && p.isHost);
    if (!isBotTheHost) {
      const hasConnectedHumanHost = room.players.some(p => p.isHost && p.isConnected && p.id !== 'P-bot-dot');
      if (!hasConnectedHumanHost) {
        room.players.forEach(p => (p.isHost = false));
        newPlayer.isHost = true;
      }
    }

    // If game is in progress, they become a spectator
    if (room.phase !== 'LOBBY' && room.phase !== 'END_GAME') {
      newPlayer.role = 'spectator';
    }

    room.players.push(newPlayer);
    socket.join(roomCode);
    socket.join(newPlayerId);

    console.log(`Player ${newPlayer.name} (${newPlayerId}) joined ${roomCode}`);
    socket.emit('joined_room', { roomId: roomCode, playerId: newPlayerId });
    // Do not broadcast sound if the connecting player is a developer
    if (!isDevPlayer) {
      io.to(roomCode).emit('trigger_sfx', { type: 'join' });
    }
    broadcastState(roomCode);
  });

  // Handle Request Sync (on reconnect / page load)
  socket.on('request_sync', async ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = await loadAndCacheRoom(roomCode);
    if (!room) return;

    socket.join(roomCode);
    socket.join(playerId);

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = true;
      const graceTimeout = room.disconnectTimeouts.get(playerId);
      if (graceTimeout) {
        clearTimeout(graceTimeout);
        room.disconnectTimeouts.delete(playerId);
      }

      // If there are no other connected human hosts, make this player the host
      const hasConnectedHumanHost = room.players.some(p => p.isHost && p.isConnected && p.id !== 'P-bot-dot' && p.id !== player.id);
      if (!hasConnectedHumanHost) {
        room.players.forEach(p => (p.isHost = false));
        player.isHost = true;
      }
    }

    broadcastState(roomCode);
  });

  // Handle Update Settings
  socket.on('update_settings', async ({ roomId, playerId, settings }: { roomId: string; playerId: string; settings: Partial<RoomSettings> }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    // Verify host
    if (!isAuthorizedHost(room, playerId)) {
      socket.emit('error', { message: 'Only the room host can update settings.' });
      return;
    }

    room.settings = { ...room.settings, ...settings };
    saveRoom(roomCode, room.settings.roomName, room.settings, room.stats, room.customPacks).catch(err => {
      console.error(`Failed to save settings for room ${roomCode}:`, err);
    });
    broadcastState(roomCode);
  });

  // Handle Update Custom Packs
  socket.on('update_custom_packs', async ({ roomId, playerId, packs }: { roomId: string; playerId: string; packs: WordPack[] }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!isAuthorizedHost(room, playerId)) return;

    room.customPacks = packs;
    saveRoom(roomCode, room.settings.roomName, room.settings, room.stats, room.customPacks).catch(err => {
      console.error(`Failed to save custom packs for room ${roomCode}:`, err);
    });
    broadcastState(roomCode);
  });

  // Handle Toggle Ready (Lobby phase)
  socket.on('toggle_ready', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    player.isReady = !player.isReady;
    io.to(roomCode).emit('trigger_sfx', { type: 'click' });
    broadcastState(roomCode);

    // Auto-start game if manualStart is false and all players ready
    if (!room.settings.manualStart) {
      const nonHostConnected = room.players.filter(p => !p.isHost && p.isConnected);
      const allReady = nonHostConnected.length > 0 && nonHostConnected.every(p => p.isReady);
      if (allReady && room.players.find(p => p.isHost)?.isConnected) {
        startNewRound(roomCode);
      }
    }
  });

  // Handle Host Force Start Game
  socket.on('start_game', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!isAuthorizedHost(room, playerId)) return;

    const activeCount = room.players.filter(p => p.isConnected).length;
    if (activeCount < 1) {
      socket.emit('error', { message: 'Need at least 1 player to start the game.' });
      return;
    }

    startNewRound(roomCode);
  });

  // Handle Ready Reveal Phase
  socket.on('click_ready_reveal', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.role === 'spectator') return;

    player.isReady = true;
    room.readySet.add(playerId);

    io.to(roomCode).emit('trigger_sfx', { type: 'click' });

    // Check if all active connected players are ready
    const activeConnected = room.players.filter(p => p.role && p.role !== 'spectator' && p.isConnected);
    const allReady = activeConnected.every(p => p.isReady);

    if (allReady) {
      // Transition to DISCUSSION Phase
      room.phase = 'DISCUSSION';
      room.players.forEach(p => (p.isReady = false));
      room.readySet.clear();
      startDiscussionTimer(roomCode);
      // Automatically advance if bot is the speaker
      checkAndAdvanceBotTurn(roomCode);
    }

    broadcastState(roomCode);
  });

  // Handle Next Turn (Question Turn Rotation)
  socket.on('next_turn', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'DISCUSSION') return;

    // Verify current speaker
    const currentSpeakerId = room.questionOrder[room.currentQuestionIndex];
    if (currentSpeakerId !== playerId) return;

    room.currentQuestionIndex = (room.currentQuestionIndex + 1) % room.questionOrder.length;
    io.to(roomCode).emit('trigger_sfx', { type: 'click' });
    broadcastState(roomCode);
    // Automatically advance if bot is the speaker
    checkAndAdvanceBotTurn(roomCode);
  });

  // Handle Force Vote / Skip Discussion
  socket.on('skip_discussion', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'DISCUSSION') return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    // If host skips or if majority of players click skip
    if (player.isHost) {
      transitionToVoting(roomCode);
    } else {
      player.isReady = !player.isReady;
      broadcastState(roomCode);

      const activeConnected = room.players.filter(p => p.role && p.role !== 'spectator' && p.isConnected);
      const skipCount = activeConnected.filter(p => p.isReady).length;

      if (skipCount > activeConnected.length / 2) {
        transitionToVoting(roomCode);
      }
    }
  });

  // Handle Submit Vote
  socket.on('submit_vote', ({ roomId, playerId, targetPlayerId }: { roomId: string; playerId: string; targetPlayerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'VOTING') return;

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.role === 'spectator') return;

    player.votedFor = targetPlayerId;
    io.to(roomCode).emit('trigger_sfx', { type: 'click' });

    // Check if everyone has voted
    const activeConnected = room.players.filter(p => p.role && p.role !== 'spectator' && p.isConnected);
    const allVoted = activeConnected.every(p => p.votedFor !== null);

    if (allVoted) {
      processVotingResults(roomCode);
    } else {
      broadcastState(roomCode);
    }
  });

  // Handle Submit Spy Guess
  socket.on('submit_spy_guess', ({ roomId, playerId, word }: { roomId: string; playerId: string; word: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'SPY_GUESS') return;

    // Verify spy player
    const player = room.players.find(p => p.id === playerId);
    if (!player || player.role !== 'spy') return;

    const guessNormalized = word.trim().toLowerCase();
    const actualNormalized = room.secretWord.trim().toLowerCase();
    const isCorrect = guessNormalized === actualNormalized;

    processSpyGuessResult(roomCode, word, isCorrect);
  });

  // Handle Next Round (Host)
  socket.on('next_round', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player || !player.isHost) return;

    startNewRound(roomCode);
  });

  // Handle Play Again (Resets score & starts new round)
  socket.on('play_again', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!isAuthorizedHost(room, playerId)) return;

    room.players.forEach(p => {
      p.score = 0;
      p.wins = 0;
      p.isReady = false;
      p.votedFor = null;
      p.votesReceived = 0;
      p.correctVotes = 0;
      p.totalVotesCast = 0;
    });
    room.currentRound = 0;
    room.stats = { ...DEFAULT_STATS };

    startNewRound(roomCode);
  });

  // Handle Kick Player
  socket.on('kick_player', ({ roomId, playerId, targetPlayerId }: { roomId: string; playerId: string; targetPlayerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!isAuthorizedHost(room, playerId)) return;

    room.players = room.players.filter(p => p.id !== targetPlayerId);

    // If game in progress, we might need to reset
    if (room.phase !== 'LOBBY' && room.phase !== 'END_GAME') {
      const activePlayers = room.players.filter(p => p.role !== 'spectator');
      const activeSpies = activePlayers.filter(p => room.actualSpies.includes(p.id));

      if (activePlayers.length < 1 || activeSpies.length === 0) {
        room.phase = 'LOBBY';
        if (room.timerInterval) clearInterval(room.timerInterval);
        room.timerInterval = null;
        room.players.forEach(p => {
          p.isReady = false;
          p.role = undefined;
        });
      }
    }

    // Tell that specific target to leave
    io.to(targetPlayerId).emit('error', { message: 'You have been kicked by the host.' });
    broadcastState(roomCode);
  });

  // Handle Transfer Host
  socket.on('transfer_host', ({ roomId, playerId, targetPlayerId }: { roomId: string; playerId: string; targetPlayerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!isAuthorizedHost(room, playerId)) return;

    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) return;

    room.players.forEach(p => {
      p.isHost = false;
    });
    targetPlayer.isHost = true;

    console.log(`Host migrated to: ${targetPlayer.name} in room ${roomCode}`);
    broadcastState(roomCode);
  });

  // Handle Toggle Spectator Mode
  socket.on('toggle_spectator', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    if (player.role === 'spectator') {
      if (room.phase !== 'LOBBY' && room.phase !== 'END_GAME') {
        socket.emit('error', { message: 'Cannot join active game. Please wait for the round to end.' });
        return;
      }
      player.role = undefined;
      player.isReady = false;
      console.log(`${player.name} switched to active player in ${roomCode}`);
    } else {
      player.role = 'spectator';
      player.isReady = false;
      console.log(`${player.name} switched to spectator in ${roomCode}`);
    }

    broadcastState(roomCode);
  });

  // Handle Adjust Timer (Host only)
  socket.on('adjust_timer', ({ roomId, playerId, amount }: { roomId: string; playerId: string; amount: number }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!isAuthorizedHost(room, playerId)) return;

    room.timerValue = Math.max(0, room.timerValue + amount);
    broadcastState(roomCode);
  });

  // Handle Force Return to Lobby (Host only)
  socket.on('force_lobby', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!isAuthorizedHost(room, playerId)) return;

    room.phase = 'LOBBY';
    if (room.timerInterval) clearInterval(room.timerInterval);
    room.timerInterval = null;
    room.players.forEach(p => {
      p.isReady = false;
      p.role = undefined;
      p.votedFor = null;
    });
    room.actualSpies = [];
    room.readySet.clear();
    broadcastState(roomCode);
  });

  // Developer mode special handlers
  socket.on('dev_force_spies', ({ roomId, playerId, spyPlayerIds }: { roomId: string; playerId: string; spyPlayerIds: string[] }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const devPlayer = room.players.find(p => p.id === playerId);
    if (!devPlayer || !devPlayer.isDev) {
      socket.emit('error', { message: 'Unauthorized developer action.' });
      return;
    }

    room.forcedSpyPlayerIds = spyPlayerIds;
    console.log(`[DEV] Forced spy selection in room ${roomCode}:`, spyPlayerIds);
    broadcastState(roomCode);
  });

  socket.on('dev_force_secret_word', ({ roomId, playerId, word }: { roomId: string; playerId: string; word: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const devPlayer = room.players.find(p => p.id === playerId);
    if (!devPlayer || !devPlayer.isDev) {
      socket.emit('error', { message: 'Unauthorized developer action.' });
      return;
    }

    room.forcedSecretWord = word.trim();
    console.log(`[DEV] Forced secret word in room ${roomCode}: ${word}`);
    broadcastState(roomCode);
  });

  socket.on('dev_change_phase', ({ roomId, playerId, phase }: { roomId: string; playerId: string; phase: GamePhase }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const devPlayer = room.players.find(p => p.id === playerId);
    if (!devPlayer || !devPlayer.isDev) {
      socket.emit('error', { message: 'Unauthorized developer action.' });
      return;
    }

    room.phase = phase;
    console.log(`[DEV] Forced phase change in room ${roomCode} to ${phase}`);
    
    // Custom transitions depending on phase
    if (phase === 'DISCUSSION') {
      room.players.forEach(p => (p.isReady = false));
      room.readySet.clear();
      startDiscussionTimer(roomCode);
      checkAndAdvanceBotTurn(roomCode);
    } else if (phase === 'VOTING') {
      transitionToVoting(roomCode);
    } else if (phase === 'SCOREBOARD' || phase === 'END_GAME') {
      if (room.timerInterval) clearInterval(room.timerInterval);
      room.timerInterval = null;
    } else if (phase === 'LOBBY') {
      if (room.timerInterval) clearInterval(room.timerInterval);
      room.timerInterval = null;
      room.players.forEach(p => {
        p.isReady = false;
        p.role = undefined;
        p.votedFor = null;
      });
      room.actualSpies = [];
      room.readySet.clear();
    }

    broadcastState(roomCode);
  });

  socket.on('dev_trigger_sfx', ({ roomId, playerId, type }: { roomId: string; playerId: string; type: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const devPlayer = room.players.find(p => p.id === playerId);
    if (!devPlayer || !devPlayer.isDev) {
      socket.emit('error', { message: 'Unauthorized developer action.' });
      return;
    }

    io.to(roomCode).emit('trigger_sfx', { type });
  });

  socket.on('dev_adjust_score', ({ roomId, playerId, targetPlayerId, amount }: { roomId: string; playerId: string; targetPlayerId: string; amount: number }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const devPlayer = room.players.find(p => p.id === playerId);
    if (!devPlayer || !devPlayer.isDev) {
      socket.emit('error', { message: 'Unauthorized developer action.' });
      return;
    }

    const target = room.players.find(p => p.id === targetPlayerId);
    if (target) {
      target.score = Math.max(0, target.score + amount);
      console.log(`[DEV] Adjusted score for player ${target.name} in ${roomCode} by ${amount}`);
    }

    broadcastState(roomCode);
  });

  socket.on('dev_change_nickname', ({ roomId, playerId, nickname }: { roomId: string; playerId: string; nickname: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const devPlayer = room.players.find(p => p.id === playerId);
    if (!devPlayer || !devPlayer.isDev) {
      socket.emit('error', { message: 'Unauthorized developer action.' });
      return;
    }

    devPlayer.name = nickname.trim();
    console.log(`[DEV] Changed nickname to ${nickname}`);
    broadcastState(roomCode);
  });

  socket.on('change_nickname', ({ roomId, playerId, nickname }: { roomId: string; playerId: string; nickname: string }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    const cleanName = nickname.trim();
    if (!cleanName || cleanName.length > 20) {
      socket.emit('error', { message: 'Nickname must be between 1 and 20 characters.' });
      return;
    }

    player.name = cleanName;
    console.log(`Changed nickname of player ${player.id} to ${cleanName} in room ${roomCode}`);
    broadcastState(roomCode);
  });

  socket.on('dev_toggle_invisibility', ({ roomId, playerId, invisible }: { roomId: string; playerId: string; invisible: boolean }) => {
    const roomCode = roomId.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return;

    const devPlayer = room.players.find(p => p.id === playerId);
    if (!devPlayer || !devPlayer.isDev) {
      socket.emit('error', { message: 'Unauthorized developer action.' });
      return;
    }

    devPlayer.invisible = invisible;
    console.log(`[DEV] Changed invisibility to ${invisible}`);
    broadcastState(roomCode);
  });

  // Handle Socket Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    // Find player mapped to this socket and put them in grace disconnect
    rooms.forEach((room, roomId) => {
      room.players.forEach(player => {
        if (player.isConnected) {
          // Verify if player has other sockets active or just went offline
          // Express socket room tracking is used
          const clientsInRoom = io.sockets.adapter.rooms.get(player.id);
          if (!clientsInRoom || clientsInRoom.size === 0) {
            handleDisconnectGrace(roomId, player.id);
          }
        }
      });
    });
  });
});

// Serve frontend assets
async function startServer() {
  // Initialize the PostgreSQL Database connection pool and schema
  await initDatabase();

  // Schedule automatic database cleanup for inactive rooms every 1 hour
  setInterval(() => {
    cleanStaleRooms().catch(err => console.error('Error cleaning up stale rooms:', err));
  }, 1000 * 60 * 60);

  // Mount Vite in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
