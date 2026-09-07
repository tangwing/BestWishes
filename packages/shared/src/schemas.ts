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

export const genderSchema = z.enum(['male', 'female', 'other']);
export const audienceGenderSchema = z.enum(['male', 'female', 'other', 'any']);

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPointDto = z.infer<typeof geoPointSchema>;

/** 受众筛选条件。radiusKm 必填；年龄 / 性别 / 标签可不限。 */
export const audienceFilterSchema = z.object({
  radiusKm: z.number().positive().max(200),
  ageMin: z.number().int().min(0).max(120).nullable().default(null),
  ageMax: z.number().int().min(0).max(120).nullable().default(null),
  gender: audienceGenderSchema.default('any'),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
});
export type AudienceFilterDto = z.infer<typeof audienceFilterSchema>;

/** 个人空间。城市粒度只到城市 / 省级；位置存经纬度，用于受众距离筛选。 */
export const profileUpdateSchema = z.object({
  senderName: z.string().trim().max(30).optional(),
  regionCity: z.string().trim().max(30).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  gender: genderSchema.nullable().optional(),
  birthYear: z.number().int().min(1900).max(2020).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(12).optional(),
  locationGranted: z.boolean().optional(),
  featuredByDefault: z.boolean().optional(),
});
export type ProfileUpdateDto = z.infer<typeof profileUpdateSchema>;

export const blessingContentTypeSchema = z.enum(['text', 'audio', 'video']);
export const blessingScopeSchema = z.enum(['broadcast', 'reply', 'wish_response']);

export const submitBlessingSchema = z.object({
  contentType: blessingContentTypeSchema.default('text'),
  body: z.string(),
  occasion: occasionSchema,
  scope: blessingScopeSchema.default('broadcast'),
  replyToUserId: z.string().min(1).optional(),
  /** 被回复的原始祝福 id，用于把回信关联回去。找不到 / 不是该收件人的祝福时后端会忽略。 */
  replyToBlessingId: z.string().min(1).optional(),
  /** scope=wish_response 时，回应的那条祝福请求 id。找不到 / 请求已不存在时后端会拒绝。 */
  requestId: z.string().min(1).optional(),
  /** broadcast 必填；reply / wish_response 忽略。 */
  audience: audienceFilterSchema.optional(),
});
export type SubmitBlessingDto = z.infer<typeof submitBlessingSchema>;

export const draftSchema = z.object({
  body: z.string(),
  occasion: occasionSchema,
  audience: audienceFilterSchema.optional(),
});
export type DraftDto = z.infer<typeof draftSchema>;

/** 祝福请求：处境描述 + 可选稿子 + 可选标签（供 wish-request-matching 按标签推荐候选响应人）。
 * 字数约束与祝福正文一致，运行时用同一套 bodyMinLen/MaxLen 配置校验。 */
export const submitWishRequestSchema = z.object({
  situationText: z.string(),
  scriptText: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
});
export type SubmitWishRequestDto = z.infer<typeof submitWishRequestSchema>;
