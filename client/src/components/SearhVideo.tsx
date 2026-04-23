import { Plus, Search } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room-store';
import { useVideoSearch } from '@/hooks/useVideoSearch';

interface SearchVideoProps {
  isHost: boolean;
  onSelect?: (url: string) => void; // Para cuando se usa en "Crear Sala"
  showQueueButton?: boolean;
}

/**
 * Componente de búsqueda de videos.
 * Utiliza el hook useVideoSearch para manejar la lógica.
 * Puede ser usado en la sala para cambiar el video o en la creación de sala.
 */
export default function SearchVideo({ isHost, onSelect, showQueueButton = true }: SearchVideoProps) {
  const { query, results, isSearching, search, clearSearch } = useVideoSearch();
  const currentRoom = useRoomStore((state) => state.currentRoom);

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
    }
    clearSearch();
  };

  return (
    <div className="relative group w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            handleSelect(query.trim());
          }
        }}
        className="glass rounded-xl p-2 flex items-center gap-2 animate-fade-in relative z-50"
      >
        <div className="flex-1 flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 border border-border-subtle focus-within:border-accent-primary/50 transition-colors">
          <Search size={16} className={isSearching ? "text-accent-primary animate-pulse" : "text-text-muted"} />
          <input
            type="text"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Busca en YouTube o pega un enlace..."
            className="bg-transparent border-none outline-none text-sm text-text-primary w-full placeholder:text-text-muted"
            autoComplete="off"
          />
        </div>
        {isHost && (
          <button
            type="submit"
            className="bg-accent-primary hover:bg-accent-secondary text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer shadow-[0_0_15px_rgba(255,42,95,0.3)]"
          >
            Cambiar Video
          </button>
        )}
      </form>

      {/* Resultados de búsqueda */}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-bg-elevated/95 backdrop-blur-md border border-border-subtle rounded-xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            <p className="text-[10px] font-bold text-text-muted px-2 py-1 uppercase tracking-wider">Resultados de YouTube</p>
            {results.map((video) => (
              <div
                key={video.id}
                className="w-full flex gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors group/item"
              >
                <button
                  type="button"
                  onClick={() => handleSelect(video.url)}
                  className="flex flex-1 gap-3 text-left cursor-pointer"
                >
                  <div className="relative shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-black shadow-inner">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white font-mono">
                      {video.duration}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <h4 className="text-xs font-medium text-text-primary truncate group-hover/item:text-accent-primary transition-colors">
                      {video.title}
                    </h4>
                    <p className="text-[10px] text-text-muted mt-1 truncate">
                      {video.author}
                    </p>
                  </div>
                </button>

                {/* Botón de añadir a cola */}
                {currentRoom && showQueueButton && (
                  <button
                    type="button"
                    onClick={() => handleAddToQueue(video)}
                    className="self-center p-2 text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 rounded-lg transition-all"
                    title="Añadir a la cola"
                  >
                    <Plus size={18} />
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
