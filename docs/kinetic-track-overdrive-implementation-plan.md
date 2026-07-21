# 练迹「动能轨道」Overdrive 实施计划

> 状态：已实施
>
> 对应规格：[kinetic-track-overdrive-spec.md](./kinetic-track-overdrive-spec.md)
>
> 推荐执行方式：主代理直接实施，按阶段进行真实浏览器视觉迭代

## 1. 实施目标

在不改变账号、训练计划、训练记录、排行榜和同步数据结构的前提下，将当前的静态 SVG 装饰升级为一套统一的“动能轨道”视觉运行时：

- 使用 WebGL 构建全屏力量场。
- 使用 Motion 编排约 `2.1s` 的启动主动画与页面状态过渡。
- 重做品牌标志、导航图标和关键训练状态图形。
- 让今日、计划、排行、我的、训练与休息拥有一致但可区分的动态表现。
- 在手机、低性能设备、无 WebGL 和减少动态效果环境中提供可靠降级。

## 2. 实施边界

### 保持不变

- 所有 API 路由和请求格式。
- D1 数据库、迁移和训练数据口径。
- 登录、注册、邀请码和多设备同步流程。
- 周计划编辑能力和训练记录方式。
- 排行榜算法与历史统计计算。

### 允许调整

- 页面视觉组件拆分。
- 应用外壳的层级和视觉状态传递。
- 启动覆盖层的时间轴和揭幕方式。
- 图标组件、背景组件和动效依赖。
- 纯视觉提示与成功反馈的表现。

## 3. 技术决策

### 3.1 新增运行时依赖

```bash
npm install ogl motion
```

- `ogl`：负责一个全屏片元着色器和一组轻量粒子，不引入 Three.js 或 3D 模型。
- `motion`：负责 SVG 时间轴、共享元素、页面切换、列表重排和减少动态检测。
- 依赖版本由安装时的 `package-lock.json` 锁定，不手工写入未经安装验证的版本号。

安装后先执行生产构建，确认 React 19、vinext、Cloudflare Vite 和客户端边界兼容，再继续开发。

### 3.2 渲染层级

应用外壳调整为以下层级：

```text
AppShell
├── KineticFieldCanvas        WebGL 背景，常驻且不捕获事件
├── StaticFieldFallback       无 WebGL / 减少动态时显示
├── AppRuntime               现有业务页面和弹层
├── GlobalFeedbackLayer       保存、完成和错误反馈
└── AppBootSequence           首次加载覆盖层
```

Canvas 只创建一次。页面切换通过更新 uniform 参数完成，不卸载和重建 WebGL 上下文。

### 3.3 视觉状态模型

新增统一类型：

```ts
type KineticMode =
  | "boot"
  | "today"
  | "plan"
  | "ranking"
  | "profile"
  | "workout"
  | "rest";

type KineticIntensity = "idle" | "active" | "success" | "error";
```

`app/page.tsx` 根据现有 `view`、`resting`、`saving` 和错误状态生成视觉状态。WebGL 层不读取 dashboard 内容，也不发 API 请求。

## 4. 文件规划

### 4.1 新增 `components/kinetic-field.tsx`

职责：

- 客户端挂载 Canvas。
- 动态加载 OGL，避免服务端执行 WebGL 代码。
- 监听尺寸、像素比、指针、页面可见性和 WebGL context lost。
- 接收 `mode`、`intensity`、`progress` 与启动冲击信号。
- 在模式切换时平滑插值 uniform，不重新创建场景。
- 渲染失败时通知 React 切换静态降级层。

Canvas 属性：

- `aria-hidden="true"`
- `pointer-events: none`
- 固定覆盖应用视口
- 置于业务内容下方、页面底色上方

### 4.2 新增 `lib/visual/kinetic-scene.ts`

封装 OGL 场景生命周期：

- 创建 renderer、全屏 triangle、shader program 和粒子 geometry。
- 管理 `start`、`pause`、`resume`、`resize`、`setMode`、`pulse` 和 `destroy`。
- 限制 DPR 和粒子数量。
- 统计最近约 `120` 帧耗时，低于性能底线时降低质量等级。
- 确保组件卸载、热更新和 context lost 时释放事件与 WebGL 资源。

