// 跨边界的 Zod schema。所有从外部进来的数据（HTTP body、外部 API 响应）
// 在进 application 层之前用这些校验并转成领域类型。

import { z } from 'zod';

export const occasionSchema = z.enum([
  'birthday',
  'festival',
  'encouragement',
  'recovery',
  'remembrance',
  'daily',
]);
export type Occasion = z.infer<typeof occasionSchema>;

/** 发送者信息。给谁必填；落款和城市默认取个人空间，写入时已合并进来。 */
export const personalizationSchema = z.object({
  toName: z.string().trim().min(1).max(30),
  fromName: z.string().trim().max(30).optional(),
  fromCity: z.string().trim().max(30).optional(),
});
export type PersonalizationDto = z.infer<typeof personalizationSchema>;

export const submitBlessingSchema = z.object({
  body: z.string(),
  occasion: occasionSchema,
  personalization: personalizationSchema,
});
export type SubmitBlessingDto = z.infer<typeof submitBlessingSchema>;

/** 个人空间。城市粒度只到城市 / 省级——长度上限就是最直接的粗过滤。 */
export const profileUpdateSchema = z.object({
  senderName: z.string().trim().max(30).optional(),
  regionCity: z.string().trim().max(30).optional(),
  locationGranted: z.boolean().optional(),
  featuredByDefault: z.boolean().optional(),
});
export type ProfileUpdateDto = z.infer<typeof profileUpdateSchema>;
