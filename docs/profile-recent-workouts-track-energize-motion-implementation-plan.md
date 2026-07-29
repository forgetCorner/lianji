# “近期训练”轨迹通电加载动画实施计划

> 对应规格：
> [`profile-recent-workouts-track-energize-motion-spec.md`](./profile-recent-workouts-track-energize-motion-spec.md)
>
> 规格状态：已确认
>
> 本计划只修改“我的 → 近期训练”的加载反馈、记录接入动画和内部滚动锚点。

## 实施目标

把当前“按钮内短横轨 + 快速批量插入 + 最多推进 32px”的表现改为：

1. 点击后立即从左侧真实时间线开始通电。
2. 快速接口也至少提供 `280ms` 的可感知反馈。
3. 数据返回后先进入 `connecting`，再完成记录接入。
4. 首条新记录完整进入内部滚动视口。
5. 成功反馈显示在标题右侧，始终位于当前视口。
6. 用户主动滚动时不抢回内部滚动位置。
7. reduced-motion、失败、终点和并发行为保持完整。

## 改动范围

| 文件 | 计划改动 |
| --- | --- |
| `lib/workout-history.ts` | 把后续历史页大小从 20 调整为 6 |
| `components/recent-workouts-timeline.tsx` | 扩展状态机、最短反馈计时、标题状态、竖向通电轨、记录接入和滚动意图保护 |
| `app/globals.css` | 替换横向加载轨样式，增加竖向能量轨、节点点亮、标题反馈和减少动态样式 |
| `tests/rendered-html.test.mjs` | 更新加载结构与动效回归断言 |
| `tests/workout-history-pagination.test.ts` | 如抽取纯滚动目标函数，则增加边界测试；否则不强行扩展 |
| `design-qa.md` | 记录录屏问题、最终参数和手机／桌面验收结果 |

明确不修改：

- 分页 API 路径和游标逻辑。
- 数据库、迁移和索引。
- 初始 6 条；后续每页由本次明确调整为 6 条。
- 近期训练三列排版和颜色循环。
- 头部、顶部统计、训练频率和力量趋势。

## 状态机

状态扩展为：

```ts
type HistoryLoadState =
  | "idle"
  | "loading"
  | "connecting"
  | "success"
  | "error"
  | "exhausted";
```

正常有下一页：

```text
idle
  → loading
  → connecting
  → success
  → idle
```

最后一页：

```text
idle
  → loading
  → connecting
  → success
  → exhausted
```

失败：

```text
idle
  → loading
  → error
  → loading（重试）
```

约束：

- `loading` 与 `connecting` 禁止再次请求。
- 只有请求成功并完成去重后才能进入 `connecting`。
- 只有接入动画完成后才能进入 `success`。
- `success` 文案展示结束后才恢复按钮或终点。
- 用户、仪表盘快照或组件生命周期变化时，使旧请求和所有旧定时器失效。

## 阶段 1：统一首屏与后续页大小

### 文件

- `lib/workout-history.ts`
- `tests/workout-history-pagination.test.ts`
- `tests/rendered-html.test.mjs`

### 实施内容

1. 保持：

```ts
INITIAL_WORKOUT_HISTORY_LIMIT = 6;
```

2. 调整：

```ts
WORKOUT_HISTORY_PAGE_SIZE = 6;
```

3. `/api/workouts/history` 继续复用共享常量：
   - 默认 `limit = 6`。
   - 单次最大 `limit = 6`。
   - 页面固定请求 `limit=6`。
4. 不修改游标编码、排序、去重或 `limit + 1` 判断方式。
5. 更新分页夹具，覆盖连续多页 6 条和最后不足 6 条。

### 验证

- 首屏 6 条，后续每次最多 6 条。
- 分页顺序和游标语义不变。
- `0 kg`、重复 ID 和末页状态不受影响。

## 阶段 2：重构计时与清理边界

### 文件

- `components/recent-workouts-timeline.tsx`

### 实施内容

1. 增加模块常量：

