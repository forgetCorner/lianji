# 训练日状态开关实施计划

## 实施范围

本次只替换计划编辑头部中的训练日状态控件，并增加“已有动作时切换为休息日”的确认层。保留 `TrainingDay.enabled`、计划保存接口、今日计划筛选和添加动作自动启用训练日的现有实现。

## 文件改动

```text
components/
├── training-plan-view.tsx
└── training-day-status-control.tsx   # 新增

app/
└── globals.css

tests/
└── rendered-html.test.mjs

docs/
├── training-day-status-switch-spec.md
└── training-day-status-switch-implementation-plan.md
```

不修改：

- `lib/training.ts`
- `lib/server/dashboard.ts`
- `lib/server/plans.ts`
- `app/api/plans/active/route.ts`
- `app/api/workouts/route.ts`
- 数据库迁移文件

## 阶段 1：拆分状态控件

新增 `components/training-day-status-control.tsx`，避免把 portal、焦点管理和确认状态继续堆进已经较大的 `TrainingPlanView`。

组件属性：

```ts
type Props = {
  enabled: boolean;
  exerciseCount: number;
  onChange: (enabled: boolean) => void;
};
```

组件内部负责：

- 渲染“当天安排”说明、当前状态、switch 轨道和滑块。
- 管理确认层的打开与关闭。
- 在需要确认时延迟调用 `onChange(false)`。
- 关闭确认层后把焦点恢复到开关。
- 处理遮罩点击、`Escape`、`Tab` 焦点循环和减少动态效果。

组件不保存训练计划，也不直接修改 draft。

## 阶段 2：状态开关

使用真实 `button`：

```tsx
<button
  type="button"
  role="switch"
  aria-checked={enabled}
  aria-label={`当天安排：${enabled ? "训练日" : "休息日"}`}
>
```

内部结构：

```text
.day-status-control
├── .day-status-caption       当天安排
├── .day-status-action
│   ├── .day-status-label     训练日 / 休息日
│   └── .day-status-track
│       └── .day-status-thumb
└── .day-status-retained      已保留 N 个动作（按条件显示）
```

交互判断：

```ts
if (!enabled) {
  onChange(true);
  return;
}

if (exerciseCount === 0) {
  onChange(false);
  return;
}

openConfirmation();
```

为按钮设置 `touch-action: pan-y`，并记录 pointer 起点；移动超过 `8px` 后忽略本次 click，避免手指纵向滚动时误切换。

## 阶段 3：确认层

确认层通过 `createPortal(..., document.body)` 渲染，使用 `AnimatePresence` 和 `motion`，复用项目当前 portal 与动画依赖，不新增第三方库。

结构：

```text
.day-status-confirm-backdrop
└── .day-status-confirm
    ├── h2     设为休息日？
    ├── p      已配置的 N 个动作会保留……
    └── .day-status-confirm-actions
        ├── 取消
        └── 设为休息日
```

行为：

1. 打开时保存触发按钮引用，并把焦点移动到“设为休息日”。
2. `Tab / Shift+Tab` 在确认层两个按钮之间循环。
3. 点击遮罩、点击取消或按 `Escape` 关闭，状态不变。
4. 点击“设为休息日”先调用 `onChange(false)`，再关闭确认层。
5. 关闭后恢复触发按钮焦点。
6. 组件卸载或切换星期时确认层同步消失，不把旧星期的操作应用到新星期。

动效：

- 遮罩：`opacity 0 → 1`。
- 面板：移动端 `translateY(8px) → 0`，桌面端同样保持小幅位移。
- 打开 `160ms`，关闭约 `120ms`，使用现有 ease-out 曲线。
- `prefers-reduced-motion: reduce` 下持续时间为 `0`。

## 阶段 4：接入计划编辑器

修改 `components/training-plan-view.tsx`：

1. 导入 `TrainingDayStatusControl`。
2. 删除当前 `.day-toggle` 的原生 checkbox 结构。
3. 在原位置渲染：

```tsx
<TrainingDayStatusControl
  enabled={selectedDay.enabled}
  exerciseCount={selectedDay.exercises.length}
  onChange={(enabled) => updateDay((day) => ({ ...day, enabled }))}
/>
```

4. 保留以下现有逻辑不动：
   - `addExercise()` 和 `addCustomExercise()` 自动写入 `enabled: true`。
   - `hasEmptyTrainingDay` 阻止空训练日保存。
   - `selectedDayName` 根据 `enabled` 显示训练名称或休息。
   - 周导航根据 `enabled` 显示训练日状态点。

当 `enabled === false && exerciseCount > 0` 时，状态控件显示 `已保留 N 个动作`。动作编辑器继续正常显示并允许编辑。

## 阶段 5：样式

修改 `app/globals.css`：

### 删除或停用

- `.day-toggle`
- `.day-toggle input`

### 新增

- `.day-status-control`
- `.day-status-caption`
- `.day-status-action`
- `.day-status-label`
- `.day-status-track`
- `.day-status-thumb`
- `.day-status-retained`
- `.day-status-confirm-backdrop`
- `.day-status-confirm`
- `.day-status-confirm-actions`

视觉约束：

- 不给状态控件增加外框、卡片背景或分割线。
- switch 轨道约 `38 × 20px`，整体点击区高度至少 `44px`。
- 训练日使用亮绿色轨道，休息日使用低强调轨道。
- 滑块通过 `transform: translate3d(...)` 移动，不动画 `left`。
- 保留动作说明使用低强调文字，不使用警告红色。
- 焦点使用清晰的外轮廓，但不常驻显示。

响应式：

- 桌面端确认层居中，宽度控制在约 `360px`。
- 移动端确认层贴近底部安全区，左右保持 `16–18px` 间距。
- 不改变 `.day-editor-header` 的整体高度和顶部共享动画测量基线。
- 确认层不能产生横向滚动条。

## 阶段 6：测试

修改 `tests/rendered-html.test.mjs`，增加静态实现约束：

- `TrainingPlanView` 使用 `TrainingDayStatusControl`。
- 新组件包含 `role="switch"` 和 `aria-checked`。
- 新组件使用 `createPortal`。
- 包含“设为休息日”和“已配置的 N 个动作会保留”的确认文案。
- 遮罩关闭使用 click，不使用会干扰滑动的 pointer-down 关闭。
- 原 `.day-toggle` 结构不再出现在计划组件中。
- CSS 包含新的 switch、确认层、移动端安全区和 reduced-motion 规则。

本次不新增后端单元测试，因为业务条件和接口实现没有变化。

## 阶段 7：验证

按顺序执行：

1. `git diff --check`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm test`

视觉动效由用户在本地验证；自动验证只负责构建、类型、代码规范和静态逻辑约束。

## 完成标准

1. 方形勾选框已消失，状态开关语义明确。
2. 开启、关闭、自动启用和保留动作逻辑符合规格。
3. 确认层不会被滚动容器裁切，移动端无横向滚动。
4. 滑动页面不会误触开关。
5. 确认层焦点、遮罩、Escape 和恢复焦点行为完整。
6. 不修改现有后端和计划数据结构。
7. 所有自动验证通过。
