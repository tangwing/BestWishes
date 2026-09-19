> 实现前先读 [design.md](design.md) 的 D1–D5。按 AGENTS.md §4：外科式改动、改 bug 先写会失败的测试、一次只改一处。

## 1. 领域层与共享层（纯逻辑先行）

- [x] 1.1 `WishRequest` 类型加 `anonymous: boolean` 与 `lastResponseExcerpt: string | null`；`pnpm --filter @bestwishes/domain typecheck` 通过
- [x] 1.2 摘录的截断纯函数（从正文或转写取前 N 字、空转写返回 null），单测覆盖：超长截断、空串、纯空白、音频无转写
- [x] 1.3 `packages/shared` 导出唯一的 `DEFAULT_AUDIENCE_FILTER`（近距离 + 年龄/性别/标签全空，理由见 design D5）；单测断言它的年龄/性别/标签确实为空——这条断言是防止后人"顺手加个默认标签"把冷启动用户命中数打成 0
- [x] 1.4 `submitWishRequestSchema` 加 `anonymous`（可选，默认 false）；`pnpm --filter @bestwishes/shared typecheck` 通过

## 2. 数据层

- [x] 2.1 `wish_requests` 加 `anonymous`（NOT NULL default false）与 `last_response_excerpt`（可空）两列；`db:generate` 生成迁移，人工检查只含这两列、无意外改动
- [x] 2.2 内存与 PGlite 两套仓储同步实现新字段；`pnpm test`（含 PGlite 真 SQL 集成测试）绿，证明两套 ports 契约一致
- [x] 2.3 写一个一次性回填脚本：为 `response_count > 0` 但 `last_response_excerpt IS NULL` 的存量祈福补摘录（design 迁移计划第 2 条——不回填的话上线当天广场首屏全是空摘录，正好毁掉本变更的目的）

## 3. 服务端：摘录维护

- [x] 3.1 **先写失败测试**：回应发布后，该祈福的 `lastResponseExcerpt` 等于这条回应的摘录——当前必然失败
- [x] 3.2 在已有的 `responseCount` / `lastResponseAt` 写入路径里同处维护摘录（不新建机制，见 design D3），3.1 转绿
- [x] 3.3 **先写失败测试**：一条祈福有两条回应，撤回最新那条后，摘录退回到第二新的那条；再撤回后摘录为 null、`responseCount` 为 0
- [x] 3.4 实现撤回 / 下架路径的摘录退回（这条路径才去查剩余最新一条，正常发布路径不查），3.3 转绿
- [x] 3.5 `plaza()` 的列表项返回摘录；断言列表查询的读放大不随回应数增长（不遍历回应表）

## 4. 服务端：匿名

- [x] 4.1 `publish()` 接收并持久化 `anonymous`；提交后修改该字段的尝试被拒绝（对应 spec "发布后不可切换匿名"场景）
- [x] 4.2 `plaza()` / `detail()` / 匹配通知文案在 `anonymous` 时以"一位朋友"代替昵称、不带城市——**遮蔽在服务端完成**，测试断言响应体里根本不含真实昵称（见 design D4）
- [x] 4.3 断言匿名不影响：作者的 `?filter=mine` 仍能看到、撤回仍可用、人工复核工单仍指向真实作者

## 5. 服务端：三档权限（访客读 / 登录写 / 登录听）

- [x] 5.1 **先写失败测试**（这是一个既有真实缺口，不是新功能）：一个既非作者也非收件人的登录用户，回放一条 `published` 祈福的音频回应 → 当前返回 403，期望 200
- [x] 5.2 `readAudio()` 的判定按 design D2 扩展第 3 条分支（`scope==='wish_response'` 且其祈福为 `published` → 任何登录用户放行），5.1 转绿
- [x] 5.3 回归测试守住未放宽的部分：非作者非收件人回放一条 **P1 群发**音频 → 仍 403
- [x] 5.4 `detail()` 对未登录访客不下发 `audioUrl`，改为可辨识的"需登录"状态；测试断言访客响应体中不含音频 URL，登录后同一条含
- [x] 5.5 权限矩阵测试一次写全：{访客 / 第三方登录 / 收件人 / 作者} × {祈福回应音频 / 群发音频} × {详情文字 / 音频回放}

## 6. 服务端：取消预览硬门槛

- [x] 6.1 提交群发时受众条件缺省则用 `DEFAULT_AUDIENCE_FILTER`；测试："只带正文、不带任何受众条件"的提交能成功群发
- [x] 6.2 `audience_empty` 的中文文案补足"当前条件命中 0 人 + 怎么放宽"，测试断言文案含可操作信息（B-50 的教训：错误必须可执行，且见得到）

## 7. 前端：首页与广场

