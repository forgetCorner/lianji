# 动作选择器分类筛选实施计划

> 对应规格：[exercise-picker-category-filter-spec.md](./exercise-picker-category-filter-spec.md)

## 实施范围

本次只为计划页共用的 `ExercisePicker` 增加“全部 / 力量 / 有氧 / 核心”分类筛选，并补充固定动作分类、搜索组合、移动端布局和可访问性测试。

分类属于选择器展示层：

- 当前 18 个固定动作按稳定 `exerciseId` 显式归类。
- “替换已有动作”和“选择要添加的动作”共用同一实现。
- 不修改 `ExerciseDefinition`、`PlanExercise`、训练计划数据和历史记录。
- 不修改 `/api/exercises`、D1 表或迁移。
- 不删除、收缩或启用现有自定义动作预留能力。

## 文件改动

```text
lib/
└── exercise-category.ts                              # 新增：分类、计数与过滤纯函数

components/
└── track-select.tsx                                 # 修改：分类状态与选择器交互

app/
└── globals.css                                      # 修改：桌面与移动端分类栏样式

tests/
├── exercise-picker-category.test.ts                 # 新增：分类与搜索组合测试
└── rendered-html.test.mjs                           # 修改：结构、可访问性和样式约束

docs/
├── exercise-picker-category-filter-spec.md
└── exercise-picker-category-filter-implementation-plan.md

package.json                                         # 修改：把新测试加入 npm test
```

明确不修改：

- `components/training-plan-view.tsx`
- `lib/training.ts`
- `lib/server/plans.ts`
- `lib/server/workouts.ts`
- `app/api/exercises/route.ts`
- `app/api/plans/active/route.ts`
- `app/api/workouts/route.ts`
- `drizzle/`
- 已确认的计划页顶部共享元素动画

`TrainingPlanView` 已经让两个动作入口共用 `ExercisePicker` 并传入同一个 `exerciseLibrary`，因此不需要在页面层重复接入分类。

## 阶段 1：建立固定动作分类域

新增 `lib/exercise-category.ts`。

### 类型

```ts
export type ExerciseCategory = "strength" | "cardio" | "core";
export type ExerciseCategoryFilter = "all" | ExerciseCategory;

export type ExerciseCategoryCounts = Record<ExerciseCategoryFilter, number>;
```

### 固定映射

使用完整、显式的 `exerciseId → category` 映射：

```ts
const exerciseCategories: Readonly<Record<string, ExerciseCategory>> = {
  "treadmill-warmup": "cardio",
  "incline-walk": "cardio",
  "plank": "core",
  "dead-bug": "core",
  "crunch": "core",
  // 其余 13 个固定动作逐项声明为 strength
};
```

不根据中文名称、器械或 `trackingType` 猜测固定动作分类。

分类查询函数：

```ts
export function exerciseCategory(
  exerciseId: string,
): ExerciseCategory | null;
```

- 当前 18 个固定动作必须全部返回明确分类。
- 未知 `exerciseId` 返回 `null`，不能默认写成力量。
- 这样不会给后续自定义动作或新增固定动作悄悄分配错误分类。
- 新增固定动作时，单元测试会要求同步补充分类映射。

### 数量

```ts
export function exerciseCategoryCounts(
  options: ExerciseDefinition[],
): ExerciseCategoryCounts;
```

规则：

- `all` 等于传入 `options.length`。
- 其他数量只统计有明确固定分类的动作。
- 当前动作库结果必须为 `18 / 13 / 2 / 3`。
- 计数函数不接收搜索词，保证搜索过程中数量不跳动。

### 搜索与分类

```ts
export function filterExerciseOptions(
  options: ExerciseDefinition[],
  query: string,
  category: ExerciseCategoryFilter,
): ExerciseDefinition[];
```

派生顺序：

```text
完整 options
  → 名称 / 器械 / 肌群搜索
  → 分类筛选
  → 可见动作
```

规则：

- 使用现有中文小写规范化方式。
- `all` 保留全部搜索匹配项。
- 分类筛选只保留分类完全匹配的动作。
- 未知分类动作只在“全部”中可见，不提前定义未来自定义动作规则。
- 保持原始动作顺序。

## 阶段 2：扩展 ExercisePicker 状态

修改 `components/track-select.tsx` 中的 `ExercisePicker`，不影响通用 `TrackSelect`。

新增：

```ts
const [category, setCategory] =
  useState<ExerciseCategoryFilter>("all");
const optionsRef = useRef<HTMLDivElement>(null);
```

