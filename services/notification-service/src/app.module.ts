import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule, LoggingMiddleware, RedisModule, env } from '@collab/common';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    JwtModule.register({
      global: true,
      secret: env('JWT_SECRET', 'development-secret'),
      signOptions: { expiresIn: env('JWT_EXPIRES_IN', '7d') },
    }),
    NotificationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
