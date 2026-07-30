# “排行”页面共享元素顶部实施计划

> 状态：已完成
>
> 对应规格：[ranking-shared-header-transition-spec.md](./ranking-shared-header-transition-spec.md)
>
> 推荐执行方式：主代理直接实施；本次改动集中在一个页面和一套独立共享动画，不需要拆分子任务

## 1. 实施目标

把排行页现有通用 `.page-header` 重构为页面专用顶部，并加入滚动驱动的共享元素折叠：

- 展开状态顶部显示排行图标、主标题和副文案，榜单标题行显示“好友排行”和“近 8 周”。
- 排行图标以及榜单标题行中的“好友排行”和“近 8 周”连续移动到顶部固定栏。
- 固定状态只保留模块身份和统计窗口。
- 榜单内部标题调整为“好友排行”，同一行右侧显示“近 8 周”。
- 保留现有排行榜数据、算法、空状态和计算说明。
- 不增加计划页的滚动吸附、正文橡皮筋或手势拦截。

## 2. 实施边界

### 2.1 本次修改

- 排行页面顶部 DOM 和 CSS。
- 排行专用共享元素动画组件。
- `RankingView` 与现有滚动容器的连接。
- 榜单标题去重。
- 对应静态回归测试、设计检查记录和项目交接说明。

### 2.2 本次不修改

- `lib/server/dashboard.ts` 中的排行榜算法。
- `LeaderboardEntry` 数据结构和 `/api/dashboard` 返回。
- 排行榜的 56 天统计窗口和 `70% / 30%` 权重。
- 排名行结构、前三名颜色和空状态。
- 今日、计划、我的三套共享动画。
- 页面横向切换和底部导航。
- 数据库迁移。

## 3. 技术决策

### 3.1 新建排行专用共享组件

新增 `components/ranking-shared-transition.tsx`，不把四套头部动画合并成通用引擎。

原因：

- 现有三套动画已经稳定，抽象会扩大回归范围。
- 排行只有三个只读共享元素，没有计划页的星期交互，也没有“我的”页面的真实设置按钮。
- 独立组件更容易限定清理逻辑和 condensed 状态。

组件接收：

```ts
type RankingSharedTransitionProps = {
  scrollerRef: RefObject<HTMLDivElement | null>;
  sourceIconRef: RefObject<HTMLSpanElement | null>;
  sourceLabelRef: RefObject<HTMLSpanElement | null>;
  sourceRangeRef: RefObject<HTMLSpanElement | null>;
  targetIconRef: RefObject<HTMLSpanElement | null>;
  targetLabelRef: RefObject<HTMLSpanElement | null>;
  targetRangeRef: RefObject<HTMLSpanElement | null>;
};
```

最终元素类型可以按实际 DOM 收敛，但职责不扩张。

### 3.2 单一共享视觉层

组件渲染：

- 一个排行图标视觉副本。
- 一个“好友排行”文字视觉副本。
- 一个“近 8 周”文字视觉副本。

规则：

- 源元素继续负责语义和文档流。
- 固定栏只提供不可见目标槽位和背景。
- 共享层准备完成后隐藏源元素视觉，但不移除布局。
- 共享层使用 `aria-hidden="true"` 和 `pointer-events: none`。
- 不能渲染第二套可见固定内容进行交叉淡入。

### 3.3 真实滚动位置驱动

- 使用传入的 `appContentRef`。
- 兼容 `.app-content` 自身滚动和桌面端窗口滚动。
- 每次滚动只调度一个 `requestAnimationFrame`。
- 进度直接来自当前 `scrollTop / collapseDistance`。
- 不使用 spring、补间追赶、定时器或 Web Animations API 播放独立时间轴。

### 3.4 独立状态命名

在 `.app-content` 上写入：

```text
--ranking-header-collapse
data-ranking-header-condensed
```

- CSS 变量负责主标题、副文案和固定背景的连续状态。
- data 属性只表达是否达到固定阈值。
- 离开排行页面时必须删除变量和 data 属性。

## 4. 文件调整

### 4.1 新增 `components/ranking-shared-transition.tsx`

内部维护：

- 共享视觉层和三个共享节点 refs。
- 起点、目标点、源滚动位置和固定栏高度测量缓存。
- 源/目标字体大小、行高、字重和颜色。
- 当前滚动帧、重测帧和页面切换就绪状态。
- `ResizeObserver`、字体加载和窗口尺寸监听。

逐帧只更新：

- 图标 `transform`。
- 两段文字的 `left`、`top`、`font-size`、`line-height`、`font-weight` 和颜色。
- 共享层可见性。
- `--ranking-header-collapse`。
- `data-ranking-header-condensed`。

### 4.2 修改 `app/page.tsx`

#### `RankingView`

1. 增加 `scrollerRef` 参数。
2. 为展开态排行图标、榜单标题和时间范围建立源 refs。
3. 新建 `.ranking-compact-shell` 和 `.ranking-compact-bar`。
4. 在固定栏中放置三个不可见目标槽位。
5. 将通用 `.page-header` 重写为 `.ranking-hero-header`：
   - 排行图标与主标题、副文案组成和“我的”模块同类的身份区。
   - “好友排行”和“近 8 周”下移到榜单标题行。
