// 登录。P1 真实实现走微信网页授权；这里先给一个占位登录，供开发和演示。
// 真实回调接进来时，openid 幂等这条不变（同一微信身份只一个账户）。

import type { AppDeps } from './deps';
import type { UserRecord } from '../ports/records';

export interface SessionUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

function toSession(u: UserRecord): SessionUser {
  return { id: u.id, nickname: u.nickname, avatarUrl: u.avatarUrl };
}

export function createAuthService(deps: AppDeps) {
  return {
    /** 占位登录：用昵称当作稳定身份（openid = stub:<nickname>）。 */
    async loginWithStub(nickname: string): Promise<SessionUser> {
      const name = nickname.trim() || '一位朋友';
      const openid = `stub:${name}`;
      const user = await deps.repos.users.findOrCreateByOpenid(openid, () => ({
        wxOpenid: openid,
        wxUnionid: null,
        nickname: name,
        avatarUrl: null,
        utcOffsetMinutes: 480,
        source: 'stub-login',
      }));
      return toSession(user);
    },

    async currentUser(userId: string): Promise<SessionUser | null> {
      const u = await deps.repos.users.findById(userId);
      return u ? toSession(u) : null;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
