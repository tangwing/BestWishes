# PROMPT_LOG — BestWishes

完整记录驱动本项目演变的用户 prompt。

## 2026-08-31

### 项目启动

> 在与当前的项目，也是iOS评级的目录里面呢，新建一个我的AI项目。然后它的目的呢，是打造一个我的APP, 名字暂定 BestWishes。然后你可以init一下它的agents md等等。然后基于我的iOS当前项目的agents以及一些其他的场景的要求，先把它init出来。然后我们会进一步的去细化我的要求等等。然后但是这个新的project的目的是为了编程，所以要按照一个正规的软件开发者的这种要求去建立它，它的目录结构等等。那么这个APP将是在多端可以使用然后你先建出Project，然后我们一起探讨它的技术栈等等。会是一个平台，能够让用户去发布他们想让其他人给他的祝福，然后其他人还可以悬赏等等，然后所有人都可以向其他人发出祝福。细节的话我一会给你说。

**结果**：确认「iOS评级」为语音转写误听（AI OS 同级/平级），项目位置定为 `/Users/leishang/code/ai_projects/BestWishes`，独立 git 仓库。建立 README（含 Goal）、AGENTS.md（借鉴 ls 仓库代码工艺标准，裁剪为纯工程规范，去除个人记忆系统部分）、CLAUDE.md 桥接、CHANGELOG.md、PROMPT_LOG.md、docs/product/concept.md（记录产品概念）、docs/adr/0001-record-architecture-decisions.md。技术栈、后端架构、悬赏机制细节等待后续澄清。

## 2026-09-01

### 引入 Spec 驱动工作流 + 技术栈方向调研

> 我们即将在这个新的Project里面创建我的第一个AI APP。我会跟你一起共创它。但是这作为一个代码库的话，我想第一步请你做的是调研最好的Practice，让我的整个代码库首先的各种Agent MD啊等等各种规范都能够一上来就ready。然后我想，然后紧接着我们会探讨具体技术栈哈。然后在每一次这个需求推进的时候，我们都严格的按照一定的规范去做，包括生成Spec记录下来，然后呃评审过后，然后那生成那个测试，测试用例然后用这种TDD的方式去一个一个完整需求，我们可以借鉴OpenSpec或者是其他更好的已有的插件，这个你可以去帮我调研并且安装。那么我大体想要做的呢，是一个ToC的应用，它是可以在网页端同时也可以在手机端去使用的。那么有可能会用到哪些技术栈的话，你可以派出一个Agent帮我调研，我们探讨这件事。同时另一个Agent的话，帮我先整理好我的整个仓库的初步的这种规范。我是要求，我的关注点其实很明确，就第一就是说，所有做的事做的需求呢，都是有迹可循的。第二就是质量，就是无论是它的设计Spec，还是它的这个测试用例等等，都必须是严格能够把控住我的质量，因为我最终这个APP可能是会有上亿的用户。我会用最高的水准去把控它。差不多就这些。然后我们一起讨论一下，看看下一步怎么做。

**结果**：派出两个 Agent 并行调研。（1）技术栈方向：对比 Web-first+PWA / React Native+Expo / 强 AI 原生三条路径 × Supabase/自建后端 × AI 集成模式，产出对比表，未拍板，等目标用户地域、悬赏结算方式、AI 具体用途三个 concept.md 未澄清项确定后再收窄。（2）Spec 工作流：核验对比 OpenSpec / spec-kit / BMAD-Method，推荐 OpenSpec（需求粒度贴合、可追溯性强、与本仓库 AGENTS.md 风格不冲突），已 `openspec init --tools claude` 生成 `openspec/` + `.claude/commands/opsx/*` + `.claude/skills/openspec-*`，未改动任何已有规范文件。用户确认采纳（见 [ADR 0002](docs/adr/0002-openspec-for-requirement-lifecycle.md)）：全局安装 `openspec` CLI 使 slash command 可用；评审门/TDD 暂维持 prompt 级约定，不做机制化强制；`openspec/changes` 归档与 PROMPT_LOG.md/CHANGELOG.md 并行存在，不合并。`openspec/config.yaml` 的 `context` 字段已写入 AGENTS.md 关键约束摘要。技术栈仍待下一轮讨论收敛后写 ADR 0003。

