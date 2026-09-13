// 审核大类的展示文案。跟 packages/domain/src/moderation/words.ts 的 categoryLabel
// 一一对应，但客户端不依赖 domain（架构边界，见 arch/），所以单独维护一份——
// 跟 client 里其它展示映射（如各页面的 OCC/STATE_LABEL）同样的做法。
export const MODERATION_CATEGORY_LABEL: Record<string, string> = {
  politics: '涉政',
  sexual: '色情低俗',
  hate: '仇恨',
  fraud: '欺诈',
  illegal: '违法',
  solicitation: '拉客 / 敛财',
  contact_leak: '站外导流',
  spam: '垃圾信息',
  low_effort: '内容过于简陋',
};

export function moderationReasonText(categories: string[]): string {
  if (categories.length === 0) return '内容审核未通过';
  return categories.map((c) => MODERATION_CATEGORY_LABEL[c] ?? c).join(' / ');
}
