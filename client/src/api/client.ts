// 唯一和后端说话的地方。组件不直接 fetch。

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

export type Gender = 'male' | 'female' | 'other';
export type AudienceGender = Gender | 'any';

export interface SessionUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface ProfileView {
  senderName: string;
  regionCity: string;
  lat: number | null;
  lng: number | null;
  gender: Gender | null;
  birthYear: number | null;
  tags: string[];
  locationGranted: boolean;
  featuredByDefault: boolean;
  canBroadcast: boolean;
}

export interface AgreementView {
  version: string;
  featuredDefaultChecked: boolean;
  alreadyConsented: boolean;
}

export interface Template {
  id: string;
  category: Occasion;
  title: string;
  promptText: string;
  sampleText: string;
}

export interface AudienceFilter {
  radiusKm: number;
  ageMin: number | null;
  ageMax: number | null;
  gender: AudienceGender;
  tags: string[];
}

export interface AudiencePreview {
  count: number;
  cap: number;
  canSend: boolean;
  sample: {
    nickname: string;
    city: string | null;
    distanceKm: number;
    gender: Gender | null;
    age: number | null;
  }[];
}

export interface Submitted {
  id: string;
  slug: string;
  state: string;
  recipientCount: number;
}

export interface OutboxItem {
  id: string;
  slug: string;
  state: string;
  occasion: Occasion;
  scope: 'broadcast' | 'reply';
  recipientCount: number;
  bodyPreview: string;
  /** 完整正文，用于「复制以供编辑」——只回给作者本人，不受 bodyPreview 的截断限制。 */
  body: string;
  renewCount: number;
  createdAt: string;
}

export type BlessingStatus =
  'content' | 'preparing' | 'withdrawn' | 'taken_down' | 'expired' | 'not_found';

export interface InboxItem {
  id: string;
  blessingId: string;
  occasion: Occasion;
  contentType: 'text' | 'audio' | 'video';
  from: { userId: string; nickname: string; city: string | null; distanceKm: number | null };
  deliveredAt: string;
  read: boolean;
  status: BlessingStatus;
  body: string | null;
  placeholderText: string | null;
  canReply: boolean;
  inReplyTo: { blessingId: string; bodyPreview: string } | null;
}

export interface NotificationItem {
  id: string;
  kind: string;
  blessingId: string | null;
  requestId: string | null;
  from: { userId: string; nickname: string };
  createdAt: string;
  read: boolean;
}

