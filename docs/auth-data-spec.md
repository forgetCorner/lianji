# 练迹真实数据与账号规范

## 目标

首个真实数据版本打通以下闭环：

1. 用户凭邀请码、用户名和密码注册。
2. 登录后在手机和电脑读取同一份训练数据。
3. 训练中完成的每一组实时保存到云端 D1。
4. 历史、趋势和好友排行榜只展示真实记录。
5. 排行榜比较个人进步，不按绝对重量排名。

## 技术边界

- 数据库：Cloudflare D1，SQLite 兼容，与 Sites 同源部署。
- 认证：应用自有用户名/密码；密码只保存 PBKDF2-SHA256 哈希。
- 会话：随机令牌只写入 HttpOnly、SameSite=Lax Cookie；数据库只保存令牌哈希。
- 邀请码：数据库只保存邀请码哈希；原始邀请码仅在创建时返回一次。
- 首位用户：通过部署环境变量 `LIANJI_BOOTSTRAP_INVITE_CODE` 注册，成功后不再允许该方式。
- 当前版本不包含会员、动态、支付、公开社交和训练计划编辑器。

## 数据模型

### users

- `id`：UUID。
- `username`：唯一登录名，统一转小写保存。
- `display_name`：页面显示名。
- `password_hash`：PBKDF2 格式化哈希。
- `failed_login_count`、`locked_until`：连续失败锁定。
- `created_at`：创建时间。

### sessions

- `token_hash`：会话令牌 SHA-256 哈希，唯一。
- `user_id`：所属用户。
- `expires_at`：30 天有效期。
- `last_seen_at`：最近使用时间。

### invite_codes

- `code_hash`：标准化邀请码的 SHA-256 哈希。
- `label`、`max_uses`、`used_count`、`expires_at`、`disabled_at`。
- `created_by`：创建者；首位用户的引导邀请码不落原文。

### workout_sessions

- 一次训练的开始、完成、时长、计划名和备注。

### workout_sets

- 一组动作的动作标识、动作名、肌群、组序、重量、次数和完成时间。
- 每条记录同时保留 `user_id`，用于所有权校验与统计查询。

## 接口契约

所有接口返回 JSON；失败统一为：

```json
{ "error": { "code": "ERROR_CODE", "message": "可展示给用户的信息" } }
```

### 账号

- `POST /api/auth/register`：`username`、`password`、`inviteCode`、可选 `displayName`。
- `POST /api/auth/login`：`username`、`password`。
- `POST /api/auth/logout`：清理当前会话。
- `GET /api/auth/me`：返回当前用户；未登录时 `user` 为 `null`。

### 训练

- `GET /api/workouts?limit=20`：读取自己的训练历史。
- `POST /api/workouts`：开始一次训练。
- `POST /api/workouts/:id/sets`：保存一组训练。
- `POST /api/workouts/:id/complete`：完成训练并记录总时长。

### 首页与排行榜

- `GET /api/dashboard`：一次返回周进度、最近训练、热力日历、力量趋势和排行榜。
- 首页的默认训练计划是产品模板，不冒充用户的真实历史。
- 没有训练记录时返回空数组和零值，由前端展示明确空状态。

### 邀请码

- `GET /api/invites`：读取自己创建的邀请码状态，不返回原始邀请码。
- `POST /api/invites`：创建一次性邀请码，原始值只返回一次。

## 公平排行榜

以最近 28 天和之前 28 天的个人表现比较：

- 单组估算力量：`e1RM = 重量 × (1 + 次数 / 30)`。
- 个人基线：前一窗口各动作最佳 e1RM 的合计。
- 当前水平：最近窗口各动作最佳 e1RM 的合计。
- 进步分：`(当前水平 - 个人基线) / 个人基线 × 100`，限制在合理展示范围。
- 稳定分：最近 28 天内有训练记录的周数 / 4 × 100。
- 综合分：进步分归一化后占 70%，稳定分占 30%。
- 记录不足 28 天时显示“建立基线中”，只按稳定性参与，不伪造进步幅度。

排行榜返回综合排名、进步百分比、稳定分和基线状态，使不同性别、体重和初始力量的人可以比较自己的进步。

## 安全与校验

- 用户名 3–24 位，仅允许字母、数字、下划线和中文。
- 密码至少 8 位、最多 128 位。
- 连续 5 次登录失败锁定 15 分钟。
- 所有写接口校验同源 `Origin`，只接受 `application/json`。
- 所有训练读写都以服务端会话解析出的 `user_id` 为准，不信任客户端用户 ID。
- 错误信息不泄露密码哈希、会话令牌或邀请码哈希。

