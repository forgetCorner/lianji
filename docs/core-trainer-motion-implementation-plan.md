# 核心训练动效实施计划

## 修改边界

- `components/core-trainer-lottie.tsx`
  - 接入核心动画播放器，控制完整循环、帧插值和减少动态效果偏好。
- `components/track-visuals.tsx`
  - 核心分支替换为本地 Dead Bug Lottie，力量和有氧分支保持不变。
- `scripts/build-core-trainer-asset.mjs`
  - 下载源 `.lottie`、提取完整时间轴并按语义图层替换主题色。
- `public/assets/core-trainer.json`
  - 保存本地主题适配后的核心训练动画。
- `app/globals.css`
  - 删除旧核心 SVG 样式，只处理核心 Lottie 的画布尺寸、位置、溢出和轻量阴影。
- `tests/rendered-html.test.mjs`
  - 锁定播放器参数、本地资源、源信息、颜色映射和旧核心 SVG 的移除。

## 实现步骤

1. 使用现有 `@lottiefiles/dotlottie-react` 和本地 WASM 播放运行时。
2. 下载 `Deadbug fitness exercise` 源 `.lottie` 并提取 `0–360` 帧完整时间轴。
3. 保留源动画人体比例、遮挡关系、对侧手脚协调和所有关键帧。
4. 按固定图层语义替换颜色：主要人物为 `#81A645`，后侧与阴影为 `#71875C`，腹部与躯干核心为 `#BE6324`。
5. 新增独立播放器组件，以 `0.85` 倍速正向循环，载入后同步播放状态。
6. 处理 `prefers-reduced-motion`：暂停动画并固定在首帧。
7. 用等比缩放和平移适配桌面 `190 × 190px` 与移动端 `140 × 140px` 水印区域。
8. 替换训练类型标识中的旧核心 SVG 分支，删除不再使用的核心汇聚动画样式。
9. 更新静态测试，校验源许可元数据、完整时间轴和主题色。
10. 运行 TypeScript、lint、测试、生产构建和 `git diff --check`，并在本地训练页检查核心动作的多个动画帧。

## 风险控制

- 不修改源动作关键帧，避免再次出现手脚频率不一致或关节断开。
- 不给核心动画叠加速度线、呼吸或页面级位移动画。
- 资源落在本地，页面运行时不访问外部 CDN。
- 不修改动作分类、训练记录和其他页面的 `TrackMark`。
- 不覆盖工作区内已有的有氧、力量和动作分类改动。
