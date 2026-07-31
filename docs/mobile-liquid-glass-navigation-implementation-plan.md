# 移动端液态玻璃菜单实施计划

> 对应规格：[mobile-liquid-glass-navigation-spec.md](./mobile-liquid-glass-navigation-spec.md)

## 1. 实施范围

本次只改造已登录状态下的移动端四项主导航：

- 今日。
- 计划。
- 排行。
- 我的。

保留现有页面顺序、`navigateView`、页面转场方向、训练页隐藏规则和安全区高度。桌面端侧边导航、业务页面、接口、训练状态和持久数据不修改。

不新增运行时依赖，复用现有：

- React Pointer Events。
- `motion/react`。
- CSS `backdrop-filter`、渐变、伪元素和媒体查询。

## 2. 动效基线

### 情绪与性格

- 情绪目标：灵敏、稳定、受控。
- 动效性格：延续练迹已有的 Energetic 方向，但将幅度压低，避免底部导航像游戏按钮。
- 签名缓动：非物理过渡沿用项目的 `var(--ease-out-expo)`。
- 时长层级：
  - 快速反馈：`100ms`。
  - 标准吸附：`180ms`。
  - 松手稳定：不超过 `240ms`。

### 三层运动

1. 主层：玻璃选中层沿 X 轴跟手和吸附。
2. 次层：玻璃层轻微 `scaleX / scaleY`，内部高光以更小距离反向偏移。
3. 环境层：拖动时仅轻微改变阴影和绿色折射强度，不增加循环呼吸。

图标和文字不参与拉伸，只根据预览目标切换颜色。

## 3. 文件范围

```text
components/
└── mobile-liquid-glass-nav.tsx

lib/
└── mobile-navigation-gesture.ts

app/
├── page.tsx
└── globals.css

tests/
├── mobile-navigation-gesture.test.ts
└── rendered-html.test.mjs

docs/
├── mobile-liquid-glass-navigation-spec.md
└── mobile-liquid-glass-navigation-implementation-plan.md

package.json
```

### 文件职责

- `components/mobile-liquid-glass-nav.tsx`
  - 菜单渲染、几何测量、pointer capture、预览与提交、Motion value 和可访问性。
- `lib/mobile-navigation-gesture.ts`
  - 最近菜单、迟滞切换、横纵手势判断和磁吸位置等纯函数。
- `app/page.tsx`
  - 删除当前简单 `MobileNav`，接入新组件；`Home` 继续传入当前 `view` 与 `navigateView`。
- `app/globals.css`
  - 悬浮底座、玻璃选中层、按钮层级、响应式、安全区和降级样式。
- `tests/mobile-navigation-gesture.test.ts`
  - 覆盖手势数学、边界和迟滞行为。
- `tests/rendered-html.test.mjs`
  - 锁定接入边界、语义结构、降级媒体查询和桌面端隔离。

## 4. 阶段一：建立可测试的手势纯函数

新增 `lib/mobile-navigation-gesture.ts`。

### 4.1 类型

```ts
export type GestureIntent = "pending" | "horizontal" | "vertical";

export type MenuGeometry = {
  centers: number[];
  itemWidth: number;
  minX: number;
  maxX: number;
};
```

### 4.2 最近菜单

```ts
export function nearestMenuIndex(
  centers: number[],
  pointerX: number,
): number;
```

规则：

- 返回与触点 X 距离最近的菜单索引。
- 触点在导航外时仍回到首项或末项，不产生越界索引。
- 空数组返回安全默认值 `0`，组件在无有效测量时不提交切页。

### 4.3 横纵意图

```ts
export function gestureIntent(
  deltaX: number,
  deltaY: number,
  threshold?: number,
): GestureIntent;
```

规则：

- 两轴均未超过约 `6px` 时为 `pending`。
- 横向位移明显大于纵向位移时为 `horizontal`。
- 纵向位移明显大于横向位移时为 `vertical`。
- 进入明确意图后，本次手势不再反复切换意图。

