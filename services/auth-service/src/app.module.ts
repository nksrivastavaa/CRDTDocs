import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule, LoggingMiddleware, env } from '@collab/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      global: true,
      secret: env('JWT_SECRET', 'development-secret'),
      signOptions: { expiresIn: env('JWT_EXPIRES_IN', '7d') },
    }),
    UsersModule,
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
