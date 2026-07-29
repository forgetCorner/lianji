# “我的”训练历史独立面板实施计划

> 对应已确认规格：
> [`profile-workout-history-panel-spec.md`](./profile-workout-history-panel-spec.md)
>
> 状态：已完成

## 2026-07-29 三分之二抽屉调整计划

用户体验验收后的调整按以下顺序实施：

1. 外层增加全屏遮罩，历史容器改为底部 `66.6667dvh` 抽屉。
2. 标题栏移除返回箭头和已加载数量，改为右侧标准关闭按钮。
3. 仪表盘初始历史和分页批次调整为 10 条，但“我的”近期预览继续截取最近 6 条。
4. 移除首次自动预取与常规“加载更早记录”按钮，正文滚动距底部 `48px` 内自动请求下一批。
5. 普通动态模式把加载反馈最短窗口调整为 `1360ms`，覆盖两轮 `640ms` 轨迹动画并为首帧挂载保留余量；减少动态模式继续即时完成。
6. 保留请求去重、失败重试、终点、轨迹通电、错峰接入与减少动态效果。
7. 关闭动画完成后卸载抽屉组件，使 records、pageInfo、scrollTop 和错误状态恢复初始值。
8. 保留背景冻结、系统返回、`Escape`、外层滚动位置和入口焦点恢复。
9. 通过 TypeScript、ESLint、生产构建、回归测试和 diff 边界检查。

## 实施目标

把现有“近期训练”组件中的预览、分页状态和内部滚动拆开：

- “我的”页面只渲染最近 6 次和“查看全部训练”入口。
- 独立历史子视图承接分页、动画、错误、终点与大量记录滚动。
- 历史视图顶部返回栏始终可用。
- 关闭后恢复“我的”滚动位置和入口焦点。
- 已加载历史在当前用户与仪表盘快照内缓存。

本次不修改分页 API、数据库、头部共享动画、训练频率和力量趋势。

## 当前实现约束

### 页面与导航

- `app/page.tsx` 的根组件持有 `view`、`.app-content` ref 和移动端导航显隐。
- `ProfileView` 目前直接渲染 `RecentWorkoutsTimeline`。
- 移动端 `.app-content` 是“我的”页面真实正文滚动容器。
- `showMobileNav` 当前只根据 `view !== "workout"` 判断。
- `KineticPageTransition` 包裹整个普通页面内容，不适合承担历史面板自身的进出场。

### 近期训练

- `components/recent-workouts-timeline.tsx` 同时负责：
  - 三列时间线记录渲染。
  - 本地 records/pageInfo。
  - 请求与游标推进。
  - loading/connecting/success/error/exhausted。
  - 轨迹通电、新记录接入与自动滚动。
- 需要拆分职责，但不能复制两套记录排版和颜色算法。

### 数据

- `dashboard.recentWorkouts` 已限制为最近 6 次。
- `dashboard.recentWorkoutsPageInfo` 已提供 `hasMore` 与 `nextCursor`。
- `/api/workouts/history`、标准化函数、去重函数与每批 6 条规则可直接复用。

## 组件与状态设计

### 1. 共享时间线列表

新增：

```text
components/workout-history-list.tsx
```

职责：

- 渲染训练记录的时间线与三列内容。
- 统一日期、星期、组数、时长和容量格式。
- 按完整 records 索引保持绿／橙／蓝连续循环。
- 接收新记录 ID 和连接状态，渲染既有接入动画。
- 不持有请求、游标、面板开关或滚动状态。

建议接口：

```ts
type WorkoutHistoryListProps = {
  records: WorkoutSummary[];
  connecting: boolean;
  newRecordIds: string[];
  reduceMotion: boolean;
};
```

这样近期预览与独立历史视图复用同一套 DOM，避免后续长名称对齐或颜色规则发生分叉。

### 2. 近期训练预览

调整：

```text
components/recent-workouts-timeline.tsx
```

改造后职责：

- 只展示传入的最近 0–6 次。
- 空状态继续使用现有真实空状态。
- 标题右侧固定“已完成记录”。
- `initialPageInfo.hasMore = true` 时显示“查看全部训练”。
- 把入口 ref 暴露给父层，用于关闭历史视图后的焦点恢复。
- 不再持有分页请求和分页动画状态。
- 不再添加 `.is-scrollable`。

建议接口：

```ts
type RecentWorkoutsTimelineProps = {
  records: WorkoutSummary[];
  hasMore: boolean;
  onOpenHistory: () => void;
  openTriggerRef: RefObject<HTMLButtonElement | null>;
};
```

