// 会话：演示阶段用一个 httpOnly cookie 存 userId。
// 真实实现换成微信授权换来的会话令牌（服务端存储 + 过期），这里的读取接口不变。

import { AppException } from '@bestwishes/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';

const COOKIE = 'bw_uid';

export function getUserId(request: FastifyRequest): string | null {
  const raw = request.cookies[COOKIE];
  return raw && raw.length > 0 ? raw : null;
}

export function requireUserId(request: FastifyRequest): string {
  const id = getUserId(request);
  if (!id) throw new AppException('unauthorized', 'no session', '请先登录');
  return id;
}

export function setSession(reply: FastifyReply, userId: string): void {
  void reply.setCookie(COOKIE, userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSession(reply: FastifyReply): void {
  void reply.clearCookie(COOKIE, { path: '/' });
}
