import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { 
  Users, Copy, UserCheck, ShieldAlert, Play, Volume2, HelpCircle, 
  ArrowRight, Check, X, LogOut, Radio, Award, Compass, 
  Crown, RefreshCw, Send, AlertTriangle, CheckSquare, Zap, Eye, EyeOff,
  Terminal, Settings, Plus, Lock, Unlock, Bot, Copyright
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GamePhase, GameState, Player, RoomSettings, WordPack } from './types';
import { soundManager } from './soundManager';
import { BUILT_IN_PACKS } from './wordPacks';
import { translations, Language } from './translations';
import SoundSettings from './components/SoundSettings';
import SettingsPanel from './components/SettingsPanel';
import WordPackManager from './components/WordPackManager';
import DevPortal from './components/DevPortal';
import { AnalyticsTracker } from './analytics';
import { savePlayerAnalytics } from './indexedDB';

const API_BASE =
  import.meta.env.VITE_SERVER_URL ||
  import.meta.env.VITE_API_URL ||
  "https://skyfallcustom.onrender.com";

const PHONETIC_DICT: Record<string, { adjective: string; noun: string; verb: string; adverb: string }> = {
  A: { adjective: 'Angry', noun: 'Ants', verb: 'Attack', adverb: 'Angrily' },
  B: { adjective: 'Bold', noun: 'Bears', verb: 'Bounce', adverb: 'Boldly' },
  C: { adjective: 'Crazy', noun: 'Cats', verb: 'Chase', adverb: 'Crazily' },
  D: { adjective: 'Daring', noun: 'Dogs', verb: 'Dance', adverb: 'Daringly' },
  E: { adjective: 'Eager', noun: 'Eagles', verb: 'Eat', adverb: 'Eagerly' },
  F: { adjective: 'Funny', noun: 'Foxes', verb: 'Fly', adverb: 'Fiercely' },
  G: { adjective: 'Giant', noun: 'Goats', verb: 'Gallop', adverb: 'Gently' },
  H: { adjective: 'Happy', noun: 'Hippos', verb: 'Hop', adverb: 'Happily' },
  I: { adjective: 'Itchy', noun: 'Iguanas', verb: 'Investigate', adverb: 'Intensely' },
  J: { adjective: 'Jolly', noun: 'Jaguars', verb: 'Jump', adverb: 'Joyfully' },
  K: { adjective: 'Kind', noun: 'Koalas', verb: 'Kick', adverb: 'Kindly' },
  L: { adjective: 'Lazy', noun: 'Lions', verb: 'Leap', adverb: 'Loudly' },
  M: { adjective: 'Mad', noun: 'Monkeys', verb: 'March', adverb: 'Madly' },
  N: { adjective: 'Noisy', noun: 'Newts', verb: 'Nap', adverb: 'Noisily' },
  O: { adjective: 'Odd', noun: 'Owls', verb: 'Observe', adverb: 'Oddly' },
  P: { adjective: 'Proud', noun: 'Pandas', verb: 'Play', adverb: 'Proudly' },
  Q: { adjective: 'Quick', noun: 'Quails', verb: 'Quack', adverb: 'Quickly' },
  R: { adjective: 'Rowdy', noun: 'Rabbits', verb: 'Run', adverb: 'Rapidly' },
  S: { adjective: 'Silly', noun: 'Snakes', verb: 'Slither', adverb: 'Silently' },
  T: { adjective: 'Tiny', noun: 'Tigers', verb: 'Talk', adverb: 'Tidily' },
  U: { adjective: 'Unique', noun: 'Unicorns', verb: 'Unite', adverb: 'Uniquely' },
  V: { adjective: 'Vast', noun: 'Vipers', verb: 'Vanish', adverb: 'Vigorously' },
  W: { adjective: 'Wild', noun: 'Wolves', verb: 'Walk', adverb: 'Wildly' },
  X: { adjective: 'Xenial', noun: 'Xylophones', verb: 'X-ray', adverb: 'Xenially' },
  Y: { adjective: 'Young', noun: 'Yaks', verb: 'Yawn', adverb: 'Youthfully' },
  Z: { adjective: 'Zesty', noun: 'Zebras', verb: 'Zoom', adverb: 'Zealously' },
};

function getPhoneticRoomName(code: string): string {
  if (!code || code.length !== 4) return 'Secret Mission Lounge';
  const chars = code.toUpperCase().split('');
  const words = chars.map((char, index) => {
    const entry = PHONETIC_DICT[char];
    if (!entry) return char;
    if (index === 0) return entry.adjective;
    if (index === 1) return entry.noun;
    if (index === 2) return entry.verb;
    return entry.adverb;
  });
  return words.join(' ');
}

let socket: Socket;

