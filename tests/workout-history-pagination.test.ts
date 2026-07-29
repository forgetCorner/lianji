import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeWorkoutHistoryRecords,
  normalizeWorkoutHistoryPageResponse,
  type WorkoutSummary,
} from "../lib/workout-history.ts";
import {
  decodeWorkoutHistoryCursor,
  encodeWorkoutHistoryCursor,
  WorkoutHistoryCursorError,
} from "../lib/server/workout-history-cursor.ts";

function workout(
  id: string,
  startedAt: number,
  volumeKg = 120,
): WorkoutSummary {
  return {
    id,
    plan_name: "全身训练",
    started_at: startedAt,
    completed_at: startedAt + 3_600_000,
    duration_seconds: 2_400,
    set_count: 8,
    volume_kg: volumeKg,
  };
}

test("训练历史游标可以稳定往返", () => {
  const cursor = {
    v: 1 as const,
    startedAt: 1_785_200_000_000,
    id: "session-06",
  };
  assert.deepEqual(
    decodeWorkoutHistoryCursor(encodeWorkoutHistoryCursor(cursor)),
    cursor,
  );
});

test("训练历史游标拒绝损坏、错误版本和越界字段", () => {
  assert.throws(
    () => decodeWorkoutHistoryCursor("%%%"),
    WorkoutHistoryCursorError,
  );
  const invalidValues = [
    { v: 2, startedAt: 1_785_200_000_000, id: "session" },
    { v: 1, startedAt: 0, id: "session" },
    { v: 1, startedAt: 1_785_200_000_000, id: "" },
  ];
  for (const value of invalidValues) {
    const encoded = Buffer.from(JSON.stringify(value)).toString("base64url");
    assert.throws(
      () => decodeWorkoutHistoryCursor(encoded),
      WorkoutHistoryCursorError,
    );
  }
});

test("相同开始时间按 ID 倒序后可无重复地跨页", () => {
  const fixtures = Array.from({ length: 27 }, (_, index) =>
    workout(
      `session-${String(index + 1).padStart(2, "0")}`,
      1_785_200_000_000 - Math.floor(index / 2) * 1_000,
    ),
  );
  fixtures.sort(
    (left, right) =>
      right.started_at - left.started_at || right.id.localeCompare(left.id),
  );
  const firstPage = fixtures.slice(0, 6);
  const firstCursor = firstPage.at(-1)!;
  const remaining = fixtures.filter(
    (item) =>
      item.started_at < firstCursor.started_at ||
      (item.started_at === firstCursor.started_at && item.id < firstCursor.id),
  );
  const secondPage = remaining.slice(0, 20);
  const secondCursor = secondPage.at(-1)!;
  const lastPage = remaining.filter(
    (item) =>
      item.started_at < secondCursor.started_at ||
      (item.started_at === secondCursor.started_at &&
        item.id < secondCursor.id),
  );

  assert.equal(firstPage.length, 6);
  assert.equal(secondPage.length, 20);
  assert.equal(lastPage.length, 1);
  assert.equal(
    new Set([...firstPage, ...secondPage, ...lastPage].map((item) => item.id))
      .size,
    27,
  );
});

test("分页响应标准化保留 0 kg 并校验分页状态", () => {
  const record = workout("zero-volume", 1_785_200_000_000, 0);
  const normalized = normalizeWorkoutHistoryPageResponse({
    workouts: [record],
    pageInfo: { hasMore: false, nextCursor: null },
  });
  assert.equal(normalized.records[0].volume_kg, 0);
  assert.throws(
    () =>
      normalizeWorkoutHistoryPageResponse({
        workouts: [],
        pageInfo: { hasMore: true, nextCursor: "cursor" },
      }),
    /无法继续/,
  );
  assert.throws(
    () =>
      normalizeWorkoutHistoryPageResponse({
        workouts: [record],
        pageInfo: { hasMore: false, nextCursor: "cursor" },
      }),
    /末页游标/,
  );
});

test("追加训练记录按 ID 去重且不覆盖现有顺序", () => {
  const current = [workout("a", 300), workout("b", 200)];
  const incoming = [workout("b", 200), workout("c", 100)];
  const merged = mergeWorkoutHistoryRecords(current, incoming);
  assert.deepEqual(
    merged.records.map((record) => record.id),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    merged.addedRecords.map((record) => record.id),
    ["c"],
  );
});
