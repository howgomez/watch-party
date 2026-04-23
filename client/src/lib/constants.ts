// Constantes generales de la aplicación
// Centralizamos las URLs para no repetirlas en cada fetch/socket

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
