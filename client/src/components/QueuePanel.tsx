'use client';

import { Play, Trash2, ListMusic, User } from 'lucide-react';
import type { PlaylistItem } from '@/lib/types';
import { getSocket } from '@/lib/socket';

interface QueuePanelProps {
  queue: PlaylistItem[];
  roomId: string;
  isHost: boolean;
}

export default function QueuePanel({ queue, roomId, isHost }: QueuePanelProps) {
  const socket = getSocket();

  const handleRemove = (itemId: string) => {
    socket?.emit('queue:remove', { roomId, itemId });
  };

  const handlePlayNow = (url: string, itemId: string) => {
    // Primero cambiamos el video
    socket?.emit('room:change_video', { roomId, newUrl: url });
    // Luego lo quitamos de la cola
    socket?.emit('queue:remove', { roomId, itemId });
  };

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden border border-border-subtle animate-fade-in">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-white/5">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <ListMusic size={18} className="text-accent-primary" />
          Cola de Reproducción
        </h3>
        <span className="text-[10px] bg-accent-primary/20 text-accent-primary px-2 py-0.5 rounded-full font-bold">
          {queue.length} VIDEOS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {queue.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3 py-10">
            <ListMusic size={40} />
            <p className="text-xs font-medium">La cola está vacía</p>
          </div>
        ) : (
          queue.map((item) => (
            <div 
              key={item.id} 
              className="group relative flex gap-3 p-2 rounded-xl bg-white/5 border border-transparent hover:border-accent-primary/30 hover:bg-white/10 transition-all duration-300 animate-in slide-in-from-right-2"
            >
              {/* Thumbnail Mini */}
              <div className="relative shrink-0 w-24 aspect-video rounded-lg overflow-hidden bg-black shadow-lg">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-bg-elevated">
                    <ListMusic size={20} className="text-text-muted" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1 rounded text-white font-mono">
                  {item.duration || '--:--'}
                </span>
                
                {/* Play Overlay (Host Only) */}
                {isHost && (
                  <button 
                    onClick={() => handlePlayNow(item.url, item.id)}
                    className="absolute inset-0 bg-accent-primary/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Play size={20} fill="white" className="text-white" />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-[11px] font-semibold text-text-primary truncate leading-tight group-hover:text-accent-primary transition-colors">
                  {item.title}
                </h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <User size={10} className="text-text-muted" />
                  <p className="text-[9px] text-text-muted truncate">
                    Agregado por <span className="text-text-secondary">{item.added_by?.split('@')[0]}</span>
                  </p>
                </div>
              </div>

              {/* Actions (Host Only) */}
              {isHost && (
                <button 
                  onClick={() => handleRemove(item.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all self-center"
                  title="Eliminar de la cola"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 bg-white/5 border-t border-border-subtle">
        <p className="text-[9px] text-text-muted text-center italic">
          {isHost 
            ? "Como Host, puedes gestionar y saltar videos." 
            : "Busca videos y añádelos a la cola para verlos después."}
        </p>
      </div>
    </div>
  );
}