入口仍沿用现有按钮视觉语言和至少 `44px` 触控高度，文案改为“查看全部训练”。

### 3. 独立历史子视图

新增：

```text
components/workout-history-panel.tsx
```

职责：

- 始终挂载于当前 dashboard 生命周期，使用 `open` 控制显示。
- 自己持有 records、pageInfo、loadState 和动画 refs。
- 第一次打开时自动请求第一批 6 条更早记录。
- 关闭后保留 records、游标、错误或终点状态。
- 再次打开时滚动到顶部，但不重复自动请求。
- 渲染固定返回栏、历史正文、分页控制和 aria-live 状态。
- 处理 `Escape`、返回按钮、初始焦点和减少动态效果。

建议接口：

```ts
type WorkoutHistoryPanelProps = {
  open: boolean;
  initialRecords: WorkoutSummary[];
  initialPageInfo: WorkoutHistoryPageInfo;
  snapshotKey: string;
  onRequestClose: () => void;
  onExited: () => void;
};
```

面板使用 `AnimatePresence` 保证关闭动画结束后再调用 `onExited` 恢复页面滚动和焦点。

### 4. 根页面协调状态

调整：

```text
app/page.tsx
```

在根页面而不是 `ProfileView` 内持有：

```ts
const [profileHistoryOpen, setProfileHistoryOpen] = useState(false);
const profileScrollTopRef = useRef(0);
const profileHistoryTriggerRef = useRef<HTMLButtonElement>(null);
```

根页面负责：

- 打开前保存 `appContentRef.current.scrollTop`。
- 打开后隐藏移动端主导航。
- 让普通 `.app-runtime` 内容进入 inert 状态。
- 冻结 `.app-content`，保留当前视觉位置。
- 关闭动画完成后恢复 scrollTop。
- 把焦点还给“查看全部训练”。
- 切换账号、退出登录、离开 profile 或 dashboard 快照变化时关闭面板。

历史面板作为 `.app-runtime` 的同级覆盖层渲染，不能放进被 inert 的普通内容树中。

建议结构：

```tsx
<main className="app-shell">
  <KineticField ... />
  <div
    className="app-runtime"
    inert={bootVisible || profileHistoryOpen}
    aria-hidden={bootVisible || profileHistoryOpen || undefined}
  >
    {/* 原有页面、导航、弹层 */}
  </div>
  {dashboard && (
    <WorkoutHistoryPanel
      key={`${dashboard.user.id}-${dashboard.syncedAt}`}
      open={profileHistoryOpen}
      ...
    />
  )}
  {/* boot sequence */}
</main>
```

实际实施时需确保账号弹窗和 boot sequence 的层级不被历史面板错误覆盖；历史面板只允许在已登录、dashboard 已就绪且 `view === "profile"` 时打开。

## 浏览器返回策略

历史视图是独立子视图，应响应浏览器／系统返回。

### 打开

- 调用 `history.pushState()` 写入仅供本面板识别的 marker。
- marker 不修改 URL，不建立新的应用路由。
- 然后打开历史视图。

### 返回事件

- `popstate` 发现面板已打开时，只关闭面板。
- 不切换主导航 view。
- 不触发 dashboard 刷新。

### 点击返回按钮

- 当前 history state 带面板 marker 时调用 `history.back()`。
- marker 不存在时直接关闭，作为刷新或异常状态的安全回退。

### 清理

- 切换账号、退出登录或程序性离开 profile 时，移除事件监听并关闭面板。
- 不在 cleanup 中盲目调用 `history.back()`，避免退出到站外历史。

浏览器返回逻辑单独封装为小型 hook 或根页面 effect，避免散落在面板视图中。

## 滚动与焦点实现

### 打开

1. 读取并保存 `.app-content.scrollTop`。
2. 设置 `profileHistoryOpen = true`。
3. 普通应用内容设置 inert。
4. 给 `.app-shell` 或 `.app-content` 增加历史打开状态类，禁止背景滚动。
5. 历史正文 `scrollTop = 0`。
6. 面板进入后聚焦返回按钮。

### 面板内部

- 面板固定覆盖应用视口。
- 返回栏固定，不放入滚动正文。
- 只有 `.workout-history-panel-body` 使用 `overflow-y: auto`。
- 使用 `overscroll-behavior-y: contain` 阻止滚动传递给背景。
- 移动端使用 `-webkit-overflow-scrolling: touch`。

### 关闭

