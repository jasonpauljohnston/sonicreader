import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Library, 
  PlayCircle, 
  Settings as SettingsIcon, 
  Upload, 
  Plus, 
  History, 
  Mic, 
  Pause, 
  Play, 
  Rewind, 
  FastForward, 
  ChevronRight,
  Search,
  Menu,
  Bookmark,
  Volume2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PDFDocument, extractTextFromPDF } from './lib/pdf';
import { audioService } from './lib/audio';
import { cn } from './lib/utils';

type View = 'library' | 'reader' | 'settings';

// Map of docId to charIndex
type ReadingProgress = Record<string, number>;

export default function App() {
  const [view, setView] = useState<View>('library');
  const [library, setLibrary] = useState<PDFDocument[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReadingProgress>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
  const [voiceFilter, setVoiceFilter] = useState<'en' | 'other'>('en');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const continuousJumpRef = useRef<NodeJS.Timeout | null>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  // Load voices
  useEffect(() => {
    const updateVoices = () => {
      const availableVoices = audioService.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoiceName) {
        setSelectedVoiceName(availableVoices[0].name);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, [selectedVoiceName]);

  // Persistence
  useEffect(() => {
    const savedLibrary = localStorage.getItem('sonic_library');
    const savedProgress = localStorage.getItem('sonic_reading_progress');
    const savedCurrentDocId = localStorage.getItem('sonic_current_doc_id');
    const savedVoice = localStorage.getItem('sonic_selected_voice');
    const savedRate = localStorage.getItem('sonic_playback_rate');
    
    if (savedLibrary) setLibrary(JSON.parse(savedLibrary));
    if (savedProgress) setProgress(JSON.parse(savedProgress));
    if (savedVoice) setSelectedVoiceName(savedVoice);
    if (savedRate) setPlaybackRate(parseFloat(savedRate));
    if (savedCurrentDocId) {
      setCurrentDocId(savedCurrentDocId);
      const prog = savedProgress ? JSON.parse(savedProgress) : {};
      setCurrentCharIndex(prog[savedCurrentDocId] || 0);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sonic_library', JSON.stringify(library));
  }, [library]);

  useEffect(() => {
    localStorage.setItem('sonic_reading_progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    if (selectedVoiceName) localStorage.setItem('sonic_selected_voice', selectedVoiceName);
  }, [selectedVoiceName]);

  useEffect(() => {
    localStorage.setItem('sonic_playback_rate', playbackRate.toString());
  }, [playbackRate]);

  useEffect(() => {
    if (currentDocId) {
      localStorage.setItem('sonic_current_doc_id', currentDocId);
      setProgress(prev => ({ ...prev, [currentDocId]: currentCharIndex }));
    }
  }, [currentDocId, currentCharIndex]);

  // Auto-scroll to active word
  useEffect(() => {
    if (activeWordRef.current && view === 'reader') {
      activeWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentCharIndex, view]);

  // Restart playback if voice or rate changes while playing
  useEffect(() => {
    if (isPlaying) {
      playFromIndex(currentCharIndex);
    }
  }, [selectedVoiceName, playbackRate]);

  // Auto-pause when leaving reader to library
  useEffect(() => {
    if (view === 'library' && isPlaying) {
      audioService.pause();
      setIsPlaying(false);
    }
  }, [view]); 

  const currentDoc = useMemo(() => 
    library.find(doc => doc.id === currentDocId), 
  [library, currentDocId]);

  const currentVoice = useMemo(() => 
    voices.find(v => v.name === selectedVoiceName),
  [voices, selectedVoiceName]);

  const filteredVoices = useMemo(() => {
    return voices.filter(v => {
      const isEn = v.lang.toLowerCase().startsWith('en');
      return voiceFilter === 'en' ? isEn : !isEn;
    });
  }, [voices, voiceFilter]);

  const handleVoiceSelect = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    
    // If not playing, give a short preview
    if (!isPlaying) {
      const voice = voices.find(v => v.name === voiceName);
      if (voice) {
        audioService.speak(`Voice preview: ${voiceName}`, {
          voice,
          rate: playbackRate
        });
      }
    }
  };

  const applyPreferences = () => {
    audioService.stop();
    setView('library');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const newDoc = await extractTextFromPDF(file);
      setLibrary(prev => [newDoc, ...prev]);
    } catch (error) {
      console.error('Failed to extract PDF:', error);
      alert('Failed to process PDF. Please try another file.');
    } finally {
      setIsUploading(false);
    }
  };

  const startReading = (doc: PDFDocument) => {
    setCurrentDocId(doc.id);
    const savedIndex = progress[doc.id] || 0;
    setCurrentCharIndex(savedIndex);
    setView('reader');
  };

  const deleteDocument = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLibrary(prev => prev.filter(doc => doc.id !== id));
    setProgress(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (currentDocId === id) {
      setCurrentDocId(null);
      setCurrentCharIndex(0);
      audioService.stop();
      setIsPlaying(false);
    }
  };

  const playFromIndex = useCallback((index: number) => {
    if (!currentDoc) return;
    const textToSpeak = currentDoc.fullText.substring(index);
    audioService.speak(textToSpeak, {
      voice: currentVoice || undefined,
      rate: playbackRate,
      onBoundary: (event) => {
        setCurrentCharIndex(index + event.charIndex);
      },
      onEnd: () => {
        setIsPlaying(false);
      }
    });
    setIsPlaying(true);
  }, [currentDoc, currentVoice, playbackRate]);

  const togglePlayback = () => {
    if (isPlaying) {
      audioService.pause();
      setIsPlaying(false);
    } else {
      // Always use playFromIndex to ensure latest voice/rate settings are applied
      // instead of just resuming the old utterance
      playFromIndex(currentCharIndex);
    }
  };

  const jump = (amount: number) => {
    if (!currentDoc) return;
    const newIndex = Math.max(0, Math.min(currentDoc.fullText.length, currentCharIndex + amount));
    setCurrentCharIndex(newIndex);
    if (isPlaying) {
      playFromIndex(newIndex);
    }
  };

  const handleSeekStart = (direction: 'back' | 'forward') => {
    const amount = direction === 'back' ? -150 : 150; // Approx 10 seconds of speech
    
    holdTimerRef.current = setTimeout(() => {
      continuousJumpRef.current = setInterval(() => {
        jump(amount / 5); // Smooth continuous jump
      }, 100);
    }, 500);
  };

  const handleSeekEnd = (direction: 'back' | 'forward') => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      if (!continuousJumpRef.current) {
        // It was a tap
        jump(direction === 'back' ? -150 : 150);
      }
    }
    if (continuousJumpRef.current) {
      clearInterval(continuousJumpRef.current);
      continuousJumpRef.current = null;
    }
    holdTimerRef.current = null;
  };

  // Split text into words for highlighting
  const words = useMemo(() => {
    if (!currentDoc) return [];
    // We need to keep track of original indices
    const result: { word: string, start: number, end: number }[] = [];
    let currentPos = 0;
    const rawWords = currentDoc.fullText.split(/(\s+)/);
    
    rawWords.forEach(w => {
      const start = currentPos;
      const end = currentPos + w.length;
      result.push({ word: w, start, end });
      currentPos = end;
    });
    return result;
  }, [currentDoc]);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-surface overflow-hidden relative shadow-2xl">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-surface z-50">
        <div className="flex items-center gap-3">
          <Menu className="w-6 h-6 text-primary cursor-pointer" />
          <h1 className="font-headline font-extrabold text-primary text-lg tracking-tight">
            The Sonic Reader
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-on-surface-variant" />
          <SettingsIcon 
            className="w-5 h-5 text-primary cursor-pointer" 
            onClick={() => setView('settings')}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-32">
        <AnimatePresence mode="wait">
          {view === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pt-4"
            >
              {/* Welcome Section */}
              <section className="space-y-1">
                <p className="text-on-surface-variant font-medium text-sm">Welcome back to your</p>
                <h2 className="font-headline font-bold text-3xl text-on-surface">Auditory Sanctuary</h2>
                <div className="flex gap-2 pt-2">
                  <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider">
                    {library.length} Documents
                  </span>
                  <span className="px-3 py-1 rounded-full bg-tertiary-container text-on-tertiary-container text-[10px] font-bold uppercase tracking-wider">
                    Ready to Listen
                  </span>
                </div>
              </section>

              {/* Continue Listening */}
              {currentDoc && (
                <section>
                  <h3 className="font-headline font-bold text-xl mb-4">Continue Listening</h3>
                  <div 
                    className="bg-surface-container-low rounded-2xl p-4 flex gap-4 items-center border border-surface-container-highest cursor-pointer hover:bg-surface-container-high transition-colors"
                    onClick={() => setView('reader')}
                  >
                    <div className="w-20 h-28 bg-surface-container-highest rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary-container/40 flex items-center justify-center">
                        <Volume2 className="w-8 h-8 text-primary/40" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">Active Document</span>
                      <h4 className="font-headline font-bold text-lg truncate">{currentDoc.name}</h4>
                      <p className="text-on-surface-variant text-xs truncate">Progress: {Math.round((currentCharIndex / currentDoc.fullText.length) * 100)}%</p>
                      <div className="mt-3 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500" 
                          style={{ width: `${(currentCharIndex / currentDoc.fullText.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Library Grid */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-headline font-bold text-xl">Your Library</h3>
                  <button className="text-on-surface-variant">
                    <History className="w-5 h-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {library.map(doc => (
                    <div 
                      key={doc.id} 
                      className="group cursor-pointer"
                      onClick={() => startReading(doc)}
                    >
                      <div className="aspect-[3/4] bg-surface-container-low rounded-xl overflow-hidden mb-2 relative border border-surface-container-highest transition-transform hover:-translate-y-1">
                        <div className="absolute inset-0 bg-gradient-to-br from-surface-container-low to-surface-container-high flex items-center justify-center">
                          <PlayCircle className="w-10 h-10 text-primary/20 group-hover:text-primary/40 transition-colors" />
                        </div>
                        <button 
                          onClick={(e) => deleteDocument(doc.id, e)}
                          className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-lg text-error hover:bg-error hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h5 className="font-bold text-sm truncate px-1">{doc.name}</h5>
                      <p className="text-[10px] text-on-surface-variant px-1">{doc.totalPages} pages</p>
                    </div>
                  ))}
                  <div 
                    className="aspect-[3/4] border-2 border-dashed border-surface-container-highest rounded-xl flex flex-col items-center justify-center gap-2 text-on-surface-variant/40 hover:border-primary/40 hover:text-primary/40 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-8 h-8" />
                    <span className="text-xs font-bold">Add PDF</span>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {view === 'reader' && currentDoc && (
            <motion.div
              key="reader"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="pt-4 space-y-8"
            >
              <div className="flex items-end justify-between">
                <div className="space-y-1">
                  <p className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Now Synthesizing</p>
                  <h2 className="font-headline font-bold text-2xl leading-tight">{currentDoc.name}</h2>
                </div>
                <div className="bg-surface-container-high px-3 py-1 rounded-lg">
                  <span className="text-xs font-bold text-primary">Full Document</span>
                </div>
              </div>

              <div className="space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-primary-container/5 blur-xl rounded-2xl pointer-events-none" />
                  <div className="relative text-on-surface text-lg leading-relaxed font-medium border-l-4 border-primary pl-6 py-2">
                    {words.map(({ word, start, end }, i) => {
                      const isActive = currentCharIndex >= start && currentCharIndex < end;
                      return (
                        <span 
                          key={i} 
                          ref={isActive ? activeWordRef : null}
                          onClick={() => playFromIndex(start)}
                          className={cn(
                            "transition-colors duration-200 cursor-pointer hover:bg-surface-container-high rounded px-0.5",
                            isActive ? "bg-yellow-200 text-on-surface" : ""
                          )}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pt-4 space-y-8"
            >
              <header>
                <h2 className="font-headline font-bold text-3xl">Voice Settings</h2>
                <p className="text-on-surface-variant text-sm">Tailor your auditory sanctuary.</p>
              </header>

              <section className="bg-surface-container-low rounded-2xl p-6 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-5 h-5 text-primary" />
                    <h3 className="font-bold">Reading Speed</h3>
                  </div>
                  <span className="bg-primary-container text-white text-xs font-bold px-3 py-1 rounded-full">
                    {playbackRate}x
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.5" 
                  step="0.25" 
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  className="w-full h-2 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-primary"
                />
              </section>

              <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-bold flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary" />
                    Available Voices
                  </h3>
                  <div className="flex bg-surface-container-high p-1 rounded-xl border border-surface-container-highest">
                    <button 
                      onClick={() => setVoiceFilter('en')}
                      className={cn(
                        "flex-1 px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-200",
                        voiceFilter === 'en' ? "bg-primary text-white shadow-md" : "text-on-surface-variant hover:bg-surface-container-highest"
                      )}
                    >
                      English
                    </button>
                    <button 
                      onClick={() => setVoiceFilter('other')}
                      className={cn(
                        "flex-1 px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-200",
                        voiceFilter === 'other' ? "bg-primary text-white shadow-md" : "text-on-surface-variant hover:bg-surface-container-highest"
                      )}
                    >
                      Other
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {filteredVoices.length === 0 && <p className="text-xs text-on-surface-variant px-2">No voices found for this filter.</p>}
                  {filteredVoices.map(voice => (
                    <button
                      key={voice.name}
                      onClick={() => handleVoiceSelect(voice.name)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl flex items-center justify-between transition-all border",
                        selectedVoiceName === voice.name 
                          ? "bg-primary/5 border-primary shadow-sm" 
                          : "bg-surface-container-low border-transparent hover:border-surface-container-highest"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                          selectedVoiceName === voice.name ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"
                        )}>
                          <Volume2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{voice.name}</p>
                          <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{voice.lang}</p>
                        </div>
                      </div>
                      {selectedVoiceName === voice.name && (
                        <motion.div 
                          layoutId="active-voice"
                          className="w-2 h-2 bg-primary rounded-full" 
                        />
                      )}
                    </button>
                  ))}
                </div>
              </section>

              <button 
                onClick={applyPreferences}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-transform mt-4"
              >
                Apply Preferences
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Action Button (Upload) */}
      {view === 'library' && (
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="fixed right-6 bottom-28 bg-primary-container text-white p-4 rounded-2xl shadow-xl hover:scale-105 active:scale-90 transition-all z-50 flex items-center gap-2 pr-6 disabled:opacity-50"
        >
          <Upload className="w-5 h-5" />
          <span className="font-bold text-sm">{isUploading ? 'Processing...' : 'Upload PDF'}</span>
        </button>
      )}

      {/* Playback Bar (Reader View) */}
      {view === 'reader' && (
        <div className="fixed bottom-24 left-0 w-full px-4 z-50">
          <div className="max-w-md mx-auto bg-surface-container-lowest/80 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-6 border border-surface-container-highest">
            <div className="flex items-center justify-center gap-8">
              <button 
                onMouseDown={() => handleSeekStart('back')}
                onMouseUp={() => handleSeekEnd('back')}
                onMouseLeave={() => handleSeekEnd('back')}
                onTouchStart={() => handleSeekStart('back')}
                onTouchEnd={() => handleSeekEnd('back')}
                className="text-on-surface-variant hover:text-primary transition-colors active:scale-90"
              >
                <Rewind className="w-6 h-6" />
              </button>
              <button 
                onClick={togglePlayback}
                className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
              </button>
              <button 
                onMouseDown={() => handleSeekStart('forward')}
                onMouseUp={() => handleSeekEnd('forward')}
                onMouseLeave={() => handleSeekEnd('forward')}
                onTouchStart={() => handleSeekStart('forward')}
                onTouchEnd={() => handleSeekEnd('forward')}
                className="text-on-surface-variant hover:text-primary transition-colors active:scale-90"
              >
                <FastForward className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white/80 backdrop-blur-xl z-[60] shadow-[0_-8px_32px_0_rgba(0,0,0,0.06)] rounded-t-3xl border-t border-surface-container-highest">
        <button 
          onClick={() => setView('library')}
          className={cn(
            "flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all",
            view === 'library' ? "bg-primary-container text-white" : "text-on-surface-variant"
          )}
        >
          <Library className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Library</span>
        </button>
        <button 
          onClick={() => currentDoc && setView('reader')}
          disabled={!currentDoc}
          className={cn(
            "flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all disabled:opacity-20",
            view === 'reader' ? "bg-primary-container text-white" : "text-on-surface-variant"
          )}
        >
          <PlayCircle className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Reader</span>
        </button>
        <button 
          onClick={() => setView('settings')}
          className={cn(
            "flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all",
            view === 'settings' ? "bg-primary-container text-white" : "text-on-surface-variant"
          )}
        >
          <SettingsIcon className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </nav>

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleUpload} 
        accept="application/pdf" 
        className="hidden" 
      />
    </div>
  );
}