- [x] 7.1 `Home.tsx` 重做：取一条真实 `published` 祈福 + 它最新一条回应摘录 + 就地回应入口；访客与登录用户看到同样的内容
- [x] 7.2 广场为空时的中性空状态 + 两个入口（发布祈福 / 写祝福），不空白不报错
- [x] 7.3 `WishRequests.tsx` 列表项展示最新回应摘录；无回应时显示"还没有回应"
- [x] 7.4 `WishRequestDetail.tsx` 访客可读全部文字；音频位对访客显示"登录后可收听"
- [x] 7.5 `PublishWishRequest.tsx` 加匿名勾选 + 一句说明（匿名只对外，不影响你收到回应）

## 8. 前端：压缩首次善意路径

- [x] 8.1 `Compose.tsx` 的 `canSubmit` 去掉对 `preview.canSend` 的依赖（design 里点名的那一处），预览降级为可选按钮
- [x] 8.2 受众筛选器默认收起，默认值取自 shared 的 `DEFAULT_AUDIENCE_FILTER`；展开后可精调，调整在本次撰写中保持
- [x] 8.3 未登录可进入撰写页（`Compose.tsx`）——去掉进页即跳登录。**范围调整（用户明确决策，见下方说明）**：回应页（`RespondToWishRequest.tsx`，音频录制）维持登录前置不变，不适用本条
- [x] 8.4 提交时若未登录：内容存 `sessionStorage`（读写全包 try/catch，见 design D1）→ 跳 `/login?returnTo=<原路径>` → 回来后原样恢复并清除；存储失败时提示"登录后可能需要重新输入"而不是静默丢失
- [x] 8.5 协议 gate 串在同一条回跳链上（复用 B-72 的 `?returnTo=`，不另造一套），登录 + 同意两步之后仍回原位置、内容仍在

## 9. 验收

- [x] 9.1 e2e：**未登录访客从首页读到一条真实回应 → 点回应 → 写 → 提交 → 登录 → 同意协议 → 内容未丢 → 送出成功**（一条用例覆盖 spec 的"登录发生在提交那一刻"全链路）。**范围调整**：受众设为"回应祈福=音频（至少 3 次交互，天然超预算）vs 群发=文字"的实测冲突（见下方说明），"回应入口"改用群发文字路径演示，用户已确认
- [x] 9.2 e2e：**两步路径**——从首页出发，除登录与输入外只点两次就送出。同上，用群发文字路径演示
- [x] 9.3 e2e：访客在详情页点音频 → 提示登录；登录后同一条可播放
- [x] 9.4 `pnpm verify` + `pnpm test:e2e` + `openspec validate --strict` 全绿
- [x] 9.5 手动走查一遍 `docs/DEMO.md`，把新的访客动线补进去；BACKLOG 恢复点更新

## 10. 追加（2026-09-19，B-98/B-100）：祈福必须为他人 + 浏览/回复计数

用户看过 demo 后提的两点：① 祈福广场的祈福必须是为别人写的，不是自己为自己求安慰；② 用浏览次数 / 回复次数让"善意被关注到"更有体感。都在同一个未归档的 change 里追加，见 spec 新增的"撰写祈福"字段、"祈福广场列表"/"查看祈福详情"字段、新 Requirement「祈福详情浏览计数」。

- [x] 10.1 `beneficiaryLabel`（受祝福人称呼）：`packages/shared` schema 必填校验、`packages/domain` `WishRequest` 类型、DB 列（可空，兼容旧数据，展示层退回"一位朋友"）、`wish-request-service.publish()` 校验 + 持久化、`toSummary()`/`detail()` 带出
- [x] 10.2 `PublishWishRequest.tsx` 加"TA是谁"必填输入框，处境描述文案改写为"TA的处境"；理念声明加到发起祈福页与广场列表页顶部
- [x] 10.3 广场列表 / 详情页把 `beneficiaryLabel` 作为标题呈现（"为 TA 祈福"）
- [x] 10.4 `vision.md`"为谁创造价值"的"祝福请求方"персона改写：从"收到祝福感受被善待"改为"为牵挂的人发起祈福，促成善意"
- [x] 10.5 祈福详情浏览计数（`viewCount`）：**发现并修正一个自我设计缺陷**——最初实现把计数放进 `detail()`，但详情页本身每 3 秒轮询等回应出现，会把轮询次数当成浏览量刷高，数字失去意义；改为客户端首次打开时单独调一次 `POST /api/plaza/:id/view`（`recordView()`），与轮询的 `GET detail` 彻底分离。作者查看自己的不计数；只对作者暴露真实数字。
- [x] 10.6 同样的轮询计数问题在公开落地页（`PublicPage.tsx` 每 3 秒轮询）也存在，一并修：`blessing-service.recordPublicView()` + `POST /api/p/:slug/view`，`OutboxItem` 加 `viewCount`
- [x] 10.7 `OutboxItem` 加 `replyCount`（复用既有 `listRepliesTo()`，原本只给祈福回复链用），"我的善意"列表展示"被浏览 N 次 · 收到 N 条回信"
- [ ] 10.8 既有测试补齐 `beneficiaryLabel` fixture（`wish-request-flow.test.ts` 等）、e2e 表单流程补新字段——**验证中**，见本轮 `pnpm verify` / `pnpm test:e2e` 结果
