import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '@collab/common';
import { NotificationPublisher } from '../notifications/notification.publisher';
import { PermissionsModule } from '../permissions/permissions.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [PermissionsModule],
  controllers: [CommentsController],
  providers: [CommentsService, NotificationPublisher, JwtAuthGuard],
})
export class CommentsModule {}
