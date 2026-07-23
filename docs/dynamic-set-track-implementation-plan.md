# 训练页动态组数进度实施计划

## 实施范围

重构训练页的组数进度，并把计划与接口的单动作最大组数统一限制为 6。组数仍读取训练快照中的 `minSets`、`maxSets` 和已保存组数，不修改数据库字段和既有训练完成业务。

## 文件改动

```text
components/
├── active-workout-view.tsx
├── training-plan-view.tsx
└── workout-set-progress.tsx

lib/
├── training.ts
└── workout-set-progress.ts

app/
├── api/plans/active/route.ts
└── globals.css

tests/
├── rendered-html.test.mjs
└── workout-set-progress.test.ts
```

## 阶段 1：统一组数上限

1. 在 `lib/training.ts` 导出 `MAX_SETS_PER_EXERCISE = 6`。
2. 计划页最少组、最多组输入统一使用该上限。
3. 输入超过 6 时不更新受控值，显示“每个动作最多 6 组”。
4. 保存接口在解析前检查原始请求，超过 6 时返回 400。
5. 展示模型对遗留异常数据做 1–6 的安全归一化。

## 阶段 2：建立纯状态模型

`lib/workout-set-progress.ts` 接收：

```ts
type Input = {
  minSets: number;
  maxSets: number;
  completedSets: number;
};
```

输出模式、目标文案、当前状态、可访问描述以及 1–6 个节点。节点包含：

- `setNumber`
- `zone: "required" | "optional"`
- `state: "done" | "current" | "pending"`
- `startsOptionalZone`

完成数量限制在 `0...maxSets`，完成最大组数后 `currentSet` 为 `null`。

## 阶段 3：实现简约编号序列

组件结构：

```text
workout-set-progress
├── set-progress-header
│   ├── 组数进度
│   └── 已完成 n / m 组
├── set-progress-sequence
│   └── set-progress-node × maxSets
└── set-progress-zones
    └── 最低目标区
```

实现约束：

- 编号统一为 `01...06`。
- 1–4 组使用大号编号，5–6 组增加 `.is-dense`。
- 完成状态使用亮绿色和完成图标。
- 当前状态使用橙色、扫描角标和轻微呼吸。
- 未开始状态使用中性灰色。
- 下方只保留最低目标区括线，加练状态由当前编号文案表达。
- 节点使用稳定的 `setNumber` 作为 key，不重新挂载整条序列。

## 阶段 4：接入训练页面

在 `active-workout-view.tsx` 使用：

```tsx
<WorkoutSetProgress
  minSets={exercise.minSets}
  maxSets={exercise.maxSets}
  completedSets={exercise.sets.length}
/>
```

保留现有指标输入、保存本组、休息倒计时和动作切换业务。

## 阶段 5：样式

新增或更新：

- `.workout-set-progress`
- `.set-progress-header`
- `.set-progress-count`
- `.set-progress-sequence`
- `.set-progress-node`
- `.set-progress-number`
- `.set-progress-zones`
- `.set-progress-required`
- `.workout-set-progress.is-single`
- `.workout-set-progress.is-dense`
- `.set-limit-error`

视觉约束：

- 不增加卡片背景、完整描边和圆角框。
- 当前橙色、完成绿色沿用训练页现有状态色。
- 1–6 个编号均在可用宽度内等分。
- 状态变化不改变组件高度，避免下方内容跳动。

## 阶段 6：测试与验证

纯逻辑测试覆盖：

1. `1–1` 单组模式。
2. 任意 `N–N` 固定模式。
3. 任意 `N–M` 弹性模式及分区。
4. 当前组、最低目标达成、加练和完成状态。
5. `6–6` 上限场景。
6. 异常完成数量与异常计划值的归一化。

静态实现测试覆盖：

- 训练页接入新组件。
- CSS 使用动态列数、单组和紧凑模式。
- 计划页输入上限与错误文案。
- 保存接口上限校验。
- `prefers-reduced-motion` 处理。

自动验证顺序：

1. `git diff --check`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm test`

按照用户约定，本轮只验证代码报错、逻辑、测试和构建；视觉效果由用户在本地页面确认。
