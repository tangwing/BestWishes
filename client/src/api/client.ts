// 唯一和后端说话的地方。组件不直接 fetch。
// 响应用 @bestwishes/shared 的 schema 校验（前端做即时校验，后端做权威校验）。

import type { Occasion } from '@bestwishes/shared';

export interface ApiError {
  error: string;
  message: string;
}

export class ApiCallError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiCallError';
    this.code = code;
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin' };
  if (body !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiError>;
    throw new ApiCallError(e.error ?? 'internal', e.message ?? '请求失败');
  }
  return data as T;
}

export interface SessionUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}
export interface ProfileView {
  senderName: string;
  regionCity: string;
  locationGranted: boolean;
  featuredByDefault: boolean;
}
export interface AgreementView {
  version: string;
  featuredDefaultChecked: boolean;
}
export interface Template {
  id: string;
  category: Occasion;
  title: string;
  promptText: string;
  sampleText: string;
}
export interface Personalization {
  toName: string;
  fromName?: string;
  fromCity?: string;
}
export interface Submitted {
  id: string;
  slug: string;
  state: string;
}
export interface OutboxItem {
  id: string;
  slug: string;
  state: string;
  occasion: Occasion;
  toName: string;
  bodyPreview: string;
  renewCount: number;
  createdAt: string;
}
export type PublicPage =
  | {
      type: 'content';
      content: {
        body: string;
        fromLine: string;
        toName: string;
        occasion: Occasion;
        publishedAt: string;
      };
    }
  | {
      type: 'preparing' | 'withdrawn' | 'taken_down' | 'expired' | 'not_found';
      placeholderText: string;
    };
export interface StreakView {
  total: number;
  streak: number;
  byDay: { date: string; count: number }[];
}
export interface QueueItem {
  id: string;
  origin: string;
  category: string;
  priority: number;
  count: number;
  note: string | null;
  createdAt: string;
  blessing: { id: string; state: string; body: string } | null;
}

export const api = {
  me: () => call<SessionUser>('GET', '/api/me'),
  stubLogin: (nickname: string) => call<SessionUser>('POST', '/api/auth/stub-login', { nickname }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout'),

  profile: () => call<ProfileView>('GET', '/api/profile/me'),
  saveProfile: (patch: Partial<ProfileView>) => call<ProfileView>('PUT', '/api/profile/me', patch),

  agreement: () => call<AgreementView>('GET', '/api/agreement/current'),
  recordConsent: (scopes: {
    scopeDeliver: boolean;
    scopeFeatured: boolean;
    scopeSynthesis: boolean;
  }) => call<{ ok: true }>('POST', '/api/consents', scopes),

  templates: () => call<Template[]>('GET', '/api/templates'),
  getDraft: () =>
    call<{ draft: { body: string; occasion: Occasion; personalization: Personalization } | null }>(
      'GET',
      '/api/drafts/me',
    ),
  saveDraft: (d: { body: string; occasion: Occasion; personalization: Personalization }) =>
    call<{ ok: true }>('PUT', '/api/drafts/me', d),

  submit: (d: { body: string; occasion: Occasion; personalization: Personalization }) =>
    call<Submitted>('POST', '/api/blessings', d),
  outbox: () => call<OutboxItem[]>('GET', '/api/records/outbox'),
  inbox: () => call<{ items: never[]; note: string }>('GET', '/api/records/inbox'),
  withdraw: (id: string) => call<{ state: string }>('POST', `/api/blessings/${id}/withdraw`),
  republish: (id: string) => call<{ state: string }>('POST', `/api/blessings/${id}/republish`),
  remove: (id: string) => call<{ state: string }>('DELETE', `/api/blessings/${id}`),
  renew: (id: string) => call<{ state: string }>('POST', `/api/blessings/${id}/renew`),

  publicPage: (slug: string) => call<PublicPage>('GET', `/api/p/${slug}`),
  report: (slug: string, category: string, note: string) =>
    call<{ ok: true }>('POST', `/api/p/${slug}/report`, { category, note }),

  streak: () => call<StreakView>('GET', '/api/streak/me'),

  queue: () => call<QueueItem[]>('GET', '/api/moderation/queue'),
  resolve: (id: string, action: string, reason: string) =>
    call<{ ok: true }>('POST', `/api/moderation/${id}/resolve`, { action, reason }),
};
