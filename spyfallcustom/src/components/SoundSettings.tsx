import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, User, Globe, Check, Save } from 'lucide-react';
import { soundManager } from '../soundManager';
import { translations, Language } from '../translations';

interface SoundSettingsProps {
  currentName: string;
  onChangeName: (newName: string) => void;
  currentLanguage: Language;
  onChangeLanguage: (newLang: Language) => void;
  onClose?: () => void;
}

export default function SoundSettings({
  currentName,
  onChangeName,
  currentLanguage,
  onChangeLanguage,
  onClose,
}: SoundSettingsProps) {
  const t = translations[currentLanguage] || translations.en;

  // Sound States
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('sfxVolume');
    return saved ? parseFloat(saved) : 0.5;
  });
  const [muted, setMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('sfxMuted');
    return saved === 'true';
  });

  // Name State
  const [nickname, setNickname] = useState(currentName);
  const [savedNameFeedback, setSavedNameFeedback] = useState(false);

  useEffect(() => {
    soundManager.setVolume(volume);
    soundManager.setMuted(muted);
    localStorage.setItem('sfxVolume', volume.toString());
    localStorage.setItem('sfxMuted', muted.toString());
  }, [volume, muted]);

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    
    soundManager.playClick();
    onChangeName(nickname.trim());
    setSavedNameFeedback(true);
    setTimeout(() => {
      setSavedNameFeedback(false);
    }, 2000);
  };

  const languagesList: { code: Language; native: string; label: string }[] = [
    { code: 'en', native: 'English', label: 'English' },
    { code: 'hi', native: 'हिन्दी', label: 'Hindi' },
    { code: 'pa', native: 'ਪੰਜਾਬੀ', label: 'Punjabi' },
    { code: 'ta', native: 'தமிழ்', label: 'Tamil' },
    { code: 'te', native: 'తెలుగు', label: 'Telugu' },
    { code: 'mr', native: 'मराठी', label: 'Marathi' },
  ];

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] p-6 rounded-2xl max-w-sm w-full space-y-6 shadow-2xl">
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-3">
        <h3 className="font-sans text-sm font-bold tracking-wider uppercase text-neutral-300 flex items-center gap-2">
          <Globe className="h-4.5 w-4.5 text-[#3b82f6]" />
          {t.settingsPreferences}
        </h3>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-xs text-neutral-400 hover:text-white bg-[#2a2a2a] hover:bg-[#353535] px-2.5 py-1 rounded-lg border border-[#3e3e3e] cursor-pointer transition-colors"
          >
            {t.close}
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* NICKNAME CHANGE SECTION */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-[#3b82f6]" />
            {t.changeNickname}
          </label>
          <form onSubmit={handleSaveNickname} className="flex gap-2">
            <input
              type="text"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 bg-[#151515] border border-[#2e2e2e] text-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#3b82f6]"
              placeholder={t.enterName}
            />
            <button
              type="submit"
              disabled={!nickname.trim()}
              className={`px-3 py-2 rounded-xl border font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${
                savedNameFeedback
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-[#2a2a2a] border-[#3e3e3e] text-neutral-300 hover:bg-[#353535] active:scale-95'
              }`}
            >
              {savedNameFeedback ? (
                <>
                  <Check className="h-3.5 w-3.5 animate-bounce" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>{t.save}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* LANGUAGE SELECT SECTION */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-[#3b82f6]" />
            {t.changeLanguage}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {languagesList.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  onChangeLanguage(lang.code);
                }}
                className={`py-2 px-3 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                  currentLanguage === lang.code
                    ? 'bg-blue-600/15 border-blue-500/45 text-blue-400 font-semibold'
                    : 'bg-[#151515] border-[#262626] text-neutral-400 hover:border-[#3e3e3e] hover:text-neutral-200'
                }`}
              >
                <span className="text-xs font-bold">{lang.native}</span>
                <span className="text-[9px] opacity-70 uppercase tracking-wide font-mono">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SOUNDS & SFX SECTION */}
        <div className="space-y-3 pt-2 border-t border-[#2e2e2e]">
          {/* Mute Toggle */}
          <div className="flex items-center justify-between bg-[#151515] p-3 rounded-xl border border-[#262626]">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-[#3b82f6]" />
              {t.muteAll}
            </span>
            <button
              onClick={() => {
                soundManager.playClick();
                setMuted(!muted);
              }}
              className={`p-2 rounded-lg transition-colors border cursor-pointer ${
                muted 
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                  : 'bg-[#2a2a2a] text-[#3b82f6] border-[#3e3e3e] hover:bg-[#353535]'
              }`}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              <span>{t.effectsVolume}</span>
              <span>{Math.round(volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX className="h-4 w-4 text-neutral-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                disabled={muted}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#151515] rounded-lg appearance-none cursor-pointer accent-[#3b82f6] disabled:opacity-30"
              />
              <Volume2 className="h-4 w-4 text-[#3b82f6]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
