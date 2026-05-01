import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '@collab/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { NotificationPublisher } from '../notifications/notification.publisher';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [PermissionsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, NotificationPublisher, JwtAuthGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
