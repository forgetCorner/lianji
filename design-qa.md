# 近期训练重设计 QA

## 对比目标

- Source visual truth：
  - `/Users/amron/.codex/generated_images/019fa2d9-a07c-7892-80a6-badab98bac3e/call_U2BNBBmGjtQGeP8rBuIkQrkl.png`
  - `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-6577f328-2808-44eb-a3cd-0cf82152e057.png`
  - `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-fbd005d4-3f5b-4884-b24e-06341695ca49.png`
  - `docs/profile-recent-workouts-redesign-spec.md`
- Implementation screenshot：
  - `/tmp/lianji-recent-workouts-polished-390x844.png`
- Final comparison board：
  - `/Users/amron/.codex/generated_images/019fa2d9-a07c-7892-80a6-badab98bac3e/call_ONXYVYGfPSQCZHWBuy2Wk6Nx.png`
- Viewport：`390×844`
- 状态：已登录真实本地账号，“我的”页面滚动到“近期训练”，展示 4 条已完成记录，其中包含 `0 kg`。

## 尺寸与密度

- Source：`853×1844` 像素，和 `390×844` 具有相同纵横比，对比时按比例缩放。
- Implementation：`390×844` 像素。
- CSS viewport：`390×844`。
- Device scale factor：`1`，实现截图像素与 CSS 像素一一对应。
- 未包含设备边框或浏览器外壳。

## 最终用户修正

视觉稿生成后，用户进一步确认以下规则；这些规则优先于原始视觉稿中的对应内容：

1. 日期前保留现有状态点与纵向连接线，不使用心电图图标。
2. 记录按绿、橙、蓝循环。
3. 只有日期、训练名称和容量第一层使用循环色，第二层保持默认弱化色。
4. 右侧始终显示训练容量，容量为零时显示 `0 kg`。
5. 长名称换行时，中间备注与右侧“训练容量”底部对齐。

## Full-view comparison evidence

最终并排对比显示：

- 三列主结构与视觉稿一致：日期、训练名称、训练容量从左到右建立稳定阅读顺序。
- 实现保留了现有“我的”页面上下文，而视觉稿只展示独立模块；这是既定范围差异，不是布局漂移。
- 日期、名称和容量的字号、字重与颜色形成一致的第一层。
- 星期、组数与时长、容量标签保持弱化，未被循环色污染。
- 记录之间依靠留白和时间线组织，没有增加卡片、分割线或详情入口。
- 右侧 `0 kg` 在真实数据中按确认规则展示，没有切换为训练时长。

## Focused region evidence

“近期训练”在 `390px` 视口内宽度为 `342px`，4 条真实记录均没有水平溢出。

浏览器几何检查结果：

- 每条记录的训练名称与容量顶部坐标一致。
- 每条记录的中间备注与右侧标签底部坐标完全一致。
- 普通单行记录高度约为 `65.64px`，不再被强制撑到 `108px`。
- 两行长名称记录按内容自然增高到约 `86.30px`。
- 名称列右边界与容量列左边界保留至少 `10px` 间距。
- `.app-content` 的 `scrollWidth` 与 `clientWidth` 均为 `390px`。

没有额外裁切局部图，因为模块在最终 `390×844` 截图中完整可读；关键对齐同时通过浏览器几何数据进行了精确验证。

## Required fidelity surfaces

### Fonts and typography

- 中文继续使用现有 Noto Sans SC / PingFang SC 字体栈。
- 日期、组数、时长和容量继续使用 Roboto Mono 数据字体。
- 移动端日期、名称、容量分别收敛为 `16px`、`17px`、`19px`，保持层级但不再互相争抢注意力。
- 长名称允许自然换行；共享网格保证换行只增加第一层高度。

### Spacing and layout rhythm

- 外层网格统一控制名称和容量的两层位置。
- 日期保持独立上下组合，不受长名称高度影响。
- 记录改为内容决定行高，单行紧凑、换行自然增高。
- 主次两层间距统一为 `7px`，移动端记录间隔由底部 `24px` 控制。
- 日期、名称、容量的列宽和字级按移动端实际可用宽度重新平衡。
- `390×844`、`375×812` 和桌面宽屏均无近期训练模块水平溢出。

### Colors and visual tokens

- 复用 `--lime`、`--orange`、`--blue`。
- 状态点和三列第一层跟随当前记录强调色。
- 第二层显式使用 `--muted` 或 `--dim`。
- 连接线保持中性 `--line`，颜色不承担完成状态的唯一表达。

### Image quality and asset fidelity

- 本模块没有新的图片、插画或自定义图标资产。
- 保留现有 WebGL 背景和时间线结构，没有用 CSS 图形替代视觉稿中的新资产。
- 未引入模糊、压缩、裁切或透明边缘问题。

### Copy and content

- 主标题“近期训练”和说明“已完成记录”保持不变。
- 容量标签统一为“训练容量”。
- 日期改为 `MM.DD` 与中文星期。
- 重复 footer“累计训练 / 已云端同步”已删除。
- 空状态文案保持真实，不增加示例成绩。

## Comparison history

### Iteration 1

- Earlier finding：`P2`，网格在最小高度内拉伸两行，导致组数、时长和容量标签距离第一层过远。
- Fix：为 `.session` 增加 `align-content: start`，让第二层紧跟第一层实际高度。
- Post-fix evidence：`/tmp/lianji-recent-workouts-implementation-390x844-v2.png`；浏览器测量确认中间备注与右侧标签底部一致。

