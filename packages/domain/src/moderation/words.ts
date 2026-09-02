// 原型用的极简词表。真实实现换成内容安全 API（阿里云 / 腾讯云 / 网易易盾）。
// 见 docs/research/2026-09-01-funds-ai-licensing.md 领域二。

import type { ModerationCategory } from '../types';

/** 命中即 violation 的大类词表（示意，非穷举） */
export const BANNED: Record<
  Exclude<ModerationCategory, 'religious_solicitation' | 'contact_leak' | 'malformed'>,
  string[]
> = {
  politics: ['颠覆国家', '反动标语'],
  sexual: ['色情内容', '裸聊'],
  hate: ['种族仇恨', '滚出这个国家'],
  fraud: ['刷单返利', '内部中奖', '转账验证金'],
  illegal: ['办假证', '出售枪支', '代开发票'],
};

/**
 * 宗教敛财护栏词 —— 命中至少 suspect（配置可升为 violation）。
 * 目的：让商户经营范围 / 内容不触碰"宗教服务收费"，规避微信支付结算冻结。
 */
export const RELIGIOUS_SOLICITATION_GUARD: string[] = [
  '代祷收费',
  '付费代祷',
  '超度收费',
  '收费超度',
  '消灾解厄',
  '花钱消灾',
  '开光转账',
  '宗教服务费',
  '功德箱转账',
];

/** 疑似联系方式导流 */
export const CONTACT_PATTERNS: RegExp[] = [
  /\b1[3-9]\d{9}\b/, // 手机号
  /(微信|weixin|wechat|vx|v信)[:：]?\s*[a-zA-Z0-9_-]{5,}/i,
  /\bqq[:：]?\s*\d{5,}/i,
  /(加|扫).{0,6}(二维码|群)/,
];
