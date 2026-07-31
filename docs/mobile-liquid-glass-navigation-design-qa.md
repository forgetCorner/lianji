# 移动端悬浮导航 Design QA

## 对照信息

- 视觉问题截图：
  - `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-76510504-77ad-4fbb-a8bc-e4e34eb9d1db.png`（585 × 160）
  - `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-63bb673a-5dcc-4738-a794-70e75146c877.png`（876 × 1662）
- iOS 结构参考：
  - `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-5834c6a7-adcb-4ee8-933f-eb17090da0cb.jpg`（864 × 237）
- 最终实现截图：
  - `/Users/amron/Documents/训练/lianji/output/playwright/mobile-nav-fast-drag.png`（390 × 844）
- CSS 视口：390 × 844
- deviceScaleFactor：1
- 状态：登录后的“今日”页面，完成一次“我的 → 今日”横向拖动并等待 240ms。
- 对照范围：参考图不是同一产品的完整页面，因此只对导航结构、圆角关系、内容重心和选中状态做聚焦对照；页面正文沿用练迹现有视觉体系。

## 最终检查

- 字体与层级：图标为 28px，标签为 10px，图标与标签间距 4px；内容组相对导航垂直居中并略向下收稳，层级清楚。
- 间距与布局：正文保持 100svh，导航为独立 fixed 悬浮层；各页面在滚动内容末尾补回导航高度。今日页滚到底时，最后一项底部位于固定操作按钮上方 58px。
- 圆角：外层半径 34px，选中层四周统一内缩 6px、半径 28px；首尾菜单的选中层不会贴住外边框。
- 颜色与质感：静态导航底座保留背景模糊，移动选中层使用半透明高光和轻阴影，不再实时计算移动背景模糊。
- 图标与素材：沿用项目现有 KineticIcon 图标体系，没有新增占位图或替代素材。
- 文案：今日、计划、排行、我的与现有产品文案一致。
- 交互：点击切换后选中层中心与激活菜单中心偏差小于 0.01px；拖动释放后同样对齐。拖动结束会清理触摸焦点，避免旧菜单残留第二个高亮。
- 性能：移动端页面切换由串行 0.58s 退场再进场，改为同步 0.22s 过渡；移动选中层取消 backdrop-filter，拖动时直接跟随原始位置，释放时先吸附再回弹。
- 控制台：最终浏览器检查无 error 或 warning。

## 对比迭代记录

1. 初始问题：正文高度减去导航高度，形成固定空白带；删除预留高度后，末尾内容又会被导航遮挡。
   - 修复：正文恢复 100svh，今日、计划、排行、我的分别在滚动内容末尾补入导航安全空间。
   - 证据：`output/playwright/mobile-nav-bottom-clearance.png`。
2. 初始问题：选中层仅有 3px 垂直内缩，首尾菜单横向只剩约 1px，视觉上贴边。
   - 修复：建立统一 6px inset，外层 34px、内层 28px，同心关系由同一个变量计算。
   - 证据：`output/playwright/mobile-nav-concentric-inset.png`；实测首项 left/top/bottom 均为 6px。
3. 初始问题：切页渲染时，移动模糊和弹簧位置会停在中间；拖动起点还可能保留焦点边框。
   - 修复：静态底座承担模糊，移动层取消模糊；拖动位置直接跟手，释放先吸附；页面使用 0.22s 同步过渡；释放时清理导航内部焦点。
   - 证据：`output/playwright/mobile-nav-fast-drag.png`；240ms 后页面、激活文字和选中层全部落位。

## 结论

没有剩余 P0、P1 或 P2 问题。最终实现满足本轮提出的悬浮布局、底部安全空间、同心圆角、图标文字重心、果冻拖动和移动端不卡位要求。

final result: passed
