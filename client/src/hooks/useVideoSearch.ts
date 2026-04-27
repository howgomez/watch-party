import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

/**
 * Hook personalizado para manejar la lógica de búsqueda de videos.
 * Centraliza el debounce y las llamadas al API de YouTube (backend).
 */
export function useVideoSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Si está vacío, limpiamos
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // --- MAGIA MULTI-PLATAFORMA ---
    // Si es una URL (Twitch, MP4, Vimeo, etc.), en vez de buscar en YouTube,
    // creamos un resultado falso (mock).
    // ¿Por qué? Porque `react-player` (el reproductor que usamos) es inteligente
    // y si le pasas un link directo de Twitch o .mp4, automáticamente sabe cómo
    // reproducirlo sin que tengamos que hacer integraciones complejas con sus APIs.
    if (searchQuery.includes('http://') || searchQuery.includes('https://')) {
      let title = 'Video Externo / Enlace Directo';
      let platform = 'Link Directo';
      
      // Personalizamos un poco el título según el tipo de link
      if (searchQuery.includes('twitch.tv')) {
        title = 'Stream de Twitch 🟣';
        platform = 'Twitch';
      } else if (searchQuery.endsWith('.mp4')) {
        title = 'Archivo MP4 🎥';
        platform = 'Video Nativo';
      }

      setResults([{
        id: `external-${Date.now()}`,
        url: searchQuery,
        title: title,
        author: platform,
        // Usamos una imagen genérica chula porque no podemos sacar el thumbnail tan fácil de un MP4
        thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=200&auto=format&fit=crop', 
        duration: 'En vivo / Variable' 
      }]);
      return;
    }

    // Debounce de 500ms para evitar saturar el servidor
    timeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiFetch<any[]>(`/youtube/search?q=${encodeURIComponent(searchQuery)}`);
        setResults(res || []);
      } catch (err) {
        console.error('Search error:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return {
    query,
    results,
    isSearching,
    search,
    clearSearch,
  };
}
