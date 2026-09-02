// 运营可调配置。use-cases.md 里标"待定"的数值都在这里，定了改这里即可。

export interface P1Config {
  /** 《授权协议》"精选展示"默认是否开启。合规待法务确认（ADR-M）——所以是配置不是硬编码。 */
  featuredDefaultOn: boolean;
  /** 祝福正文字数下限 */
  bodyMinLen: number;
  /** 祝福正文字数上限 */
  bodyMaxLen: number;
  /** 分享链接有效期（天） */
  linkTtlDays: number;
  /** 自动通过后，接收方可见前的正常 hold 时长（秒）。演示环境会调很短。 */
  holdSeconds: number;
  /** 校验 hold 上限（小时），超时升级 */
  holdTimeoutHours: number;
  /** 已通过内容的随机抽检比例 [0,1] */
  spotCheckRatio: number;
  /** 撤回 / 过期 / 下架后落地页停止返回正文的时限（秒），仅作说明 */
  publicInvalidationSeconds: number;
}

export const DEFAULT_CONFIG: P1Config = {
  featuredDefaultOn: true,
  bodyMinLen: 15,
  bodyMaxLen: 500,
  linkTtlDays: 120,
  holdSeconds: 180,
  holdTimeoutHours: 24,
  spotCheckRatio: 0.05,
  publicInvalidationSeconds: 60,
};