### 业务与架构设计启动：需求澄清 + 北极星 + 首发切入点

> [/openspec-propose] 开始整体业务设计与架构设计，过程中实时更新设计文档，确认前不编码。需求背景：多端平台连接两类人——希望收到祝福者可自定义祝福形式（录视频、念指定文字、诵经等）并可悬赏；愿意传递善意者可无偿或领赏完成。平台用 AI 对祝福质量（完整性、是否中断、专注度等）评分决定给赏比例，提供资金流向透明化（看到钱流向了世界各地的谁）、一键合成祝福视频（如婚礼场景 100 条祝福合成一段）。要求按软件工程严格流程：需求澄清 → 用例设计 → 评审 → 架构设计 → 需求拆分 → 测试设计 → 编码。

> 退一步先谈理念：核心是激发全世界的善意，悬赏 / 盈利只是辅助手段。请求方收到全球祝福；祝福者享受"送人玫瑰手有余香"；对宗教修行者，AI 打分帮助更好修行。资金托管为体验可能需自建；小程序若能大幅简化则值得考虑。

> 先选一个小众群体跑通——中国 / 全球华人佛教群体，支付用微信 / 支付宝。上线顺序：先做帮助专注修行的 AI 功能 → 再引入任务发布与匹配（悬赏排行榜 + 兴趣标签个性化推荐 + 标签外推荐）→ 通过微信 / 小程序传播。确认：无偿赠送是主体验；分数不达标仍送达，但把更精选的祝福呈现出来（正向策展，不是给低分打标）。要求先写一版后端能力清单。

**结果**：确立产品北极星（新建 [docs/product/vision.md](docs/product/vision.md)）：使命 = 激发并传递全世界的善意；悬赏 / 托管 / 变现均为辅助；5 条设计裁决准则（无偿为主线；AI 评估拆分为"用心反馈"与"给赏资格"；祝福始终送达；资金透明 = 看见善意；反商业化护栏）；北极星指标非 GMV。更新 [docs/product/concept.md](docs/product/concept.md) 至 v2：首发切入点 = 华人佛教群体，5 阶段上线顺序，已确定 / 仍待澄清项。

### 去宗教化重新定位 + 后端能力清单落地

> 按上线阶段 P1–P5 每阶段都有 MVP，合理。要避免整个 APP 变成带宗教性质的东西——从表达和定位上修正，重点落在祝福、祈祷、善意表达，而不是"宗教修行"。

> 可以跟正念、觉察、冥想这些挂靠。之前说的产品北极星理念很好，要记录下来。

**结果**：产品对外重新定位为「练习专注、传递善意」的空间，挂靠正念 / 觉察 / 冥想与"用心表达一份祝福"，明确**不做宗教定位**；宗教场景只是承载的众多情境之一；**首发人群（华人佛教群体）≠ 产品身份**，仅作冷启动楔子。用词替换：修行→用心表达 / 练习；诵经持咒回向→念一段有意义的文字 / 祈祷 / 为某人送祝福；宗教修行评分→用心度 / 专注度反馈。vision.md 升 v2（加「定位」节），concept.md 升 v3。新建 [docs/product/capabilities.md](docs/product/capabilities.md) v0：15 个能力域（C1–C15）+ 横切非功能项，按 P1–P5 标注。

### 派 Agent 调研合规/AI + 锁定 P1 范围（文本先行）

> 派一个 sub agent 接着调研资金合规、AI 评估等问题；主线程先锁定 P1。祝福形式可以有很多，先跑通文本——用户发一个 message 作为祝福，其中带发送者的个人化信息（我是谁等）让祝福个人化。

