# “近期训练”游标分页与轨迹续接动画实施计划

> 对应规格：[`profile-recent-workouts-pagination-motion-spec.md`](./profile-recent-workouts-pagination-motion-spec.md)
>
> 规格状态：已确认
>
> 本计划只扩展“我的 → 近期训练”的数据获取、内部滚动和加载动画，不修改用户已确认的头部动画、训练频率和力量趋势。

## 实施目标

把近期训练的首屏和后续加载统一为每批最多 6 条：

1. 仪表盘首次返回最近 6 条已完成训练及下一页游标。
2. 用户每次点击后获取 6 条更早记录。
3. 记录区域进入固定高度的内部滚动，追加数据不继续把力量趋势向下推。
4. 使用“轨迹续接”动画表达请求、接入、失败和历史终点。
5. 近期列表在数据库阶段限量查询，全历史统计使用独立的轻量或聚合查询。

## 预计改动范围

| 文件 | 计划改动 |
| --- | --- |
| `lib/workout-history.ts` | 新增前后端共享类型、分页常量和响应标准化 |
| `lib/server/workout-history-cursor.ts` | 新增纯游标编码、解码和校验 |
| `lib/server/workout-history.ts` | 新增 D1 历史分页查询及单页聚合 |
| `app/api/workouts/history/route.ts` | 新增已完成训练的游标分页接口 |
| `lib/server/dashboard.ts` | 初始近期训练改为 6 条，并拆分全历史统计与近期列表查询 |
| `db/schema.ts` | 增加训练组按训练会话查询的索引声明 |
| `db/index.ts` | 为本地及新数据库补同名幂等索引 |
| `drizzle/0005_*.sql` | 生成生产 D1 索引迁移 |
| `components/recent-workouts-timeline.tsx` | 提取近期训练组件并实现分页状态、滚动锚点和 Motion 动画 |
| `app/page.tsx` | 接入共享类型、初始分页信息和新组件 |
| `app/globals.css` | 增加滚动窗口、加载轨迹、终点、错误和减少动态样式 |
| `tests/workout-history-pagination.test.ts` | 新增游标、排序、去重和标准化单元测试 |
| `tests/rendered-html.test.mjs` | 增加接口、结构、滚动和动画回归断言 |
| `package.json` | 把新增分页单元测试加入 `npm test` |
| `design-qa.md` | 更新最终视觉、滚动、长名称和动画验收记录 |

如 `npm run db:generate` 生成对应的 `drizzle/meta` 变更，应保留生成器产生的必要元数据，不手工伪造快照。

## 阶段 1：建立共享分页契约

### 文件

- `lib/workout-history.ts`

### 实施内容

1. 从 `app/page.tsx` 移出或复用 `WorkoutSummary` 类型，形成前后端共享的记录结构。
2. 增加：
   - `INITIAL_WORKOUT_HISTORY_LIMIT = 6`
   - `WORKOUT_HISTORY_PAGE_SIZE = 6`
   - `WorkoutHistoryPageInfo`
   - `WorkoutHistoryPageResponse`
3. 增加 `normalizeWorkoutHistoryPageResponse(raw)`：
   - 验证 `workouts` 为数组。
   - 验证每条记录的关键字段。
   - 保留 `volume_kg = 0`。
   - 验证 `hasMore` 与 `nextCursor` 组合。
   - 拒绝 `hasMore = true` 且空数组的异常响应。
4. 标准化函数输出稳定的 `records / hasMore / nextCursor`，页面不直接消费原始响应。

### 验证

- 单元测试覆盖正常页、最后一页、零容量、无效 `pageInfo` 和空数组异常。
- 类型文件不导入 `cloudflare:workers` 或其他服务端专用模块，保证客户端可以安全引用。

## 阶段 2：实现纯游标域逻辑

### 文件

- `lib/server/workout-history-cursor.ts`
- `tests/workout-history-pagination.test.ts`

### 实施内容

1. 定义版本化游标：

```ts
type WorkoutHistoryCursor = {
  v: 1;
  startedAt: number;
  id: string;
};
```

2. 实现 Base64URL 编码与解码。
3. 解码时校验：
   - 版本只能为 `1`。
   - `startedAt` 是安全整数且大于零。
   - `id` 是非空且长度受限的字符串。
   - 解码后不能包含缺失字段或错误类型。
