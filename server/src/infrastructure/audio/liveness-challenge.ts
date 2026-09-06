// 挑战式真人校验：录音前下发一个随机数字串，要求回应者在录音里说出来。
// 用 HMAC 签名做无状态校验（不需要额外一张表存"发出去的挑战"）——
// token 里带着短语、过期时间和签名，服务端重新算一遍签名比对即可。
// 这是 MVP 方案，不是声纹/深伪检测：见 design.md「为什么不现在做声纹/深伪检测」。

import { createHmac, randomInt } from 'node:crypto';

export interface LivenessChallenge {
  phrase: string;
  token: string;
  expiresAt: string;
}

// 用 "|" 拼接字段——ISO 时间戳本身带冒号，用 ":" 当分隔符会切错段。
function sign(secret: string, phrase: string, expiresAt: string): string {
  return createHmac('sha256', secret).update(`${phrase}|${expiresAt}`).digest('hex');
}

export function issueChallenge(secret: string, now: Date, ttlSeconds: number): LivenessChallenge {
  const phrase = String(randomInt(100, 1000)); // 三位数字，够短、口语化
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const sig = sign(secret, phrase, expiresAt);
  const token = Buffer.from(`${phrase}|${expiresAt}|${sig}`).toString('base64url');
  return { phrase, token, expiresAt };
}

export type VerifyChallengeResult =
  | { ok: true; phrase: string }
  | { ok: false; reason: 'malformed' | 'expired' | 'bad_signature' };

export function verifyChallengeToken(
  secret: string,
  token: string,
  now: Date,
): VerifyChallengeResult {
  let decoded: string;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const parts = decoded.split('|');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [phrase, expiresAt, sig] = parts;
  if (!phrase || !expiresAt || !sig) return { ok: false, reason: 'malformed' };
  if (new Date(expiresAt).getTime() < now.getTime()) return { ok: false, reason: 'expired' };
  if (sign(secret, phrase, expiresAt) !== sig) return { ok: false, reason: 'bad_signature' };
  return { ok: true, phrase };
}

/** 转写文本里是否出现了验证词——不要求精确位置（转写词级时间戳的对齐精度有限），
 * 只要求出现，配合"整体录音时长有上下限"已经能挡住大部分随手复用的情况。 */
export function transcriptContainsPhrase(transcript: string, phrase: string): boolean {
  return transcript.includes(phrase);
}
