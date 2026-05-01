import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '@collab/common';
import type { DocumentDetail, DocumentPermission, DocumentSummary, JwtPayload } from '@collab/types';
import { CreateDocumentDto, ShareDocumentDto, UpdateDocumentDto } from './documents.dto';
import { DocumentsService } from './documents.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('workspaces/:workspaceId/documents')
  listByWorkspace(
    @CurrentUser() user: JwtPayload,
    @Param('workspaceId') workspaceId: string,
  ): Promise<DocumentSummary[]> {
    return this.documentsService.listByWorkspace(user.sub, workspaceId);
  }

  @Post('workspaces/:workspaceId/documents')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentDetail> {
    return this.documentsService.create(user.sub, workspaceId, dto);
  }

  @Get('documents/:documentId')
  get(@CurrentUser() user: JwtPayload, @Param('documentId') documentId: string): Promise<DocumentDetail> {
    return this.documentsService.get(user.sub, documentId);
  }

  @Patch('documents/:documentId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentDetail> {
    return this.documentsService.update(user.sub, documentId, dto);
  }

  @Delete('documents/:documentId')
  remove(@CurrentUser() user: JwtPayload, @Param('documentId') documentId: string): Promise<{ deleted: true }> {
    return this.documentsService.remove(user.sub, documentId);
  }

  @Post('documents/:documentId/share')
  share(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
    @Body() dto: ShareDocumentDto,
  ): Promise<DocumentPermission> {
    return this.documentsService.share(user.sub, documentId, dto);
  }

  @Get('documents/:documentId/permissions')
  listPermissions(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
  ): Promise<DocumentPermission[]> {
    return this.documentsService.listPermissions(user.sub, documentId);
  }
}
