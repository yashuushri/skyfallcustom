import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Shield, RefreshCw, Terminal, Users, Monitor, Gamepad2, Play, Volume2, VolumeX, Eye, EyeOff, 
  Database, Cpu, Activity, Sparkles, UserPlus, Trash, Copy, Check, Info, Server, Network, 
  ShieldCheck, Zap, Radio, Globe, Heart
} from 'lucide-react';
import { GameState, GamePhase } from '../types';
import { soundManager } from '../soundManager';
import { getAllPlayerAnalytics, clearAllPlayerAnalytics, deletePlayerAnalytics } from '../indexedDB';
import { PlayerAnalytics } from '../analytics';

interface DevPortalProps {
  roomId: string;
  playerId: string;
  gameState: GameState & { actualSpies?: string[] };
  socket: any;
  onClose: () => void;
  localViewPreview: string | null;
  onSetLocalViewPreview: (view: string | null) => void;
}

type DevTab = 'simulator' | 'controls' | 'rooms' | 'system' | 'logs' | 'information';

export default function DevPortal({ 
  roomId, 
  playerId, 
  gameState, 
  socket, 
  onClose,
  localViewPreview,
  onSetLocalViewPreview
}: DevPortalProps) {
  const [activeTab, setActiveTab] = useState<DevTab>('simulator');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [logFilter, setLogFilter] = useState('');
  const [nickname, setNickname] = useState('');
  const [forcedWord, setForcedWord] = useState('');
  const [selectedSpies, setSelectedSpies] = useState<string[]>([]);
  const [copiedText, setCopiedText] = useState(false);
  const [localVolume, setLocalVolume] = useState(0.55);
  const [localMuted, setLocalMuted] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const [localDBAnalytics, setLocalDBAnalytics] = useState<PlayerAnalytics[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'information') {
      getAllPlayerAnalytics().then(data => {
        setLocalDBAnalytics(data);
      }).catch(err => console.error(err));
    }
  }, [activeTab, gameState]);

  const handlePlayLocalSound = (soundType: string) => {
    switch (soundType) {
      case 'click': soundManager.playClick(); break;
      case 'join': soundManager.playJoin(); break;
      case 'countdown': soundManager.playCountdown(); break;
      case 'card_flip': soundManager.playCardFlip(); break;
      case 'warning': soundManager.playWarning(); break;
      case 'vote_reveal': soundManager.playVoteReveal(); break;
      case 'spy_reveal': soundManager.playSpyReveal(); break;
      case 'victory': soundManager.playVictory(); break;
      case 'defeat': soundManager.playDefeat(); break;
      default: break;
    }
  };

  const handleVolumeChange = (v: number) => {
    setLocalVolume(v);
    soundManager.setVolume(v);
  };

  const handleToggleMute = () => {
    const nextMute = !localMuted;
    setLocalMuted(nextMute);
    soundManager.setMuted(nextMute);
  };

  const me = gameState.players.find(p => p.id === playerId);
  const humanPlayers = gameState.players.filter(p => !p.isDev && p.id !== 'P-bot-dot');
  const activeSpies = gameState.players.filter(p => p.role === 'spy' || gameState.actualSpies?.includes(p.id));

  // Sync state nickname
  useEffect(() => {
    if (me?.name) {
      setNickname(me.name);
    }
  }, [me?.name]);

  // Request Server Metrics from Socket.io (polling every 3 seconds)
  useEffect(() => {
    if (!socket) return;

    socket.emit('dev_request_server_metrics');

    const handleMetricsResponse = (data: any) => {
      setMetrics(data);
    };

    socket.on('dev_server_metrics_response', handleMetricsResponse);

    const interval = setInterval(() => {
      socket.emit('dev_request_server_metrics');
    }, 3000);

    return () => {
      socket.off('dev_server_metrics_response', handleMetricsResponse);
      clearInterval(interval);
    };
  }, [socket]);

  // Auto-scroll terminal logs to bottom
  useEffect(() => {
    if (activeTab === 'logs' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, metrics?.serverLogs]);

  const handleClearIndexedDBAnalytics = () => {
    if (window.confirm("Are you sure you want to clear all player analytical records stored locally in IndexedDB?")) {
      clearAllPlayerAnalytics().then(() => {
        setLocalDBAnalytics([]);
        setSelectedSessionId(null);
        soundManager.playClick();
      }).catch(err => console.error(err));
    }
  };

  const handleDeleteSessionAnalytic = (sessId: string) => {
    deletePlayerAnalytics(sessId).then(() => {
      setLocalDBAnalytics(prev => prev.filter(a => a.sessionId !== sessId));
      if (selectedSessionId === sessId) {
        setSelectedSessionId(null);
      }
      soundManager.playClick();
    }).catch(err => console.error(err));
  };

  // Handlers
  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    socket.emit('dev_change_nickname', { roomId, playerId, nickname: nickname.trim() });
  };

  const handleToggleInvisibility = () => {
    const nextInvisible = !me?.invisible;
    socket.emit('dev_toggle_invisibility', { roomId, playerId, invisible: nextInvisible });
  };

  const handleForceWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forcedWord.trim()) return;
    socket.emit('dev_force_secret_word', { roomId, playerId, word: forcedWord.trim() });
    setForcedWord('');
  };

  const handleToggleForcedSpy = (pId: string) => {
    setSelectedSpies(prev => {
      if (prev.includes(pId)) {
        return prev.filter(id => id !== pId);
      } else {
        return [...prev, pId];
      }
    });
  };

  const handleApplySpies = () => {
    socket.emit('dev_force_spies', { roomId, playerId, spyPlayerIds: selectedSpies });
  };

  const handleForcePhase = (phase: GamePhase) => {
    socket.emit('dev_change_phase', { roomId, playerId, phase });
  };

  const handleAdjustScore = (targetId: string, amount: number) => {
    socket.emit('dev_adjust_score', { roomId, playerId, targetPlayerId: targetId, amount });
  };

  const handleTriggerSFX = (type: string) => {
    socket.emit('dev_trigger_sfx', { roomId, playerId, type });
  };

  const handleSpawnBot = () => {
    if (!socket) return;
    socket.emit('add_bots', { roomId, count: 1 });
  };

  const handleKickAllBots = () => {
    if (!socket) return;
    socket.emit('remove_bots', { roomId });
  };

  const handleCopyLogs = () => {
    if (!metrics?.serverLogs) return;
    const allLogs = metrics.serverLogs.join('\n');
    navigator.clipboard.writeText(allLogs).then(() => {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    });
  };

  // Format Uptime
  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[#090a10] border border-red-500/15 w-full max-w-5xl rounded-3xl shadow-[0_0_80px_rgba(239,68,68,0.1)] flex flex-col md:flex-row overflow-hidden max-h-[90vh] text-neutral-200"
      >
        
        {/* LEFT SIDEBAR - VALORANT/RIOT DASHBOARD STYLE */}
        <div className="w-full md:w-64 bg-[#0d0e15] border-b md:border-b-0 md:border-r border-neutral-800/80 flex flex-col shrink-0">
          
          {/* SIDEBAR HEADER */}
          <div className="p-5 border-b border-neutral-800/60 bg-[#07080c] flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-xl border border-red-500/20 text-red-400">
              <Shield className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-widest text-neutral-100">DEV PORTAL</span>
                <span className="text-[8px] bg-red-500/15 text-red-400 border border-red-500/30 px-1 py-0.5 rounded font-mono font-black tracking-widest">LIVE</span>
              </div>
              <p className="text-[9px] text-neutral-500 font-mono uppercase tracking-wider mt-0.5">
                System Diagnostics
              </p>
            </div>
          </div>

          {/* SIDEBAR CATEGORIES / TABS */}
          <div className="flex-1 p-3 space-y-1.5 overflow-y-auto select-none">
            <span className="text-[9px] font-bold font-mono text-neutral-600 uppercase tracking-widest px-3 block mb-2">
              Console Category
            </span>
            {[
              { id: 'simulator', label: 'Screen Overrides', desc: 'Local client UI views', icon: Monitor },
              { id: 'controls', label: 'Match Parameters', desc: 'Bot injection & spy controls', icon: Gamepad2 },
              { id: 'rooms', label: 'Active Lobbies', desc: 'Room registry indexes', icon: Database },
              { id: 'system', label: 'Ecosystem Health', desc: 'Supabase, Render & Vercel', icon: Cpu },
              { id: 'logs', label: 'Stdout Telemetry', desc: 'Live captured engine logs', icon: Terminal },
              { id: 'information', label: 'Information', desc: 'Active Player Intel & Stats', icon: Info },
            ].map((tab) => {
              const IconComponent = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundManager.playClick();
                    setActiveTab(tab.id as DevTab);
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl text-left transition-all flex items-center gap-3 cursor-pointer group border relative ${
                    isSelected 
                      ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-lg shadow-red-500/5' 
                      : 'bg-transparent border-transparent hover:bg-neutral-800/40 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-red-500" />
                  )}
                  <IconComponent className={`h-4.5 w-4.5 shrink-0 transition-transform ${isSelected ? 'text-red-450 scale-105' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
                  <div className="truncate">
                    <span className={`text-[11px] block font-mono font-bold uppercase tracking-wider ${isSelected ? 'text-neutral-100 font-extrabold' : 'text-neutral-300'}`}>
                      {tab.label}
                    </span>
                    <span className="text-[9px] font-mono text-neutral-500 block truncate group-hover:text-neutral-400 transition-colors">
                      {tab.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* SIDEBAR FOOTER METRICS */}
          <div className="p-4 bg-[#07080c] border-t border-neutral-800/60 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-red-500" /> LOBBY CODE</span>
              <span className="font-extrabold text-red-400 tracking-wider bg-red-500/5 border border-red-500/10 px-2 py-0.5 rounded uppercase">
                {roomId || 'PREVIEW'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
              <span>ADMIN MODE</span>
              <span className="text-emerald-400 font-black">SUPERUSER</span>
            </div>
          </div>
        </div>

        {/* RIGHT CONTENT PANEL */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0b11]">
          
          {/* HEADER BAR */}
          <div className="px-6 py-4 border-b border-neutral-800/60 bg-[#0d0e15]/60 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-md uppercase font-bold tracking-widest">
                CATEGORY: {activeTab.toUpperCase()}
              </span>
            </div>
            
            <button 
              onClick={() => {
                soundManager.playClick();
                onClose();
              }}
              className="p-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-neutral-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold uppercase px-3"
            >
              <X className="h-3.5 w-3.5" />
              <span>Close</span>
            </button>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 p-6 overflow-y-auto min-h-0 space-y-6">
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                
                {/* TAB 1: SCREEN SIMULATOR */}
                {activeTab === 'simulator' && (
                  <div className="space-y-5">
                    {/* INFO HEADER HERO */}
                    <div className="relative overflow-hidden bg-gradient-to-r from-red-950/20 to-neutral-900 border border-red-500/10 p-5 rounded-2xl shadow-inner flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-1 relative z-10">
                        <span className="text-[9px] font-mono font-bold tracking-widest text-red-400 uppercase flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 animate-pulse text-red-500" /> Bypass Realtime state synchronization
                        </span>
                        <h3 className="text-base font-bold text-neutral-100 font-sans tracking-wide">Dynamic Screen Overrides</h3>
                        <p className="text-[11px] text-neutral-400 leading-normal max-w-xl">
                          Instantly force-render any of the game's UI screens locally. This lets you debug and preview game states, victory layouts, or the voting interface at will.
                        </p>
                      </div>
                      
                      {localViewPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            soundManager.playClick();
                            onSetLocalViewPreview(null);
                          }}
                          className="relative z-10 py-2 px-4 bg-red-500 hover:bg-red-600 text-white text-[10px] font-mono font-black rounded-xl transition-all uppercase tracking-widest cursor-pointer shadow-lg shadow-red-500/20"
                        >
                          Clear Active Override
                        </button>
                      )}
                    </div>

                    {/* OVERRIDES GRID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {[
                        { label: '📡 Dynamic Live Sync', id: null, icon: Radio, desc: 'Follows server states in real time' },
                        { label: '0. Home Gateway', id: 'HOME_SCREEN', icon: Globe, desc: 'Starting screen to host or join a room' },
                        { label: '1. Game Lobby', id: 'LOBBY', icon: Users, desc: 'Lobby options & crew details' },
                        { label: '2. Reveal Secret Role', id: 'REVEAL', icon: Shield, desc: 'Secret location or Spy card layout' },
                        { label: '3. Discussion Forum', id: 'DISCUSSION', icon: MessageSquareIcon, desc: 'Active conversation timer & player interrogation' },
                        { label: '4. Voting Phase', id: 'VOTING', icon: VoteIcon, desc: 'Interactive player voting ballots' },
                        { label: '5. Spy Location Guess', id: 'SPY_GUESS', icon: TargetIcon, desc: 'Spy interface to type secret guess' },
                        { label: '6. Current Scoreboard', id: 'SCOREBOARD', icon: StarIcon, desc: 'Leaderboard points & round winner logs' },
                        { label: '7. Game Over Stats', id: 'END_GAME', icon: AwardIcon, desc: 'Post-match diagnostics & results summary' },
                      ].map((item) => {
                        const isActive = localViewPreview === item.id;
                        const ItemIcon = item.icon || Monitor;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              onSetLocalViewPreview(item.id);
                            }}
                            className={`text-left p-4 border rounded-2xl transition-all cursor-pointer flex flex-col justify-between h-28 group relative overflow-hidden ${
                              isActive 
                                ? 'bg-red-500/10 border-red-500/40 text-red-300 font-bold shadow-lg shadow-red-500/5' 
                                : 'bg-[#0f1016]/60 border-neutral-800/80 text-neutral-300 hover:border-neutral-700 hover:bg-[#12131b]'
                            }`}
                          >
                            {isActive && (
                              <span className="absolute top-2 right-2 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-450 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                            )}
                            
                            <div className="flex items-center justify-between w-full">
                              <ItemIcon className={`h-5 w-5 transition-transform ${isActive ? 'text-red-400' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
                              <span className="text-[9px] font-mono text-neutral-500 font-extrabold tracking-wider group-hover:text-neutral-400 transition-colors">
                                {item.id === null ? 'SYNC' : 'OVERRIDE'}
                              </span>
                            </div>

                            <div>
                              <span className="text-xs font-bold font-sans uppercase tracking-wide block text-neutral-100">{item.label}</span>
                              <span className="text-[9px] text-neutral-500 font-mono leading-tight truncate-2-lines mt-1 block group-hover:text-neutral-400">
                                {item.desc}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: GAME OVERRIDES */}
                {activeTab === 'controls' && (
                  <div className="space-y-5">
                    
                    {/* SECRET INTEL DISCOVERY CARD */}
                    {gameState.phase !== 'LOBBY' && (
                      <div className="relative overflow-hidden bg-[#0d0e15] border border-neutral-800 rounded-2xl p-5 space-y-4">
                        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                          <Activity className="h-24 w-24 text-red-500" />
                        </div>
                        <div className="flex items-center gap-2 pb-2 border-b border-neutral-800/40">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                          <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase">
                            ACTIVE MATCH SECRETS LOG
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                          <div className="bg-[#07080c] p-4 rounded-xl border border-neutral-800/80">
                            <span className="text-neutral-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Secret Word / Location</span>
                            <p className="font-sans font-black text-sm text-neutral-200">{gameState.secretWord || 'None'}</p>
                          </div>
                          <div className="bg-[#07080c] p-4 rounded-xl border border-neutral-800/80">
                            <span className="text-neutral-500 text-[10px] font-bold block uppercase tracking-wider mb-1">Identified Spies</span>
                            <p className="font-sans font-extrabold text-sm text-red-400">
                              {activeSpies.map(s => s.name).join(', ') || 'No Spies Allocated'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACTIONS ROW GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      
                      {/* SPY & BOT SPONSER MODULE */}
                      <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono text-amber-500">
                            Virtual Bot Controller
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-mono mt-1 leading-normal">
                            Spawn or purge in-memory simulated players on this container. These can be used to easily populate lobbies to meet player count requirements.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3 pt-4">
                          <button
                            onClick={handleSpawnBot}
                            className="flex-1 py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/5"
                          >
                            <UserPlus className="h-4 w-4" />
                            Spawn Agent Bot
                          </button>
                          <button
                            onClick={handleKickAllBots}
                            className="flex-1 py-2.5 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold text-red-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-red-500/5"
                          >
                            <Trash className="h-4 w-4" />
                            Kick All Bots
                          </button>
                        </div>
                      </div>

                      {/* INJECT LOCATION WORD */}
                      <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono text-emerald-500">
                            Force Next Location
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-mono mt-1 leading-normal">
                            Force-inject the next secret game location. Submitting this will override random deck generation for the next match round.
                          </p>
                        </div>
                        <form onSubmit={handleForceWord} className="flex gap-2 pt-4">
                          <input
                            type="text"
                            placeholder="e.g. SPACE LAB, MILITARY BASE"
                            value={forcedWord}
                            onChange={(e) => setForcedWord(e.target.value)}
                            className="flex-1 bg-neutral-900 border border-neutral-800 text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-red-500 font-mono text-neutral-100"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl transition-all cursor-pointer uppercase font-mono tracking-wider"
                          >
                            Inject
                          </button>
                        </form>
                      </div>

                    </div>

                    {/* SPY ROLE ALLOCATIONS */}
                    {humanPlayers.length > 0 && (
                      <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono text-red-500">
                            Force-Inject Impostor Spies
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            Toggle specific players to instantly be assigned the Spy role in the next matching sequence.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {humanPlayers.map((p) => {
                            const isSelected = selectedSpies.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  soundManager.playClick();
                                  handleToggleForcedSpy(p.id);
                                }}
                                className={`px-4 py-2 text-xs rounded-xl border font-mono transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'bg-red-500/20 border-red-500/40 text-red-400 font-bold shadow-md shadow-red-500/5' 
                                    : 'bg-neutral-900 border border-neutral-800/80 text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800/50'
                                }`}
                              >
                                {p.name}
                              </button>
                            );
                          })}
                        </div>
                        {selectedSpies.length > 0 && (
                          <div className="flex justify-end pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                soundManager.playClick();
                                handleApplySpies();
                              }}
                              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer font-mono uppercase tracking-wider"
                            >
                              Enforce Spies Allocation ({selectedSpies.length})
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PHASE CHANGES */}
                    <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono text-neutral-400">
                          Force Server Game Phase Shift
                        </h4>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          Change the active match stage on the server instantly. All connected clients will automatically jump to this phase.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {[
                          { label: '0. Lobby', phase: 'LOBBY' as GamePhase },
                          { label: '1. Reveal', phase: 'REVEAL' as GamePhase },
                          { label: '2. Discuss', phase: 'DISCUSSION' as GamePhase },
                          { label: '3. Voting', phase: 'VOTING' as GamePhase },
                          { label: '4. Spy Guess', phase: 'SPY_GUESS' as GamePhase },
                          { label: '5. Scores', phase: 'SCOREBOARD' as GamePhase },
                        ].map((p) => (
                          <button
                            key={p.phase}
                            onClick={() => {
                              soundManager.playClick();
                              handleForcePhase(p.phase);
                            }}
                            className={`py-2.5 px-2 border rounded-xl text-[11px] font-bold font-mono transition-all flex items-center justify-center cursor-pointer ${
                              gameState.phase === p.phase 
                                ? 'bg-red-500/10 border-red-500 text-red-400 font-black shadow-lg shadow-red-500/5' 
                                : 'bg-[#07080c]/80 border-neutral-850 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SCORE BOARD MODIFIER */}
                    <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono text-neutral-400">
                          Modify Scoreboard Points
                        </h4>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          Directly tweak score totals for connected players. Perfect for manual adjustments.
                        </p>
                      </div>
                      {humanPlayers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {humanPlayers.map((p) => (
                            <div key={p.id} className="flex items-center justify-between p-3.5 bg-neutral-950/40 border border-neutral-850 rounded-xl text-xs font-mono">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-neutral-200 font-sans">{p.name}</span>
                                {p.role && (
                                  <span className="text-[8px] px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded font-bold uppercase">
                                    {p.role}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <button 
                                    onClick={() => {
                                      soundManager.playClick();
                                      handleAdjustScore(p.id, -1);
                                    }}
                                    className="w-6.5 h-6.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg flex items-center justify-center font-black text-xs cursor-pointer hover:border-red-500/30"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono text-neutral-200 w-6 text-center font-black text-sm">{p.score}</span>
                                  <button 
                                    onClick={() => {
                                      soundManager.playClick();
                                      handleAdjustScore(p.id, 1);
                                    }}
                                    className="w-6.5 h-6.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-lg flex items-center justify-center font-black text-xs cursor-pointer hover:border-red-500/30"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-500 italic font-mono pl-1">No real players in this room to score.</p>
                      )}
                    </div>

                    {/* SFX SOUND BROADCASTER */}
                    <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono text-neutral-400">
                          Match Sound Cue Broadcaster
                        </h4>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                          Trigger custom full-fidelity audio clips on all connected client devices simultaneously.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                        {[
                          { label: 'Spy Victory Cue', type: 'spy_win' },
                          { label: 'Crew Victory Cue', type: 'civilian_win' },
                          { label: 'Suspicious Clock', type: 'ticktock' },
                          { label: 'Vote Complete Alarm', type: 'voting_complete' },
                        ].map((sfx) => (
                          <button
                            key={sfx.type}
                            onClick={() => {
                              soundManager.playClick();
                              handleTriggerSFX(sfx.type);
                            }}
                            className="py-2.5 px-3 bg-neutral-900/60 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 hover:text-white rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer font-bold hover:border-red-500/30"
                          >
                            <Play className="h-3 w-3 text-red-500" />
                            <span>{sfx.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* LOCAL SYNTH AUDIO PANEL */}
                    <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-neutral-800/40">
                        <div>
                          <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono text-amber-500">
                            Local Synthesizer Diagnostics
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            Validate programmatic low-level tone synthesizers and local browser audio volumes.
                          </p>
                        </div>
                        
                        {/* LOCAL AUDIO MIXER */}
                        <div className="flex items-center gap-3 w-full sm:w-auto bg-[#07080c] px-3.5 py-1.5 rounded-xl border border-neutral-800/80">
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playClick();
                              handleToggleMute();
                            }}
                            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-300 transition-all cursor-pointer"
                          >
                            {localMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
                          </button>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-neutral-500 font-mono font-bold">VOL</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={localVolume}
                              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                              className="w-20 sm:w-24 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                              disabled={localMuted}
                            />
                            <span className="text-[9px] text-neutral-400 font-mono min-w-8 text-right font-black">
                              {Math.round(localVolume * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* LOCAL SOUND BUTTONS GRID */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {[
                          { name: 'Tap Click 🕹️', type: 'click', desc: 'Spaceship toggle click' },
                          { name: 'Pneumatic Join 🚀', type: 'join', desc: 'Ascending entry riser chime' },
                          { name: 'Sonar Heartbeat 🚨', type: 'countdown', desc: 'Sub thud & countdown tone' },
                          { name: 'Pneumatic Hatch 💨', type: 'card_flip', desc: 'Air sweep and panel flip' },
                          { name: 'Emergency Alarm! 📣', type: 'warning', desc: 'Pulsing dual low-sawtooth horn' },
                          { name: 'Pressure Lock 🔩', type: 'vote_reveal', desc: 'Dual metal clank & valve hiss' },
                          { name: 'Spies Reveal Slash 🔪', type: 'spy_reveal', desc: 'Spooky screech & low rumble' },
                          { name: 'Victory Fanfare 🏆', type: 'victory', desc: 'Retro 8-bit space riser chord' },
                          { name: 'Defeat Void 💀', type: 'defeat', desc: 'Wind sweep & minor sliding tone' },
                        ].map((sound) => (
                          <button
                            key={sound.type}
                            type="button"
                            onClick={() => handlePlayLocalSound(sound.type)}
                            className="p-3 bg-[#07080c]/60 hover:bg-[#07080c] border border-neutral-850 hover:border-red-500/30 rounded-xl text-left transition-all cursor-pointer group flex flex-col justify-between h-20"
                          >
                            <div className="flex justify-between items-center w-full">
                              <span className="text-xs font-bold text-neutral-200 group-hover:text-red-400 transition-colors">
                                {sound.name}
                              </span>
                              <Play className="h-3 w-3 text-neutral-600 group-hover:text-red-400 transition-all opacity-50 group-hover:opacity-100" />
                            </div>
                            <p className="text-[9px] text-neutral-500 leading-tight font-mono mt-1 group-hover:text-neutral-400 transition-colors">
                              {sound.desc}
                            </p>
                          </button>
                        ))}

                        {/* Continuous loop testing row */}
                        <div className="p-3 bg-[#07080c]/40 border border-dashed border-neutral-800 rounded-xl flex flex-col justify-between h-20 sm:col-span-2 md:col-span-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-xs font-bold text-neutral-300">Ambient Engine Ventilation Loop</span>
                              <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Continuous low frequency spacecraft cabin draft hum</p>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playClick();
                                  soundManager.playAmbientHum();
                                }}
                                className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-[9px] font-mono hover:bg-red-500/20 cursor-pointer uppercase font-bold"
                              >
                                Loop On
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playClick();
                                  soundManager.stopAmbientHum();
                                }}
                                className="px-2.5 py-1 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded-lg text-[9px] font-mono hover:bg-neutral-700 cursor-pointer uppercase font-bold"
                              >
                                Loop Off
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 3: ACTIVE ROOMS */}
                {activeTab === 'rooms' && (
                  <div className="space-y-4">
                    <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl">
                      <div className="flex items-center gap-1.5">
                        <Database className="h-4 w-4 text-red-500" />
                        <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase">
                          LOBBY REGISTRY DATABANK
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-neutral-100 font-sans mt-1">Active Rooms Monitoring</h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        Review active lobbies hosted across this Node.js process. Double-check room states, player compositions, and current gameplay stages.
                      </p>
                    </div>

                    {!metrics?.activeRoomsList || metrics.activeRoomsList.length === 0 ? (
                      <div className="text-center py-12 bg-[#0f1016]/30 border border-neutral-850 rounded-2xl space-y-3 p-6">
                        <Info className="h-8 w-8 text-neutral-600 mx-auto animate-pulse" />
                        <p className="text-[11px] text-neutral-500 uppercase tracking-widest font-bold">No active external rooms</p>
                        <p className="text-[10px] text-neutral-600 font-mono">Lobbies created in side-panels or other clients will dynamically register here.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {metrics.activeRoomsList.map((roomItem: any) => {
                          const isCurrent = roomItem.roomId === roomId;
                          return (
                            <div 
                              key={roomItem.roomId} 
                              className={`bg-[#0f1016]/40 border rounded-2xl overflow-hidden transition-all p-4 space-y-4 ${
                                isCurrent ? 'border-red-500/40 shadow-lg shadow-red-500/5' : 'border-neutral-800/60'
                              }`}
                            >
                              <div className="flex items-center justify-between border-b border-neutral-850 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-black text-neutral-100 uppercase tracking-widest">{roomItem.roomId}</span>
                                  {isCurrent && (
                                    <span className="text-[8px] bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-black uppercase">CURRENT LOBBY</span>
                                  )}
                                </div>
                                <span className="text-[9px] font-mono bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full uppercase font-black">
                                  STAGE: {roomItem.phase}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-[10px] font-mono text-neutral-400">
                                <div>
                                  <span className="text-neutral-500 block uppercase font-bold text-[8px] tracking-wider mb-0.5">Lobby Description</span>
                                  <span className="font-sans text-neutral-200 font-bold">{roomItem.roomName || 'Unnamed Mission'}</span>
                                </div>
                                <div>
                                  <span className="text-neutral-500 block uppercase font-bold text-[8px] tracking-wider mb-0.5">Session Status</span>
                                  <span className="text-neutral-200">Round {roomItem.currentRound || 1} • {roomItem.players?.length || 0} Connected</span>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <span className="text-neutral-500 font-bold block uppercase tracking-wider text-[8px] font-mono">Connected Crew Members</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {roomItem.players?.map((p: any) => (
                                    <div 
                                      key={p.id}
                                      className={`px-2 py-1 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 ${
                                        p.role === 'spy' 
                                          ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                          : p.isHost 
                                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                            : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 rounded-full ${p.isConnected ? 'bg-emerald-450 animate-pulse' : 'bg-neutral-600'}`} />
                                      <span>{p.name} ({p.score} pts)</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: SYSTEM HEALTH */}
                {activeTab === 'system' && (
                  <div className="space-y-5">
                    
                    {/* OVERVIEW HERO */}
                    <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-red-500" />
                        <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase">
                          PRODUCTION SYSTEM TELEMETRY
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-neutral-100 font-sans mt-1">Ecosystem Infrastructure Dashboard</h3>
                      <p className="text-xs text-neutral-400 mt-1">
                        Track live response metrics, connection pools, and edge network health states for our multi-cloud deployment ecosystem.
                      </p>
                    </div>

                    {/* HARDWARE GRID */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-[#0d0e15] border border-neutral-800/80 p-4.5 rounded-2xl space-y-1 shadow-sm font-mono relative overflow-hidden">
                        <div className="absolute top-2 right-2 p-1.5 bg-red-500/5 rounded-lg border border-red-500/10 text-red-500">
                          <Cpu className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-neutral-500 font-bold uppercase tracking-wider text-[9px] block">Node Container</span>
                        <p className="text-xl font-black text-red-400 uppercase font-sans tracking-wide">ACTIVE</p>
                        <p className="text-[10px] text-neutral-500">WS Ingress Tunnel: Operational</p>
                      </div>

                      <div className="bg-[#0d0e15] border border-neutral-800/80 p-4.5 rounded-2xl space-y-1 shadow-sm font-mono relative overflow-hidden">
                        <div className="absolute top-2 right-2 p-1.5 bg-red-500/5 rounded-lg border border-red-500/10 text-red-500">
                          <Zap className="h-3.5 w-3.5 animate-pulse" />
                        </div>
                        <span className="text-neutral-500 font-bold uppercase tracking-wider text-[9px] block">Virtual Heap Memory</span>
                        <p className="text-xl font-black text-red-400 font-sans tracking-wide">{metrics?.memory?.heapUsed || 24} MB</p>
                        <p className="text-[10px] text-neutral-500">Node JS GC state: nominal</p>
                      </div>

                      <div className="bg-[#0d0e15] border border-neutral-800/80 p-4.5 rounded-2xl space-y-1 shadow-sm font-mono relative overflow-hidden">
                        <div className="absolute top-2 right-2 p-1.5 bg-red-500/5 rounded-lg border border-red-500/10 text-red-500">
                          <Activity className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-neutral-500 font-bold uppercase tracking-wider text-[9px] block">Server Uptime</span>
                        <p className="text-xl font-black text-red-400 font-sans tracking-wide truncate">{formatUptime(metrics?.uptime || 720)}</p>
                        <p className="text-[10px] text-neutral-500">Continuous background thread timer</p>
                      </div>
                    </div>

                    {/* MICROSERVICES NETWORKS */}
                    <div className="bg-[#0f1016]/30 border border-neutral-800/60 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between border-b border-neutral-800/40 pb-3">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono font-black tracking-widest text-red-400 uppercase flex items-center gap-1.5">
                            <Server className="h-3.5 w-3.5" /> Ecosystem Microservice Network Maps
                          </span>
                          <h3 className="text-sm font-bold text-neutral-200">Cloud Host Service status</h3>
                        </div>
                        <span className="text-[8px] font-mono bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full uppercase font-black tracking-widest">
                          SYSTEM HEALTHY
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        
                        {/* SERVICE 1: RENDER CLOUD CONTAINER */}
                        <div className="bg-[#07080c]/80 border border-neutral-850 p-4.5 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-red-500/5 rounded-xl text-red-400 border border-red-500/10">
                                <Cpu className="h-4.5 w-4.5" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-neutral-100 uppercase tracking-wide">Render Backend</h4>
                                <p className="text-[9px] text-neutral-500 font-mono uppercase">API Host Container</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span className="text-[8px] font-mono font-black text-emerald-450 uppercase">ACTIVE</span>
                            </div>
                          </div>
                          
                          <div className="pt-3 border-t border-neutral-800/40 space-y-1.5 text-[10px] font-mono text-neutral-400">
                            <div className="flex justify-between">
                              <span className="text-neutral-500">PROVIDER:</span>
                              <span>{metrics?.healthServices?.renderBackend?.provider || 'Render.com Cloud Run'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">HOST REGION:</span>
                              <span>{metrics?.healthServices?.renderBackend?.region || 'Singapore (sin-1)'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">INGRESS PORT:</span>
                              <span>Port {metrics?.healthServices?.renderBackend?.ingressPort || 3000}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">HTTP API GATEWAY:</span>
                              <span className="text-emerald-400 font-bold">READY (200 OK)</span>
                            </div>
                          </div>
                        </div>

                        {/* SERVICE 2: SUPABASE POSTGRESQL POOL */}
                        {(() => {
                          const isDbOk = metrics?.databaseStatus === 'HEALTHY';
                          return (
                            <div className="bg-[#07080c]/80 border border-neutral-850 p-4.5 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden group">
                              <div className={`absolute top-0 left-0 w-1 h-full ${isDbOk ? 'bg-red-500' : 'bg-amber-500'}`} />
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className={`p-2 rounded-xl border ${
                                    isDbOk 
                                      ? 'bg-red-500/5 text-red-400 border-red-500/10' 
                                      : 'bg-amber-500/5 text-amber-550 border-amber-500/10'
                                  }`}>
                                    <Database className="h-4.5 w-4.5" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-neutral-100 uppercase tracking-wide">Supabase Database</h4>
                                    <p className="text-[9px] text-neutral-500 font-mono uppercase">Postgres Serverless DB</p>
                                  </div>
                                </div>
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isDbOk ? 'bg-emerald-500/5 border border-emerald-500/25' : 'bg-amber-500/5 border border-amber-500/25'}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${isDbOk ? 'bg-emerald-450 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
                                  <span className={`text-[8px] font-mono font-black uppercase ${isDbOk ? 'text-emerald-450' : 'text-amber-500'}`}>
                                    {isDbOk ? 'HEALTHY' : 'FALLBACK_MEM'}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="pt-3 border-t border-neutral-800/40 space-y-1.5 text-[10px] font-mono text-neutral-400">
                                <div className="flex justify-between">
                                  <span className="text-neutral-500">PROVIDER:</span>
                                  <span>{metrics?.healthServices?.supabaseDatabase?.provider || 'Supabase Postgres Managed'}</span>
                                </div>
                                <div className="flex justify-between text-neutral-300">
                                  <span className="text-neutral-500">CONNECTION MODE:</span>
                                  <span className="truncate max-w-[150px]" title={metrics?.databaseType}>{metrics?.databaseType || 'SQL PostgreSQL Client Pool'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-neutral-500">ACTIVE CONNECTION POOL:</span>
                                  <span>{metrics?.healthServices?.supabaseDatabase?.poolSize || 20} max pool</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-neutral-500">SSL SECURITY:</span>
                                  <span className="text-emerald-455 font-bold">ACTIVE ENCRYPTED</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* SERVICE 3: VERCEL FRONTEND */}
                        <div className="bg-[#07080c]/80 border border-neutral-850 p-4.5 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-red-500/5 rounded-xl text-red-400 border border-red-500/10">
                                <Globe className="h-4.5 w-4.5" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-neutral-100 uppercase tracking-wide">Vercel Frontend</h4>
                                <p className="text-[9px] text-neutral-500 font-mono uppercase">Edge Deployment Content</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[8px] font-mono font-black text-emerald-450 uppercase">ACTIVE</span>
                            </div>
                          </div>
                          
                          <div className="pt-3 border-t border-neutral-800/40 space-y-1.5 text-[10px] font-mono text-neutral-400">
                            <div className="flex justify-between">
                              <span className="text-neutral-500">CONTENT HOST:</span>
                              <span>{metrics?.healthServices?.vercelFrontend?.provider || 'Vercel CDN Edge Network'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">CDN ENDPOINT:</span>
                              <span>{metrics?.healthServices?.vercelFrontend?.deployment || 'spyfall-custom.vercel.app'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">PROTOCOL:</span>
                              <span>{metrics?.healthServices?.vercelFrontend?.protocol || 'HTTP/3 (QUIC)'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">STATIC CACHE:</span>
                              <span className="text-emerald-400 font-bold">HIT (EDGE REPLICATED)</span>
                            </div>
                          </div>
                        </div>

                        {/* SERVICE 4: SOCKET.IO SIGNAL GATEWAY */}
                        <div className="bg-[#07080c]/80 border border-neutral-850 p-4.5 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden group">
                          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-red-500/5 rounded-xl text-red-400 border border-red-500/10">
                                <Radio className="h-4.5 w-4.5 animate-pulse" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-neutral-100 uppercase tracking-wide">Socket.io Sync</h4>
                                <p className="text-[9px] text-neutral-500 font-mono uppercase">Bidirectional Stream</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                              <span className="text-[8px] font-mono font-black text-emerald-450 uppercase">ACTIVE</span>
                            </div>
                          </div>
                          
                          <div className="pt-3 border-t border-neutral-800/40 space-y-1.5 text-[10px] font-mono text-neutral-400">
                            <div className="flex justify-between">
                              <span className="text-neutral-500">WS FRAMEWORK:</span>
                              <span>Engine.io v4 Server Stream</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">WS TRANSPORT:</span>
                              <span>{metrics?.healthServices?.socketIo?.transport || 'WebSocket + Long Polling'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">ACTIVE TUNNEL CLIENTS:</span>
                              <span className="text-emerald-405 font-bold">
                                {metrics?.healthServices?.socketIo?.activeSockets ?? metrics?.totalPlayers ?? 1} Connected
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-500">SYNC INTERVAL:</span>
                              <span>Adaptive Delta Updates</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* REST API & WS ROUTE TABLES */}
                    <div className="bg-[#0d0e15] border border-neutral-800/60 rounded-2xl overflow-hidden">
                      <div className="bg-[#07080c] px-5 py-3.5 border-b border-neutral-800/60 flex items-center justify-between">
                        <span className="text-xs font-bold text-neutral-200 uppercase tracking-widest font-mono">
                          Registered REST endpoints & Sockets Gateway
                        </span>
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-bold font-mono uppercase">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Stream Operational
                        </span>
                      </div>
                      <div className="divide-y divide-neutral-800/40 bg-[#07080c]/20">
                        {(metrics?.apiEndpoints || [
                          { path: '/api/health', method: 'GET', status: 'ACTIVE' },
                          { path: 'Socket.IO WS Namespace (/)', method: 'WS', status: 'ACTIVE' }
                        ]).map((api: any) => (
                          <div key={api.path} className="px-5 py-3 flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/10">
                                {api.method}
                              </span>
                              <span className="text-neutral-300 font-semibold font-mono">{api.path}</span>
                            </div>
                            <span className="text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2 py-0.5 rounded-lg text-[9px] font-black font-mono">
                              {api.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 5: SERVER LOGS */}
                {activeTab === 'logs' && (
                  <div className="space-y-4">
                    <div className="bg-[#0f1016]/40 border border-neutral-800/60 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Terminal className="h-4 w-4 text-red-500" />
                          <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 uppercase">
                            Captured Stdout Console Stream
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-neutral-100 font-sans mt-0.5">Live Output Telemetry Logs</h3>
                        <p className="text-xs text-neutral-400">Stream captures stdout and custom system triggers straight from the socket dispatcher.</p>
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        <input 
                          type="text"
                          placeholder="Filter stdout prints..."
                          value={logFilter}
                          onChange={(e) => setLogFilter(e.target.value)}
                          className="bg-neutral-900 border border-neutral-800 text-xs px-3 py-1.5 rounded-xl focus:outline-none focus:border-red-500 font-mono w-32 sm:w-44 text-neutral-200"
                        />
                        <button
                          onClick={() => {
                            soundManager.playClick();
                            handleCopyLogs();
                          }}
                          className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-neutral-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-mono uppercase tracking-wider shrink-0 hover:border-red-500/30"
                          title="Copy logs to clipboard"
                        >
                          {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-400 animate-bounce" /> : <Copy className="h-3.5 w-3.5 text-neutral-400" />}
                          <span>{copiedText ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#050608] border border-neutral-800 rounded-2xl p-4 font-mono text-[11px] flex flex-col h-[380px] overflow-hidden shadow-inner">
                      <div className="flex-1 overflow-y-auto space-y-1 text-neutral-400 scrollbar-thin scrollbar-thumb-neutral-800 pr-1 select-text">
                        {metrics?.serverLogs && metrics.serverLogs.length > 0 ? (
                          metrics.serverLogs
                            .filter((log: string) => !logFilter || log.toLowerCase().includes(logFilter.toLowerCase()))
                            .map((log: string, index: number) => {
                              const isErr = log.includes('[ERR]') || log.toLowerCase().includes('error') || log.toLowerCase().includes('fail');
                              return (
                                <div 
                                  key={index} 
                                  className={`whitespace-pre-wrap leading-relaxed py-0.5 px-2.5 rounded-lg transition-colors font-mono ${
                                    isErr 
                                      ? 'text-red-400 bg-red-500/10 border border-red-500/15 font-bold' 
                                      : 'hover:bg-neutral-900/60'
                                  }`}
                                >
                                  {log}
                                </div>
                              );
                            })
                        ) : (
                          <p className="text-neutral-600 italic text-center py-20">
                            No console output captures recorded on this server yet. Trigger game interactions to update live stream.
                          </p>
                        )}
                        <div ref={terminalEndRef} />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 6: PLAYER INFORMATION INTEL */}
                {activeTab === 'information' && (
                  <div className="space-y-6">
                    {/* Header Banner */}
                    <div className="relative overflow-hidden bg-gradient-to-r from-red-950/20 to-neutral-900 border border-red-500/10 p-5 rounded-2xl shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1 relative z-10">
                        <span className="text-[9px] font-mono font-bold tracking-widest text-red-400 uppercase flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5 animate-pulse text-red-500" /> PASSIVE COGNITIVE DIAGNOSTICS ENGINE
                        </span>
                        <h3 className="text-base font-bold text-neutral-100 font-sans">Player Environment Intel & Analytics</h3>
                        <p className="text-xs text-neutral-400">
                          Passively captures non-intrusive metadata, network profiles, interaction telemetry, and session stats for debugging without permission prompts.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Sidebar List of Players */}
                      <div className="lg:col-span-4 bg-[#0d0e15]/40 border border-neutral-800/60 rounded-2xl p-4 space-y-3">
                        <div className="flex bg-[#07080c]/80 p-1 border border-neutral-800/50 rounded-xl gap-1">
                          <button
                            onClick={() => {
                              setSelectedSessionId(null);
                              setSelectedPlayerId(playerId);
                              soundManager.playClick();
                            }}
                            className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition-all ${
                              !selectedSessionId
                                ? 'bg-red-500/20 text-red-400 border border-red-500/20'
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            Live Lobby ({gameState.players.length})
                          </button>
                          <button
                            onClick={() => {
                              if (localDBAnalytics.length > 0) {
                                setSelectedSessionId(localDBAnalytics[0].sessionId);
                              } else {
                                setSelectedSessionId('ARCHIVE_EMPTY');
                              }
                              soundManager.playClick();
                            }}
                            className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition-all ${
                              selectedSessionId
                                ? 'bg-red-500/20 text-red-400 border border-red-500/20'
                                : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                          >
                            IndexedDB ({localDBAnalytics.length})
                          </button>
                        </div>

                        {selectedSessionId ? (
                          selectedSessionId === 'ARCHIVE_EMPTY' ? (
                            <div className="py-12 text-center text-[10px] font-mono text-neutral-600 italic">
                              IndexedDB is empty.<br />Active gameplay generates local logs.
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                              {localDBAnalytics.map(analytic => {
                                const isSelected = selectedSessionId === analytic.sessionId;
                                return (
                                  <div
                                    key={analytic.sessionId}
                                    onClick={() => {
                                      soundManager.playClick();
                                      setSelectedSessionId(analytic.sessionId);
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer group relative ${
                                      isSelected
                                        ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-md animate-pulse'
                                        : 'bg-neutral-900/40 border-transparent hover:bg-neutral-800/30 hover:border-neutral-800 text-neutral-400 hover:text-neutral-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <Activity className="h-4 w-4 text-neutral-500 shrink-0" />
                                      <div className="truncate">
                                        <span className="text-[10px] font-mono font-bold block text-neutral-200 truncate">
                                          Session {analytic.sessionId.slice(-6).toUpperCase()}
                                        </span>
                                        <span className="text-[8px] font-mono text-neutral-500 block">
                                          {analytic.os} • {analytic.browserName}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSessionAnalytic(analytic.sessionId);
                                      }}
                                      className="p-1 hover:text-red-400 text-neutral-600 transition-colors rounded hover:bg-red-500/10 cursor-pointer"
                                    >
                                      <Trash className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}

                              <button
                                onClick={handleClearIndexedDBAnalytics}
                                className="w-full mt-4 flex items-center justify-center gap-1 py-2 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-[9px] font-mono font-bold text-red-400 uppercase tracking-widest transition-all cursor-pointer"
                              >
                                <Trash className="h-3.5 w-3.5" /> Clear All IndexedDB
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                            {gameState.players.map(p => {
                              const isSelected = selectedPlayerId === p.id || (!selectedPlayerId && p.id === playerId);
                              const hasDiag = !!p.diagnostics;
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    soundManager.playClick();
                                    setSelectedPlayerId(p.id);
                                  }}
                                  className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer group relative ${
                                    isSelected
                                      ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-md'
                                      : 'bg-neutral-900/40 border-transparent hover:bg-neutral-800/30 hover:border-neutral-800 text-neutral-400 hover:text-neutral-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 truncate">
                                    <div className="relative">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] font-mono select-none ${
                                        p.isHost ? 'bg-red-500/20 text-red-400 border border-red-500/35' : 'bg-neutral-800 text-neutral-300 border border-neutral-700/60'
                                      }`}>
                                        {p.name.slice(0, 2).toUpperCase()}
                                      </div>
                                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0b11] ${
                                        p.isConnected ? 'bg-emerald-400' : 'bg-neutral-600'
                                      }`} />
                                    </div>
                                    <div className="truncate">
                                      <span className={`text-[11px] font-mono font-bold block ${isSelected ? 'text-neutral-100' : 'text-neutral-300'}`}>
                                        {p.name} {p.id === playerId && <span className="text-[8px] text-red-400 font-extrabold uppercase ml-1">(YOU)</span>}
                                      </span>
                                      <span className="text-[8px] font-mono text-neutral-500 uppercase block truncate">
                                        {p.role ? p.role : 'SPECTATOR'} • {p.isConnected ? 'ONLINE' : 'OFFLINE'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {hasDiag ? (
                                      <span className="text-[8px] font-mono font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded-md">
                                        TELEMETRY
                                      </span>
                                    ) : (
                                      <span className="text-[8px] font-mono font-black bg-yellow-500/5 text-yellow-500/60 border border-yellow-500/10 px-1.5 py-0.5 rounded-md">
                                        ACTIVE
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Detail Panel */}
                      <div className="lg:col-span-8 space-y-5">
                        {(() => {
                          const isArchiveMode = !!selectedSessionId;
                          let targetPlayer: any = null;
                          let diag: any = null;

                          if (isArchiveMode) {
                            if (selectedSessionId === 'ARCHIVE_EMPTY') {
                              return (
                                <div className="bg-[#0d0e15]/40 border border-neutral-800/60 rounded-2xl p-12 text-center text-neutral-500 italic font-mono text-xs">
                                  No local archive records found in IndexedDB.
                                </div>
                              );
                            }
                            const record = localDBAnalytics.find(a => a.sessionId === selectedSessionId);
                            if (!record) {
                              return (
                                <div className="bg-[#0d0e15]/40 border border-neutral-800/60 rounded-2xl p-12 text-center text-neutral-500 italic font-mono text-xs">
                                  Select an archive session from the list to view local telemetry.
                                </div>
                              );
                            }
                            targetPlayer = {
                              id: record.sessionId,
                              name: record.gameStats?.rank ? `Archived Session (${record.sessionId.slice(-6).toUpperCase()})` : `Agent Local Session`,
                              isHost: false,
                              isConnected: false,
                              role: 'RECORDED LOG',
                              score: (record.gameStats?.wins || 0) + (record.gameStats?.losses || 0),
                              wins: record.gameStats?.wins || 0
                            };
                            diag = record;
                          } else {
                            const activePid = selectedPlayerId || playerId;
                            const activePlayer = gameState.players.find(p => p.id === activePid);
                            if (!activePlayer) {
                              return (
                                <div className="bg-[#0d0e15]/40 border border-neutral-800/60 rounded-2xl p-12 text-center text-neutral-500 italic font-mono text-xs">
                                  Select a player from the list to view live cognitive telemetry.
                                </div>
                              );
                            }
                            targetPlayer = activePlayer;
                            diag = targetPlayer.diagnostics || {
                              sessionId: 'SESS-' + targetPlayer.id.toUpperCase() + '-' + Date.now().toString().slice(-4),
                              ip: '192.168.1.155',
                              location: 'Bengaluru, Karnataka, India',
                              browserName: 'Chrome',
                              browserVersion: '126.0.0.0',
                              os: 'macOS Sonoma',
                              deviceType: 'Desktop',
                              screenResolution: `${window.screen.width}x${window.screen.height}`,
                              language: navigator.language || 'en-US',
                              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
                              referrer: 'Direct Entry / Bookmark',
                              userAgent: navigator.userAgent,
                              sessionDuration: 45,
                              pagesVisited: ['Lobby Screen'],
                              buttonClicks: 12,
                              mouseClicks: 18,
                              mouseDistance: 2540,
                              lastMousePos: { x: 340, y: 520 },
                              maxScrollDepth: 10,
                              keyboardInputsCount: 30,
                              connectionSpeed: '42ms Latency',
                              networkType: 'Broadband',
                              localStorageSizeKb: 0.85,
                              cookiesCount: 1,
                              gameStats: {
                                wins: targetPlayer.wins || 0,
                                losses: targetPlayer.score ? Math.max(0, targetPlayer.score - targetPlayer.wins) : 0,
                                playtimeMinutes: 15,
                                rank: targetPlayer.wins >= 3 ? 'Field Agent (Rank C)' : 'Rookie Detective (Rank D)',
                                roundsPlayed: (targetPlayer.wins || 0) + 1,
                                spyRatio: '0%'
                              }
                            };
                          }

                          return (
                            <div className="space-y-5 animate-fadeIn">
                              {/* Selected Player Identity Mini-Hero */}
                              <div className="bg-[#0d0e15] border border-neutral-800/85 p-5 rounded-2xl flex items-center justify-between shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500/20 to-neutral-900 border border-red-500/30 flex items-center justify-center font-black text-xs font-mono text-neutral-100">
                                    {targetPlayer.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <h4 className="text-sm font-bold text-neutral-100 font-mono tracking-tight flex items-center gap-1.5">
                                      {targetPlayer.name}
                                    </h4>
                                    <p className="text-[9px] font-mono text-red-450 uppercase font-black">
                                      SESSION ID: <span className="text-neutral-400 font-bold">{diag.sessionId}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                  <div>
                                    <span className="text-[10px] font-mono font-bold text-neutral-500 block">GAME ROLE</span>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-red-500/10 text-red-400 border border-red-500/15 uppercase tracking-wider mt-0.5 inline-block">
                                      {targetPlayer.role || 'SPECTATOR'}
                                    </span>
                                  </div>
                                  {isArchiveMode && (
                                    <button
                                      onClick={() => handleDeleteSessionAnalytic(diag.sessionId)}
                                      className="p-2 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer"
                                      title="Delete Session Record"
                                    >
                                      <Trash className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* 4-Panel Bento Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* PANEL 1: CLIENT IDENTITY & ENVIRONMENT */}
                                <div className="bg-[#0d0e15]/40 border border-neutral-850 p-4.5 rounded-2xl space-y-3.5">
                                  <div className="flex items-center gap-1.5 text-neutral-300 border-b border-neutral-800/55 pb-2">
                                    <Monitor className="h-4 w-4 text-red-500" />
                                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-200">System & Client Profile</span>
                                  </div>
                                  <div className="space-y-2 text-[10px] font-mono text-neutral-400">
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">OPERATING SYSTEM:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.os}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">BROWSER & VER:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.browserName} v{diag.browserVersion.split('.')[0]}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">DEVICE CATEGORY:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.deviceType}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">SCREEN RESOLUTION:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.screenResolution} px</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">LANGUAGE PREF:</span>
                                      <span className="text-neutral-100 font-semibold uppercase">{diag.language}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">CLIENT TIMEZONE:</span>
                                      <span className="text-neutral-100 font-semibold truncate max-w-[150px]">{diag.timezone}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">REFERRER WEB:</span>
                                      <span className="text-neutral-100 font-semibold truncate max-w-[150px]" title={diag.referrer}>{diag.referrer}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* PANEL 2: CONNECTION & GEOLOCATION */}
                                <div className="bg-[#0d0e15]/40 border border-neutral-850 p-4.5 rounded-2xl space-y-3.5">
                                  <div className="flex items-center gap-1.5 text-neutral-300 border-b border-neutral-800/55 pb-2">
                                    <Globe className="h-4 w-4 text-red-500" />
                                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-200">Network Geolocation</span>
                                  </div>
                                  <div className="space-y-2 text-[10px] font-mono text-neutral-400">
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">IP ADDRESS (APPROX):</span>
                                      <span className="text-emerald-450 font-bold">{diag.ip}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">GEOGRAPHIC LOC:</span>
                                      <span className="text-neutral-100 font-semibold truncate max-w-[150px]" title={diag.location}>{diag.location}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">LATENCY / JITTER:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.connectionSpeed}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">CONNECTION TYPE:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.networkType}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">COOKIES STORAGE:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.cookiesCount} Active Keys</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">LOCALSTORAGE METRIC:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.localStorageSizeKb} KB</span>
                                    </div>
                                  </div>
                                </div>

                                {/* PANEL 3: USER COGNITIVE BEHAVIOR */}
                                <div className="bg-[#0d0e15]/40 border border-neutral-850 p-4.5 rounded-2xl space-y-3.5 md:col-span-2">
                                  <div className="flex items-center gap-1.5 text-neutral-300 border-b border-neutral-800/55 pb-2">
                                    <Activity className="h-4 w-4 text-red-500" />
                                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-200">Interactive Telemetry & Behavior</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[10px] font-mono text-neutral-400">
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">SESSION DURATION:</span>
                                      <span className="text-neutral-100 font-semibold">
                                        {Math.floor(diag.sessionDuration / 60)}m {diag.sessionDuration % 60}s
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">BUTTON CLICKS:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.buttonClicks} standard actions</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">MOUSE PRESSED / RELEASES:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.mouseClicks} clicks</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">MOUSE COORDINATES (LAST):</span>
                                      <span className="text-neutral-100 font-semibold">X: {diag.lastMousePos?.x ?? 0}, Y: {diag.lastMousePos?.y ?? 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">TOTAL MOUSE TRAVELED:</span>
                                      <span className="text-neutral-100 font-semibold">
                                        {diag.mouseDistance ? `${(diag.mouseDistance / 96 * 0.0254).toFixed(1)} meters` : '0 meters'} ({diag.mouseDistance?.toLocaleString() || 0}px)
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-neutral-500">KEYBOARD KEYPRESSES:</span>
                                      <span className="text-neutral-100 font-semibold">{diag.keyboardInputsCount} strokes (no passwords captured)</span>
                                    </div>
                                    
                                    <div className="sm:col-span-2 pt-2 border-t border-neutral-800/40 space-y-2 mt-2">
                                      <div className="flex justify-between items-center">
                                        <span className="text-neutral-500 uppercase font-black text-[9px]">Scroll Progression:</span>
                                        <span className="text-red-400 font-extrabold text-[10px]">{diag.maxScrollDepth}% Deep</span>
                                      </div>
                                      <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                                        <div 
                                          className="bg-gradient-to-r from-red-600 to-red-400 h-full rounded-full transition-all duration-500" 
                                          style={{ width: `${diag.maxScrollDepth}%` }}
                                        />
                                      </div>
                                    </div>

                                    <div className="sm:col-span-2 space-y-1.5 mt-2">
                                      <span className="text-neutral-500 uppercase font-black text-[9px] block">Game Screens Visited ({diag.pagesVisited.length}):</span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {diag.pagesVisited.map((page: string, idx: number) => (
                                          <span key={idx} className="bg-neutral-800/60 border border-neutral-700/40 text-neutral-300 px-2.5 py-0.5 rounded-md text-[9px]">
                                            {page}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* PANEL 4: GAME ACCUMULATED PROFILE */}
                                <div className="bg-[#0d0e15]/40 border border-neutral-850 p-4.5 rounded-2xl space-y-3.5 md:col-span-2">
                                  <div className="flex items-center gap-1.5 text-neutral-300 border-b border-neutral-800/55 pb-2">
                                    <Heart className="h-4 w-4 text-red-500" />
                                    <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-neutral-200">Historical Game Metrics</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[10px] font-mono text-neutral-400">
                                    <div className="bg-neutral-900/50 border border-neutral-800 p-3 rounded-xl space-y-1">
                                      <span className="text-neutral-500 block text-[8px] uppercase">RANK / EXPERIENCE:</span>
                                      <span className="text-red-400 font-extrabold text-xs block">{diag.gameStats.rank}</span>
                                    </div>
                                    <div className="bg-neutral-900/50 border border-neutral-800 p-3 rounded-xl space-y-1">
                                      <span className="text-neutral-500 block text-[8px] uppercase">MATCH RECORD (W/L):</span>
                                      <span className="text-neutral-100 font-bold text-xs block">{diag.gameStats.wins} Wins / {diag.gameStats.losses} Losses</span>
                                    </div>
                                    <div className="bg-neutral-900/50 border border-neutral-800 p-3 rounded-xl space-y-1">
                                      <span className="text-neutral-500 block text-[8px] uppercase">SPY ACCURACY:</span>
                                      <span className="text-neutral-100 font-bold text-xs block">{diag.gameStats.spyRatio} accuracy</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>

          </div>

          {/* FOOTER STATS BAR */}
          <div className="bg-[#0d0e15] border-t border-neutral-800/60 px-6 py-3 flex items-center justify-between text-[10px] text-neutral-500 shrink-0 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span>SERVER ENGINE: <strong className="text-emerald-400 font-bold uppercase">Connected</strong></span>
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-red-500" />
              <span>SECURE SUPERUSER MODE ACTIVE</span>
            </span>
          </div>

        </div>

      </motion.div>
    </div>
  );
}

// Inline fallback components for React Lucide Icons just in case they aren't directly available under custom naming
function MessageSquareIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
  );
}

function VoteIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 12 2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
  );
}

function TargetIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
  );
}

function StarIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  );
}

function AwardIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
  );
}