把现有 `filtered` 改为调用 `filterExerciseOptions(options, query, category)`，并通过 `exerciseCategoryCounts(options)` 生成分类数量。

### 打开和关闭

`openPicker()` 显式执行：

1. `setQuery("")`。
2. `setCategory("all")`。
3. 按当前选中动作计算 `activeIndex`。
4. 把动作列表滚动位置归零。
5. 打开选择器并沿用现有搜索框自动聚焦。

`close()` 显式清理：

1. 关闭选择器。
2. 清空搜索。
3. 重置为“全部”。
4. 保留现有焦点返回触发器行为。

即使未来其他调用路径改变关闭顺序，再次打开也有明确初始状态。

### 切换分类

新增 `chooseCategory(nextCategory)`：

```ts
setCategory(nextCategory);
setActiveIndex(0);
resetOptionsScroll();
```

- 不关闭选择器。
- 不修改当前动作值。
- 有搜索词时继续在搜索结果内筛选。
- 空分类保持当前标签选中，并展示分类空状态。

### 搜索

搜索输入行为调整为：

1. 读取新搜索词。
2. 当旧搜索词为空、新搜索词首次变为非空时，将分类切回 `all`。
3. 更新搜索词。
4. 重置 `activeIndex = 0`。
5. 把动作列表滚动位置归零。

清空搜索按钮只清空搜索并回到列表顶部，保留用户在输入搜索后再次手动选择的分类。

### 活动项

- 继续通过 `safeActiveIndex` 限制键盘活动索引。
- 过滤结果为空时不输出 `aria-activedescendant`。
- 过滤结果改变后不能引用旧列表中的 option id。
- `ArrowUp / ArrowDown / Home / End / Enter / Escape` 行为保持现有逻辑。

## 阶段 3：渲染分类栏

在搜索框与动作列表之间增加：

```tsx
<div className="exercise-picker-categories" role="group" aria-label="动作分类">
  {categoryFilters.map((item) => (
    <button
      type="button"
      aria-pressed={category === item.value}
      className={category === item.value ? "is-active" : ""}
      onClick={() => chooseCategory(item.value)}
    >
      <span>{item.label}</span>
      <b>{counts[item.value]}</b>
    </button>
  ))}
</div>
```

分类顺序固定：

```text
全部 → 力量 → 有氧 → 核心
```

动作列表 `div` 绑定 `optionsRef`，供搜索和分类变化时回到顶部。

### 空状态

根据当前条件区分：

- `query.trim()` 非空：继续显示“没有匹配动作 / 换个关键词再试试。”
- 搜索为空且分类不是 `all`：显示“该分类暂无动作 / 可以查看其他分类或使用搜索。”

分类按钮始终保留，用户可直接切换出空状态。

## 阶段 4：桌面端样式

修改 `app/globals.css`。

新增：

- `.exercise-picker-categories`
- `.exercise-picker-categories button`
- `.exercise-picker-categories button::after`
- `.exercise-picker-categories button.is-active`
- 分类名称和数量的文字层级

桌面端约束：

- 分类栏为 `44px` 高的四列等宽网格。
- 背景透明，只保留必要的底部分隔。
- 未选中使用低强调文字。
- 选中使用亮绿色文字和短底线。
- 数量使用更小、更暗的等宽数字。
- `:focus-visible` 提供清晰焦点轮廓。
- 不使用胶囊背景、卡片外框或横向滑动标签。

保持弹出菜单总高度约束不变：

- 搜索栏约 `48px`。
- 分类栏 `44px`。
- 动作列表桌面最大高度从当前约 `340px` 调整为约 `296px`。
- `useAnchoredPosition(..., estimatedHeight: 390)` 继续使用现有估算，不扩大弹层。
- 菜单仍由 portal 渲染，并根据可用空间向上或向下展开。

## 阶段 5：移动端样式

更新移动端 `.exercise-picker-sheet`：

```css
grid-template-rows: auto auto auto minmax(0, 1fr);
```

对应：

1. 标题栏。
2. 搜索框。
3. 分类栏。
4. 可滚动动作列表。

移动端约束：

- 分类栏点击区域不小于 `44px`。
- 搜索框与分类栏保持单一连续控制区，不增加卡片嵌套。
- 动作列表继续使用剩余高度并独立滚动。
- 弹层继续受 `min(72dvh, 620px)` 和底部安全区约束。
- 分类切换不带动背景页面滚动。
- `.exercise-picker-options` 的移动端规则覆盖桌面最大高度，保持 `max-height: none`。

