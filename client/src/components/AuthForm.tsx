'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { LogIn, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';

/**
 * Formulario de autenticación.
 * Permite alternar entre Login y Registro con una animación suave.
 */
export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await login(email, password);
    } else {
      await register(email, username, password);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearError();
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in-up">
      {/* Tarjeta de cristal */}
      <div className="glass rounded-2xl p-8 glow">
        {/* Encabezado con logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent">
            WatchParty
          </h1>
          <p className="text-text-secondary mt-2 text-sm">
            {mode === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-text-secondary mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              className="w-full bg-bg-primary/60 border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>

          {/* El campo de username solo aparece en modo registro */}
          {mode === 'register' && (
            <div className="animate-fade-in-up">
              <label htmlFor="username" className="block text-sm text-text-secondary mb-1.5">
                Nombre de usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="tunombre"
                required
                className="w-full bg-bg-primary/60 border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors"
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm text-text-secondary mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-bg-primary/60 border border-border-subtle rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger animate-fade-in-up">
              {error}
            </div>
          )}

          {/* Botón de enviar */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full gradient-accent text-white font-semibold rounded-xl px-4 py-3 text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === 'login' ? (
              <>
                <LogIn size={18} />
                Iniciar sesión
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Crear cuenta
              </>
            )}
          </button>
        </form>

        {/* Toggle entre login/registro */}
        <p className="text-center text-sm text-text-secondary mt-6">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={toggleMode}
            className="text-accent-primary hover:text-accent-secondary transition-colors font-medium cursor-pointer"
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
