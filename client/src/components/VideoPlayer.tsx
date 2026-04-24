'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { getSocket } from '@/lib/socket';
import type { PlayerState } from '@/lib/types';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  roomId: string;
  isHost: boolean;  // Solo el host puede controlar la reproducción
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return '00:00';
  const date = new Date(seconds * 1000);
  const hh = date.getUTCHours();
  const mm = date.getUTCMinutes();
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  if (hh) {
    return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
  }
  return `${mm}:${ss}`;
};

/**
 * Componente del Reproductor de Video Premium (Custom UI).
 * Oculta los controles nativos de YouTube para una experiencia más inmersiva y controlada.
 */
export default function VideoPlayer({ url, roomId, isHost }: VideoPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const isRemoteAction = useRef(false);
  const pendingSeekTime = useRef<number | null>(null);
  const isReadyRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Custom Controls State
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [seeking, setSeeking] = useState(false);

  const socket = getSocket();

  // Autoplay Interaction Handler
  useEffect(() => {
    const handleInteraction = () => setHasInteracted(true);
    document.addEventListener('click', handleInteraction, { once: true });
    
    // Cargar volumen persistido
    const savedVolume = localStorage.getItem('player_volume');
    const savedMuted = localStorage.getItem('player_muted');
    if (savedVolume !== null) setVolume(parseFloat(savedVolume));
    if (savedMuted !== null) setMuted(savedMuted === 'true');

    return () => document.removeEventListener('click', handleInteraction);
  }, []);

  // Persistir volumen
  useEffect(() => {
    localStorage.setItem('player_volume', volume.toString());
    localStorage.setItem('player_muted', muted.toString());
  }, [volume, muted]);

  // Sync Listener
  useEffect(() => {
    if (!socket) return;

    const handleSync = (data: { event: string; data: PlayerState }) => {
      const state = data.data;
      if (!state) return;

      isRemoteAction.current = true;

      if (!isReadyRef.current) {
        pendingSeekTime.current = state.currentTime;
      } else if (playerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const player = playerRef.current as any;
        const currentTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : (player.currentTime || 0);
          
        if (Math.abs(currentTime - state.currentTime) > 1.5) {
          if (typeof player.seekTo === 'function') {
            player.seekTo(state.currentTime, 'seconds');
          } else {
            player.currentTime = state.currentTime;
          }
        }
      }

      setIsPlaying(state.isPlaying);
      setTimeout(() => { isRemoteAction.current = false; }, 500);
    };

    socket.on('player:sync', handleSync);
    return () => { socket.off('player:sync', handleSync); };
  }, [socket]);

  // Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- Handlers del Reproductor Nativo ---

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (!isHost && !hasInteracted) setHasInteracted(true);

    if (isHost && !isRemoteAction.current && socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = playerRef.current as any;
      const currentTime = typeof player?.getCurrentTime === 'function' ? player.getCurrentTime() : (player?.currentTime || 0);
      socket.emit('player:play', { roomId, currentTime });
    }
  }, [isHost, roomId, socket, hasInteracted]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (isHost && !isRemoteAction.current && socket) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = playerRef.current as any;
      const currentTime = typeof player?.getCurrentTime === 'function' ? player.getCurrentTime() : (player?.currentTime || 0);
      socket.emit('player:pause', { roomId, currentTime });
    }
  }, [isHost, roomId, socket]);

  // --- Handlers de Custom UI ---

  const togglePlay = () => {
    if (!isHost) return;
    setIsPlaying(!isPlaying);
  };

  const handleSeekMouseDown = () => {
    setSeeking(true);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayedSeconds(parseFloat(e.target.value));
  };

  const handleSeekMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!isHost) return;
    setSeeking(false);
    const newSeconds = parseFloat((e.target as HTMLInputElement).value);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const player = playerRef.current as any;
    if (player) {
      if (typeof player.seekTo === 'function') {
        player.seekTo(newSeconds, 'seconds');
      } else {
        player.currentTime = newSeconds;
      }
      socket?.emit('player:seek', { roomId, currentTime: newSeconds });
    }
  };

  const handleProgress = (state: { playedSeconds: number }) => {
    if (!seeking) {
      let currentSeconds = state.playedSeconds || 0;
      
      // Fallback de ultra-seguridad: si ReactPlayer reporta 0 pero el video avanza
      if (currentSeconds === 0 && playerRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const player = playerRef.current as any;
        const actualTime = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : (player.currentTime || 0);
        if (actualTime > 0) {
          currentSeconds = actualTime;
        }
      }

      setPlayedSeconds(currentSeconds);
    }
    
    // Extracción ultra-robusta de la duración
    if (duration === 0 && playerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = playerRef.current as any;
      const d = player.duration || (typeof player.getDuration === 'function' ? player.getDuration() : 0);
      if (d > 0 && !isNaN(d)) {
        setDuration(d);
      }
    }
  };

  const handleEnded = useCallback(() => {
    if (isHost && socket) {
      socket.emit('player:ended', { roomId });
    }
  }, [isHost, roomId, socket]);

  const handleDuration = (dur: number) => {
    if (dur > 0 && !isNaN(dur)) {
      setDuration(dur);
    }
  };

  const handleReady = useCallback(() => {
    isReadyRef.current = true;
    setIsReady(true);

    if (playerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = playerRef.current as any;
      const d = player.duration || (typeof player.getDuration === 'function' ? player.getDuration() : 0);
      if (d > 0 && !isNaN(d)) setDuration(d);
    }

    if (pendingSeekTime.current !== null && playerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const player = playerRef.current as any;
      if (typeof player.seekTo === 'function') {
        player.seekTo(pendingSeekTime.current, 'seconds');
      } else {
        player.currentTime = pendingSeekTime.current;
      }
      pendingSeekTime.current = null;
    }
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };

  const toggleMute = () => {
    setMuted(!muted);
    if (muted && volume === 0) setVolume(0.5);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  // Cálculo de porcentaje para pintar la barra
  const percentage = duration > 0 ? (playedSeconds / duration) * 100 : 0;

  return (
    <div 
      ref={wrapperRef}
      className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black glow group flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div className="absolute inset-0 pointer-events-none">
        <ReactPlayer
          ref={playerRef}
          src={url}
          playing={isPlaying}
          controls={false} // ¡Ocultamos la interfaz nativa!
          volume={volume}
          muted={muted}
          width="100%"
          height="100%"
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onProgress={handleProgress}
          onDuration={handleDuration}
          onReady={handleReady}
          config={{
            youtube: {
              playerVars: {
                rel: 0,
                modestbranding: 1,
                showinfo: 0,
                disablekb: 1, // Desactiva atajos de teclado nativos
                origin: typeof window !== 'undefined' ? window.location.origin : '',
                widget_referrer: typeof window !== 'undefined' ? window.location.href : ''
              },
            },
          }}
          style={{ pointerEvents: hasInteracted ? 'none' : 'auto' }} // Solo permite clic inicial
        />
      </div>

      {/* Escudo de Clics: Permite reproducir/pausar haciendo clic en el video (solo Host) */}
      {hasInteracted && (
        <div 
          className="absolute inset-0 z-10" 
          onClick={togglePlay}
          style={{ cursor: isHost ? 'pointer' : 'not-allowed' }}
        />
      )}

      {/* Overlay inicial para Autoplay (Todos) */}
      {!hasInteracted && (
        <div 
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => {
            setHasInteracted(true);
            if (socket) {
              socket.emit('player:request_sync', { roomId });
            }
          }}
        >
          <div className="bg-accent-primary text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 glow animate-pulse hover:scale-105 transition-transform">
            <Play size={26} fill="currentColor" />
            Haz clic aquí para unirte a la sala
          </div>
        </div>
      )}

      {/* Custom Control Bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 p-4 pt-12 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-2 z-20 transition-opacity duration-300"
        style={{ opacity: showControls || !isPlaying ? 1 : 0 }}
      >
        {/* Progress Bar */}
        <input 
          type="range" 
          min={0} max={duration || 100} step="any"
          value={playedSeconds}
          onChange={handleSeekChange}
          onMouseDown={handleSeekMouseDown}
          onMouseUp={handleSeekMouseUp}
          onTouchStart={handleSeekMouseDown}
          onTouchEnd={handleSeekMouseUp as any}
          disabled={!isHost}
          className={`w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-0
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
            [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:rounded-full
            ${!isHost ? 'opacity-70 cursor-not-allowed' : ''}`}
          style={{
            background: `linear-gradient(to right, var(--accent-primary) ${percentage}%, rgba(255,255,255,0.3) ${percentage}%)`
          }}
        />
        
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-5">
            {/* Play/Pause */}
            <button 
              onClick={togglePlay} 
              disabled={!isHost} 
              className={`text-white hover:text-accent-primary transition-colors ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <button onClick={toggleMute} className="text-white hover:text-accent-primary transition-colors">
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range" min={0} max={1} step="any" 
                value={muted ? 0 : volume} 
                onChange={handleVolumeChange}
                className="w-0 group-hover:w-20 transition-all duration-300 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer focus:outline-none
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                  [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full
                  opacity-0 group-hover:opacity-100"
                style={{
                  background: `linear-gradient(to right, white ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(muted ? 0 : volume) * 100}%)`
                }}
              />
            </div>

            {/* Time Display */}
            <span className="text-xs text-white/90 font-medium font-mono tracking-wide">
              {formatTime(playedSeconds)} / {formatTime(duration)}
            </span>
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="text-white hover:text-accent-primary transition-colors">
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