### Iteration 2

- Earlier finding：`P2`，移动端日期、名称和容量字号比确认稿偏小，第一层强调不足。
- Fix：移动端日期提升至 `18px`、名称提升至 `20px`、容量提升至 `22px`，第二层统一至 `10px`。
- Post-fix evidence：`/tmp/lianji-recent-workouts-implementation-final-390x844.png`；`375px` 视口仍保留列间距且无水平溢出。

### Iteration 3

- User finding：记录间距松散且三列视觉重心不一致，移动端强制 `108px` 行高造成大块无效空白。
- Fix：移除强制最小高度，统一为内容驱动的两行网格；重新收敛字号、列宽、行间距、记录间距、时间线圆点和连接线位置。
- Post-fix evidence：`/tmp/lianji-recent-workouts-polished-390x844.png`；4 条单行记录高度均为约 `65.64px`，首行顶部与第二行底部均精确对齐。
- Long-name evidence：临时将测试账号首条计划名替换为“上肢推拉与肩部稳定训练”进行两行验收，记录高度约 `86.30px`，名称与容量顶部一致，备注与标签底部一致，横向溢出为 `0`；验收后已恢复原始数据。

## Findings

最终没有仍需修复的 `P0`、`P1` 或 `P2` 问题。

## Residual test gaps

- 单条记录和空状态没有在本次真实账号中切换，保留现有条件渲染并增加了结构回归保护。

## Browser verification

- 打开本地应用并完成登录态恢复。
- 从“今日”切换到“我的”。
- 滚动到“近期训练”并检查 4 条真实记录。
- 临时构造两行长名称并在验收后恢复原始记录。
- 检查 `390×844`、`375×812` 和桌面宽屏。
- 检查 `0 kg`、绿橙蓝循环、第二层弱化色和时间线末端。
- Console errors / warnings：无。

## Implementation checklist

- [x] 三列两层结构
- [x] 长名称共享行高
- [x] 容量固定展示
- [x] 绿橙蓝第一层循环
- [x] 第二层默认弱化色
- [x] 当前时间线样式
- [x] 末条记录停止连接线
- [x] 删除重复 footer
- [x] 移动端与桌面无模块溢出

final result: passed

---

# “近期训练”游标分页与轨迹续接 QA

日期：2026-07-28

## 数据与接口

- 使用隔离本地 QA 账号创建 27 条已完成训练，其中包含相同 `started_at`、`0 kg`、不足 1 分钟和两行长名称。
- 仪表盘真实返回 6 条，第一次加载返回 20 条，第二次加载返回 1 条。
- 三批记录合计 27 个唯一 ID，没有重复或遗漏。
- 仪表盘的累计训练和训练频率合计仍为 27，没有被近期列表的 6 条首屏限制截断。
- 非法游标真实返回 `400`。
- 查询计划命中 `workout_sessions_user_started_idx` 和 `workout_sets_session_idx`。
- 验收完成后已删除 QA 用户、认证会话、27 条训练、52 条训练组和默认计划；各表残留数量均为 0。

## 固定窗口与滚动

- `390×844` 初始 6 条时，`.timeline-viewport` 的 `clientHeight` 和渲染高度均为 `440px`。
- 第一次追加 20 条后，高度仍为 `440px`，`scrollHeight` 增长到 `1761px`，只在模块内部纵向滚动。
- 加载前后力量趋势在页面文档中的顶部坐标均为 `1201.5px`，没有被新增记录向下推。
- 第一次追加后滚动锚点只从原末端推进约 `32px`，没有跳到新增列表底部。
- `375×812` 下模块宽度为 `327px`，`clientWidth` 与 `scrollWidth` 相等；页面宽度也保持 `375px`。
- 桌面宽屏下近期训练和力量趋势顶部对齐，近期训练模块自身没有横向溢出。

## 三列与长名称

- `390×844` 下普通记录高度约为 `65.64px`。
- 两行长名称记录高度约为 `86.30px`，名称实际高度为 `42.5px`。
- 长名称与容量数字顶部坐标一致。
- 中间组数／时长与右侧“训练容量”底部坐标一致。
- `0 kg`、不足 1 分钟和绿／橙／蓝跨批次循环均按既定规则展示。

## 状态与动画

- 请求成功后一次追加 20 条，并显示“已载入 20 条更早记录”。
- 追加后仅本批前 8 条参与位移、透明度和模糊错峰动画。
- 最后一页追加 1 条后显示“已经追溯到最早一次训练”，加载按钮消失。
- 真实断网时，现有 6 条保持不变，入口切换为“加载失败，点击重试”，辅助播报为“加载失败，请检查网络后重试”。
- 加载失败不改变已有记录和游标；代码通过请求中 ref 阻止同一游标的并发点击。
- `prefers-reduced-motion` 通过组件 `useReducedMotion()` 和模块局部 CSS 同时降级：关闭位移、模糊、错峰、能量点移动与平滑推进，状态文字保留。

## 可访问性与控制台

- 滚动区使用 `role="region"` 和“近期训练记录”可访问名称。
- 加载中按钮使用 `disabled` 和 `aria-busy="true"`。
- 成功、失败和终点通过独立 `aria-live="polite"` 播报。
- 失败状态保留真正的按钮，可以键盘聚焦和重试。
- 浏览器控制台错误和警告：0。

final result: passed
