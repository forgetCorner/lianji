**Source Visual Truth**

- Path: `/Users/amron/.codex/generated_images/019f7e5a-4686-77b3-b062-2189ac884db3/exec-68dfa44e-ad60-4198-9931-33d81c8e011f.png`
- Pixels: 1457 × 1080
- App content region: approximately 770 CSS-like pixels wide inside the source canvas
- State: 3 组计划，已完成 2 组，第 3 组加练中

**Implementation Evidence**

- Before-fix screenshot: `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-bb9733d3-f341-4795-812e-13bdf9ce44a3.png`
- Pixels: 615 × 315
- App content region: approximately 390 CSS pixels wide
- State: 3 组计划，已完成 2 组，第 3 组加练中
- Revised browser screenshot: unavailable
- Blocker: the local preview account is currently on a recovery day and has no active workout, so the revised active-workout progress component cannot be rendered without changing user training data.
- Browser console: no warnings or errors were captured on the local preview.

**Findings**

- [P1] Number hierarchy was lost
  Location: `.set-progress-number`
  Evidence: the source uses large `01 / 02 / 03` as the visual center; the before-fix implementation rendered the numbers near body-text size.
  Impact: the component reads as a generic status row instead of a set-progress display.
  Fix applied: explicit 68px monospaced numbers for 1–4 groups and 42px compact numbers for 5–6 groups.

- [P1] Current and completed states were too small and visually tangled
  Location: completed check and current scan icon
  Evidence: the before-fix current icon overlapped `03`, while the source uses a clear corner marker around the number and a large integrated completion check.
  Impact: the active set is harder to identify and the icon resembles an accidental glyph.
  Fix applied: replaced the scan-line icon with a corner scan icon, enlarged both state icons, and repositioned them around the number.

- [P2] Vertical rhythm was compressed
  Location: progress header, sequence and target zone
  Evidence: the source reserves a tall visual section with strong separation; the implementation compressed the sequence and labels into a short strip.
  Impact: the component loses the deliberate, premium rhythm of the selected design.
  Fix applied: increased section height, header-to-sequence spacing, node height and label spacing.

- [P2] Extra optional-zone box drifted from the source
  Location: `.set-progress-optional`
  Evidence: the source only brackets the completed minimum target; the implementation drew a second outlined “加练区” block.
  Impact: the extra box adds visual noise and changes the composition.
  Fix applied: removed the second bracket and kept “加练中” directly under the current number.

**Required Fidelity Surfaces**

- Fonts and typography: explicit font family, size, weight, line height and tabular numerals are now declared; revised visual evidence is pending.
- Spacing and layout rhythm: major spacing values were increased to match the source hierarchy; revised visual evidence is pending.
- Colors and tokens: existing lime, orange, text and muted tokens match the source intent.
- Image quality and assets: this component uses UI text and library icons only; there are no raster assets in the compared region.
- Copy and content: header, completion count, completion state, current state and minimum-target copy match the source structure.

**Comparison History**

1. Initial comparison found P1 number hierarchy and state-icon mismatches plus P2 spacing and optional-zone drift.
2. Code fixes were applied to typography, spacing, icons, labels and target-zone structure.
3. User-provided post-fix screenshot `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-f050af51-7a8a-4794-8f65-a7d3b70ce46d.png` showed the enlarged implementation was still too heavy: the wide bold numerals, attached completion marks and scan outline made the three states read like glowing buttons.
4. Second refinement introduced a dedicated condensed numeral font, reduced number weight and scale, detached both status icons, softened connectors and reduced section height.
5. User-provided comparison screenshots `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-1ecbe439-d63b-4e4d-bbf4-1a7a400ef2fb.png` and `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-94856feb-fe59-4541-98b1-27b89aaabeb8.png` exposed remaining proportional drift: the numeral face was too thin and rounded, the sequence was too narrow, the target bracket was too wide, and the current-state corners did not enclose the number.
6. Third refinement switched the numerals to Teko, expanded the sequence beyond the header measure, restored full-size diagonal scan corners, enlarged the completion ticks, inset the target bracket and moved the entire progress composition upward.
7. User clarified with the focused source crop `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-a4084019-8d52-42bf-9c40-0069e3eb827d.png` that completed digits are not intact behind the check: the last digit's lower-right stroke is removed and the check occupies that space.
8. Fourth refinement introduced a condensed face and split each number into two glyph spans. Completed nodes now clip the lower-right of the final glyph before positioning the check, matching the source construction instead of overlaying a detached icon. The final product-wide typography pass later standardized these numerals on Roboto Mono Bold to match the Figma data system.
9. User-provided screenshot `/var/folders/32/pfl8bvks6m5cx2mypct0n06r0000gn/T/codex-clipboard-650b273d-6441-4a2e-853f-7da044c02b1f.png` showed that the polygon clip produced a visible rectangular notch and that the current-state scan corners overlapped the orange digits.
10. Fifth refinement removed the polygon clip. The completed state now uses two instances of the same check icon: a thick background-colored check erases the digit along the exact check path, and a thinner lime check renders above it. The current scan frame was enlarged and moved outward so its corners clear the digits.
11. A browser-rendered post-refinement capture is still unavailable because the local account has no active workout.

**Implementation Checklist**

- Render an active 3-group workout at the same state.
- Capture the revised component at a 390px mobile content width.
- Compare number scale, icon placement, bracket width and vertical rhythm against the source.

**Follow-up Polish**

- If the 5–6 group compact state feels too dense in real data, adjust only the dense font size and connector length without changing the 1–4 group design.

final result: blocked
