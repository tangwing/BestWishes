// 极简词表 / 规则。真实实现换成内容安全 API（阿里云 / 腾讯云 / 网易易盾）。
// 见 docs/research/2026-09-01-funds-ai-licensing.md 领域二。
//
// P1 的审核目标：把无效 / 垃圾信息和明显违规内容挡在收件箱之外。
// 不追求对"祝福写得好不好"做判断——那是 P2 的 AI 用心反馈。

import type { ModerationCategory } from '../types';

/** 命中即 violation 的大类词表（示意，非穷举） */
export const BANNED: Record<'politics' | 'sexual' | 'hate' | 'fraud' | 'illegal', string[]> = {
  politics: ['颠覆国家', '反动标语'],
  sexual: ['色情内容', '裸聊', '约炮'],
  hate: ['种族仇恨', '滚出这个国家'],
  fraud: ['刷单返利', '内部中奖', '转账验证金', '杀猪盘', '博彩返水'],
  illegal: ['办假证', '出售枪支', '代开发票', '迷药出售'],
};

/**
 * 导流 / 拉客 / 敛财类的护栏词——命中至少 suspect（配置可升为 violation）。
 * 含："加微信收费""扫码付款""点链接领取"这类把陌生人往站外导的话术，
 * 以及"宗教服务收费"这类会触发微信支付结算冻结的表述。
 */
export const SOLICITATION_GUARD: string[] = [
  '代祷收费',
  '付费代祷',
  '超度收费',
  '收费超度',
  '花钱消灾',
  '宗教服务费',
  '功德箱转账',
  '加我微信',
  '加微信领',
  '私聊有偿',
  '扫码付款',
  '点击链接领取',
  '进群领红包',
];

/** 疑似联系方式 / 站外链接导流 */
export const CONTACT_PATTERNS: RegExp[] = [
  /\b1[3-9]\d{9}\b/, // 手机号
  /(微信|weixin|wechat|vx|v信|薇信)[:：]?\s*[a-zA-Z0-9_-]{5,}/i,
  /\bqq[:：]?\s*\d{5,}/i,
  /(加|扫).{0,6}(二维码|群)/,
  /(https?:\/\/|www\.)[^\s]+/i,
  /\b[a-z0-9-]{2,}\.(com|cn|net|top|xyz|shop|vip|link)\b/i,
];

/** 明显的无效内容：同一字符刷屏 / 全是标点 / 可辨识字符太少。 */
export function isLowEffort(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;
  const chars = Array.from(trimmed);
  const distinct = new Set(chars.filter((c) => !/\s/.test(c)));
  if (distinct.size <= 2 && chars.length >= 6) return true;
  const wordish = (trimmed.match(/[\p{Script=Han}a-zA-Z]/gu) ?? []).length;
  if (wordish === 0) return true;
  return false;
}

/** 疑似乱码：可辨识字符（汉字 / 字母 / 常见中文标点）占比过低。 */
export function looksGarbled(text: string): boolean {
  const chars = Array.from(text.trim());
  if (chars.length === 0) return true;
  const meaningful = (text.match(/[\p{Script=Han}a-zA-Z，。！？、；：（）,.!?~· ]/gu) ?? []).length;
  return meaningful / chars.length < 0.5;
}

export const categoryLabel: Record<ModerationCategory, string> = {
  politics: '涉政',
  sexual: '色情低俗',
  hate: '仇恨',
  fraud: '欺诈',
  illegal: '违法',
  solicitation: '拉客 / 敛财',
  contact_leak: '站外导流',
  spam: '垃圾信息',
  low_effort: '无效内容',
};
