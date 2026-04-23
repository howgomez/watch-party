'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Message } from '@/lib/types';
import { Send } from 'lucide-react';

interface ChatPanelProps {
  roomId: string; // ID real (UUID) de la sala para las consultas REST y socket
}

/**
 * Panel de chat en vivo.
 * Carga el historial inicial por HTTP y luego escucha nuevos mensajes por WebSocket.
 */
export default function ChatPanel({ roomId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const socket = getSocket();

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Cargar historial de mensajes al montar el componente
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

  // Escuchar nuevos mensajes en tiempo real
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { event: string; data: Message }) => {
      setMessages((prev) => [...prev, data.data]);
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket]);

  // Cada vez que cambian los mensajes, hacemos scroll al final
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enviar un mensaje
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
      <div className="px-4 py-3 border-b border-border-subtle">
        <h3 className="text-sm font-semibold text-text-primary">
          Chat en Vivo
        </h3>
        <p className="text-xs text-text-muted">{messages.length} mensajes</p>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-text-muted text-sm py-8">
            No hay mensajes aún. ¡Sé el primero!
          </p>
        )}

        {messages.map((msg) => {
          const isOwn = msg.user_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`animate-fade-in-up ${isOwn ? 'flex justify-end' : ''}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  isOwn
                    ? 'bg-accent-primary/20 border border-accent-primary/20'
                    : 'bg-bg-elevated/60 border border-border-subtle'
                }`}
              >
                {!isOwn && (
                  <p className="text-xs font-medium text-accent-secondary mb-0.5">
                    {msg.user.username}
                  </p>
                )}
                <p className="text-sm text-text-primary break-words">{msg.content}</p>
                <p className="text-[10px] text-text-muted mt-1 text-right">
                  {new Date(msg.created_at).toLocaleTimeString('es', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensaje */}
      <form onSubmit={handleSend} className="p-3 border-t border-border-subtle flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje..."
          maxLength={500}
          className="flex-1 bg-bg-primary/60 border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="gradient-accent text-white rounded-xl px-3 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-30 cursor-pointer"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