### 4.4 迟滞目标

```ts
export function menuIndexWithHysteresis(
  centers: number[],
  pointerX: number,
  currentIndex: number,
  hysteresisPx?: number,
): number;
```

规则：

- 相邻菜单的几何中点是基础边界。
- 从当前菜单移向相邻菜单时，触点需越过中点并额外进入约 `6–8px` 才改变预览目标。
- 一次移动允许跨越多个菜单，不要求逐项经过。
- 当前索引无效时直接使用最近菜单。

### 4.5 磁吸位置

```ts
export function magnetizedX(
  pointerX: number,
  targetCenterX: number,
  minX: number,
  maxX: number,
  pull?: number,
): number;
```

规则：

- 跟手位置与最近菜单中心做有限混合。
- 默认约 `60%` 跟随触点、`40%` 被菜单中心吸引。
- 输出限制在首末菜单中心之间。
- 松手时不再混合，直接归位到目标中心。

## 5. 阶段二：实现移动端导航组件

新增 `components/mobile-liquid-glass-nav.tsx`。

### 5.1 固定菜单数据

组件内部使用稳定数组：

```ts
const mobileMenuItems = [
  { view: "today", label: "今日", icon: "today" },
  { view: "plan", label: "计划", icon: "plan" },
  { view: "ranking", label: "排行", icon: "ranking" },
  { view: "profile", label: "我的", icon: "profile" },
] as const;
```

组件公开接口：

```ts
type MobileLiquidGlassNavProps = {
  view: "today" | "plan" | "ranking" | "profile";
  setView: (view: "today" | "plan" | "ranking" | "profile") => void;
};
```

训练进行页不会渲染该组件，因此不把 `workout` 放入组件内部状态。

### 5.2 DOM 结构

```text
nav.mobile-nav
├── div.mobile-nav-glass-base
├── motion.div.mobile-nav-selection
│   ├── div.mobile-nav-selection-highlight
│   └── div.mobile-nav-selection-refraction
└── 四个 button.nav-button
    ├── KineticIcon
    └── label
```

- 底座和选中层均 `aria-hidden="true"`。
- 按钮保持真实语义。
- 选中层在按钮下方，不阻挡 pointer 与焦点。

### 5.3 几何测量

- 为导航根节点和四个按钮保存 ref。
- 使用 `ResizeObserver` 监听导航尺寸变化。
- 首次挂载、视口变化和每次 pointer down 前刷新四个按钮中心。
- 中心统一换算为导航局部坐标。
- 测量结果放入 ref，pointer move 期间不读取 `getBoundingClientRect()`。
- 指示层宽度以按钮间距和内边距计算，控制在单菜单槽宽度的约 `82–88%`。

### 5.4 已提交与预览状态

- `committedIndex` 从 `view` 派生，不维护第二份业务真值。
- `previewIndex` 只在按压或拖动期间存在。
- 非交互状态的视觉索引始终等于 `committedIndex`。
- `view` 外部变化时：
  - 清理未完成手势。
  - 玻璃层移动到新的 `committedIndex`。
  - 不调用 `setView`。

按钮状态区分：

- `aria-current="page"`：只对应已提交页面。
- `.is-active`：只对应已提交页面。
- `.is-preview`：拖动时对应玻璃层预览菜单，用于图标与文字颜色反馈。

### 5.5 Pointer 生命周期

#### pointer down

1. 只处理 `event.isPrimary` 且主按钮按下。
2. 刷新几何数据。
3. 记录 `pointerId / startX / startY / lastX / lastTime`。
4. 根导航执行 `setPointerCapture(pointerId)`。
5. 触点所在菜单成为初始预览。
6. 玻璃层在 `100ms` 内进入约 `scaleX(1.06)`、`scaleY(.95)` 的按压状态。

#### pointer move

