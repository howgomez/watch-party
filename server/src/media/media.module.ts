import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Module({
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService], // Compartimos el servicio por si el RoomsModule lo quiere usar en el futuro
})
export class MediaModule {}