不把 OGL 对象放入 React state，避免每帧触发 React 渲染。

### 4.3 新增 `lib/visual/kinetic-shaders.ts`

集中维护着色器字符串和质量常量：

- 顶点着色器：全屏坐标和粒子位置。
- 背景片元着色器：弯曲网格、主轨迹、力量等高线、冲击波和暗角。
- 粒子着色器：草绿粒子、橙色能量核和速度拖尾。
- 不使用外部纹理、图片或视频。

把 shader 与 React 组件分离，便于独立调试和避免页面文件继续膨胀。

### 4.4 新增 `components/static-kinetic-field.tsx`

提供无 WebGL 和减少动态模式的高质量静态背景：

- 使用精确 SVG 网格、轨迹和节点。
- 根据页面 `mode` 切换不同路径组合。
- 不使用简单的一根低透明曲线作为唯一背景。
- 组件从读屏树隐藏，不捕获交互。

### 4.5 重构 `components/track-visuals.tsx`

将当前组件升级并拆分职责：

- `KineticBrandMark`：品牌标志 2.0，支持静止、激活、同步和错误状态。
- `TrainingCore`：恢复、A/B/C 训练状态核心。
- `WeeklyTrack`：本周计划和进度轨道。
- `FrequencyOrbit`：我的页面训练频率装饰。
- 删除不再使用的 `TodayAtmosphere` 单曲线背景。

保留纯 SVG 输出，确保 favicon、无 WebGL 和减少动态环境仍然统一。

### 4.6 新增 `components/kinetic-icons.tsx`

实现统一自定义图标：

- `TodayKineticIcon`
- `PlanKineticIcon`
- `RankingKineticIcon`
- `ProfileKineticIcon`
- `StreakKineticIcon`
- `WeekStatusKineticIcon`
- `FriendProgressKineticIcon`
- `SaveLockIcon`
- `StartEnergyIcon`
- `RecoveryIcon`

图标统一使用 `24×24` 视觉网格、圆角端点和一致线宽。导航图标支持 `idle | hover | active`，关键操作图标支持一次性锁定动画。

标准关闭、加减、删除、返回等通用控件继续使用 Lucide，避免为风格重新发明熟悉的操作符号。

### 4.7 重写 `components/app-boot-sequence.tsx`

用 Motion 时间轴取代当前过短的 CSS 时序：

- 阶段一：网格校准与能量核出现。
- 阶段二：粒子汇聚与轨迹绘制。
- 阶段三：左右杠铃片装配、横杆点亮和冲击波。
- 阶段四：真实同步状态停留。
- 阶段五：标志移动到侧边栏目标，页面中心扫开。

实现规则：

- 非减少动态模式下最短可见时长 `1750ms`。
- 数据提前完成时等到标志锁定再揭幕。
- 数据较慢时进入稳定巡航，不重复主动画。
- 错误时中断轨迹并保留重试按钮。
- 重试从断点恢复，不重播完整装配。
- 使用 React 计时和状态保证覆盖层必定卸载，不以 `animationend` 作为唯一出口。

### 4.8 新增 `components/kinetic-page-transition.tsx`

包装今日、计划、排行和我的内容：

- 使用 `AnimatePresence` 控制旧页面退出和新页面进入。
- 页面内容仅做短距离、遮罩和轻微焦点变化，不整页上下漂浮。
- 总时长控制在 `600–800ms`，导航点击立即更新激活状态。
- 输入框、训练中页面和弹层不参与长页面转场。

### 4.9 修改 `app/page.tsx`

- 将 `view` 映射为 `KineticMode`。
- 在应用根部常驻挂载 `KineticFieldCanvas`。
- 用 `KineticBrandMark` 和自定义导航图标替换当前品牌/导航视觉。
- 使用 `KineticPageTransition` 包装非训练页面。
- 训练完成、计划保存、同步错误时向力量场发送一次性 `pulse`。
- 保留现有数据请求、错误处理和业务函数，不在视觉组件中复制业务逻辑。
- 视需要将纯页面 JSX 抽到现有或新组件，避免 `app/page.tsx` 超过当前职责边界。

### 4.10 修改页面组件

#### `components/training-plan-view.tsx`

