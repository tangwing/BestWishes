# BestWishes 调研报告：留存与激励机制（情绪支持类产品 / 虚拟激励 / 集体活动与勋章）

> 状态：v1，2026-09-27。调研性质，不改动产品代码、BACKLOG、docs/product。
> 面向对象："极低成本倾诉 → 陌生人表达善意 → 本人回来看到被加油次数"这一新起点的重新设计决策输入。
> 本文只调研**机制**（怎么运转、为什么成立、为什么崩），不做产品介绍，不替产品拍板。
> 法规与数据均标注时效与来源；落 ADR 前须请法务复核。

---

## 0. 证据等级说明

文中每条结论前都标了等级。**不要把 B/C 级当 A 级用，不要把【推测】当结论用。**

| 等级 | 含义 | 例子 |
|---|---|---|
| **A** | 同行评审论文、官方法规原文、公司官方说明/帮助中心、上市公司财报 | JMIR 的 RCT、国务院令、Strava 官方 press |
| **B** | 可靠媒体报道、当事人一手公开陈述（含前高管公开复盘）、行业权威机构文件 | TechCrunch、腾讯新闻/界面、Lenny's Newsletter 上 Duolingo 前 CPO 亲述 |
| **C** | 二手分析博客、产品社区帖、Wiki 类站点、无法回溯到一手的数据 | 人人都是产品经理、Fandom Wiki、知乎专栏 |
| **【推测】** | 我基于以上材料的推断，**没有直接证据** | 标注在句首 |
| **【查证失败】** | 试过但没拿到一手内容，只知道标题/存在 | 标注在句首 |

另有一条纪律：本文出现的每个数字都带年份。没年份的数字我一律不写。

---

## A. 海外情绪支持 / 互助类产品的机制

### A.1 最关键的问题：如何保证"求助者一定收到回应"

这是我们产品的生死线。查到的答案出乎意料地朴素：**做得最成功的那个产品，是花钱买供给的。**

- **【A】Panoply（后来的 Koko）在 RCT 里用付费众包工人兜底回应供给。** Morris / Schueller / Picard, *JMIR* 2015；平台"respondents in our study were a mixture of other Panoply users and paid workers from MTurk"，**回应中位时延 9 分钟**；三周内每位用户平均收到 support 回应 8.94 条、debug 10.82 条、reframe 5.99 条。来源：https://pmc.ncbi.nlm.nih.gov/articles/PMC4395771/
  - 含义：他们没有指望"用户量够大自然就有人回"。他们把"必有回应、且快"当成产品承诺，用付费劳动力补齐冷启动期的缺口。
- **【A】7 Cups 走的是"海量志愿者 + 实时 1:1 聊天"，供给侧长期失衡是它最被诟病的点。** 平台宣称 50 万+ 志愿倾听者、189 国、140 种语言（官方口径），但用户端反复报告等待 30 分钟以上、倾听者显示在线却不接、5 分钟内断开、同时接多人导致质量下滑。来源（B/C 混合，社区与评测）：https://www.7cups.com/forum/welcome/QuestionsInformationaboutusing7Cups_792/Discouragedbylisteners_240105/ ; https://www.selfpause.com/resources/seven-cups
  - 含义：**实时 1:1 是最难保供给的形态**。异步 + 多人各写一小段，比"配一个人陪你聊"容易兜住几个数量级。
- **【A】人数越多，单个人越不觉得"该我回"——在线环境同样存在旁观者效应。** 经典 Darley & Latané 范式：认为只有自己在场时 85% 施救，3 人组 62%，6 人组 31%；后续研究在线论坛复现，且"施助倾向随收到请求的群体规模非线性下降"。来源：https://link.springer.com/chapter/10.1007/978-3-030-34770-3_12 ; https://www.simplypsychology.org/bystander-effect.html
  - **对我们的直接结论**：**不要把一条忧思广播给所有人。** 广播 = 责任扩散 = 零回应。要定向分配给少数人并明确"这条指给你了"。
- **【C】TalkLife 平台数据：一条帖子平均收到 4.39 ± 1.13 条回复**（引自 HAILEY 论文相关工作的数据描述）。来源：https://arxiv.org/pdf/2203.15144

### A.2 回应端的形态：一键 / 预制短语 / 自由文字

这是三选一吗？不是。查到的证据指向"**分层**"。

- **【A】一键式反馈（like/poke）对接收者的福祉没有可测效果；有字的定向消息才有。** Burke & Kraut, *JCMC* 2016，1910 名 Facebook 用户三轮面板研究（2011-06~08），服务器日志 + 自报福祉对齐：收到**强关系写的定向文字**与福祉改善相关（效应量"与一场疾病的影响大致相当，方向相反"）；**收到"赞"等一键反馈与福祉改善无显著关联，无论来自亲友还是泛泛之交**；一键互动也不提升关系强度，而定向评论和 wall post 会。来源：https://academic.oup.com/jcmc/article/21/4/265/4161784
  - **重要限定（别过度引用）**：这条结论的正向效应只在**强关系**里成立。我们是陌生人场景，不能直接搬"文字有效"的结论；但"一键无效"这一半在两种关系里都没测出效果。
- **【A】陌生人写的、有结构的短文字，确实能降低抑郁症状。** Panoply RCT：三周后抑郁改善 d = -0.36（P=.001），重评能力改善并中介了抑郁改善；在基线抑郁者子组中优于对照。**即"陌生人 + 文字"是有效的，前提是回应被结构化引导过。** 来源同 A.1。
- **【A】结构化引导长什么样：3-5 分钟微培训 + 正反例 + 小测验 + 三种固定回应类型。** Panoply 把回应拆成 support（共情）、debug（帮你找出思维里的扭曲）、reframe（帮你换个说法）三类，每类有提示词模板；回应者先过 3-5 分钟培训模块，看正例反例，做互动小测。来源同 A.1。
  - **这是全文最值得抄的一条设计。** 它把"写不出话"变成"填一个有提示的格子"，同时把质量下限抬起来。
- **【A】给回应者实时 AI 反馈，能显著提高共情度，且不造成依赖。** Sharma et al., HAILEY 系统，在 TalkLife 上对 **300 名同伴支持者**做 RCT：整体对话共情提升 **19.60%**；在自报"难以给出支持"的那部分支持者中提升 **38.88%**；支持者自报自我效能提升。来源：https://arxiv.org/abs/2203.15144 ; https://arxiv.org/pdf/2203.15144
  - 注意形态：AI 反馈给的是**写作者**（"你这句可以更共情"），不是代替他写。这与 A.6 的 Koko 事故形成鲜明对照。
- **【A/C】Finch 的 Good Vibes：纯预制、14 种、付费用户多 4 种。** 好友之间发送预设情绪支持（Good morning / Hugs / Gratitude / Outfit love / Encouragement / Strength / Calm / Sweet dreams 等），共 14 种；Finch Plus（付费）额外解锁 4 种；接收方也可以主动"讨一个抱抱"（点顶部叼着心的鸟）。发送会累积 in-game Friendship 等级。来源：https://finch.fandom.com/wiki/Good_Vibes（C 级，Fandom Wiki）；官方功能页 https://finchcare.com/about-finch（A 级，但描述较粗）
  - **付费买到的是"表达方式更多"，不是"善意更值钱"。** 这正好是我们要的分寸。
- **【A】Vent 的反应集合全是正向的，没有任何负向按钮。** 反应只有 HUG / NICE / AWW / H4U / UGH / OMG / YAY，没有 downvote、没有负向表情；用户选择的情绪会改变自己头像的颜色（愤怒变红、亲昵变粉）。来源（B）：https://medium.com/kinblog/developer-spotlight-on-vent-the-social-app-build-on-expressing-feelings-fd4ca780009f
- **【A】Koko 现在的形态：只发"简短的匿名希望信息"，平台内不存在私聊。** 官方 FAQ：用户"share brief, anonymous messages of hope for a user who is struggling"；**no direct messaging capabilities**；全量内容 AI 筛查 + 命中标记后人工复核；目标是违规内容低于万分之一；自动移除个人身份信息。来源：https://kokocares.org/faq
  - 官方 FAQ **不承诺**"一定会收到回应"，也不披露回应者培训细节。

### A.3 如何防止回应退化成"廉价点赞"

- **【A】上面 Burke & Kraut 已经量化了这个风险：一键反馈的福祉效应测不出来。** 这不是"效果小"，是"没测到"。
- **【A】经济学侧的机制解释：外部激励会挤出"形象动机"，且在公开场合挤出更严重。** Ariely / Bracha / Meier, *AER* 2009："extrinsic incentives crowd out image motivation... monetary incentives are more likely to be counterproductive for public prosocial activities than for private ones"。来源：https://www.aeaweb.org/articles?id=10.1257%2Faer.99.1.544
  - **对我们最危险的推论**：一旦"加油"变成能用钱买、并且公开计数，它的**信号价值**（"有人为我花了心思"）就会被侵蚀。这是我们担心的那个坑的学术版本。
- **【A/中等】投入的努力会抬高被感知的价值，但对"金钱估值"这一支复现不稳。** Kruger, Wirtz, van Boven, Altermatt（2004）"效用启发"原始实验发现"耗时更长"抬高质量与金钱评价；2023 年 Collabra 的复现（Ziano 等）结果混杂：**对"喜欢/质量"支持效应存在，对"金钱估值"不支持**。来源：https://online.ucpress.edu/collabra/article/9/1/87489/197632/The-Effort-Heuristic-Revisited-Mixed-Results-for ; https://en.wikipedia.org/wiki/Effort_heuristic
  - 含义：**"看得出对方费了心"确实能提升感知价值**，但别指望它折算成钱。
- **【A】写作者自己也受益：感恩/表达类干预是小而稳的正效应，且长度与效果无关。** 2025 年 *PNAS* 跨文化元分析：145 篇、163 样本、727 个效应量、24,804 名参与者、28 国，感恩干预对幸福感 Hedges' g = 0.19 [0.15, 0.22]；另一篇 RCT 元分析 g = 0.22 [0.11, 0.33]，且**干预长度与效应量无关，支持使用简短干预**。来源：https://pmc.ncbi.nlm.nih.gov/articles/PMC12280877/ ; https://link.springer.com/article/10.1007/s41042-023-00086-6
  - **这是我们"秒级、最简输入"的学术背书**：短不等于弱。

