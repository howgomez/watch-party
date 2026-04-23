import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

// Interfaz idéntica a la que teníamos en watch.gateway.ts.
// Al ponerla aquí, centralizamos la forma en la que tipamos el reproductor.
export interface PlayerState {
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  // Aquí vivirá nuestra instancia oficial del cliente de Redis
  private redisClient: Redis;

  // Inyectamos ConfigService para poder leer REDIS_URL de nuestro archivo .env
  constructor(private configService: ConfigService) {}

  // Este método se ejecuta automáticamente cuando NestJS arranca.
  // Aquí es donde establecemos la conexión real con el contenedor de Redis.
  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redisClient = new Redis(redisUrl);
    
    this.redisClient.on('connect', () => {
      console.log('✅ Conectado a Redis exitosamente');
    });

    this.redisClient.on('error', (err) => {
      console.error('❌ Error conectando a Redis:', err);
    });
  }

  // Cuando se apaga el servidor, cerramos la conexión de forma limpia
  onModuleDestroy() {
    this.redisClient.quit();
  }

  // --- Funciones exclusivas para la sincronización de la Sala ---

  /**
   * Guarda o actualiza el estado del reproductor de una sala en Redis.
   * Usamos JSON.stringify porque Redis solo almacena "Strings" básicos.
   */
  async setPlayerState(roomId: string, state: PlayerState): Promise<void> {
    const key = `room:${roomId}:player`; // Definimos una llave única
    const value = JSON.stringify(state);
    
    // Guardamos el valor. Además, le ponemos un tiempo de expiración (TTL)
    // de 24 horas (86400 segundos) para que la RAM de Redis no se llene
    // eternamente con salas abandonadas. "EX" significa Expire en segundos.
    await this.redisClient.set(key, value, 'EX', 86400); 
  }

  /**
   * Recupera el estado actual del reproductor desde Redis.
   */
  async getPlayerState(roomId: string): Promise<PlayerState | null> {
    const key = `room:${roomId}:player`;
    const data = await this.redisClient.get(key);
    
    if (!data) return null; // Si no existe (es sala nueva o expiró), devolvemos null
    
    // Transformamos el string guardado de vuelta a un Objeto de TypeScript
    return JSON.parse(data) as PlayerState;
  }
  
  /**
   * Elimina el estado (Útil cuando la sala se cierra explícitamente)
   */
  async deletePlayerState(roomId: string): Promise<void> {
    const key = `room:${roomId}:player`;
    await this.redisClient.del(key);
  }
}
