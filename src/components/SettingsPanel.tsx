import React from 'react';
import { RoomSettings } from '../types';
import { Sliders, Trophy } from 'lucide-react';
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
      </div>
    </div>
  );
}
