## Purpose

把 `contentType = audio` 从"类型层留白"变成真正可用的祝福形态：录制、上传、存储、回放，让回应者能用声音而不只是文字回一份祝福。视频（`video`）继续留白，推到 P3。

## ADDED Requirements

### Requirement: 录制音频响应

回应祝福请求时，系统 SHALL 提供浏览器内录音能力。录制过程中系统 SHALL 展示实时波形，帮助用户确认正在录音、感受自己的语速语调。录音时长 MUST 落在可配置的下限与上限之间（默认 5–180 秒）；超出范围 MUST 阻止提交并提示。

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

系统 SHALL 接受音频文件上传，存储实现 MUST 可替换（本机存储用于开发 / 演示，替换为对象存储不改变调用方契约，同数据层"PGlite 换 Postgres 驱动"的既有模式）。上传的音频文件 MUST 与其所属的祝福记录关联，且只有该祝福的收发双方能访问对应的音频文件。

#### Scenario: 上传成功后可回放

- **WHEN** 一段音频上传成功
- **THEN** 该祝福的收件人可以在收件箱里播放这段音频

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