### A.4 匿名的治理成本，与三个死法

三个匿名产品的死因不一样，抄的时候要分清。

- **【B】Secret（2015-04-29 关停）：死于治理速度，不是死于技术。** 创始人 David Byttow 公开承认"人们使用它的方式（包括散播恶意谣言）不符合我最初的愿景"；关停时称累计 1500 万人用过，融资 3500 万美元并把钱退还投资人。对霸凌的反应被认为太慢，PandoDaily 骂它"morally bankrupt"；联创离职、团队裁半、进入维护状态。来源：https://techcrunch.com/2015/04/29/psst/ ; https://www.fastcompany.com/3045747/what-killed-secret
- **【B】Yik Yak（2017-04 关停）：死于"取消匿名"这个补救动作本身。** 校园霸凌与暴力威胁事件频发（密苏里大学 2015 年一名 19 岁学生扬言杀害黑人学生、后认罪；密歇根州立 2014 年扬言校园枪击被判缓刑），平台**转向限制匿名发帖后用户失去兴趣**：2014-09 月下载 180 万，两年后降到 12.5 万。2021 年被新买家重启并加"community guardrails"（禁霸凌、禁威胁、禁泄露私人信息），2023-03 被同类匿名产品 Sidechat 收购。来源：https://www.insidehighered.com/news/2022/03/07/yik-yak-re-emerges-after-shutdown ; https://www.highereddive.com/news/anonymous-messaging-app-yik-yak-returns-after-4-year-shutdown/605120/
  - **教训**：匿名是这类产品的**承重墙**。等出事了再抽掉它，产品会塌。治理必须在不破坏匿名的前提下做（见下一条）。
- **【B】Whisper：死法是慢性的——增长崩 + 信任崩。** 2017 年裁员 20%（71 人裁 14）、整个董事会离职、COO 离职；SensorTower 估算下载量单季同比降约 55%（vs 2016 Q2）。2020-03《华盛顿邮报》报道其消息数据库**未设密码暴露在公网**，涉及自 2012 年以来约 9 亿条用户记录，含性取向、性别、年龄、族裔、昵称、工作地点及最后发帖位置。来源：https://techcrunch.com/2017/07/28/whisper-layoffs ; https://techcrunch.com/2017/08/29/every-board-member-of-anonymous-app-whisper-has-reportedly-stepped-down ; https://www.comparitech.com/blog/information-security/secret-sharing-app-exposure/
  - **教训**：匿名产品的数据泄露不是"泄露了昵称"，是**泄露了"谁在什么时候难受成什么样"**。这类库一旦漏，产品直接死。存储设计要按"这库总有一天会漏"来做。
- **【A】能在不破坏匿名的前提下做治理的做法（Koko 的公开口径）**：① 结构上不给私聊（去掉了骚扰和捕食的主要通道）；② **全量**内容自动筛查 + 命中后人工复核；③ 自动剥离个人身份信息；④ 一套持续演进的危机关键词库，覆盖俚语和缩写，被 GIPHY / Tumblr / Pinterest 等平台采用；⑤ 与全球 300+ 求助热线对接做转介。来源：https://kokocares.org/faq ; https://pages.kokocares.org/free-anonymous-support/
- **【C】TalkLife 的反面**：Common Sense Media 家长评论普遍反映"越来越不安全、有毒"，报告骚扰、捕食行为、审核缺位，尤其针对脆弱求助者。来源：https://www.commonsensemedia.org/app-reviews/talklife/user-reviews/adult
- **【A】过度审核也有害，这里有真实张力。** 关于自伤内容的研究指出：一方面在线支持存在"强化行为、过度聚焦痛苦与反刍、暴露于触发内容、使自伤正常化"的风险；另一方面**过度审核（overmoderation）本身有害，需要权衡自我表达的价值**。来源：https://mental.jmir.org/2021/1/e21854/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC9880808/

### A.5 有效性的公开研究（用户点名要的"找出来"）

| 产品/系统 | 研究 | 设计 | 关键结果 |
|---|---|---|---|
| **Panoply / Koko** | Morris, Schueller, Picard, *JMIR* 17(3):e72, 2015 | RCT，n=166（治疗 84 / 表达性写作对照 82），3 周 | 抑郁前后改善 d=-0.36（P=.001）；重评能力显著改善（对照组无）；重评变化中介抑郁改善；**组间终点差异不显著（P=.41）**，但抑郁子组中 Panoply 更优（P=.02）。完成率 76.5%（166/217）；人均 21 次会话、单次均 9 分 18 秒、总计 >195 分钟（远超建议的 75 分钟）。 |
| **7 Cups** | 产后抑郁辅助治疗，*JMIR* 2018 | 非随机对照，2 个月，主结局 EPDS | 相对常规治疗的**中等效应量 d=0.58**；用户满意度高；有既往心理治疗经历者平均认为倾听者的支持"与心理治疗同等有帮助"。来源：https://pmc.ncbi.nlm.nih.gov/articles/PMC5829455/ |
| **7 Cups** | 精神分裂谱系障碍辅助 | 适配性研究 | 存在，未细读。来源：https://pmc.ncbi.nlm.nih.gov/articles/PMC6096212/ |
| **TalkLife + HAILEY** | Sharma et al., 2022 | RCT，300 名同伴支持者 | 共情 +19.60%；困难支持者子组 +38.88%；无过度依赖。来源：https://arxiv.org/abs/2203.15144 |
| **TalkLife 自身** | *JMIR Mental Health* 2021 | 纵向混合方法，自伤结局 | 结果复杂，含风险讨论（见 A.4）。来源：https://mental.jmir.org/2021/1/e21854/ |

【注意】Panoply 的**组间终点差异不显著**这一点常被引用方忽略。诚实的说法是："有效，但不是对所有人都优于简单的表达性写作；对本来就抑郁的人更有效。"

### A.6 Koko 的 GPT-3 事故：一条明确的红线

- **【B】事实经过**：2022 年 10 月左右，Koko 让用户可以用"Koko Bot"（GPT-3）生成回应，再编辑/发送/放弃；**约 4000 人收到了至少部分由 AI 撰写的回应**。接收方只看到"Someone replied to your post! (written in collaboration with Koko Bot)"，没有更多说明。2023 年 1 月创始人 Rob Morris 在 Twitter 上公开此事后引发强烈反弹（无知情同意、无 IRB）。来源：https://www.nbcnews.com/tech/internet/chatgpt-ai-experiment-mental-health-tech-app-koko-rcna65110 ; https://www.popsci.com/technology/koko-ai-chatbot-mental-health/ ; https://incidentdatabase.ai/cite/449/
- **【B】最有信息量的那句话（Morris 自述）**："Messages composed by AI (and supervised by humans) were rated significantly higher than those written by humans on their own (p < .001). Response times went down 50%, to well under a minute … [but] **once people learned the messages were co-created by a machine, it didn't work. Simulated empathy feels weird, empty.**" 来源同上（NBC / Gizmodo：https://gizmodo.com/mental-health-therapy-app-ai-koko-chatgpt-rob-morris-1849965534 ）
- **对我们的结论（分两层，别混）**：
  1. **【事实层】** AI 写的回应在盲评下质量更高、还快一半。所以"AI 兜底供给"在**质量维度上是可行的**。
  2. **【事实层】** 一旦接收方知道是机器写的，效果就没了。所以**不可能靠隐瞒来吃这个红利**——隐瞒是伦理灾难，公开就失效。
  3. **【推测】** 可行的第三条路是 HAILEY 式：**AI 只辅导真人写，不代写**。它已被 RCT 验证能提共情、且回应最终仍是真人的。

### A.7 邻近产品的机制笔记

- **【A/C】Finch（自我关怀宠物养成，留存标杆）**
  - 留存核心：现实目标 → 虚拟鸟成长；奖励货币"彩虹石"用于装扮小鸟的世界。**不惩罚、不催逼**："If you don't meet your goals or you step away from the app for an extended amount of time, it sends only encouragement."（与 Duolingo 的"刺头式提醒"形成对照）来源（B）：https://slate.com/technology/2026/09/finch-app-self-care-wellness-review.html
  - **streak 的门槛极低且可修复**：官方帮助中心——"Your streak is counted each day you open the Finch app - **just checking in is enough!**"；漏了一天可以**用彩虹石修复 streak**。来源（A）：https://help.finchcare.com/hc/en-us/articles/37780736136205-Understanding-Streaks
  - 目标按"生活领域"用彩虹色系分组（身体健康、情绪、社交、创造力…），防止用户在单一领域上偏执。来源（B，评测）：https://calmevo.com/finch-app-review/
  - **社交奖励只奖第一次**：每天第一次给某位好友发 Good Vibes 得 3 Energy + 2 Rainbow Stones，之后可以继续发但**不再给石头**。来源（C）：https://finch.fandom.com/wiki/Good_Vibes
    - 这是"既鼓励善意、又不奖励刷量"的最干净实现，直接可抄。
- **【B/C】Gratitude / Presently 类感恩日记**：Presently 是开源、免费、无广告，**没有提醒、没有 streak、没有 AI、没有情绪图表**，只问"你感恩什么"然后让开。来源：https://alreadythere.life/best-gratitude-journal-app/ 等评测（C 级）。结合 A.3 的元分析：这类极简私密形态本身就有 g≈0.2 的效应。
- **【B/A】Replika（方向不同，但提供了一个昂贵的教训）**：2023-02 Luka 突然移除亲密角色扮演（ERP）功能，付费用户出现严重情绪危机——Reddit/Discord 上用户描述"in crisis"、"heartbreak"，版主置顶自杀干预热线；意大利数据保护局同期因缺少年龄验证下令停止处理意大利用户数据；2023-05 对 2023-02-01 前注册的老用户恢复旧版本。学术复盘见 *Socius* 2024。来源：https://oecd.ai/en/incidents/2023-03-18-32ef ; https://www.vice.com/en/article/replika-brings-back-erotic-ai-roleplay-for-some-users-after-outcry/ ; https://journals.sagepub.com/doi/10.1177/23780231241259627
  - **教训**：当产品承载的是**情感依赖**时，"改产品"等于"改一段关系"。任何削减已给出的情感承诺的变更，其反弹强度不能按功能变更来估。我们的"加油卡""被加油次数""历史记忆"一旦上线，就近乎不可回收。