- 七天列表增加连续轨道和移动的当前节点。
- 日期切换和动作排序使用 Motion 布局动画。
- 保存按钮使用 `SaveLockIcon`，成功后触发一次锁定反馈。
- 不改变表单字段、提交数据或排序结果。

#### `components/active-workout-view.tsx`

- 完成一组后将按钮能量传递到组进度节点。
- 完成动作后播放短促冲击环。
- 完成整次训练触发全局 `success` pulse。
- 数字输入、按钮位置和组间操作保持稳定。

#### 今日、排行、我的

当前三个页面定义在 `app/page.tsx`。实现阶段将它们分别抽取为：

- `components/today-view.tsx`
- `components/ranking-view.tsx`
- `components/profile-view.tsx`

抽取只搬移表现和 props，不改变请求、状态所有权与业务类型。

### 4.11 修改 `app/globals.css`

- 增加语义 z-index：背景、内容、固定导航、反馈、弹层、启动层。
- 增加力量场 Canvas、静态降级层和页面转场样式。
- 更新品牌尺寸、图标状态、训练核心和各页面背景层。
- 删除旧启动轨迹、旧背景单曲线和不再使用的视觉样式。
- 保留所有控件的 hover、focus、active、disabled、loading 和 error 状态。
- 增强 `prefers-reduced-motion` 规则，确保循环、视差、冲击波和页面扫开全部关闭。

### 4.12 修改 `PRODUCT.md`

现有“没有功能意义的装饰动画”和新版方向存在表述冲突。调整为：

- 启动与完成时允许高冲击品牌动效。
- 训练输入和日常操作区域保持克制。
- 禁止散落的模板粒子、随机闪光和持续争夺注意力的装饰动画。

这不是改变产品功能，而是记录用户已经确认的新视觉策略。

### 4.13 文档状态

- 在旧版 `visual-identity-motion-spec.md` 和 `visual-identity-motion-implementation-plan.md` 顶部标记“已由 Overdrive 规格替代”。
- 新版 spec 与本计划作为后续验收依据。

## 5. 分阶段实施顺序

### 阶段一：依赖与视觉基础

1. 安装 `ogl` 和 `motion`。
2. 运行 lint、生产构建和现有测试，确认依赖基线。
3. 建立新的视觉类型、z-index、色彩和动效 token。
4. 完成品牌标志 2.0 静态版、favicon 和自定义导航图标。
5. 浏览器验证 `32px`、`44px`、`112px`、`148px` 四种尺寸。

停点：先确认品牌标志和图标语言，避免后续动画建立在错误造型上。

### 阶段二：WebGL 力量场

1. 实现 OGL 生命周期和全屏 shader。
2. 加入弯曲网格、主轨迹和少量粒子。
3. 加入鼠标磁场、冲击波和页面 mode 插值。
4. 实现 DPR、粒子数量、页面可见性和自动质量降级。
5. 实现静态 SVG fallback 与 context lost 恢复。

停点：桌面和手机分别录制短片或关键帧，检查是否具有纵深且不影响阅读。

### 阶段三：启动主动画

1. 建立 Motion 时间轴和真实数据状态联动。
2. 完成粒子汇聚、杠铃装配、标志锁定和冲击波。
3. 完成标志向侧边栏目标移动和页面揭幕。
4. 完成快速、慢速、未登录、错误和重试五种路径。
5. 验证刷新会播放、内部导航不会播放。

停点：至少截取 `200ms`、`700ms`、`1200ms`、`1700ms` 和揭幕完成五个关键帧。

### 阶段四：逐页接入

1. 今日：恢复/训练核心、本周轨道、计划行能量反馈。
2. 计划：七日轨道、日期节点、排序与保存锁定。
3. 排行：相对进步轨迹、时间范围形变和当前用户高亮。
4. 我的：频率年历、近期训练、力量趋势绘制。
5. 训练与休息：组完成、动作完成、倒计时和整次训练完成反馈。

停点：每个页面完成后在真实数据下检查布局、可读性和交互，不在全部完成后才统一发现问题。

### 阶段五：响应式、降级和收尾

1. 调整桌面、平板和手机质量参数与布局。
2. 验证减少动态模式。
3. 验证 WebGL 禁用和 context lost fallback。
4. 移除旧 CSS、旧视觉组件和无用依赖引用。
5. 更新静态回归测试和文档状态。

