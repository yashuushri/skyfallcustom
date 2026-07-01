import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Eye, EyeOff, Shield, RefreshCw } from 'lucide-react';
import { GameState, Player, GamePhase } from '../types';

interface DevPortalProps {
  roomId: string;
  playerId: string;
  gameState: GameState & { actualSpies?: string[] };
  socket: any;
  onClose: () => void;
}

export default function DevPortal({ roomId, playerId, gameState, socket, onClose }: DevPortalProps) {
  const me = gameState.players.find(p => p.id === playerId);
  const [nickname, setNickname] = useState(me?.name || '');
  const [forcedWord, setForcedWord] = useState('');
  const [selectedSpies, setSelectedSpies] = useState<string[]>([]);

  const humanPlayers = gameState.players.filter(p => !p.isDev && p.id !== 'P-bot-dot');
  const activeSpies = gameState.players.filter(p => p.role === 'spy' || gameState.actualSpies?.includes(p.id));

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

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="bg-[#121212] border border-neutral-800 w-full max-w-lg rounded-xl shadow-xl flex flex-col overflow-hidden max-h-[85vh] text-neutral-200"
      >
        {/* HEADER */}
        <div className="border-b border-neutral-800 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="h-4.5 w-4.5 text-blue-500" />
            <h2 className="font-semibold text-sm tracking-wide text-neutral-100">
              Developer Settings
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-md hover:bg-neutral-800 text-neutral-400 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* SECTION: CURRENT ROUND INTEL */}
          {gameState.phase !== 'LOBBY' && (
            <div className="space-y-3 bg-rose-950/20 p-4 rounded-lg border border-rose-500/20">
              <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                Current Round Intel / जासूसी जानकारी
              </h3>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Secret Location</span>
                  <p className="font-mono font-bold text-neutral-200 bg-neutral-950 border border-neutral-800/80 px-2.5 py-1.5 rounded-md">
                    {gameState.secretWord || 'None'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Current Phase</span>
                  <p className="font-mono font-bold text-neutral-200 bg-neutral-950 border border-neutral-800/80 px-2.5 py-1.5 rounded-md uppercase">
                    {gameState.phase}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono block">Current Round Spies</span>
                {activeSpies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {activeSpies.map(spy => (
                      <span 
                        key={spy.id} 
                        className="px-2.5 py-1 bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold rounded-md flex items-center gap-1"
                      >
                        <span className="h-1.5 w-1.5 bg-rose-400 rounded-full animate-ping" />
                        {spy.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 italic">No active spies found / इस राउंड में कोई सक्रिय जासूस नहीं है</p>
                )}
              </div>
            </div>
          )}

          {/* SECTION 1: DEV NICKNAME & INVISIBILITY */}
          <div className="space-y-3 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800/40">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Identity & Visibility</h3>
            
            <form onSubmit={handleUpdateName} className="flex gap-2">
              <input
                type="text"
                placeholder="Change nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 text-xs px-3 py-1.5 rounded-md focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Save
              </button>
            </form>

            <button
              type="button"
              onClick={handleToggleInvisibility}
              className={`w-full py-2 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-2 border cursor-pointer ${
                me?.invisible 
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-300' 
                  : 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20'
              }`}
            >
              {me?.invisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {me?.invisible ? 'Invisible (Hidden from Players)' : 'Visible to Players'}
            </button>
          </div>

          {/* SECTION 2: SECRET WORD & SPY ALLOCATION */}
          <div className="space-y-4 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800/40">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Next Round Settings</h3>

            {/* Force Word */}
            <form onSubmit={handleForceWord} className="space-y-1.5">
              <label className="text-[10px] text-neutral-400">Next Secret Word</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Custom secret word"
                  value={forcedWord}
                  onChange={(e) => setForcedWord(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 text-xs px-3 py-1.5 rounded-md focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold rounded-md transition-colors cursor-pointer text-neutral-200"
                >
                  Set Word
                </button>
              </div>
            </form>

            {/* Spy Selection */}
            {humanPlayers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] text-neutral-400">Select Spies</label>
                <div className="flex flex-wrap gap-1.5">
                  {humanPlayers.map((p) => {
                    const isSelected = selectedSpies.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleToggleForcedSpy(p.id)}
                        className={`px-2.5 py-1 border rounded-md text-[11px] transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplySpies}
                    disabled={selectedSpies.length === 0}
                    className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 disabled:opacity-30 text-white text-xs font-semibold rounded-md transition-all cursor-pointer"
                  >
                    Force Selected as Spies
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: PHASE OVERRIDES */}
          <div className="space-y-3 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800/40">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Change Phase</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Lobby', phase: 'LOBBY' as GamePhase },
                { label: 'Reveal Role', phase: 'REVEAL' as GamePhase },
                { label: 'Discussion', phase: 'DISCUSSION' as GamePhase },
                { label: 'Voting', phase: 'VOTING' as GamePhase },
                { label: 'Spy Guess', phase: 'SPY_GUESS' as GamePhase },
                { label: 'Scoreboard', phase: 'SCOREBOARD' as GamePhase },
              ].map((p) => (
                <button
                  key={p.phase}
                  onClick={() => handleForcePhase(p.phase)}
                  className={`py-2 px-3 border rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    gameState.phase === p.phase 
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <RefreshCw className="h-3 w-3" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 4: PLAYER SCORES */}
          {humanPlayers.length > 0 && (
            <div className="space-y-2.5 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800/40">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Scores Adjustment</h3>
              <div className="space-y-2">
                {humanPlayers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs bg-neutral-950 p-2 rounded-md border border-neutral-900">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-300">{p.name}</span>
                      {gameState.phase !== 'LOBBY' && p.role && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          p.role === 'spy'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : p.role === 'civilian'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}>
                          {p.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleAdjustScore(p.id, -1)}
                        className="px-2 py-0.5 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 rounded cursor-pointer"
                      >
                        -1
                      </button>
                      <span className="font-mono text-neutral-200">{p.score}</span>
                      <button 
                        onClick={() => handleAdjustScore(p.id, 1)}
                        className="px-2 py-0.5 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 rounded cursor-pointer"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
