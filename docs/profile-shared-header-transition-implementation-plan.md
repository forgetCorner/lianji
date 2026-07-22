# “我的”页面共享元素顶部实施计划

> 状态：待实施
>
> 对应规格：[profile-shared-header-transition-spec.md](./profile-shared-header-transition-spec.md)
>
> 推荐执行方式：主代理直接实施；自动检查只覆盖代码、构建与逻辑，视觉和动画效果由用户本地确认

## 1. 实施目标

把“我的”页面现有的通用页头重构为独立的训练档案头部，并加入滚动驱动的共享元素折叠：

- 展开状态显示头像标记、“我的训练”、副文案、同步状态和设置入口。
- 删除英文眉题、年份展示和底部分割线。
- 头像与标题连续移动、缩小后成为固定栏本身。
- 设置入口使用同一个真实按钮移动到固定栏右侧，避免重复按钮交叉显示。
- 固定状态只保留头像、标题和设置入口。
- 不修改训练频率、近期训练、力量趋势及今日页共享元素逻辑。

## 2. 技术决策

### 2.1 新建页面专用共享组件，不抽象或改写今日页

新增 `components/profile-shared-transition.tsx`，参考 `TodaySharedTransition` 的以下成熟做法：

- 使用 DOM 起点和目标槽位测量。
- 滚动事件只调度一个 `requestAnimationFrame`。
- 位置由当前 `scrollTop` 直接计算，不使用持续追赶插值。
- 等待 `KineticPageTransition` 入场完成后再接管视觉。
- 使用 `ResizeObserver`、`document.fonts.ready` 和窗口尺寸变化重新测量。

不把两套动画合并为通用引擎，也不修改 `today-shared-transition.tsx`，降低今日页回归风险。

### 2.2 单一共享视觉层

- 展开头部中的头像和标题保留在文档流中，负责布局与语义。
- 共享组件渲染唯一可见的头像副本和标题视觉层，滚动过程中从源位置移动到目标位置。
- 源元素在共享层准备完成后只隐藏视觉，不移除布局。
- 固定栏只渲染不可见目标槽位和背景，不渲染第二套可见头像与标题。
- 共享视觉层使用 `aria-hidden="true"` 和 `pointer-events: none`。

标题保留一个语义 `h1`；用于运动的文字副本不进入无障碍树。

### 2.3 设置入口使用单一真实按钮

设置入口不能放在纯视觉层中交叉淡入，因此由 `ProfileSharedTransition` 渲染一个真实按钮：

- 按钮在展开状态位于头部右侧。
- 按钮根据相同滚动进度移动到固定栏右侧。
- 按钮始终保持 `44×44px` 触控范围。
- 共享层容器不接收操作，只有设置按钮自身开启 `pointer-events: auto`。
- `onAccount` 回调通过稳定 ref 读取，避免父组件每次渲染导致整个测量 effect 重建。

## 3. 文件调整

### 3.1 新增 `components/profile-shared-transition.tsx`

组件接收：

```ts
type ProfileSharedTransitionProps = {
  initials: string;
  scrollerRef: RefObject<HTMLDivElement | null>;
  sourceAvatarRef: RefObject<HTMLSpanElement | null>;
  sourceTitleRef: RefObject<HTMLHeadingElement | null>;
  sourceSettingsRef: RefObject<HTMLSpanElement | null>;
  targetAvatarRef: RefObject<HTMLSpanElement | null>;
  targetTitleRef: RefObject<HTMLSpanElement | null>;
  targetSettingsRef: RefObject<HTMLSpanElement | null>;
  suspended: boolean;
  onAccount: () => void;
};
```

最终类型可根据实际元素收敛，但职责保持不变。

组件内部维护：

- 共享头像节点。
- 共享标题节点。
- 唯一真实设置按钮。
- 起点和目标矩形缓存。
- 源/目标字号、字重、颜色和行高。
- 当前滚动帧、重测帧和页面切换就绪状态。

逐帧只写：

