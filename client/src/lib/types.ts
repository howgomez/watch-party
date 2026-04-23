// Tipos compartidos de la aplicación
// Centralizamos las interfaces para que todos los componentes y stores
// hablen el mismo "idioma" de datos.

export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string;
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  room_id: string;
  url: string;
  title: string;
  thumbnail?: string;
  duration?: string;
  added_by?: string;
  order: number;
  created_at: string;
}

export interface Room {
  id: string;
  code: string;
  title: string;
  media_url: string;
  media_type: 'YOUTUBE' | 'VIMEO' | 'CUSTOM';
  is_active: boolean;
  created_at: string;
  host_id: string;
  host: { id: string; username: string };
  participants?: { user: { id: string; username: string } }[];
  queue?: PlaylistItem[];
  _count?: { participants: number };
}

export interface Message {
  id: string;
  content: string;
  created_at: string;
  room_id: string;
  user_id: string;
  user: { id: string; username: string; avatar_url?: string };
}

export interface PlayerState {
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
}
