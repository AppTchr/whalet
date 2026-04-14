import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('app.redis.url');
        const client = new Redis(redisUrl ?? 'redis://localhost:6379', {
          lazyConnect: true,
          maxRetriesPerRequest: 3,
        });

        client.on('error', (err) => {
          // Do not log sensitive connection details
          console.error('[Redis] Connection error');
          console.error(err.message);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
