import { API_URL } from './constants';

/**
 * Wrapper de fetch que agrega automáticamente el token JWT
 * y las cabeceras JSON a todas nuestras peticiones al backend.
 * Esto evita repetir código en cada llamada.
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Leemos el token guardado en localStorage (si existe)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Si la respuesta no es exitosa, lanzamos un error con el mensaje del backend
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error de conexión' }));
    throw new Error(error.message || `Error ${res.status}`);
  }

  return res.json();
}
