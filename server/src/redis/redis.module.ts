import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

// Hacemos que este módulo sea global (como Prisma) para no tener que 
// importarlo en cada lugar donde queramos usar caché (por ejemplo, WatchModule o RoomsModule).
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
