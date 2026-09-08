## Purpose

把 `contentType = audio` 从"类型层留白"变成真正可用的祝福形态：录制、上传、存储、回放，让回应者能用声音而不只是文字回一份祝福。视频（`video`）继续留白，推到 P3。

## ADDED Requirements

### Requirement: 录制音频响应

回应祝福请求时，系统 SHALL 提供浏览器内录音能力。录制过程中系统 SHALL 展示实时波形，帮助用户确认正在录音、感受自己的语速语调。录音时长 MUST 落在可配置的下限与上限之间（默认 5–180 秒）；超出范围 MUST 阻止提交并提示。

录音能力 MUST 在主流浏览器上可用，不同浏览器录出的容器格式不同（Chrome 出 WebM、Safari 出 MP4），系统 MUST 按各浏览器实际支持的格式录制，不得硬编码单一格式。实时波形依赖 `AudioContext`，属于辅助反馈：其初始化失败（老版本 Safari 只有 `webkitAudioContext`、或达到浏览器音频上下文数量上限）MUST 降级为无波形，不得因此阻断录音本身。浏览器完全不支持录音（无 `MediaRecorder`）时 MUST 给出明确提示，而不是一个失败后仍不可提交的按钮。

#### Scenario: Safari 录音可用

- **WHEN** 用户在 Safari 里录一段音频（容器格式为 MP4）
- **THEN** 录音正常完成、可提交，回放时按 MP4 类型返回

#### Scenario: 波形初始化失败不阻断录音

- **WHEN** 浏览器无法创建 `AudioContext`（或其已达上限）
- **THEN** 录音仍照常进行，只是不显示波形；录完可正常提交

#### Scenario: 浏览器不支持录音

- **WHEN** 浏览器没有 `MediaRecorder`
- **THEN** 界面提示换较新的浏览器，不显示一个点了没反应的录音按钮

#### Scenario: 正常时长录音

- **WHEN** 用户录制一段 30 秒的音频
- **THEN** 系统接受提交并进入打分管线

#### Scenario: 录音过短

- **WHEN** 用户录制的音频短于下限（如 2 秒）
- **THEN** 系统阻止提交并提示至少录够多长时间

#### Scenario: 录音过长

- **WHEN** 用户录制的音频超过上限
- **THEN** 系统阻止提交并提示精简

#### Scenario: 实时波形展示

- **WHEN** 用户正在录音
- **THEN** 界面实时展示随音量变化的波形，而不是一个静止或无反馈的录音按钮

### Requirement: 音频上传与存储

系统 SHALL 接受音频文件上传，存储实现 MUST 可替换（本机存储用于开发 / 演示，替换为对象存储不改变调用方契约，同数据层"PGlite 换 Postgres 驱动"的既有模式）。上传的音频文件 MUST 与其所属的祝福记录关联，且只有该祝福的收发双方能访问对应的音频文件。回放接口返回的 `Content-Type` MUST 反映音频文件的实际容器格式（按文件头判定，不依赖上传时的声明或落盘扩展名），使 Chrome 的 WebM 与 Safari 的 MP4 都能在 `<audio>` 里播放。

#### Scenario: 上传成功后可回放

- **WHEN** 一段音频上传成功
- **THEN** 该祝福的收件人可以在收件箱里播放这段音频

#### Scenario: 回放按实际格式返回类型

- **WHEN** 回放一段 Safari 录制的 MP4 音频
- **THEN** 回放接口返回 `Content-Type: audio/mp4`（而不是被硬编码成 `audio/webm`）

#### Scenario: 更换存储实现不影响调用方

- **WHEN** 运营把存储从本机换成对象存储
- **THEN** 录制、上传、回放的前端行为不变

### Requirement: 内容形态放开音频

系统 MUST 允许 `contentType = 'audio'` 的祝福提交，前提是其 `scope = 'wish_response'`（回应祝福请求场景）。P1 原有的 `broadcast` / `reply` 场景 MUST 继续只接受 `text`。`video` 形态在任何场景下仍 MUST 被拒绝。

#### Scenario: 音频回应被接受

- **WHEN** 用户对一条祝福请求提交一条 `contentType=audio` 的回应
- **THEN** 系统接受提交

#### Scenario: 群发场景仍拒绝音频

- **WHEN** 用户尝试提交一条 `scope=broadcast`、`contentType=audio` 的祝福
- **THEN** 系统拒绝，提示当前场景仅支持文字

#### Scenario: 视频仍被拒绝

- **WHEN** 用户尝试提交任何 `contentType=video` 的祝福
- **THEN** 系统拒绝并提示"视频祝福即将支持"
