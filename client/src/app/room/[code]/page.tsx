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
  const [copied, setCopied] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'queue'>('chat');
  // En móvil, controlamos si el usuario ve el video o el chat/cola
  const [mobileView, setMobileView] = useState<'video' | 'chat'>('video');

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
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* ============================================= */}
      {/* BARRA SUPERIOR - Responsiva para móvil        */}
      {/* ============================================= */}
      <nav className="glass border-b border-border-subtle px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shrink-0 gap-2">
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
      {/* Móvil: Vista única con tabs inferiores         */}
      {/* ============================================= */}
      <main className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 p-2 sm:p-4 min-h-0 overflow-hidden">

        {/* ---- Columna izquierda: Video + Búsqueda + Participantes ---- */}
        {/* En móvil: se oculta si el usuario está viendo el chat */}
        <div className={`flex-1 flex flex-col gap-3 sm:gap-4 min-w-0 min-h-0 overflow-y-auto ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}>
          <VideoPlayer
            url={currentRoom.media_url}
            roomId={currentRoom.id}
            isHost={isHost}
            socketReady={socketReady} // ← nuevo

          />

          <SearchVideo isHost={isHost} />

          {/* Info inferior: lista de participantes (scrollable horizontal) */}
          <div className="glass rounded-xl p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 overflow-x-auto shrink-0">
            <span className="text-[10px] sm:text-xs text-text-muted whitespace-nowrap">En la sala:</span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Host */}
              <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-warning/10 border border-warning/20 text-[10px] sm:text-xs text-warning whitespace-nowrap">
                <Crown size={10} />
                {currentRoom.host.username}
              </div>
              {/* Participantes */}
              {currentRoom.participants?.map((p) => (
                <div
                  key={p.user.id}
                  className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-bg-elevated border border-border-subtle text-[10px] sm:text-xs text-text-secondary whitespace-nowrap"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
                  {p.user.username}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Columna derecha: Chat / Queue ---- */}
        {/* En móvil: se oculta si el usuario está viendo el video */}
        <div className={`lg:w-80 shrink-0 flex flex-col min-h-0 gap-2 sm:gap-3 ${mobileView === 'video' ? 'hidden lg:flex' : 'flex flex-1'
          }`}>
          {/* Tab Switcher: Chat vs Cola */}
          <div className="flex bg-bg-elevated/50 p-1 rounded-xl border border-border-subtle shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'chat'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                }`}
            >
              <MessageSquare size={14} />
              CHAT
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all relative ${activeTab === 'queue'
                ? 'bg-accent-primary text-white shadow-lg'
                : 'text-text-muted hover:text-text-primary hover:bg-white/5'
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
          </div>

          <div className="flex-1 min-h-0">
            {activeTab === 'chat' ? (
              <ChatPanel roomId={currentRoom.id} />
            ) : (
              <QueuePanel
                queue={currentRoom.queue || []}
                roomId={currentRoom.id}
                isHost={isHost}
              />
            )}
          </div>
        </div>
      </main>

      {/* ============================================= */}
      {/* BARRA INFERIOR MÓVIL - Cambia entre Video/Chat */}
      {/* Solo visible en pantallas < lg (1024px)        */}
      {/* ============================================= */}
      <div className="lg:hidden glass border-t border-border-subtle flex shrink-0">
        <button
          onClick={() => setMobileView('video')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all ${mobileView === 'video'
            ? 'text-accent-primary'
            : 'text-text-muted'
            }`}
        >
          <Monitor size={18} />
          Video
        </button>
        <button
          onClick={() => setMobileView('chat')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all relative ${mobileView === 'chat'
            ? 'text-accent-primary'
            : 'text-text-muted'
            }`}
        >
          <MessageCircle size={18} />
          Chat
        </button>
      </div>
    </div>
  )
}