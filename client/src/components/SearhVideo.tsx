import { Plus, Search, Check } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room-store';
import { useVideoSearch } from '@/hooks/useVideoSearch';

interface SearchVideoProps {
  isHost: boolean;
  onSelect?: (url: string) => void;
  showQueueButton?: boolean;
  resultsPosition?: 'absolute' | 'relative';
}

export default function SearchVideo({ 
  isHost, 
  onSelect, 
  showQueueButton = true,
  resultsPosition = 'absolute'
}: SearchVideoProps) {
  const { query, results, isSearching, search, forceSearch, clearSearch } = useVideoSearch();
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset the 5-second inactivity timer whenever the user interacts
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (results.length > 0) {
      inactivityTimer.current = setTimeout(() => {
        clearSearch();
      }, 5000);
    }
  }, [results.length, clearSearch]);

  // Start timer when results appear
  useEffect(() => {
    if (results.length > 0) {
      resetInactivityTimer();
    }
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [results.length, resetInactivityTimer]);

  const handleSelect = (url: string) => {
    if (onSelect) {
      onSelect(url);
    } else if (currentRoom) {
      getSocket()?.emit('room:change_video', { roomId: currentRoom.id, newUrl: url });
    }
    clearSearch();
  };

  const handleAddToQueue = (video: any) => {
    if (currentRoom) {
      getSocket()?.emit('queue:add', { roomId: currentRoom.id, video });
      
      setAddedIds(prev => new Set(prev).add(video.id));
      setTimeout(() => {
        setAddedIds(prev => {
          const next = new Set(prev);
          next.delete(video.id);
          return next;
        });
      }, 2000);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${resultsPosition === 'relative' ? 'flex flex-col min-h-0' : ''}`}
      onMouseMove={resetInactivityTimer}
      onClick={resetInactivityTimer}
    >
      <div className="bg-bg-secondary border border-border-subtle rounded-xl p-2 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-primary rounded-lg px-3 py-2 border border-border-subtle focus-within:border-text-primary transition-colors">
            <Search size={16} className={isSearching ? "text-text-primary animate-pulse" : "text-text-muted"} />
            <input
              type="text"
              value={query}
              onChange={(e) => { search(e.target.value); resetInactivityTimer(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (query.trim()) {
                    if (query.includes('http://') || query.includes('https://') || query.includes('www.')) {
                      handleSelect(query.trim());
                    } else {
                      forceSearch();
                    }
                  }
                }
              }}
              onFocus={resetInactivityTimer}
              placeholder="Busca o pega un enlace (Twitch, MP4, etc)..."
              className="bg-transparent border-none outline-none text-sm text-text-primary w-full placeholder:text-text-muted"
              autoComplete="off"
            />
          </div>
          {isHost && (
            <button
              type="button"
              onClick={() => {
                if (query.trim()) {
                  if (query.includes('http://') || query.includes('https://') || query.includes('www.')) {
                    handleSelect(query.trim());
                  } else {
                    forceSearch();
                  }
                }
              }}
              className="bg-text-primary hover:opacity-90 text-bg-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer shadow-sm"
            >
              {(query.includes('http://') || query.includes('https://') || query.includes('www.')) 
                ? (resultsPosition === 'relative' ? 'Ir' : 'Cambiar Video') 
                : 'Buscar'}
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 px-2 opacity-60 overflow-x-auto">
          <span className="text-[8px] sm:text-[9px] font-medium text-text-muted uppercase tracking-wider shrink-0">Soporta:</span>
          <div className="flex gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-text-secondary font-mono">
            <span className="bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">youtube.com/...</span>
            <span className="bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">twitch.tv/...</span>
            <span className="bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle whitespace-nowrap">.../video.mp4</span>
          </div>
        </div>
      </div>

      {/* Resultados de búsqueda — se auto-cierran a los 5s sin interacción */}
      {results.length > 0 && (
        <div
          className={`
            ${resultsPosition === 'absolute' 
              ? 'absolute top-full left-0 right-0 mt-1 z-50 shadow-xl' 
              : 'relative mt-2 flex-1 min-h-0'
            } 
            bg-bg-secondary border border-border-subtle rounded-xl overflow-hidden animate-fade-in
          `}
          onMouseMove={resetInactivityTimer}
        >
          <div className={`p-2 overflow-y-auto custom-scrollbar ${resultsPosition === 'absolute' ? 'max-h-[300px]' : 'h-full'}`}>
            <p className="text-[10px] font-bold text-text-muted px-2 py-1 uppercase tracking-wider">Resultados / Enlace</p>
            {results.map((video) => (
              <div
                key={video.id}
                className="w-full flex gap-3 p-2 hover:bg-bg-elevated rounded-lg transition-colors group/item"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(video.url)}
                  className="flex flex-1 min-w-0 gap-2 sm:gap-3 text-left cursor-pointer"
                >
                  <div className="relative shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-black shadow-inner">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white font-mono">
                      {video.duration}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <h4 className="text-xs font-medium text-text-primary truncate group-hover/item:text-text-secondary transition-colors">
                      {video.title}
                    </h4>
                    <p className="text-[10px] text-text-muted mt-1 truncate">
                      {video.author}
                    </p>
                  </div>
                </button>

                {currentRoom && showQueueButton && (
                  <button
                    type="button"
                    onClick={() => { handleAddToQueue(video); resetInactivityTimer(); }}
                    className={`shrink-0 self-center p-2 rounded-lg transition-all ${
                      addedIds.has(video.id) 
                        ? 'text-success bg-success/10 scale-110' 
                        : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                    }`}
                    title="Añadir a la cola"
                  >
                    {addedIds.has(video.id) ? <Check size={18} /> : <Plus size={18} />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