---

## B. 无法提现的虚拟激励体系怎么设计才不崩

### B.1 Reddit Coins / Awards：一个完整周期的反面教材（最重要的一节）

这个案例难得地走完了"建立 → 膨胀 → 取消 → 简化重启 → 再反悔"的全过程。

- **【B】2023-07-14 宣布取消，2023-09-12 彻底下线。** 官方口径："It's become clear that awards and coins as they exist today need to be re-thought, and the existing system sunsetted."
  - 给出的理由是**复杂度**：用户不喜欢"awards 带来的杂乱（clutter）和送出一个 award 所需的那一堆步骤"；当时可选 award **超过 50 种**；同时 redditor 希望"被奖励的内容更有价值"。
  - 时机灾难：正撞上 API 收费引发的全站抗议（8000+ 版块 48 小时黑屏），宣布时**连替代方案都还没有**，只说"未来几个月"再讲新方向。来源：https://techcrunch.com/2023/07/14/reddit-is-killing-its-gold-awards-system/ ; https://www.androidauthority.com/reddit-sunsets-gold-awards-system-3345298/
- **【B】2024-05-16 重新上线，且承认过渡方案失败。** Reddit 表示替代品"Golden Upvotes"**"wasn't as fun or expressive as legacy awards"**，且**对接收者的好处不清晰（unclear benefits for recipients）**，所以回退。新版：买 gold 送 award，单个 award 平均 15–50 gold；gold 档位 $1.99/100 起、最高 $49.99/2750；新的 award 按钮与排行榜。同月另把付费贡献者计划扩展到 35 国，**用真钱奖励有价值的贡献**。来源：https://techcrunch.com/2024/05/16/reddit-reintroduces-its-awards-system/
- **提炼出的四条因果（前三条是 A/B 级事实，第四条是推测）**：
  1. **SKU 膨胀是死因之一。** 50+ 种 award = 没有一种有意义。
  2. **送出成本（步骤数）是死因之一。** 善意的摩擦系数必须接近零。
  3. **"接收方得到了什么"说不清，体系就撑不住。** Reddit 自己两次踩这条——legacy awards 让人觉得杂乱、Golden Upvotes 让人觉得"收到了也不知道图什么"。
  4. **【推测】** Reddit 后来把"真钱"单独放进贡献者计划，把"表达"留给 gold/awards，是**有意把两条路分开**。我们的场景更极端（明确不可提现），所以只能走"表达"这条，必须把表达这条做得足够厚。

### B.2 稀缺性怎么维持：三种可抄的做法

- **【A/C】B 站硬币：不可用钱买，只能用时间挣，且每天上限极低。**
  - 【A，官方规则页】日常使用侧："每天单个账号正常使用网站1个小时（包括累积）在当天数据结算时获得 0.3 硬币"，凌晨 5 点结算；另有投稿获得（与点击数、被推荐积分数、被推荐硬币数相关的公式）。来源：https://www.bilibili.com/html/point.html
  - 【C，二手】普通用户绑定手机、等级≥Lv1 后每日登录 +1 硬币，一年最多 365 枚；"一键三连"要投 2 枚，等于**要攒两天才能给一个视频三连**；每天投币上限 3 枚；等级经验每天上限 65，其中 50 靠投币。来源：https://36kr.com/p/1872224788943364 ; https://www.135editor.com/essences/8098.html
  - 【B 级推论，36氪原文观点】正因为稀缺，"用户的每一次投币都需要深思熟虑，这大大帮助社区筛选出了真正有价值的内容"。
  - **【查证失败】** 官方规则页没有正面回答"硬币能否充值购买"。二手信息互相矛盾。落 ADR 前若要引用"B 站硬币不可购买"，需再查证。
- **【A】Finch：奖励只给"第一次"。** 每日首次给好友发 Good Vibes 才有 3 Energy + 2 Rainbow Stones，之后无限发但无奖励（B.1 的反面：摩擦为零，但**刷量无收益**）。来源：https://finch.fandom.com/wiki/Good_Vibes（C 级 Wiki，但与官方"不惩罚只鼓励"的定位一致）
- **【A/C】蚂蚁森林：靠"会过期"制造每日回访，靠"能被偷"制造社交钩子。**
  - 【B，中文权威媒体/机构】能量来自真实低碳行为（步行捐、共享单车、线下支付等）折算的个人碳减排量；**能量产生 72 小时后消失**，用户必须及时点击收集，也可以帮好友收将要消失的能量或"浇水"。来源：https://dialogue.earth/zh/2/44303/ ; https://www.woshipm.com/pd/2225893.html
  - 【C，产品博客】"偷能量"的平衡参数被调过：**最初好友可采集你 80% 的能量，后降到 50%；若某能量球已低于初始值 30%，则他人不可再收，只能本人收**。来源：https://www.woshipm.com/pd/2225893.html
    - **这组参数是本文最值得研究的一处微调**：它保证"被偷"永远只是社交趣味，不会真的伤到本人的积累感。
  - 【A，同行评审 + NBER】规模与因果：Hu, Wei, Xing, Zou（NBER w34074, 2025）——项目自 2016 年起**累计 7 亿+ 用户、资助种下 5 亿棵树**；发现"绿色体验机制"（所在城市植被增长更快的用户参与率显著更高）；**参与蚂蚁森林还外溢到对站外环保项目的捐赠增加，并提升整体支付宝使用**；受访者把"gamification and warm glow"列为关键动机。来源：https://www.nber.org/papers/w34074
  - 【A】动机结构（*IJERPH* 2022）：内在动机（享乐、无压力的需求满足、利他、认知需求、社交互动与情感需求）与外在动机（外部奖励、竞争）都显著影响参与。来源：https://pmc.ncbi.nlm.nih.gov/articles/PMC9779548/
  - 【查证失败】*Journal of Cleaner Production* 483 (2024) 144312, Bi 等《Gamification effects in green behaviors: A double-edged sword》——**标题明确指出游戏化是双刃剑，但正文与摘要我没拿到**（ScienceDirect 403）。只能确认文献存在。DOI: 10.1016/j.jclepro.2024.144312。**若要论证"游戏化会挤出真实动机"，必须先拿到这篇。**
- **【C】微博阳光信用：用信用分做"行为门票"而非"货币"。** 基础分 300、满分 900，691 分以上为优秀；五维度评估（内容贡献、身份特征、信用历史、社交关系、消费偏好）；每月初自动更新；分数直接决定**权限**——参与热评/热转通常需要 >680，620–680 以上非会员评论才能带图。来源：https://kefu.weibo.com/faqdetail?id=20820 ; https://kefu.weibo.com/faqdetail?id=20821（官方客服页，A 级）；权限阈值来自 https://zhuanlan.zhihu.com/p/369614587 等（C 级）
  - **可借鉴点**：阳光信用**不能买、不能送、不能提现**，它只是"你能做什么"的闸门。这是一种完全规避金融属性的激励，而且对治理有用。
- **【B】Duolingo Gems**：作为可购买的软货币存在，主要用途之一是 streak repair / streak freeze——漏了一天可以用 gem 修回来。来源（B/C）：https://medium.com/@salamprem49/duolingo-streak-system-detailed-breakdown-design-flow-886f591c953f ; https://duoplanet.com/duolingo-leagues-the-essential-guide-everything-you-need-to-know/

### B.3 "付费购买虚拟善意会不会让接收方觉得廉价"——我们最担心的那一点

查证结果：**有理论证据、有半个产品证据，没有一个完全对口的产品实验。**

- **【A，理论，强】** Ariely / Bracha / Meier 2009：外部金钱激励会挤出形象动机，且**公开场合挤出更严重**。→ 我们的"加油次数"是公开计数，正是最敏感的那种场合。来源：https://www.aeaweb.org/articles?id=10.1257%2Faer.99.1.544
- **【A，理论，中】** 效用启发：被感知的努力抬高感知质量（对"喜欢/质量"支持，对"金钱估值"复现失败）。→ "看得出他花了心思"比"他花了钱"更能打动接收方。来源：https://online.ucpress.edu/collabra/article/9/1/87489/197632/The-Effort-Heuristic-Revisited-Mixed-Results-for
- **【A，理论，强】** Burke & Kraut 2016：一键反馈对接收者福祉无可测效果。→ 如果"加油卡"退化成一键，它对接收方的心理收益可能接近零，无论它花了多少钱。
- **【B，产品，半对口】** Reddit 自己承认过渡方案"对接收者的好处不清晰"，并因此回退。→ **接收方感知，是这类体系唯一真正的验收标准。**
- **【B，产品，半对口】** Koko 事故：接收方一旦知道回应"不是真人费心写的"，效果消失（"Simulated empathy feels weird, empty."）。→ **这是"廉价感"最直接的一次实测**：不是钱让它变廉价，是"对方没在我身上花心思"让它变廉价。
- **【推测，但我认为置信度较高】** 因此"付费是否让善意变廉价"取决于**付费买到的是什么**：
  - 买"数量"（一次点 100 个加油）→ 必然廉价化，因为它抹掉努力信号。
  - 买"表达方式"（Finch Plus 多 4 种 Good Vibes；更好的卡面/措辞库）→ 不廉价化，因为努力信号不变，只是表达更丰富。
  - 买"给别人的额度"（我付费，系统让**更多陌生人有卡可发**）→ 【推测】可能最安全，因为接收方收到的仍是陌生人的自主选择，付费者获得的是"我供养了这片善意"的精神奖励。
