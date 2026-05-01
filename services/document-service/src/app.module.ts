import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule, LoggingMiddleware, RedisModule, env } from '@collab/common';
import { CommentsModule } from './comments/comments.module';
import { DocumentsModule } from './documents/documents.module';
import { FilesModule } from './files/files.module';
import { NotificationPublisher } from './notifications/notification.publisher';
import { PermissionsModule } from './permissions/permissions.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    JwtModule.register({
      global: true,
      secret: env('JWT_SECRET', 'development-secret'),
      signOptions: { expiresIn: env('JWT_EXPIRES_IN', '7d') },
    }),
    PermissionsModule,
    WorkspacesModule,
    DocumentsModule,
    CommentsModule,
    FilesModule,
  ],
  providers: [NotificationPublisher],
  exports: [NotificationPublisher],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
