import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '@collab/common';
import type { JwtPayload, WorkspaceSummary } from '@collab/types';
import { CreateWorkspaceDto, JoinWorkspaceDto } from './workspaces.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkspaceDto): Promise<WorkspaceSummary> {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<WorkspaceSummary[]> {
    return this.workspacesService.list(user.sub);
  }

  @Post('join')
  join(@CurrentUser() user: JwtPayload, @Body() dto: JoinWorkspaceDto): Promise<WorkspaceSummary> {
    return this.workspacesService.join(user.sub, dto);
  }

  @Get(':workspaceId')
  get(@CurrentUser() user: JwtPayload, @Param('workspaceId') workspaceId: string): Promise<WorkspaceSummary> {
    return this.workspacesService.get(user.sub, workspaceId);
  }

  @Post(':workspaceId/invites')
  createInvite(@CurrentUser() user: JwtPayload, @Param('workspaceId') workspaceId: string): Promise<{ inviteCode: string }> {
    return this.workspacesService.createInvite(user.sub, workspaceId);
  }

}