```ts
const MIN_LOADING_FEEDBACK_MS = 280;
const CONNECTING_FEEDBACK_MS = 360;
const SUCCESS_FEEDBACK_MS = 800;
const AUTO_REVEAL_DURATION_MS = 240;
const AUTO_REVEAL_MAX_PX = 96;
const USER_SCROLL_THRESHOLD_PX = 12;
```

2. 为以下异步阶段分别保存 timer ref：
   - 最短加载反馈。
   - 接入完成。
   - 成功文案恢复。
   - 程序化滚动保护。
3. 提供统一 `clearMotionTimers()`，在以下时机调用：
   - 组件卸载。
   - `snapshotKey` 变化。
   - 新一轮请求开始。
   - 请求进入失败状态。
4. 保留现有 `requestGenerationRef` 与 `requestInFlightRef`：
   - timer 到期前再次核对 generation。
   - 旧账号或旧快照响应不能进入 `connecting`。
5. 最短反馈窗口与网络请求并行：

```ts
const [nextPage] = await Promise.all([
  requestWorkoutHistory(cursor),
  waitForMinimumFeedback(),
]);
```

6. reduced-motion 下跳过最短反馈等待，响应完成后立即更新。

### 验证

- 快速本地请求不会只闪一帧。
- 慢请求不会额外叠加 `280ms`。
- 离开页面后 timer 不再写入卸载组件。

## 阶段 3：实现标题可见状态

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/globals.css`

### 实施内容

1. 把标题右侧“已完成记录”改为稳定尺寸的状态槽位。
2. 根据状态展示：
   - 默认：`已完成记录`
   - 成功：`已接入 N 次训练`
   - 失败：`追溯失败`
3. 使用 `AnimatePresence` 或单个 `motion.span` 进行 `160ms` 交叉淡入。
4. 状态槽位使用最小宽度和右对齐，切换文案时标题不移动。
5. 标题状态只负责可见反馈；完整信息仍写入独立 `aria-live`。
6. `success` 保留 `800ms`：
   - `pageInfo.hasMore = true` 时转回 `idle`。
   - `pageInfo.hasMore = false` 时转入 `exhausted`。

### 验证

- 追加 6 条后无需滚动到列表底部也能看到成功文案。
- 标题宽度、列表位置和力量趋势位置不改变。

## 阶段 4：把加载器接入真实时间线

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/globals.css`

### DOM 调整

删除：

```text
history-loader-rail
  i
```

替换为：

```text
history-load-control
  history-energy-track
    history-energy-point
  history-load-button
    status text
```

### 样式与动画

1. `.history-energy-track`：
   - 与训练节点使用同一个 `left` 基准。
   - 高度 `36–44px`。
   - 中性低亮连接线。
2. `.history-energy-point`：
   - `7px` 圆点。
   - 沿竖轨执行 `translateY()`。
   - `640ms` 单次循环。
   - 绿 → 橙 → 蓝过渡。
3. loading 控件保持原有 `44px` 触控高度和整体占位。
4. 加载按钮文案保持“正在追溯更早记录…”。
5. 不制作覆盖列表的 spinner、遮罩或进度百分比。
6. 通电动画仅在 `loading` 存在；进入 `connecting` 后切换为连接展开。

### 验证

- 能量点与左侧时间线在同一垂直轴。
- 动画不覆盖日期、名称、容量和辅助文字。
- 快速响应和慢请求都能清楚表达状态。