> （回答 P1 scope 提问）P1 文本祝福用"分享链接送达"（生成可分享卡片 / 页面，接收方无需注册）；P1 先不做 AI 评估。

**结果**：（1）派 general-purpose agent 完成调研，报告存入 [docs/research/2026-09-01-funds-ai-licensing.md](docs/research/2026-09-01-funds-ai-licensing.md)。关键结论：**资金合规约束最硬**——初创拿不到支付牌照，"平台先归集资金再转付"=二清（违法），concept 的"自托管"只能是**账务层自托管，资金层必须持牌托管**（微信电商收付通 / 支付宝直付通，祝福者作二级商户，抽成走分账，支付宝单笔分账 ≤30%）；悬赏须定性为"服务报酬 / 悬赏广告（民法典 499）"，**严禁做成"为受助人筹款"**（=公开募捐）。建议 **P1/P2 零资金面，资金推迟 P3**。AI 评估：P1 文本用 内容审核 API + 规则层 + LLM 多维评估（带 rubric、双采样、温度 0），输出多维标签而非单一分；P1 就要建人工校准集。UGC 授权：P1 就上线《用户内容与授权协议》框架，用途分层勾选；声纹 / 人脸 / 宗教信息须单独同意 + PIPIA；MVP 禁未成年人内容。报告附 ADR-A 至 ADR-Q 决策清单。（2）**锁定 P1 范围**：仅文本 + 发送者个性化信息 + 微信可分享卡片（接收方无需注册），**无 AI 评估、无资金功能**，附授权协议框架。（3）新建 `docs/research/` 目录约定（AGENTS.md §5、README 已更新）。vision 无变化，concept 升 v4，capabilities 更新 C3/C4/C9/C13。（4）新建 [docs/product/use-cases.md](docs/product/use-cases.md) v0，覆盖 P1 的 14 个用例（P1-UC-01…14：微信登录、授权协议、范本、撰写+个性化、草稿、自动合规检查、生成分享卡片、微信分享、访客查看、访客致意、作者管理、坚持记录、举报、审核队列）+ 关键数据对象 + 待拍板开放问题。

### P1 用例评审第一轮：发布模型等 5 项拍板

> 回答开放问题：①作者侧先发布，平台 hold 几分钟校验，通过后接收方才收到；②授权协议"精选展示"默认开启；③撤回对坚持记录计数要回撤；④访客致意先不进 P1；⑤祝福链接不设长期公开（设有效期）——这有什么风险？⑥首发客户端怎么选，帮我对比；⑦交互界面怎么开展，用 Lovart 之类在线工具还是别的？

**结果**：use-cases.md 更新——确立"发布即校验、延迟送达"模型（作者侧"已发送"与接收方侧"可见"为两个独立状态，校验期访客看占位页）；精选展示默认开启（附 PIPL"非必要授权不得默认勾选"合规待法务确认的备注，不行则退化 opt-in）；撤回 / 删除回撤坚持记录计数；UC-10 访客致意移出 P1 到 P4；祝福链接设默认有效期（建议 90–180 天）+ 作者可续期，文档补充了"不设长期公开"的风险（情感资产回看落空）与缓解（到期不删数据只转占位、可续期、允许接收方存图、追思场景留 P4 永久纪念页）。数据对象补 状态机（校验中/已发布/已驳回/已撤回/已删除/已下架/已过期）与链接有效期。首发客户端（小程序 vs H5）对比与交互设计工作流：见对话，待用户定，将进 ADR 0003。

### 授权自主推进 P1 到"可验收"（夜间无人值守）

> 就按你说的做。把 P1 关键代码现在开始实现、设计稿按讨论来做。我去睡觉，你持续工作、自己校验、形成 loop，直到满足 P1 验收标准，供我明早验收。

