import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '@collab/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [PermissionsModule],
  controllers: [FilesController],
  providers: [FilesService, JwtAuthGuard],
})
export class FilesModule {}
