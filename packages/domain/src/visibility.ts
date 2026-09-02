// 接收方可见性 = 状态机的投影（纯函数）。
// 对应 specs/blessing-delivery「可分享的祝福落地页」。

import type { BlessingState } from './types';

export type PlaceholderType =
  | 'content' // 展示正文
  | 'preparing' // 祝福正在准备中
  | 'withdrawn' // 这份祝福已被收回
  | 'taken_down' // 中性占位（驳回 / 下架）
  | 'expired' // 分享期限已过
  | 'not_found';

function pastExpiry(expiresAt: Date | string | null, now: Date): boolean {
  if (expiresAt === null) return false;
  const t = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return t.getTime() <= now.getTime();
}

/** 访客落地页是否可见正文。仅 published 且未过期。 */
export function isPubliclyVisible(
  state: BlessingState,
  expiresAt: Date | string | null,
  now: Date,
): boolean {
  return state === 'published' && !pastExpiry(expiresAt, now);
}

/**
 * 访客落地页应渲染的占位类型。
 * 对未公开可见的祝福，接口据此只下发枚举、绝不下发正文。
 */
export function placeholderType(
  state: BlessingState,
  expiresAt: Date | string | null,
  now: Date,
): PlaceholderType {
  switch (state) {
    case 'published':
      return pastExpiry(expiresAt, now) ? 'expired' : 'content';
    case 'verifying':
      return 'preparing';
    case 'expired':
      return 'expired';
    case 'withdrawn':
    case 'deleted':
      return 'withdrawn';
    case 'rejected':
    case 'taken_down':
      return 'taken_down';
    case 'draft':
    default:
      return 'not_found';
  }
}

export const PLACEHOLDER_TEXT: Record<Exclude<PlaceholderType, 'content'>, string> = {
  preparing: '这份祝福正在准备中，稍后再来看看',
  withdrawn: '这份祝福已被收回',
  taken_down: '这份祝福暂时无法查看',
  expired: '这份祝福的分享期限已过。如果你保存过图片，仍可留作纪念',
  not_found: '没有找到这份祝福',
};