4. 非法游标返回明确的域错误，让 API 转为 `400`，不回退到第一页。
5. 增加纯排序辅助或测试夹具，验证：
   - 相同时间戳使用 `id DESC` 稳定排序。
   - 下一页从最后一条之后继续。
   - 两页之间无重复、无遗漏。

### 验证

- Node 单元测试不连接 D1。
- 编码后解码得到同一游标。
- 非法 Base64、非法 JSON、错误版本和越界时间全部失败。

## 阶段 3：实现服务端单页查询

### 文件

- `lib/server/workout-history.ts`

### 实施内容

1. 新增唯一主查询入口：

```ts
getWorkoutHistoryPage(userId, {
  limit,
  cursor,
})
```

2. 查询只包含：
   - 当前用户。
   - `completed_at IS NOT NULL`。
   - 游标之前的记录。
3. 固定排序：

```sql
ORDER BY workout_sessions.started_at DESC, workout_sessions.id DESC
```

4. 每次读取 `limit + 1` 条：
   - 前 `limit` 条作为返回记录。
   - 额外一条只用于判断 `hasMore`。
5. 每页在 SQL 中聚合：
   - `COUNT(workout_sets.id)` 为 `set_count`。
   - `SUM(weight_kg * reps)` 为 `volume_kg`。
6. 用本页最后一条生成 `nextCursor`。
7. 服务函数返回标准契约，不把 D1 原始结果直接交给页面。

### 查询注意

- 游标条件必须带括号，避免 `OR` 绕过用户和完成状态条件。
- `id` 比较和排序方向保持一致。
- 容量聚合继续保持 `0`，不转换为空值。
- 不使用 offset。

### 验证

- 使用本地 D1 准备 30 条隔离测试记录，验证首次 6 条及后续连续 4 页各 6 条。
- 准备相同 `started_at` 的记录验证稳定翻页。
- 验收后删除测试用户、会话、训练和训练组。

## 阶段 4：补充数据库索引

### 文件

- `db/schema.ts`
- `db/index.ts`
- 新生成的 `drizzle/0005_*.sql`
- 对应 `drizzle/meta`

### 实施内容

1. 增加：

```sql
CREATE INDEX workout_sets_session_idx
ON workout_sets (workout_session_id);
```

2. 在 `db/schema.ts` 中增加同名 Drizzle 索引。
3. 在 `db/index.ts` 的幂等初始化语句中增加 `IF NOT EXISTS` 版本，保证已有本地库自动补齐。
4. 运行 `npm run db:generate` 生成迁移。
5. 检查生成迁移只包含预期索引，不夹带无关表重建。
6. 暂时复用现有 `workout_sessions_user_started_idx`：
   - 先用 `EXPLAIN QUERY PLAN` 验证分页查询命中。
   - 只有证据表明无法有效使用现有索引时，才补充包含 `id` 的新索引。
   - 不创建功能重复的索引。

### 验证

- 新数据库创建后索引存在。
- 已有本地数据库启动后索引被幂等补齐。
- `EXPLAIN QUERY PLAN` 显示会话查询使用用户／开始时间索引，训练组聚合使用 `workout_sets_session_idx`。

## 阶段 5：新增历史分页 API

### 文件

- `app/api/workouts/history/route.ts`

### 实施内容

1. 使用现有 `getSessionUser()` 鉴权。
2. 读取 `cursor` 和 `limit`：
   - 无游标时允许返回第一页。
   - `limit` 限制为 `1–20`，页面固定请求 20。
3. 调用 `getWorkoutHistoryPage()`。
4. 错误映射：
   - 未登录：`401 UNAUTHORIZED`。
   - 游标非法：`400 BAD_REQUEST`。
   - 未预期错误：使用现有 `serverError()`。
5. 成功响应只返回：
   - `workouts`
   - `pageInfo`
6. 不在正式交付中保留响应 `console.log`。

### 最小联调

1. 启动本地服务。
2. 使用隔离 QA 登录态请求第一页。
3. 保存真实第一页响应中的 `nextCursor`。
4. 用该游标请求第二页。
5. 核对记录顺序、ID 去重、数量和 `hasMore`。
6. 请求非法游标确认 `400`。
7. 删除 QA 会话。

## 阶段 6：拆分仪表盘查询

### 文件

- `lib/server/dashboard.ts`

