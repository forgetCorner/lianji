# 练迹品牌图标、今日页装饰与启动动画实施计划

> 已由 [「动能轨道」Overdrive 实施计划](./kinetic-track-overdrive-implementation-plan.md) 替代，本文件保留为第一版实施记录。

## 实施决策

本次采用“视觉原创，技术参考开源”的方式：

- 品牌图标、恢复轨迹和启动动画使用练迹自有的 SVG 路径，不复制开源项目的图形或动画素材。
- 路径绘制参考 Vivus 与 Anime.js 的实现原理，但不安装两者。
- 动画使用浏览器原生 SVG、CSS 和 React 状态管理完成，不新增运行时依赖。
- 加载动画只服务于账号检查和数据同步，不扩展为每次导航都播放的页面过场。

对应的设计规格见 [visual-identity-motion-spec.md](./visual-identity-motion-spec.md)。

## 开源与官方参考

### 1. Vivus

[Vivus](https://github.com/maxwellito/vivus) 使用 `strokeDashoffset` 将线性 SVG 逐段绘制，支持同步、延迟和逐路径时序。本次参考它的三个思路：

- 图形优先使用 stroke path，不在动画期间操作大量 fill 形状。
- 按路径的长度和视觉顺序分配时长。
- 图标绘制完成后恢复为普通静态 SVG，避免持续更新。

Vivus 的最新发布较早，而练迹只需要几条固定路径，因此不将它加入依赖。

### 2. Anime.js

[Anime.js SVG 文档](https://animejs.com/documentation/svg/) 包含路径绘制、形状转换和轨迹运动工具。本次参考它将“路径显示进度”和“终点位置”分开控制的方式。Anime.js 适合更复杂的形变和多目标编排，本次的固定动画不足以抵消增加依赖的成本。

### 3. 浏览器原生能力

- MDN 将 [`stroke-dashoffset`](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-dashoffset) 标记为广泛可用且可动画，因此用它完成轨迹绘制。
- 启动层揭幕优先用上下两块覆盖层的 `transform` 完成，不强制依赖复杂的遮罩或 `clip-path`。
- 参照 MDN 的 [`prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility) 建议，在用户开启减少动态效果时取消路径移动和揭幕。

## 文件调整

### 新增 `components/track-visuals.tsx`

建立可复用的线性视觉组件：

- `TrackMark`：侧边栏、登录抽屉、启动动画和 favicon 共用的品牌造型。
- `TrainingStatusMark`：根据恢复日或 A / B / C 计划渲染对应的轨迹图形。
- `TodayAtmosphere`：今日页的低透明轨迹、刻度和日期坐标层。
- 组件只接收状态与样式参数，不读取训练或账号数据。

### 新增 `components/app-boot-sequence.tsx`

建立启动覆盖层，封装以下状态：

- `checking`：检查当前账号。
- `syncing`：同时读取 dashboard 与未完成训练。
- `ready`：数据就绪，触发揭幕并卸载覆盖层。
- `error`：轨迹中断，显示具体错误和重试按钮。

组件记录挂载时间：如果数据极快就绪，最多只为图形完成基本识别延后 `250ms`；不强制播完长版开场。覆盖层卸载由 React 状态控制，不依赖 CSS `animationend` 才能显示页面。

### 修改 `app/page.tsx`

1. 用 `TrackMark` 替换 `Brand` 中的文字“练”，保留可读的“练迹”名称。
2. 在 `TodayView` 顶部渲染 `TodayAtmosphere`，装饰层不参与布局。
3. 用 `TrainingStatusMark` 替换 `.plan-letter` 的纯文字实现。
4. 为本周计划、本周状态和朋友进步加入一致的线性图标，不更改现有信息层级。
5. 将现有 `checkingSession` 过程拆分为可见的 `checking` 和 `syncing` 阶段。
6. 在应用最外层只挂载一次 `AppBootSequence`，确保导航切换、登录成功和结束训练时不重播开场。
7. 保留现有账号、dashboard 和训练请求流程，启动层不新增 API 或额外请求。

### 修改 `app/globals.css`

- 添加品牌图标尺寸、悬停终点和响应式规则。
- 将 `.plan-letter` 替换为等尺寸的 `.training-status-mark` 布局，保持训练日与恢复日无抖动。
- 添加今日页氛围层，用 z-index 和 `pointer-events: none` 保证不覆盖操作。
- 添加路径绘制、终点前进、恢复呼吸和启动层揭幕动画。
- 统一使用 `ease-out-quart` 和 `ease-out-expo` 类缓动，不使用 bounce 或 elastic。
- 在已有 `prefers-reduced-motion` 规则中明确关闭轨迹位移、呼吸和揭幕，保留状态文字和简单淡入。

### 修改 `public/favicon.svg`

- 用简化的 `TrackMark` 替换当前 favicon。
- favicon 使用独立 SVG 文件，轨迹坐标与 React 组件保持一致。
- favicon 不包含动画，避免浏览器标签持续闪动。

### 修改 `tests/rendered-html.test.mjs`

增加静态回归检查：

- 品牌标识已使用 `TrackMark`，不再渲染原来的纯文字节点。
- 恢复日使用 `TrainingStatusMark`。
- 启动覆盖层包含可读状态和重试入口。
- 今日页装饰是隐藏语义且不捕获交互。
- CSS 中存在动态降级规则。

## 实施顺序

1. 完成静态 `TrackMark`，先在侧边栏、账号抽屉和 favicon 上确认识别度。
2. 完成恢复日与训练日 `TrainingStatusMark`，先确认桌面和手机布局。
3. 加入今日页氛围层和三个关键区域图标，检查文字对比度与点击区域。
4. 完成 `AppBootSequence` 静态状态机，再逐段加入路径绘制和揭幕。
5. 接入快速就绪、慢加载、未登录和失败重试流程。
6. 完成响应式与减少动态效果。
7. 补充测试，运行构建和真实浏览器验收。

## 验证计划

### 自动化检查

```bash
npm run lint
npm test
```

`npm test` 已包含生产构建，因此可同时验证 React、CSS、vinext 与 Cloudflare 产物。

### 浏览器验收

使用真实浏览器验证以下场景：

1. 已登录桌面端硬刷新：检查账号、同步、揭幕与最终今日页。
2. 未登录硬刷新：动画结束后正常出现登录抽屉，不误报加载失败。
3. 同步延迟：确认完整图标停留且只有终点微小巡航。
4. 请求失败：显示中断轨迹、错误文字和可使用的重试按钮。
5. 内部导航：连续切换今日、计划、排行和我的，确认启动动画不重播。
6. 动态降级：模拟 `prefers-reduced-motion: reduce`，确认只有简单淡入且页面可正常进入。
7. 视口：至少检查 `375px` 手机、`768px` 平板和 `1440px` 桌面宽度。
8. 屏幕截图：分别留存点火、路径绘制和最终页面画面，用于检查图形居中、线宽和空间平衡。

## 风险与控制

- **启动动画变成等待成本**：数据就绪后最多额外等待 `250ms`，并在后续导航中完全不播放。
- **CSS 动画在隐藏标签页暂停**：覆盖层的移除由 React 数据状态与保底计时控制，不用动画回调作为唯一出口。
- **装饰影响阅读**：背景使用低透明度，并在平板和手机端逐层简化。
- **图标过于复杂**：先完成 `32×32` 侧边栏尺寸的可读性验收，再扩展大尺寸动画版。
- **浏览器性能**：持续动画只保留一个小型终点或恢复线段，不对整屏模糊、阴影或布局属性做循环动画。

## 交付停点

实现和本地验收完成后，先交付桌面、手机与启动动画关键帧供确认。用户确认视觉效果后，再使用中文 commit 完成提交并发布到 Sites。
