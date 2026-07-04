import React, { useState, useEffect } from 'react';
import { WordPack } from '../types';
import { BUILT_IN_PACKS } from '../wordPacks';
import { 
  Plus, Trash2, Edit2, Download, Check, X, Sparkles, Settings, 
  FolderHeart, Globe, Search, Gamepad2, Landmark, History, 
  Compass, Building2, Music, Dumbbell, Coffee, Film, Flame,
  Briefcase, Laptop, Lock
} from 'lucide-react';
import { soundManager } from '../soundManager';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getLocalCustomPacks, 
  saveLocalCustomPack, 
  deleteLocalCustomPack 
} from '../indexedDB';

interface WordPackManagerProps {
  activePacks: string[];
  customPacks: WordPack[];
  onUpdatePacks: (activePacks: string[], customPacks: WordPack[]) => void;
  isHost: boolean;
  multiplePacksEnabled: boolean;
  onToggleMultiplePacks: (enabled: boolean) => void;
  onErrorAlert: (msg: string) => void;
}

// Map pack IDs to custom premium icons for beautiful visual presentation
const PACK_ICONS: Record<string, React.ComponentType<any>> = {
  classic: Compass,
  standard: Globe,
  historical: History,
  horror: Flame,
  gaming: Gamepad2,
  vacations: Compass,
  scifi: Sparkles,
  indian: Landmark,
  cities: Globe,
  bollywood: Film,
  landmarks: Landmark,
  sports: Dumbbell,
  food: Coffee,
  company: Building2,
  music: Music,
  professions: Briefcase,
  internet: Laptop,
  restricted: Lock,
};

// Map pack IDs to modern descriptions
const PACK_DESCRIPTIONS: Record<string, string> = {
  classic: 'The original 28 locations for Classic Spyfall.',
  standard: 'Modern standard spots like Startup Offices and Data Centers.',
  historical: 'Travel through time from Ancient Egypt to Victorian Mansions.',
  horror: 'Spooky locations like Haunted Mansions and Zombie Shelters.',
  gaming: 'Gamers’ domains from Esports Arenas to Roblox Studios.',
  vacations: 'Relaxing spots including Ski Resorts and Glamping camps.',
  scifi: 'Futuristic places including Moon Bases and Quantum Labs.',
  indian: 'Culturally rich Indian landmarks like Taj Mahal and Red Fort.',
  cities: 'Global destinations from Tokyo to Los Angeles.',
  bollywood: 'Star-studded Bollywood celebrities and cultural icons.',
  landmarks: 'Famous global monuments like the Eiffel Tower and Great Wall.',
  sports: 'Athletic domains from Olympic Villages to Boxing Rings.',
  food: 'Delicious treats from Tacos and Sushi to Biryani.',
  company: 'Global tech giants and market leaders.',
  music: 'Pop, Rock, and Desi superstars from Taylor Swift to Arijit Singh.',
  professions: 'Professional careers from Doctors and Pilots to Software Developers.',
  internet: 'Digital domains and platforms from Discord and Reddit to Claude and Figma.',
  restricted: 'Top-secret bunkers, Area 51, and underground vaults.',
};