### 实施内容

1. 删除当前为近期列表读取全部训练及训练组、最后 `slice(0, 20)` 的路径。
2. 并行调用 `getWorkoutHistoryPage(user.id, { limit: 6 })` 获取初始近期记录。
3. 返回：
   - `recentWorkouts`
   - `recentWorkoutsPageInfo`
   - `lastSession = recentWorkouts[0] ?? null`
4. 全历史统计改用独立轻量查询：
   - 读取连续完成和活跃周数所需的最小日期／计划字段。
   - 训练频率使用按日期聚合后的次数、容量和计划名称。
   - `totalWorkouts` 使用真实已完成记录计数。
5. 保留并继续调用：
   - `calculateScheduledTrainingStreak`
   - `countActiveWeeks`
6. 力量趋势的一年窗口和排行榜的 56 天窗口保持不变。
7. 所有统计不得从 `recentWorkouts` 推导。

### 数据核对

使用改造前后的同一份本地真实数据对比：

- `weeklyCount`
- `scheduledStreak`
- `totalWorkouts`
- `activeWeeks`
- `activity`
- `lastSession`
- `trend`
- `leaderboard`

除 `recentWorkouts` 收敛为最多 6 条并新增 `pageInfo` 外，其余结果必须一致。

## 阶段 7：提取近期训练组件

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/page.tsx`

### 组件输入

```ts
type RecentWorkoutsTimelineProps = {
  initialRecords: WorkoutSummary[];
  initialPageInfo: WorkoutHistoryPageInfo;
  snapshotKey: number;
};
```

`snapshotKey` 使用仪表盘同步时间或等价稳定标识；正式仪表盘刷新后重置为最新 6 条。

### 组件状态

- `records`
- `pageInfo`
- `loadState`
- `statusMessage`
- `newRecordIds`
- `requestGenerationRef`
- `viewportRef`
- `oldTailRef`

### 实施内容

1. 从 `ProfileView` 移出近期训练 JSX，保持原三列记录 DOM 和空状态文案。
2. 组件首次使用仪表盘传入的 0–6 条记录，不重复请求第一页。
3. 只保留一个 `loadMoreHistory()`：
   - `loading` 时立即返回。
   - 请求 `/api/workouts/history?limit=6&cursor=...`。
   - 使用 `normalizeWorkoutHistoryPageResponse()`。
   - 按 ID 去重并追加。
   - 成功后更新游标。
4. 失败时保留记录和旧游标。
5. `snapshotKey` 改变或组件卸载时：
   - 使旧请求失效。
   - 清理成功提示定时器。
   - 重置新记录动画状态。
6. 记录颜色使用最终 `records` 的全局索引，跨页继续绿、橙、蓝循环。
7. 末条时间线按以下状态处理：
   - `hasMore`：保留短连接段接向加载器。
   - `exhausted`：停止连接线并显示稳定终点。
   - `error`：保留当前末端与重试入口，不伪装为终点。

### 并发策略

- 不增加缓存。
- 不增加防抖。
- 通过禁用按钮阻止同一游标并发。
- 通过 `requestGenerationRef` 或 AbortController 阻止旧账号／旧快照响应落地。

## 阶段 8：实现固定滚动窗口

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/globals.css`

### 结构

```text
section.timeline
  section-heading
  timeline-viewport
    session × N
    history-load-control / history-end-state
  aria-live status
```

### 样式

1. 标题位于滚动区域之外。
2. 只有存在更多记录或已加载超过 6 条时，视口进入固定高度状态：
   - 高度不超过 `440px`。
   - `overflow-y: auto`。
   - `overflow-x: hidden`。
3. 初始恰好 6 条且 `hasMore = true` 时直接建立稳定的滚动高度，保证加载后力量趋势位置不移动。
4. 1–6 条且没有更多记录时按内容自然收缩。
5. 使用原生滚动和触摸惯性：
   - `touch-action: pan-y`
   - 不阻止滚动边界继续传递给外层页面。
6. 桌面端可以使用 `scrollbar-gutter: stable` 防止滚动条出现时列宽轻微变化，但不重绘装饰滚动条。
7. 保持当前三列宽度、长名称换行和 `0 kg` 对齐规则。

### 滚动锚点

