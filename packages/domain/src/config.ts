// 运营可调配置。use-cases.md 里标"待定"的数值都在这里，定了改这里即可。

/** 专注度打分的权重与阈值（可解释信号工程，不是模型黑盒——见 add-p2-wish-request-audio design.md）。 */
export interface FocusScoringConfig {
  /** 停顿超过这个时长（秒）算"异常长停顿"。 */
  longPauseThresholdSec: number;
  /** 每一次异常长停顿扣多少分（满分 100）。 */
  longPauseWeight: number;
  /** 语速方差每单位扣多少分。 */
  speechRateVarianceWeight: number;
  /** 犹豫词密度（0-1）每一个百分点扣多少分。 */
  fillerWordWeight: number;
  /** 综合分 >= 这个值 -> "高"。 */
  highThreshold: number;
  /** 综合分 >= 这个值（且 < highThreshold）-> "中"；否则 "低"。 */
  mediumThreshold: number;
}

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
  /** 一次群发允许命中的最大陌生人数。超过则拒绝，要求缩小范围。测试期取小值。 */
  maxAudienceSize: number;
  /** 受众半径允许的最大值（公里） */
  audienceMaxRadiusKm: number;
  /** 受众半径允许的最小值（公里） */
  audienceMinRadiusKm: number;
  /** 音频回应最短时长（秒）——太短大概率是误触。 */
  audioMinDurationSec: number;
  /** 音频回应最长时长（秒）。 */
  audioMaxDurationSec: number;
  /** 音频打分管线的超时上限（秒）——超时转人工复核，不无限期挂起。 */
  audioScoringTimeoutSeconds: number;
  /** 专注度打分的权重与阈值。 */
  focusScoring: FocusScoringConfig;
}

export const DEFAULT_CONFIG: P1Config = {
  featuredDefaultOn: true,
  bodyMinLen: 5,
  bodyMaxLen: 500,
  linkTtlDays: 120,
  holdSeconds: 180,
  holdTimeoutHours: 24,
  spotCheckRatio: 0.05,
  publicInvalidationSeconds: 60,
  maxAudienceSize: 10,
  audienceMaxRadiusKm: 50,
  audienceMinRadiusKm: 0.2,
  audioMinDurationSec: 5,
  audioMaxDurationSec: 180,
  audioScoringTimeoutSeconds: 60,
  focusScoring: {
    longPauseThresholdSec: 3,
    longPauseWeight: 8,
    speechRateVarianceWeight: 15,
    fillerWordWeight: 40,
    highThreshold: 80,
    mediumThreshold: 55,
  },
};
