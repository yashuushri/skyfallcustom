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
              className="p-1.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-355 hover:text-white transition-all group"
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

      {/* MAIN GAME CONTAINER */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center z-10">
        
        {/* PHASE 0: HOME SCREEN */}
        {!gameState && (
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
        )}

        {/* ACTIVE ROOM VIEWSTATES */}
        {gameState && (
          <div className="space-y-6">
            
            {/* Centered Phonetic Room Code header (only shown in LOBBY phase) */}
            {gameState.phase === 'LOBBY' && (
              <div className="text-center py-4 select-text bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-4">
                <div className="flex items-center justify-center gap-3">
                  <span className="text-4xl font-mono font-black tracking-widest text-neutral-100 uppercase">{roomId}</span>
                  <button
                    onClick={copyRoomCode}
                    className="p-1.5 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-[#3b82f6] hover:text-blue-400 transition-colors cursor-pointer"
                    title="Copy Room Code"
                  >
                    {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs font-semibold text-neutral-400 mt-2 tracking-wide uppercase font-mono">
                  {getPhoneticRoomName(roomId)}
                </p>
              </div>
            )}

            {/* Host Admin Panel (Only shown to Host during active game phases) */}
            {isHost && gameState.phase !== 'LOBBY' && (
              <div className="bg-[#1e1e1e] border border-amber-500/20 rounded-xl p-4 space-y-3 shadow-md select-none">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-amber-400">HOST ADMIN PANEL</span>
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">ROOM: {roomId}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {gameState.phase === 'DISCUSSION' && (
                    <button
                      onClick={handleSkipDiscussion}
                      className="py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 text-amber-400 font-bold text-xs transition-all cursor-pointer"
                    >
                      Force Voting Phase
                    </button>
                  )}
                  <button
                    onClick={() => handleAdjustTimer(30)}
                    className="py-1.5 px-3 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-200 font-bold text-xs transition-all cursor-pointer"
                  >
                    +30s Timer
                  </button>
                  <button
                    onClick={() => handleAdjustTimer(-30)}
                    className="py-1.5 px-3 rounded-lg bg-[#2a2a2a] border border-[#3e3e3e] hover:bg-[#353535] text-neutral-200 font-bold text-xs transition-all cursor-pointer"
                  >
                    -30s Timer
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to force-end the current round and return everyone to the Lobby?")) {
                        soundManager.playClick();
                        socket.emit('force_lobby', { roomId, playerId });
                      }
                    }}
                    className="py-1.5 px-3 rounded-lg bg-rose-500/10 border border-rose-500/35 hover:bg-rose-500/20 hover:border-rose-500/50 text-rose-400 font-bold text-xs transition-all md:ml-auto cursor-pointer"
                  >
                    Force Lobby
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
                      <h2 className="font-sans font-bold text-lg text-neutral-200">
                        {gameState.settings.roomName}
                      </h2>
                      <p className="text-xs text-neutral-400">
                        Connected crew ({gameState.players.length}/{gameState.settings.maxPlayers})
                      </p>
                    </div>
                  </div>

                  {/* Players list scroll container */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                      Connected Crew
                    </span>
                    {gameState.players.map((p) => {
                      const isMe = p.id === playerId;
                      return (
                        <div 
                          key={p.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
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
                                {!p.isConnected && <span className="text-[9px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded-md uppercase">DC</span>}
                              </p>
                              {p.score > 0 && <p className="text-[10px] text-neutral-400">Wins: {p.wins} ({p.score} pts)</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Host Actions on players */}
                            {isHost && !isMe && p.isConnected && (
                              <div className="flex items-center gap-1 mr-2 opacity-0 hover:opacity-100 sm:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleTransferHost(p.id)}
                                  className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold px-2 py-1 rounded-lg border border-amber-500/20 transition-all cursor-pointer"
                                  title="Promote to Host"
                                >
                                  Host
                                </button>
                                <button
                                  onClick={() => handleKickPlayer(p.id)}
                                  className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold px-2 py-1 rounded-lg border border-rose-500/20 transition-all cursor-pointer"
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

                  {/* Ready Check Trigger for players / Force Start for host */}
                  <div className="pt-4 border-t border-[#2a2a2a] flex flex-col sm:flex-row gap-3">
                    {!currentPlayer?.isHost ? (
                      <button
                        type="button"
                        onClick={handleToggleReady}
                        className={`w-full py-3 font-bold rounded-xl border transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                          currentPlayer?.isReady
                            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white'
                        }`}
                      >
                        {currentPlayer?.isReady ? <UserCheck className="h-4 w-4" /> : null}
                        {currentPlayer?.isReady ? t.notReady : t.imReady}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleForceStart}
                        disabled={gameState.players.length < 1}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-xl border border-blue-500 disabled:border-transparent transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        <Play className="h-4 w-4" />
                        {t.forceStartGame} ({gameState.players.length} Players)
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Side: Host Configuration Panels */}
                <div className="lg:col-span-5 space-y-6">
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
                  />
                </div>
              </div>
            )}

            {/* REVEAL PHASE */}
            {gameState.phase === 'REVEAL' && (
              <div className="max-w-md w-full mx-auto space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="font-sans font-bold text-xl tracking-wider text-neutral-100 uppercase">
                    Your Mission Dossier
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Keep your card private from other players!
                  </p>
                </div>

                {/* 3D Envelope flipping card */}
                <div className="perspective-1000 h-[280px] w-full relative cursor-pointer" onClick={() => {
                  if (!cardFlipped) {
                     soundManager.playCardFlip();
                     setCardFlipped(true);
                  }
                }}>
                  <motion.div
                    className="w-full h-full relative transition-transform duration-700 transform-style-3d"
                    animate={{ rotateY: cardFlipped ? 180 : 0 }}
                  >
                    {/* Front side of Card */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl border-2 border-dashed border-neutral-700/50 hover:border-blue-500/50 bg-[#161616] p-6 flex flex-col justify-between backface-hidden shadow-2xl transition-all duration-300">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase font-black">TOP SECRET // CLASSIFIED</span>
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                      </div>
                      
                      <div className="text-center space-y-4 py-4 select-none">
                        <div className="mx-auto h-20 w-20 bg-[#222222] border-2 border-neutral-700 rounded-full flex items-center justify-center shadow-lg relative group-hover:scale-105 transition-transform">
                          <EyeOff className="h-9 w-9 text-neutral-400 group-hover:text-blue-400 transition-colors" />
                          <div className="absolute inset-0 rounded-full border border-blue-500/25 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-sans font-bold text-sm text-neutral-300 tracking-wide">
                            {t.tapCardToFlip}
                          </h3>
                        </div>
                      </div>

                      <div className="text-center text-[10px] text-neutral-600 font-mono tracking-wider uppercase">
                        DO NOT SHOW TO ANYONE • ROUND {gameState.currentRound}
                      </div>
                    </div>

                    {/* Back side of Card (Revealed content) */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl border border-[#2e2e2e] bg-[#1e1e1e] p-6 flex flex-col justify-between backface-hidden rotateY-180 shadow-xl">
                      <div className="flex justify-between items-start border-b border-[#2a2a2a] pb-2">
                        <span className="text-[10px] font-mono tracking-widest text-blue-400 uppercase font-bold">REVEALED ROLE</span>
                        <span className="text-xs text-neutral-500 font-mono font-medium">ROUND {gameState.currentRound}</span>
                      </div>

                      {/* Display Secret Role */}
                      <div className="text-center space-y-4 py-2">
                        {currentPlayer?.role === 'spy' ? (
                          <div className="space-y-3">
                            <h3 className="font-sans font-black text-2xl text-rose-500 tracking-wider uppercase">
                              {t.youAreSpy}
                            </h3>
                            <div className="h-[1px] w-12 bg-rose-500/30 mx-auto" />
                            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                              {t.spyGoal}
                            </p>
                          </div>
                        ) : (isSpectator || !currentPlayer?.role) ? (
                          <div className="space-y-3">
                            <h3 className="font-sans font-black text-2xl text-neutral-300 tracking-wider uppercase">
                              {t.youAreSpectator}
                            </h3>
                            <div className="h-[1px] w-12 bg-neutral-700 mx-auto" />
                            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                              Watch the match and enjoy.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <h3 className="font-sans font-black text-2xl text-blue-400 tracking-wider uppercase">
                              {t.youAreCivilian}
                            </h3>
                            <div className="h-[1px] w-12 bg-blue-500/30 mx-auto" />
                            <div className="space-y-1 pt-1">
                              <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono font-bold">{t.secretLocation}</p>
                              <h4 className="font-sans font-black text-xl text-blue-300 tracking-wide py-1 bg-[#151515] border border-[#2c2c2c] rounded-lg">
                                {gameState.secretWord}
                              </h4>
                            </div>
                            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                              {t.civilianGoal}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="text-center text-[10px] text-rose-400/85 font-mono">
                        DO NOT SHARE THIS INFORMATION
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Ready Check button */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={handleReadyReveal}
                    disabled={currentPlayer?.isReady || !cardFlipped || isSpectator}
                    className={`w-full py-3 font-bold rounded-xl border transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                      currentPlayer?.isReady 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : 'bg-blue-600 hover:bg-blue-500 border-blue-500 disabled:opacity-40 text-white'
                    }`}
                  >
                    {currentPlayer?.isReady ? <Check className="h-4 w-4" /> : null}
                    {currentPlayer?.isReady ? 'AWAITING TEAMMATES...' : t.imReady}
                  </button>

                  <div className="flex justify-between items-center text-xs font-mono text-neutral-500 px-1">
                    <span>DOSSIERS OPENED</span>
                    <span>
                      READY: {gameState.players.filter(p => p.role && p.role !== 'spectator' && p.isReady).length} / {gameState.players.filter(p => p.role && p.role !== 'spectator').length}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* DISCUSSION PHASE */}
            {gameState.phase === 'DISCUSSION' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Left side: Turn Circle & Timer panel */}
                <div className="md:col-span-4 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 flex flex-col items-center space-y-6 relative">
                  
                  {/* Timer Header */}
                  <div className="text-center space-y-1">
                    <h3 className="font-sans font-extrabold text-base text-neutral-100">{t.interrogateHeader}</h3>
                  </div>

                  {/* Circular visual timer */}
                  <div className="relative h-44 w-44 flex items-center justify-center bg-[#151515] rounded-full border border-[#2e2e2e]">
                    <svg className="absolute inset-0 h-full w-full -rotate-90">
                      <circle
                        cx="88"
                        cy="88"
                        r="80"
                        className="stroke-[#222222] fill-none"
                        strokeWidth="5"
                      />
                      <circle
                        cx="88"
                        cy="88"
                        r="80"
                        className={`fill-none transition-all duration-1000 ${
                          gameState.timerValue <= 30 ? 'stroke-rose-500' : 'stroke-blue-500'
                        }`}
                        strokeWidth="5"
                        strokeDasharray={2 * Math.PI * 80}
                        strokeDashoffset={2 * Math.PI * 80 * (1 - gameState.timerValue / gameState.settings.discussionTimer)}
                        strokeLinecap="round"
                      />
                    </svg>

                    <div className="text-center z-10 space-y-0.5">
                      <p className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">{t.timeLeft}</p>
                      <p className={`font-mono text-3xl font-black ${gameState.timerValue <= 30 ? 'text-rose-400 animate-pulse' : 'text-neutral-100'}`}>
                        {Math.floor(gameState.timerValue / 60)}:{(gameState.timerValue % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>

                  {/* Current Question Speaker Indicator */}
                  {gameState.players.find(p => p.id === (gameState as any).currentSpeakerId) && (
                    <div className="w-full bg-[#151515] p-4 rounded-xl border border-[#2e2e2e] space-y-2 text-center">
                      <p className="text-[10px] font-mono font-bold tracking-wider text-neutral-500 uppercase">{t.activeSpeaker}</p>
                      <h4 className="font-sans font-bold text-sm text-blue-400 flex items-center justify-center gap-2">
                        <Radio className="h-4 w-4 text-blue-500 animate-pulse shrink-0" />
                        {gameState.players.find(p => p.id === (gameState as any).currentSpeakerId)?.name}
                      </h4>
                      
                      {/* Pass turn actions */}
                      {(gameState as any).currentSpeakerId === playerId ? (
                        <button
                          onClick={handleNextTurn}
                          className="mt-1 py-1 px-3 bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                        >
                          {t.passTurn}
                        </button>
                      ) : (
                        <p className="text-[10px] text-neutral-500 italic">They are speaking. Ask them questions!</p>
                      )}
                    </div>
                  )}

                  {/* Skip Discussion / Vote early triggers */}
                  <div className="w-full pt-2">
                    <button
                      onClick={handleSkipDiscussion}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        currentPlayer?.isReady 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                          : 'bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-neutral-200'
                      }`}
                    >
                      {isHost 
                        ? t.forceVoteNow 
                        : currentPlayer?.isReady 
                          ? 'VOTED TO SKIP DISCUSSION' 
                          : t.skipDiscussion}
                    </button>
                    {!isHost && (
                      <p className="text-[9px] text-neutral-500 text-center mt-1.5 font-semibold">
                        SKIPPED: {gameState.players.filter(p => p.role && p.role !== 'spectator' && p.isReady).length} / {Math.ceil(gameState.players.filter(p => p.role && p.role !== 'spectator').length / 2)} votes needed
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side: Interrogating Players Board & possible locations */}
                <div className="md:col-span-8 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
                    <h3 className="font-sans font-bold text-sm text-neutral-200 uppercase tracking-wide">
                      Crew Directory
                    </h3>
                    <span className="text-xs text-neutral-500 font-mono uppercase">
                      Round {gameState.currentRound}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {gameState.players.map(p => {
                      const isCurrentSpeaker = p.id === (gameState as any).currentSpeakerId;
                      const isMe = p.id === playerId;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            isCurrentSpeaker 
                              ? 'bg-blue-600/5 border-blue-500/30' 
                              : 'bg-[#151515] border-[#252525]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 border ${isCurrentSpeaker ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-[#222222] border-[#2e2e2e] text-neutral-500'}`}>
                              <Users className="h-3.5 w-3.5" />
                            </div>
                            <div className="truncate">
                              <p className="text-sm font-semibold truncate flex items-center gap-1.5 text-neutral-200">
                                {p.name}
                                {isMe && <span className="text-[9px] text-blue-400 font-bold bg-blue-500/10 px-1 py-0.5 rounded uppercase font-mono">YOU</span>}
                                {p.role === 'spectator' && <span className="text-[8px] text-neutral-400 bg-neutral-800 px-1 rounded uppercase">SPEC</span>}
                              </p>
                              <p className="text-[10px] text-neutral-400">Score: {p.score}</p>
                            </div>
                          </div>

                          {isCurrentSpeaker && (
                            <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                              SPEAKING
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Active locations lists so players/Spy can easily cross-reference */}
                  {(() => {
                    const activePackIds = gameState.settings.activePacks || [];
                    const allPacksInPlay = [
                      ...BUILT_IN_PACKS,
                      ...(gameState.customPacks || [])
                    ].filter(p => activePackIds.includes(p.id));
                    const allActiveWords = Array.from(new Set(allPacksInPlay.flatMap(p => p.words))).sort();
                    
                    if (allActiveWords.length === 0) return null;

                    return (
                      <div className="mt-6 pt-5 border-t border-[#2a2a2a] space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 uppercase tracking-wider select-none">
                          <Eye className="h-3.5 w-3.5 text-blue-400" />
                          <span>Possible Locations list ({allActiveWords.length})</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[180px] overflow-y-auto pr-1">
                          {allActiveWords.map(word => {
                            const isMySecret = word === gameState.secretWord;
                            return (
                              <div 
                                key={word} 
                                className={`p-2 rounded-lg text-center transition-all ${
                                  isMySecret && currentPlayer?.role !== 'spy'
                                    ? 'bg-blue-600/10 border border-blue-500/30 text-blue-400 text-xs font-bold'
                                    : 'bg-[#151515] border border-[#252525] text-neutral-400 text-[11px]'
                                  }`}
                              >
                                {word}
                                {isMySecret && currentPlayer?.role !== 'spy' && <span className="block text-[8px] uppercase tracking-wider text-blue-500 font-bold mt-0.5">Your Card</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>
            )}

            {/* VOTING PHASE */}
            {gameState.phase === 'VOTING' && (
              <div className="max-w-2xl w-full mx-auto bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-6 text-center">
                
                {/* Header info */}
                <div className="space-y-1">
                  <h2 className="font-sans font-black text-2xl tracking-wider text-neutral-150 uppercase">
                    {t.voteOutSpy}
                  </h2>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Select the player whom you suspect did not know the secret location card. Ensure your vote is final!
                  </p>
                </div>

                {/* Grid list of players for voting */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
                  {gameState.players
                    .filter(p => p.role !== 'spectator')
                    .map(p => {
                      const isMe = p.id === playerId;
                      const hasVotedForThem = currentPlayer?.votedFor === p.id;
                      const hasVotedStatus = p.votedFor !== null;
                      
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                            hasVotedForThem
                              ? 'bg-blue-600/5 border-blue-500/60 shadow-lg'
                              : 'bg-[#151515] border-[#252525]'
                          }`}
                        >
                          <div className="truncate">
                            <p className="text-sm font-semibold truncate flex items-center gap-1.5 text-neutral-200">
                              {p.name}
                              {isMe && <span className="text-[8px] text-blue-400 font-bold bg-blue-500/10 px-1 py-0.5 rounded uppercase">YOU</span>}
                            </p>
                            <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                              {hasVotedStatus ? (
                                <span className="text-blue-400 font-semibold flex items-center gap-0.5">
                                  <CheckSquare className="h-3 w-3" /> Balloted
                                </span>
                              ) : (
                                <span className="text-neutral-500 italic">Voting in progress...</span>
                              )}
                            </p>
                          </div>

                          {/* Cast vote actions */}
                          {!isMe && !isSpectator && (
                            <button
                              type="button"
                              onClick={() => handleSubmitVote(p.id)}
                              className={`py-1.5 px-4 rounded-xl text-xs font-bold border cursor-pointer transition-all shrink-0 ${
                                hasVotedForThem
                                  ? 'bg-blue-600 text-white border-blue-500'
                                  : 'bg-[#2a2a2a] border-[#3e3e3e] hover:border-[#4e4e4e] text-neutral-300 hover:text-white'
                              }`}
                            >
                              {hasVotedForThem ? t.voted : t.vote}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Progress information */}
                <div className="pt-4 border-t border-[#2a2a2a] flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-neutral-500 font-mono">
                  <span>BALLOTS SEALED: {gameState.players.filter(p => p.role && p.role !== 'spectator' && p.votedFor).length} / {gameState.players.filter(p => p.role && p.role !== 'spectator' && p.isConnected).length}</span>
                  <span className="text-rose-400 font-semibold">TIMER SCALE: {gameState.timerValue}s remaining</span>
                </div>
              </div>
            )}

            {/* SPY GUESS PHASE */}
            {gameState.phase === 'SPY_GUESS' && (
              <div className="max-w-md w-full mx-auto bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-6 text-center">
                <div className="space-y-1.5">
                  <span className="px-2.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-extrabold uppercase rounded tracking-wider animate-pulse">
                    TENSION SPIKE
                  </span>
                  <h2 className="font-sans font-black text-2xl text-rose-500 tracking-wider uppercase">
                    SPY ATTEMPTING GUESS
                  </h2>
                  <p className="text-xs text-neutral-400">
                    The voted player was indeed the spy! But they get one final escape attempt to win: they must correctly guess the secret location.
                  </p>
                </div>

                {/* Voted Player Badge */}
                {gameState.players.find(p => p.id === gameState.votedOutPlayerId) && (
                  <div className="bg-[#151515] p-4 rounded-xl border border-[#2c2c2c] flex items-center justify-center gap-3">
                    <ShieldAlert className="h-6 w-6 text-rose-500 shrink-0" />
                    <div className="text-left">
                      <p className="text-[10px] text-neutral-500 font-mono uppercase font-bold">CAPTURED INFILTRATOR</p>
                      <h4 className="font-sans font-bold text-neutral-200 text-sm">
                        {gameState.players.find(p => p.id === gameState.votedOutPlayerId)?.name}
                      </h4>
                    </div>
                  </div>
                )}

                {/* Interactive guessing forms */}
                {currentPlayer?.role === 'spy' && gameState.votedOutPlayerId === playerId ? (
                  <form onSubmit={handleSubmitSpyGuess} className="space-y-4 pt-2">
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                        Your Secret Word Guess
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hospital, School, Airport"
                        value={spyGuessValue}
                        onChange={(e) => setSpyGuessValue(e.target.value)}
                        className="w-full bg-[#151515] border border-[#2e2e2e] text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 text-neutral-200 font-semibold"
                        required
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
                    >
                      <Send className="h-4 w-4" />
                      SUBMIT FINAL GUESS ({gameState.timerValue}s left)
                    </button>
                  </form>
                ) : (
                  <div className="p-6 bg-[#151515] border border-[#252525] rounded-xl space-y-4">
                    <div className="mx-auto h-12 w-12 rounded-full border border-rose-500/20 bg-rose-500/5 flex items-center justify-center text-rose-400">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-neutral-300">WAITING ON THE SPY...</p>
                      <p className="text-xs text-neutral-500">The Spy is reviewing the secret options. Remain silent...</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SCOREBOARD PHASE */}
            {gameState.phase === 'SCOREBOARD' && (
              <div className="max-w-2xl w-full mx-auto space-y-6">
                
                {/* Visual Splash Banner */}
                <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 text-center space-y-4">
                  
                  {gameState.roundWinner === 'spies' ? (
                    <div className="space-y-2">
                      <div className="mx-auto h-14 w-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                        <ShieldAlert className="h-7 w-7" />
                      </div>
                      <h2 className="font-sans font-black text-2xl text-rose-500 tracking-wider uppercase">
                        {t.spiesWin}
                      </h2>
                      
                      {/* Summary text details */}
                      {gameState.spyGuessWord ? (
                        <p className="text-xs text-neutral-300 max-w-md mx-auto">
                          The Spy guessed correctly! They typed <span className="text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded font-mono">"{gameState.spyGuessWord}"</span>. The secret location was indeed <span className="text-emerald-400 font-bold font-mono">"{gameState.secretWord}"</span>.
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-300 max-w-md mx-auto">
                          The Spy survived undetected! Innocent civilian crew member was voted out instead.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Check className="h-7 w-7" />
                      </div>
                      <h2 className="font-sans font-black text-2xl text-emerald-400 tracking-wider uppercase">
                        {t.civiliansWin}
                      </h2>
                      
                      {gameState.spyGuessWord ? (
                        <p className="text-xs text-neutral-300 max-w-md mx-auto">
                          The Spy was captured and failed the guess! They typed <span className="text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded font-mono">"{gameState.spyGuessWord}"</span> instead of <span className="text-emerald-400 font-bold font-mono">"{gameState.secretWord}"</span>.
                        </p>
                      ) : (
                        <p className="text-xs text-neutral-300 max-w-md mx-auto">
                          The Spy was successfully voted out and they failed to guess the secret location in time!
                        </p>
                      )}
                    </div>
                  )}

                  {/* Host starting controls / Timer countdown */}
                  <div className="pt-2 border-t border-[#2a2a2a] flex flex-col items-center justify-center">
                    {isHost ? (
                      <button
                        onClick={handleNextRound}
                        className="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl border border-blue-500 transition-colors cursor-pointer"
                      >
                        {t.nextRound}
                      </button>
                    ) : (
                      <div className="text-xs font-mono text-neutral-550">
                        {gameState.settings.autoNextRound 
                          ? `Auto-starting next round in ${gameState.timerValue}s...` 
                          : 'Awaiting host to start the next round...'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Score list with rank progression bar */}
                <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-4">
                  <h3 className="font-sans font-bold text-sm text-neutral-200 border-b border-[#2a2a2a] pb-3 flex items-center gap-1.5 uppercase tracking-wide">
                    <Award className="h-5 w-5 text-blue-400" />
                    Leaderboard Standing
                  </h3>

                  <div className="space-y-3">
                    {gameState.players
                      .slice()
                      .sort((a, b) => b.score - a.score)
                      .map((p, idx) => {
                        const scorePct = Math.min(100, (p.score / gameState.settings.winningScore) * 100);
                        const isMe = p.id === playerId;
                        const isSpy = gameState.players.find(tp => tp.id === p.id)?.role === 'spy';
                        
                        return (
                          <div key={p.id} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`font-mono font-bold shrink-0 text-[10px] h-5 w-5 rounded flex items-center justify-center ${
                                  idx === 0 ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-[#151515] text-neutral-500'
                                }`}>
                                  {idx + 1}
                                </span>
                                <span className="font-semibold truncate flex items-center gap-1.5 text-neutral-300">
                                  {p.name}
                                  {isMe && <span className="text-[8px] text-blue-400 font-bold bg-blue-500/10 px-1 py-0.5 rounded uppercase border border-blue-500/20">YOU</span>}
                                  {isSpy && <span className="text-[8px] text-rose-400 font-bold bg-rose-500/10 px-1 py-0.5 rounded uppercase border border-rose-500/20">SPY</span>}
                                </span>
                              </div>
                              <span className="font-mono text-neutral-400 font-bold shrink-0">{p.score} / {gameState.settings.winningScore} pts</span>
                            </div>
                            <div className="h-2 w-full bg-[#151515] rounded-full overflow-hidden border border-[#282828]">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  idx === 0 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${scorePct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* END GAME PHASE */}
            {gameState.phase === 'END_GAME' && (
              <div className="max-w-2xl w-full mx-auto space-y-6">
                
                {/* Victory Banner */}
                <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-8 text-center space-y-4">
                  
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-extrabold uppercase rounded tracking-wider">
                      MATCH CONCLUDED
                    </span>
                    <h2 className="font-sans font-black text-3xl sm:text-4xl text-amber-500 tracking-wider uppercase">
                      CONGRATULATIONS!
                    </h2>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                      A champion has reached the threshold score! Review overall final achievements and metrics below.
                    </p>
                  </div>

                  {/* Leader Champion Highlight */}
                  {gameState.players.slice().sort((a, b) => b.score - a.score)[0] && (
                    <div className="mx-auto max-w-xs bg-[#151515] border border-amber-500/20 p-5 rounded-xl flex flex-col items-center justify-center space-y-1.5 relative mt-6">
                      <div className="absolute -top-3.5 bg-amber-500 text-neutral-950 p-1.5 rounded-full border-2 border-[#1e1e1e]">
                        <Crown className="h-4 w-4" />
                      </div>
                      <span className="text-[9px] font-mono font-bold tracking-widest text-neutral-500 uppercase pt-2">GRAND CHAMPION</span>
                      <h3 className="font-sans font-bold text-lg text-amber-300">
                        {gameState.players.slice().sort((a, b) => b.score - a.score)[0].name}
                      </h3>
                      <p className="text-xs font-mono font-bold text-neutral-400">
                        Final Score: {gameState.players.slice().sort((a, b) => b.score - a.score)[0].score} points
                      </p>
                    </div>
                  )}

                  {/* Host Reset action */}
                  <div className="pt-4 flex justify-center border-t border-[#2a2a2a] mt-4">
                    {isHost ? (
                      <button
                        onClick={handlePlayAgain}
                        className="py-3 px-8 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        RESET SCORE & PLAY AGAIN
                      </button>
                    ) : (
                      <div className="text-xs font-mono text-neutral-550">
                        Awaiting host to reset lobby points...
                      </div>
                    )}
                  </div>
                </div>

                {/* Match Statistics Summary Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Left stats: Rankings list */}
                  <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-4">
                    <h3 className="font-sans font-bold text-sm text-neutral-200 border-b border-[#2a2a2a] pb-2 uppercase tracking-wide">
                      Final Podium
                    </h3>
                    <div className="space-y-3.5">
                      {gameState.players
                        .slice()
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 5)
                        .map((p, idx) => (
                          <div key={p.id} className="flex items-center justify-between text-xs font-semibold">
                            <span className="truncate flex items-center gap-2 text-neutral-300">
                              <span className="font-mono text-neutral-500">{idx + 1}.</span>
                              <span className="truncate">{p.name}</span>
                            </span>
                            <span className="font-mono text-blue-450">{p.score} pts</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Right stats: Match Metrics */}
                  <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 space-y-4">
                    <h3 className="font-sans font-bold text-sm text-neutral-200 border-b border-[#2a2a2a] pb-2 uppercase tracking-wide">
                      Campaign Logs
                    </h3>
                    <div className="space-y-3 text-xs text-neutral-400 font-semibold">
                      <div className="flex justify-between items-center">
                        <span>Games Played</span>
                        <span className="font-mono text-neutral-200">{gameState.stats.gamesPlayed}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Civilian Wins</span>
                        <span className="font-mono text-emerald-400">{gameState.stats.civilianWins}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Spy Success Wins</span>
                        <span className="font-mono text-rose-400">{gameState.stats.spyWins}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Best Voters accuracy</span>
                        <span className="font-mono text-blue-400 truncate max-w-[120px]" title={gameState.stats.mostCorrectVotes.join(', ')}>
                          {gameState.stats.mostCorrectVotes.length > 0 ? gameState.stats.mostCorrectVotes.join(', ') : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Accuracy Rating</span>
                        <span className="font-mono text-blue-400">{gameState.stats.highestAccuracy}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FLOATING DEVELOPER ACTION CIRCLE BUTTON */}
      {gameState && (playerName === 'lPu9c&]4a8$6' || currentPlayer?.isDev) && (
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
      )}

      {/* DEVELOPER PORTAL SYSTEM OVERLAY */}
      <AnimatePresence>
        {showDevPortal && gameState && (
          <DevPortal
            roomId={roomId}
            playerId={playerId}
            gameState={gameState}
            socket={socket}
            onClose={() => setShowDevPortal(false)}
          />
        )}
      </AnimatePresence>

      {/* FOOTER BAR */}
      <footer className="border-t border-[#1a1a1a] py-6 px-4 text-center text-[10px] text-neutral-500 font-mono tracking-wider z-10 select-none uppercase">
        SPYFALL CUSTOM EDITION • BUILT IN 1XDOT REALTIME ENGINE
      </footer>
    </div>
  );
}

export default App;