**结果**（2026-09-02 夜间自主完成，全部为待评审产物，未跳过评审门去"上线"）：
1. **ADR 0003（Proposed）**：P1 技术栈 Web-first——前端 React+TS+Vite（PWA）、后端 Node+TS、库 PostgreSQL、微信走网页授权、内容审核用可插拔 `ModerationProvider`、小程序推迟到 P2 录音实测后再决策。待用户 Accept。
2. **[docs/architecture/p1-architecture.md](docs/architecture/p1-architecture.md)**：组件视图、祝福状态机（8 态 + 转移表 + 不变量）、发布即校验/延迟送达、坚持记录回撤规则、审核与人工复核、PostgreSQL 数据模型、API 草图、安全合规要点、10 条待评审项。
3. **openspec change `add-p1-text-blessing`**：proposal + 6 个能力域 spec delta（wx-account / content-agreement / blessing-authoring / blessing-delivery / content-moderation / blessing-streak）+ design.md（8 条技术决策）+ tasks.md（7 组任务）。`openspec validate --strict` 通过。
4. **[prototype/](prototype/)**：可运行走查原型（spike）。领域逻辑纯函数模块（状态机 / 可见性 / 坚持记录 / 审核判定 / RuleBasedProvider）+ React PWA（作者流程 + 访客落地页 + 审核台）+ localStorage 存储 + 走查工具（时钟穿越 / 审核模式切换）。**101 个自动化测试全绿**，tsc / build 通过。
5. **界面走查稿**：Claude Design 画布，9 个移动端 artboard（作者流程 6 屏 + 访客落地页正文/占位 + 审核台），off-white/衬线体/静心调性。已发布。
6. **[docs/product/p1-acceptance-status.md](docs/product/p1-acceptance-status.md)**：逐用例对照验收标准的实现状态清单。
7. 目录约定更新（AGENTS.md §5、README、.gitignore 加 node_modules/dist）。

**夜间发现、需用户拍板**：(a) 链接过期是否应扣坚持记录（建议：不扣，只有撤回/删除/下架才回撤）；(b) 校验期(verifying)作者能否撤回（当前状态机不允许，建议加 `verifying→withdrawn`）；(c) ADR 0003 具体选型待 Accept；(d) openspec change 待评审后才 `/opsx:apply`；(e) 精选展示默认开的合规性待法务。

### 拍板 (a)(b) + 要求 ADR 0003 列成可选决策项

> 链接过期可以不扣。校验期撤回可以加上。ADR 0003 我现在看，如果有明确的决策项，最好列出来供我选择。

**结果**：(a) 链接过期不回撤坚持记录（只有撤回/删除/下架回撤，续期不加计数）——改 `blessing-streak` spec（加 3 个 scenario）、`streak` 说明、`repo.ts`（引入 `countedInStreak` 标记）、`streak.test.ts`/`repo.test.ts`、architecture §5。(b) 加 `verifying → withdrawn`（校验期取消，清除待发布定时与关联自动疑似工单）——改 `blessing-delivery` spec、`lifecycle.ts`、architecture §3/§4、`MyBlessings.tsx`、测试。原型 **103 测试全绿**，openspec `validate --strict` 通过。ADR 0003 重写为 **13 个决策项**（D1 整体形态 … D13 小程序），每项列 A/B/C… 选项 + ★倾向 + 影响面 + 可逆性，待用户逐条选择后转 Accepted。use-cases.md「已拍板」补两条。

### 自动 commit/push + 技术栈拍板 + 工程规范

> 每次对话完自动 commit and push（单开发者，保障实时同步到远端），需要的话加 hook，commit msg 要规范。技术栈 double check 是否满足长期需求 / 保留灵活性，满足就推进。基于技术栈生成一套标准 MD 规范，要求所有代码遵循——高软件工程要求：架构清晰、可读、注释充足、性能（多线程等）。

