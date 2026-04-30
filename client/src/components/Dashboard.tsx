'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomStore } from '@/stores/room-store';
import { useAuthStore } from '@/stores/auth-store';
import { Plus, ArrowRight, LogOut, Tv, Users, Loader2 } from 'lucide-react';
import SearchVideo from './SearhVideo';

/**
 * Panel principal (Dashboard/Lobby).
 * Diseño minimalista y profesional.
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
    <div className="min-h-screen flex flex-col bg-bg-primary font-sans">
      {/* Navbar Minimalista */}
      <nav className="border-b border-border-subtle px-6 py-4 flex items-center justify-between bg-bg-primary">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          WatchParty
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-secondary">
            <span className="text-text-primary font-medium">{user?.username}</span>
          </span>
          <button
            onClick={logout}
            className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </nav>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-8 animate-fade-in-up">
          
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text-primary">
              Bienvenido
            </h2>
            <p className="text-text-secondary text-sm sm:text-base">
              Crea una sala nueva o únete a una existente con un código.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tarjeta: Crear Sala */}
            <div className="bg-bg-secondary border border-border-subtle rounded-xl p-6 transition-all duration-200 hover:border-border-accent flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center border border-border-subtle">
                  <Plus size={16} className="text-text-primary" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">Crear Sala</h3>
              </div>

              {!showCreateForm ? (
                <div className="flex-1 flex flex-col justify-between">
                  <p className="text-sm text-text-secondary mb-6">
                    Inicia una nueva sesión y comparte el enlace con otros.
                  </p>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full bg-text-primary text-bg-primary font-medium rounded-lg px-4 py-2.5 text-sm hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Nueva Sala
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-4 animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Nombre de la sala</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej: Noche de Pelis"
                      required
                      className="w-full bg-bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">Video Inicial</label>
                    {!mediaUrl ? (
                      <SearchVideo 
                        isHost={false} 
                        onSelect={(url) => setMediaUrl(url)} 
                        showQueueButton={false} 
                      />
                    ) : (
                      <div className="flex items-center justify-between bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-text-primary font-medium truncate">{mediaUrl}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMediaUrl('')}
                          className="ml-2 text-text-muted hover:text-text-primary text-xs transition-colors cursor-pointer"
                        >
                          Cambiar
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isCreating || !mediaUrl || !title.trim()}
                    className="w-full bg-text-primary text-bg-primary font-medium rounded-lg px-4 py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : 'Crear sala'}
                  </button>
                </form>
              )}
            </div>

            {/* Tarjeta: Unirse */}
            <div className="bg-bg-secondary border border-border-subtle rounded-xl p-6 transition-all duration-200 hover:border-border-accent flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center border border-border-subtle">
                  <Users size={16} className="text-text-primary" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">Unirse</h3>
              </div>
              <p className="text-sm text-text-secondary mb-6 flex-1">
                Ingresa el código de una sala existente para participar.
              </p>
              <form onSubmit={handleJoin} className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Código"
                  required
                  maxLength={6}
                  className="flex-1 bg-bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-colors uppercase font-mono tracking-wider"
                />
                <button
                  type="submit"
                  disabled={isJoining || joinCode.length < 4}
                  className="bg-bg-elevated border border-border-subtle text-text-primary rounded-lg px-4 py-2 hover:bg-border-subtle transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isJoining ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                </button>
              </form>
            </div>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger text-center animate-fade-in">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