export default function WordPackManager({ 
  activePacks, 
  customPacks, 
  onUpdatePacks, 
  isHost,
  multiplePacksEnabled,
  onToggleMultiplePacks,
  onErrorAlert
}: WordPackManagerProps) {
  // Modal toggle states
  const [showMorePacksModal, setShowMorePacksModal] = useState(false);
  const [showCustomPacksModal, setShowCustomPacksModal] = useState(false);
  
  // Custom Pack state variables
  const [newPackName, setNewPackName] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [importText, setImportText] = useState('');
  const [newWordInput, setNewWordInput] = useState('');
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editingWordValue, setEditingWordValue] = useState('');
  
  // Search state for filters inside modals
  const [morePacksSearch, setMorePacksSearch] = useState('');
  const [customWordsSearch, setCustomWordsSearch] = useState('');

  // 1. Sync local custom packs from IndexedDB on mount & promote to room
  useEffect(() => {
    if (isHost) {
      getLocalCustomPacks()
        .then((localPacks) => {
          if (localPacks && localPacks.length > 0) {
            // Merge local packs by ID into current room state if they are missing
            const roomPackIds = new Set(customPacks.map(p => p.id));
            const missingPacks = localPacks.filter(p => !roomPackIds.has(p.id));
            if (missingPacks.length > 0) {
              const merged = [...customPacks, ...missingPacks];
              onUpdatePacks(activePacks, merged);
            }
          }
        })
        .catch(err => console.error('Error fetching custom packs on mount:', err));
    }
  }, [isHost]);

  // Handle active status toggles
  const handleTogglePack = (packId: string) => {
    if (!isHost) return;
    soundManager.playClick();
    let updatedActive: string[];
    if (activePacks.includes(packId)) {
      if (activePacks.length <= 1) return; // Need at least 1 active pack to play
      updatedActive = activePacks.filter(id => id !== packId);
    } else {
      if (!multiplePacksEnabled) {
        // If multiple packs is OFF, cannot select more than 1!
        // Show the elegant alert popup
        onErrorAlert("To select more than one pack, please enable the 'Multiple Word Packs' option below.");
        return;
      }
      updatedActive = [...activePacks, packId];
    }
    onUpdatePacks(updatedActive, customPacks);
  };

  // Create a brand new Custom Pack
  const handleCreateCustomPack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost || !newPackName.trim()) return;
    soundManager.playClick();

    const newPackId = 'custom-' + Math.random().toString(36).substring(2, 11);
    const newPack: WordPack = {
      id: newPackId,
      name: newPackName.trim(),
      words: ['Airport', 'Shopping Mall', 'Cinema', 'Museum', 'Water Park'], // High-quality defaults
      isCustom: true
    };

    const updatedCustom = [...customPacks, newPack];
    const updatedActive = [...activePacks, newPackId];
    
    setNewPackName('');
    setSelectedPackId(newPackId);
    
    // Persist to IndexedDB
    try {
      await saveLocalCustomPack(newPack);
    } catch (err) {
      console.error('Failed to save to IndexedDB:', err);
    }

    onUpdatePacks(updatedActive, updatedCustom);
  };

  // Delete a Custom Pack
  const handleDeletePack = async (packId: string) => {
    if (!isHost) return;
    soundManager.playClick();
    const updatedCustom = customPacks.filter(p => p.id !== packId);
    const updatedActive = activePacks.filter(id => id !== packId);

    if (selectedPackId === packId) {
      setSelectedPackId('');
    }

    // Remove from IndexedDB
    try {
      await deleteLocalCustomPack(packId);
    } catch (err) {
      console.error('Failed to delete from IndexedDB:', err);
    }

    onUpdatePacks(updatedActive, updatedCustom);
  };

  // Add a word to a selected Custom Pack
  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost || !newWordInput.trim() || !selectedPackId) return;
    soundManager.playClick();

    const wordToAdd = newWordInput.trim();
    let targetPack: WordPack | undefined;

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        if (pack.words.includes(wordToAdd)) return pack; // avoid duplicates
        targetPack = {
          ...pack,
          words: [...pack.words, wordToAdd]
        };
        return targetPack;
      }
      return pack;
    });

    setNewWordInput('');
    if (targetPack) {
      await saveLocalCustomPack(targetPack);
    }
    onUpdatePacks(activePacks, updatedCustom);
  };

  // Remove a word from a selected Custom Pack
  const handleRemoveWord = async (wordToRemove: string) => {
    if (!isHost || !selectedPackId) return;
    soundManager.playClick();

    let targetPack: WordPack | undefined;

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        targetPack = {
          ...pack,
          words: pack.words.filter(w => w !== wordToRemove)
        };
        return targetPack;
      }
      return pack;
    });

    if (targetPack) {
      await saveLocalCustomPack(targetPack);
    }
    onUpdatePacks(activePacks, updatedCustom);
  };

  // Start word edit
  const handleStartEditWord = (idx: number, currentWord: string) => {
    if (!isHost) return;
    setEditingWordIndex(idx);
    setEditingWordValue(currentWord);
  };

  // Save word edit
  const handleSaveEditWord = async (idx: number) => {
    if (!isHost || !editingWordValue.trim() || !selectedPackId) return;
    soundManager.playClick();

    let targetPack: WordPack | undefined;

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        const wordsCopy = [...pack.words];
        wordsCopy[idx] = editingWordValue.trim();
        targetPack = {
          ...pack,
          words: wordsCopy
        };
        return targetPack;
      }
      return pack;
    });

    setEditingWordIndex(null);
    if (targetPack) {
      await saveLocalCustomPack(targetPack);
    }
    onUpdatePacks(activePacks, updatedCustom);
  };

  // Bulk import from text box
  const handleImportTextList = async () => {
    if (!isHost || !importText.trim() || !selectedPackId) return;
    soundManager.playClick();

    const parsedWords = importText
      .split(/[,\n]/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (parsedWords.length === 0) return;

    let targetPack: WordPack | undefined;

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        const mergedWords = Array.from(new Set([...pack.words, ...parsedWords]));
        targetPack = {
          ...pack,
          words: mergedWords
        };
        return targetPack;
      }
      return pack;
    });

    setImportText('');
    if (targetPack) {
      await saveLocalCustomPack(targetPack);
    }
    onUpdatePacks(activePacks, updatedCustom);
  };

  // Export JSON file
  const handleExportPack = (pack: WordPack) => {
    soundManager.playClick();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pack, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${pack.name.toLowerCase().replace(/\s+/g, '_')}_pack.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Group built-in packs into Primary and More Packs
  const primaryBuiltIn = BUILT_IN_PACKS.filter(p => p.id === 'classic' || p.id === 'standard');
  const moreBuiltIn = BUILT_IN_PACKS.filter(p => p.id !== 'classic' && p.id !== 'standard');

  const selectedPack = customPacks.find(p => p.id === selectedPackId);

  // Search filter for "More Packs"
  const filteredMorePacks = moreBuiltIn.filter(pack => 
    pack.name.toLowerCase().includes(morePacksSearch.toLowerCase()) ||
    (PACK_DESCRIPTIONS[pack.id] || '').toLowerCase().includes(morePacksSearch.toLowerCase())
  );

  // Search filter for Custom pack words
  const filteredCustomWords = selectedPack 
    ? selectedPack.words.filter(word => word.toLowerCase().includes(customWordsSearch.toLowerCase()))
    : [];

  // Active counts
  const activeMorePacksCount = activePacks.filter(id => !['classic', 'standard'].includes(id) && !id.startsWith('custom-')).length;
  const activeCustomPacksCount = activePacks.filter(id => id.startsWith('custom-')).length;

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] p-5 rounded-2xl space-y-4">
      {/* Word Packs section header */}
      <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#3b82f6]" />
          <h3 className="font-sans text-xs font-black tracking-wider uppercase text-neutral-300">Word Packs</h3>
        </div>
      </div>

      {/* Elegant Toast Alert */}
      {/* Main Selection Area: Shows only Classic and Standard primary packs */}
      <div className="grid grid-cols-2 gap-3">
        {primaryBuiltIn.map(pack => {
          const isActive = activePacks.includes(pack.id);
          const IconComp = PACK_ICONS[pack.id] || Globe;
          return (
            <button
              key={pack.id}
              type="button"
              onClick={() => handleTogglePack(pack.id)}
              disabled={!isHost}
              className={`flex flex-col p-3 rounded-xl border text-left transition-all relative ${
                isActive
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/5'
                  : 'bg-[#2a2a2a]/40 border-[#2e2e2e] text-neutral-400 hover:border-[#404040] hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="p-1.5 rounded-lg bg-[#1a1a1a]/80 border border-[#2c2c2c] text-neutral-300">
                  <IconComp className="h-4 w-4 text-[#3b82f6]" />
                </div>
                {isActive && <Check className="h-4 w-4 text-blue-400 shrink-0" />}
              </div>
              <div className="truncate w-full mt-1">
                <p className="text-xs font-bold truncate">{pack.name}</p>
                <p className="text-[10px] text-neutral-500">{pack.words.length} locations</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Buttons underneath the main packs */}
      <div className="flex gap-2">
        {/* More Packs trigger */}
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            setShowMorePacksModal(true);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] bg-[#222] hover:bg-[#2c2c2c] border border-[#2d2d2d] hover:border-blue-500/30 text-neutral-200 hover:text-white font-bold py-2.5 px-3 rounded-xl transition-all cursor-pointer relative"
        >
          <FolderHeart className="h-3.5 w-3.5 text-[#3b82f6]" />
          <span>More Packs</span>
          {activeMorePacksCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-blue-600 border border-blue-500 text-[8px] text-white rounded-full font-black">
              +{activeMorePacksCount}
            </span>
          )}
        </button>

        {/* Custom Packs trigger */}
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            setShowCustomPacksModal(true);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] bg-[#222] hover:bg-[#2c2c2c] border border-[#2d2d2d] hover:border-blue-500/30 text-neutral-200 hover:text-white font-bold py-2.5 px-3 rounded-xl transition-all cursor-pointer relative"
        >
          <Settings className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-200" />
          <span>Custom Packs</span>
          {activeCustomPacksCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-[#a855f7] border border-[#9333ea] text-[8px] text-white rounded-full font-black">
              +{activeCustomPacksCount}
            </span>
          )}
        </button>
      </div>

      {/* 1. FLOATING TAB MODAL FOR "MORE PACKS" */}
      <AnimatePresence>
        {showMorePacksModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1a] border border-[#2e2e2e] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] text-neutral-200"
            >
              {/* Header */}
              <div className="border-b border-[#2e2e2e] px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderHeart className="h-5 w-5 text-[#3b82f6]" />
                  <div>
                    <h3 className="font-sans font-bold text-sm tracking-wider uppercase text-neutral-100">
                      Explore More Themed Packs
                    </h3>
                    <p className="text-[10px] text-neutral-400 mt-0.5">Toggle categories to expand the secret locations pool</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMorePacksModal(false)}
                  className="p-1 text-neutral-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search filter bar */}
              <div className="px-5 py-3 border-b border-[#242424] bg-[#161616] flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search themed packs..."
                  value={morePacksSearch}
                  onChange={(e) => setMorePacksSearch(e.target.value)}
                  className="bg-transparent border-none text-xs focus:outline-none w-full text-neutral-250 placeholder:text-neutral-600"
                />
                {morePacksSearch && (
                  <button onClick={() => setMorePacksSearch('')} className="text-[10px] text-neutral-500 hover:text-neutral-300">
                    Clear
                  </button>
                )}
              </div>

              {/* Grid content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[50vh] scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredMorePacks.map(pack => {
                    const isActive = activePacks.includes(pack.id);
                    const IconComp = PACK_ICONS[pack.id] || Sparkles;
                    const desc = PACK_DESCRIPTIONS[pack.id] || '';
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => handleTogglePack(pack.id)}
                        disabled={!isHost}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                          isActive
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/5'
                            : 'bg-[#222]/40 border-[#2d2d2d] text-neutral-400 hover:border-[#3a3a3a] hover:text-white'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-blue-600/20 text-blue-400' : 'bg-[#151515] text-neutral-400'}`}>
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black truncate text-neutral-250">{pack.name}</span>
                            {isActive && <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
                          </div>
                          <p className="text-[10px] text-neutral-500 leading-normal line-clamp-2 mt-0.5">{desc}</p>
                          <span className="inline-block mt-2 text-[9px] bg-[#111] px-1.5 py-0.5 rounded text-neutral-500 border border-[#222]">
                            {pack.words.length} items
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {filteredMorePacks.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                      <p className="text-xs text-neutral-500 italic">No themed packs match "{morePacksSearch}"</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-[#2e2e2e] px-5 py-4 flex justify-between items-center bg-[#161616]">
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
                  Active themed: {activeMorePacksCount} / {moreBuiltIn.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowMorePacksModal(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. FLOATING TAB MODAL FOR "CUSTOM PACKS" */}
      <AnimatePresence>
        {showCustomPacksModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1a] border border-[#2e2e2e] w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] text-neutral-200"
            >
              {/* Header */}
              <div className="border-b border-[#2e2e2e] px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-[#3b82f6]" />
                  <div>
                    <h3 className="font-sans font-bold text-sm tracking-wider uppercase text-neutral-100">
                      Manage Custom Word Packs
                    </h3>
                    <p className="text-[10px] text-neutral-400 mt-0.5">Create your own customized location rosters (IndexedDB Persisted)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomPacksModal(false)}
                  className="p-1 text-neutral-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
                
                {/* A. Create Pack Form */}
                <form onSubmit={handleCreateCustomPack} className="bg-[#222222]/30 p-4 rounded-xl border border-[#2d2d2d] space-y-2.5">
                  <label className="text-[10px] font-black text-neutral-300 uppercase tracking-wider block">
                    Create New Word Pack
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Anime Locations, Horror Movies"
                      value={newPackName}
                      onChange={(e) => setNewPackName(e.target.value)}
                      className="flex-1 bg-[#131313] border border-[#2d2d2d] text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-[#3b82f6] text-neutral-200 placeholder:text-neutral-600"
                    />
                    <button
                      type="submit"
                      disabled={!newPackName.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs px-4 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create</span>
                    </button>
                  </div>
                </form>

                {/* B. List / Edit Pack Words Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                      Edit Existing Custom Pack
                    </label>
                    <select
                      value={selectedPackId}
                      onChange={(e) => {
                        soundManager.playClick();
                        setSelectedPackId(e.target.value);
                      }}
                      className="bg-[#222] border border-[#2d2d2d] text-xs text-neutral-300 px-3 py-2 rounded-lg focus:outline-none focus:border-[#3b82f6] cursor-pointer"
                    >
                      <option value="">-- Select custom pack --</option>
                      {customPacks.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.words.length} words)</option>
                      ))}
                    </select>
                  </div>

                  {selectedPack ? (
                    <div className="bg-[#131313] p-4 rounded-xl border border-[#242424] space-y-4">
                      {/* Selected pack header actions */}
                      <div className="flex items-center justify-between border-b border-[#222] pb-2">
                        <span className="text-xs font-black text-blue-400">{selectedPack.name}</span>
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleExportPack(selectedPack)}
                            className="text-[10px] text-[#3b82f6] hover:text-blue-300 flex items-center gap-1 font-bold"
                          >
                            <Download className="h-3 w-3" />
                            <span>Export Pack</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePack(selectedPack.id)}
                            className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete Pack</span>
                          </button>
                        </div>
                      </div>

                      {/* Word insertion */}
                      <div className="space-y-3 pt-1">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add single word/location..."
                            value={newWordInput}
                            onChange={(e) => setNewWordInput(e.target.value)}
                            className="flex-1 bg-[#1c1c1c] border border-[#2c2c2c] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#3b82f6] text-neutral-200 placeholder:text-neutral-600"
                          />
                          <button
                            type="button"
                            onClick={handleAddWord}
                            className="bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-white text-xs px-3 py-2 rounded-lg font-bold transition-all shrink-0 cursor-pointer"
                          >
                            Add Word
                          </button>
                        </div>

                        {/* Bulk import */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-black text-neutral-500 uppercase tracking-wider block">
                            Bulk Import (Commas or Newlines)
                          </span>
                          <div className="flex gap-2">
                            <textarea
                              placeholder="e.g. Stark Tower, Asgard, Wakanda"
                              value={importText}
                              onChange={(e) => setImportText(e.target.value)}
                              rows={1}
                              className="flex-1 bg-[#1c1c1c] border border-[#2c2c2c] text-xs p-2 rounded-lg focus:outline-none focus:border-[#3b82f6] text-neutral-200 resize-none placeholder:text-neutral-600"
                            />
                            <button
                              type="button"
                              onClick={handleImportTextList}
                              className="bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-neutral-300 hover:text-white text-xs px-3 rounded-lg font-bold transition-all shrink-0 cursor-pointer"
                            >
                              Import
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Words search filter & scroll list */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 border border-[#222] bg-[#1a1a1a] px-2.5 py-1.5 rounded-lg">
                          <Search className="h-3 w-3 text-neutral-500" />
                          <input
                            type="text"
                            placeholder="Search words in this pack..."
                            value={customWordsSearch}
                            onChange={(e) => setCustomWordsSearch(e.target.value)}
                            className="bg-transparent border-none text-[10px] focus:outline-none w-full text-neutral-250 placeholder:text-neutral-600"
                          />
                          {customWordsSearch && (
                            <button onClick={() => setCustomWordsSearch('')} className="text-[9px] text-neutral-500">
                              Clear
                            </button>
                          )}
                        </div>

                        <div className="max-h-40 overflow-y-auto border border-[#222] p-2 rounded bg-[#161616] space-y-1 scrollbar-thin">
                          {selectedPack.words.length === 0 ? (
                            <p className="text-[10px] text-neutral-500 italic py-2 text-center">
                              No words in this pack. Add some locations!
                            </p>
                          ) : filteredCustomWords.length === 0 ? (
                            <p className="text-[10px] text-neutral-500 italic py-2 text-center">
                              No matching words found.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {filteredCustomWords.map((word, idx) => {
                                const realIdx = selectedPack.words.indexOf(word);
                                return (
                                  <div
                                    key={word + realIdx}
                                    className="bg-[#222] hover:bg-[#2a2a2a] text-neutral-300 border border-[#2d2d2d] px-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 transition-colors group"
                                  >
                                    {editingWordIndex === realIdx ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          value={editingWordValue}
                                          onChange={(e) => setEditingWordValue(e.target.value)}
                                          className="bg-[#111] text-[11px] text-neutral-100 w-24 border border-blue-500 px-1 rounded outline-none"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => handleSaveEditWord(realIdx)}
                                          className="text-emerald-400 hover:text-emerald-300"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="select-all">{word}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={() => handleStartEditWord(realIdx, word)}
                                            className="text-neutral-400 hover:text-neutral-200"
                                            title="Edit Word"
                                          >
                                            <Edit2 className="h-2.5 w-2.5" />
                                          </button>
                                          <button
                                            onClick={() => handleRemoveWord(word)}
                                            className="text-rose-400 hover:text-rose-300"
                                            title="Delete Word"
                                          >
                                            <Trash2 className="h-2.5 w-2.5" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-[#2d2d2d] border-dashed rounded-xl p-8 text-center bg-[#131313]/20">
                      <FolderHeart className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
                      <p className="text-xs text-neutral-500 italic">
                        Select a pack from the dropdown above to edit words or create a new custom pack.
                      </p>
                    </div>
                  )}
                </div>

                {/* C. Interactive selector for loaded custom packs */}
                {customPacks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#2d2d2d]">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                      Toggle Active Custom Packs for Game
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {customPacks.map(pack => {
                        const isActive = activePacks.includes(pack.id);
                        return (
                          <button
                            key={pack.id}
                            type="button"
                            onClick={() => handleTogglePack(pack.id)}
                            disabled={!isHost}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                              isActive
                                ? 'bg-purple-500/10 border-purple-500/40 text-purple-400 shadow-sm shadow-purple-500/5'
                                : 'bg-[#222]/40 border-[#2d2d2d] text-neutral-400 hover:border-[#3a3a3a]'
                            }`}
                          >
                            <div className="truncate pr-1">
                              <p className="text-xs font-semibold truncate">{pack.name}</p>
                              <p className="text-[9px] text-neutral-500">{pack.words.length} items</p>
                            </div>
                            {isActive && <Check className="h-3.5 w-3.5 text-purple-400 shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-[#2e2e2e] px-5 py-4 flex justify-between items-center bg-[#161616]">
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
                  Active custom: {activeCustomPacksCount} / {customPacks.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomPacksModal(false)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