**结果**：
1. **技术栈决策项拍板**（用选择器）：D1 = Web-first PWA、D4 = Node.js+TS、D6 = PostgreSQL、D10 = P1 用规则审核 / 真实 API 放收尾或 P2（用户选 B，非我倾向的 A）。D9 由 D1 锁定为微信网页授权。D2/D3/D5/D7/D8/D11 按 ★倾向执行（React / CSS Modules / Fastify / Drizzle / pnpm monorepo / 审核后台内嵌），用户未反对。ADR 0003 转 **Accepted（核心项）**，加「决策记录」表 + 「长期适配性核验」节（规模、P2 AI 拆独立服务、P3 一致性、并发模型、灵活性保留点、唯一取舍）。AGENTS.md §1 / §6 更新（技术栈未定状态解除）。
2. **工程规范**：新建 [docs/engineering/coding-standards.md](docs/engineering/coding-standards.md) v1——17 节：总则、仓库结构（Hexagonal 分层 `packages/domain` 零 IO）、依赖规则（机制化强制）、命名、TypeScript（禁 any/!、判别联合穷尽、Result vs throw）、校验边界（Zod 前后端共享）、注释（写「为什么」）、API（Fastify + schema、幂等、游标分页）、数据库（约束落库 / 业务不落库、事务边界在 application、N+1 零容忍）、前端（服务端状态分层、a11y、i18n）、**并发与性能**（Node 事件循环、绝不阻塞、worker_threads / 独立服务、连接池、缓存纪律、先测再优化）、可观测性、安全与隐私（PIPL）、测试（分层 + TDD + 无 flaky）、依赖管理、提交与分支、评审清单。AGENTS.md §5 加 `docs/engineering/`。
3. **自动同步 hook**：`.claude/hooks/auto-commit-push.sh`（Stop hook，`.claude/settings.json`）——有改动则 add -A + Conventional Commits fallback message（顶层 scope + UTC 时间戳 + Co-Authored-By），领先远端则 push（SSH BatchMode + ConnectTimeout + `ssh.github.com:443` 回退 + 45s 自限时，超时/失败给 systemMessage）。AGENTS.md 新增 §7 Git 工作流。**注意**：settings.json 是本会话新建的，hook 要等用户打开 `/hooks` 或重启后才生效。本会话已手动验证脚本可提交并推送成功（origin/main 已更新）。

### 注释语言规范 + 架构测试

> 注释用简洁准确易懂的人类语言，不要 AI 的晦涩语言。涉及架构分层要有 ArchUnit 等测试保证架构整洁，配套独立的单测体系。弄完一起看设计稿。

**结果**：
1. **注释语言硬性规范**：coding-standards.md 加 §7.1——注释就用同事之间会说的话（白板讲解那句话），禁营销腔 / AI 味词（leverage、utilize、delve、seamlessly、robust and scalable、it is worth noting…），不写正确的废话，不用 emoji / 感叹号 / 装饰分隔线；评审会因注释不像人话打回。扫过 prototype 现有注释，无此类问题。
2. **架构测试**：coding-standards.md 加 §3.1（fitness functions）——dependency-cruiser 作主检查（domain 纯净 / 依赖方向 / 无循环 / 无孤儿）+ `*.arch.test.ts` 断言，**独立成套**（`test:arch` 单独命令、CI 独立一步、最先跑）。§14 测试改为分层各自独立命令。prototype 落地：`.dependency-cruiser.cjs` + `src/arch/architecture.arch.test.ts`（5 条断言：不 import 前端 / 存储 / Node 内建、不用 Date.now/Math.random）+ `test:arch` / `verify` 脚本 + `@types/node`、`dependency-cruiser` 依赖。`npm run verify` 全绿（typecheck + depcruise 0 违规 + 108 测试 + build）。
3. openspec `tasks.md` §1 重写为 pnpm monorepo + ESLint + 分层测试命令 + 架构测试落地 + 从 prototype 迁 `packages/domain` 的任务。

