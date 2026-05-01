import { Module } from '@nestjs/common';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborationPermissionsService } from './collaboration-permissions.service';
import { DocumentSessionService } from './document-session.service';

@Module({
  providers: [CollaborationGateway, CollaborationPermissionsService, DocumentSessionService],
})
export class CollaborationModule {}