## 阶段 5：实现记录接入编排

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/globals.css`

### 实施内容

1. 请求成功后先计算：
   - 去重后的完整记录。
   - 实际新增数量。
   - 本批前 6 条新增 ID。
   - 成功后的目标状态 `idle | exhausted`。
2. 设置：
   - `newRecordIds`
   - `addedRecordCount`
   - `loadState = "connecting"`
3. 首条新记录增加稳定标记：

```tsx
data-new-record-index="0"
```

4. 接入动画：
   - 连接段 `scaleY: 0 → 1`，`200ms`。
   - 新记录最多前 6 条，单条 `200ms`。
   - 延迟 `newRecordIndex * 32ms`。
   - `opacity: .35 → 1`
   - `translateY: 6px → 0`
   - `blur: 2px → 0`
5. 每条记录继续由最终数组索引决定绿／橙／蓝。
6. 旧记录 `initial={false}`，不能重新动画。
7. `CONNECTING_FEEDBACK_MS` 结束后进入 `success`。

### 验证

- 每次加载最多 `6` 条，最后一页使用实际剩余数量。
- 新首条节点先点亮，旧／新边界清楚。
- 记录顺序、容量、组数和颜色不变。
- 接入动画中内容已进入 DOM，动画失败时不会保持隐藏。

## 阶段 6：重做内部滚动锚点

### 文件

- `components/recent-workouts-timeline.tsx`

### ref 模型

```ts
type ScrollIntent = {
  startTop: number;
  userMoved: boolean;
  programmatic: boolean;
};
```

### 实施内容

1. 点击时记录 `viewport.scrollTop`。
2. 在内部视口 `onScroll` 中：
   - 只在 `loading | connecting` 期间判断。
   - 程序化滚动时忽略。
   - 与 `startTop` 差值超过 `12px` 时标记 `userMoved = true`。
   - 使用 ref，不因滚动高频触发 React state。
3. React 提交新记录后，在 `useLayoutEffect` 中定位：

```text
[data-new-record-index="0"]
```

4. 如果用户没有主动滚动且未开启 reduced-motion：
   - 计算让首条新记录完整可见所需的最小距离。
   - 目标不超过当前 `scrollTop + 96px`。
   - 使用内部 `viewport.scrollTo({ behavior: "smooth" })`。
   - `240ms` 后清除程序化滚动保护。
5. 如果用户主动滚动：
   - 不恢复点击前位置。
   - 不自动推进。
6. reduced-motion：
   - 不平滑滚动。
   - 保持当前内部位置。
7. 删除当前固定 `32px` nudge 逻辑。
8. 不读取或修改 `window.scrollY`，不调用 `scrollIntoView()`。

### 验证

- 首条新记录完整出现，第二条可以部分露出。
- 自动推进不超过 `96px`。
- 外层页面位置和力量趋势 `getBoundingClientRect().top` 不变。
- 请求期间手动滚动超过 `12px` 后，系统不抢位置。

## 阶段 7：错误、终点与 reduced-motion

### 文件

- `components/recent-workouts-timeline.tsx`
- `app/globals.css`

### 错误

1. 请求失败时：
   - 清理最短反馈和接入 timer。
   - 保留旧游标、记录和滚动位置。
   - 停止能量点。
   - 标题显示“追溯失败”。
   - 末端按钮显示“加载失败，点击重试”。
2. 重试从同一游标重新进入 `loading`。

### 终点

1. 最后一批先完成正常 `connecting`。
2. 标题显示“已接入 N 次训练”。
3. `800ms` 后进入 `exhausted`。
4. 终点节点只执行一次 `160ms` 亮度脉冲。
5. 终点不保留循环发光。

### reduced-motion

1. 跳过：
   - `280ms` 最短反馈窗口。
   - 能量点移动和颜色过渡。
   - 连接段展开。
   - 新记录位移、模糊和错峰。
   - 内部平滑推进。
   - 终点脉冲。
2. 保留所有文字状态和 `aria-live`。
3. CSS media query 只限定在 `.recent-workouts-timeline`。

## 阶段 8：自动化回归

### 文件

- `tests/rendered-html.test.mjs`
- 可选 `tests/workout-history-pagination.test.ts`

### 实施内容

1. 更新静态回归断言：
   - 存在 `connecting` 状态。
   - 存在 `MIN_LOADING_FEEDBACK_MS`。
   - 存在标题“已接入 N 次训练”状态槽位。
   - 存在竖向 `history-energy-track`。
   - 不再存在 `history-loader-rail`。
   - 新记录错峰上限为 6。
   - 自动推进上限为 `96px`。
   - 存在用户滚动阈值 `12px`。
2. 保留原分页测试：
   - `6 → 6 → 6… → remaining`
   - ID 去重
   - `0 kg`
   - 游标合法性
3. 如果滚动目标计算抽取为纯函数，增加：
   - 已完整可见时不推进。
   - 需要推进时取最小距离。
   - 长记录场景不超过 `96px`。
   - userMoved 或 reduced-motion 时不推进。
4. 不为了测试方便把 DOM 或动画状态暴露成生产 API。

## 阶段 9：浏览器与录屏验收

### 测试数据

复用当前本地 `iconqa` 的 30 条记录：

- 首屏 6 条。
- 首屏展示 6 条。
- 后续连续 4 次各追加 6 条。
- 包含长名称、`0 kg` 和不同记录高度。

测试数据只存在本地 D1，不进入 Git。

### 手机视口

- `390 × 844`
- `375 × 812`

核对：

1. 点击后 `100ms` 内进入通电状态。
2. 快速响应时通电反馈可见。
3. 首次追加后首条新记录完整出现。
4. 第二条只露出部分时仍能理解后方有内容。
5. 每次标题显示“已接入 6 次训练”。
6. 使用不足 6 条的末页夹具时，显示实际接入数量。
7. 外层页面和力量趋势位置不跳。
8. 内部滚动顺畅，无横向溢出。
9. 用户主动滚动时不抢位置。
10. 终点文字稳定且无持续动画。

### 桌面

核对：

- 标题状态不改变列宽。
- 内部滚动条出现时三列不抖动。
- 加载轨与左侧时间线轴线对齐。
- 控制台无新增错误或警告。

### reduced-motion

核对：

- 新记录立即出现。
- 没有位移、模糊、错峰或平滑滚动。
- 加载、成功、失败和终点文字完整。

### 对比录屏

实施后重新录制一次完整流程，与
`录屏2026-07-29 13.58.21.mov` 对比：

- 加载反馈必须明显但不拖沓。
- 新旧边界必须可辨。
- 成功反馈必须在视口内。
- 后续手动滚动与加载动画必须能够明显区分。

## 阶段 10：完整验证

依次执行：

```bash
npx tsc --noEmit
npm run lint
npm test
git diff --check
```

其中 `npm test` 已包含生产构建。

最终检查：

- Git diff 只包含已确认范围。
- 不提交本地 D1 测试数据。
- 不修改 `.dev.vars`、`.wrangler` 或线上 Sites 配置。
- 不启动部署。

## 风险与处理

### 快速响应看不到 loading

- 使用与请求并行的 `280ms` 最短反馈窗口。
- reduced-motion 下不强制等待。

### 动画完成前组件卸载

- generation 校验与统一 timer 清理共同阻止旧状态回写。

### 自动滚动与用户手势冲突

- 请求期间记录用户滚动意图。
- 超过 `12px` 后取消自动推进。

### 连续多次加载造成动画疲劳

- 每次最多只动画 6 条，且只由用户明确点击触发。
- blur 限制为 `2px / 200ms`。
- 不为普通滚动和已存在记录重复播放。

### 长名称导致首条高度变化

- 运行时测量真实 DOM 高度。
- 计算最小揭示距离并限制在 `96px`。

### 成功状态位于列表末端不可见

- 成功反馈移到标题状态槽，不依赖列表末端位置。

## 完成定义

只有同时满足以下条件才算完成：

1. 状态机、通电轨、记录接入和滚动保护全部按规格实现。
2. `iconqa` 的 `6 → 6 → 6 → 6 → 6` 流程在浏览器真实通过。
3. 外层页面和力量趋势没有加载引起的位移。
4. reduced-motion、错误和终点状态通过。
5. TypeScript、lint、45+ 自动化测试、生产构建和 diff 检查通过。
6. 设计 QA 与新录屏已记录。
7. 未触碰明确排除的模块。