## 6. 自动化验证

每个主要阶段执行：

```bash
npm run lint
npm test
git diff --check
```

`npm test` 包含生产构建，应覆盖 React、vinext、Cloudflare 打包和现有静态测试。

扩展 `tests/rendered-html.test.mjs`：

- 新视觉组件与 mode 类型已接入。
- 启动动画存在最短可见时长和错误重试入口。
- Canvas 和静态 fallback 都是隐藏语义且不捕获交互。
- 减少动态样式存在。
- 业务 API 与数据库安全断言保持通过。

## 7. 真实浏览器验收

使用 Playwright CLI 进行至少三轮视觉迭代，不以“代码能运行”代替视觉确认。

### 启动路径

1. 已登录快速加载。
2. 已登录延迟加载。
3. 未登录。
4. dashboard 失败。
5. 重试成功。
6. 刷新重播与内部导航不重播。

### 视口

- `1440×900` 桌面。
- `1024×768` 平板。
- `390×844` 手机。
- 至少一个高 DPR 手机模拟。

### 可访问性

- `prefers-reduced-motion: reduce`。
- 键盘访问导航、登录、计划编辑和训练操作。
- 启动层存在时底层内容 `inert`，卸载后恢复交互。
- 文字和输入对比度符合 WCAG AA。

### 性能

- 在页面内采样至少 `5s` 的 requestAnimationFrame 间隔。
- 桌面和手机分别记录平均 FPS 与 95 分位帧耗时。
- 模拟低质量模式，确认粒子和模糊层下降。
- 页面切后台后确认渲染循环暂停。
- 检查 WebGL context 数量保持为一个。

### 功能回归

- 登录和退出。
- 编辑并保存周计划。
- 开始训练、记录一组、进入休息、完成动作和完成训练。
- 查看排行、我的、账号抽屉和邀请码。
- 刷新后数据仍同步。

## 8. 风险与控制

| 风险 | 控制方式 |
| --- | --- |
| WebGL 在 SSR 或 Cloudflare 构建中报错 | OGL 仅在客户端动态加载，所有 `window`、`document` 和 WebGL 访问放在 effect 内。 |
| 快速接口导致动画再次看不到 | 视觉时间轴与数据状态分离，非减少动态模式最短可见 `1750ms`。 |
| 动画拖慢训练操作 | 长动画只出现在刷新和整次训练完成；输入区域降低背景强度。 |
| 手机掉帧或发热 | DPR 上限、粒子分级、FPS 自动降级、后台暂停和静态 fallback。 |
| WebGL 初始化或上下文丢失 | 捕获失败并立即切换静态 SVG，不阻断业务页面。 |
| 页面切换闪烁 | Canvas 常驻，仅插值 uniform；内容层由 Motion 处理。 |
| 视觉层遮挡点击 | 所有装饰层强制 `pointer-events: none`，z-index 使用语义 token。 |
| 动效过度游戏化 | 只保留草绿、橙色、器械结构和真实数据节点；不使用随机彩色爆炸。 |
| `app/page.tsx` 继续膨胀 | 抽取 today、ranking、profile 页面组件，业务状态仍留在 Home。 |
| dirty worktree 覆盖现有改动 | 在现有视觉改动基础上增量重构，不重置或覆盖用户文件。 |

## 9. 交付停点

实现和本地验收完成后先交付：

- 启动动画五个关键帧。
- 桌面端今日、计划、排行、我的截图。
- 手机端今日与训练截图。
- 减少动态模式静态效果。
- FPS、构建、测试和功能回归结果。

用户确认视觉效果后，再执行：

1. 使用中文 commit message 提交。
2. 发布到 Sites。
3. 验证正式域名与关键 API。

## 10. 执行方式建议

推荐由主代理直接实施：

- 本次核心难点是 WebGL、Motion 与现有状态机之间的连续视觉调试，文件之间依赖紧密。
- 实现过程中需要频繁在真实浏览器中调整 shader、时序和层级，保持一个连续上下文更可靠。
- 仍按上述五个阶段汇报，每个停点都保留可回退的稳定状态。

如果用户确认本计划，下一步直接进入阶段一，不再重新讨论已确认的视觉方向。
