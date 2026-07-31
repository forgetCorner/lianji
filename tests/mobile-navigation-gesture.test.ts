import assert from "node:assert/strict";
import test from "node:test";
import {
  gestureIntent,
  magnetizedX,
  menuIndexWithHysteresis,
  nearestMenuIndex,
} from "../lib/mobile-navigation-gesture.ts";

const centers = [50, 150, 250, 350] as const;

test("最近菜单索引覆盖导航内外边界", () => {
  assert.equal(nearestMenuIndex(centers, -100), 0);
  assert.equal(nearestMenuIndex(centers, 148), 1);
  assert.equal(nearestMenuIndex(centers, 275), 2);
  assert.equal(nearestMenuIndex(centers, 800), 3);
  assert.equal(nearestMenuIndex([], 100), 0);
});

test("横纵手势在阈值内保持等待并在方向明确后锁定意图", () => {
  assert.equal(gestureIntent(4, 3), "pending");
  assert.equal(gestureIntent(18, 5), "horizontal");
  assert.equal(gestureIntent(5, 18), "vertical");
  assert.equal(gestureIntent(12, 11), "pending");
});

test("迟滞区阻止相邻菜单在边界附近抖动", () => {
  assert.equal(menuIndexWithHysteresis(centers, 205, 1, 7), 1);
  assert.equal(menuIndexWithHysteresis(centers, 208, 1, 7), 2);
  assert.equal(menuIndexWithHysteresis(centers, 195, 2, 7), 2);
  assert.equal(menuIndexWithHysteresis(centers, 192, 2, 7), 1);
});

test("快速跨越多个菜单时直接返回最终预览索引", () => {
  assert.equal(menuIndexWithHysteresis(centers, 360, 0, 7), 3);
  assert.equal(menuIndexWithHysteresis(centers, 40, 3, 7), 0);
  assert.equal(menuIndexWithHysteresis(centers, 148, -1, 7), 1);
});

test("磁吸位置同时受触点和目标中心影响并限制在导航内", () => {
  assert.equal(magnetizedX(200, 150, 50, 350, 0.4), 180);
  assert.equal(magnetizedX(-200, 50, 50, 350, 0.4), 50);
  assert.equal(magnetizedX(700, 350, 50, 350, 0.4), 350);
  assert.equal(magnetizedX(200, 150, 50, 350, 2), 150);
});
