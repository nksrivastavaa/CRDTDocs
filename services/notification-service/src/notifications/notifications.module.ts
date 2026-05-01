import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '@collab/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, JwtAuthGuard],
})
export class NotificationsModule {}
