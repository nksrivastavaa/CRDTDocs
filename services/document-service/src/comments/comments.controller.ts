import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '@collab/common';
import type { CommentItem, JwtPayload } from '@collab/types';
import { CreateCommentDto, ReplyCommentDto } from './comments.dto';
import { CommentsService } from './comments.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('documents/:documentId/comments')
  list(@CurrentUser() user: JwtPayload, @Param('documentId') documentId: string): Promise<CommentItem[]> {
    return this.commentsService.list(user.sub, documentId);
  }

  @Post('documents/:documentId/comments')
  create(
    @CurrentUser() user: JwtPayload,
    @Param('documentId') documentId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentItem> {
    return this.commentsService.create(user.sub, documentId, dto);
  }

  @Post('comments/:commentId/replies')
  reply(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() dto: ReplyCommentDto,
  ): Promise<CommentItem> {
    return this.commentsService.reply(user.sub, commentId, dto);
  }

  @Patch('comments/:commentId/resolve')
  resolve(@CurrentUser() user: JwtPayload, @Param('commentId') commentId: string): Promise<CommentItem> {
    return this.commentsService.resolve(user.sub, commentId);
  }
}
