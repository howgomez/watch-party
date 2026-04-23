import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

@Module({
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService] // Lo exportamos para usarlo dentro del WatchGateway
})
export class ChatModule {}
