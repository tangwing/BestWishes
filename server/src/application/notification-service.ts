// 通知：谁给你送了祝福。P1 只有站内一条列表 + 未读数徽标；真实推送（微信模板消息 / Web Push）留到后续。

import type { NotificationKind } from '../ports/records';
import type { AppDeps } from './deps';

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  blessingId: string;
  from: { userId: string; nickname: string };
  createdAt: string;
  read: boolean;
}

export function createNotificationService(deps: AppDeps) {
  return {
    async list(userId: string): Promise<{ items: NotificationView[]; unread: number }> {
      const records = await deps.repos.notifications.listForUser(userId);
      const items: NotificationView[] = [];
      for (const n of records) {
        const [user, profile] = await Promise.all([
          deps.repos.users.findById(n.fromUserId),
          deps.repos.profiles.get(n.fromUserId),
        ]);
        items.push({
          id: n.id,
          kind: n.kind,
          blessingId: n.blessingId,
          from: {
            userId: n.fromUserId,
            nickname: profile?.senderName ?? user?.nickname ?? '一位朋友',
          },
          createdAt: n.createdAt,
          read: n.readAt !== null,
        });
      }
      return { items, unread: items.filter((i) => !i.read).length };
    },

    unreadCount(userId: string): Promise<number> {
      return deps.repos.notifications.unreadCount(userId);
    },

    async markAllRead(userId: string): Promise<void> {
      await deps.repos.notifications.markAllRead(userId);
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
