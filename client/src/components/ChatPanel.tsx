'use client';

import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Message } from '@/lib/types';
import { Send, Info, MessageSquare } from 'lucide-react';

interface ChatPanelProps {
  roomId: string;
}

type ChatItem = Message & { isSystem?: boolean; systemContent?: string };

const USER_COLORS = [
  'text-rose-400', 'text-blue-400', 'text-green-400',
  'text-yellow-400', 'text-purple-400', 'text-orange-400',
  'text-cyan-400', 'text-pink-400', 'text-emerald-400'
];

const getUserColor = (username: string) => {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

/**
 * Panel de chat en vivo interactivo.
 * Diseño minimalista y profesional.
 */
export default function ChatPanel({ roomId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const socket = getSocket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { event: string; data: Message }) => {
      setMessages((prev) => [...prev, data.data]);
    };

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
    <div className="bg-bg-secondary border border-border-subtle rounded-xl flex flex-col h-full overflow-hidden">
      {/* Encabezado del chat */}
      <div className="px-4 py-3 border-b border-border-subtle bg-bg-secondary flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare size={16} className="text-text-secondary" />
          Chat
        </h3>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 custom-scrollbar bg-bg-primary/30">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-40 gap-3">
            <MessageSquare size={32} />
            <p className="text-sm">No hay mensajes aún.</p>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex justify-center animate-fade-in-up my-2">
                <div className="bg-bg-elevated px-3 py-1.5 rounded-lg flex items-center gap-2 border border-border-subtle">
                  <Info size={12} className="text-text-secondary" />
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
              className={`animate-in fade-in flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
            >
              {!isOwn && (
                <span className={`text-[11px] font-semibold mb-1 ml-1 ${userColor}`}>
                  {msg.user.username}
                </span>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${isOwn
                    ? 'bg-text-primary text-bg-primary rounded-br-sm'
                    : 'bg-bg-elevated border border-border-subtle text-text-primary rounded-bl-sm'
                  }`}
              >
                <p className="text-sm leading-relaxed break-words">{msg.content}</p>
              </div>
              <span className="text-[10px] text-text-muted mt-1 px-1">
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
      <form onSubmit={handleSend} className="p-3 border-t border-border-subtle bg-bg-secondary flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mensaje..."
          maxLength={500}
          className="flex-1 bg-bg-primary border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-text-primary text-bg-primary rounded-lg px-4 py-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
