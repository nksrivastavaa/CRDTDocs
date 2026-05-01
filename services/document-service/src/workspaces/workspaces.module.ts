import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '@collab/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [PermissionsModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, JwtAuthGuard],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