1. 点击前记录当前 `scrollTop` 和旧末条位置。
2. 追加前临时禁用末端按钮的滚动锚定。
3. React 提交新记录后，在 `useLayoutEffect` 中恢复旧交界位置。
4. 普通动态模式最多平滑向下推进 `32px`。
5. 减少动态模式不平滑推进。
6. 不调用会滚动整个页面的全局 `scrollIntoView()`。

## 阶段 9：实现“轨迹续接”动画

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/globals.css`

### 技术选择

- 复用仓库已有 `motion/react`，不增加依赖。
- Motion 负责状态切换、新记录进入和减少动态判断。
- CSS keyframes 负责请求期间的局部能量点循环。
- 不使用 GSAP、Canvas 或新的 WebGL 场景。

### 动画步骤

1. **按钮按压**
   - `120ms`
   - `scale: 1 → .97 → 1`
2. **请求中**
   - 按钮原位切换为加载轨迹。
   - 能量点在短连接轨中以约 `720ms` 循环。
   - 绿、橙、蓝只用于移动点，不污染状态文案。
3. **连接展开**
   - 时间线续接段以 `scaleY` 在 `220ms` 内展开。
4. **新记录进入**
   - `opacity: 0 → 1`
   - `translateY: 10px → 0`
   - `blur: 3px → 0`
   - 单条 `240ms`，使用现有 expo 缓动。
   - 本批最多 6 条全部错峰，每条延迟 `32ms`。
5. **成功反馈**
   - `180ms` 状态切换。
   - “已载入 N 条更早记录”保留约 `900ms`。
6. **终点**
   - 最后圆点执行一次 `160ms` 亮度脉冲。
   - 随后稳定显示终点文字。

### 动画约束

- 不动画高度、宽度、边距、绝对位置或列表容器布局。
- `will-change` 只在新记录动画期间存在。
- 动画前内容已经渲染；Motion 未运行时不能保持隐藏。
- 加载速度快时不人为增加延迟。
- 加载时已有记录可以继续滚动和阅读。

### 减少动态

使用 `useReducedMotion()` 与局部 CSS media query：

- 关闭能量点移动、错峰、模糊、位移和终点脉冲。
- 新记录直接出现。
- 不执行平滑滚动。
- 保留加载、成功、失败和终点文字。
- 不修改项目其他动画的减少动态行为。

## 阶段 10：状态与可访问性

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/globals.css`

### 实施内容

1. 滚动区域：
   - `role="region"`
   - `aria-label="近期训练记录"`
   - 必要时提供 `tabIndex={0}` 以支持键盘滚动。
2. 加载按钮：
   - 最小高度 `44px`。
   - 加载中 `disabled`。
   - 使用 `aria-busy`。
3. 独立 `aria-live="polite"` 播报：
   - 实际载入数量。
   - 加载失败。
   - 到达最早记录。
4. 错误状态提供真正的重试按钮。
5. 空状态不渲染无意义滚动区域或加载器。
6. 颜色不是状态的唯一表达。

## 阶段 11：自动化测试

### `tests/workout-history-pagination.test.ts`

覆盖：

1. 游标编码／解码。
2. 错误版本、非法时间、空 ID 和损坏 Base64。
3. 相同开始时间的稳定排序。
4. 首次 6 条、后续每页 6 条的边界夹具。
5. 跨页无重复、无遗漏。
6. 标准化保留 `0 kg`。
7. `hasMore = true` 且空数组被拒绝。
8. 去重后没有新增记录时不能继续推进。

### `tests/rendered-html.test.mjs`

增加静态回归断言：

1. 历史分页路由存在。
2. 仪表盘包含 `recentWorkoutsPageInfo`。
3. 近期列表不再出现 `completedSessions.slice(0, 20)`。
4. 页面请求 `limit=6` 并携带游标。
5. 存在 `timeline-viewport`、加载、失败和终点结构。
6. CSS 最大高度为 `440px`，只能纵向滚动。
7. 新记录动画只使用 transform、opacity 和 filter。
8. 存在局部 `prefers-reduced-motion` 降级。
9. 原三列布局、绿橙蓝循环、零容量和长名称断言继续通过。
10. 头部、训练频率和力量趋势原断言不放宽。

### `package.json`

把新测试文件加入 `npm test`，继续先生产构建再运行 Node 测试。

## 阶段 12：接口与视觉验收

### 测试数据

使用隔离本地 QA 用户创建：