减少动态效果：

- 分类文字和底线只使用短促颜色/透明度过渡。
- 在现有 `prefers-reduced-motion: reduce` 规则中关闭分类过渡。

## 阶段 6：领域测试

新增 `tests/exercise-picker-category.test.ts`。

测试覆盖：

1. `exerciseLibrary` 当前 18 个动作全部拥有明确分类。
2. 数量为 `all: 18 / strength: 13 / cardio: 2 / core: 3`。
3. 有氧只包含跑步机热身和爬坡。
4. 核心只包含平板支撑、死虫和卷腹。
5. 其余固定动作全部属于力量。
6. 搜索继续匹配名称、器械和肌群。
7. 分类与搜索可以组合，且保持原始顺序。
8. 未知 `exerciseId` 在“全部”可见，但不被归入三个固定分类。
9. 搜索词不会影响完整分类计数。
10. 无结果返回空数组，不回退到全部动作。

修改 `package.json`，把新测试加入现有 `npm test` 的显式文件列表。

不新增 React 测试框架或浏览器测试依赖。

## 阶段 7：静态结构测试

修改 `tests/rendered-html.test.mjs`，增加实现约束：

- 分类栏包含 `role="group"` 和 `aria-label="动作分类"`。
- 分类按钮使用 `aria-pressed`。
- 分类顺序为全部、力量、有氧、核心。
- 打开和关闭都会重置 `category`。
- 搜索首次输入会切回 `all`。
- 搜索和分类变化都会重置活动项与列表滚动位置。
- 空分类与搜索无结果使用不同文案。
- CSS 包含四列分类栏、活动底线、`44px` 点击区和焦点样式。
- 移动端 sheet 使用四行 grid。
- reduced-motion 规则覆盖分类过渡。
- `TrainingPlanView` 仍只传入 `exerciseLibrary`，没有启用自定义动作入口。

静态测试只保护关键结构，分类逻辑以领域单元测试为主。

## 阶段 8：验证

### 自动验证

按顺序执行：

1. `git diff --check`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `node --experimental-strip-types --test tests/exercise-picker-category.test.ts`
5. `npm test`

`npm test` 会包含生产构建和完整测试集。

### 本地界面检查

在现有本地服务上检查桌面端和 `390 × 844` 移动端：

1. 打开计划页任意已有动作的选择器。
2. 确认分类数量和固定映射准确。
3. 依次切换力量、有氧、核心，检查列表回顶和选中线。
4. 在分类后输入搜索词，确认首次输入切回全部。
5. 搜索后再次选分类，确认组合筛选。
6. 清空搜索，确认保留当前分类。
7. 关闭并重新打开，确认回到“全部”且搜索为空。
8. 用键盘完成搜索、分类切换和动作选择。
9. 在移动端滚动动作列表，确认背景不滚动、分类不误触。
10. 在桌面端分别验证向上和向下展开不被裁切。

用户仍可按项目协作方式自行复核真机触控手感；实现方负责先完成浏览器与自动验证。

## 回归边界

实施后重点确认以下内容未改变：

- 当前星期不会因选择或保存动作被重置。
- 训练日名称、重点、状态开关和动作编辑值不变。
- 替换动作仍保留现有字段更新规则。
- 添加动作仍自动启用训练日。
- 计划保存、今日训练同步和训练快照不受分类影响。
- 计划页顶部共享元素动画不变。
- 自定义动作的预留代码、API 和数据库结构仍保留，但当前页面不启用。

## 完成标准

1. 桌面端与移动端都显示四个分类入口。
2. 当前 18 个固定动作的数量和归类准确。
3. 搜索、分类、空状态、重置和选择行为符合规格。
4. 移动端滚动区域和桌面端弹出定位正常。
5. 键盘、焦点和读屏状态完整。
6. 没有修改后端、数据库、计划或历史数据结构。
7. 没有删除或启用自定义动作预留能力。
8. 定向测试和完整验证全部通过。

## 执行方式

### 方案 A：主代理直接执行（推荐）

分类域、选择器状态、样式和测试相互依赖，改动集中在一个小组件及其配套逻辑中。由主代理按阶段连续实现，最容易保持交互细节一致并完成一次完整视觉回归。

### 方案 B：Subagent-Driven

可把分类领域测试或 CSS 检查拆给子代理，但文件耦合较强、任务规模有限，协调成本高于并行收益。只有需要明确并行开发时再使用。
