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

  // Función para eliminar un video de la cola (Solo Host)
  const handleRemove = (itemId: string) => {
    // Emitimos el evento al backend enviando el ID del video que queremos borrar.
    // El backend se encarga de borrarlo de la BD y notificar a todos con 'queue:update'.
    socket?.emit('queue:remove', { roomId, itemId });
  };

  // Función para forzar la reproducción inmediata de un video de la cola (Solo Host)
  const handlePlayNow = (url: string, itemId: string) => {
    // 1. Le decimos a toda la sala que cambie el video actual
    socket?.emit('room:change_video', { roomId, newUrl: url });
    // 2. Quitamos ese video de la cola para que no se repita luego
    socket?.emit('queue:remove', { roomId, itemId });
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary rounded-xl overflow-hidden border border-border-subtle animate-fade-in">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-secondary">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <ListMusic size={16} className="text-text-secondary" />
          Cola de Reproducción
        </h3>
        <span className="text-[10px] bg-bg-elevated text-text-primary px-2 py-1 rounded-md font-medium border border-border-subtle">
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
              className="group relative flex gap-3 p-2 rounded-lg bg-bg-primary border border-border-subtle hover:border-text-primary/30 transition-all duration-200 animate-in fade-in"
            >
              {/* Thumbnail Mini */}
              <div className="relative shrink-0 w-24 aspect-video rounded-md overflow-hidden bg-bg-elevated">
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
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Play size={20} fill="white" className="text-white" />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-xs font-medium text-text-primary truncate leading-tight group-hover:text-text-secondary transition-colors">
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

      <div className="p-3 bg-bg-secondary border-t border-border-subtle">
        <p className="text-[10px] text-text-muted text-center">
          {isHost 
            ? "Como Host, puedes gestionar y saltar videos." 
            : "Busca videos y añádelos a la cola para verlos después."}
        </p>
      </div>
    </div>
  );
}