- 头像 `transform`。
- 标题 `left`、`top`、`font-size`、`line-height`、`font-weight`。
- 设置按钮 `transform`。
- 共享层可见性。
- `.app-content` 上的 `--profile-header-collapse` 和 `data-profile-header-condensed`。

### 3.2 修改 `app/page.tsx`

#### `ProfileView`

1. 新增 `scrollerRef` 和 `accountOpen` 参数。
2. 为头像源、标题源、设置源槽位增加 refs。
3. 新建 `.profile-compact-shell` 和 `.profile-compact-bar`：
   - 固定栏背景。
   - 头像目标槽位。
   - 标题目标槽位。
   - 设置按钮目标槽位。
4. 重写展开头部为 `.profile-hero-header`：
   - 头像标记。
   - 语义 `h1`。
   - 副文案。
   - 实际同步时间。
   - 设置按钮源槽位。
5. 删除原 `MY TRAINING`、`.year` 和 `.profile-trigger` 结构。
6. 挂载 `ProfileSharedTransition`。
7. 下方训练频率、近期训练、力量趋势 JSX 不做结构调整。

#### `Home`

1. 把现有 `appContentRef` 传给 `ProfileView`。
2. 把 `accountOpen` 作为 `suspended` 状态传入。
3. 保留现有菜单切换时回到顶部的逻辑。
4. 不增加新的 portal 根节点，除非实现时确认页面变换坐标系无法通过“等待入场完成”规避；若必须使用 portal，只新增 profile 专用根节点，不改今日按钮根节点。

### 3.3 修改 `app/globals.css`

新增：

- `.profile-compact-shell`、`.profile-compact-bar`。
- `.profile-compact-avatar-target`、`.profile-compact-title-target`、`.profile-compact-settings-target`。
- `.profile-hero-header`、`.profile-hero-identity`、`.profile-hero-avatar`、`.profile-hero-copy`、`.profile-sync-status`。
- `.profile-shared-layer`、`.profile-shared-avatar`、`.profile-shared-title`、`.profile-shared-settings`。

调整：

- 删除旧 `.profile-header-actions`、`.profile-trigger` 和页面头部年份的 profile 专用使用方式。
- 保留 `.year` 给其他仍需要它的页面，若已经没有引用再单独清理。
- 不修改通用 `.page-header`，避免影响排行页。
- 固定背景在折叠后半段增强，不添加底边线、玻璃卡片或大阴影。
- 移动端固定栏左右间距与页面 `24px` 内边距一致。
- 桌面端目标坐标基于内容区，不重复计算 `88px` 侧边栏。

## 4. 测量与滚动计算

### 4.1 折叠距离

- 移动端初始使用约 `132px` 的折叠距离。
- 桌面端初始使用约 `150px`。
- 最终以展开头部实际高度和训练频率起始位置校准，不能让固定栏压住“训练频率”标题。

### 4.2 测量流程

1. 等待页面切换 transform 和 opacity 完全稳定。
2. 暂时把 `--profile-header-collapse` 设为 `0`。
3. 测量头像、标题、设置源槽位。
4. 测量固定栏三个目标槽位。
5. 恢复原折叠进度。
6. 缓存滚动容器顶部、固定栏高度和文本样式。
7. 在同一个动画帧写入当前状态。

滚动帧内不得调用 `getBoundingClientRect()`。

### 4.3 分段进度

- `0–0.1`：展开状态保持。
- `0.1–0.78`：头像、标题和设置入口迁移。
- `0.15–0.68`：副文案与同步状态淡出。
- `0.48–1`：固定栏背景逐步出现。
- `0.78–1`：元素锁定目标位置，不增加回弹。

头像使用 `translate3d + scale`。标题直接插值实际字号、行高、字重和位置，不使用文字整体缩放。设置按钮使用 `translate3d`，不改变触控尺寸。

## 5. 页面切换与交互边界

- 从其他菜单进入“我的”时，共享层先保持隐藏，页面入场动画完成后再测量并接管。
- 切换离开“我的”时立即清理滚动监听、动画帧、内联样式和 data 属性。
- 返回“我的”时由于菜单逻辑已回到顶部，应从完整展开状态进入。
- 设置抽屉打开时暂停共享层更新；抽屉关闭后重新读取当前滚动位置，不重置页面。
- 快速点击设置按钮不能触发页面滚动或重复打开抽屉。
- 共享层不能拦截训练频率切换、趋势说明气泡或底部导航。