1. 手势意图为 `pending` 时调用纯函数判断横纵方向。
2. 判定为纵向后取消本次导航手势，玻璃层回到当前页面。
3. 判定为横向后：
   - 用迟滞函数更新 `previewIndex`。
   - 用磁吸函数计算玻璃中心位置。
   - 根据最近两次触点差值估算有限速度。
   - 将 `scaleX` 限制在 `1–1.09`。
   - 将 `scaleY` 限制在 `.94–1`。
   - 高光沿拖动反方向移动不超过 `3px`。
4. 不调用 `setView`，不触发页面挂载。

#### pointer up

1. 当前手势仍有效时，以 `previewIndex` 作为最终目标。
2. 先清理 pointer 状态，再释放 capture，避免 `lostpointercapture` 把已提交结果回滚。
3. 玻璃层归位到目标中心并恢复标准尺寸。
4. 目标不同于当前页面时仅调用一次 `setView`。
5. 标记本次合成 `click` 需要被抑制。

#### pointer cancel / lost capture

- 只有 pointer 状态仍活跃时才执行取消。
- 清空预览，回到 `committedIndex`。
- 不调用 `setView`。
- 恢复标准尺寸和高光位置。

### 5.6 点击与键盘

- `onClick` 继续作为键盘、辅助控制和无 pointer 环境的提交入口。
- Pointer 完成后，在 `onClickCapture` 中只抑制紧随其后的那一次合成点击。
- 抑制标志在处理该点击后立即清除；若浏览器没有派发点击，则下一帧自动清除。
- 键盘生成的 `click` 不依赖 pointer 状态，直接调用 `setView`。
- 点击当前页不调用 `setView`，但允许玻璃层完成按压回弹。

## 6. 阶段三：接入 Home

修改 `app/page.tsx`：

1. 导入 `MobileLiquidGlassNav`。
2. 保留现有 `NavButton` 给桌面 `Sidebar` 使用。
3. 删除当前文件内的简单 `MobileNav` 函数。
4. 保留：

```ts
const showMobileNav = view !== "workout" && Boolean(user);
```

5. 在现有位置渲染：

```tsx
{showMobileNav && (
  <MobileLiquidGlassNav
    view={view}
    setView={navigateView}
  />
)}
```

TypeScript 通过 `showMobileNav` 的运行时条件仍不能自动缩窄 `View`，因此接入处使用显式的菜单视图派生值或小型类型守卫，不能用无检查的宽泛断言隐藏错误。

`navigateView` 保持不变，页面方向仍由：

```ts
menuViews.indexOf(currentMenuView)
menuViews.indexOf(nextView)
```

决定。

## 7. 阶段四：实现液态玻璃视觉

修改 `app/globals.css`。

### 7.1 移动端底座

仅在移动端媒体查询内改造 `.mobile-nav`：

- 左右与屏幕保留约 `10–12px` 间距。
- 底部使用 `env(safe-area-inset-bottom)`。
- 可视导航高度约 `58–62px`。
- 保留 `--mobile-nav-height` 作为页面内容预留高度。
- 圆角约为可视高度的一半。
- 背景使用半透明深灰绿、`blur(22px)` 与有限饱和度。
- 外层描边和阴影控制在低对比度。
- `overflow: hidden` 约束玻璃高光，焦点轮廓通过按钮内层或额外 inset 样式保证可见。

### 7.2 选中层

`.mobile-nav-selection`：

- 绝对定位并由 transform 驱动。
- 高度约 `48–52px`。
- 圆角使用胶囊形态。
- 背景包含纵向透明渐变和极弱绿色着色。
- 边框使用上亮下暗的分层效果。
- 阴影同时包含：
  - 外部深色分离阴影。
  - 内部顶部白绿高光。
  - 内部底部暗部。
- `will-change: transform`。
- `pointer-events: none`。

伪元素或子元素：

- 高光：跟随拖动方向反向偏移，模拟折射。
- 折射层：极低透明度的径向渐变，不进行持续循环。

### 7.3 按钮层