### 设计稿第一轮点评：撰写页精简 / 范本不可复制 / 个人空间 / 收发记录 / 发心 + 建 BACKLOG + 并行

> 撰写页字段多，关系不需要；城市未来靠定位，落款和城市在个人空间预配（个人空间还没设计，加待办）。"我的祝福"要像邮箱一样分收件 / 发件，都要有记录，设计一下。调性偏冥想、素一点 OK；语言 / 图片要帮人更好地发心，感知善意的意义、更真诚——比如范本不允许复制，要自己打出来。你适当改，会快速迭代。以后我都这样点评，管好 todo list、持续加持续做。条件允许多派 Agent 并行。
> （补充）根目录除 CHANGELOG 外应有 BACKLOG，管待办；确保电脑 / 会话重启能继续工作。CHANGELOG 记已完成。

**结果**：
1. **BACKLOG.md（根目录）** 建立——「恢复点」一节 = 当前进展 + 下一步，会话 / 电脑重启从这里接着干。AGENTS.md（顶部 + §5 + 新 §8 工作方式）、CLAUDE.md 都指向它。B-NN 编号管理点评项。
2. **并行**：派 1 个 subagent 改原型（B-01/02/03/07），主线程改 spec + 画布 + docs，互不碰对方文件。agent 收尾 `npm run verify` 全绿（108 测试）。
3. **B-02 撰写页精简**：个性化砍到 3 项（给谁必填 / 落款 / 城市），删关系、前后缀。`Personalization` = `{toName, fromName?, fromCity?}`。
4. **B-03 范本不可复制**：范本只作参考、无一键填入、示例 `user-select:none`；正文须自己录入，粘贴被拦 + 温和提示。
5. **B-01 个人空间**：新 capability `user-profile`——落款 / 城市预设、定位授权开关（P1 占位）、精选展示个人偏好、坚持记录入口、退出 / 注销。新画布 artboard `Profile`。
6. **B-07 收发记录**：`blessing-records` capability + "我的祝福"→"收发记录"（送出的 / 收到的两 tab），P1 发件箱完整、收件箱空状态 + 结构预留（`inbox_items` 表）。
7. **B-04 发心引导**：撰写页动笔前的"想一想 TA 打开这段话时的心情"提示；送达页"你的心意正在送往 [城市的 XX]"。
8. openspec change 现覆盖 **8 个能力域**，`validate --strict` 通过；use-cases 升到 P1-UC-15、architecture 数据模型 + API 更新、proposal / tasks 同步。
9. **界面画布 v2 已发布**（同一 URL）：https://claude.ai/code/artifact/2b91c40d-3d05-49af-8ebe-d05ffae6fa43

### 开工实现 P1（/loop，自定步调，6 轮迭代）

> 可以了，就按这个走吧，开工，持续进行，按照 Loop 进行，直到完成初版 Demo。

