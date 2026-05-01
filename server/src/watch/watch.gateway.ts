import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { ChatService } from '../chat/chat.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';

// Interfaz para sobreescribir el Socket y tipar que nuestra request
// si lleva un objeto 'user' (inyectado por el WsJwtGuard)
export interface AuthenticatedSocket extends Socket {
  user: {
    sub: string;
    email: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3001",
  },
})
export class WatchGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // ¡Ahora inyectamos nuestro nuevo RedisService en lugar de usar un Map local!
  constructor(
    private chatService: ChatService,
    private redisService: RedisService,
    private prisma: PrismaService,
    private roomsService: RoomsService, // Inyectamos el servicio de salas
  ) { }

  // --- Helpers ---
  private async broadcastQueue(roomId: string) {
    const queue = await this.roomsService.getQueue(roomId);
    this.server.to(roomId).emit('queue:update', { queue });
  }

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  // --- Manejo de la Sala ---

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    client.join(payload.roomId);

    // Leemos el estado desde Redis (usamos await porque Redis es asíncrono)
    let state = await this.redisService.getPlayerState(payload.roomId);

    // Si la sala recien se crea y no hay estado en Redis, lo inicializamos
    if (!state) {
      state = {
        currentTime: 0,
        isPlaying: false,
        updatedAt: Date.now(),
      };
      await this.redisService.setPlayerState(payload.roomId, state);
    }

    // Calculamos el tiempo real estimado si el video está en reproducción
    const syncState = { ...state };
    if (syncState.isPlaying) {
      const elapsedSeconds = (Date.now() - syncState.updatedAt) / 1000;
      syncState.currentTime += elapsedSeconds;
      syncState.updatedAt = Date.now();
    }

    // --- NUEVA MECÁNICA: PAUSA AUTOMÁTICA ---
    // Cuando un nuevo usuario entra, pausamos el video para toda la sala.
    // Esto permite que el usuario cargue el video en paz, y cuando el Host
    // decida darle "play", forzará a todos a sincronizarse y reproducir a la vez.
    syncState.isPlaying = false;
    await this.redisService.setPlayerState(payload.roomId, syncState);

    // Avisamos A TODA LA SALA (incluyendo al Host y al nuevo) que el video se pausó
    this.server.to(payload.roomId).emit('player:sync', {
      event: 'player:pause',
      data: syncState,
    });

    // --- NOTIFICACIÓN DE SISTEMA: Nuevo usuario ---
    const user = await this.prisma.user.findUnique({ where: { id: client.user.sub } });
    if (user) {
      this.server.to(payload.roomId).emit('chat:system_alert', {
        content: `${user.username} se ha unido. Pausamos para sincronizar... 🕒`
      });
    }

    return {
      event: 'room:join',
      data: {
        roomId: payload.roomId,
        state,
      },
    };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:leave')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    client.leave(payload.roomId);
    // Nota: El estado se mantendrá en Redis vivo por 24 horas y luego se borra solo
    // debido al TTL configurado en setPlayerState, lo que limpia la basura automáticamente.
    return { event: 'room:leave', data: { roomId: payload.roomId } };
  }

  // @UseGuards(WsJwtGuard)
  // @SubscribeMessage('player:request_sync')
  // async handleRequestSync(
  //   @ConnectedSocket() client: AuthenticatedSocket,
  //   @MessageBody() payload: { roomId: string },
  // ) {
  //   const state = await this.redisService.getPlayerState(payload.roomId);
  //   if (state) {
  //     const syncState = { ...state };
  //     if (syncState.isPlaying) {
  //       const elapsedSeconds = (Date.now() - syncState.updatedAt) / 1000;
  //       syncState.currentTime += elapsedSeconds;
  //       syncState.updatedAt = Date.now();
  //     }
  //     client.emit('player:sync', {
  //       event: 'player:sync',
  //       data: syncState,
  //     });
  //   }
  // }

  // --- Controles del Reproductor (Se emite a los demas en la sala) ---

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('player:play')
  async handlePlay(
    @ConnectedSocket() client: AuthenticatedSocket, // client.user tiene los datos gracias al guard
    @MessageBody() payload: { roomId: string; currentTime: number },
  ) {
    // 1. Buscamos el estado actual en Redis
    const state = await this.redisService.getPlayerState(payload.roomId);

    if (state) {
      // 2. Modificamos los valores
      state.isPlaying = true;
      state.currentTime = payload.currentTime;
      state.updatedAt = Date.now();

      // 3. Volvemos a guardarlo en Redis
      await this.redisService.setPlayerState(payload.roomId, state);
    }

    // Alerta de sincronizacion hacia todos en la sala EXCEPTO quien emitió el evento
    client.to(payload.roomId).emit('player:sync', {
      event: 'player:play',
      data: state,
    });

    return { event: 'player:play', data: 'ok' };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('player:pause')
  async handlePause(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; currentTime: number },
  ) {
    const state = await this.redisService.getPlayerState(payload.roomId);

    if (state) {
      state.isPlaying = false;
      state.currentTime = payload.currentTime;
      state.updatedAt = Date.now();

      await this.redisService.setPlayerState(payload.roomId, state);
    }

    client.to(payload.roomId).emit('player:sync', {
      event: 'player:pause',
      data: state,
    });

    return { event: 'player:pause', data: 'ok' };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('player:seek')
  async handleSeek(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; currentTime: number },
  ) {
    const state = await this.redisService.getPlayerState(payload.roomId);

    if (state) {
      state.currentTime = payload.currentTime;
      state.updatedAt = Date.now();

      await this.redisService.setPlayerState(payload.roomId, state);
    }

    client.to(payload.roomId).emit('player:sync', {
      event: 'player:seek',
      data: state,
    });

    return { event: 'player:seek', data: 'ok' };
  }

  // --- Sincronización a Petición (Guest -> Host) ---
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('player:request_sync')
  handleRequestSync(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    // Un invitado está pidiendo la hora exacta actual.
    // Le avisamos a toda la sala (principalmente al Host) para que re-emita su estado.
    client.to(payload.roomId).emit('player:host_request_sync', {
      event: 'player:host_request_sync',
      data: 'Guest requested sync',
    });
    return { event: 'player:request_sync', data: 'ok' };
  }

  // --- Manejo del Chat ---

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; content: string },
  ) {
    const message = await this.chatService.saveMessage(
      payload.roomId,
      client.user.sub,
      payload.content,
    );

    this.server.to(payload.roomId).emit('message:new', {
      event: 'message:new',
      data: message,
    });

    return { event: 'message:send', data: 'ok' };
  }

  // --- Manejo de Cambio de Video ---

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('room:change_video')
  async handleChangeVideo(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; newUrl: string },
  ) {
    // 1. Validar que el usuario sea el host (seguridad)
    const room = await this.prisma.room.findUnique({ where: { id: payload.roomId } });
    if (!room || room.host_id !== client.user.sub) {
      return { event: 'room:change_video', error: 'No autorizado o sala no encontrada' };
    }

    // 2. Actualizar en Base de Datos para nuevos usuarios
    await this.prisma.room.update({
      where: { id: payload.roomId },
      data: { media_url: payload.newUrl }
    });

    // 3. Resetear estado en Redis (volver al minuto 0)
    const state = {
      currentTime: 0,
      isPlaying: true, // Auto-play the new video usually
      updatedAt: Date.now(),
    };
    await this.redisService.setPlayerState(payload.roomId, state);

    // 4. Emitir el cambio de URL a toda la sala
    this.server.to(payload.roomId).emit('room:video_changed', {
      mediaUrl: payload.newUrl,
    });

    // 5. Emitir el nuevo estado de reproducción (minuto 0)
    this.server.to(payload.roomId).emit('player:sync', {
      event: 'player:sync',
      data: state,
    });

    return { event: 'room:change_video', data: 'ok' };
  }

  // --- Manejo de la Cola (Playlist) ---

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('queue:add')
  async handleAddToQueue(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; video: any },
  ) {
    // 1. Guardamos el video en la base de datos (tabla PlaylistItem)
    // Le agregamos el email de la persona que lo sugirió para mostrarlo en el frontend.
    await this.roomsService.addToQueue(payload.roomId, {
      ...payload.video,
      addedBy: client.user.email,
    });
    // 2. Le avisamos a TODOS en la sala que la cola se actualizó
    await this.broadcastQueue(payload.roomId);
    return { event: 'queue:add', data: 'ok' };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('queue:remove')
  async handleRemoveFromQueue(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string; itemId: string },
  ) {
    // 1. Eliminamos el item de la base de datos usando Prisma
    await this.roomsService.removeFromQueue(payload.itemId);
    // 2. Volvemos a emitir la cola actualizada a toda la sala
    await this.broadcastQueue(payload.roomId);
    return { event: 'queue:remove', data: 'ok' };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('player:ended')
  async handlePlayerEnded(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { roomId: string },
  ) {
    // SEGURIDAD: Solo el "Host" debería poder disparar el evento de que el video terminó.
    // Esto evita que si hay 10 personas en la sala, el servidor intente saltar de video 10 veces al mismo tiempo.
    const room = await this.prisma.room.findUnique({ where: { id: payload.roomId } });
    if (!room || room.host_id !== client.user.sub) return;

    // Sacamos el SIGUIENTE video de la cola (pop: lo obtiene y lo borra de la cola automáticamente)
    const nextVideo = await this.roomsService.popNextFromQueue(payload.roomId);

    if (nextVideo) {
      // 1. Si hay un video siguiente, actualizamos la URL oficial de la sala en la BD
      await this.prisma.room.update({
        where: { id: payload.roomId },
        data: { media_url: nextVideo.url }
      });

      // 2. Reseteamos el estado del reproductor en Redis (lo mandamos al minuto 0:00 y le damos play)
      const state = { currentTime: 0, isPlaying: true, updatedAt: Date.now() };
      await this.redisService.setPlayerState(payload.roomId, state);

      // 3. Notificamos a todas las pantallas de los usuarios para que carguen el nuevo video...
      this.server.to(payload.roomId).emit('room:video_changed', {
        mediaUrl: nextVideo.url,
      });
      // ... y sincronizamos el tiempo (minuto 0)
      this.server.to(payload.roomId).emit('player:sync', {
        event: 'player:sync',
        data: state,
      });

      // Finalmente, actualizamos visualmente la lista de la cola porque ahora tiene un video menos
      await this.broadcastQueue(payload.roomId);
    }
  }
}