- **【查证失败/空白】** 我没找到任何产品公开做过"付费善意 vs 免费善意的接收方感知"对照实验。**这是需要我们自己 A/B 的地方，不能靠抄。**

### B.4 通胀与系统发放

- **【A/B 级机制观察，非实验】** 三条能观察到的抗通胀阀门：
  1. **总量靠时间限流，而非靠售价**（B 站：每天 0.3~1 枚，天花板由"天"定义，不由钱定义）。来源：https://www.bilibili.com/html/point.html
  2. **存量会过期**（蚂蚁森林：能量 72 小时消失）。过期不仅制造回访，也**天然回收流通量**。来源：https://dialogue.earth/zh/2/44303/
  3. **奖励只奖首次行为，不奖重复行为**（Finch：每日首次 Good Vibes 才给石头）。来源：https://finch.fandom.com/wiki/Good_Vibes
- **【B】SKU 膨胀本身就是一种通胀**：Reddit 50+ 种 award 让每一种都不值钱，官方以"复杂/杂乱"为由全部下线。来源：https://techcrunch.com/2023/07/14/reddit-is-killing-its-gold-awards-system/
- **【推测】** "管理员可发放"是通胀的最大风险口。如果运营为了救冷启动大量空投加油卡，卡的稀缺性会在用户还没形成情感联结之前先被摊薄。可考虑的约束：管理员发放走**独立的、视觉上可区分的**批次（如"平台祝福"），不与用户自挣的卡混为同一物品——这样即使超发，也不污染用户手挣的那部分的意义。**这条是推测，没有产品先例支持。**

### B.5 合规：中国大陆虚拟道具 / 充值 / 未成年人（务必以原文为准，本节仅索引）

**B.5.1 "不可兑换法定货币"的法律依据现状（重要：老依据已废止）**

- **【A】《网络游戏管理暂行办法》（文化部令第 49 号）自 2019-07-10 起全文废止。** 来源：https://whly.gd.gov.cn/special_newzt/fzxc/rdzx/content/post_2935178.html
  - **所以不要再引用它第 19 条那句"虚拟货币不得兑换法定货币"。** 很多网上的合规文章还在引，已经过时。
- **【A】现行最明确的同类表述在 2023-12 国家新闻出版署《网络游戏管理办法（草案征求意见稿）》**（草案，**尚未生效**）：
  - 第二十六条："网络游戏出版经营单位不得将用户获得的网络游戏虚拟道具兑换成法定货币"（允许兑换小额实物，但内容与价值须合规）。
  - 第二十五条：同一企业不得同时经营网络游戏币发放和网络游戏币交易服务。
  - 第十八条："不得设置每日登录、首次充值、连续充值等诱导性奖励"；须设置用户充值限额、对非理性消费弹窗提示；不得纵容虚拟道具高价交易。
  - 第三十九~四十二条：不得向未成年人提供账号租售、游戏币及虚拟道具交易服务；不得提供随机抽取服务。
  - 来源（汉坤律所解读，B 级；草案原文需另取）：https://www.hankunlaw.com/portal/article/index/cid/8/id/13854.html
  - **对我们的两个警报**：
    1. 草案第十八条那句"不得设置每日登录、连续充值等诱导性奖励"**直接命中我们的签到/streak/每日赠卡设计**。该草案发布后引发市场震动并被撤下公开征求意见页面，**最终是否以此文本生效未知**。【推测】即使不生效，它也代表监管对"每日登录奖励"这一机制的明确态度，我们不应把签到奖励做成产品的承重结构。
    2. 我们若严格定位为"非游戏的情绪支持类应用"，上述《办法》适用性存疑——**这是必须请法务定性的第一个问题**：我们的"加油卡"是否落入"网络游戏虚拟道具"的监管范畴。

**B.5.2 单用途商业预付卡：大概率不适用，但要留证**

- **【A】《单用途商业预付卡管理办法（试行）》（商务部令 2012 年第 9 号）适用范围限于"从事零售业、住宿和餐饮业、居民服务业的企业法人"。** 来源：https://www.gov.cn/gongbao/content/2012/content_2292065.htm ; https://www.mofcom.gov.cn/zfxxgk/zc/gz/art/2021/art_82805c1937a64a4186ea15c23fc675c5.html
- **【A】北京市商务局官方政策解读明确：发行主体不包括文化、体育、娱乐、教育、旅游等行业企业；分类表以外的行业不适用本办法。** 来源：https://sw.beijing.gov.cn/zwxx/2024zcjd/202407/t20240710_3742273.html ; https://sw.beijing.gov.cn/zwxx/2024zcjd/202407/t20240710_3742272.html
- **结论（A 级推断）**：互联网虚拟道具充值**不落入**单用途商业预付卡监管。用户提问里的这条大概率是虚警。**但不能因此认为"充值无监管"**——见下条。

**B.5.3 真正管我们充值的是预付式消费司法解释**

- **【A】最高人民法院《关于审理预付式消费民事纠纷案件适用法律若干问题的解释》，2025-05-01 起施行。**
  - 适用范围：经营者收取预付款后"多次或者持续向消费者兑付商品或者提供服务"产生的纠纷；明确列举"零售、住宿、餐饮、健身、出行、理发、美容、培训、养生、托育、养老、旅游等生活消费领域"；**明确排除**"一次性接收商品或接受服务"及多用途预付卡纠纷。
  - 未成年人条款（第十条第二款原文）："限制民事行为能力人与经营者订立预付式消费合同，向经营者支付预付款，法定代理人请求确认合同无效、经营者返还预付款的，人民法院应予支持，但该合同经法定代理人同意、追认或者预付款金额等合同内容与限制民事行为能力人的年龄、智力相适应的除外。"
  - 来源：https://www.court.gov.cn/zixun/xiangqing/459321.html
  - 【推测】"充钱买加油卡、之后陆续消耗"在结构上**很像**"预付款 + 多次兑付服务"。该解释未点名虚拟道具，但也未排除。**这是法务要定性的第二个问题。**

**B.5.4 未成年人充值与退款（红线最硬的一块）**

- **【A】《未成年人网络保护条例》**：2023-09-20 国务院第 15 次常务会议通过，**2024-01-01 起施行**。来源：https://www.cac.gov.cn/2023-10/24/c_1699806932316206.htm ; https://www.moj.gov.cn/pub/sfbgw/gwxw/xwyw/202310/t20231024_488320.html
- **【A】充值限额（国家新闻出版署 2019 年防沉迷通知口径，被后续行业规范沿用）**：
  - 未满 8 周岁：**不得提供付费服务**
  - 8–16 周岁：单次 ≤ 50 元，每月累计 ≤ 200 元
  - 16–18 周岁：单次 ≤ 100 元，每月累计 ≤ 400 元
  - 来源：http://legalinfo.moj.gov.cn/zhfxfzzx/fzzxyw/202406/t20240604_499885.html
- **【A】退款责任划分（中国互联网协会团体标准《网络游戏行业未成年人消费管理规范（征求意见稿）》，2024-06，游戏行业首个退费规范）**：
  - 企业未接入实名认证或未落实充值限额：**企业承担 100%**
  - 企业已配置防沉迷措施、但监护人协助绕过：**企业承担 30%–70%**，监护人承担其余
  - 来源：同上 http://legalinfo.moj.gov.cn/zhfxfzzx/fzzxyw/202406/t20240604_499885.html
- **【A】最高法关于未成年人网络付费可退的既有裁判口径**："限制民事行为能力人未经其监护人同意，参与网络付费游戏或者网络直播平台'打赏'等方式支出与其年龄、智力不相适应的款项，监护人请求网络服务提供者返还该款项的，人民法院应予支持。"（《关于依法妥善审理涉新冠肺炎疫情民事案件若干问题的指导意见（二）》，2020）来源：https://sft.hubei.gov.cn/fbjd/zfyw/202005/t20200520_2279288.shtml
- **【B】投诉规模参考**：2024 年前 7 个月未成年人游戏充值投诉超 3 万件。来源：https://m.bjnews.com.cn/detail/1723510366168086.html
- **对我们的硬结论（A 级）**：
  1. 只要有任何付费入口，就必须有实名 + 年龄分层 + 限额 + 弹窗提示，**否则退款时承担 100%**。
  2. 匿名是我们的产品承重墙，而实名是付费的合规前提。**"匿名展示 + 实名结算"必须在架构上分层**（这与 A.4 的存储隔离要求方向一致）。
  3. 未成年人友好的最简解法：**付费功能对未成年账号整体关闭**，把"精神奖励"全部留在免费侧。

---

## C. 集体活动 + 勋章 + 习惯养成

### C.1 Keep：用户点评的"大杂烩"到底指什么

- **【B】底部 tab 的一次公开可查的变化（2026-04，Keep 9.0）**：
  - 改版前：**首页、今日、运动、商城、我的**
  - 改版后：**课程、日程、运动、发现、我的**
  - 被批评的具体形态：旧版"顶部是搜索和一堆营销人设化的入口（社区、推荐、课程、计划、奖牌、比赛、路线）"，中部推荐位，下方双列 Feed，底部五个 tab。
  - 评论原文两句值得直接引用："这其实是过去十年所有互联网 App 的共同毛病：**把自己当成一个购物中心，每层楼都要摆个招牌**"；作者朋友的吐槽是"Keep 已经变成我打开后有点茫然的健身 App"。
  - 作者定性这次改版是"更新了，不，是更旧了"——即**回归工具属性、削弱电商属性**。
  - 来源：https://news.qq.com/rain/a/20260427A076B700
  - **注意时效**：这是 2026 年的改版，不是 Keep 变成大杂烩的过程记录。**【查证失败】** 我没有找到 Keep 历年 tab 结构的权威变更时间线。用户说的"大杂烩"在这篇里得到了印证，但演变过程只查到结果。
