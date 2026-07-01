import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { 
  Users, Copy, UserCheck, ShieldAlert, Play, Volume2, HelpCircle, 
  ArrowRight, Check, X, LogOut, Radio, Award, Compass, 
  Crown, RefreshCw, Send, AlertTriangle, CheckSquare, Zap, Eye, EyeOff,
  Terminal, Settings
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

function App() {
  // Connection states
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('spyfall_playerName') || '');
  
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  // UI control states
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [spyGuessValue, setSpyGuessValue] = useState('');
  const [showDevPortal, setShowDevPortal] = useState(false);

  // Language state
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('spyfall_language');
    return (saved as Language) || 'en';
  });

  const t = translations[language] || translations.en;

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
      reconnectionAttempts: 10,
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

    socket.on('room_created', ({ roomId, playerId }: { roomId: string, playerId: string }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      localStorage.setItem('spyfall_roomId', roomId);
      localStorage.setItem('spyfall_playerId', playerId);
      if (playerName) localStorage.setItem('spyfall_playerName', playerName);
    });

    socket.on('joined_room', ({ roomId, playerId }: { roomId: string, playerId: string }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      localStorage.setItem('spyfall_roomId', roomId);
      localStorage.setItem('spyfall_playerId', playerId);
      if (playerName) localStorage.setItem('spyfall_playerName', playerName);
    });

    socket.on('game_state_update', (updatedState: GameState) => {
      setGameState(updatedState);
      
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
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('game_state_update');
      socket.off('trigger_sfx');
      socket.off('error');
    };
  }, [playerName]);

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
  const isHost = currentPlayer?.isHost || false;
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

  const handleForceStart = () => {
    if (!roomId || !isHost) return;
    soundManager.playClick();
    socket.emit('start_game', { roomId, playerId });
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

  // UI - Render Connection Status
  const renderConnStatus = () => (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-500" title={connected ? 'Connected' : 'Reconnecting'}>
      <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500/60' : 'bg-amber-500/60 animate-pulse'}`}></span>
    </div>
  );

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
            {gameState && gameState.phase === 'LOBBY' && (
              <button
                onClick={copyRoomCode}
                className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] hover:text-white text-neutral-300 font-mono font-bold text-[11px] tracking-wider transition-all cursor-pointer"
                title="Copy Room Code"
              >
                <span>CODE: {roomId}</span>
                {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-neutral-500" />}
              </button>
            )}

            {renderConnStatus()}
            
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

             {gameState && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    soundManager.playClick();
                    socket.emit('toggle_spectator', { roomId, playerId });
                  }}
                  className={`flex items-center gap-1.5 py-1 px-3 rounded-lg border transition-all text-xs font-semibold cursor-pointer ${
                    isSpectator
                      ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20'
                      : 'bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-blue-500/10 hover:text-blue-400 text-neutral-400'
                  }`}
                  title={isSpectator ? 'Join as Active Player' : 'Join as Spectator'}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{isSpectator ? t.joinGame : t.spectator}</span>
                </button>

                <button
                  onClick={handleLeaveRoom}
                  className="flex items-center gap-1.5 py-1 px-3 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 text-neutral-400 transition-all text-xs font-semibold cursor-pointer"
                >
                  <LogOut className="h-3 w-3" />
                  <span>{t.leave}</span>
                </button>
              </div>
            )}
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
                  setLanguage(newLang);
                  localStorage.setItem('spyfall_language', newLang);
                }}
                onClose={() => setShowAudioModal(false)} 
              />
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
