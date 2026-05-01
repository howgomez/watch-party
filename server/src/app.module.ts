import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { RoomsModule } from './rooms/rooms.module';
import { WatchModule } from './watch/watch.module';
import { ChatModule } from './chat/chat.module';
import { MediaModule } from './media/media.module';
import { RedisModule } from './redis/redis.module';
import { YoutubeModule } from './youtube/youtube.module';

@Module({
  imports: [PrismaModule, ConfigModule.forRoot({ isGlobal: true }), AuthModule, RoomsModule, WatchModule, ChatModule, MediaModule, RedisModule, YoutubeModule],
  controllers: [],
  providers: []
})
export class AppModule { }
