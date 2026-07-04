import React from 'react';
import { RoomSettings } from '../types';
import { Sliders, Trophy, Layers, Lock, Unlock } from 'lucide-react';
import { soundManager } from '../soundManager';

interface SettingsPanelProps {
  settings: RoomSettings;
  onUpdateSettings: (settings: Partial<RoomSettings>) => void;
  isHost: boolean;
}

export default function SettingsPanel({ settings, onUpdateSettings, isHost }: SettingsPanelProps) {
  const handleChange = (key: keyof RoomSettings, value: any) => {
    if (!isHost) return;
    soundManager.playClick();
    onUpdateSettings({ [key]: value });
  };

  const timerOptions = [
    { label: '30s', value: 30 },
    { label: '1m', value: 60 },
    { label: '2m', value: 120 },
    { label: '3m', value: 180 },
    { label: '5m', value: 300 },
    { label: '8m', value: 480 },
    { label: '10m', value: 600 },
  ];

  const quickTimerOptions = [
    { label: '15s', value: 15 },
    { label: '30s', value: 30 },
    { label: '45s', value: 45 },
    { label: '60s', value: 60 },
    { label: '90s', value: 90 },
    { label: '120s', value: 120 },
  ];

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] p-6 rounded-2xl space-y-6">
      <div className="flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
        <Sliders className="h-4.5 w-4.5 text-[#3b82f6]" />
        <h3 className="font-sans text-sm font-bold tracking-wider uppercase text-neutral-300">Match Customization</h3>
      </div>

      <div className="space-y-4 text-neutral-200">
        {/* Winning Score */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Winning Score
          </label>
          <div className="flex items-center gap-2">
            {[3, 5, 7, 10, 15].map(score => (
              <button
                key={score}
                type="button"
                disabled={!isHost}
                onClick={() => handleChange('winningScore', score)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  settings.winningScore === score
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                    : 'bg-[#2a2a2a] border-[#3a3a3a] hover:border-[#4a4a4a] text-neutral-400'
                }`}
              >
                {score} pts
              </button>
            ))}
          </div>
        </div>

        {/* Discussion Timer */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
            Discussion Timer
          </label>
          <div className="flex flex-wrap gap-1.5">
            {timerOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                disabled={!isHost}
                onClick={() => handleChange('discussionTimer', opt.value)}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-medium border transition-all ${
                  settings.discussionTimer === opt.value
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                    : 'bg-[#2a2a2a] border-[#3a3a3a] hover:border-[#4a4a4a] text-neutral-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voting & Guess Timers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
              Voting Timer
            </label>
            <select
              disabled={!isHost}
              value={settings.votingTimer}
              onChange={(e) => handleChange('votingTimer', parseInt(e.target.value))}
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#3b82f6] text-neutral-200 cursor-pointer"
            >
              {quickTimerOptions.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-[#1e1e1e] text-neutral-200">{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
              Spy Guess Timer
            </label>
            <select
              disabled={!isHost}
              value={settings.spyGuessTimer}
              onChange={(e) => handleChange('spyGuessTimer', parseInt(e.target.value))}
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#3b82f6] text-neutral-200 cursor-pointer"
            >
              {quickTimerOptions.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-[#1e1e1e] text-neutral-200">{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Spies & Players Count */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
              Number of Spies
            </label>
            <div className="flex gap-1.5">
              {[1, 2, 3].map(count => (
                <button
                  key={count}
                  type="button"
                  disabled={!isHost}
                  onClick={() => handleChange('numSpies', count)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    settings.numSpies === count
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                      : 'bg-[#2a2a2a] border-[#3a3a3a] hover:border-[#4a4a4a] text-neutral-400'
                  }`}
                >
                  {count} Spy
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
              Max Players
            </label>
            <select
              disabled={!isHost}
              value={settings.maxPlayers}
              onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value))}
              className="w-full bg-[#2a2a2a] border border-[#3a3a3a] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#3b82f6] text-neutral-200 cursor-pointer"
            >
              {[4, 6, 8, 10, 12, 16, 20].map(cnt => (
                <option key={cnt} value={cnt} className="bg-[#1e1e1e] text-neutral-200">{cnt} Players</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggle Row: Multiple Packs (Left) & Lock Lobby (Right) */}
        <div className="bg-[#151515] p-3 rounded-xl border border-[#252525] flex items-center justify-between gap-4">
          {/* Multiple Word Packs (Left) */}
          <div className="flex-1 flex items-center justify-between border-r border-[#2d2d2d] pr-3">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <div className="text-left">
                <p className="text-[11px] font-bold text-neutral-200 leading-none">Multi Packs</p>
                <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider font-bold mt-0.5">Wordpacks</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!isHost}
              onClick={() => {
                const nextVal = !settings.multiplePacksEnabled;
                handleChange('multiplePacksEnabled', nextVal);
              }}
              className={`relative inline-flex h-4.5 w-8.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.multiplePacksEnabled ? 'bg-blue-600' : 'bg-neutral-800'
              } ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.multiplePacksEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Lock Lobby (Right) */}
          <div className="flex-1 flex items-center justify-between pl-1">
            <div className="flex items-center gap-1.5">
              {settings.isLobbyLocked ? (
                <Lock className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              <div className="text-left">
                <p className="text-[11px] font-bold text-neutral-200 leading-none">Lock Lobby</p>
                <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider font-bold mt-0.5">Joining</p>
              </div>
            </div>
            <button
              type="button"
              disabled={!isHost}
              onClick={() => {
                const nextVal = !settings.isLobbyLocked;
                handleChange('isLobbyLocked', nextVal);
              }}
              className={`relative inline-flex h-4.5 w-8.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.isLobbyLocked ? 'bg-rose-600' : 'bg-neutral-800'
              } ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.isLobbyLocked ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
