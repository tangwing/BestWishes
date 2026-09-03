// P1 的 HTTP 路由。handler 保持薄：解析 → 调 application → 映射结果。
// 业务逻辑都在 application 层，这里只做 HTTP 的事。

import { z, type ZodTypeAny } from 'zod';
import {
  audienceFilterSchema,
  draftSchema,
  occasionSchema,
  profileUpdateSchema,
  submitBlessingSchema,
  AppException,
  type Result,
} from '@bestwishes/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Application } from '../../application';
import { clearSession, getUserId, requireUserId, setSession } from './session';

function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new AppException('validation_failed', r.error.message, '提交的内容格式不对');
  }
  return r.data as z.output<S>;
}

function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new AppException(r.error.code, r.error.message, r.error.userHint);
  return r.value;
}

/** 举报人指纹：优先用一个长期 cookie，没有就按 IP + UA 拼一个。 */
function fingerprint(request: FastifyRequest): string {
  const fromCookie = request.cookies['bw_fp'];
  if (fromCookie) return fromCookie;
  return `ip:${request.ip}|ua:${(request.headers['user-agent'] ?? '').slice(0, 40)}`;
}

const reportCategorySchema = z.enum(['spam', 'offensive', 'harassment', 'illegal', 'other']);

export function registerRoutes(app: FastifyInstance, application: Application): void {
  // ---- auth ----
  app.post('/api/auth/stub-login', async (request, reply) => {
    const { nickname } = parse(z.object({ nickname: z.string().max(30) }), request.body);
    const user = await application.auth.loginWithStub(nickname);
    setSession(reply, user.id);
    return user;
  });

  app.post('/api/auth/logout', (_request, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  app.get('/api/me', async (request) => {
    const id = getUserId(request);
    if (!id) throw new AppException('unauthorized', 'no session', '请先登录');
    const user = await application.auth.currentUser(id);
    if (!user) throw new AppException('unauthorized', 'stale session', '请重新登录');
    return user;
  });

  // ---- profile ----
  app.get('/api/profile/me', async (request) => {
    const view = await application.profile.view(requireUserId(request));
    if (!view) throw new AppException('unauthorized', 'stale session');
    return view;
  });

  app.put('/api/profile/me', async (request) => {
    const patch = parse(profileUpdateSchema, request.body);
    const view = await application.profile.update(requireUserId(request), patch);
    if (!view) throw new AppException('unauthorized', 'stale session');
    return view;
  });

  app.get('/api/tags/suggested', () => ({ tags: application.profile.suggestedTags() }));

  app.post('/api/account/deletion', (request, reply) => {
    requireUserId(request);
    void reply.status(202);
    return { status: 'received', note: 'P1 阶段走人工流程，我们会按规定处理你的数据。' };
  });

  // ---- agreement / consent ----
  app.get('/api/agreement/current', async (request) =>
    application.consent.agreement(requireUserId(request)),
  );

  app.post('/api/consents', async (request) => {
    const input = parse(
      z.object({
        scopeDeliver: z.boolean(),
        scopeFeatured: z.boolean(),
        scopeSynthesis: z.boolean(),
      }),
      request.body,
    );
    unwrap(await application.consent.record(requireUserId(request), input));
    return { ok: true };
  });

  // ---- templates / drafts ----
  app.get('/api/templates', () => application.templates.list());

  app.get('/api/drafts/me', async (request) => {
    const d = await application.drafts.get(requireUserId(request));
    return { draft: d };
  });

  app.put('/api/drafts/me', async (request) => {
    const input = parse(draftSchema, request.body);
    await application.drafts.save(requireUserId(request), input);
    return { ok: true };
  });

  // ---- audience ----
  app.post('/api/audience/preview', async (request) => {
    const filter = parse(audienceFilterSchema, request.body);
    return unwrap(await application.audience.preview(requireUserId(request), filter));
  });

  // ---- blessings ----
  app.post('/api/blessings', async (request) => {
    const input = parse(submitBlessingSchema, request.body);
    return unwrap(await application.blessings.submit(requireUserId(request), input));
  });

  app.get('/api/records/outbox', async (request) =>
    application.blessings.outbox(requireUserId(request)),
  );

  // ---- inbox ----
  app.get('/api/inbox', async (request) => application.inbox.list(requireUserId(request)));
  app.post('/api/inbox/read', async (request) => {
    await application.inbox.markAllRead(requireUserId(request));
    return { ok: true };
  });

  // ---- notifications ----
  app.get('/api/notifications', async (request) =>
    application.notifications.list(requireUserId(request)),
  );
  app.post('/api/notifications/read', async (request) => {
    await application.notifications.markAllRead(requireUserId(request));
    return { ok: true };
  });

  const idParam = z.object({ id: z.string() });
  app.post('/api/blessings/:id/withdraw', async (request) => {
    const { id } = parse(idParam, request.params);
    return unwrap(await application.blessings.withdraw(requireUserId(request), id));
  });
  app.post('/api/blessings/:id/republish', async (request) => {
    const { id } = parse(idParam, request.params);
    return unwrap(await application.blessings.republish(requireUserId(request), id));
  });
  app.delete('/api/blessings/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    return unwrap(await application.blessings.delete(requireUserId(request), id));
  });
  app.post('/api/blessings/:id/renew', async (request) => {
    const { id } = parse(idParam, request.params);
    return unwrap(await application.blessings.renew(requireUserId(request), id));
  });

  // ---- streak / 回响 ----
  app.get('/api/streak/me', async (request) => {
    const view = await application.streak.view(requireUserId(request));
    if (!view) throw new AppException('unauthorized', 'stale session');
    return view;
  });

  // ---- public landing page 数据 (no session)。/p/:slug 本身是前端路由。 ----
  app.get('/api/p/:slug', async (request) => {
    const { slug } = parse(z.object({ slug: z.string() }), request.params);
    return application.blessings.getPublicPage(slug);
  });

  app.post('/api/p/:slug/report', async (request) => {
    const { slug } = parse(z.object({ slug: z.string() }), request.params);
    const { category, note } = parse(
      z.object({ category: reportCategorySchema, note: z.string().max(500).default('') }),
      request.body,
    );
    unwrap(await application.reports.report(slug, category, note, fingerprint(request)));
    return { ok: true };
  });

  // ---- moderation console (demo：任何会话都能进；真实按角色鉴权) ----
  app.get('/api/moderation/queue', async (request) => {
    requireUserId(request);
    return application.moderationQueue.queue();
  });

  app.post('/api/moderation/:reportId/resolve', async (request) => {
    const moderatorId = requireUserId(request);
    const { reportId } = parse(z.object({ reportId: z.string() }), request.params);
    const { action, reason } = parse(
      z.object({
        action: z.enum(['pass', 'takedown', 'request_edit']),
        reason: z.string().max(300).default('经人工复核'),
      }),
      request.body,
    );
    unwrap(await application.moderationQueue.resolve(reportId, action, reason, moderatorId));
    return { ok: true };
  });

  // 未使用但保留：occasion 列表给前端下拉（避免前端硬编码枚举漂移）
  app.get('/api/occasions', () => ({ occasions: occasionSchema.options }));
}
