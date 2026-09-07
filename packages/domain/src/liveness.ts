// 挑战式真人校验里"转写文本是否包含验证词"的纯判定。签发 / 校验 token 需要
// HMAC（node:crypto），那部分是 server 基础设施；这一步只是字符串包含判断，
// 纯函数、可单测，属于领域逻辑。

export function transcriptContainsPhrase(transcript: string, phrase: string): boolean {
  return transcript.includes(phrase);
}