- **【B】商业侧的数字，解释了"为什么会变成大杂烩"**：
  - 月活增速崩塌：2019–2022 平均月活同比增速从 **36.6% 降到 5.9%**；月订阅用户同比增速从 **148.1% 降到 10.4%**。
  - 2023 年首次负增长：平均月活比 2022 年减少 **663 万+**，降至 **2975.6 万**；平均月订阅会员约 **319.3 万**，同比 **-11.8%**——两项自 2019 年以来首次负增长。
  - 会员留存率逐年下滑：2020/2021/2022 分别 **73.3% / 71.7% / 65.3%**。
  - 来源：https://www.jiemian.com/article/15048274.html ; https://news.qq.com/rain/a/20260903A03GP500
  - **【推测】** 工具型产品的增长天花板 → 靠加品类（商城、课程、奖牌、赛事）换营收 → tab 被塞满 → 体验变"购物中心"。这是"大杂烩"的经济成因，不是审美失误。
- **【B】奖牌/线上赛：Keep 把"勋章"做成了真生意，也做出了真问题。**
  - 增长期：2022 Q1"线上付费内容"收入 4000 万元、同比 **+700%**，由奖牌线上赛驱动；2023 上半年会员订阅及线上付费内容收入 **4.49 亿元、同比 +10%**，占总收入从 40% 升至 **46%**；与三丽鸥（Hello Kitty）、蜡笔小新、樱桃小丸子、名侦探柯南等 IP 联名，报名费 **29–139 元**，2023 年 6–8 月一个游戏 IP 联名赛吸引 **100 万+** 人参与。来源：https://www.nbd.com.cn/articles/2023-08-27/2984412.html ; https://m.mp.oeeee.com/a/BAAFRD000020230827838128.html
  - 衰退期（2024-08 报道，作者：木予/新浪财经上市公司研究院）：线上会员及付费内容收入 **4.37 亿元、同比 -2.6%**，"近五年半以来第一次出现缩水"；虚拟体育赛事成本下降 1440 万元；**"报名用户多则数十万，少则不到百人"**，曾经热门的 IP 赛事参与者"仅浮动在 1000 人上下"；黑猫投诉累计 **24383 条**，近 30 天 179 条中约 **80%** 涉及"奖牌有瑕疵、发货延迟、退换困难"；平均月活 2966 万、同比 +0.4%。来源：https://m.lejucaijing.com/news-7234799476371289138.html
  - **这是"集体活动冷清"这个灾难的实证**：同一个平台、同一套机制，头部赛事几十万人，尾部赛事不到一百人。**冷清不是小用户量独有的问题，是活动数量一多就必然出现的分布问题。**
  - **【推测】** 另一条教训：勋章一旦挂上实体交付（寄一枚金属牌），就把情绪价值绑上了供应链风险，24383 条投诉里 80% 是物流和质量问题——**情绪产品最好不要自己扛物流**。

### C.2 Strava Kudos：一键善意做得最成功的案例

- **【A】量级（Strava 官方 Year in Sport）**：2025 年给出 **140 亿次 kudos**，同比 **+20%**；2022 年 99 亿次；2023 年超 100 亿次。来源：https://press.strava.com/articles/strava-releases-12th-annual-year-in-sport-trend-report-2025 ; https://press.strava.com/articles/strava-releases-year-in-sport-report
- **【A】它不只是虚荣指标——有纵向网络分析证据表明 kudos 会改变行为。** "Kudos make you run! How runners influence each other on the online social network Strava"，*Social Networks* 2022（5 个荷兰跑团、329 名成员，纵向网络分析）：**收到 kudos 使跑者跑得更多、更频繁**；跑者会把自己的跑步行为向"kudos 好友"（自己给出 kudos 的对象）靠拢。来源：https://www.sciencedirect.com/science/article/pii/S0378873322000909
- **【A】机制解释与副作用**：kudos 可能提升自尊、内在动机与集体效能，并把跑步从孤独行为变成社会行为，**把注意力从训练的痛苦转移到社交回报上**；但同一批文献也指出 Strava 带来压力、比较与焦虑，尤其在受伤或表现下滑时。2026 年一项 225 名跑者的混合方法研究发现 Strava 网络更大的跑者自我效能更高。来源：https://pmc.ncbi.nlm.nih.gov/articles/PMC12938745/ ; https://www.researchgate.net/publication/346678505
- **为什么 Kudos 成立而 Facebook 的"赞"不成立（对照 A.3）**：
  - **【推测，但有结构依据】** kudos 附着在一个**具体的、有成本的行为**上（你跑了 10 公里），所以"被看见"这件事本身携带信息；Facebook 的赞附着在任意内容上。→ 对我们的启示：**"加油"必须精确锚定"他此刻正在扛的那件事"**，锚点越具体，一键就越不廉价。

### C.3 Duolingo：排行榜的正确尺寸，以及 streak 的真实杠杆

- **【B，前 CPO Jorge Mazal 亲述】** 四年 DAU 增长 **4.5 倍**；起初同比增长只有个位数。
  - 最重要的指标是 **CURR（现有用户留存率）**，"CURR 对 DAU 的影响是第二名指标的 **5 倍**"；他们把 CURR 提升了 **21%**，相当于日流失下降 **40%+**。
  - **Leaderboards / Leagues**：学习时长 **+17%**；高强度学习者（每天 1 小时+、每周 5 天）**增至三倍**；D1/D7 显著改善。
  - **Streak**：达到 10 天 streak 后流失风险大幅下降；"streak-saver"通知非常有效；**7 天以上 streak 的用户从少数占比上升到 DAU 的一半以上**。
  - 反例自述："the Duolingo moves counter was simply a boring, tacked-on nuisance. It was **the wrong gamification mechanic**."
  - 来源：https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- **【B/C】League 的尺寸是刻意设计的：每周 30 人随机同组，按 7 天 XP 排名，每周重置**；即使 Duolingo 有数千万用户，任一用户看到的榜上只有 20–30 人，"小到任何肯出现的人都有可能进前五"；系统还按节奏配对（每周 5 课的人不会被丢进每周 100 课的人堆里）。来源：https://duolingo.deconstructoroffun.com/mechanics/leagues ; https://blog.duolingo.com/duolingo-leagues-leaderboards/（官方 blog，A 级，但未细读具体数字）
- **【B/C】排行榜设计的通用原则**："设计糟糕的排行榜为了激励少数人而打击多数人；全局排名奖励前 1%、压抑其余。"把比较范围**缩到同群组/同节奏**，能把打击性指标变成对 100% 用户而非 1% 用户有激励的指标。来源：https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/
- **【C】游戏化的反面案例（学术）**："When Gamification Spoils Your Learning: A Qualitative Case Study of Gamification Misuse in a Language-Learning App"（arXiv 2203.16175）——存在，未细读。来源：https://arxiv.org/pdf/2203.16175

### C.4 Nike Run Club / Apple Fitness：勋章体系的设计原则

- **【B】NRC 的成就阶梯覆盖"第一个 5K"到全马到终身累计距离**，从第一天就让高难目标可见，同时保证前几次跑步内就能拿到早期奖励。徽章**没有货币价值**，只有炫耀权，可分享或只留在自己的活动日志里自己看。
- **【B】最值得抄的一句设计哲学**："The design of the app very much focuses on **what you have achieved, instead of what you have missed**."；且 NRC 的游戏化主要建立在**与过去的自己竞争**上，而非与他人竞争。
- 来源：https://medium.com/design-bootcamp/how-the-nike-run-club-app-got-runners-hooked-2850c7654fc5 ; https://www.strivecloud.io/blog/gamification-examples-nike-run-club ; https://trophy.so/blog/nike-run-club-gamification-case-study
- **【查证失败】** 用户提到的"Apple Fitness Award"——我没找到关于 Apple 徽章体系被批评"太多、无意义"的可靠一手材料。**不要在文档里写这条批评。**

### C.5 微信运动：熟人点赞 + 占领封面

- **【C】机制**：日步数 + 好友排名；第一名可"占领"好友的封面（自定义背景图出现在好友的运动页）；个人页显示自己占领了多少位好友的封面；点赞会触发通知，进一步刺激用户提升排名。来源：https://www.woshipm.com/pd/1255548.html ; https://blog.csdn.net/lssffy/article/details/142619288 ; https://www.digitaling.com/articles/23955.html
- **可抄的点（【推测】）**："占领封面"是一种**非货币的、有独占性的、可被所有好友看见的**荣誉。它的成本为零、无法购买、每天重置。对"不可提现的精神奖励"是个很好的形态样板。
- **反面（【推测】）**：它建立在**熟人关系**上。我们是匿名陌生人，不能直接搬"占领好友封面"，需要找匿名场景下的等价物。

### C.6 集体活动如何在小用户量下不显得冷清

这块没有现成的"最佳实践论文"，但把几个证据拼起来能得到可用的设计约束。

- **【A】蚂蚁森林"合种"给出了最完整的小队样板（中文场景）**：主题分爱情树（限 2 人）、家庭树、好友树、同学林、同事林等；**每人最多参与 10 个合种小队**；非爱情树最多 **60 人**；发起者可设置"好友是否可参与""好友的好友是否可参与"的权限；能量靠成员浇水，**每人每天最多浇 500g**；证书由历史贡献能量最多的成员去兑换，**但每个成员都能获得证书**。来源（C 级，产品社区与媒体）：https://www.digitaling.com/projects/25606.html ; https://www.sohu.com/a/218491521_632138 ; https://zhuanlan.zhihu.com/p/140727119
  - 拆出四条可迁移的设计：① **小队有明确人数上限**（2–60），不是"全平台一个大活动"；② 每人**每天贡献有上限**，所以 60 人满编时"一天能种一棵树"是可达的确定承诺；③ 权限可控（决定小队是封闭还是可裂变）；④ **奖励给全员，而不只给第一名**。
