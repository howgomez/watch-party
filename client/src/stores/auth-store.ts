import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import type { User, AuthResponse } from '../lib/types';

/**
 * Store global de autenticación (Zustand).
 * Maneja el estado del usuario logueado, el token JWT,
 * y las acciones de login/registro/logout.
 */

interface AuthState {
  // Estado
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Acciones
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      // Guardamos el token en localStorage para que persista entre recargas
      localStorage.setItem('token', data.token);
      set({ user: data.user as User, token: data.token, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      set({ error: message, isLoading: false });
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });
      localStorage.setItem('token', data.token);
      set({ user: data.user as User, token: data.token, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrarse';
      set({ error: message, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  // Al recargar la página, verificamos si hay un token guardado y lo validamos
  loadFromStorage: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await apiFetch<User>('/auth/me');
      set({ user, token, isLoading: false });
    } catch {
      // Si el token es inválido o expiró, lo eliminamos
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