## 6. 减少动态效果

`prefers-reduced-motion: reduce` 下：

- 不播放连续位移。
- 折叠阈值前显示展开状态。
- 达到阈值后直接显示固定栏状态。
- 设置按钮仍为同一个真实按钮，并立即切换到目标位置。
- 清理时恢复源内容，不能残留隐藏状态。

## 7. 实施顺序

### 阶段一：静态结构

1. 重写 profile 展开头部。
2. 建立固定栏和三个目标槽位。
3. 保持共享动画暂未接管时页面仍可正常阅读和操作。

### 阶段二：共享层

1. 新增 `ProfileSharedTransition`。
2. 接入头像共享位移与尺寸变化。
3. 接入标题位置、字号、字重变化。
4. 接入唯一设置按钮的位移和点击行为。

### 阶段三：滚动状态

1. 接入 `.app-content` 实际滚动位置。
2. 接入副文案、同步状态和固定背景的 CSS 进度。
3. 处理反向滚动、快速滑动、菜单切换和重新测量。
4. 处理设置抽屉暂停与恢复。

### 阶段四：清理与逻辑回归

1. 删除旧 profile 页头样式和无引用结构。
2. 检查只有一个语义主标题和一个真实设置按钮。
3. 检查监听器、`ResizeObserver` 和动画帧全部正确清理。
4. 检查页面滚动高度没有因固定栏产生额外空白。

## 8. 验证计划

根据用户约定，本次不进行浏览器截图、视频录制或自动视觉对比，只检查代码错误和逻辑问题。

### 自动检查

```bash
npm run lint
npm test
git diff --check
```

### 代码逻辑检查

- React hooks 顺序稳定，没有条件调用。
- 所有事件监听器、`ResizeObserver`、媒体查询监听器和动画帧均在卸载时清理。
- 页面切换未完成时共享层不会提前显示。
- `accountOpen` 暂停时不重复测量或残留错误可见性。
- 文字使用实际字号变化，没有 `scale()`。
- 只有设置按钮开放 `pointer-events`。
- `prefers-reduced-motion` 分支能恢复源元素。
- profile 的 CSS 变量和 data 属性不影响今日页。
- 页面无横向溢出，固定栏不增加正文底部空间。

### 用户本地确认重点

- 首次进入“我的”时是否没有图标、标题或设置按钮跳位。
- 慢速、快速和反向滑动是否连续。
- 标题在过渡中是否清晰。
- 固定栏是否只保留头像、标题、设置。
- 设置按钮在任意进度下是否能打开抽屉。
- 切换菜单后再次进入是否回到完整展开状态。

## 9. 风险与控制

- **页面入场动画导致坐标偏移**：沿用今日页的 transition-ready 检查，入场稳定前不隐藏源内容。
- **设置按钮变成独立漂浮个体**：设置按钮与头像、标题共用同一个主进度和测量时机，不使用延迟淡入。
- **标题字体发糊**：直接写字号和字重，禁止对文字使用 scale。
- **profile 与 today 共用 CSS 状态冲突**：使用独立的 `--profile-header-collapse` 和 `data-profile-header-condensed`。
- **移动端滚动高度错误**：固定栏使用 `height: 0` 的 sticky shell 提供目标位置，不增加文档流高度。
- **设置抽屉打开后底层仍更新**：通过 `suspended` 暂停更新，关闭后按当前滚动位置恢复。
- **头像文字缩小时偏心**：头像容器统一使用 grid 居中，并对最终尺寸进行光学检查后由用户确认。

## 10. 交付停点

实现完成后只汇报：

- 修改文件和关键逻辑。
- ESLint、生产构建、测试和 diff 检查结果。
- 需要用户本地重点确认的动画状态。

不提交、不部署，也不生成截图或视频。用户确认效果后再决定是否提交和发布。
