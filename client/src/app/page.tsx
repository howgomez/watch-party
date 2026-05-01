'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import AuthForm from '@/components/AuthForm';
import Dashboard from '@/components/Dashboard';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Página principal.
 * Si el usuario no está autenticado, muestra el formulario de login/registro.
 * Si ya está autenticado, muestra el Dashboard (crear/unirse a salas).
 */
export default function HomePage() {
  const { user, isLoading, loadFromStorage } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);

  // Al cargar la página, intentamos restaurar la sesión desde localStorage
  useEffect(() => {
    console.log('Mounting HomePage...');
    loadFromStorage().finally(() => setHasMounted(true));
  }, []); // Solo una vez al montar

  // Evitamos renderizar hasta que sepamos si hay sesión (evita flash de login)
  if (!hasMounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-accent-primary" />
      </div>
    );
  }

  // Si no hay usuario autenticado, mostramos el auth form
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        {/* Esferas de luz decorativas de fondo */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-accent-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent-secondary/10 rounded-full blur-3xl" />
        <AuthForm />
      </div>
    );
  }

  // Usuario autenticado -> Dashboard
  return <Dashboard />;
}
