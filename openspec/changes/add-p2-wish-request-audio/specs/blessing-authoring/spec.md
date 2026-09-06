## MODIFIED Requirements

### Requirement: 祝福形式（内容形态留白）

祝福 SHALL 有一个内容形态字段 `contentType`，取值 `text` / `audio` / `video`。`text` 在所有场景下允许创作。`audio` 仅在 `scope = 'wish_response'`（回应祝福请求，见 `blessing-audio`）时允许，其余场景（`broadcast` / `reply`）仍只接受 `text`。`video` 在任何场景下仍 MUST 被拒绝，撰写页 MUST 展示其 tab 但置为不可用（标注"即将支持"）。提交不满足以上规则的 `contentType` MUST 被拒绝。

#### Scenario: P1 选择语音形式

- **WHEN** 用户在 `broadcast` 或 `reply` 场景尝试提交一条 `contentType = audio` 的祝福
- **THEN** 系统拒绝并提示当前场景仅支持文字

#### Scenario: 回应祝福请求可选择语音形式

- **WHEN** 用户回应一条祝福请求，提交一条 `contentType = audio` 的祝福
- **THEN** 系统接受提交，进入音频打分管线（见 `audio-scoring`）

#### Scenario: 视频形式仍被拒绝

- **WHEN** 用户在任何场景尝试提交一条 `contentType = video` 的祝福
- **THEN** 系统拒绝并提示"视频祝福即将支持，先用文字或语音"

#### Scenario: 形式 tab 可见但不可用

- **WHEN** 用户进入撰写页
- **THEN** 看到「文字 / 语音 / 视频」三个 tab；语音在回应祝福请求场景下可用，其余场景与视频一样灰置并标注"即将支持"
