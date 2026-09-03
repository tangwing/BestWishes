// 收件箱：某人收到的祝福。每条从 blessing 拼出当前可见状态与发送者的粗粒度信息
// （昵称 + 城市 + 距离），不暴露发送者的精确位置 / openid。

import {
  haversineKm,
  placeholderType,
  PLACEHOLDER_TEXT,
  type BlessingContentType,
  type GeoPoint,
  type Occasion,
  type PlaceholderType,
} from '@bestwishes/domain';
import type { AppDeps } from './deps';

export interface InboxView {
  id: string;
  blessingId: string;
  occasion: Occasion;
  contentType: BlessingContentType;
  from: {
    userId: string;
    nickname: string;
    city: string | null;
    distanceKm: number | null;
  };
  deliveredAt: string;
  read: boolean;
  status: PlaceholderType;
  body: string | null;
  placeholderText: string | null;
  canReply: boolean;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function createInboxService(deps: AppDeps) {
  async function pointFor(userId: string): Promise<GeoPoint | null> {
    const p = await deps.repos.profiles.get(userId);
    if (p?.lat == null || p.lng == null) return null;
    return { lat: p.lat, lng: p.lng };
  }

  return {
    async list(userId: string): Promise<InboxView[]> {
      const items = await deps.repos.inbox.listForRecipient(userId);
      const myPoint = await pointFor(userId);
      const now = deps.clock.now();
      const out: InboxView[] = [];
      for (const item of items) {
        const b = await deps.repos.blessings.findById(item.blessingId);
        if (!b) continue;
        const status = placeholderType(b.state, b.expiresAt, now);
        const [sender, senderProfile] = await Promise.all([
          deps.repos.users.findById(item.senderId),
          deps.repos.profiles.get(item.senderId),
        ]);
        let distanceKm: number | null = null;
        if (myPoint && senderProfile?.lat != null && senderProfile.lng != null) {
          distanceKm = round1(
            haversineKm(myPoint, { lat: senderProfile.lat, lng: senderProfile.lng }),
          );
        }
        out.push({
          id: item.id,
          blessingId: b.id,
          occasion: b.occasion,
          contentType: b.contentType,
          from: {
            userId: item.senderId,
            nickname: senderProfile?.senderName ?? sender?.nickname ?? '一位朋友',
            city: senderProfile?.regionCity ?? null,
            distanceKm,
          },
          deliveredAt: item.deliveredAt,
          read: item.readAt !== null,
          status,
          body: status === 'content' ? b.body : null,
          placeholderText: status === 'content' ? null : PLACEHOLDER_TEXT[status],
          canReply: true,
        });
      }
      return out;
    },

    async markAllRead(userId: string): Promise<void> {
      await deps.repos.inbox.markAllRead(userId);
    },
  };
}

export type InboxService = ReturnType<typeof createInboxService>;
