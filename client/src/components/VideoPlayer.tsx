'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { getSocket } from '@/lib/socket';
import type { PlayerState } from '@/lib/types';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RefreshCw } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  roomId: string;
  isHost: boolean;
  socketReady?: boolean; // Indica si el socket ya se unió a la sala
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
 * Componente del Reproductor de Video Premium.
 * 
 * ESTRATEGIA DE SINCRONIZACIÓN (react-player v3):
 * ================================================
 * El problema con YouTube+react-player v3 es que hacer seek programáticamente
 * después de que el video cargó es INESTABLE (YouTube a veces lo ignora).
 * 
 * Solución: Usamos el playerVar `start` de YouTube para indicarle en qué
 * segundo arrancar. Para que surta efecto, cambiamos el `key` del componente,
 * lo que fuerza un remount completo. YouTube carga el video nativo desde ese segundo.
 * 
 * Para sincronizaciones POSTERIORES (host pausa/seekea durante la reproducción),
 * usamos el evento `player:sync` que llega por WebSocket y buscamos el iframe
 * internamente para enviarle un postMessage seekTo.
 */
export default function VideoPlayer({ url, roomId, isHost, socketReady }: VideoPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const isRemoteAction = useRef(false);
  const isReadyRef = useRef(false);
  const pendingSeekTime = useRef<number | null>(null);
  const pendingPlayState = useRef<boolean | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Clave dinámica del reproductor: al cambiarla, React destruye y recrea el ReactPlayer
  // completo, lo que permite que YouTube cargue el video en el segundo correcto vía `start`.
  const [playerKey, setPlayerKey] = useState(0);
  // Segundo en el que el reproductor debe iniciar (se pasa a YouTube playerVars.start)
  const startTimeRef = useRef(0);
  // ¿Ya recibimos la sincronización inicial del servidor?
  const hasSynced = useRef(false);

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

  // --- SEEK ROBUSTO ---
  // Intenta hacer seek por todas las vías posibles.
  // Para YouTube: busca el iframe y le manda un postMessage con la API de YouTube IFrame.
  const seekPlayer = useCallback((targetTime: number) => {
    const player = playerRef.current;

    // Opción 1: react-player v3 expone currentTime como setter (funciona para mp4/nativos)
    if (player && typeof player.currentTime === 'number') {
      try { player.currentTime = targetTime; } catch { /* ignore */ }
    }

    // Opción 2: buscar <video> nativo en el DOM (mp4, archivos directos)
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const videoEl = wrapper.querySelector('video');
      if (videoEl) {
        videoEl.currentTime = targetTime;
        return;
      }

      // Opción 3: YouTube iframe → postMessage con la YouTube IFrame API
      const iframe = wrapper.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [targetTime, true] }),
          '*'
        );
      }
    }
  }, []);

  // --- OBTENER TIEMPO ACTUAL ---
  const getPlayerTime = useCallback((): number => {
    const player = playerRef.current;
    if (player && typeof player.currentTime === 'number') return player.currentTime;
    const videoEl = wrapperRef.current?.querySelector('video');
    if (videoEl) return videoEl.currentTime;
    return 0;
  }, []);

  // --- FORZAR RESYNC: destruye y recrea el reproductor con el segundo correcto ---
  // Esta es la forma nuclear y 100% confiable de sincronizar YouTube.
  const forceResync = useCallback((targetTime: number, shouldPlay: boolean) => {
    startTimeRef.current = Math.floor(targetTime);
    setPlayedSeconds(targetTime);
    setIsPlaying(shouldPlay);
    setIsReady(false);
    isReadyRef.current = false;
    // Cambiar el key fuerza un remount del ReactPlayer
    setPlayerKey(prev => prev + 1);
  }, []);

  // Cargar volumen persistido
  useEffect(() => {
    const savedVolume = localStorage.getItem('player_volume');
    const savedMuted = localStorage.getItem('player_muted');
    if (savedVolume !== null) setVolume(parseFloat(savedVolume));
    if (savedMuted !== null) setMuted(savedMuted === 'true');
  }, []);

  // Persistir volumen
  useEffect(() => {
    localStorage.setItem('player_volume', volume.toString());
    localStorage.setItem('player_muted', muted.toString());
  }, [volume, muted]);

  // =========================================
  // LISTENER DE SINCRONIZACIÓN (WebSocket)
  // =========================================
  useEffect(() => {
    if (!socket) return;

    const handleSync = (data: { event: string; data: PlayerState }) => {
      const state = data.data;
      if (!state) return;

      isRemoteAction.current = true;

      if (!hasSynced.current) {
        // --- PRIMERA SINCRONIZACIÓN (cuando el usuario se une a la sala) ---
        // Guardamos el tiempo de inicio para que YouTube arranque ahí.
        hasSynced.current = true;
        if (state.currentTime > 2) {
          startTimeRef.current = Math.floor(state.currentTime);
          setPlayedSeconds(state.currentTime);
          // Forzar remount para que YouTube use el nuevo `start`
          setPlayerKey(prev => prev + 1);
        }
        setIsPlaying(state.isPlaying);
      } else {
        // --- SINCRONIZACIONES POSTERIORES (host pausó, seeked, play) ---
        const currentTime = getPlayerTime();
        if (Math.abs(currentTime - state.currentTime) > 2) {
          // Diferencia grande: intentamos hacer seek. Si falla, lo guardamos para el rescue
          pendingSeekTime.current = state.currentTime;
          pendingPlayState.current = state.isPlaying;
          seekPlayer(state.currentTime);
        } else {
          // Diferencia pequeña: solo ajustar play/pause
          setIsPlaying(state.isPlaying);
        }
      }

      setTimeout(() => { isRemoteAction.current = false; }, 500);
    };

    // Cuando un invitado pide sincronización, el Host responde emitiendo su estado
    const handleHostRequestSync = () => {
      if (isHost && isReadyRef.current) {
        const currentTime = getPlayerTime();
        socket.emit(isPlaying ? 'player:play' : 'player:pause', { roomId, currentTime });
      }
    };

    socket.on('player:sync', handleSync);
    socket.on('player:host_request_sync', handleHostRequestSync);

    return () => {
      socket.off('player:sync', handleSync);
      socket.off('player:host_request_sync', handleHostRequestSync);
    };
  }, [socket, getPlayerTime, isHost, isPlaying, roomId, forceResync]);

  // Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- Handlers del Reproductor ---

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (!isHost && !hasInteracted) setHasInteracted(true);

    if (isHost && !isRemoteAction.current && socket) {
      const currentTime = getPlayerTime();
      socket.emit('player:play', { roomId, currentTime });
    }
  }, [isHost, roomId, socket, hasInteracted, getPlayerTime]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (isHost && !isRemoteAction.current && socket) {
      const currentTime = getPlayerTime();
      socket.emit('player:pause', { roomId, currentTime });
    }
  }, [isHost, roomId, socket, getPlayerTime]);

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
    seekPlayer(newSeconds);
    socket?.emit('player:seek', { roomId, currentTime: newSeconds });
  };

  // --- onTimeUpdate (react-player v3) ---
  const handleProgress = (eventOrState: any) => {
    if (!seeking) {
      let currentSeconds = 0;

      // v3: evento nativo del DOM
      if (eventOrState?.target?.currentTime !== undefined) {
        currentSeconds = eventOrState.target.currentTime;
      }
      // v2 fallback
      else if (eventOrState?.playedSeconds !== undefined) {
        currentSeconds = eventOrState.playedSeconds;
      }

      if (currentSeconds === 0) {
        currentSeconds = getPlayerTime();
      }

      // --- RESCATE DE SINCRONIZACIÓN ---
      if (pendingSeekTime.current !== null && currentSeconds >= 0) {
        if (Math.abs(currentSeconds - pendingSeekTime.current) > 1.5) {
          seekPlayer(pendingSeekTime.current);
          return;
        } else {
          pendingSeekTime.current = null;
        }
      }

      setPlayedSeconds(currentSeconds);
    }

    // Extraer duración si no la tenemos
    if (duration === 0) {
      const wrapper = wrapperRef.current;
      if (wrapper) {
        const videoEl = wrapper.querySelector('video');
        if (videoEl && videoEl.duration > 0 && !isNaN(videoEl.duration)) {
          setDuration(videoEl.duration);
          return;
        }
      }
      const player = playerRef.current;
      if (player) {
        const d = player.duration || (typeof player.getDuration === 'function' ? player.getDuration() : 0);
        if (d > 0 && !isNaN(d)) {
          setDuration(d);
        }
      }
    }
  };

  const handleEnded = useCallback(() => {
    if (isHost && socket) {
      socket.emit('player:ended', { roomId });
    }
  }, [isHost, roomId, socket]);

  // onDurationChange (react-player v3)
  const handleDuration = (eventOrDur: any) => {
    let dur: number;
    if (typeof eventOrDur === 'number') {
      dur = eventOrDur;
    } else {
      dur = eventOrDur?.target?.duration ?? 0;
    }
    if (dur > 0 && !isNaN(dur)) {
      setDuration(dur);
    }
  };

  const handleReady = useCallback(() => {
    isReadyRef.current = true;
    setIsReady(true);
    setError(null);

    if (pendingSeekTime.current !== null) {
      seekPlayer(pendingSeekTime.current);
      pendingSeekTime.current = null;
    }

    if (pendingPlayState.current !== null) {
      setIsPlaying(pendingPlayState.current);
      pendingPlayState.current = null;
    }
  }, [seekPlayer]);

  const handleError = useCallback((err: any) => {
    console.error('Error en el reproductor:', err);
    setError('No se pudo cargar el video. Es posible que el enlace esté roto o que el sitio web bloquee el acceso directo.');
  }, []);

  // Botón de Sincronizar manualmente (para invitados)
  const handleManualSync = useCallback(() => {
    if (socket) {
      socket.emit('player:request_sync', { roomId });
    }
  }, [socket, roomId]);

  // Cuando el invitado hace su primer clic, disparamos la sincronización
  const handleFirstInteraction = useCallback(() => {
    if (hasInteracted) return;
    setHasInteracted(true);
    if (!isHost && socket) {
      // Pedir al host que re-emita su estado exacto
      socket.emit('player:request_sync', { roomId });
    }
  }, [hasInteracted, isHost, socket, roomId]);

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

  // Twitch requiere controles nativos y no soporta overlays
  const isTwitch = url?.includes('twitch.tv');

  return (
    <div
      ref={wrapperRef}
      className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black glow group flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Error Message */}
      {error && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 text-center">
          <div className="bg-error/20 border border-error/50 p-6 rounded-2xl max-w-md">
            <p className="text-white font-semibold mb-2">¡Ups! Algo salió mal</p>
            <p className="text-text-muted text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="absolute inset-0">
        {/* key: fuerza un remount completo cuando cambia.
            Esto hace que YouTube cargue el video en el segundo correcto vía playerVars.start */}
        <ReactPlayer
          key={`player-${playerKey}`}
          ref={playerRef}
          src={url}
          playing={isPlaying}
          controls={isTwitch ? true : false}
          volume={isTwitch ? undefined : volume}
          muted={isTwitch ? undefined : muted}
          width="100%"
          height="100%"
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onTimeUpdate={handleProgress}
          onDurationChange={handleDuration}
          onReady={handleReady}
          onError={handleError}
          config={{
            file: {
              attributes: {
                controlsList: 'nodownload',
                disablePictureInPicture: true,
                crossOrigin: 'anonymous'
              }
            },
            youtube: {
              playerVars: {
                rel: 0,
                modestbranding: 1,
                showinfo: 0,
                disablekb: 1, // Desactiva atajos de teclado nativos
                origin: typeof window !== 'undefined' ? window.location.origin : '',
                widget_referrer: typeof window !== 'undefined' ? window.location.href : ''
                disablekb: 1,
                enablejsapi: 1,
                // `start` le dice a YouTube en qué segundo arrancar.
                // Solo surte efecto al montar el componente por primera vez.
                start: startTimeRef.current,
                origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
              },
            },
            twitch: {
              options: {
                parent: ['localhost']
              }
            }
          }}
        />
      </div>

      {/* Escudo de Clics: Permite reproducir/pausar haciendo clic en el video (solo Host) */}
      {!isTwitch && hasInteracted && (
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
      {/* Overlay inicial para Invitados: escudo que bloquea clics al iframe de YouTube.
          z-30 para estar por encima del escudo de clics y los controles. */}
      {!isTwitch && !isHost && !hasInteracted && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 cursor-pointer backdrop-blur-[2px]"
          onClick={handleFirstInteraction}
        >
          <div className="bg-accent-primary/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 glow animate-bounce shadow-2xl">
            <Play size={20} />
            Haz clic aquí para sincronizar
          </div>
        </div>
      )}

      {/* Botón de Re-sincronizar (siempre visible para invitados, discreto) */}
      {!isTwitch && !isHost && hasInteracted && (
        <button
          onClick={handleManualSync}
          className="absolute top-3 right-3 z-20 bg-black/60 hover:bg-accent-primary/80 text-white/80 hover:text-white p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs"
          title="Re-sincronizar con el host"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
      )}

      {/* Custom Control Bar (Oculta en Twitch) */}
      {!isTwitch && (
        <div
          className="absolute bottom-0 left-0 right-0 p-2 sm:p-4 pt-8 sm:pt-12 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-1.5 sm:gap-2 z-20 transition-opacity duration-300"
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

          <div className="flex items-center justify-between mt-0.5 sm:mt-1">
            <div className="flex items-center gap-3 sm:gap-5">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                disabled={!isHost}
                className={`text-white hover:text-accent-primary transition-colors ${!isHost ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>

              {/* Volume - Oculto en móvil para ahorrar espacio, visible en sm+ */}
              <div className="hidden sm:flex items-center gap-2 group">
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

              {/* Volume icon only on mobile */}
              <button onClick={toggleMute} className="sm:hidden text-white hover:text-accent-primary transition-colors">
                {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              {/* Time Display */}
              <span className="text-[10px] sm:text-xs text-white/90 font-medium font-mono tracking-wide">
                {formatTime(playedSeconds)} / {formatTime(duration)}
              </span>
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-accent-primary transition-colors">
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
