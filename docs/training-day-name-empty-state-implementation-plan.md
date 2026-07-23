# 训练日名称空值实施计划

## 实施范围

把默认休息日名称从系统值“训练日”改为真实空字符串，允许保存空名称，并在所有只读位置统一回退为“未命名训练”。通过窄条件兼容旧默认数据，不执行数据库批量迁移。

## 文件改动

```text
lib/
├── training.ts
└── server/plans.ts

app/
├── page.tsx
├── api/plans/active/route.ts
└── api/workouts/route.ts

components/
└── training-plan-view.tsx

tests/
└── training-plan-domain.test.ts

package.json
```

不修改数据库迁移、`TrainingDay` 数据结构、训练日启用规则和动作保存规则。

## 阶段 1：集中名称规则

在 `lib/training.ts` 增加两个纯函数，避免各页面自行判断空名称。

```ts
export function trainingDayDisplayName(name: string): string {
  return name.trim() || "未命名训练";
}

export function normalizeLegacyTrainingDayName(
  name: string,
  enabled: boolean,
  exerciseCount: number,
): string {
  return !enabled && exerciseCount === 0 && name === "训练日" ? "" : name;
}

export function normalizeLegacyTrainingDayFocus(
  focus: string,
  enabled: boolean,
  exerciseCount: number,
): string {
  return !enabled && exerciseCount === 0 && focus === "自定义" ? "" : focus;
}
```

规则：

- 展示函数只负责空值回退，不修改存储值。
- 旧值规范化必须同时满足“休息日、无动作、名称精确等于训练日”。
- 不对名称做模糊匹配，不清理带空格以外的相似文案。

## 阶段 2：默认计划与旧数据读取

修改 `lib/server/plans.ts`：

1. 默认周二、周四、周六、周日的 `name` 和 `focus` 分别从 `"训练日"`、`"自定义"` 改为 `""`。
2. `readPlan()` 映射每一天时先计算该日动作数组。
3. 使用名称和训练重点规范化函数清理窄条件下的旧系统默认值。
4. 数据库原记录不在读取时直接更新；用户下次保存计划后再自然写回空值。

默认训练日“全身 A / B / C”和训练重点保持不变。

## 阶段 3：保存接口允许空名称

修改 `app/api/plans/active/route.ts`：

- 保留现有 `text(row.name, 60)` 清理与长度限制。
- 删除 `|| "训练日"` 回填，直接保存清理后的字符串，包括空字符串。
- 继续拒绝“已启用但没有动作”的训练日。
- 不改变计划版本、ID 所有权和动作字段校验。

## 阶段 4：计划编辑器

修改 `components/training-plan-view.tsx`：

1. 训练名称输入框增加：

```tsx
placeholder="例如：全身"
```

2. 训练重点保持空值，并使用 `placeholder="例如：腿 + 胸 + 背"` 提供示例。
3. `selectedDayName` 在训练日状态下使用 `trainingDayDisplayName(selectedDay.name)`。
4. 星期导航中，启用但名称为空的训练日显示 `未命名训练`。
5. 休息日仍显示 `休息`，不显示名称回退。
6. 输入框继续绑定真实值，不把占位或回退文案写入 draft。

## 阶段 5：今日页与训练快照

### `app/page.tsx`

- `TodayView` 的 `planName` 使用 `trainingDayDisplayName(plan.name)`。
- 训练状态图标字母从回退后的 `planName` 计算，避免空名称时无法生成标识。
- 本周计划只读列表中，启用但未命名的训练日显示 `未命名训练`。

### `app/api/workouts/route.ts`

- 创建训练快照前计算 `planName = trainingDayDisplayName(day.name)`。
- 返回对象和 `workout_sessions.plan_name` 写入同一个回退结果。
- 不修改训练开始资格、动作快照和当天训练状态逻辑。

这样数据库中的计划名称可以保持空值，但已经开始的训练记录永远有稳定可读的快照名称。

## 阶段 6：测试

新增 `tests/training-plan-domain.test.ts`，覆盖：

1. 空名称展示为 `未命名训练`。
2. 有内容的名称保持不变并清理首尾空格用于展示。
3. “休息日 + 无动作 + 名称训练日”规范化为空。
4. 已启用名称为训练日时保持不变。
5. 休息日保留动作且名称为训练日时保持不变。
6. 其他用户名称保持不变。

修改 `package.json` 的测试命令，把新测试文件加入现有 Node test 列表。

修改 `tests/rendered-html.test.mjs`，增加静态约束：

- 计划名称包含 `placeholder="例如：全身"`，训练重点包含 `placeholder="例如：腿 + 胸 + 背"`。
- 保存接口不再包含 `name: text(row.name, 60) || "训练日"`。
- 默认休息日不再使用 `name: "训练日"`。
- 训练快照使用统一展示函数。

## 阶段 7：验证

按顺序执行：

1. `git diff --check`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm test`

视觉表现由用户本地查看；自动验证负责类型、代码规范、构建和名称规则测试。

## 完成标准

1. 默认休息日输入框为空且显示示例占位。
2. 保存空名称后不会被接口重新写成“训练日”。
3. 窄条件旧默认值会在读取时规范化，其他名称不受影响。
4. 启用但未命名的训练日在所有只读位置显示“未命名训练”。
5. 新训练快照不会保存空 `planName`。
6. 训练日状态、动作要求和计划版本逻辑不变。
7. 所有自动验证通过。
