# 有氧跑者动效实施计划

## 修改边界

- `components/cardio-runner-lottie.tsx`
  - 接入官方 React 播放器，控制循环播放、帧插值和减少动态效果偏好。
- `components/track-visuals.tsx`
  - 有氧分支只渲染完整 Lottie 人物。
- `scripts/build-cardio-runner-asset.mjs`
  - 下载并适配现成的完整跑步动画。
- `public/assets/cardio-runner.json`
  - 保存本地适配后的人物时间轴。
- `public/assets/dotlottie-player.wasm`
  - 本地托管播放器运行时。
- `app/globals.css`
  - 只处理画布尺寸、溢出和轻量整体光晕。
- `tests/rendered-html.test.mjs`
  - 锁定官方播放器、源动画信息、本地资源、颜色和无障碍回退。

## 实现步骤

1. 使用 `@lottiefiles/dotlottie-react` 和本地 WASM 运行时。
2. 使用 Musa Adanur 的 `Run Forrest Run` 完整跑步循环作为源动画。
3. 保留源动画的人体骨架、关键帧、手脚换步和躯干节奏。
4. 对源动画的封闭肢体路径做横向收窄，保持骨段长度和关节运动不变。
5. 将躯干、双臂和双腿统一为同一个低饱和亮绿色，头部保留克制的橙色；不再使用肢体深浅区分前后景，并保证循环边界图层颜色一致。
6. 增加橙色头部呼吸和三条按“中间—下方—上方”非纵向顺序、不等间隔启动且穿行时段相互重叠的单向速度线；速度线淡出后透明复位。
7. 播放器监听 `load` 事件，确保初次进入训练页后动画实际开始播放。
8. 删除旧 PNG 分肢体结构、CSS 旋转关键帧及自制步态资源。
9. 运行 TypeScript、lint、测试、生产构建和 `git diff --check`。
10. 在本地训练页连续抓取多个时间点，检查所有手脚颜色一致、循环中点无闪烁、跑步循环、速度线非纵向乱序交错、右侧留白和裁切。

## 风险控制

- 使用已核对来源和许可的单一现成动画，不再继续自制人体步态。
- 不修改动作分类、核心图标、力量图标和训练数据。
- 不依赖运行时外部资源。
- 不提交或覆盖工作区内其他未提交改动。