export const getAppleEmojiUrl = (emoji: string): string => {
  const map: Record<string, string> = {
    '👏': '1f44f',
    '👍': '1f44d',
    '❤️': '2764-fe0f',
    '❤': '2764-fe0f',
    '😂': '1f602',
    '🤔': '1f914'
  };
  const code = map[emoji] || map[emoji.trim()] || '1f44d';
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${code}.png`;
};

function App() {
  // Connection states
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('spyfall_playerName') || '');
  
  // Ping stats
  const [ping, setPing] = useState<number | null>(null);
  
  // Game state
  const [realGameState, setGameState] = useState<GameState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Local view preview (simulation mode) state
  const [localViewPreview, setLocalViewPreview] = useState<string | null>(null);

  // Derived state to support Local Client View Override / Simulation Mode
  const gameState = React.useMemo(() => {
    if (!localViewPreview) return realGameState;
    if (localViewPreview === 'HOME_SCREEN') return null;

    // Construct a rich, high-fidelity mock GameState for previewing and testing screens
    return {
      roomId: roomId || 'TEST',
      phase: localViewPreview as GamePhase,
      players: [
        { id: playerId || 'p1', name: playerName || 'Darci (Dev)', isHost: true, isReady: true, score: 3, wins: 2, role: 'civilian', isConnected: true, votesReceived: 0, correctVotes: 1, totalVotesCast: 1, isDev: true },
        { id: 'p2', name: 'Yash', isHost: false, isReady: true, score: 4, wins: 3, role: 'spy', isConnected: true, votesReceived: 1, correctVotes: 0, totalVotesCast: 1 },
        { id: 'p3', name: 'Sourav', isHost: false, isReady: true, score: 2, wins: 1, role: 'civilian', isConnected: true, votesReceived: 0, correctVotes: 1, totalVotesCast: 1 },
        { id: 'p4', name: 'OneEx', isHost: false, isReady: false, score: 1, wins: 0, role: 'civilian', isConnected: true, votesReceived: 2, correctVotes: 0, totalVotesCast: 1 },
      ],
      settings: {
        winningScore: 5,
        discussionTimer: 480,
        votingTimer: 60,
        spyGuessTimer: 30,
        numSpies: 1,
        maxPlayers: 8,
        isPrivate: false,
        roomName: 'Social Deduction Room',
        readyCheck: true,
        randomQuestionOrder: false,
        autoNextRound: false,
        hideVotesUntilReveal: false,
        allowSpectators: true,
        manualStart: false,
        activePacks: ['classic'],
      },
      currentRound: 1,
      timerValue: 245,
      secretWord: 'SPACE STATION',
      spies: ['p2'],
      revealedSpies: ['p2'],
      votedOutPlayerId: 'p2',
      spyGuessWord: 'SPACE STATION',
      spyGuessSuccess: true,
      roundWinner: 'spies' as const,
      customPacks: [],
      stats: {
        gamesPlayed: 5,
        spyWins: 2,
        civilianWins: 3,
        mostCorrectVotes: ['Yash'],
        highestAccuracy: 80,
      }
    } as GameState;
  }, [localViewPreview, realGameState, roomId, playerId, playerName]);
  
  // UI control states
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [spyGuessValue, setSpyGuessValue] = useState('');
  const [showDevPortal, setShowDevPortal] = useState(false);
  const [showHostControlsModal, setShowHostControlsModal] = useState(false);
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [revealStep, setRevealStep] = useState<'reveal' | 'guess'>('guess');
  const [revealCountdown, setRevealCountdown] = useState(6);

  // Invite Link Routing and validation states
  const [successMessage, setSuccessMessage] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [mismatchInviteId, setMismatchInviteId] = useState<string | null>(null);
  const [inviteRoomId, setInviteRoomId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/join\/([A-Za-z0-9]+)/i);
    return match ? match[1].toUpperCase() : null;
  });
  const [roomValidation, setRoomValidation] = useState<{
    loading: boolean;
    exists: boolean;
    error?: string;
    phase?: string;
    isFull?: boolean;
    settings?: {
      roomName: string;
      maxPlayers: number;
      allowSpectators: boolean;
    };
  } | null>(null);

  // Silent Diagnostics Analytics Tracker
  const trackerRef = useRef<AnalyticsTracker | null>(null);

  useEffect(() => {
    trackerRef.current = new AnalyticsTracker((data) => {
      // Quietly save own tracker telemetry locally in IndexedDB (Requirement 2)
      savePlayerAnalytics(data).catch(err => console.error('Error saving self analytics:', err));

      if (socket && roomId && playerId) {
        socket.emit('player_diagnostics_update', { roomId, playerId, diagnostics: data });
      }
    });

    return () => {
      trackerRef.current?.destroy();
    };
  }, [socket, roomId, playerId]);

  useEffect(() => {
    if (gameState?.phase) {
      trackerRef.current?.recordStateTransition(gameState.phase);
    }
  }, [gameState?.phase]);

  useEffect(() => {
    trackerRef.current?.updateConnectionSpeed(ping);
  }, [ping]);

  const fetchRoomValidation = async (code: string) => {
    setRoomValidation({ loading: true, exists: false });
    try {
      const response = await fetch(`${API_BASE}/api/room/${code}`);
      if (response.ok) {
        const data = await response.json();
        let errorMsg = undefined;
        if (!data.exists) {
          errorMsg = 'This game lobby does not exist or has expired.';
        } else if (data.isLobbyLocked) {
          errorMsg = 'This game lobby is currently locked.';
        } else if (data.isFull) {
          errorMsg = 'This game lobby is currently full.';
        } else if (data.phase !== 'LOBBY') {
          errorMsg = `This game is currently in the ${data.phase} phase and cannot be joined.`;
        }
        setRoomValidation({
          loading: false,
          exists: data.exists,
          error: errorMsg,
          phase: data.phase,
          isFull: data.isFull,
          settings: data.settings
        });
      } else {
        setRoomValidation({ loading: false, exists: false, error: 'Failed to connect to the server.' });
      }
    } catch (err) {
      setRoomValidation({ loading: false, exists: false, error: 'A network error occurred.' });
    }
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    const match = path.match(/^\/join\/([A-Za-z0-9]+)/i);
    const code = match ? match[1].toUpperCase() : null;
    setInviteRoomId(code);
    if (code) {
      fetchRoomValidation(code);
    } else {
      setRoomValidation(null);
    }
  };

  const handleShareRoom = async () => {
    const inviteUrl = `${window.location.origin}/join/${roomId}`;
    const shareData = {
      title: 'Join my Spyfall Game!',
      text: `You have been invited to play Spyfall! Join room ${roomId} using this link.`,
      url: inviteUrl,
    };
    
    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        handleCopyInviteLink();
      }
    } catch (err) {
      console.error('Error sharing:', err);
      handleCopyInviteLink();
    }
  };

  const handleCopyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/join/${roomId}`;
    soundManager.playClick();
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setSuccessMessage('Invite Link Copied');
        setTimeout(() => setSuccessMessage(''), 3000);
      }).catch(err => {
        fallbackCopyTextToClipboard(inviteUrl);
      });
    } else {
      fallbackCopyTextToClipboard(inviteUrl);
    }
  };

  const copyInviteLinkForRoomId = (id: string) => {
    const inviteUrl = `${window.location.origin}/join/${id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setSuccessMessage('Invite Link Copied');
        setTimeout(() => setSuccessMessage(''), 3000);
      }).catch(err => {
        fallbackCopyTextToClipboard(inviteUrl);
      });
    } else {
      fallbackCopyTextToClipboard(inviteUrl);
    }
  };

  const handleConfirmLeaveAndJoin = () => {
    soundManager.playClick();
    
    // Disconnect and reconnect socket to fully flush old channels
    socket.disconnect();
    socket.connect();

    localStorage.removeItem('spyfall_roomId');
    localStorage.removeItem('spyfall_playerId');
    setGameState(null);
    setRoomId('');
    setPlayerId('');
    setShowLeaveConfirm(false);
    
    if (mismatchInviteId) {
      setInviteRoomId(mismatchInviteId);
      window.history.pushState(null, '', `/join/${mismatchInviteId}`);
      fetchRoomValidation(mismatchInviteId);
    }
  };

  const handleCancelLeaveAndJoin = () => {
    soundManager.playClick();
    setShowLeaveConfirm(false);
    setMismatchInviteId(null);
    
    const activeRoomId = gameState?.roomId || roomId || localStorage.getItem('spyfall_roomId');
    if (activeRoomId) {
      window.history.pushState(null, '', `/join/${activeRoomId}`);
      setInviteRoomId(activeRoomId);
    } else {
      window.history.pushState(null, '', `/`);
      setInviteRoomId(null);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setSuccessMessage('Invite Link Copied');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage('Failed to copy link. Please copy manually.');
      }
    } catch (err) {
      setErrorMessage('Failed to copy link. Please copy manually.');
    }
    document.body.removeChild(textArea);
  };

  // Handle popstate for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/^\/join\/([A-Za-z0-9]+)/i);
      const code = match ? match[1].toUpperCase() : null;
      setInviteRoomId(code);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update page title & fetch validation when inviteRoomId changes
  useEffect(() => {
    if (inviteRoomId && !gameState) {
      document.title = 'Join Room - Spyfall';
      fetchRoomValidation(inviteRoomId);
    } else {
      document.title = 'Spyfall Custom - Social Deduction Game';
      setRoomValidation(null);
    }
  }, [inviteRoomId, gameState]);

  // Detect mismatch between URL invite link and active room
  useEffect(() => {
    const activeRoomId = roomId || localStorage.getItem('spyfall_roomId');
    const match = window.location.pathname.match(/^\/join\/([A-Za-z0-9]+)/i);
    const urlCode = match ? match[1].toUpperCase() : null;

    if (urlCode && activeRoomId && urlCode !== activeRoomId) {
      setMismatchInviteId(urlCode);
      setShowLeaveConfirm(true);
      // Revert inviteRoomId to the active room so they don't see the join screen behind the modal
      setInviteRoomId(activeRoomId);
      window.history.replaceState(null, '', `/join/${activeRoomId}`);
    }
  }, [inviteRoomId, roomId]);
  
  // Transition effect for SPY_GUESS phase reveal countdown
  useEffect(() => {
    if (gameState?.phase === 'SPY_GUESS') {
      setRevealStep('reveal');
      setRevealCountdown(6);
      
      const interval = setInterval(() => {
        setRevealCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setRevealStep('guess');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setRevealStep('guess');
    }
  }, [gameState?.phase, gameState?.currentRound]);

  // Language state (English only)
  const language: Language = 'en';

  const t = translations.en;

  const handleChangeName = (newName: string) => {
    setPlayerName(newName);
    localStorage.setItem('spyfall_playerName', newName);
    if (gameState && roomId && playerId) {
      socket.emit('change_nickname', { roomId, playerId, nickname: newName });
    }
  };

  // Connect & Reconnection setup
  useEffect(() => {
    // Connect to the backend server (monolith origin or split environment)
    let serverUrl = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL;
    if (!serverUrl) {
      if (window.location.hostname.includes('skyfallcustom.vercel.app')) {
        serverUrl = 'https://skyfallcustom.onrender.com';
      } else {
        serverUrl = window.location.origin;
      }
    }

    socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
    });

    socket.on('connect', () => {
      setConnected(true);
      // Try to sync/reconnect if we have cached details
      const savedRoomId = localStorage.getItem('spyfall_roomId');
      const savedPlayerId = localStorage.getItem('spyfall_playerId');
      const savedName = localStorage.getItem('spyfall_playerName');

      if (savedRoomId && savedPlayerId) {
        setRoomId(savedRoomId);
        setPlayerId(savedPlayerId);
        if (savedName) setPlayerName(savedName);
        socket.emit('request_sync', { roomId: savedRoomId, playerId: savedPlayerId });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('notification', ({ message }: { message: string }) => {
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 5000);
    });

    socket.on('room_created', ({ roomId, playerId }: { roomId: string, playerId: string }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      localStorage.setItem('spyfall_roomId', roomId);
      localStorage.setItem('spyfall_playerId', playerId);
      if (playerName) localStorage.setItem('spyfall_playerName', playerName);
      window.history.pushState(null, '', `/join/${roomId}`);
      setInviteRoomId(roomId);
      setIsCreating(false);
      // Auto-copy invite link after room creation (Requirement 1)
      copyInviteLinkForRoomId(roomId);
    });

    socket.on('joined_room', ({ roomId, playerId }: { roomId: string, playerId: string }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      localStorage.setItem('spyfall_roomId', roomId);
      localStorage.setItem('spyfall_playerId', playerId);
      if (playerName) localStorage.setItem('spyfall_playerName', playerName);
      window.history.pushState(null, '', `/join/${roomId}`);
      setInviteRoomId(roomId);
      setIsJoining(false);
    });

    socket.on('game_state_update', (updatedState: GameState) => {
      setGameState(updatedState);
      
      // Save all active players' diagnostics into our local IndexedDB (Requirement 2)
      if (updatedState.players) {
        updatedState.players.forEach(p => {
          if (p.diagnostics) {
            savePlayerAnalytics(p.diagnostics).catch(e => console.error('Error saving player analytics:', e));
          }
        });
      }
      
      // Auto-trigger confetti on overall End Game
      if (updatedState.phase === 'END_GAME') {
        triggerEndGameConfetti();
      }

      // Reset card flip if transitioning out of reveal
      if (updatedState.phase !== 'REVEAL') {
        setCardFlipped(false);
      }
    });

    socket.on('trigger_sfx', ({ type }: { type: string }) => {
      switch (type) {
        case 'click': soundManager.playClick(); break;
        case 'join': soundManager.playJoin(); break;
        case 'countdown': soundManager.playCountdown(); break;
        case 'card_flip': soundManager.playCardFlip(); break;
        case 'warning': soundManager.playWarning(); break;
        case 'vote_reveal': soundManager.playVoteReveal(); break;
        case 'spy_reveal': soundManager.playSpyReveal(); break;
        case 'victory': soundManager.playVictory(); break;
        case 'defeat': soundManager.playDefeat(); break;
      }
    });

    socket.on('error', ({ message }: { message: string }) => {
      setErrorMessage(message);
      soundManager.playWarning();
      setTimeout(() => setErrorMessage(''), 5000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('notification');
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('game_state_update');
      socket.off('trigger_sfx');
      socket.off('error');
    };
  }, [playerName]);



  // Ping / Latency Periodic Measurement
  useEffect(() => {
    if (!connected || !socket) {
      setPing(null);
      return;
    }

    const interval = setInterval(() => {
      const start = Date.now();
      socket.emit('ping_latency', () => {
        const duration = Date.now() - start;
        setPing(duration);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [connected]);

  // Handle Confetti Celebration
  const triggerEndGameConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  // Helper getters
  const currentPlayer = gameState?.players.find(p => p.id === playerId);
  const isBotHosted = gameState?.players.some(p => p.isHost && p.id === 'P-bot-dot') || false;
  const isHost = currentPlayer?.isHost || (isBotHosted && currentPlayer && currentPlayer.role !== 'spectator') || false;
  const isSpectator = currentPlayer?.role === 'spectator';

  // API Callbacks
  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setErrorMessage('Please enter a nickname first.');
      return;
    }
    soundManager.playClick();
    setIsCreating(true);
    socket.emit('create_room', { name: playerName.trim() });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setErrorMessage('Please enter a nickname first.');
      return;
    }
    if (!joinCodeInput.trim()) {
      setErrorMessage('Please enter a 4-letter room code.');
      return;
    }
    soundManager.playClick();
    setIsJoining(true);
    socket.emit('join_room', { 
      roomId: joinCodeInput.toUpperCase().trim(), 
      name: playerName.trim(),
      playerId: playerId || undefined
    });
  };

  const handleJoinInviteRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setErrorMessage('Please enter a nickname first.');
      return;
    }
    if (!inviteRoomId.trim()) {
      setErrorMessage('No invite room ID found.');
      return;
    }
    soundManager.playClick();
    setIsJoining(true);
    socket.emit('join_room', { 
      roomId: inviteRoomId.toUpperCase().trim(), 
      name: playerName.trim(),
      playerId: playerId || undefined
    });
  };

  const handleLeaveRoom = () => {
    soundManager.playClick();
    localStorage.removeItem('spyfall_roomId');
    localStorage.removeItem('spyfall_playerId');
    setRoomId('');
    setPlayerId('');
    setGameState(null);
    setJoinCodeInput('');
    setIsCreating(false);
    setIsJoining(false);
    // Disconnect and reconnect socket to fully flush channels
    socket.disconnect();
    socket.connect();
    // Clear invite routing and redirect home
    navigateTo('/');
  };

  const handleUpdateSettings = (settings: Partial<RoomSettings>) => {
    if (!roomId) return;
    socket.emit('update_settings', { roomId, playerId, settings });
  };

  const handleUpdatePacks = (activePacks: string[], customPacks: WordPack[]) => {
    if (!roomId) return;
    socket.emit('update_settings', { roomId, playerId, settings: { activePacks } });
    socket.emit('update_custom_packs', { roomId, playerId, packs: customPacks });
  };

  const handleToggleReady = () => {
    if (!roomId) return;
    socket.emit('toggle_ready', { roomId, playerId });
  };

  const handleToggleSpectator = () => {
    if (!roomId) return;
    soundManager.playClick();
    if (gameState?.settings.isLobbyLocked) {
      setErrorMessage('Lobby is locked. Switching mode is not allowed.');
      soundManager.playWarning();
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    socket.emit('toggle_spectator', { roomId, playerId });
  };

  const handleForceStart = () => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    const activePlayersCount = gameState.players.filter(p => p.role !== 'spectator').length;
    if (activePlayersCount < 3) {
      setErrorMessage('Minimum 3 players required.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    socket.emit('start_game', { roomId, playerId });
  };

  const handleAddBot = () => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('add_bot', { roomId, playerId });
  };

  const handleKickPlayer = (targetId: string) => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('kick_player', { roomId, playerId, targetPlayerId: targetId });
  };

  const handleTransferHost = (targetId: string) => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('transfer_host', { roomId, playerId, targetPlayerId: targetId });
  };

  const handleForceToggleSpectator = (targetId: string) => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('toggle_spectator', { roomId, playerId, targetPlayerId: targetId });
  };

  const handleReadyReveal = () => {
    if (!roomId) return;
    socket.emit('click_ready_reveal', { roomId, playerId });
  };

  const handleNextTurn = () => {
    if (!roomId) return;
    socket.emit('next_turn', { roomId, playerId });
  };

  const handleSkipDiscussion = () => {
    if (!roomId) return;
    soundManager.playClick();
    socket.emit('skip_discussion', { roomId, playerId });
  };

  const handleAdjustTimer = (amount: number) => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('adjust_timer', { roomId, playerId, amount });
  };

  const handleSubmitVote = (targetId: string) => {
    if (!roomId) return;
    socket.emit('submit_vote', { roomId, playerId, targetPlayerId: targetId });
  };

  const handleSubmitSpyGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !spyGuessValue.trim()) return;
    soundManager.playClick();
    socket.emit('submit_spy_guess', { roomId, playerId, word: spyGuessValue.trim() });
    setSpyGuessValue('');
  };

  const handleNextRound = () => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('next_round', { roomId, playerId });
  };

  const handlePlayAgain = () => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('play_again', { roomId, playerId });
  };

  const copyRoomCode = () => {
    if (!roomId) return;
    soundManager.playClick();
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#181818] text-neutral-200 flex flex-col font-sans selection:bg-blue-600/30 selection:text-white relative overflow-x-hidden">
      
      {/* HEADER BAR */}
      <header className="border-b border-[#2a2a2a] bg-[#1a1a1a] sticky top-0 z-50 px-4 py-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="font-sans font-bold text-sm tracking-widest text-neutral-100 uppercase">
              SPYFALL
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isHost && gameState && gameState.phase !== 'LOBBY' && (
              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowHostControlsModal(true);
                }}
                className="flex items-center gap-1.5 py-1 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition-all cursor-pointer"
                title="Open Host Panel"
              >
                <Crown className="h-3.5 w-3.5" />
                <span>Host Panel</span>
              </button>
            )}

            {!gameState && (
              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowCopyrightModal(!showCopyrightModal);
                }}
                className="p-1.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-emerald-500/10 hover:border-emerald-500/30 text-neutral-350 hover:text-emerald-450 transition-all group"
                title="Copyright & Attributions"
              >
                <Copyright className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              </button>
            )}

            <button
              onClick={() => {
                soundManager.playClick();
                setShowTeamModal(!showTeamModal);
              }}
              className="p-1.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-350 hover:text-white transition-all group"
              title="Team & Engine Info"
            >
              <Users className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
            </button>

            <button
              onClick={() => {
                soundManager.playClick();
                setShowAudioModal(!showAudioModal);
              }}
              className="p-1.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-350 hover:text-white transition-all group"
              title="Settings & Preferences"
            >
              <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
            </button>
          </div>
        </div>
      </header>

      {/* ERROR ALERT TOAST */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
          >
            <div className="bg-[#1e1e1e] border border-rose-500/30 text-rose-250 px-4 py-3 rounded-xl flex items-start gap-3 shadow-xl">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{errorMessage}</div>
              <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-white shrink-0 ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUCCESS/INFO ALERT TOAST */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
          >
            <div className="bg-[#1e1e1e] border border-emerald-500/30 text-emerald-350 px-4 py-3 rounded-xl flex items-start gap-3 shadow-xl">
              <Check className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{successMessage}</div>
              <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-white shrink-0 ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEAVE ROOM CONFIRMATION MODAL */}
      <AnimatePresence>
        {showLeaveConfirm && mismatchInviteId && (
          <div className="fixed inset-0 bg-[#0c0c0c]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#1e1e1e] border border-[#2e2e2e] max-w-md w-full rounded-2xl p-6 space-y-5 shadow-2xl text-center select-none"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
                <AlertTriangle className="h-6 w-6 text-amber-500 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-sans font-black text-xl text-neutral-100 tracking-wide uppercase">
                  Switch Game Lobby?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                  You are currently in room <strong className="text-neutral-200 font-mono font-black uppercase">{(gameState?.roomId || roomId || localStorage.getItem('spyfall_roomId'))}</strong>.
                </p>
                <p className="text-xs text-neutral-300 font-medium bg-[#151515] p-3 rounded-xl border border-[#252525] max-w-xs mx-auto">
                  "Do you want to leave your current room and join this room <span className="font-mono text-emerald-400 font-bold tracking-wider">{mismatchInviteId}</span>?"
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* Stay in current room */}
                <button
                  onClick={handleCancelLeaveAndJoin}
                  className="py-2.5 px-4 rounded-xl bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Stay in Current
                </button>

                {/* Confirm leave and join */}
                <button
                  onClick={handleConfirmLeaveAndJoin}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-lg shadow-rose-900/10"
                >
                  Leave & Join New
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AUDIO PANEL FLOATING DRAWER */}
      <AnimatePresence>
        {showAudioModal && (
          <div className="fixed inset-0 bg-[#0c0c0c]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm"
            >
              <SoundSettings 
                currentName={playerName}
                onChangeName={handleChangeName}
                currentLanguage={language}
                onChangeLanguage={(newLang) => {
                  localStorage.setItem('spyfall_language', newLang);
                }}
                onClose={() => setShowAudioModal(false)} 
                onLeaveRoom={roomId ? handleLeaveRoom : undefined}
                isSpectator={isSpectator}
                onToggleSpectator={roomId ? handleToggleSpectator : undefined}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HOST CONTROLS POPUP MODAL */}
      <AnimatePresence>
        {showHostControlsModal && isHost && gameState && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1a] border border-[#2e2e2e] w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-5 text-neutral-200 relative"
            >
              <button
                type="button"
                onClick={() => setShowHostControlsModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-[#222222] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
                <Crown className="h-4.5 w-4.5 text-amber-500" />
                <h3 className="font-sans font-black text-sm tracking-wider uppercase text-neutral-100">
                  Host Command Panel
                </h3>
              </div>

              <div className="space-y-4">
                {/* Lock Lobby Toggle */}
                <div className="bg-[#151515] p-3 rounded-xl border border-[#252525] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {gameState.settings.isLobbyLocked ? (
                      <Lock className="h-4 w-4 text-rose-500 shrink-0" />
                    ) : (
                      <Unlock className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    <div className="text-left">
                      <p className="text-xs font-bold text-neutral-200">Lock Lobby</p>
                      <p className="text-[9px] font-mono text-neutral-500 uppercase leading-none mt-0.5">Prevent players joining</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      const nextVal = !gameState.settings.isLobbyLocked;
                      handleUpdateSettings({ isLobbyLocked: nextVal });
                    }}
                    className={`relative inline-flex h-4.5 w-8.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      gameState.settings.isLobbyLocked ? 'bg-rose-600' : 'bg-neutral-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        gameState.settings.isLobbyLocked ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Adjust Timer controls */}
                <div className="bg-[#151515] p-4 rounded-xl border border-[#252525] space-y-2.5">
                  <p className="text-[10px] font-mono font-bold tracking-wider text-neutral-500 uppercase">Adjust Active Timer</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playClick();
                        handleAdjustTimer(-30);
                      }}
                      className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      -30 Seconds
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playClick();
                        handleAdjustTimer(30);
                      }}
                      className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      +30 Seconds
                    </button>
                  </div>
                </div>

                {/* Discussion skip action */}
                {gameState.phase === 'DISCUSSION' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      handleSkipDiscussion();
                      setShowHostControlsModal(false);
                    }}
                    className="w-full py-3 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/25 text-amber-400 text-xs font-extrabold rounded-xl cursor-pointer transition-all uppercase tracking-wide"
                  >
                    Force Transition to Voting
                  </button>
                )}

                {/* Restart Session action */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    if (window.confirm("Are you sure you want to return to the lobby? Starting a new game from the lobby will reset all player scores.")) {
                      socket.emit('force_lobby', { roomId, playerId });
                      setShowHostControlsModal(false);
                    }
                  }}
                  className="w-full py-3 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 text-rose-400 text-xs font-extrabold rounded-xl cursor-pointer transition-all uppercase tracking-wide"
                >
                  Restart Round (Force Lobby)
                </button>

                {/* Host Panel Info Section */}
                <div className="bg-[#151515] p-4 rounded-xl border border-[#252525] space-y-3">
                  <p className="text-[10px] font-mono font-bold tracking-wider text-neutral-500 uppercase">Room Information</p>
                  
                  {/* Players Joined Count */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-medium">Players Joined:</span>
                    <span className="font-mono font-bold text-neutral-200">
                      {gameState.players.length} / {gameState.settings.maxPlayers}
                    </span>
                  </div>

                  {/* Room Code with Copy */}
                  <div className="flex justify-between items-center text-xs gap-2 bg-[#1b1b1b] p-2 rounded-lg border border-[#262626]">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-neutral-500 uppercase">Room Code</span>
                      <span className="font-mono font-black text-sm tracking-widest text-neutral-200 uppercase">{roomId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={copyRoomCode}
                      className="p-1.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                      title="Copy Room Code"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Invite Link with Copy */}
                  <div className="flex justify-between items-center text-xs gap-2 bg-[#1b1b1b] p-2 rounded-lg border border-[#262626]">
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[9px] font-mono text-neutral-500 uppercase">Invite Link</span>
                      <span className="font-mono text-[10px] truncate text-neutral-300">
                        {`${window.location.origin}/join/${roomId}`}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyInviteLink}
                        className="p-1.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                        title="Copy Invite Link"
                      >
                        {successMessage === 'Invite Link Copied' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Small scannable joined players names list */}
                  <div className="space-y-1 pt-1 border-t border-[#262626]">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase block">Players List:</span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {gameState.players.map(p => (
                        <span key={p.id} className="text-[10px] bg-[#222222] border border-[#2e2e2e] px-1.5 py-0.5 rounded text-neutral-300">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TEAM MODAL */}
      <AnimatePresence>
        {showTeamModal && (
          <div className="fixed inset-0 bg-[#0c0c0c]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#161616] border border-[#2e2e2e] rounded-2xl shadow-2xl p-6 overflow-hidden"
            >
              {/* Decorative top gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-neutral-700 via-neutral-500 to-neutral-600" />
              
              {/* Close Button */}
              <button 
                onClick={() => setShowTeamModal(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-lg hover:bg-[#222222] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-6 pt-2">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-lg text-neutral-150 tracking-wide uppercase">
                      The Creators
                    </h3>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider font-bold">
                      Team & Architecture
                    </p>
                  </div>
                </div>

                <div className="h-[1px] bg-[#222] w-full" />

                {/* Team Members */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono block">Head Developers</span>
                    <div className="text-sm font-sans font-bold text-neutral-200">
                      OneEx &amp; Dotttt
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono block">Managers</span>
                    <div className="text-sm font-sans font-bold text-neutral-200">
                      Darci &amp; Sourav
                    </div>
                  </div>
                </div>

                {/* 1XDOT Realtime Engine Highlight */}
                <div className="bg-[#1c1c1c] border border-[#2d2d2d] p-4 rounded-xl space-y-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300">
                    <Zap className="h-12 w-12 text-neutral-400" />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-neutral-300" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300">
                      1XDOT REALTIME ENGINE
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Powered by the cutting-edge realtime engine engineered by <strong className="text-neutral-200 font-semibold">Yash</strong>. Recognized globally as one of the best state-synchronization architectures, trusted and utilized by major industry enterprises worldwide.
                    </p>
                  </div>
                </div>
                
                {/* Footer confirmation button */}
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="w-full py-2.5 bg-[#252525] hover:bg-[#303030] border border-[#353535] text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close Panel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COPYRIGHT & ATTRIBUTION MODAL */}
      <AnimatePresence>
        {showCopyrightModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-black border border-neutral-800 rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
              {/* Close Button */}
              <button 
                onClick={() => {
                  soundManager.playClick();
                  setShowCopyrightModal(false);
                }}
                className="absolute top-4 right-4 text-neutral-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-4 pt-1">
                <div className="space-y-1">
                  <h3 className="font-sans font-black text-sm text-white tracking-widest uppercase">
                    Spyfall Custom Edition
                  </h3>
                  <p className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">
                    Remake Attribution
                  </p>
                </div>

                <div className="h-[1px] bg-neutral-900 w-full" />

                <div className="space-y-3 text-xs text-neutral-400 font-mono leading-relaxed">
                  <p>
                    This is a custom fan-made remake version of the classic social deduction game.
                  </p>
                  <p>
                    All matchmaking credits and web adaptation concept belong to <a href="https://netgames.io" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-neutral-300 transition-colors font-bold cursor-pointer">netgames.io</a>.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setShowCopyrightModal(false);
                    }}
                    className="w-full py-2 bg-neutral-900 hover:bg-white hover:text-black border border-neutral-850 text-white text-xs font-mono font-bold rounded-lg transition-all cursor-pointer"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN GAME CONTAINER */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center z-10">
        
        {/* PHASE 0: HOME SCREEN */}
        {!gameState && (
          inviteRoomId ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full mx-auto space-y-6"
            >
              {/* Special Direct Invite Link UI */}
              <div className="text-center space-y-2 py-2 select-text">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-1">
                  <Crown className="h-6 w-6" />
                </div>
                <h2 className="font-sans font-black text-2xl text-neutral-100 tracking-wider uppercase">
                  Spyfall Room Invitation
                </h2>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  You have been invited to join a custom Spyfall lobby!
                </p>
              </div>

              {!roomValidation || roomValidation.loading ? (
                <div className="bg-[#1e1e1e] border border-[#2e2e2e] p-8 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center">
                  <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-neutral-200 uppercase tracking-wider">Validating Room Code</p>
                    <p className="text-[11px] text-neutral-500 font-mono">Verifying credentials for room #{inviteRoomId}...</p>
                  </div>
                </div>
              ) : roomValidation?.error ? (
                <div className="bg-[#1e1e1e] border border-rose-500/20 p-8 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="h-10 w-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-neutral-200">Unable to Join Room</p>
                    <p className="text-xs text-rose-300 max-w-xs">{roomValidation?.error}</p>
                  </div>
                  <button
                    onClick={() => navigateTo('/')}
                    className="w-full py-2.5 bg-[#252525] hover:bg-[#303030] border border-[#353535] text-white text-xs font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                  >
                    Go to Home Screen
                  </button>
                </div>
              ) : (
                <div className="bg-[#1e1e1e] border border-[#2e2e2e] p-6 rounded-2xl space-y-5">
                  {/* Valid Room Info */}
                  <div className="bg-[#151515] p-4 rounded-xl border border-[#222222] text-center space-y-1">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">ACTIVE ROOM</span>
                    <h3 className="text-2xl font-mono font-black tracking-widest text-neutral-100">{inviteRoomId}</h3>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase font-bold tracking-wider">
                      {getPhoneticRoomName(inviteRoomId)}
                    </p>
                  </div>

                  {/* Nickname Form */}
                  <form onSubmit={handleJoinInviteRoom} className="space-y-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                        Choose Your Nickname
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={15}
                          placeholder={t.enterName}
                          value={playerName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPlayerName(val);
                            localStorage.setItem('spyfall_playerName', val);
                          }}
                          className="w-full bg-[#151515] border border-[#2e2e2e] text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-[#10b981] text-neutral-200 font-semibold"
                          autoFocus
                          required
                        />
                        {playerName.trim() && (
                          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Join Button */}
                    <button
                      type="submit"
                      disabled={isJoining || !playerName.trim()}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer uppercase tracking-wide"
                    >
                      {isJoining ? 'Joining Match...' : `Join Room ${inviteRoomId}`}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  <div className="border-t border-[#2a2a2a] pt-4 flex justify-center">
                    <button
                      onClick={() => navigateTo('/')}
                      className="text-xs font-semibold text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                    >
                      Join different room manually
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full mx-auto space-y-6"
            >
            {/* Tagline Graphic */}
            <div className="text-center space-y-2 py-2 select-text">
              <h2 className="font-sans font-black text-3xl sm:text-4xl text-neutral-100 tracking-wider uppercase">
                {t.appTitle}
              </h2>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                {t.appSubtitle}
              </p>
            </div>

            {/* Inputs Box */}
            <div className="bg-[#1e1e1e] border border-[#2e2e2e] p-6 rounded-2xl space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                  {t.yourName}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={15}
                    placeholder={t.enterName}
                    value={playerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlayerName(val);
                      localStorage.setItem('spyfall_playerName', val);
                    }}
                    className="w-full bg-[#151515] border border-[#2e2e2e] text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-[#3b82f6] text-neutral-200 font-semibold"
                  />
                  {playerName.trim() && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>

              <div className="border-t border-[#2a2a2a] pt-4 grid grid-cols-1 gap-3">
                {/* Create Game Button */}
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreateRoom}
                  className="w-full py-3 bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] disabled:opacity-40 text-neutral-200 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {isCreating ? t.saving : t.createRoom}
                  <ArrowRight className="h-4 w-4 text-[#3b82f6]" />
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-[#2e2e2e]"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-neutral-500 font-bold font-mono uppercase tracking-wider">{t.roomCode}</span>
                  <div className="flex-grow border-t border-[#2e2e2e]"></div>
                </div>

                {/* Join Game form */}
                <form onSubmit={handleJoinRoom} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="CODE"
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().trim())}
                      className="w-1/3 text-center uppercase bg-[#151515] border border-[#2e2e2e] text-sm py-3 rounded-xl focus:outline-none focus:border-[#3b82f6] text-neutral-100 font-mono font-bold tracking-widest placeholder:font-sans placeholder:font-semibold placeholder:text-xs placeholder:tracking-normal"
                    />
                    <button
                      type="submit"
                      disabled={isJoining}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-xl transition-all text-sm cursor-pointer"
                    >
                      {isJoining ? t.saving : t.joinRoom}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Quick Rules Card */}
            <div className="bg-[#1a1a1a] border border-[#262626] p-6 rounded-2xl space-y-4 select-text shadow-sm">
              <span className="font-sans font-extrabold text-xs text-neutral-400 uppercase flex items-center gap-2 tracking-wider">
                <HelpCircle className="h-4 w-4 text-neutral-400" />
                How to Play
              </span>
              
              <div className="space-y-4 pt-1">
                {/* Step 1 */}
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 h-5 w-5 rounded bg-[#2a2a2a] border border-[#3a3a3a] text-neutral-300 font-mono text-[10px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-200 font-semibold leading-normal">
                      Get Your Identity
                    </p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Everyone receives a secret <strong className="text-neutral-300 font-semibold">Secret Location</strong> card, except for the <strong className="text-neutral-350 font-semibold">Spy</strong> who receives a "YOU ARE THE SPY" card.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 h-5 w-5 rounded bg-[#2a2a2a] border border-[#3a3a3a] text-neutral-300 font-mono text-[10px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-200 font-semibold leading-normal">
                      Interrogate & Deduce
                    </p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Ask strategic questions in a circle. Your goal is to identify who doesn't know the location, without giving the secret away to the Spy!
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 h-5 w-5 rounded bg-[#2a2a2a] border border-[#3a3a3a] text-neutral-300 font-mono text-[10px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-200 font-semibold leading-normal">
                      Vote or Guess
                    </p>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Vote together when the timer expires. If the Spy survives, or correctly <strong className="text-neutral-300 font-semibold">guesses the secret word</strong>, they win the round!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          )
        )}

        {/* ACTIVE ROOM VIEWSTATES */}
        {gameState && (
          <div className="space-y-6">
            
            {/* Centered Phonetic Room Code header (only shown in LOBBY phase) */}
            {gameState.phase === 'LOBBY' && (
              <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-4">
                <div className="text-center select-text">
                  <span className="text-4xl font-mono font-black tracking-widest text-neutral-100 uppercase">{roomId}</span>
                  <p className="text-xs font-semibold text-neutral-400 mt-1.5 tracking-wide uppercase font-mono">
                    {getPhoneticRoomName(roomId)}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Button 1: Copy Room Code */}
                  <button
                    onClick={copyRoomCode}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-200 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400 animate-bounce" />
                        <span className="text-emerald-400">Room Code Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-[#3b82f6]" />
                        <span>Copy Room Code</span>
                      </>
                    )}
                  </button>

                  {/* Button 2: Copy Invite Link */}
                  <button
                    onClick={handleCopyInviteLink}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-200 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {successMessage === 'Invite Link Copied' ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400 animate-bounce" />
                        <span className="text-emerald-400">Invite Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 text-emerald-400" />
                        <span>Copy Invite Link</span>
                      </>
                    )}
                  </button>
                </div>


              </div>
            )}

            {/* LOBBY PHASE */}
            {gameState.phase === 'LOBBY' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Side: Players List */}
                <div className="lg:col-span-7 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-5">
                  
                  {/* Lobby header */}
                  <div className="flex justify-between items-center border-b border-[#2a2a2a] pb-4">
                    <div>
                      {isEditingRoomName && isHost ? (
                        <input
                          type="text"
                          value={roomNameInput}
                          onChange={(e) => setRoomNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateSettings({ roomName: roomNameInput.trim() || 'Social Deduction Room' });
                              setIsEditingRoomName(false);
                            } else if (e.key === 'Escape') {
                              setIsEditingRoomName(false);
                            }
                          }}
                          onBlur={() => {
                            handleUpdateSettings({ roomName: roomNameInput.trim() || 'Social Deduction Room' });
                            setIsEditingRoomName(false);
                          }}
                          className="bg-[#151515] border border-blue-500 text-neutral-200 font-sans font-bold text-lg rounded px-2 py-0.5 focus:outline-none w-full max-w-[240px]"
                          autoFocus
                        />
                      ) : (
                        <h2 
                          onDoubleClick={() => {
                            if (isHost) {
                              setRoomNameInput(gameState.settings.roomName);
                              setIsEditingRoomName(true);
                            }
                          }}
                          className={`font-sans font-bold text-lg text-neutral-200 ${isHost ? 'cursor-pointer hover:text-blue-400 select-none' : ''}`}
                          title={isHost ? "Double click to edit room name" : ""}
                        >
                          {gameState.settings.roomName}
                        </h2>
                      )}
                      <p className="text-xs text-neutral-400 mt-1">
                        Connected crew ({gameState.players.length}/{gameState.settings.maxPlayers})
                      </p>
                    </div>
                  </div>

                  {/* Players list scroll container */}
                  <div className="space-y-4">
                    {/* Active Players */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest block mb-1">
                        Active Players ({gameState.players.filter(p => p.role !== 'spectator').length})
                      </span>
                      {gameState.players.filter(p => p.role !== 'spectator').map((p) => {
                        const isMe = p.id === playerId;
                        return (
                          <div 
                            key={p.id}
                            className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
                              isMe 
                                ? 'bg-blue-600/5 border-blue-500/20' 
                                : p.isConnected 
                                  ? 'bg-[#151515] border-[#252525]' 
                                  : 'bg-[#151515]/30 border-transparent text-neutral-600 opacity-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Host Crown Icon */}
                              {p.isHost ? (
                                <div className="bg-amber-500/10 p-1.5 rounded-lg text-amber-400 shrink-0 border border-amber-500/20">
                                  <Crown className="h-3.5 w-3.5" />
                                </div>
                              ) : (
                                <div className="bg-[#222222] p-1.5 rounded-lg text-neutral-400 shrink-0 border border-[#2e2e2e]">
                                  <Users className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <div className="truncate">
                                <p className="text-sm font-semibold truncate flex items-center gap-1.5 text-neutral-200">
                                  {p.name}
                                  {isMe && <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded-md border border-blue-500/20">YOU</span>}
                                  {p.id.startsWith('P-bot') && <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">BOT</span>}
                                  {!p.isConnected && <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-md uppercase">DC</span>}
                                </p>
                                {p.score > 0 && <p className="text-[10px] text-neutral-400">Wins: {p.wins} ({p.score} pts)</p>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Host Actions on players */}
                              {isHost && !isMe && p.isConnected && (
                                <div className="flex items-center gap-1.5 mr-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 shrink-0">
                                  <button
                                    onClick={() => handleTransferHost(p.id)}
                                    className="text-[10px] bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/25 px-2 py-1 rounded-lg transition-all cursor-pointer font-bold"
                                    title="Promote to Host"
                                  >
                                    Make Host
                                  </button>
                                  <button
                                    onClick={() => handleForceToggleSpectator(p.id)}
                                    className="text-[10px] bg-purple-500/10 hover:bg-purple-500/25 text-purple-400 border border-purple-500/25 px-2 py-1 rounded-lg transition-all cursor-pointer font-bold"
                                    title="Force Spectate"
                                  >
                                    Switch to Spect
                                  </button>
                                  <button
                                    onClick={() => handleKickPlayer(p.id)}
                                    className="text-[10px] bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 px-2 py-1 rounded-lg transition-all cursor-pointer font-bold"
                                    title="Kick Player"
                                  >
                                    Kick
                                  </button>
                                </div>
                              )}

                              {/* Ready check indicator */}
                              {!p.isHost && (
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                                  p.isReady 
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                    : 'bg-[#151515] border-[#2e2e2e] text-neutral-500'
                                }`}>
                                  {p.isReady ? t.ready : t.notReady}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Spectators list (Placed separately at the bottom of the card) */}
                    {gameState.players.some(p => p.role === 'spectator') && (
                      <div className="pt-4 border-t border-[#2a2a2a]/60 space-y-2 text-left">
                        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">
                          Spectators ({gameState.players.filter(p => p.role === 'spectator').length})
                        </span>
                        <div className="flex flex-col gap-2">
                          {gameState.players.filter(p => p.role === 'spectator').map((p) => {
                            const isMe = p.id === playerId;
                            return (
                              <div 
                                key={p.id}
                                className={`group flex items-center justify-between p-3 rounded-xl border text-xs font-semibold ${
                                  isMe 
                                    ? 'bg-blue-950/40 border-blue-800/30 text-blue-400' 
                                    : p.isConnected 
                                      ? 'bg-[#151515] border-[#252525]' 
                                      : 'bg-[#151515]/30 border-transparent text-neutral-600 opacity-50'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="h-1.5 w-1.5 rounded-full bg-neutral-500 shrink-0" />
                                  <span className="truncate">{p.name}</span>
                                  {isMe && <span className="text-[8px] font-black uppercase text-blue-400 bg-blue-500/10 px-1 rounded ml-1 shrink-0">Me</span>}
                                </div>
                                
                                {isHost && !isMe && p.isConnected && (
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 shrink-0">
                                    <button
                                      onClick={() => handleTransferHost(p.id)}
                                      className="text-[9px] bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold"
                                      title="Promote to Host"
                                    >
                                      Make Host
                                    </button>
                                    <button
                                      onClick={() => handleForceToggleSpectator(p.id)}
                                      className="text-[9px] bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold"
                                      title="Force Active Player"
                                    >
                                      Switch to Player
                                    </button>
                                    <button
                                      onClick={() => handleKickPlayer(p.id)}
                                      className="text-[9px] bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/25 px-1.5 py-0.5 rounded transition-all cursor-pointer font-bold"
                                      title="Kick Player"
                                    >
                                      Kick
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
 
                  {/* Ready Check Trigger for players / Force Start for host */}
                  <div className="pt-4 border-t border-[#2a2a2a] flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      {!currentPlayer?.isHost ? (
                        <button
                          type="button"
                          onClick={handleToggleReady}
                          disabled={isSpectator}
                          className={`flex-1 py-3 font-bold rounded-xl border transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                            isSpectator
                              ? 'bg-[#1e1e1e] border-[#2e2e2e] text-neutral-500 cursor-not-allowed'
                              : currentPlayer?.isReady
                                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                                : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white'
                          }`}
                        >
                          {currentPlayer?.isReady ? <UserCheck className="h-4 w-4" /> : null}
                          {isSpectator ? 'Spectating' : currentPlayer?.isReady ? t.notReady : t.imReady}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleForceStart}
                          disabled={gameState.players.filter(p => p.role !== 'spectator').length < 1}
                          className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-xl border border-blue-500 disabled:border-transparent transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                        >
                          <Play className="h-4 w-4" />
                          {t.forceStartGame} ({gameState.players.filter(p => p.role !== 'spectator').length} Players)
                        </button>
                      )}
 
                      {/* Spectator Toggle Button */}
                      <button
                        type="button"
                        onClick={handleToggleSpectator}
                        title={isSpectator ? "Join as Player" : "Become Spectator"}
                        className={`py-3 px-4 font-bold rounded-xl border transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                          isSpectator
                            ? 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white font-black'
                            : 'bg-[#2a2a2a] hover:bg-[#323232] border-[#3e3e3e] text-neutral-200'
                        }`}
                      >
                        <Eye className={`h-5 w-5 ${isSpectator ? 'text-white' : 'text-neutral-400'}`} />
                      </button>
                    </div>
                  </div>
                </div>
 
                {/* Right Side: Host Configuration Panels or Non-host basic info */}
                <div className="lg:col-span-5 space-y-6">
                  {isHost ? (
                    <>
                      <SettingsPanel 
                        settings={gameState.settings} 
                        onUpdateSettings={handleUpdateSettings} 
                        isHost={isHost} 
                      />
 
                      <WordPackManager 
                        activePacks={gameState.settings.activePacks}
                        customPacks={gameState.customPacks}
                        onUpdatePacks={handleUpdatePacks}
                        isHost={isHost}
                        multiplePacksEnabled={gameState.settings.multiplePacksEnabled || false}
                        onToggleMultiplePacks={(enabled) => handleUpdateSettings({ multiplePacksEnabled: enabled })}
                        onErrorAlert={(msg) => {
                          setErrorMessage(msg);
                          setTimeout(() => setErrorMessage(''), 5000);
                        }}
                      />
                    </>
                  ) : (
                    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-4 text-left select-none">
                      <div>
                        <h3 className="font-sans font-bold text-sm text-neutral-200 uppercase tracking-wider">
                          Match Customization
                        </h3>
                        <p className="text-[10px] font-mono text-neutral-500 uppercase mt-0.5 font-bold">
                          Configuration Summary
                        </p>
                      </div>

                      <div className="space-y-3 pt-2 text-xs text-neutral-300">
                        <div className="flex justify-between items-center bg-[#151515] p-3 rounded-xl border border-[#252525]">
                          <span className="text-neutral-450 font-medium">Round Timer</span>
                          <span className="font-mono font-bold text-neutral-200">{Math.floor(gameState.settings.discussionTimer / 60)}:00</span>
                        </div>
                        <div className="flex justify-between items-center bg-[#151515] p-3 rounded-xl border border-[#252525]">
                          <span className="text-neutral-450 font-medium">Player Slots</span>
                          <span className="font-mono font-bold text-neutral-200">{gameState.players.length} / {gameState.settings.maxPlayers}</span>
                        </div>
                        <div className="flex justify-between items-center bg-[#151515] p-3 rounded-xl border border-[#252525]">
                          <span className="text-neutral-450 font-medium">Active Packs</span>
                          <span className="font-mono font-bold text-neutral-200">
                            {gameState.settings.activePacks.length} selected
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* REVEAL PHASE */}
            {gameState.phase === 'REVEAL' && (() => {
              const notReadyPlayers = gameState.players.filter(p => p.role && p.role !== 'spectator' && !p.isReady);
              const notReadyCount = notReadyPlayers.length;

              return (
                <div className="max-w-md w-full mx-auto text-center space-y-8 py-8 select-none">
                  {(!cardFlipped && !isSpectator) ? (
                    <div 
                      onClick={() => {
                        soundManager.playCardFlip();
                        setCardFlipped(true);
                      }}
                      className="bg-[#121212] border border-[#222222] hover:border-blue-500/40 rounded-2xl p-12 flex flex-col items-center justify-center space-y-6 cursor-pointer min-h-[320px] shadow-2xl transition-all duration-300 transform hover:scale-[1.01]"
                    >
                      <div className="h-16 w-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center text-blue-400 mb-2 animate-pulse">
                        <Eye className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-2xl font-black text-white tracking-widest uppercase">
                          Tap card
                        </h2>
                        <p className="text-xs text-neutral-400 tracking-wider uppercase">
                          to reveal your identity
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-fade-in min-h-[320px] flex flex-col justify-between">
                      <div className="space-y-6">
                        {currentPlayer?.role === 'spy' ? (
                          <div className="space-y-2">
                            <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
                              You are
                            </p>
                            <h2 className="text-4xl sm:text-5xl font-black text-rose-500 tracking-wide uppercase">
                              The Spy
                            </h2>
                            <p className="text-xs text-neutral-400 max-w-xs mx-auto pt-3 leading-relaxed">
                              {t.spyGoal}
                            </p>
                          </div>
                        ) : (isSpectator || !currentPlayer?.role) ? (
                          <div className="space-y-2">
                            <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
                              You are
                            </p>
                            <h2 className="text-4xl sm:text-5xl font-black text-purple-400 tracking-wide uppercase">
                              Spectator
                            </h2>
                            <p className="text-xs text-neutral-400 max-w-xs mx-auto pt-3">
                              Watch the match and enjoy.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
                                You are
                              </p>
                              <h2 className="text-4xl sm:text-5xl font-black text-[#3b82f6] tracking-wide uppercase">
                                Not the spy
                              </h2>
                            </div>
                            
                            <div className="space-y-2 pt-2">
                              <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
                                We are in a
                              </p>
                              <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-widest bg-neutral-900 border border-neutral-800 rounded-xl py-3.5 px-6 inline-block shadow-xl uppercase">
                                {gameState.secretWord}
                              </h3>
                            </div>

                            <p className="text-xs text-neutral-400 max-w-xs mx-auto pt-2 leading-relaxed">
                              {t.civilianGoal}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Wide OK button at the bottom center */}
                      <div className="space-y-3 pt-6">
                        <button
                          type="button"
                          onClick={handleReadyReveal}
                          disabled={currentPlayer?.isReady || isSpectator}
                          className={`w-full max-w-xs py-3.5 px-8 font-black rounded-xl border tracking-widest uppercase shadow-xl transition-all duration-200 text-sm cursor-pointer ${
                            currentPlayer?.isReady 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-not-allowed' 
                              : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white hover:scale-[1.01]'
                          }`}
                        >
                          {currentPlayer?.isReady ? 'Awaiting Teammates...' : 'OK'}
                        </button>

                        <div className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase mt-2">
                          {notReadyCount === 1 ? (
                            <span className="text-amber-500/80 animate-pulse">Awaiting {notReadyPlayers[0].name.toUpperCase()}</span>
                          ) : (
                            <span>Awaiting {notReadyCount} Player(s)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* DISCUSSION PHASE */}
            {gameState.phase === 'DISCUSSION' && (() => {
              const activePackIds = gameState.currentPackId 
                ? [gameState.currentPackId] 
                : (gameState.settings.activePacks || []);
              const allPacksInPlay = [
                ...BUILT_IN_PACKS,
                ...(gameState.customPacks || [])
              ].filter(p => activePackIds.includes(p.id));
              const allActiveWords = Array.from(new Set(allPacksInPlay.flatMap(p => p.words))).sort();
              
              const mid = Math.ceil(allActiveWords.length / 2);
              const col1 = allActiveWords.slice(0, mid);
              const col2 = allActiveWords.slice(mid);

              return (
                <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start py-6 text-center select-none">
                  
                  {/* Left Column (Locations and timer info) */}
                  <div className="lg:col-span-8 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-6">
                    {/* Phase Title */}
                    <div className="space-y-1">
                      <h2 className="text-xs font-bold font-mono tracking-widest text-neutral-500 uppercase">
                        Question time
                      </h2>
                      {/* Timer */}
                      <p className={`font-mono text-5xl sm:text-6xl font-black tracking-wider ${
                        gameState.timerValue <= 10 ? 'text-rose-500 animate-pulse' : 'text-white'
                      }`}>
                        {Math.floor(gameState.timerValue / 60)}:{(gameState.timerValue % 60).toString().padStart(2, '0')}
                      </p>
                    </div>

                    {/* Two-column location list */}
                    {allActiveWords.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-12 sm:gap-x-24 gap-y-2.5 max-w-lg mx-auto text-left pt-6 border-t border-neutral-900">
                        <div className="space-y-2">
                          {col1.map(word => {
                            const isMySecret = word === gameState.secretWord;
                            return (
                              <div 
                                key={word} 
                                className={`text-[13px] sm:text-sm tracking-wide transition-colors ${
                                  isMySecret && currentPlayer?.role !== 'spy'
                                    ? 'text-[#3b82f6] font-bold'
                                    : 'text-neutral-400'
                                }`}
                              >
                                {word}
                              </div>
                            );
                          })}
                        </div>
                        <div className="space-y-2">
                          {col2.map(word => {
                            const isMySecret = word === gameState.secretWord;
                            return (
                              <div 
                                key={word} 
                                className={`text-[13px] sm:text-sm tracking-wide transition-colors ${
                                  isMySecret && currentPlayer?.role !== 'spy'
                                    ? 'text-[#3b82f6] font-bold'
                                    : 'text-neutral-400'
                                }`}
                              >
                                {word}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Role peeker / Location help banner at the bottom */}
                    <div className="pt-6 border-t border-neutral-900 flex flex-col items-center justify-center space-y-4">
                      {currentPlayer?.role === 'spy' ? (
                        <span className="text-xs text-rose-500 font-mono font-bold tracking-widest uppercase bg-rose-500/5 px-3.5 py-2 rounded-xl border border-rose-500/10">
                          You are the spy — deduce the location!
                        </span>
                      ) : (isSpectator || !currentPlayer?.role) ? (
                        <span className="text-xs text-neutral-400 font-mono font-bold tracking-widest uppercase bg-neutral-900 px-3.5 py-2 rounded-xl border border-neutral-800">
                          You are spectating the match
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase block">Your Secret Location</span>
                          <span className="text-sm text-[#3b82f6] font-extrabold tracking-widest uppercase bg-blue-600/5 px-4 py-2 rounded-xl border border-blue-500/10 inline-block">
                            {gameState.secretWord}
                          </span>
                        </div>
                      )}

                      {/* Host Controls */}
                      {isHost && (
                        <div className="flex justify-center gap-3 pt-2">
                          <button
                            onClick={handleSkipDiscussion}
                            className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-neutral-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            Force Vote Now
                          </button>
                          <button
                            onClick={() => handleAdjustTimer(30)}
                            className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-neutral-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            +30 Seconds
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column (Players and Points) */}
                  <div className="lg:col-span-4 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5 space-y-4 text-left">
                    <div className="border-b border-[#2a2a2a] pb-3 flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">Players & Score</span>
                      <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">{gameState.players.length} Active</span>
                    </div>

                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {gameState.players.map(p => {
                        const isMe = p.id === playerId;
                        const isSpectating = p.role === 'spectator';
                        return (
                          <div 
                            key={p.id} 
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                              isMe 
                                ? 'bg-blue-950/20 border-blue-800/30 text-blue-400' 
                                : 'bg-[#151515] border-[#252525] text-neutral-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`h-1.5 w-1.5 rounded-full ${p.isConnected ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
                              <span className={`font-semibold truncate max-w-[130px] ${isMe ? 'text-[#3b82f6] font-bold' : ''}`}>
                                {p.name}
                              </span>
                              {isSpectating && (
                                <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1 rounded uppercase font-bold shrink-0">Spec</span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-neutral-400 shrink-0">{p.score} pts</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* VOTING PHASE */}
            {gameState.phase === 'VOTING' && (() => {
              const voteCounts: { [key: string]: number } = {};
              gameState.players.forEach(p => {
                if (p.votedFor) {
                  voteCounts[p.votedFor] = (voteCounts[p.votedFor] || 0) + 1;
                }
              });

              return (
                <div className="max-w-md w-full mx-auto space-y-8 text-center pt-8 select-none">
                  {/* Header */}
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white tracking-wider uppercase">
                      Time's up!
                    </h2>
                    <p className="text-xl font-bold text-neutral-300">
                      Who is the <span className="text-red-500 font-extrabold uppercase">spy</span>?
                    </p>
                    <p className="text-xs text-neutral-500 tracking-wider">
                      The vote will end when consensus is reached.
                    </p>
                  </div>

                  {/* Vertical list of candidates */}
                  <div className="space-y-3.5 max-w-xs mx-auto">
                    {gameState.players
                      .filter(p => p.role !== 'spectator')
                      .map(p => {
                        const isMe = p.id === playerId;
                        const hasVotedForThem = currentPlayer?.votedFor === p.id;
                        const votesReceived = voteCounts[p.id] || 0;
                        
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isMe || isSpectator}
                            onClick={() => handleSubmitVote(p.id)}
                            className={`w-full p-4 rounded-xl border text-sm transition-all text-left ${
                              isMe
                                ? 'bg-[#121212] border-neutral-900 text-neutral-600 cursor-not-allowed opacity-50'
                                : hasVotedForThem
                                  ? 'bg-[#252525] border-blue-500/50 text-white shadow-lg shadow-blue-500/5'
                                  : 'bg-[#181818] border-neutral-800 text-neutral-400 hover:bg-[#202020] hover:border-neutral-700 active:scale-[0.99] cursor-pointer'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-extrabold text-base truncate text-neutral-100">{p.name}</span>
                                {votesReceived > 0 && (
                                  <span className="text-[11px] font-mono font-black bg-amber-500/10 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full shrink-0">
                                    {votesReceived}
                                  </span>
                                )}
                              </div>
                              {hasVotedForThem && (
                                <span className="text-[10px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 shadow-md shadow-blue-600/20">
                                  My Vote
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>

                  {/* Footer Stats info */}
                  <div className="pt-6 border-t border-neutral-950 flex justify-between items-center text-[10px] text-neutral-550 font-mono tracking-wider">
                    <span>VOTES CAST: {gameState.players.filter(p => p.role && p.role !== 'spectator' && p.votedFor).length} / {gameState.players.filter(p => p.role && p.role !== 'spectator' && p.isConnected).length}</span>
                    <span>{gameState.timerValue}s remaining</span>
                  </div>
                </div>
              );
            })()}

            {/* SPY GUESS PHASE */}
            {gameState.phase === 'SPY_GUESS' && (() => {
              const activePackIds = gameState.currentPackId 
                ? [gameState.currentPackId] 
                : (gameState.settings.activePacks || []);
              const allPacksInPlay = [
                ...BUILT_IN_PACKS,
                ...(gameState.customPacks || [])
              ].filter(p => activePackIds.includes(p.id));
              const allActiveWords = Array.from(new Set(allPacksInPlay.flatMap(p => p.words))).sort();
              
              const spyPlayer = gameState.players.find(p => p.role === 'spy');
              const votedOutPlayer = gameState.players.find(p => p.id === gameState.votedOutPlayerId);
              const isSpyFound = votedOutPlayer?.role === 'spy';
              const isSpyPlayer = currentPlayer?.role === 'spy';

              if (revealStep === 'reveal') {
                const spyName = spyPlayer?.name || "The Spy";
                return (
                  <div className="max-w-md w-full mx-auto bg-[#1a1a1a] border border-neutral-800 rounded-3xl p-8 space-y-6 text-center select-none shadow-2xl relative overflow-hidden">
                    <div className="space-y-3 relative z-10">
                      {isSpyFound ? (
                        <div className="space-y-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            🕵️‍♂️ Spy Found!
                          </span>
                          <h1 className="font-sans font-black text-3xl text-emerald-400 uppercase tracking-tight leading-none">
                            We Found The Spy!
                          </h1>
                          <p className="text-sm text-neutral-300 font-medium">
                            The Spy was indeed <span className="text-emerald-300 font-bold underline decoration-emerald-500/40 decoration-2">{votedOutPlayer?.name}</span>!
                          </p>
                          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                            They must now attempt to guess the Secret Location to steal the win!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                            🚨 Spy Escaped!
                          </span>
                          <h1 className="font-sans font-black text-3xl text-rose-500 uppercase tracking-tight leading-none">
                            The Spy Escaped!
                          </h1>
                          <p className="text-sm text-neutral-300 font-medium">
                            You voted out <span className="text-rose-400 font-bold">{votedOutPlayer ? votedOutPlayer.name : 'Nobody'}</span> (Civilian)!
                          </p>
                          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                            The real spy was <strong className="text-rose-300 font-bold">{spyName}</strong>, who now gets to guess the location.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress Loading bar */}
                    <div className="space-y-2 relative z-10 pt-2">
                      <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                        <div 
                          className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                            isSpyFound ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${(revealCountdown / 6) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-neutral-500 font-mono uppercase tracking-wider">
                        <span>Loading guess panel...</span>
                        <span className="font-bold">{revealCountdown}s</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="max-w-md w-full mx-auto bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-6 text-center select-none">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase">
                      Final Guess
                    </span>
                    <h2 className="font-sans font-black text-2xl text-rose-500 tracking-wider uppercase">
                      Spy guessing word
                    </h2>
                    <p className="text-xs text-neutral-400">
                      {isSpyPlayer 
                        ? "Select the secret location below to win the game!" 
                        : "The spy is selecting the secret location. Will they guess correctly?"}
                    </p>
                  </div>

                  {isSpyPlayer ? (
                    <div className="space-y-4">
                      {/* Grid of clickable locations */}
                      <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-1 bg-[#151515] border border-[#252525] rounded-xl text-left">
                        {allActiveWords.map(word => {
                          const isSelected = spyGuessValue === word;
                          return (
                            <button
                              key={word}
                              type="button"
                              onClick={() => {
                                soundManager.playClick();
                                setSpyGuessValue(word);
                              }}
                              className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                                  : 'bg-[#1c1c1c] border-[#2c2c2c] text-neutral-400 hover:text-white hover:bg-[#252525]'
                              }`}
                            >
                              {word}
                            </button>
                          );
                        })}
                      </div>

                      {/* Manual text input as fallback if they want, but hidden/simplified to clean up */}
                      {spyGuessValue && (
                        <div className="animate-fade-in bg-blue-950/20 border border-blue-800/30 p-3 rounded-xl flex items-center justify-between text-xs text-blue-400">
                          <span className="font-medium">Selected:</span>
                          <span className="font-bold uppercase tracking-wider text-sm">{spyGuessValue}</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          if (!roomId || !spyGuessValue.trim()) return;
                          soundManager.playClick();
                          socket.emit('submit_spy_guess', { roomId, playerId, word: spyGuessValue.trim() });
                          setSpyGuessValue('');
                        }}
                        disabled={!spyGuessValue}
                        className={`w-full py-3 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          spyGuessValue
                            ? 'bg-rose-600 hover:bg-rose-500 border border-rose-500 text-white'
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed'
                        }`}
                      >
                        <Send className="h-4 w-4" />
                        SUBMIT FINAL GUESS ({gameState.timerValue}s left)
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 bg-[#151515] border border-[#252525] rounded-xl space-y-4">
                      <div className="mx-auto h-12 w-12 rounded-full border border-neutral-800 bg-[#1a1a1a] flex items-center justify-center text-neutral-500">
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase">WAITING ON THE SPY...</p>
                        <p className="text-[11px] text-neutral-500 leading-relaxed">Please remain silent while the spy ({spyPlayer ? spyPlayer.name : 'Unknown'}) tries to recall the options.</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* SCOREBOARD PHASE */}
            {gameState.phase === 'SCOREBOARD' && (() => {
              const isSpy = currentPlayer?.role === 'spy';
              const spyWins = gameState.roundWinner === 'spies';
              const didIWin = (isSpy && spyWins) || (!isSpy && !spyWins);

              const spyPlayer = gameState.players.find(p => p.role === 'spy');

              return (
                <div className="max-w-md w-full mx-auto bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-6 text-center select-none animate-fade-in">
                  {/* Win/Lose Splash */}
                  <div className="space-y-1">
                    {didIWin ? (
                      <>
                        <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-500 uppercase">
                          Victory
                        </span>
                        <h2 className="font-sans font-black text-3xl text-emerald-400 tracking-wide uppercase">
                          You win!
                        </h2>
                        <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                          {spyWins 
                            ? `The Spy (${spyPlayer ? spyPlayer.name : 'Unknown'}) successfully guessed the Secret Location "${gameState.spyGuessWord}" and won the game!`
                            : `The Spy (${spyPlayer ? spyPlayer.name : 'Unknown'}) failed to guess the Secret Location. Citizens win!`}
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-mono font-bold tracking-widest text-rose-500 uppercase">
                          Defeat
                        </span>
                        <h2 className="font-sans font-black text-3xl text-rose-500 tracking-wide uppercase">
                          You lose
                        </h2>
                        <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                          {spyWins 
                            ? `The Spy (${spyPlayer ? spyPlayer.name : 'Unknown'}) successfully guessed the Secret Location "${gameState.spyGuessWord}" and won the game!`
                            : `The Spy (${spyPlayer ? spyPlayer.name : 'Unknown'}) failed to guess the Secret Location. Citizens win!`}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Secret Location Card */}
                    <div className="bg-[#151515] border border-[#252525] p-4 rounded-xl space-y-1 flex flex-col justify-center">
                      <p className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase">
                        Secret Location
                      </p>
                      <p className="text-xl font-black text-[#3b82f6] uppercase tracking-wider">
                        {gameState.secretWord}
                      </p>
                    </div>

                    {/* Spy's guess card */}
                    <div className="bg-[#151515] border border-[#252525] p-4 rounded-xl space-y-1 flex flex-col justify-center">
                      <p className="text-[10px] font-mono font-bold tracking-widest text-neutral-500 uppercase">
                        Spy's Guess
                      </p>
                      <p className="text-xl font-black text-rose-500 uppercase tracking-wider truncate">
                        {gameState.spyGuessWord || "None"}
                      </p>
                      <p className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-wide">
                        {gameState.spyGuessSuccess ? "🎯 Correct" : "❌ Incorrect"}
                      </p>
                    </div>
                  </div>

                  {/* Leaderboard Standing (Simplified) */}
                  <div className="space-y-3 text-left">
                    <h3 className="text-[10px] font-bold font-mono tracking-widest text-neutral-500 uppercase border-b border-neutral-800 pb-1.5">
                      Standings
                    </h3>
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                      {gameState.players
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .map((p, idx) => {
                          const isMe = p.id === playerId;
                          return (
                            <div key={p.id} className="flex justify-between items-center text-xs bg-[#151515] border border-[#252525] p-2.5 rounded-xl">
                              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                                <span className="text-neutral-500 font-mono text-[10px]">{idx + 1}.</span>
                                <span className={isMe ? 'text-[#3b82f6]' : ''}>{p.name}</span>
                                {isMe && <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/10 px-1 rounded uppercase font-bold shrink-0">YOU</span>}
                              </span>
                              <span className="font-mono text-neutral-400 font-bold shrink-0">{p.score} pts</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Play Again & Leave Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {isHost ? (
                      <button
                        onClick={handleNextRound}
                        className="py-3 bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        Play Again
                      </button>
                    ) : (
                      <div className="bg-[#151515] border border-[#252525] text-neutral-500 font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center">
                        Awaiting host...
                      </div>
                    )}
                    <button
                      onClick={handleLeaveRoom}
                      className="py-3 bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-neutral-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* END GAME PHASE */}
            {gameState.phase === 'END_GAME' && (() => {
              const sorted = gameState.players.slice().sort((a, b) => b.score - a.score);
              const winnerPlayer = sorted[0];
              const isWinnerMe = winnerPlayer?.id === playerId;

              return (
                <div className="max-w-md w-full mx-auto bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-6 text-center select-none">
                  {/* Game Concluded Header */}
                  <div className="space-y-1">
                    {isWinnerMe ? (
                      <>
                        <span className="text-[10px] font-mono font-bold tracking-widest text-amber-500 uppercase">
                          Grand Winner
                        </span>
                        <h2 className="font-sans font-black text-3xl text-amber-400 tracking-wide uppercase">
                          Match Victory!
                        </h2>
                        <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                          Congratulations! You achieved the grand championship!
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] font-mono font-bold tracking-widest text-neutral-400 uppercase">
                          Finished
                        </span>
                        <h2 className="font-sans font-black text-3xl text-neutral-200 tracking-wide uppercase">
                          Match Concluded
                        </h2>
                        <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                          {winnerPlayer ? `${winnerPlayer.name} has won the match!` : 'Match has ended.'}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Grand Champion Badge */}
                  {winnerPlayer && (
                    <div className="bg-[#151515] border border-amber-500/20 p-5 rounded-xl flex flex-col items-center justify-center space-y-1 relative max-w-xs mx-auto">
                      <div className="absolute -top-3.5 bg-amber-500 text-neutral-950 p-1 rounded-full border-2 border-[#1e1e1e]">
                        <Crown className="h-4 w-4" />
                      </div>
                      <span className="text-[9px] font-mono font-bold tracking-widest text-neutral-500 uppercase pt-2">GRAND CHAMPION</span>
                      <h3 className="font-sans font-bold text-lg text-amber-300">{winnerPlayer.name}</h3>
                      <p className="text-xs font-mono font-bold text-neutral-400">{winnerPlayer.score} points</p>
                    </div>
                  )}

                  {/* Best Detective Accolade */}
                  {(() => {
                    const playersWithVotes = gameState.players.filter(p => p.correctVotes && p.correctVotes > 0);
                    const maxCorrect = playersWithVotes.length > 0 
                      ? Math.max(...playersWithVotes.map(p => p.correctVotes || 0)) 
                      : 0;
                    const bestDetectives = maxCorrect > 0 
                      ? playersWithVotes.filter(p => p.correctVotes === maxCorrect)
                      : [];

                    if (bestDetectives.length === 0) return null;

                    return (
                      <div className="bg-[#151515] border border-emerald-500/25 p-4 rounded-xl flex flex-col items-center justify-center space-y-1 relative max-w-xs mx-auto mt-4">
                        <div className="absolute -top-3 bg-emerald-500 text-neutral-950 px-2 py-0.5 rounded-full border border-[#1e1e1e] text-[9px] font-mono font-bold tracking-widest uppercase">
                          ⭐ Best Detective
                        </div>
                        <h3 className="font-sans font-bold text-sm text-emerald-300 pt-1.5">
                          {bestDetectives.map(p => p.name).join(', ')}
                        </h3>
                        <p className="text-[10px] font-mono font-bold text-neutral-400">
                          Most Correct Votes: {maxCorrect}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Standings list */}
                  <div className="space-y-3 text-left">
                    <h3 className="text-[10px] font-bold font-mono tracking-widest text-neutral-500 uppercase border-b border-neutral-800 pb-1.5">
                      Final Standings
                    </h3>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {sorted.map((p, idx) => {
                        const isMe = p.id === playerId;
                        return (
                          <div key={p.id} className="flex justify-between items-center text-xs bg-[#151515] border border-[#252525] p-2.5 rounded-xl">
                            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                              <span className="text-neutral-500 font-mono text-[10px]">{idx + 1}.</span>
                              <span className={isMe ? 'text-[#3b82f6]' : ''}>{p.name}</span>
                              {isMe && <span className="text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/10 px-1 rounded uppercase font-bold shrink-0">YOU</span>}
                            </span>
                            <span className="font-mono text-neutral-400 font-bold shrink-0">{p.score} pts</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Play Again & Leave Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {isHost ? (
                      <button
                        onClick={handlePlayAgain}
                        className="py-3 bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        Reset & Play
                      </button>
                    ) : (
                      <div className="bg-[#151515] border border-[#252525] text-neutral-500 font-semibold text-xs py-3 px-4 rounded-xl flex items-center justify-center">
                        Awaiting host...
                      </div>
                    )}
                    <button
                      onClick={handleLeaveRoom}
                      className="py-3 bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-neutral-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Leave
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* FLOATING DEVELOPER ACTION CIRCLE BUTTON */}
      <button
        onClick={() => {
          soundManager.playClick();
          setShowDevPortal(!showDevPortal);
        }}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-2xl border border-blue-400/20 z-40 cursor-pointer transition-all animate-pulse"
        title="Open Developer Portal"
      >
        <Terminal className="h-5 w-5" />
      </button>

      {/* DEVELOPER PORTAL SYSTEM OVERLAY */}
      <AnimatePresence>
        {showDevPortal && (
          <DevPortal
            roomId={roomId || 'PREVIEW'}
            playerId={playerId || 'p1'}
            gameState={gameState || {
              roomId: roomId || 'PREVIEW',
              phase: 'LOBBY',
              players: [
                { id: playerId || 'p1', name: playerName || 'Darci (Dev)', isHost: true, isReady: true, score: 0, wins: 0, isConnected: true, votesReceived: 0, correctVotes: 0, totalVotesCast: 0 }
              ],
              settings: {
                winningScore: 5,
                discussionTimer: 480,
                votingTimer: 60,
                spyGuessTimer: 30,
                numSpies: 1,
                maxPlayers: 8,
                isPrivate: false,
                roomName: 'Social Deduction Room',
                readyCheck: true,
                randomQuestionOrder: false,
                autoNextRound: false,
                hideVotesUntilReveal: false,
                allowSpectators: true,
                manualStart: false,
                activePacks: ['classic'],
              },
              currentRound: 0,
              timerValue: 0,
              secretWord: '',
              spies: [],
              customPacks: [],
              stats: {
                gamesPlayed: 0,
                spyWins: 0,
                civilianWins: 0,
                mostCorrectVotes: [],
                highestAccuracy: 0,
              }
            }}
            socket={socket}
            onClose={() => setShowDevPortal(false)}
            localViewPreview={localViewPreview}
            onSetLocalViewPreview={(view) => {
              setLocalViewPreview(view);
            }}
          />
        )}
      </AnimatePresence>

      {/* FOOTER BAR (Only on First/Home Page) */}
      {!gameState && (
        <footer className="border-t border-[#1a1a1a] py-6 px-4 text-center text-[10px] text-neutral-500 font-mono tracking-wider z-10 select-none uppercase">
          SPYFALL CUSTOM EDITION • BUILT IN 1XDOT REALTIME ENGINE
        </footer>
      )}

      {/* Subtle Latency (Ping) Indicator on Left Bottom */}
      {roomId && (
        <div className="fixed bottom-4 left-4 z-40 text-[9px] font-mono text-neutral-600 select-none opacity-45 hover:opacity-100 transition-opacity">
          {ping !== null ? `${ping}ms` : 'connecting...'}
        </div>
      )}
    </div>
  );
}

export default App;
