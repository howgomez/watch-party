import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Este endpoint servira para que los clientes al entrar a la sala puedan
  // descargar los ultimos mensajes sin usar WebSockets para eso.
  @UseGuards(JwtAuthGuard)
  @Get(':roomId')
  async getRoomMessages(@Param('roomId') roomId: string) {
    return this.chatService.getRoomMessages(roomId);
  }
}