1. 触发退出动画。
2. 动画结束后解除背景 inert 和滚动冻结。
3. 在布局提交后恢复保存的 scrollTop。
4. 聚焦“查看全部训练”入口。

恢复滚动必须设置 `.app-content.scrollTop`，不能使用 `window.scrollTo()` 或 `scrollIntoView()`。

## 分页与缓存迁移

从 `RecentWorkoutsTimeline` 迁移到 `WorkoutHistoryPanel`：

- `requestWorkoutHistory`
- `records` / `pageInfo`
- `requestInFlightRef`
- 最短反馈计时
- loading / connecting / success / error / exhausted
- 新记录 ID 与错峰动画
- 主动滚动检测
- 游标推进与去重

### 首次自动请求

满足以下全部条件时自动调用一次现有加载函数：

- `open = true`
- `openedOnce = false`
- `initialPageInfo.hasMore = true`
- `nextCursor` 存在
- 没有请求进行中

开始请求前把 `openedOnce` 标记为 true，避免 React effect 重跑产生并发。

如果首次请求失败：

- 保留 openedOnce。
- 再次打开不自动重试。
- 由用户点击“加载失败，点击重试”。

### 快照重置

面板以：

```text
dashboard.user.id + dashboard.syncedAt
```

作为生命周期 key。

key 变化后：

- records 恢复最近 6 次。
- pageInfo 恢复初始游标。
- openedOnce 恢复 false。
- 所有 timer、旧请求世代和动画状态清理。

## 动效迁移

### 面板进出

- 使用现有 `motion/react`。
- 打开：`220ms`，`y: 24 → 0`，`opacity: .92 → 1`。
- 关闭：`180ms`，`y: 0 → 16`，`opacity: 1 → 0`。
- easing：`[0.16, 1, 0.3, 1]`。
- 背景页面不缩放、不模糊、不移动。

### 分页反馈

保留：

- `280ms` 最短可感知窗口。
- 左侧竖向通电轨迹。
- connecting 状态。
- 单批最多 6 条的错峰接入。
- 用户主动滚动时取消自动揭示。

调整：

- 自动揭示目标改为 `.workout-history-panel-body`。
- 标题成功反馈放到历史返回栏右侧“已加载 N 次”位置。
- “我的”预览标题不再显示分页状态。
- 删除 `.timeline-viewport.is-scrollable` 与 `scrollbar-gutter` 依赖。

## 样式计划

调整：

```text
app/globals.css
```

新增主要类：

```text
.workout-history-panel
.workout-history-panel-header
.workout-history-panel-back
.workout-history-panel-count
.workout-history-panel-body
.workout-history-panel-content
.app-shell.is-history-open
```

规则：

- 使用现有 `--background`、`--text`、`--muted`、`--line` 和三种强调色。
- 返回栏使用 1px 中性边线，不增加宽阴影。
- 面板内容桌面端设置最大宽度并居中。
- 移动端处理 `env(safe-area-inset-top)` 和 `env(safe-area-inset-bottom)`。
- 不新增自定义滚动条。
- 不为整页增加卡片圆角、玻璃模糊或装饰粒子。

移除或停止使用：

```text
.timeline-viewport.is-scrollable
```

保留时间线、记录三列和轨迹通电相关样式，必要时把选择器从近期组件范围提升为共享历史列表范围。

## 文件级执行顺序

### 阶段 1：锁定回归测试

修改：

- `tests/rendered-html.test.mjs`

先增加失败断言：

- 近期预览不再使用 `.is-scrollable`。
- “查看全部训练”只由 `hasMore` 控制。
- 存在独立历史视图与固定返回栏。
- 移动端主导航在历史打开时隐藏。
- 面板具备单独正文滚动容器。
- 背景使用 inert，关闭后有 scrollTop 与焦点恢复逻辑。
- 分页仍为每批 6 条。

### 阶段 2：抽取共享记录列表

新增：

- `components/workout-history-list.tsx`

修改：

- `components/recent-workouts-timeline.tsx`

完成：

- 抽取记录 DOM 与格式化。
- 保证三列布局、颜色循环、长名称和 `0 kg` 不变。
- 把近期组件收敛为 6 条预览与入口。

阶段验收：

- “我的”初始视觉与当前确认稿一致。
- 首屏无内部滚动条。
- 训练频率与力量趋势位置只受原自然文档流影响。

### 阶段 3：实现历史视图与分页缓存

新增：

- `components/workout-history-panel.tsx`

完成：