- **【B】Duolingo League：30 人一组、随机分配、每周重置、按节奏配对。** 30 人这个数字的作用是"让前五名对任何人都是可能的"。来源见 C.3。
- **【B】Keep 的反证**：同一平台上，尾部赛事"少则不到百人"。→ **活动数量多于需求时，必然产生冷清的长尾。** 来源见 C.1。
- **由此得到的约束（【推测】，但每条都有上面的事实支撑）**：
  1. 集体活动的单位必须是**小队/小组（个位数到几十人）**，不是"全站活动"。冷清是"分母太大"造成的观感问题。
  2. 进度条要用**可达的确定承诺**表达（"我们 20 人，每人 1 次，今天就能点亮"），不要用"距离目标还差 98%"。
  3. 奖励**全员可得**，避免只奖第一名。
  4. **同时只开极少数活动**（甚至一次只开一个），宁可排队也不要并行一堆空场子。
  5. 【推测】冷启动期可考虑把"系统/运营的参与"显式标注为平台身份（不伪装成用户），既补人气又不欺骗——这条与 A.6 的教训方向一致：**兜底供给可以做，伪装成真人不可以做。**

### C.7 streak 在"情绪健康"场景下的伦理风险

这是用户点名要的，也是我认为最该写进 ADR 的一节。

- **【A，同行评审，明确批评】** *Frontiers in Psychiatry* 2025，"Digital wellness or digital dependency? A critical examination of mental health apps and their implications"：
  - "**Streak-based incentives in apps like Headspace and Calm promote habitual use over genuine improvement**, while AI-driven chatbots such as Woebot simulate therapeutic conversations without the adaptability or depth of professional intervention."
  - 这些应用使用"variable rewards, push notifications, and streak-based incentives, which **condition users to return habitually rather than engage meaningfully with their mental health**"。
  - 来源：https://pmc.ncbi.nlm.nih.gov/articles/PMC12003299/
- **【A，Headspace 官方立场】** 官方文章明确："if we think it is about the number itself, then we are missing the point"；对 streak 的执着会制造不必要的压力与竞争（与自己或他人）；"**we all miss days, and that's okay**"；有些人本来就不想每天冥想，这完全可以；重点是注意到自己漏了，然后继续下一次；**并建议用户自行决定与 streak 的关系——有激励作用就留着，引发焦虑就忽略它**。来源：https://www.headspace.com/articles/building-a-meditation-practice
- **【A，Finch 官方做法】** streak 的达成门槛降到"**打开 App 就算**"（just checking in is enough）；漏了一天可以**用彩虹石修复**。来源：https://help.finchcare.com/hc/en-us/articles/37780736136205-Understanding-Streaks
- **【B】Finch 的整体态度**：长期不用也只发鼓励，不发惩罚——"Where Duolingo found success in its cheeky, sometimes abrasive reminders, **Finch opts for gentle parenting**." 来源：https://slate.com/technology/2026/09/finch-app-self-care-wellness-review.html
- **【C】用户侧的真实伤害描述**（博客/社区，证据弱但方向一致）：住院期间漏掉冥想、丢掉 200 天 streak，结果感觉更糟；"you missed your session!" 的通知加重焦虑；"建立 streak → 漏一天 → 内疚 → 彻底放弃"的模式；有抑郁、焦虑、完美主义倾向的用户尤其脆弱。来源：https://steadyline.app/blog/why-i-dont-gamify-mental-health ; https://www.soulumanifest.com/guides/habit-tracker-anxiety
- **【C，需复核】** 多处二手材料引用"UCL 的习惯养成研究发现漏掉单独一天对长期习惯养成没有可测影响"（指向 Lally 等人的研究）。**我没有拿到一手论文，引用前须补。**

---

## D. 可以直接抄的机制清单

按"抄什么 / 为什么有效（证据） / 在我们场景里要改什么"三栏写。

### D.1 回应端

| # | 抄什么 | 为什么有效 | 我们要改什么 |
|---|---|---|---|
| 1 | **Panoply 的三类结构化回应 + 3-5 分钟微培训 + 正反例 + 小测验** | A 级：RCT 里抑郁 d=-0.36，重评能力改善并中介了效果（*JMIR* 2015） | 培训要压到**秒级**，不能是 3-5 分钟的模块。做法：把培训折叠进第一次回应的引导流里（"先看两个例子，再选一个句式"）。三类改为适配我们的场景（陪伴 / 加油 / 换个角度看），"debug（挑思维扭曲）"这一类风险高，**先不做** |
| 2 | **Finch Good Vibes：固定 14 种预制善意 + 每天首次发送才给奖励** | A/C 级：摩擦为零、刷量无收益。与 Reddit 因"送出步骤太多"而崩形成对照 | 我们的"加油卡"就对应这个位置。**预制卡面数量要少**（Reddit 的 50+ SKU 是死因），起步 6–10 种为宜；奖励只给每日首次 |
| 3 | **分层回应：一键 + 预制短语 + 可选自由文字，三层同屏但默认最低摩擦** | A 级：一键对接收者福祉无可测效果（Burke & Kraut 2016）；文字（陌生人、被结构化引导）有效（Panoply） | 关键是**给接收方看的展示要区分层级**：一键计数聚合显示（"127 人为你加油"），写了字的单独陈列。否则努力信号被抹平 |
| 4 | **HAILEY 式 AI 辅导写作者（不代写）** | A 级：300 人 RCT，共情 +19.6%，困难者子组 +38.9%，无过度依赖 | 反例同样清楚：AI 代写在盲评下更好、但**接收方一旦知情就失效**（Koko 2023）。所以只做"提示/润色建议"，最终文本必须是人按下发送的，且**不可伪装** |
| 5 | **Koko 式结构性治理：无私聊 + 全量自动筛查 + 命中人工复核 + 自动去标识 + 危机关键词库 + 热线转介** | A 级（官方口径），目标违规率 <1/10000 | "无私聊"对我们是**免费的巨额治理红利**，架构上就别留这条路。危机关键词库要自建中文版；转介对象要换成中国大陆的求助资源 |

### D.2 供给分配（最该优先做的一块）

| # | 抄什么 | 为什么有效 | 我们要改什么 |
|---|---|---|---|
| 6 | **付费/运营兜底回应供给（Panoply 用 MTurk）** | A 级：保证了 9 分钟中位回应时延；他们把"必有回应"当产品承诺而非自然结果 | 把"零回应率"设成核心 SLO。兜底来源可以是运营/志愿者，但**必须显式标注平台身份**（Koko 教训：不可伪装成普通用户）。不要用 AI 代写来兜底 |
| 7 | **定向分配而非全站广播** | A 级：旁观者效应——6 人组施救率 31% vs 独自 85%；在线复现且随群体规模非线性下降 | 一条忧思**定向推给 N 个人**并明确"这条指给你"。N 要小。冷回的自动重投给下一批 |
| 8 | **异步、多人各写一小段，而不是实时 1:1 陪聊** | A 级 + 用户报告：7 Cups 的实时 1:1 长期供给失衡（等 30 分钟以上、在线不接、一人接多人质量下滑） | 我们已经是异步模型，**守住它**，不要因为"陪伴感"而滑向实时聊天 |

### D.3 虚拟激励（加油卡）

| # | 抄什么 | 为什么有效 | 我们要改什么 |
|---|---|---|---|
| 9 | **B 站硬币式"时间限流"：额度由天定义，不由钱定义** | A 级官方规则（0.3 枚/小时正常使用）+ B 级分析：稀缺让每一次给出都要深思 | 初始赠 10 张 + **每日自然恢复少量**（而非按付费恢复）。每日上限要低到"给谁"成为一个真实选择 |
| 10 | **蚂蚁森林式"会过期"** | A/B 级：能量 72 小时消失，制造每日回访，同时天然回收流通量 | **慎用**：对情绪产品，"你的卡快过期了"这类通知有胁迫感（见 D.5 反面清单）。可以让**赠予额度**过期，但**绝不让"被加油的历史记录"过期**——那是产品承诺的"美好记忆" |
| 11 | **Finch Plus 式"付费买表达方式，不买数量"** | A/C 级：付费额外解锁 4 种 Good Vibes；理论支撑是 Ariely 2009（金钱激励挤出形象动机，公开场合更严重）+ 效用启发（努力抬高感知质量） | 付费**不得**提高单次加油的权重、不得批量发放、不得在接收端显示"这是付费用户送的"。付费买到的是卡面/措辞库/收藏册，或"供养别人有卡可发" |
| 12 | **微博阳光信用式"积分只做权限闸门，不做货币"** | A 级官方规则（基础 300、满分 900、月度更新、五维度）；它不可买、不可送、不可提现 | 用来管治理（谁可以回应高风险贴、谁的回应优先展示），而不是用来兑换东西。**这条同时解决合规和质量** |
| 13 | **Reddit 的教训反向抄：SKU 极少 + 送出零步骤 + 接收方收益说得清** | B 级：Reddit 两次失败的自述理由就是这三条（50+ awards 太杂乱、步骤太多、对接收者好处不清） | 我们的北极星页面就是"我被加油了多少次"——**接收方收益天然清楚**，这是我们相对 Reddit 的结构性优势，别浪费它 |

### D.4 集体活动 + 勋章 + 习惯

| # | 抄什么 | 为什么有效 | 我们要改什么 |
|---|---|---|---|
| 14 | **Duolingo League 的尺寸：~30 人一组、随机、按节奏配对、每周重置** | B 级前 CPO 亲述：学习时长 +17%、高强度用户增至三倍；小到"前五名对任何人都可能" | 我们不要"XP 排名"（情绪场景下比较谁更努力是有害的）。**抄尺寸和重置节奏，换掉排名维度**——比如"这周我们这组一起给出了多少次加油"，只排集体不排个人 |
| 15 | **蚂蚁森林合种：小队有人数上限（2–60）、每人每日贡献有上限、权限可控、证书全员可得** | A/C 级：60 人 × 500g/天 = "一天种成一棵树"是可达的确定承诺 | 直接可用作"集体活动"的骨架。把"种树"换成集体善意目标；**奖励全员可得这条不要改** |
| 16 | **Strava Kudos：一键善意锚定在一个具体、有成本的行为上** | A 级：*Social Networks* 2022，收到 kudos 使人跑得更多更频繁；2025 年 140 亿次、同比 +20% | 我们的锚点是"他此刻正在扛的那件事"。锚点越具体，一键越不廉价。**不要做"给这个人点赞"，要做"为这件事加油"** |
| 17 | **NRC 的勋章哲学：只显示你达成了什么，不显示你错过了什么；主要与过去的自己比** | B 级；配合 C.7 的伦理证据，这是情绪场景下唯一安全的比较方式 | 全部勋章都做成**累积型**（"你为 100 个陌生人加过油"），不做**连续型**（"连续 30 天"）或**排名型** |
| 18 | **Finch 式温柔 streak：打开就算 + 可修复 + 长期不用只发鼓励** | A 级官方帮助中心 + B 级评测（"gentle parenting" vs Duolingo 的刺头式提醒） | 更激进一点：**在我们这里默认不显示 streak**，把连续性表达成"你的善意足迹"这类只增不减的累积物。想要 streak 的用户可以自己打开 |
| 19 | **Headspace 式官方立场：把"漏了也没关系"写进产品文案** | A 级官方文章："we all miss days, and that's okay"；并建议用户自行决定与 streak 的关系 | 我们应该更进一步：**把"关掉所有连续性/数量提示"做成一个明确的设置项**，因为我们的用户基线情绪比冥想用户更低 |

