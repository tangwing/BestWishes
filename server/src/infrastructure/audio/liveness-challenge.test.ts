import { describe, it, expect } from 'vitest';
import { issueChallenge, verifyChallengeToken } from './liveness-challenge';

const SECRET = 'test-secret';

describe('issueChallenge / verifyChallengeToken', () => {
  it('刚发的 token 校验通过，拿回同一个短语', () => {
    const now = new Date('2026-09-06T00:00:00Z');
    const challenge = issueChallenge(SECRET, now, 300);
    const r = verifyChallengeToken(SECRET, challenge.token, now);
    expect(r).toEqual({ ok: true, phrase: challenge.phrase });
  });

  it('过期的 token 校验失败', () => {
    const issuedAt = new Date('2026-09-06T00:00:00Z');
    const challenge = issueChallenge(SECRET, issuedAt, 60);
    const later = new Date('2026-09-06T00:05:00Z');
    const r = verifyChallengeToken(SECRET, challenge.token, later);
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('用错误的密钥签发的 token 校验失败（签名不对）', () => {
    const now = new Date('2026-09-06T00:00:00Z');
    const challenge = issueChallenge('other-secret', now, 300);
    const r = verifyChallengeToken(SECRET, challenge.token, now);
    expect(r.ok).toBe(false);
  });

  it('乱传的 token 校验失败（格式不对）', () => {
    const r = verifyChallengeToken(SECRET, 'not-a-real-token', new Date());
    expect(r.ok).toBe(false);
  });

  it('短语是三位数字', () => {
    const challenge = issueChallenge(SECRET, new Date(), 300);
    expect(challenge.phrase).toMatch(/^\d{3}$/);
  });
});
