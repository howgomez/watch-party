'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useRoomStore } from '@/stores/room-store';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { apiFetch } from '@/lib/api';
import VideoPlayer from '@/components/VideoPlayer';
import ChatPanel from '@/components/ChatPanel';
import QueuePanel from '@/components/QueuePanel';
import SearchVideo from '@/components/SearhVideo';
import { ArrowLeft, Copy, Check, Users, Loader2, Crown, MessageSquare, ListMusic, Monitor, MessageCircle } from 'lucide-react';

/**
 * Página de la Sala de Video.
 * Aquí sucede toda la magia: video sincronizado + chat en vivo.
 *
 * Layout: Split-screen
 * - Izquierda (75%): Reproductor de video + info de participantes
 * - Derecha (25%): Panel de chat en tiempo real
 */
export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const { user, token, loadFromStorage } = useAuthStore();
  const { currentRoom, fetchRoomByCode, leaveRoom, isLoading } = useRoomStore();

  const [hasMounted, setHasMounted] = useState(false);
  const [copied, setCopied] = useState(false);  const [socketReady, setSocketReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'queue' | 'search' | 'info'>('chat');

  // 1. Cargar sesión si no existe
  useEffect(() => {
    if (!user) {
      loadFromStorage().then(() => setHasMounted(true));
    } else {
      setHasMounted(true);
    }
  }, [user, loadFromStorage]);

  // 2. Si no hay usuario después de cargar, redirigir al login
  useEffect(() => {
    if (hasMounted && !user) {
      router.push('/');
    }
  }, [hasMounted, user, router]);

  // 3. Cargar datos de la sala
  useEffect(() => {
    if (!user || !token || !code) return;
    fetchRoomByCode(code);
  }, [user, token, code, fetchRoomByCode]);

  // 4. Conectar WebSocket solo cuando tengamos el currentRoom (para usar el UUID real)
  useEffect(() => {
    if (!user || !token || !currentRoom) return;

    const roomId = currentRoom.id;
    const socket = connectSocket(token);

    const joinRoom = () => {
      socket.emit('room:join', { roomId }, () => {
        setSocketReady(true);
      });
      // Fallback de seguridad por si el ack falla
      setTimeout(() => setSocketReady(true), 500);
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on('connect', joinRoom);
    }

    // Escuchar si alguien (el host) cambia el video en esta sala
    const handleVideoChanged = (payload: { mediaUrl: string }) => {
      useRoomStore.getState().updateCurrentRoomUrl(payload.mediaUrl);
    };

    // Escuchar actualizaciones de la cola
    const handleQueueUpdated = (payload: { queue: any[] }) => {
      useRoomStore.getState().updateQueue(payload.queue);
    };

    socket.on('room:video_changed', handleVideoChanged);
    socket.on('queue:update', handleQueueUpdated);

    // Limpieza al salir de la página
    return () => {
      const s = getSocket();
      if (s) {
        s.emit('room:leave', { roomId });
        s.off('connect', joinRoom);
        s.off('room:video_changed', handleVideoChanged);
        s.off('queue:update', handleQueueUpdated);
      }
      disconnectSocket();
    };
  }, [user, token, currentRoom?.id]);

  // Copiar código al portapapeles
  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Salir de la sala
  const handleLeave = async () => {
    await leaveRoom(code);
    router.push('/');
  };

  // Verificar si el usuario actual es el host de la sala
  const isHost = currentRoom?.host_id === user?.id;

  // Pantalla de carga
  if (!hasMounted || isLoading || !currentRoom || !socketReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 size={32} className="animate-spin text-accent-primary" />
        <p className="text-text-secondary text-sm">Conectando a la sala...</p>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-bg-primary overflow-hidden">
      {/* ============================================= */}
      {/* BARRA SUPERIOR - Responsiva para móvil        */}
      {/* ============================================= */}
      <nav className="glass border-b border-border-subtle px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shrink-0 gap-2 z-50">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={handleLeave}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer shrink-0"
            title="Volver al lobby"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-text-primary flex items-center gap-2 truncate">
              {currentRoom.title}
              {isHost && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warning bg-warning/10 rounded-full px-2 py-0.5 shrink-0">
                  <Crown size={10} />
                  HOST
                </span>
              )}
            </h1>
            <p className="text-[10px] sm:text-xs text-text-muted truncate">
              Creada por {currentRoom.host.username}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Contador de participantes */}
          <div className="flex items-center gap-1.5 text-text-secondary text-xs sm:text-sm">
            <Users size={14} />
            <span>{currentRoom.participants?.length || 0}</span>
          </div>

          {/* Botón copiar código */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 sm:gap-2 bg-bg-elevated border border-border-subtle rounded-xl px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-text-secondary hover:text-text-primary hover:border-accent-primary/30 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={14} className="text-success" />
                <span className="text-success hidden sm:inline">Copiado</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span className="font-mono tracking-wider">{code}</span>
              </>
            )}
          </button>
        </div>
      </nav>

      {/* ============================================= */}
      {/* CONTENIDO PRINCIPAL                           */}
      {/* Desktop: Video (izq) + Chat (der) lado a lado */}
      {/* Móvil: Video (arriba) + Tabs (abajo)          */}
      {/* ============================================= */}
      <main className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 p-2 sm:p-4 min-h-0 overflow-hidden relative">
        
        {/* ---- SECCIÓN VIDEO (Siempre visible en la parte superior en móvil) ---- */}
        <div className="flex flex-col lg:flex-1 gap-3 sm:gap-4 min-w-0 min-h-0 shrink-0 lg:shrink">
          <div className="shrink-0 lg:flex-1 min-h-0 max-h-[35vh] lg:max-h-none">
            <VideoPlayer
              url={currentRoom.media_url}
              roomId={currentRoom.id}
              isHost={isHost}
              socketReady={socketReady}
            />
          </div>

          {/* En Escritorio: Búsqueda e Info debajo del video */}
          <div className="hidden lg:flex flex-col gap-4 overflow-y-auto pr-1">
            <SearchVideo isHost={isHost} />
            
            {/* Lista de participantes Desktop */}
            <div className="glass rounded-xl p-3 flex items-center gap-3 shrink-0">
              <span className="text-xs text-text-muted whitespace-nowrap">En la sala:</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning whitespace-nowrap">
                  <Crown size={10} />
                  {currentRoom.host.username}
                </div>
                {currentRoom.participants?.map((p) => (
                  <div
                    key={p.user.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-elevated border border-border-subtle text-xs text-text-secondary whitespace-nowrap"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
                    {p.user.username}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ---- SECCIÓN INTERACCIÓN (Pestañas en móvil, Sidebar en escritorio) ---- */}
        <div className="lg:w-80 flex flex-col min-h-0 flex-1 lg:flex-none gap-2 sm:gap-3 bg-bg-elevated/20 lg:bg-transparent rounded-2xl p-1 lg:p-0">
          
          {/* Tab Switcher mejorado */}
          <div className="flex bg-bg-elevated/50 p-1 rounded-xl border border-border-subtle shrink-0 shadow-inner">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${activeTab === 'chat'
                ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20 scale-[1.02]'
                : 'text-text-muted hover:text-text-primary'
                }`}
            >
              <MessageSquare size={14} />
              CHAT
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all relative ${activeTab === 'queue'
                ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20 scale-[1.02]'
                : 'text-text-muted hover:text-text-primary'
                }`}
            >
              <ListMusic size={14} />
              COLA
              {currentRoom.queue && currentRoom.queue.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-[8px] flex items-center justify-center rounded-full border-2 border-bg-primary">
                  {currentRoom.queue.length}
                </span>
              )}
            </button>
            
            {/* Pestañas adicionales para Móvil */}
            <button
              onClick={() => setActiveTab('search')}
              className={`lg:hidden flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${activeTab === 'search'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary'
                }`}
            >
              <Monitor size={14} />
              BUSCAR
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`lg:hidden flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${activeTab === 'info'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary'
                }`}
            >
              <Users size={14} />
              INFO
            </button>
          </div>

          {/* Contenido dinámico de pestañas */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === 'chat' && <ChatPanel roomId={currentRoom.id} />}
            {activeTab === 'queue' && (
              <QueuePanel
                queue={currentRoom.queue || []}
                roomId={currentRoom.id}
                isHost={isHost}
              />
            )}
            {activeTab === 'search' && (
              <div className="flex-1 min-h-0 p-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <SearchVideo isHost={isHost} resultsPosition="relative" />
              </div>
            )}
            {activeTab === 'info' && (
              <div className="flex flex-col gap-3 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-bold text-accent-primary uppercase tracking-widest mb-3">Participantes</h3>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-warning/5 border border-warning/10">
                      <div className="flex items-center gap-2">
                        <Crown size={14} className="text-warning" />
                        <span className="text-sm font-medium text-text-primary">{currentRoom.host.username}</span>
                      </div>
                      <span className="text-[10px] font-bold text-warning uppercase">Host</span>
                    </div>
                    {currentRoom.participants?.map((p) => (
                      <div key={p.user.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-success" />
                          <span className="text-sm text-text-secondary">{p.user.username}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}