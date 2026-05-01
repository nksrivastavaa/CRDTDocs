import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule, RedisModule, env } from '@collab/common';
import { CollaborationModule } from './collaboration/collaboration.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    JwtModule.register({
      global: true,
      secret: env('JWT_SECRET', 'development-secret'),
      signOptions: { expiresIn: env('JWT_EXPIRES_IN', '7d') },
    }),
    CollaborationModule,
  ],
})
export class AppModule {}