- 按钮 `z-index` 高于玻璃层。
- 单项触控区域保持至少 `44px`。
- `.is-preview` 与 `.is-active` 使用亮绿图标和文字。
- 未选中项保持灰绿。
- 禁止按钮自身 hover 位移影响几何中心。
- 移动端按钮不再使用桌面 `.nav-button:hover { transform: ... }`。
- 图标现有激活动画只在真正页面提交后执行，拖动预览只切换颜色，避免四个菜单在经过时逐个播放动画。

### 7.4 降级

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  /* 更高不透明度底座与选中层 */
}

@media (prefers-reduced-motion: reduce) {
  /* 禁止拉伸、弹簧与高光位移 */
}

@media (prefers-reduced-transparency: reduce) {
  /* 降低透明和模糊，保留选中颜色与边界 */
}
```

兼容 Safari 时同时声明标准和 `-webkit-backdrop-filter`。

## 8. 阶段五：自动测试

### 8.1 纯函数测试

新增 `tests/mobile-navigation-gesture.test.ts` 并加入 `npm test`。

覆盖：

1. 最近菜单在首项、中间项、末项和导航外的结果。
2. 低于阈值保持 `pending`。
3. 横向和纵向意图正确且边界稳定。
4. 迟滞区内不切换菜单。
5. 越过迟滞区后切换相邻菜单。
6. 快速跨越多个菜单时直接得到最终索引。
7. 磁吸位置被限制在首末菜单中心之间。
8. 磁吸结果同时受触点与目标中心影响。

### 8.2 静态接入测试

更新 `tests/rendered-html.test.mjs`：

- 新组件只包含四个固定菜单。
- 页面删除旧 `MobileNav` 并接入新组件。
- `showMobileNav` 仍排除 `workout`。
- 拖动过程中没有调用 `setView` 的路径。
- pointer up 只提交一次最终目标。
- 覆盖 `pointercancel` 和 `lostpointercapture`。
- 玻璃层 `aria-hidden`，按钮保留 `aria-current`。
- CSS 包含移动端作用域、safe area、标准和 WebKit blur。
- CSS 包含 reduced motion、reduced transparency 和无 blur 降级。
- 桌面 `.side-nav` 结构与样式入口未被替换。

## 9. 阶段六：浏览器验收

在本地服务上完成以下检查。

### 移动视口

- `390 × 844`。
- `375 × 667`。
- 带安全区的 iPhone 尺寸模拟。

### 手势矩阵

1. 点击四个菜单逐项切换。
2. 今日拖到我的，确认途中页面不切换。
3. 我的拖到今日，确认转场方向正确。
4. 在两个菜单边界附近小幅抖动。
5. 快速滑过两项后松手。
6. 按下后纵向移动并取消。
7. 拖出导航范围后松手。
8. Pointer cancel 后再次正常点击。
9. 连续快速执行点击与拖动。
10. 当前页原地按压。

### 视觉矩阵

- 深色背景上底座、边缘高光和选中层清楚可见。
- 玻璃保持透明层次，不变成实心亮绿按钮。
- 图标文字不随玻璃拉伸。
- 页面内容和底部操作按钮不被遮挡。
- 训练进行页不出现导航。
- 桌面侧边导航无变化。
- reduced motion 下直接定位。
- 无 blur 或减少透明时选中状态仍清楚。

## 10. 验证命令

按顺序执行：

```bash
npm exec tsc -- --noEmit
npm run lint
npm test
git diff --check
```

`npm test` 已包含生产构建。

## 11. 完成条件

- 规格中的 16 项验收标准全部满足。
- 手势纯函数和静态结构测试通过。
- 移动端真实浏览器中点击、拖动、吸附、取消和松手提交行为正确。
- 页面只在松手或正常点击时切换一次。
- 桌面端、训练页、页面业务状态和现有转场无回归。
- TypeScript、ESLint、完整测试、生产构建和 diff 检查全部通过。
