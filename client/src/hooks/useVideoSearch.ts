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

    // Si está vacío o parece una URL directa, limpiamos resultados previos
    if (!searchQuery.trim() || searchQuery.includes('http://') || searchQuery.includes('https://')) {
      setResults([]);
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
