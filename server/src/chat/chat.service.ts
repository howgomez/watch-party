import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Message } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Guarda un mensaje en la DB
  async saveMessage(roomId: string, userId: string, content: string): Promise<Message> {
    return this.prisma.message.create({
      data: {
        content,
        room_id: roomId,
        user_id: userId,
      },
      include: {
        // Incluimos datos basicos del usuario para que el frontend pueda mostrarlos facilemente
        user: { select: { id: true, username: true, avatar_url: true } }
      }
    });
  }

  // Obtiene los ultimos mensajes de una sala ordenados por fecha
  async getRoomMessages(roomId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { room_id: roomId },
      orderBy: { created_at: 'asc' },
      include: {
        user: { select: { id: true, username: true, avatar_url: true } }
      }
    });
  }
}
