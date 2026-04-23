'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomStore } from '@/stores/room-store';
import { useAuthStore } from '@/stores/auth-store';
import { Plus, ArrowRight, LogOut, Tv, Users, Loader2 } from 'lucide-react';
import SearchVideo from './SearhVideo';

/**
 * Panel principal (Dashboard/Lobby).
 * Aquí el usuario puede crear una nueva sala o unirse a una existente
 * usando un código.
 */
export default function Dashboard() {
  const [joinCode, setJoinCode] = useState('');
  const [title, setTitle] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const { user, logout } = useAuthStore();
  const { createRoom, joinRoom, error, clearError } = useRoomStore();
  const router = useRouter();

  // Crear sala y navegar a ella
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    clearError();
    try {
      const room = await createRoom(title, mediaUrl, 'YOUTUBE');
      router.push(`/room/${room.code}`);
    } catch {
      setIsCreating(false);
    }
  };

  // Unirse a una sala existente por código
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    clearError();
    try {
      await joinRoom(joinCode.toUpperCase());
      router.push(`/room/${joinCode.toUpperCase()}`);
    } catch {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar sencillo */}
      <nav className="glass border-b border-border-subtle px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
          WatchParty
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-secondary">
            Hola, <span className="text-text-primary font-medium">{user?.username}</span>
          </span>
          <button
            onClick={logout}
            className="text-text-muted hover:text-danger transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6 animate-fade-in-up">
          {/* Título central */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium mb-4">
              <Tv size={16} />
              Listo para la diversión
            </div>
            <h2 className="text-4xl font-bold text-text-primary">
              ¿Qué hacemos hoy?
            </h2>
            <p className="text-text-secondary mt-2">
              Crea una sala para ver un video o únete a una existente con un código.
            </p>
          </div>

          {/* Grid de opciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Tarjeta: Crear Sala */}
            <div className="glass rounded-2xl p-6 hover:border-accent-primary/30 transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
                  <Plus size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Crear Sala</h3>
              </div>

              {!showCreateForm ? (
                <div>
                  <p className="text-sm text-text-secondary mb-4">
                    Sé el host. Elige un video y comparte el código con tus amigos.
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full gradient-accent text-white font-medium rounded-xl px-4 py-2.5 text-sm hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Empezar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-3 animate-fade-in-up">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nombre de la sala"
                    required
                    className="w-full bg-bg-primary/60 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors"
                  />
                  
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-1">Video Inicial</p>
                    <SearchVideo 
                      isHost={false} 
                      onSelect={(url) => setMediaUrl(url)} 
                      showQueueButton={false} 
                    />
                    {mediaUrl && (
                      <p className="text-[10px] text-accent-primary px-1 truncate italic">
                        ✓ Seleccionado: {mediaUrl}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating || !mediaUrl || !title.trim()}
                    className="w-full gradient-accent text-white font-medium rounded-xl px-4 py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Crear sala
                  </button>
                </form>
              )}
            </div>

            {/* Tarjeta: Unirse */}
            <div className="glass rounded-2xl p-6 hover:border-accent-primary/30 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-secondary/20 flex items-center justify-center">
                  <Users size={20} className="text-accent-secondary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">Unirse</h3>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                ¿Te pasaron un código? Ingresá a la sala de tu amigo.
              </p>
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Código (ej: A1B2C3)"
                  required
                  maxLength={6}
                  className="flex-1 bg-bg-primary/60 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors uppercase tracking-widest text-center font-mono"
                />
                <button
                  type="submit"
                  disabled={isJoining || joinCode.length < 4}
                  className="gradient-accent text-white rounded-xl px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {isJoining ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                </button>
              </form>
            </div>
          </div>

          {/* Error global */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger text-center animate-fade-in-up">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