6. 删除英文 `FRIENDS / RANKING` 和右侧装饰性大图标。
7. 挂载 `RankingSharedTransition`。

#### `Leaderboard`

1. 标题由“好友进步榜”改为“好友排行”。
2. 说明文案保持不变。
3. 标题右侧显示“近 8 周”。
4. 排名行和 footer 不改。

#### `Home`

- 把现有 `appContentRef` 传给 `RankingView`。
- 不增加新的 portal 根节点。
- 保留切换模块时回到顶部的现有逻辑。

### 4.3 修改 `app/globals.css`

新增：

- `.app-content` 上排行专用折叠变量的默认值。
- `.ranking-compact-shell`、`.ranking-compact-bar` 和渐隐背景。
- 三个固定目标槽位。
- `.ranking-hero-header`、`.ranking-hero-identity`、`.ranking-hero-copy`。
- 展开态图标、主标题、副文案和榜单标题行。
- 主标题、副文案的滚动进度样式。
- `.ranking-shared-layer` 和三个共享视觉节点。

调整：

- 排行页不再使用 `.header-icon`。
- 移动端 `.ranking-layout` 的起始间距与新顶部高度对齐。
- `.leaderboard .section-heading` 适配取消右侧时间范围后的结构。
- `prefers-reduced-motion` 增加排行顶部直接切换规则。

旧 `.page-header` 和 `.header-icon` 仅供排行页使用；排行迁移完成且确认无其他调用后，一并删除无效样式。

### 4.4 修改 `tests/rendered-html.test.mjs`

增加静态回归断言：

- `RankingView` 接收并使用 `scrollerRef`。
- 排行页存在 compact shell、源 refs、目标 refs和 `RankingSharedTransition`。
- 页面不再包含 `FRIENDS / RANKING`。
- 榜单标题为“好友排行”。
- “近 8 周”与“好友排行”处于同一标题行。
- 组件监听真实滚动位置并使用单一 `requestAnimationFrame` 更新。
- 组件存在 `ResizeObserver`、字体加载和 reduced-motion 处理。
- 使用 `--ranking-header-collapse` 和 `data-ranking-header-condensed`。
- 不出现排行专用 spring、snap、rubber-band 或手势拦截逻辑。

### 4.5 更新文档

- 在 `docs/PROJECT_HANDOFF.md` 中把“三套头部共享元素动画”更新为“四套”。
- 新增排行头部的共享元素、尺寸、折叠距离、阈值和易复发问题。
- 在 `design-qa.md` 记录移动端展开态、过渡态、固定态和空榜单检查项。

## 5. DOM 结构

目标结构：

```tsx
<section className="ranking-view page-view">
  <div className="ranking-compact-shell" aria-hidden="true">
    <div className="ranking-compact-bar">
      <span ref={targetIconRef} />
      <span ref={targetLabelRef}>好友排行</span>
      <span ref={targetRangeRef}>近 8 周</span>
    </div>
  </div>

  <header className="ranking-hero-header">
    <div className="ranking-hero-identity">
      <span ref={sourceIconRef}>...</span>
      <div className="ranking-hero-copy">
        <h1>公平地看见进步</h1>
        <p>不比较起点，只比较每个人相对自己的成长。</p>
      </div>
    </div>
  </header>

  <div className="ranking-layout">
    <section className="leaderboard">
      <div className="ranking-section-heading">
        <h2><span ref={sourceLabelRef}>好友排行</span></h2>
        <span ref={sourceRangeRef}>近 8 周</span>
      </div>
      ...
    </section>
  </div>
  <RankingSharedTransition ... />
</section>
```

语义要求：

- 页面只有一个语义 `h1`。
- 共享文字副本不进入无障碍树。
- “近 8 周”是只读说明，不伪装为按钮。
- 空榜单时结构不变。

## 6. 测量流程

1. 获取 `.kinetic-page-stage`，等待页面横向入场结束。
2. 判断当前滚动来源是 `.app-content` 还是窗口。
3. 暂存当前 `--ranking-header-collapse`。
4. 临时把折叠进度设为 `0`。
5. 测量三个源元素和三个目标槽位。
6. 把源矩形换算到稳定的滚动坐标系。
7. 读取源/目标文字的字体属性和颜色。
8. 读取滚动容器顶部和固定栏高度。
9. 恢复原折叠进度。
10. 在同一动画帧写入当前滚动状态。

滚动帧内不能调用 `getBoundingClientRect()`；只有重测流程允许读取布局。

## 7. 进度计算

```text
collapseDistance = mobile ? 132 : 150
rawProgress = clamp(scrollTop / collapseDistance)
sharedProgress = smoothstep(clamp((rawProgress - 0.08) / (0.72 - 0.08)))
condensed = rawProgress >= 0.72
```

