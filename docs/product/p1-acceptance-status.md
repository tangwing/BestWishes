# P1 验收状态（对照走查原型）

> 生成于 2026-09-02 夜间自主工作。对照 [use-cases.md](use-cases.md) 的 P1 验收标准，逐条标注在 [../../prototype/](../../prototype/) 里的实现状态。
> 图例：✅ 原型已实现且有自动化测试　🟡 原型部分/简化实现　⬜ 需生产实现（server / DB / 真实微信 / 真实审核 API）　❓ 需你评审拍板

## 一句话结论

P1 的**领域规则**（祝福状态机、发布即校验/延迟送达、可见性投影、坚持记录及其回撤、审核三档判定、举报合并与高危下架、链接过期与续期）已在原型里实现并被 **101 个自动化测试**覆盖，全绿。**外部依赖**（微信授权、真实内容安全 API、PostgreSQL、生产部署）按 ADR 0003 做成了可替换接口，原型用 stub/规则实现，未打通真实第三方——这部分无法在无账号的情况下自验，留给 apply 阶段。

## 逐用例

### P1-UC-01 微信登录 / 注册
- ✅ 同一身份只对应一个账户、回调重试幂等 —— `prototype/src/store/repo.test.ts`「未同意协议不能提交」等用例经由 `loginStub` 幂等；`repo.ts loginStub` 以昵称+城市查重（真实版按 openid）
- ✅ 拒绝昵称/头像仍可建号 —— `Home.tsx` 昵称留空即占位名
- ✅ 未登录访客能看落地页、不能进创作 —— `smoke.test.tsx`「未知 slug」「校验中只显示占位」；`Compose.tsx` useEffect 拦截
- ⬜ 真实微信网页授权（OAuth2 + JS-SDK）、openid/unionid —— 接口位 `GET /api/auth/wx/*`（架构 §8），原型是 `loginStub`

### P1-UC-02 同意《用户内容与授权协议》
- ✅ 必选项拒绝则不放行、逐项留痕、精选展示开关 —— `Agreement.tsx` + `repo.recordConsent`；`repo.test.ts`「未同意协议不能提交」
- ✅ 精选展示默认值可配置（默认开 ↔ opt-in）—— `config.featuredDefaultOn`，`content-agreement` spec 有对应 scenario；App 顶部走查工具可切换
- 🟡 协议改版重新确认 —— 数据结构支持（`agreementVersion`），UI 未做改版弹层
- ❓ 「精选展示默认开」的合规性 —— 待法务；`docs` 已标注 PIPL 风险

### P1-UC-03 范本库 / 自由创作
- ✅ 每类≥3 条、id 唯一、护栏词校验（"代祷收费"被拒）—— `prototype/src/store/seed.test.ts`
- ✅ 加载失败回退自由创作 —— `Compose.tsx` `templatesFailed` 分支
- ✅ 范本可编辑、不影响原范本 —— `Compose.tsx` 用 `setBody(t.sample)` 拷贝

### P1-UC-04 撰写 + 个性化信息
- ✅ 正文+称呼必填、字数上下限 —— `repo.validateBody` + `repo.submitBlessing`；`repo.test.ts`「正文过短」「缺少称呼」
- ✅ 个性化字段与正文分开存储 —— `Blessing.personalization` 独立 jsonb（`types.ts`）
- ✅ 城市粒度不超过城市级 —— 输入为自由文本城市名，无定位采集
- ✅ 静心引导、无计时无评分 —— `Compose.tsx` 呼吸动效 + "不必赶"文案；`blessing-authoring` spec scenario

### P1-UC-05 草稿
- ✅ 自动保存、不触发审核、不生成链接、可恢复、发布后清理 —— `repo.saveDraft` / `clearDraft`；`repo.test.ts`「草稿不生成链接、不进审核」
- ✅ 不对他人可见 —— 按 userId 存取

### P1-UC-06 自动内容合规检查（发布即校验、延迟送达）
- ✅ 作者"已发送"与接收方"可见"是两个独立状态 —— `repo.submitBlessing` 立即返回 slug + `verifying`；`reconcile` 到点转 `published`
- ✅ 校验期访客看占位、不返回正文 —— `getPublicPage` 用 `placeholderType`，非 content 只返回枚举 + 占位文案；`smoke.test.tsx` 断言无正文
- ✅ pass→送达 / suspect→保持校验+进队列 / violation→驳回 —— `moderation/apply.ts` + `repo`；`repo.test.ts` 三个端到端用例
- ✅ 审核服务不可用→保守（维持 hold + 进队列，不放行）—— `UnavailableProvider` + `repo.test.ts`
- ✅ 留痕（档位、命中大类、hold 时长）—— `Blessing.moderation` + `blessing_events`
- 🟡 hold 超时升级 —— `reconcile` 打标记 + 事件，未接通知渠道
- ⬜ 真实内容安全 API —— `ModerationProvider` 接口已定义，`CloudProvider` 待实现

