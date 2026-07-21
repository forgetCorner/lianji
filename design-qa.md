# 练迹 Design QA

## Comparison target

- Source visual truth:
  - `/tmp/lianji-figma-qa/today.png`
  - `/tmp/lianji-figma-qa/workout.png`
  - `/tmp/lianji-figma-qa/rest.png`
  - `/tmp/lianji-figma-qa/desktop-history.png`
- Browser-rendered implementation:
  - `/tmp/lianji-mobile-code-final.png`
  - `/tmp/lianji-workout-code.png`
  - `/tmp/lianji-rest-code.png`
  - `/tmp/lianji-desktop-code-final.png`
- Viewports: mobile 390 × 844; desktop 1440 × 960.
- Theme: dark.
- States: 今日训练、训练中、休息计时、历史与进步。

## Full-view comparison evidence

The source and browser captures were opened together at matching viewports. The implementation preserves the source hierarchy: near-black canvas, lime/orange accent system, oversized training data, thin rails and dividers, annual heatmap, vertical history timeline, e1RM line chart, and proportional-progress leaderboard. The desktop region proportions and information density closely track the Figma frame. The mobile Today view keeps the same content order and fixed primary action.

## Focused-region comparison evidence

No additional crop was required because the 390 × 844 and 1440 × 960 captures render the typography, rails, icons, chart points, labels, and button states legibly at their native sizes. The workout metric region and rest timer were also captured and inspected as separate full states.

## Required fidelity surfaces

- Fonts and typography: Noto Sans SC is used for Chinese UI; Roboto Mono is used for dates, timers, weights, reps, ranks, and chart values. Display headings use 900 weight and the mobile/desktop hierarchy follows the source.
- Spacing and layout rhythm: 24px mobile page margins, 88px desktop navigation rail, thin section dividers, linear exercise rows, and source-like column proportions are preserved. Primary actions remain on-screen at 390 × 844.
- Colors and visual tokens: background `#0d100e`, text `#f4f1ea`, lime `#c0fa4a`, orange `#ff9138`, blue and purple ranking accents map to the source palette with sufficient contrast.
- Image quality and asset fidelity: no photographic assets are present in the source. Icons come from Lucide React, matching the selected Figma icon language. The chart is rendered by Recharts rather than a hand-authored graphic.
- Copy and content: plan names, exercise prescriptions, training duration, previous-set data, e1RM values, ranking method, and friend data match the approved samples.

## Comparison history

### Iteration 1

- Earlier finding: mobile Start Workout action was outside the visible viewport because a transformed page animation changed the fixed-position containing block. Severity P1.
- Fix: removed the transform-based page animation and rechecked the 390 × 844 viewport.
- Post-fix evidence: `/tmp/lianji-mobile-code-final.png` shows the complete primary action above the mobile navigation.

### Iteration 2

- Earlier finding: mobile content density hid the previous-session summary; the Complete Set action was partly below the viewport; the rest state exposed the underlying workout; the desktop chart could be captured mid-animation. Severity P2.
- Fixes: tightened mobile vertical rhythm, fixed Complete Set above the viewport edge, made the rest surface opaque, and disabled chart drawing animation for deterministic rendering.
- Post-fix evidence: final mobile, workout, rest, and desktop captures listed above.

## Findings

No actionable P0, P1, or P2 differences remain.

## Primary interactions tested

- 今日 → 开始训练。
- 训练中 → 完成本组。
- 休息计时 → 提前开始下一组。
- Desktop navigation → 历史与进步。
- Browser console errors checked in a clean tab: none.

## Follow-up polish

- P3: mobile bottom navigation is an intentional functional extension beyond the focused Figma sample and occupies 76px at the bottom.
- P3: production data wiring may replace the seeded heatmap, trend, and ranking values without changing layout.

final result: passed