- `0–0.08`：保持完整展开状态。
- `0.08–0.72`：三个共享元素迁移；主标题和副文案退出。
- `0.48–0.72`：固定栏背景逐渐增强。
- `0.72–1`：共享元素锁定目标位置。

最终折叠距离在实现时根据真实 DOM 高度校准，但阈值和固定栏尺寸不改变。

## 8. 样式尺寸

### 移动端

```text
固定栏高度         54px
图标目标尺寸       26px
身份元素间距       10px
左右安全边距       24px
固定标题字号       15px
统计窗口字号       10px
```

### 桌面端

```text
固定栏高度         56px
图标目标尺寸       26px
身份元素间距       10px
固定标题字号       15px
```

- 目标位置来自真实 DOM 测量，不在动画组件中写死横坐标。
- 极窄屏幕优先压缩或省略标题，不能截断“近 8 周”。
- 固定背景继续使用现有深色渐隐语言，不引入新色板、模糊或阴影。

## 9. 页面切换与清理

- 页面入场期间源内容正常可见，共享层保持隐藏。
- 入场稳定后才测量并接管视觉。
- 离开排行时恢复源元素 visibility/opacity。
- 清理所有动画帧、观察器和事件监听。
- 删除 scroller 上的排行 CSS 变量和 data 属性。
- 返回排行时从滚动顶部重新测量。
- 快速来回切换主导航不能残留固定栏、隐藏源元素或旧坐标。

## 10. 减少动态效果

`prefers-reduced-motion: reduce` 下：

- 不进行连续路径插值。
- 阈值前显示展开源元素。
- 阈值后直接显示固定共享状态。
- 固定背景通过 data 属性直接切换。
- 清理时必须恢复完整源状态。

## 11. 风险与防护

### 11.1 页面切换坐标系

风险：`KineticPageTransition` 的 transform 未结束就测量，导致共享元素横向偏移。

防护：复用现有 `data-page-transitioning` 就绪检查，未就绪时不隐藏源元素。

### 11.2 源元素和共享层重叠

风险：首次测量或反向滚动时出现双影。

防护：集中管理源元素可见性；共享层准备完成前不接管，清理时统一恢复。

### 11.3 固定背景压住榜单

风险：榜单第一行经过固定栏时文字重叠，或渐隐区域过高。

防护：固定背景只覆盖主身份行及有限渐隐区；在 `320px / 375px / 390px` 宽度校准。

### 11.4 短内容和空榜单

风险：内容不足时错误进入 condensed 状态。

防护：状态只由真实 `scrollTop` 决定；没有滚动距离时保持展开。

### 11.5 对现有动画的回归

风险：修改通用 `.page-header` 或全局 data 清理逻辑影响其他模块。

防护：使用独立 `.ranking-*` 命名；不改三套现有共享组件和通用页头规则。

## 12. 实施顺序

### 阶段一：静态顶部

1. 改造 `RankingView` 展开头部。
2. 新增固定栏及三个目标槽位。
3. 调整榜单标题去重。
4. 确保没有动画接管时页面仍可正常阅读。

### 阶段二：共享元素

1. 新增 `RankingSharedTransition`。
2. 接入图标位移与缩放。
3. 接入标题和统计窗口的位置及字体插值。
4. 接入源元素可见性和共享层状态。

### 阶段三：滚动和响应式

1. 接入 `appContentRef` 和滚动进度。
2. 接入主标题、副文案和固定背景的 CSS 进度。
3. 处理页面切换、重新测量和清理。
4. 处理移动端、桌面端、窄屏和 reduced-motion。

### 阶段四：测试和文档

1. 增加排行顶部静态回归断言。
2. 更新 `PROJECT_HANDOFF.md` 和 `design-qa.md`。
3. 运行完整验证。
4. 由用户在实际手机上确认跟手、反向滚动和固定位置。

## 13. 验证计划

### 自动验证

```bash
npx tsc --noEmit
npm run lint
node --test tests/rendered-html.test.mjs
npm test
git diff --check
```

检查重点：

- 生产构建成功。
- 现有 46 项测试无回归，并加入排行顶部新断言。
- 没有未清理的监听器或类型错误。
- 没有引入新依赖和数据库迁移。

### 代码级状态验证

- 展开态：三个源元素可见，共享层接管后没有双影。
- 中间态：图标、标题、范围来自同一滚动进度。
- 固定态：目标尺寸和位置符合统一变量。
- 反向滚动：沿原路径恢复。
- 页面切换：离开后无残留 data/CSS 变量。
- 空榜单：顶部仍保持完整。
- reduced-motion：阈值前后直接切换。

### 用户设备验证

用户在实际手机上重点确认：

1. `390×844` 或当前手机视口下固定位置是否与其他模块一致。
2. 慢速、快速和惯性滚动时是否跟手。
3. 反向滚动是否无跳动、双影或末端位移。
4. 固定背景是否能遮住经过内容，但不过度覆盖“好友排行”。
5. 切换四个底部模块后排行是否总从完整展开状态进入。

本次默认不调用浏览器自动操作或截图工具；如代码验证通过但真机仍有位置问题，再根据用户视频或截图做定向校准。
