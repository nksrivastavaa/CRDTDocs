import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '@collab/common';
import type { JwtPayload, NotificationItem } from '@collab/types';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload): Promise<NotificationItem[]> {
    return this.notificationsService.list(user.sub);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: JwtPayload): Promise<{ updated: number }> {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Patch(':notificationId/read')
  markRead(
    @CurrentUser() user: JwtPayload,
    @Param('notificationId') notificationId: string,
  ): Promise<NotificationItem> {
    return this.notificationsService.markRead(user.sub, notificationId);
  }
}