- 固定返回栏。
- 单滚动正文。
- 第一次打开自动加载 6 条。
- 后续手动分页。
- 错误、重试、终点。
- 轨迹通电和记录接入。
- 关闭后保留数据。
- 减少动态效果。

### 阶段 4：接入根页面

修改：

- `app/page.tsx`

完成：

- 面板开关与 dashboard 生命周期 key。
- 保存和恢复 `.app-content.scrollTop`。
- 背景 inert 与滚动冻结。
- 隐藏移动端主导航。
- 返回按钮、浏览器返回和 `Escape`。
- 焦点进入与返回。
- 切换 view、账号和快照时安全关闭。

### 阶段 5：样式与响应式

修改：

- `app/globals.css`

完成：

- 面板覆盖层级。
- 固定返回栏。
- 单滚动正文。
- 移动端安全区。
- 桌面内容宽度。
- 进出场与 reduced-motion。
- 清理旧内部滚动样式。

### 阶段 6：文档与视觉验收

修改：

- `design-qa.md`
- 必要时补充旧分页／动画文档的 superseded 说明。

完成：

- 记录实际 viewport、滚动高度、焦点、导航与状态验证结果。
- 对比确认没有触碰头部、训练频率和力量趋势。

## 自动化验证

按顺序执行：

```bash
npx tsc --noEmit
npm run lint
npm test
git diff --check
```

重点测试：

- 最近不足 6、等于 6、超过 6 的入口显隐。
- 第一次打开只自动请求一次。
- 同一游标不能并发。
- 关闭再打开不重复加载第一页。
- 错误后使用同一游标重试。
- 最后一批不足 6 条进入终点。
- 记录去重和绿／橙／蓝索引连续。
- snapshotKey 变化后缓存完整重置。

如果现有测试环境不支持完整 React 交互测试，不为了本次任务临时引入大型测试框架；以现有静态回归、纯函数测试和真实浏览器验收组合覆盖。

## 浏览器验收

使用本地真实 `iconqa` 数据验证。

### `390 × 844`

- “我的”首屏近期训练无内部滚动条。
- 点击入口后移动端主导航隐藏。
- 返回栏固定。
- 首次自动接入 6 条更早记录。
- 连续加载至少三批后仍只有历史正文滚动。
- 在任意深度点击返回，可立即关闭。
- 恢复“我的”原 scrollTop。
- 再次打开保留记录并回到历史顶部。

### `375 × 812`

- 长名称、大容量和 `0 kg` 不重叠。
- 返回栏、安全区和底部分页控件完整可触达。
- 无横向溢出。

### 桌面端

- 历史内容不过度拉宽。
- 返回栏与记录内容轴线一致。
- `Escape` 关闭。
- 背景页面不可滚动或点击。

### 减少动态效果

- 面板不做位移编排。
- 新记录不做模糊和错峰。
- 状态文字、分页与焦点仍完整可用。

## 风险与控制

### 风险 1：历史面板被父层 inert

控制：

- 面板必须渲染为 `.app-runtime` 的同级层。
- 不把面板放进设置了 inert 的 DOM 子树。

### 风险 2：关闭时页面位置跳动

控制：

- 只保存和恢复 `.app-content.scrollTop`。
- 在退出动画完成、背景解冻后的布局阶段恢复。
- 不调用 window 级滚动方法。

### 风险 3：浏览器返回多退一层

控制：

- 使用明确 marker。
- 只在当前 marker 存在时由返回按钮调用 `history.back()`。
- cleanup 不主动回退未知历史。

### 风险 4：自动首批请求重复

控制：

- `openedOnce` 在发请求前写入。
- 继续使用 request-in-flight ref 和请求世代。
- React Strict Mode 下补回归验证。

### 风险 5：抽取列表导致确认样式漂移

控制：

- 先保持现有 DOM 类名与 CSS 选择器。
- 抽取只移动代码，不同时重做间距、字号或颜色。
- 在 390px 截图对比三列和长名称基线。

### 风险 6：影响已确认模块

控制：

- 头部共享动画组件不进入改动列表。
- 训练频率与力量趋势 JSX 不改。
- 完成前单独检查 diff，确认相关 DOM 无变化。

## 完成定义

只有以下条件全部满足才算完成：

- 已确认规格中的 13 条验收标准全部通过。
- 自动化命令全部通过。
- 三种 viewport 和 reduced-motion 浏览器验收完成。
- 不存在初始滚动条、嵌套滚动陷阱、背景穿透或关闭跳位。
- diff 未修改头部动画、训练频率和力量趋势。
- `design-qa.md` 记录真实验收结果。
