// 音频回应的打分管线编排：转写 → 安全检查（复用 ModerationProvider）→ 完整性 /
// 专注度 / 真诚度 → 真人校验 → 汇总为多维标签。见 design.md「打分管线」一节。
//
// 音频回应不走 blessing-service.submit() 现成的"先落 body 再同步查 moderation"路径——
// 音频没有 body，要先转写才有文本可审。这里自己组一条 draftRecord，复用
// transitionAndPersist 走同一套状态机 + 投递逻辑，跟文本流程分叉点只在于
// "moderation.check 的输入从哪来"和"多一层内容质量打分"。

import {
  outcomeFor,
  scoreCompleteness,
  scoreFocus,
  transcriptContainsPhrase,
  type AudioSignals,
} from '@bestwishes/domain';
import { appError, err, ok, type Occasion, type Result } from '@bestwishes/shared';
import { AGREEMENT_VERSION, type AppDeps } from './deps';
import { transitionAndPersist } from './blessing-write';
import type { BlessingRecord } from '../ports/records';

export interface AudioChallengeView {
  phrase: string;
  token: string;
  expiresAt: string;
}

export interface SubmitAudioResponseInput {
  requestId: string;
  audio: Buffer;
  durationSec: number;
  occasion: Occasion;
  challengeToken: string;
  /** 客户端侧识别出的文本（如浏览器 Web Speech API）。见 AsrHint 的信任边界说明。 */
  clientTranscript?: string | undefined;
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

const LIVENESS_CHALLENGE_TTL_SECONDS = 300;

export function createAudioScoringService(deps: AppDeps) {
  return {
    /** 录音前下发一次性验证词，要求回应者在录音里说出来（挑战式真人校验）。 */
    issueLivenessChallenge(): AudioChallengeView {
      return deps.liveness.issue(deps.clock.now(), LIVENESS_CHALLENGE_TTL_SECONDS);
    },

    async submit(userId: string, input: SubmitAudioResponseInput): Promise<Result<SubmittedAudioResponse>> {
      const user = await deps.repos.users.findById(userId);
      if (!user) return err(appError('unauthorized', 'no session', '请先登录'));

      const consent = await deps.repos.consents.latestForVersion(userId, AGREEMENT_VERSION);
      if (!consent) {
        return err(appError('consent_required', 'no consent', '请先同意《用户内容与授权协议》'));
      }

      if (
        input.durationSec < deps.config.audioMinDurationSec ||
        input.durationSec > deps.config.audioMaxDurationSec
      ) {
        return err(
          appError(
            'validation_failed',
            'audio duration out of range',
            `录音时长要在 ${String(deps.config.audioMinDurationSec)}–${String(deps.config.audioMaxDurationSec)} 秒之间`,
          ),
        );
      }

      const request = await deps.repos.wishRequests.findById(input.requestId);
      if (!request || request.state !== 'published') {
        return err(appError('not_found', 'wish request not available', '这条请求现在不能回应了'));
      }
      if (request.authorId === userId) {
        return err(appError('validation_failed', 'cannot respond to own request', '不能回应自己的请求'));
      }

      const tokenCheck = deps.liveness.verify(input.challengeToken, deps.clock.now());
      if (!tokenCheck.ok) {
        return err(
          appError('validation_failed', `bad challenge token: ${tokenCheck.reason}`, '验证信息已过期，重新录一遍'),
        );
      }

      const now = deps.clock.now().toISOString();
      const audioId = deps.ids.next('aud');
      const audioUrl = await deps.audioStorage.save(audioId, input.audio);

      let draft: BlessingRecord = {
        id: deps.ids.next('bls'),
        authorId: userId,
        contentType: 'audio',
        body: '',
        media: { url: audioUrl, durationSec: input.durationSec, transcript: null },
        occasion: input.occasion,
        scope: 'wish_response',
        audience: { radiusKm: 0, ageMin: null, ageMax: null, gender: 'any', tags: [] },
        replyToUserId: null,
        replyToBlessingId: null,
        requestId: request.id,
        recipientIds: [request.authorId],
        state: 'draft',
        slug: deps.slugs.next(),
        createdAt: now,
        publishedAt: null,
        deliveredAt: null,
        expiresAt: null,
        moderation: null,
        renewCount: 0,
        countedInStreak: false,
        holdUntil: null,
        events: [],
      };

      const submitted = await transitionAndPersist(deps, draft, 'submit', { kind: 'author', userId }, '作者提交（音频回应）');
      if (!submitted.ok) return submitted;
      draft = submitted.value;

      // [1] 转写
      const asrResult = await deps.asr.transcribe(input.audio, input.durationSec, {
        clientTranscript: input.clientTranscript,
      });
      const transcript = asrResult.text;
      draft = { ...draft, body: transcript, media: { ...draft.media!, transcript } };
      await deps.repos.blessings.save(draft);

      // [1a] 安全检查——复用现成 ModerationProvider，同文本流程
      const moderation = await deps.moderation.check({ text: transcript, occasion: input.occasion });
      const outcome = outcomeFor(moderation);
      draft = { ...draft, moderation };
      await deps.repos.blessings.save(draft);

      if (outcome.trigger === 'auto_violation') {
        const rejected = await transitionAndPersist(
          deps,
          draft,
          'auto_violation',
          { kind: 'system' },
          `命中：${moderation.categories.join(',')}`,
        );
        if (rejected.ok) draft = rejected.value;
        // spec：命中 violation 不进入后续打分环节，不建 audio_scores 记录。
        return ok({ id: draft.id, state: draft.state });
      }

      // [2][3][4] 完整性 / 专注度 / 真诚度——跟"安不安全"是两回事，
      // suspect 也照样跑完，方便复核通过后请求人立刻能看到反馈。
      const completeness = scoreCompleteness(request.scriptText, transcript);
      const signals: AudioSignals = {
        durationSec: input.durationSec,
        silenceSegmentsSec: asrResult.silenceSegmentsSec,
        wordTimestamps: asrResult.wordTimestamps,
        transcript,
      };
      const focusResult = scoreFocus(signals, deps.config.focusScoring);
      const sincerityResult = await deps.sincerity.evaluate(transcript, request.situationText);

      // [5] 真人校验：验证词是否出现在转写里。不通过转人工复核，不直接驳回。
      const livenessPassed = transcriptContainsPhrase(transcript, tokenCheck.phrase);

      await deps.repos.audioScores.add({
        blessingId: draft.id,
        completeness,
        focus: focusResult.label,
        focusConfidence: focusResult.confidence,
        sincerity: sincerityResult.sincerity,
        sincerityConfidence: sincerityResult.sincerityConfidence,
        personalization: sincerityResult.personalization,
        livenessPassed,
        computedAt: deps.clock.now().toISOString(),
      });

      const needsHumanReview = outcome.createTicket || !livenessPassed;

      if (needsHumanReview) {
        await deps.repos.reports.add({
          id: deps.ids.next('rpt'),
          blessingId: draft.id,
          origin: 'auto_suspect',
          category: moderation.categories[0] ?? 'other',
          state: 'open',
          priority: 30,
          note: !livenessPassed ? '真人校验未通过（验证词缺失）' : outcome.note,
          assignee: null,
          resolutionReason: null,
          reporterFingerprint: null,
          count: 1,
          createdAt: now,
          resolvedAt: null,
          timeline: [{ at: now, text: '工单创建（auto_suspect）' }],
        });
      } else {
        const holdUntil = new Date(deps.clock.now().getTime() + deps.config.holdSeconds * 1000).toISOString();
        draft = { ...draft, holdUntil };
        await deps.repos.blessings.save(draft);
      }

      return ok({ id: draft.id, state: draft.state });
    },

    async myFeedback(userId: string, blessingId: string): Promise<Result<MyAudioFeedback | null>> {
      const b = await deps.repos.blessings.findById(blessingId);
      if (!b || b.authorId !== userId) {
        return err(appError('not_found', 'blessing not found', '找不到这条回应'));
      }
      const score = await deps.repos.audioScores.findByBlessingId(blessingId);
      if (!score) return ok(null); // 还没打完分（评估中）或命中 violation（没有反馈）
      return ok({
        completeness: score.completeness,
        focus: score.focus,
        sincerity: score.sincerity,
        personalization: score.personalization,
        livenessPassed: score.livenessPassed,
      });
    },
  };
}

export type AudioScoringService = ReturnType<typeof createAudioScoringService>;