**结果**：`/loop` 自定步调，6 轮迭代把 P1 从走查原型迁到生产 monorepo 并跑通初版 Demo。每轮 `pnpm verify` 绿 + commit + push。
- **iter 1**：pnpm monorepo 骨架（`packages/domain` `packages/shared` `server` `client` `arch`）+ 根级 tsconfig(strict) / ESLint(typescript-eslint strict-type-checked) / Prettier / dependency-cruiser / vitest workspace。领域逻辑从 prototype 迁入。
- **iter 2**：`server/config/app-config.ts`（`BW_*` env 覆盖）+ 数据层 `ports/`（全部仓储接口 + `records` + `ids`）+ `infrastructure/memory/` 内存实现（openid 幂等 / slug 唯一 / 工单排序）。PostgreSQL 因本机无 psql 推迟 B-24。
- **iter 3**：`application/` 用例——auth（占位登录）/ profile / consent / drafts / blessings（submit 同步规则审核落状态、合并个人空间默认值、字数与 consent 校验；withdraw/republish/delete/renew；outbox；inbox 空状态）/ streak / scans（延迟送达 / 到期 / hold 超时）。domain 加 `applyBlessingTransition`（纯：转移 + 事件 + streakDelta）。
- **iter 4**：Fastify HTTP API `interface/http/routes.ts`（全部 P1 端点，cookie 会话，Zod parse，AppException→status）+ ReportService（匿名 / 指纹 / 同源合并 / 高危即时下架）+ ModerationQueueService + 范本 seed（18 条）+ 组合根 `main.ts`。
- **iter 5**：`client/` React + Vite + CSS Modules——10 个页面（登录 / 个人空间 / 授权协议 / 撰写[拦粘贴 + 发心提示 + 呼吸圆环] / 已发送 / 收发记录 / 坚持 / 审核台 / 访客落地页 / 首页），`api/client.ts` 唯一 fetch，`SessionProvider`。落地页数据挪到 `GET /api/p/:slug`，`/p/:slug` 留给前端路由。
- **iter 6**：`@fastify/static` 单进程托管 client（`pnpm demo`）+ `docs/DEMO.md` 走查稿 + README「跑 Demo」+ §7 端到端测试（`api-flow.test.ts`，7 个 `app.inject` 覆盖核心流程 / 护栏词 / 违禁词 / 过期续期 / 举报下架）。

**产物**：`pnpm demo` 单进程跑通 登录→个人空间→协议→撰写→已发送→hold→发布→访客看正文→撤回→占位→坚持记录回撤。**119 测试全绿**，`pnpm verify`（typecheck + depcruise 0 违规 + 测试 + build + eslint + prettier）绿，openspec `validate --strict` 通过。工程规范补 `explicit-function-return-type` / `noUncheckedIndexedAccess` 等在各层的分级校准（严在内层，松在 UI 胶水层），均写进 eslint.config.js 注释。

**待用户定下一步**：真实依赖（PG / 微信授权 / 审核 API）、Playwright E2E（B-30）、界面第二轮评审（B-09）、或 `/opsx:archive` 归档开 P2。

### 夜间无人值守：画布 v2 通过 + PostgreSQL 数据层 + Playwright E2E

> V2 已看，通过（B-09）。B-24（PG/Drizzle）和 B-30（Playwright）"你自己装就行了"。真实授权晚一些。干完能干的就待机。

**结果**：

1. **B-09**：画布 v2 用户确认通过。
2. **B-24 PostgreSQL / Drizzle 数据层**：本机 Homebrew 装不了 Postgres（`openssl@3: unknown keyword :overwrite`），改用 **PGlite**（Postgres 编译成 WASM，进程内跑，无需本机装）——是真 Postgres、跑真 SQL。
   - `server/src/infrastructure/db/`：`schema.ts`（10 表 Drizzle schema，约束落库、事件单独存 `blessing_events`）、`client.ts`（`createDb` / `migrateToLatest`）、`migrate.ts`（`db:migrate` 脚本）。`drizzle.config.ts` + `server/drizzle/0000_init.sql`（`db:generate` 生成）。
   - `server/src/infrastructure/pg/pg-repositories.ts`：全部 10 个仓储接口的 PG 实现，和内存实现同一组 ports；读祝福时从 `blessing_events` 子表拼回 `events` 数组；`streak_days` 用事务整体替换。
   - `env.ts` 加 `BW_DB`（`memory` 默认 / `pglite`）+ `BW_PGDATA`（落盘目录，不设即纯内存）。`main.ts` 按 env 选数据层，内存仍是默认（demo 不受影响）。
   - `pg-repositories.test.ts`：整套 application 跑在 PGlite 上，走和 `api-flow` 相同的核心场景（提交→hold→发布→访客、撤回回撤、缺协议、护栏词→队列→通过）。5 个测试，**全程进程内、CI 可跑，无需外部服务**。
   - 生产换独立 Postgres = 换 `drizzle-orm/postgres-js` 驱动一层的事，schema / 仓储 / 迁移不动。
