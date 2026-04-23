import { io, Socket } from 'socket.io-client';
import { WS_URL } from './constants';

/**
 * Instancia global del socket.
 * Usamos "let" porque se puede re-crear si el usuario se reconecta.
 */
let socket: Socket | null = null;

/**
 * Conecta al servidor de WebSockets enviando el token JWT
 * como parte del handshake (auth.token).
 * Si ya existe una conexión activa, la devuelve sin crear otra.
 */
export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    auth: { token },        // El WsJwtGuard del backend leerá este token
    transports: ['websocket'], // Forzamos WebSocket nativo (más rápido que polling)
  });

  socket.on('connect', () => {
    console.log('🔌 Socket conectado:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket desconectado:', reason);
  });

  return socket;
}

/**
 * Devuelve la instancia actual del socket (puede ser null si no se conectó)
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Desconecta el socket limpiamente
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
