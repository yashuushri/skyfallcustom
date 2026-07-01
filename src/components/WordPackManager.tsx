import React, { useState } from 'react';
import { WordPack } from '../types';
import { BUILT_IN_PACKS } from '../wordPacks';
import { Plus, Trash2, Edit2, Download, Upload, Check, AlertCircle, Sparkles } from 'lucide-react';
import { soundManager } from '../soundManager';

interface WordPackManagerProps {
  activePacks: string[];
  customPacks: WordPack[];
  onUpdatePacks: (activePacks: string[], customPacks: WordPack[]) => void;
  isHost: boolean;
}

export default function WordPackManager({ activePacks, customPacks, onUpdatePacks, isHost }: WordPackManagerProps) {
  const [newPackName, setNewPackName] = useState('');
  const [selectedPackId, setSelectedPackId] = useState<string>('classic');
  const [importText, setImportText] = useState('');
  const [newWordInput, setNewWordInput] = useState('');
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editingWordValue, setEditingWordValue] = useState('');

  const handleTogglePack = (packId: string) => {
    if (!isHost) return;
    soundManager.playClick();
    let updatedActive: string[];
    if (activePacks.includes(packId)) {
      // Must have at least 1 active pack
      if (activePacks.length <= 1) return;
      updatedActive = activePacks.filter(id => id !== packId);
    } else {
      updatedActive = [...activePacks, packId];
    }
    onUpdatePacks(updatedActive, customPacks);
  };

  const handleCreateCustomPack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost || !newPackName.trim()) return;
    soundManager.playClick();

    const newPackId = 'custom-' + Math.random().toString(36).substr(2, 9);
    const newPack: WordPack = {
      id: newPackId,
      name: newPackName.trim(),
      words: ['Hospital', 'Airport', 'School', 'Cinema', 'Office'], // default starters
      isCustom: true
    };

    const updatedCustom = [...customPacks, newPack];
    const updatedActive = [...activePacks, newPackId];
    setNewPackName('');
    setSelectedPackId(newPackId);
    onUpdatePacks(updatedActive, updatedCustom);
  };

  const handleDeletePack = (packId: string) => {
    if (!isHost) return;
    soundManager.playClick();
    const updatedCustom = customPacks.filter(p => p.id !== packId);
    const updatedActive = activePacks.filter(id => id !== packId);

    // If deleted selected pack, default to classic
    if (selectedPackId === packId) {
      setSelectedPackId('classic');
    }

    onUpdatePacks(updatedActive, updatedCustom);
  };

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHost || !newWordInput.trim()) return;
    soundManager.playClick();

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        if (pack.words.includes(newWordInput.trim())) return pack; // no duplicate
        return {
          ...pack,
          words: [...pack.words, newWordInput.trim()]
        };
      }
      return pack;
    });

    setNewWordInput('');
    onUpdatePacks(activePacks, updatedCustom);
  };

  const handleRemoveWord = (wordToRemove: string) => {
    if (!isHost) return;
    soundManager.playClick();

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        return {
          ...pack,
          words: pack.words.filter(w => w !== wordToRemove)
        };
      }
      return pack;
    });

    onUpdatePacks(activePacks, updatedCustom);
  };

  const handleStartEditWord = (idx: number, currentWord: string) => {
    if (!isHost) return;
    setEditingWordIndex(idx);
    setEditingWordValue(currentWord);
  };

  const handleSaveEditWord = (idx: number) => {
    if (!isHost || !editingWordValue.trim()) return;
    soundManager.playClick();

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        const wordsCopy = [...pack.words];
        wordsCopy[idx] = editingWordValue.trim();
        return {
          ...pack,
          words: wordsCopy
        };
      }
      return pack;
    });

    setEditingWordIndex(null);
    onUpdatePacks(activePacks, updatedCustom);
  };

  const handleImportTextList = () => {
    if (!isHost || !importText.trim()) return;
    soundManager.playClick();

    // Split by comma or newline
    const parsedWords = importText
      .split(/[,\n]/)
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (parsedWords.length === 0) return;

    const updatedCustom = customPacks.map(pack => {
      if (pack.id === selectedPackId) {
        // Merge without duplicates
        const merged = Array.from(new Set([...pack.words, ...parsedWords]));
        return {
          ...pack,
          words: merged
        };
      }
      return pack;
    });

    setImportText('');
    onUpdatePacks(activePacks, updatedCustom);
  };

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || !e.target.files || e.target.files.length === 0) return;
    soundManager.playClick();

    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const pack = JSON.parse(event.target?.result as string) as WordPack;
        if (pack && pack.name && Array.isArray(pack.words)) {
          const newPackId = 'custom-' + Math.random().toString(36).substr(2, 9);
          const newPack: WordPack = {
            id: newPackId,
            name: pack.name + ' (Imported)',
            words: pack.words,
            isCustom: true
          };
          const updatedCustom = [...customPacks, newPack];
          const updatedActive = [...activePacks, newPackId];
          setSelectedPackId(newPackId);
          onUpdatePacks(updatedActive, updatedCustom);
        } else {
          alert('Invalid Word Pack format.');
        }
      } catch (err) {
        alert('Failed to parse file. Ensure it is a valid JSON Word Pack.');
      }
    };
    reader.readAsText(file);
  };

  const selectedPack = BUILT_IN_PACKS.find(p => p.id === selectedPackId) || customPacks.find(p => p.id === selectedPackId);

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] p-6 rounded-2xl space-y-6">
      <div className="flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
        <Sparkles className="h-4.5 w-4.5 text-[#3b82f6]" />
        <h3 className="font-sans text-sm font-bold tracking-wider uppercase text-neutral-300">Word Packs Setup</h3>
      </div>

      {/* Select & Toggle Packs */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
          Select Active Word Packs (Must choose at least 1)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {BUILT_IN_PACKS.map(pack => {
            const isActive = activePacks.includes(pack.id);
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => handleTogglePack(pack.id)}
                disabled={!isHost}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/5'
                    : 'bg-[#2a2a2a]/40 border-[#2e2e2e] text-neutral-400 hover:border-[#404040] hover:text-white'
                }`}
              >
                <div className="truncate">
                  <p className="text-sm font-semibold truncate">{pack.name}</p>
                  <p className="text-[10px] text-neutral-400">{pack.words.length} words</p>
                </div>
                {isActive && <Check className="h-4 w-4 text-blue-400 shrink-0 ml-1" />}
              </button>
            );
          })}

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
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-sm shadow-blue-500/5'
                    : 'bg-[#2a2a2a]/40 border-[#2e2e2e] text-neutral-400 hover:border-[#404040] hover:text-white'
                }`}
              >
                <div className="truncate">
                  <p className="text-sm font-semibold truncate flex items-center gap-1">
                    {pack.name}
                    <span className="bg-[#2a2a2a] text-blue-400 border border-[#3e3e3e] text-[8px] px-1.5 py-0.5 rounded uppercase">Custom</span>
                  </p>
                  <p className="text-[10px] text-neutral-400">{pack.words.length} words</p>
                </div>
                {isActive && <Check className="h-4 w-4 text-blue-400 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Pack actions (Host Only) */}
      {isHost && (
        <div className="space-y-4 pt-4 border-t border-[#2e2e2e]">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Create Custom Pack Form */}
            <form onSubmit={handleCreateCustomPack} className="flex-1 space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Create Custom Pack
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Marvel Movies, Anime"
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  className="w-full bg-[#151515] border border-[#2e2e2e] text-sm px-3 py-2 rounded-xl focus:outline-none focus:border-[#3b82f6] text-neutral-250"
                />
                <button
                  type="submit"
                  className="bg-[#2a2a2a] hover:bg-[#353535] border border-[#3a3a3a] text-white p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Import JSON Pack */}
            <div className="sm:w-1/3 space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Upload Pack (.json)
              </label>
              <label className="flex items-center justify-center gap-2 border border-dashed border-[#2e2e2e] hover:border-[#3e3e3e] bg-[#151515] hover:bg-[#1f1f1f] text-neutral-400 hover:text-white px-3 py-2 rounded-xl cursor-pointer transition-all text-xs h-9">
                <Upload className="h-4 w-4 text-[#3b82f6]" />
                <span>Import JSON</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Editor Panel for Custom word items */}
      <div className="pt-4 border-t border-[#2e2e2e] space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
            Inspect & Edit Words
          </label>
          <select
            value={selectedPackId}
            onChange={(e) => {
              soundManager.playClick();
              setSelectedPackId(e.target.value);
            }}
            className="bg-[#2a2a2a] border border-[#3e3e3e] text-xs text-neutral-300 px-2.5 py-1 rounded-lg focus:outline-none focus:border-[#3b82f6] cursor-pointer"
          >
            <option disabled className="bg-[#1e1e1e] text-neutral-500 font-bold">-- Built-in --</option>
            {BUILT_IN_PACKS.map(p => (
              <option key={p.id} value={p.id} className="bg-[#1e1e1e] text-neutral-200">{p.name}</option>
            ))}
            {customPacks.length > 0 && <option disabled className="bg-[#1e1e1e] text-neutral-500 font-bold">-- Custom --</option>}
            {customPacks.map(p => (
              <option key={p.id} value={p.id} className="bg-[#1e1e1e] text-neutral-200">{p.name} (Custom)</option>
            ))}
          </select>
        </div>

        {selectedPack && (
          <div className="bg-[#151515] p-4 rounded-xl border border-[#2e2e2e] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-200">{selectedPack.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExportPack(selectedPack)}
                  className="text-xs text-[#3b82f6] hover:text-blue-300 flex items-center gap-1 font-semibold"
                >
                  <Download className="h-3 w-3" />
                  <span>Export JSON</span>
                </button>
                {selectedPack.isCustom && isHost && (
                  <button
                    type="button"
                    onClick={() => handleDeletePack(selectedPack.id)}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Pack</span>
                  </button>
                )}
              </div>
            </div>

            {/* Custom word addition form */}
            {selectedPack.isCustom && isHost && (
              <div className="space-y-3 pt-2">
                <form onSubmit={handleAddWord} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add single word..."
                    value={newWordInput}
                    onChange={(e) => setNewWordInput(e.target.value)}
                    className="flex-1 bg-[#252525] border border-[#353535] text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-[#3b82f6] text-neutral-200"
                  />
                  <button
                    type="submit"
                    className="bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-all shrink-0"
                  >
                    Add Word
                  </button>
                </form>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Bulk Import (Separate with Commas or Newlines)
                  </span>
                  <div className="flex gap-2">
                    <textarea
                      placeholder="e.g. Iron Man, Thor, Hulk, Captain America"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={1}
                      className="flex-1 bg-[#252525] border border-[#353535] text-xs p-2 rounded-lg focus:outline-none focus:border-[#3b82f6] text-neutral-200 resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleImportTextList}
                      className="bg-[#2a2a2a] hover:bg-[#353535] border border-[#3e3e3e] text-neutral-300 hover:text-white text-xs px-3 rounded-lg font-semibold transition-all shrink-0"
                    >
                      Import
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Words list */}
            <div className="max-h-40 overflow-y-auto border border-[#2e2e2e] p-2 rounded bg-[#1c1c1c] space-y-1 scrollbar-thin">
              {selectedPack.words.length === 0 ? (
                <p className="text-xs text-neutral-550 italic py-2 text-center">No words in this pack. Add some!</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedPack.words.map((word, idx) => (
                    <div
                      key={word + idx}
                      className="bg-[#2a2a2a] hover:bg-[#323232] text-neutral-300 border border-[#353535] px-2 py-1 rounded text-xs flex items-center gap-1.5 transition-colors group"
                    >
                      {editingWordIndex === idx ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingWordValue}
                            onChange={(e) => setEditingWordValue(e.target.value)}
                            className="bg-[#151515] text-xs text-neutral-100 w-24 border border-blue-500 px-1 rounded outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEditWord(idx)}
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="select-all">{word}</span>
                          {selectedPack.isCustom && isHost && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEditWord(idx, word)}
                                className="text-neutral-400 hover:text-neutral-200"
                              >
                                <Edit2 className="h-2.5 w-2.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveWord(word)}
                                className="text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
