import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '@collab/common';
import type { FileAttachment, JwtPayload } from '@collab/types';
import { CompleteUploadDto, CreateUploadDto } from './files.dto';
import { FilesService } from './files.service';

@Controller('documents/:documentId/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('documentId') documentId: string): Promise<FileAttachment[]> {
    return this.filesService.list(user.sub, documentId);
  }

  @Post('presign')
  createUpload(@CurrentUser() user: JwtPayload, @Param('documentId') documentId: string, @Body() dto: CreateUploadDto) {
    return this.filesService.createUpload(user.sub, documentId, dto);
  }

  @Post('complete')
  completeUpload(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
    @Body() dto: CompleteUploadDto,
  ): Promise<FileAttachment> {
    return this.filesService.completeUpload(user.sub, documentId, dto);
  }
}
