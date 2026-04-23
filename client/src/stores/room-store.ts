import { create } from 'zustand';
import { apiFetch } from '../lib/api';
import type { Room } from '../lib/types';

/**
 * Store de salas (Zustand).
 * Maneja la lista de salas y la sala activa actual.
 */

interface RoomState {
  rooms: Room[];
  currentRoom: Room | null;
  isLoading: boolean;
  error: string | null;

  fetchRooms: () => Promise<void>;
  fetchRoomByCode: (code: string) => Promise<void>;
  createRoom: (title: string, mediaUrl: string, mediaType: string) => Promise<Room>;
  joinRoom: (code: string) => Promise<void>;
  leaveRoom: (code: string) => Promise<void>;
  updateCurrentRoomUrl: (url: string) => void;
  updateQueue: (queue: any[]) => void;
  clearCurrentRoom: () => void;
  clearError: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  rooms: [],
  currentRoom: null,
  isLoading: false,
  error: null,

  fetchRooms: async () => {
    set({ isLoading: true });
    try {
      const rooms = await apiFetch<Room[]>('/rooms');
      set({ rooms, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cargando salas';
      set({ error: message, isLoading: false });
    }
  },

  fetchRoomByCode: async (code) => {
    set({ isLoading: true });
    try {
      const room = await apiFetch<Room>(`/rooms/${code}`);
      set({ currentRoom: room, isLoading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sala no encontrada';
      set({ error: message, isLoading: false });
    }
  },

  createRoom: async (title, mediaUrl, mediaType) => {
    const room = await apiFetch<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ title, media_url: mediaUrl, media_type: mediaType }),
    });
    set({ currentRoom: room });
    return room;
  },

  joinRoom: async (code) => {
    try {
      const room = await apiFetch<Room>(`/rooms/${code}/join`, { method: 'POST' });
      set({ currentRoom: room });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al unirse';
      set({ error: message });
    }
  },

  leaveRoom: async (code) => {
    try {
      await apiFetch(`/rooms/${code}/leave`, { method: 'POST' });
      set({ currentRoom: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al salir';
      set({ error: message });
    }
  },

  updateCurrentRoomUrl: (url) => set((state) => ({
    currentRoom: state.currentRoom ? { ...state.currentRoom, media_url: url } : null
  })),

  updateQueue: (queue) => set((state) => ({
    currentRoom: state.currentRoom ? { ...state.currentRoom, queue } : null
  })),

  clearCurrentRoom: () => set({ currentRoom: null }),
  clearError: () => set({ error: null }),
}));