3. **B-30 Playwright E2E**：独立 `e2e/`（自己的 npm，不进 workspace）。本机是 macOS 12，新版 Playwright 不再提供 chromium 构建——改用 **系统安装的 Chrome**（`channel: 'chrome'`）。
   - `playwright.config.ts`：`webServer` 自动构建 client + 起 server（内存、`BW_HOLD_SECONDS=1`），端口 3100。
   - `tests/`：`author-flow`（登录→个人空间→协议→写祝福[范本禁粘贴、正文自录]→已发送→hold 后自动发布→访客看正文→撤回→访客看占位）、`moderation`（护栏词停校验→审核台通过→送达；高危举报即时下架→审核台驳回→恢复）、`visitor`（未知链接占位、访客页免登录）、`smoke`。**6 个测试全绿**。
   - `pnpm test:e2e` = `cd e2e && npm test`。不进 `pnpm verify`（要浏览器 + 构建，单独跑）。
4. **本机限制记录**（写进 BACKLOG「本机限制」）：Homebrew 坏、无法装原生 Postgres → 用 PGlite；macOS 12 → Playwright 用系统 Chrome。CI 用较新系统可换回自带 chromium。
5. **未做**（用户明确推迟）：真实微信网页授权、真实内容审核 API。

**产物**：`pnpm verify` 绿，**124 测试**（+5 PG 集成）。E2E `cd e2e && npm test` 绿（6 个，真浏览器）。`BW_DB=pglite` 起服务已冒烟验证（迁移 + 范本 seed + 请求）。

## 2026-09-03

### 上下文丢失后恢复：check 进度并推进

> 现在上下文已经丢失，请你 check 当前的进度并继续推进。

**结果**：确认上一轮工作（B-24 PG 数据层 + B-30 E2E + B-09）已由 Stop hook 提交推送（`99f52db`），工作树干净，`pnpm verify` 绿（124 测试）。推进 B-31——把 `docs/product/p1-acceptance-status.md` 从对照 `prototype/` 改为对照生产 monorepo（逐用例证据指向真实文件 / 测试，新增数据层 / 部署一节，刷新「待你拍板」）。a/b/c/d 方向选项（真实微信授权 / 真实审核 API / 界面迭代 / `/opsx:archive` 归档 / 删 `prototype/`）仍等用户定。

### 界面实操验收 + 4 点反馈

> 1. 发送祝福后没有反应。2. 发件箱里也没有这个祝福。3. 发送后如何从收件人角度验证？如何登录。4. "坚持"的说法显得有点刻意。有没有别的办法。

**结果**：
- **1+2 是同一个 bug（B-50）**：新用户从导航直接进「写祝福」，没被引导去同意协议；提交打 403 `consent_required`，错误只在长表单最底一行小字，看着像"没反应"；因为没提交成功，发件箱当然空。根因：Compose 用 `GET /api/agreement/current` 判有没有同意，但这个接口永远返回 200。修：`AgreementView` 加 `alreadyConsented` 字段，Compose 进页即判、未同意跳 `/agreement`；submit 收到 `consent_required` 也跳。加了 api-flow 断言 + E2E（去掉修复即失败，已验证）。
- **3（B-52）**：P1 没有站内 user→user，收件人不"登录"，就是打开分享链接的访客。`Sent.tsx` 补了一句说明。验收方法：复制链接 → 无痕窗口 / 另一浏览器打开。
- **4（B-51）**：用户选"突出利他 / 善意 / 送人玫瑰手有余香"。「坚持」→「回响」，文案改为"你写给别人的祝福也会回到自己心里"，累计数为主，连续天数降为一句轻描述，去掉打卡压力。仅改 client 文案。
- `pnpm verify` 绿（**125 测试**），E2E **7 个**全绿。