### P1-UC-07 生成可分享卡片 / 落地页
- ✅ 链接立即可分享、按状态渲染、非微信浏览器可开 —— `Sent.tsx` / `PublicPage.tsx`（普通 Web 页）
- ✅ 不暴露 openid / 精确位置 / 手机号 —— `getPublicPage` 只回城市+昵称
- ✅ 取消精选展示则页面无收录标识 —— 无收录 UI（P1 本就没有精选栏目）
- ✅ 链接有效期 + 作者可续期 —— `config.linkTtlDays`、`renew`；`repo.test.ts`「到期→续期」
- ✅ 无 AI 生成标识、有"内容由用户创作"位 —— `PublicPage.tsx`

### P1-UC-08 微信分享
- 🟡 调起微信分享 —— `Sent.tsx` 有按钮位，真实版接 JS-SDK；复制链接兜底已实现
- ✅ 同一祝福多次分享指向同一稳定链接 —— slug 固定
- ✅ 访客点击直达查看页、无需注册 —— hash 路由 `/p/:slug` 无登录墙

### P1-UC-09 访客查看
- ✅ 无登录墙、按状态渲染（正文/准备中/已收回/已下架/已过期/未找到）—— `visibility.ts` + `PublicPage.tsx`；`visibility.test.ts` 16 用例
- ✅ 撤回/过期/下架后不再返回正文 —— `getPublicPage` 每次实时判定；`repo.test.ts`「撤回后访客看到已被收回」
- ✅ 占位文案中性、不泄露原文、不报技术错误 —— `PLACEHOLDER_TEXT`
- 🟡 "60 秒内失效" —— 原型即时失效（无缓存层）；生产需覆盖 CDN/边缘缓存策略

### P1-UC-10 访客一键致意
- ⬜ 不进 P1（已决定，移至 P4）

### P1-UC-11 作者管理（撤回 / 取消 / 重新发布 / 删除 / 续期）
- ✅ 撤回即时可逆、删除二次确认+不可逆+冻结、删除后不在列表 —— `MyBlessings.tsx` + `repo`；`repo.test.ts`「删除后不在作者列表」
- ✅ **校验期可取消**（`verifying → withdrawn`，清除待发布定时）—— `repo.withdraw`；`repo.test.ts`「校验期作者可取消」
- ✅ 重新发布重新走校验 —— `repo.republish` 重新跑审核 + `holdStartedAt`
- ✅ 撤回/删除/下架回撤坚持记录计数；**链接过期不回撤** —— `repo.test.ts`「撤回后坚持记录回撤」「链接过期不回撤」
- ✅ "已分发副本无法追回"告知 —— `MyBlessings.tsx` 删除 confirm 文案

### P1-UC-12 坚持记录
- ✅ 按作者所在地区自然日、仅本人可见、不转积分/等级 —— `streak.ts` + `Streak.tsx`；`streak.test.ts` 12 用例（含跨时区）
- ✅ 计数与"published 且未过期"集合一致 —— `bumpStreak` 挂在状态转移上
- ✅ **链接过期不扣坚持记录**（2026-09-02 用户确认）—— 只有撤回/删除/下架回撤；`streak` spec + `repo.ts` + 测试已改。

### P1-UC-13 举报
- ✅ 匿名可提交、同源合并计数、高危即时临时下架、举报人不获知作者身份 —— `repo.report`；`repo.test.ts`「高危举报即时下架」「重复举报合并」；`smoke.test.tsx`「高危大类→页面即时转占位」
- 🟡 防滥用（频率/指纹）—— 记录了 `reporterFingerprint`，限频逻辑未实现

### P1-UC-14 审核队列
- ✅ 优先级排序、复核动作驱动状态机 + 留痕、每工单有终态 —— `repo.moderationQueue` / `resolveReport`；`Moderation.tsx`；`repo.test.ts`「命中护栏词→进队列→人工通过→送达」
- 🟡 审核员分级 / 二审 / 抽检执行 —— 数据结构留了位（`priority`、`origin: auto_suspect`），流程未完整实现
- ⬜ 角色鉴权 —— 原型不鉴权

## 待你拍板

1. ~~链接过期是否扣坚持记录~~ —— **已定（09-02）：不扣。** spec + 原型 + 测试已改。
2. ~~校验期作者能否撤回~~ —— **已定（09-02）：可以。** `verifying → withdrawn` 已加，spec + 原型 + 测试已改。
3. **ADR 0003（技术栈）** —— 已重写成 13 个决策项供逐条选择，见 [../adr/0003-p1-tech-stack-web-first.md](../adr/0003-p1-tech-stack-web-first.md)。
4. **openspec change `add-p1-text-blessing`** —— 待评审。6 个能力域 spec delta + design + tasks，`openspec validate --strict` 通过。评审后才 `/opsx:apply`。
5. **"精选展示默认开启"的合规性** —— 需法务；代码已做成配置项。
