// 审核结论 → 祝福状态机的映射。对应 specs/content-moderation「自动检查的三档判定」。

import type { LifecycleTrigger, ModerationResult } from '../types';

export interface ModerationOutcome {
  /** 对 verifying 祝福施加的触发；null 表示保持 verifying */
  trigger: LifecycleTrigger | null;
  /** 是否需要建人工复核工单 */
  createTicket: boolean;
  ticketOrigin?: 'auto_suspect';
  note: string;
}

export function outcomeFor(result: ModerationResult): ModerationOutcome {
  if (result.unavailable) {
    return {
      trigger: null,
      createTicket: true,
      ticketOrigin: 'auto_suspect',
      note: '审核服务不可用，保守处理：维持 hold 并进入人工队列',
    };
  }
  switch (result.verdict) {
    case 'pass':
      return { trigger: 'auto_pass', createTicket: false, note: '自动通过' };
    case 'violation':
      return { trigger: 'auto_violation', createTicket: false, note: '自动判定违规' };
    case 'suspect':
      return {
        trigger: null,
        createTicket: true,
        ticketOrigin: 'auto_suspect',
        note: '疑似，保持 verifying 并进入人工队列',
      };
  }
}

/** 随机抽检是否命中（调用方传入 [0,1) 随机数以便测试确定性）。 */
export function isSpotChecked(ratio: number, roll: number): boolean {
  return roll < ratio;
}
