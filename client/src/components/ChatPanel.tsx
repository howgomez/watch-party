'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Message } from '@/lib/types';
import { Send, Info, MessageSquare } from 'lucide-react';

interface ChatPanelProps {
  roomId: string; // ID real (UUID) de la sala para las consultas REST y socket
}

// Extendemos Message para soportar mensajes "falsos" del sistema
type ChatItem = Message & { isSystem?: boolean; systemContent?: string };

// Paleta de colores vibrantes estilo Twitch
const USER_COLORS = [
  'text-rose-400', 'text-blue-400', 'text-green-400',
  'text-yellow-400', 'text-purple-400', 'text-orange-400',
  'text-cyan-400', 'text-pink-400', 'text-emerald-400'
];

// Genera un color consistente para el mismo usuario basado en su ID o nombre
const getUserColor = (username: string) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

/**
 * Panel de chat en vivo interactivo.
 * Soporta historial, auto-scroll, notificaciones de sistema y colores dinámicos.
 */
export default function ChatPanel({ roomId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const socket = getSocket();

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Cargar historial de mensajes al montar
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const history = await apiFetch<Message[]>(`/chats/${roomId}`);
        setMessages(history);
      } catch (err) {
        console.error('Error cargando historial del chat:', err);
      }
    };
    loadMessages();
  }, [roomId]);

  // Escuchar mensajes y alertas del sistema
  useEffect(() => {
    if (!socket) return;

    // Mensaje normal de usuario
    const handleNewMessage = (data: { event: string; data: Message }) => {
      setMessages((prev) => [...prev, data.data]);
    };

    // Alerta especial del sistema
    const handleSystemAlert = (data: { content: string }) => {
      const systemMsg: ChatItem = {
        id: `sys-${Date.now()}-${Math.random()}`,
        content: '',
        room_id: roomId,
        user_id: 'system',
        user: { id: 'system', username: 'Sistema' },
        created_at: new Date().toISOString(),
        isSystem: true,
        systemContent: data.content
      };
      setMessages((prev) => [...prev, systemMsg]);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('chat:system_alert', handleSystemAlert);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('chat:system_alert', handleSystemAlert);
    };
  }, [socket, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    socket.emit('message:send', {
      roomId,
      content: input.trim(),
    });

    setInput('');
  };

  return (
    <div className="glass rounded-2xl flex flex-col h-full overflow-hidden">
      {/* Encabezado del chat */}
      <div className="px-4 py-3 border-b border-border-subtle bg-white/5">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <MessageSquare size={16} className="text-accent-primary" />
          Chat en Vivo
        </h3>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-40 gap-3">
            <MessageSquare size={40} />
            <p className="text-xs font-medium">¡Sé el primero en saludar!</p>
          </div>
        )}

        {messages.map((msg) => {
          // Si es un mensaje del sistema, lo renderizamos distinto
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center animate-fade-in-up my-2">
                <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/5">
                  <Info size={12} className="text-accent-primary" />
                  <span className="text-[11px] font-medium text-text-secondary">
                    {msg.systemContent}
                  </span>
                </div>
              </div>
            );
          }

          const isOwn = msg.user_id === user?.id;
          const userColor = getUserColor(msg.user.username);

          return (
            <div
              key={msg.id}
              className={`animate-in fade-in slide-in-from-bottom-2 flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
            >
              {!isOwn && (
                <span className={`text-[11px] font-bold mb-1 ml-1 ${userColor}`}>
                  {msg.user.username}
                </span>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${isOwn
                    ? 'bg-accent-primary text-white rounded-br-sm shadow-lg shadow-accent-primary/20'
                    : 'bg-bg-elevated border border-border-subtle text-text-primary rounded-bl-sm'
                  }`}
              >
                <p className="text-[13px] leading-relaxed break-words">{msg.content}</p>
              </div>
              <span className="text-[9px] text-text-muted mt-1 font-mono tracking-wider px-1">
                {new Date(msg.created_at).toLocaleTimeString('es', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensaje */}
      <form onSubmit={handleSend} className="p-3 border-t border-border-subtle bg-black/20 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          maxLength={500}
          className="flex-1 bg-white/5 border border-transparent rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:bg-white/10 focus:border-accent-primary/50 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-accent-primary text-white rounded-xl px-4 py-2.5 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shadow-lg shadow-accent-primary/20"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