### D.5 形态与文案

| # | 抄什么 | 为什么有效 | 我们要改什么 |
|---|---|---|---|
| 20 | **Vent 的反应集合全正向、无任何负向按钮；情绪可视化（颜色）** | B 级：HUG/NICE/AWW/H4U/UGH/OMG/YAY，无 downvote | 直接抄"无负向按钮"。颜色化情绪可考虑，但注意它会把"我现在很糟"变成公开可见的状态 |
| 21 | **极简输入是有学术依据的，不是妥协** | A 级：2025 *PNAS* 元分析，感恩类干预 g=0.19，且**干预长度与效应量无关**，支持简短干预 | 可以在产品文案和内部决策里放心引用：**"秒级输入"不是功能缩水，是有效剂量** |
| 22 | **Presently 式"什么都不加"的选项** | B/C 级：无提醒、无 streak、无 AI、无图表，问完就让开 | 提供一个"纯净模式"：只写、只收加油，不看任何数字、勋章、活动。这同时是 C.7 伦理风险的兜底出口 |

---

## E. 明确不要做的（反面教训）

每条都标了它来自谁的尸体。

### E.1 关于回应与 AI

1. **不要让 AI 代写回应，尤其不要不告知。** — Koko 2023：约 4000 人收到 AI 参与撰写的回应，盲评质量更高、响应快一半，但"once people learned the messages were co-created by a machine, it didn't work. Simulated empathy feels weird, empty."；引发无知情同意的伦理风暴。**这条是红线，没有折中版本。** 来源：https://www.nbcnews.com/tech/internet/chatgpt-ai-experiment-mental-health-tech-app-koko-rcna65110
2. **不要把"只有一键反应"当成完整的回应系统。** — Burke & Kraut 2016：一键反馈与接收者福祉改善无显著关联，也不提升关系强度。一键是入口，不是产品。
3. **不要做实时 1:1 陪聊。** — 7 Cups：等 30 分钟以上、在线不接、5 分钟内断开、一人接多人。**供给永远不够，而失败的体验比没有体验更伤人。**
4. **不要做用户间私聊。** — Koko 明确不提供 DM；Yik Yak / TalkLife 的骚扰与捕食问题主要走这条通道。**私聊是治理成本的主要来源，且不可逆。**
5. **不要把"帮你识别思维扭曲"这类干预开放给未训练的陌生人。** — Panoply 的 debug 类型是在有培训和审核的实验环境里跑的；TalkLife 一侧的研究同时报告了强化行为、反刍、触发内容、自伤正常化的风险。

### E.2 关于匿名与治理

6. **不要在出事后才削减匿名。** — Yik Yak：转向限制匿名发帖后用户失去兴趣，下载量从 2014-09 的 180 万降到两年后的 12.5 万，2017-04 关停。**匿名是承重墙，治理必须在保留匿名的前提下设计。**
7. **不要低估治理响应速度的杀伤力。** — Secret：对霸凌反应太慢，被 PandoDaily 称"morally bankrupt"，1500 万用户、3500 万美元融资，2015-04 关停退款。
8. **不要按"数据不会漏"来设计存储。** — Whisper：2020-03 约 9 亿条记录在无密码数据库中暴露，含性取向、性别、年龄、族裔、昵称、工作地点、最后发帖位置。**我们库里的东西比 Whisper 更敏感（"谁在什么时候难受成什么样"）。**
9. **也不要走到另一端做过度审核。** — 自伤相关研究明确指出 overmoderation 本身有害，需权衡自我表达的价值。

### E.3 关于虚拟激励

10. **不要做多品类奖励（SKU 膨胀）。** — Reddit：50+ 种 award，官方以"杂乱 + 送出步骤太多"为由全部下线（2023-07 宣布 / 2023-09 下线）。
11. **不要在没有替代方案时下线一个已上线的激励体系。** — Reddit 同上：宣布时还没有替代品，只说"未来几个月"，撞上 API 抗议，反弹极大；2024-05 回退，并承认过渡方案"wasn't as fun or expressive"、"对接收者的好处不清晰"。
12. **不要让付费提高单次善意的权重，也不要在接收端标注"付费用户"。** — 理论：Ariely / Bracha / Meier 2009，金钱激励挤出形象动机，**公开场合挤出更严重**，而我们的"被加油次数"正是公开计数。产品侧半对口证据：Reddit 承认"对接收者的好处不清晰"是失败原因。
13. **不要允许批量/无上限发放加油。** — B 站硬币的价值来自"一年只有 365 枚"；Finch 只奖每日首次。**能刷的善意等于没有善意。**
14. **不要让系统/管理员的空投与用户手挣的额度混为同一物品。** —【推测，无先例支持】但通胀逻辑清楚：冷启动期的大量空投会在用户形成情感联结之前先摊薄稀缺性。
15. **不要让"被加油的历史"过期或衰减。** — 蚂蚁森林让**能量**过期（72 小时）是为了回访，但我们的"历史数据代表美好记忆"是产品承诺。**过期赠予额度可以，过期记忆不行。**
16. **不要轻易削减已经给出的情感承诺。** — Replika 2023-02 移除 ERP：用户"in crisis"、版主置顶自杀热线、意大利 DPA 介入，2023-05 对老用户回退。**承载情感依赖的功能，其变更反弹不能按功能变更来估。**

### E.4 关于合规

17. **不要引用《网络游戏管理暂行办法》第 19 条。** 该办法 2019-07-10 已全文废止。网上大量合规文章仍在引用。
18. **不要把"每日登录奖励 / 连续充值奖励"做成产品的承重结构。** — 2023-12《网络游戏管理办法（草案征求意见稿）》第十八条曾明确"不得设置每日登录、首次充值、连续充值等诱导性奖励"。该草案未生效、征求意见页已撤下，但**它代表监管对这一机制的态度**。
19. **不要在未做实名 + 年龄分层 + 限额 + 弹窗提示的情况下开任何付费入口。** — 中国互联网协会 2024-06 团体标准：未接入实名认证或未落实充值限额的，**企业承担 100% 退费责任**；已配置防沉迷但被监护人协助绕过的，企业仍承担 30%–70%。
20. **不要让未成年账号接触付费。** — 未满 8 周岁不得提供付费服务；8–16 岁单次 ≤50 元 / 月 ≤200 元；16–18 岁单次 ≤100 元 / 月 ≤400 元。**最简解是对未成年账号整体关闭付费。**

### E.5 关于集体活动与勋章

21. **不要同时开一堆活动。** — Keep（2024-08 报道）：同平台上"报名用户多则数十万，少则不到百人"，曾经热门的 IP 赛事跌到 1000 人上下。**冷清是活动数量的函数，不只是用户量的函数。**
22. **不要把勋章绑上实体交付。** — Keep 黑猫投诉累计 24383 条，近 30 天 179 条中约 80% 是"奖牌有瑕疵、发货延迟、退换困难"。**情绪产品扛不起物流。**
23. **不要为了营收把 tab 塞成"购物中心"。** — Keep：底部五 tab + 顶部一排营销入口（社区/推荐/课程/计划/奖牌/比赛/路线）+ 双列 Feed，被评"把自己当成一个购物中心，每层楼都要摆个招牌"、"打开后有点茫然"。**这是用户点名的那个问题，机制上的成因是增长见顶后靠加品类换营收（月活增速 2019→2022 从 36.6% 降到 5.9%，2023 首次负增长）。**
24. **不要做全站排行榜或个人间排名。** — "设计糟糕的排行榜为了激励少数人而打击多数人"；Duolingo 用 30 人小组 + 节奏配对解决。情绪场景下**连"谁更努力"都不该排**。
25. **不要做连续打卡 streak 作为主机制。** — *Frontiers in Psychiatry* 2025 点名批评 Headspace / Calm 的 streak"promote habitual use over genuine improvement"、"condition users to return habitually rather than engage meaningfully"；Headspace 官方自己说"we all miss days, and that's okay"；Finch 把门槛降到"打开就算"且可用石头修复。**打卡失败让本来就低落的人更自责，这个风险是被同行评审文献和厂商自己都承认过的。**
26. **不要发"你已经 N 天没来了"这类通知。** — NRC 的原则是"focus on what you have achieved, instead of what you have missed"；Finch 长期不用也只发鼓励。

---

## F. 尚未查清、落 ADR 前必须补的

