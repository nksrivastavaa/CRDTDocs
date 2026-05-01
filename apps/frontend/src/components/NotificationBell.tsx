import { Bell, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { NotificationItem } from '@collab/types';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void api.listNotifications(token).then(setNotifications).catch(() => setNotifications([]));
  }, [token]);

  const unread = useMemo(() => notifications.filter((notification) => !notification.readAt).length, [notifications]);

  async function markAllRead() {
    if (!token) {
      return;
    }

    await api.markAllNotificationsRead(token);
    setNotifications((items) =>
      items.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
    );
  }

  return (
    <div className="notification-wrap">
      <button className="icon-button" type="button" aria-label="Notifications" onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {unread > 0 ? <span className="notification-dot">{unread}</span> : null}
      </button>
      {open ? (
        <div className="popover notifications-popover">
          <div className="popover-header">
            <strong>Notifications</strong>
            <button className="ghost-button" type="button" onClick={markAllRead}>
              <Check size={15} />
              Read
            </button>
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="muted">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <div className={notification.readAt ? 'notification-item' : 'notification-item unread'} key={notification.id}>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                  <small>{new Date(notification.createdAt).toLocaleString()}</small>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
