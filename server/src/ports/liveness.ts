// 挑战式真人校验的端口。具体实现（HMAC 签名）在 infrastructure/audio/，
// application 层只认这个接口——同 Clock / IdGenerator 的既有模式。

export interface LivenessChallenge {
  phrase: string;
  token: string;
  expiresAt: string;
}

export type VerifyLivenessResult =
  | { ok: true; phrase: string }
  | { ok: false; reason: string };

export interface LivenessChallengePort {
  issue(now: Date, ttlSeconds: number): LivenessChallenge;
  verify(token: string, now: Date): VerifyLivenessResult;
}