1. **【查证失败】** *Journal of Cleaner Production* 483 (2024) 144312《Gamification effects in green behaviors: A double-edged sword》正文与摘要（ScienceDirect 403）。这是唯一一篇标题就指出游戏化负面效应、且场景疑似蚂蚁森林的同行评审文献。**要论证"游戏化挤出真实动机"必须先拿到它。** DOI: 10.1016/j.jclepro.2024.144312
2. **【查证失败】** B 站硬币"能否用人民币购买"——官方规则页未正面回答，二手信息矛盾。
3. **【查证失败】** Keep 历年底部 tab 结构的权威变更时间线（只查到 2026-04 的一次改版结果与批评）。
4. **【查证失败】** Apple Fitness Award 被批评"太多/无意义"的可靠材料。**没查到，不要写。**
5. **【查证失败】** "漏掉单独一天对长期习惯养成无可测影响"（指向 Lally 等人 UCL 研究）的一手论文。
6. **【空白】** 没有任何产品公开做过"付费善意 vs 免费善意的接收方感知"对照实验。**这一条只能我们自己 A/B。**
7. **【需法务定性，两个问题】**
   - 我们的"加油卡"是否落入"网络游戏虚拟道具"的监管范畴？
   - "充钱买加油卡、之后陆续消耗"是否构成最高法《预付式消费司法解释》（2025-05-01 施行）意义上的"预付款 + 多次兑付"？
8. **【需另取原文】** 2023-12《网络游戏管理办法（草案征求意见稿）》原文（本文条款文字转引自汉坤律所解读，属 B 级）。

---

## G. 全部来源索引

**A 节 · 情绪支持产品**
- Panoply/Koko RCT（*JMIR* 2015）：https://pmc.ncbi.nlm.nih.gov/articles/PMC4395771/
- 7 Cups 产后抑郁研究（*JMIR* 2018）：https://pmc.ncbi.nlm.nih.gov/articles/PMC5829455/
- 7 Cups 精神分裂谱系适配：https://pmc.ncbi.nlm.nih.gov/articles/PMC6096212/
- HAILEY（TalkLife RCT, 2022）：https://arxiv.org/abs/2203.15144
- TalkLife 自伤纵向研究（*JMIR Mental Health* 2021）：https://mental.jmir.org/2021/1/e21854/
- 自伤数字资源质性研究：https://pmc.ncbi.nlm.nih.gov/articles/PMC9880808/
- Koko GPT-3 事故：https://www.nbcnews.com/tech/internet/chatgpt-ai-experiment-mental-health-tech-app-koko-rcna65110 · https://gizmodo.com/mental-health-therapy-app-ai-koko-chatgpt-rob-morris-1849965534 · https://incidentdatabase.ai/cite/449/ · https://www.popsci.com/technology/koko-ai-chatbot-mental-health/
- Koko 官方 FAQ / 匿名支持页：https://kokocares.org/faq · https://pages.kokocares.org/free-anonymous-support/
- Secret 关停：https://techcrunch.com/2015/04/29/psst/ · https://www.fastcompany.com/3045747/what-killed-secret
- Yik Yak 关停与重启：https://www.insidehighered.com/news/2022/03/07/yik-yak-re-emerges-after-shutdown · https://www.highereddive.com/news/anonymous-messaging-app-yik-yak-returns-after-4-year-shutdown/605120/
- Whisper 裁员/董事会/数据暴露：https://techcrunch.com/2017/07/28/whisper-layoffs · https://techcrunch.com/2017/08/29/every-board-member-of-anonymous-app-whisper-has-reportedly-stepped-down · https://www.comparitech.com/blog/information-security/secret-sharing-app-exposure/
- Vent 机制：https://medium.com/kinblog/developer-spotlight-on-vent-the-social-app-build-on-expressing-feelings-fd4ca780009f · Vent 数据集论文 https://arxiv.org/pdf/1901.04856
- r/KindVoice：https://reddit.guide/r/KindVoice/
- TalkLife 家长评论：https://www.commonsensemedia.org/app-reviews/talklife/user-reviews/adult
- 在线旁观者效应：https://link.springer.com/chapter/10.1007/978-3-030-34770-3_12 · https://www.simplypsychology.org/bystander-effect.html
- Burke & Kraut（*JCMC* 2016）：https://academic.oup.com/jcmc/article/21/4/265/4161784
- 感恩干预元分析（*PNAS* 2025）：https://pmc.ncbi.nlm.nih.gov/articles/PMC12280877/ · https://link.springer.com/article/10.1007/s41042-023-00086-6
- Finch：https://help.finchcare.com/hc/en-us/articles/37780736136205-Understanding-Streaks · https://finchcare.com/about-finch · https://finch.fandom.com/wiki/Good_Vibes · https://slate.com/technology/2026/09/finch-app-self-care-wellness-review.html · https://calmevo.com/finch-app-review/
- Presently 类感恩日记：https://alreadythere.life/best-gratitude-journal-app/
- Replika ERP 事件：https://oecd.ai/en/incidents/2023-03-18-32ef · https://www.vice.com/en/article/replika-brings-back-erotic-ai-roleplay-for-some-users-after-outcry/ · https://journals.sagepub.com/doi/10.1177/23780231241259627

**B 节 · 虚拟激励与合规**
- Reddit 取消 Coins/Awards：https://techcrunch.com/2023/07/14/reddit-is-killing-its-gold-awards-system/ · https://www.androidauthority.com/reddit-sunsets-gold-awards-system-3345298/
- Reddit 重启 Awards（2024）：https://techcrunch.com/2024/05/16/reddit-reintroduces-its-awards-system/
- B 站积分/硬币官方规则：https://www.bilibili.com/html/point.html ；二手分析：https://36kr.com/p/1872224788943364 · https://www.135editor.com/essences/8098.html
- 微博阳光信用官方规则：https://kefu.weibo.com/faqdetail?id=20820 · https://kefu.weibo.com/faqdetail?id=20821
- 蚂蚁森林机制：https://dialogue.earth/zh/2/44303/ · https://www.woshipm.com/pd/2225893.html
- 蚂蚁森林 NBER 研究（2025, w34074）：https://www.nber.org/papers/w34074
- 蚂蚁森林动机研究（*IJERPH* 2022）：https://pmc.ncbi.nlm.nih.gov/articles/PMC9779548/
- 游戏化双刃剑（未取得正文）：https://www.sciencedirect.com/science/article/abs/pii/S0959652624037612
- Ariely / Bracha / Meier（*AER* 2009）：https://www.aeaweb.org/articles?id=10.1257%2Faer.99.1.544
- 效用启发与其复现：https://en.wikipedia.org/wiki/Effort_heuristic · https://online.ucpress.edu/collabra/article/9/1/87489/197632/The-Effort-Heuristic-Revisited-Mixed-Results-for
- 《网络游戏管理暂行办法》废止：https://whly.gd.gov.cn/special_newzt/fzxc/rdzx/content/post_2935178.html
- 《网络游戏管理办法（草案征求意见稿）》解读：https://www.hankunlaw.com/portal/article/index/cid/8/id/13854.html
- 单用途商业预付卡：https://www.gov.cn/gongbao/content/2012/content_2292065.htm · https://sw.beijing.gov.cn/zwxx/2024zcjd/202407/t20240710_3742273.html · https://sw.beijing.gov.cn/zwxx/2024zcjd/202407/t20240710_3742272.html
- 最高法预付式消费司法解释（2025-05-01 施行）：https://www.court.gov.cn/zixun/xiangqing/459321.html
- 《未成年人网络保护条例》：https://www.cac.gov.cn/2023-10/24/c_1699806932316206.htm · https://www.moj.gov.cn/pub/sfbgw/gwxw/xwyw/202310/t20231024_488320.html
- 未成年人网游消费管理规范（2024-06）：http://legalinfo.moj.gov.cn/zhfxfzzx/fzzxyw/202406/t20240604_499885.html
- 最高法未成年人打赏可退：https://sft.hubei.gov.cn/fbjd/zfyw/202005/t20200520_2279288.shtml
- 未成年人充值投诉规模：https://m.bjnews.com.cn/detail/1723510366168086.html

**C 节 · 集体活动与勋章**
- Keep 9.0 改版批评：https://news.qq.com/rain/a/20260427A076B700
- Keep 增长与留存数据：https://www.jiemian.com/article/15048274.html · https://news.qq.com/rain/a/20260903A03GP500
- Keep 奖牌业务增长：https://www.nbd.com.cn/articles/2023-08-27/2984412.html · https://m.mp.oeeee.com/a/BAAFRD000020230827838128.html
- Keep 奖牌业务缩水与投诉：https://m.lejucaijing.com/news-7234799476371289138.html
- Strava Year in Sport：https://press.strava.com/articles/strava-releases-12th-annual-year-in-sport-trend-report-2025 · https://press.strava.com/articles/strava-releases-year-in-sport-report
- Kudos 因果研究（*Social Networks* 2022）：https://www.sciencedirect.com/science/article/pii/S0378873322000909
- Strava 动机混合方法研究（2026）：https://pmc.ncbi.nlm.nih.gov/articles/PMC12938745/
- Strava 自我监视批判：https://www.researchgate.net/publication/346678505
- Duolingo 前 CPO 复盘：https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth
- Duolingo Leagues：https://blog.duolingo.com/duolingo-leagues-leaderboards/ · https://duolingo.deconstructoroffun.com/mechanics/leagues
- 排行榜设计原则：https://yukaichou.com/advanced-gamification/how-to-design-effective-leaderboards-boosting-motivation-and-engagement/
- 游戏化误用质性研究：https://arxiv.org/pdf/2203.16175
- NRC 勋章哲学：https://medium.com/design-bootcamp/how-the-nike-run-club-app-got-runners-hooked-2850c7654fc5 · https://www.strivecloud.io/blog/gamification-examples-nike-run-club · https://trophy.so/blog/nike-run-club-gamification-case-study
- 微信运动机制：https://www.woshipm.com/pd/1255548.html · https://blog.csdn.net/lssffy/article/details/142619288 · https://www.digitaling.com/articles/23955.html
- 蚂蚁森林合种：https://www.digitaling.com/projects/25606.html · https://www.sohu.com/a/218491521_632138 · https://zhuanlan.zhihu.com/p/140727119
- streak 伦理批判（*Frontiers in Psychiatry* 2025）：https://pmc.ncbi.nlm.nih.gov/articles/PMC12003299/
- Headspace 官方立场：https://www.headspace.com/articles/building-a-meditation-practice
- 用户侧 streak 伤害描述（弱证据）：https://steadyline.app/blog/why-i-dont-gamify-mental-health · https://www.soulumanifest.com/guides/habit-tracker-anxiety