- 30 条已完成训练。
- 至少两条相同 `started_at`。
- 至少一条两行长名称。
- 至少一条 `0 kg`。
- 至少一条不足 1 分钟。

不修改用户真实训练数据。验收结束后删除 QA 用户及全部关联记录，并确认清理结果为零。

### 接口验收

1. 仪表盘返回 6 条及有效游标。
2. 后续连续 4 次分别返回 6 条。
3. 总计 30 个记录 ID 唯一且顺序正确。
4. 错误游标返回 `400`。
5. 未登录请求返回 `401`。
6. `EXPLAIN QUERY PLAN` 命中预期索引。

### 视觉视口

- `390×844`
- `375×812`
- 桌面宽屏

### 视觉检查

1. 首次 6 条和加载按钮。
2. 点击后的加载轨迹。
3. 新记录错峰进入。
4. 加载后内部高度不超过 `440px`。
5. 力量趋势顶部位置加载前后保持稳定。
6. 内部滚动不产生横向溢出。
7. 到达内部边界后外层页面仍可继续滚动。
8. 长名称时备注和容量标签底部对齐。
9. 跨页颜色循环连续。
10. 错误、重试和终点状态。
11. 减少动态效果。
12. 页面控制台无新增错误或警告。

### 动画性能

- 在目标手机宽度下观察加载期间是否掉帧。
- 确认本批最多 6 条全部执行进入动画。
- 确认动画结束后没有长期 `will-change`。
- 确认请求期间仍可滚动已有记录。

## 阶段 13：完整验证

按顺序执行：

```bash
npx tsc --noEmit
npm run lint
npm test
git diff --check
```

此外执行：

- 本地分页接口 HTTP 探测。
- D1 索引与查询计划检查。
- 多尺寸浏览器视觉验收。
- `prefers-reduced-motion` 验收。
- 临时数据、会话和辅助服务清理检查。

## 实施顺序与回滚点

### 回滚点 A：数据层

完成共享契约、游标、查询、索引和 API 后，先通过单元测试和 HTTP 探测。此时不改现有 UI。

若接口不稳定，只回滚新接口与索引，不影响当前近期训练展示。

### 回滚点 B：仪表盘

仪表盘切到初始 6 条后，对比全部统计结果。只有统计完全一致才进入前端分页。

若统计口径漂移，恢复旧统计查询，但保留已验证的独立历史分页接口继续排查。

### 回滚点 C：前端与动画

先完成静态分页、内部滚动和错误状态，再启用动画。

若动画出现掉帧，可关闭 Motion 进入效果并保留完整分页功能；不能因为动画问题回退到一次性加载全部记录。

## 风险与控制

### 全历史统计口径漂移

- 控制：改造前后使用同一数据库逐字段对比。
- 不通过减少测试或修改期望值掩盖差异。

### D1 游标查询条件错误

- 控制：纯排序测试、相同时间夹具、真实两页接口探测同时覆盖。

### React 追加导致滚动跳跃

- 控制：使用局部视口 ref、旧末条锚点和 `useLayoutEffect`，不依赖浏览器默认滚动锚定。

### 动画与现有页面转场叠加

- 控制：轨迹动画只在用户点击加载时运行，不在页面进入时自动运行。

### 移动端滚动冲突

- 控制：不监听连续 scroll 发请求，不调用 `preventDefault()`，允许滚动链到外层页面。

### Dirty worktree

- 当前工作区已有本轮近期训练未提交修改和文档。
- 实施时只在这些已确认改动上继续，不覆盖或回退其他用户内容。
- 提交前按文件核对 diff，不使用破坏性 Git 命令。

## 完成定义

只有同时满足以下条件才算实施完成：

1. 已确认规格中的 30 项验收标准全部落实。
2. 游标分页、初始 6 条和后续每页 6 条通过真实 D1 接口验证。
3. 全历史统计与改造前一致。
4. 内部滚动、加载动画、错误重试和终点状态在手机与桌面实际通过。
5. 减少动态模式有完整静态降级。
6. 查询计划命中预期索引。
7. TypeScript、ESLint、生产构建、全部测试和 `git diff --check` 通过。
8. 头部动画、训练频率和力量趋势没有 DOM、样式或行为回归。
9. 最终 diff 不包含临时账号、训练数据、会话、日志、截图、构建产物或无关格式化。
