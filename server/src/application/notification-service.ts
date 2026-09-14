// 通知：谁给你送了祝福。P1 只有站内一条列表 + 未读数徽标；真实推送（微信模板消息 / Web Push）留到后续。

import type { NotificationKind } from '../ports/records';
import type { AppDeps } from './deps';

export interface NotificationView {
  id: string;
  kind: NotificationKind;
  blessingId: string | null;
  requestId: string | null;
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
        // 匹配通知来自一条匿名祈福时，同样不能把真实昵称发给候选响应人（design D4）。
        const request = n.requestId ? await deps.repos.wishRequests.findById(n.requestId) : null;
        const anonymous = request?.anonymous ?? false;
        const [user, profile] = anonymous
          ? [null, null]
          : await Promise.all([
              deps.repos.users.findById(n.fromUserId),
              deps.repos.profiles.get(n.fromUserId),
            ]);
        items.push({
          id: n.id,
          kind: n.kind,
          blessingId: n.blessingId,
          requestId: n.requestId,
          from: {
            userId: n.fromUserId,
            nickname: anonymous ? '一位朋友' : (profile?.senderName ?? user?.nickname ?? '一位朋友'),
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
