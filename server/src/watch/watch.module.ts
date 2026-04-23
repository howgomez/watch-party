import { Module } from '@nestjs/common';
import { WatchGateway } from './watch.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatModule } from '../chat/chat.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') || '7d' },
      }),
    }),
    ChatModule,
    RoomsModule,
  ],
  providers: [WatchGateway],
})
export class WatchModule {}