export type PublicPage =
  | {
      type: 'content';
      content: {
        body: string;
        contentType: 'text' | 'audio' | 'video';
        fromLine: string;
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

export interface SubmitBlessingInput {
  contentType: 'text';
  body: string;
  occasion: Occasion;
  scope: 'broadcast' | 'reply';
  replyToUserId?: string;
  replyToBlessingId?: string;
  audience?: AudienceFilter;
}

export interface WishRequestView {
  id: string;
  authorId: string;
  authorNickname: string;
  situationText: string;
  scriptText: string | null;
  tags: string[];
  state: string;
  createdAt: string;
}

export interface ResponseSummary {
  id: string;
  fromNickname: string;
  fromCity: string | null;
  audioUrl: string | null;
  createdAt: string;
}

export interface AudioChallenge {
  phrase: string;
  token: string;
  expiresAt: string;
}

export interface SubmittedAudioResponse {
  id: string;
  state: string;
}

export interface MyAudioFeedback {
  completeness: string;
  focus: string;
  sincerity: string;
  personalization: string;
  livenessPassed: boolean;
}

export const api = {
  me: () => call<SessionUser>('GET', '/api/me'),
  stubLogin: (nickname: string) => call<SessionUser>('POST', '/api/auth/stub-login', { nickname }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout'),

  profile: () => call<ProfileView>('GET', '/api/profile/me'),
  saveProfile: (patch: Partial<ProfileView>) => call<ProfileView>('PUT', '/api/profile/me', patch),
  suggestedTags: () => call<{ tags: string[] }>('GET', '/api/tags/suggested'),

  agreement: () => call<AgreementView>('GET', '/api/agreement/current'),
  recordConsent: (scopes: {
    scopeDeliver: boolean;
    scopeFeatured: boolean;
    scopeSynthesis: boolean;
  }) => call<{ ok: true }>('POST', '/api/consents', scopes),

  templates: () => call<Template[]>('GET', '/api/templates'),
  getDraft: () =>
    call<{ draft: { body: string; occasion: Occasion; audience: AudienceFilter | null } | null }>(
      'GET',
      '/api/drafts/me',
    ),
  saveDraft: (d: { body: string; occasion: Occasion; audience?: AudienceFilter }) =>
    call<{ ok: true }>('PUT', '/api/drafts/me', d),

  audiencePreview: (filter: AudienceFilter) =>
    call<AudiencePreview>('POST', '/api/audience/preview', filter),

  submit: (d: SubmitBlessingInput) => call<Submitted>('POST', '/api/blessings', d),
  outbox: () => call<OutboxItem[]>('GET', '/api/records/outbox'),

  inbox: () => call<InboxItem[]>('GET', '/api/inbox'),
  markInboxRead: () => call<{ ok: true }>('POST', '/api/inbox/read'),

  notifications: () =>
    call<{ items: NotificationItem[]; unread: number }>('GET', '/api/notifications'),
  markNotificationsRead: () => call<{ ok: true }>('POST', '/api/notifications/read'),

  withdraw: (id: string) => call<{ state: string }>('POST', `/api/blessings/${id}/withdraw`),
  remove: (id: string) => call<{ state: string }>('DELETE', `/api/blessings/${id}`),
  renew: (id: string) => call<{ state: string }>('POST', `/api/blessings/${id}/renew`),

  publicPage: (slug: string) => call<PublicPage>('GET', `/api/p/${slug}`),
  report: (slug: string, category: string, note: string) =>
    call<{ ok: true }>('POST', `/api/p/${slug}/report`, { category, note }),

  streak: () => call<StreakView>('GET', '/api/streak/me'),

  queue: () => call<QueueItem[]>('GET', '/api/moderation/queue'),
  resolve: (id: string, action: string, reason: string) =>
    call<{ ok: true }>('POST', `/api/moderation/${id}/resolve`, { action, reason }),

  // ---- 祝福请求 + 音频回应 ----
  publishWishRequest: (input: { situationText: string; scriptText?: string | undefined; tags: string[] }) =>
    call<WishRequestView>('POST', '/api/wish-requests', input),
  wishRequestPlaza: () => call<WishRequestView[]>('GET', '/api/wish-requests'),
  myWishRequests: () => call<WishRequestView[]>('GET', '/api/wish-requests/mine'),
  getWishRequest: (id: string) => call<WishRequestView>('GET', `/api/wish-requests/${id}`),
  withdrawWishRequest: (id: string) =>
    call<{ ok: true }>('POST', `/api/wish-requests/${id}/withdraw`),
  deleteWishRequest: (id: string) => call<{ ok: true }>('DELETE', `/api/wish-requests/${id}`),
  wishRequestResponses: (id: string) =>
    call<ResponseSummary[]>('GET', `/api/wish-requests/${id}/responses`),

  issueAudioChallenge: () => call<AudioChallenge>('GET', '/api/audio-challenge'),

  /** 音频回应用真正的 multipart 上传，不走 JSON 的 call()。 */
  async respondToWishRequest(
    requestId: string,
    input: {
      audio: Blob;
      durationSec: number;
      occasion: Occasion;
      challengeToken: string;
      clientTranscript?: string | undefined;
    },
  ): Promise<SubmittedAudioResponse> {
    const form = new FormData();
    form.append('audio', input.audio, 'response.webm');
    form.append('durationSec', String(input.durationSec));
    form.append('occasion', input.occasion);
    form.append('challengeToken', input.challengeToken);
    if (input.clientTranscript) form.append('clientTranscript', input.clientTranscript);

    const res = await fetch(`/api/wish-requests/${requestId}/respond`, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
    const text = await res.text();
    const data: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const e = (data ?? {}) as Partial<ApiError>;
      throw new ApiCallError(e.error ?? 'internal', e.message ?? '提交失败');
    }
    return data as SubmittedAudioResponse;
  },

  audioFeedback: (blessingId: string) =>
    call<MyAudioFeedback | null>('GET', `/api/blessings/${blessingId}/audio-feedback`),
};
