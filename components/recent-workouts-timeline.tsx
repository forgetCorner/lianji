"use client";

import { History } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { weekdays } from "@/lib/training";
import {
  INITIAL_WORKOUT_HISTORY_LIMIT,
  WORKOUT_HISTORY_PAGE_SIZE,
  mergeWorkoutHistoryRecords,
  normalizeWorkoutHistoryPageResponse,
  type WorkoutHistoryPageInfo,
  type WorkoutSummary,
} from "@/lib/workout-history";

type HistoryLoadState = "idle" | "loading" | "success" | "error" | "exhausted";

type RecentWorkoutsTimelineProps = {
  initialRecords: WorkoutSummary[];
  initialPageInfo: WorkoutHistoryPageInfo;
  snapshotKey: number;
};

function formatDuration(seconds: number): string {
  if (!seconds) return "不足 1 分钟";
  return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function requestWorkoutHistory(cursor: string) {
  const search = new URLSearchParams({
    limit: String(WORKOUT_HISTORY_PAGE_SIZE),
    cursor,
  });
  let response: Response;
  try {
    response = await fetch(`/api/workouts/history?${search.toString()}`);
  } catch {
    throw new Error("加载失败，请检查网络后重试");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: unknown } }).error?.message
        : null;
    throw new Error(
      typeof message === "string" ? message : "加载失败，请稍后重试",
    );
  }
  return normalizeWorkoutHistoryPageResponse(payload);
}

export function RecentWorkoutsTimeline({
  initialRecords,
  initialPageInfo,
  snapshotKey,
}: RecentWorkoutsTimelineProps) {
  const reduceMotion = useReducedMotion();
  const [records, setRecords] = useState(initialRecords);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [loadState, setLoadState] = useState<HistoryLoadState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [newRecordIds, setNewRecordIds] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const requestGenerationRef = useRef(0);
  const snapshotKeyRef = useRef(snapshotKey);
  const requestInFlightRef = useRef(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollRef = useRef<{ top: number; nudge: boolean } | null>(null);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    const viewport = viewportRef.current;
    if (!pending || !viewport) return;
    pendingScrollRef.current = null;
    viewport.scrollTop = pending.top;
    if (!pending.nudge || reduceMotion) return;
    const nudge = Math.min(
      32,
      Math.max(0, viewport.scrollHeight - viewport.clientHeight - pending.top),
    );
    if (!nudge) return;
    requestAnimationFrame(() =>
      viewport.scrollTo({ top: pending.top + nudge, behavior: "smooth" }),
    );
  }, [records.length, reduceMotion]);

  const loadMoreHistory = useCallback(async () => {
    if (
      requestInFlightRef.current ||
      loadState === "loading" ||
      !pageInfo.hasMore ||
      !pageInfo.nextCursor
    )
      return;
    requestInFlightRef.current = true;
    const requestGeneration = requestGenerationRef.current;
    const requestSnapshot = snapshotKey;
    const cursor = pageInfo.nextCursor;
    setLoadState("loading");
    setStatusMessage("正在追溯更早记录");

    try {
      const nextPage = await requestWorkoutHistory(cursor);
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestSnapshot !== snapshotKeyRef.current
      )
        return;

      const merged = mergeWorkoutHistoryRecords(records, nextPage.records);
      if (nextPage.hasMore && merged.addedRecords.length === 0) {
        throw new Error("没有读到新的训练记录，请重试");
      }

      const viewport = viewportRef.current;
      pendingScrollRef.current = viewport
        ? { top: viewport.scrollTop, nudge: merged.addedRecords.length > 0 }
        : null;
      setNewRecordIds(
        merged.addedRecords.slice(0, 8).map((record) => record.id),
      );
      setRecords(merged.records);
      setPageInfo({
        hasMore: nextPage.hasMore,
        nextCursor: nextPage.nextCursor,
      });

      if (!nextPage.hasMore) {
        setLoadState("exhausted");
        setStatusMessage("已经追溯到最早一次训练");
        return;
      }

      setLoadState("success");
      setStatusMessage(`已载入 ${merged.addedRecords.length} 条更早记录`);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setLoadState("idle");
        setStatusMessage("");
        setNewRecordIds([]);
      }, 900);
    } catch (error) {
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestSnapshot !== snapshotKeyRef.current
      )
        return;
      setLoadState("error");
      setStatusMessage(
        error instanceof Error ? error.message : "加载失败，请点击重试",
      );
    } finally {
      requestInFlightRef.current = false;
    }
  }, [loadState, pageInfo.hasMore, pageInfo.nextCursor, records, snapshotKey]);

  if (!records.length) {
    return (
      <section className="timeline recent-workouts-timeline">
        <div className="section-heading">
          <h2>近期训练</h2>
          <span>已完成记录</span>
        </div>
        <div className="data-empty">
          <History size={26} />
          <strong>还没有已完成的训练</strong>
          <p>完成一次训练后，这里会形成你的训练时间线。</p>
        </div>
      </section>
    );
  }

  const hasLoadControl =
    pageInfo.hasMore ||
    loadState === "loading" ||
    loadState === "success" ||
    loadState === "error";
  const usesScrollViewport =
    records.length > INITIAL_WORKOUT_HISTORY_LIMIT || hasLoadControl;

  return (
    <section className="timeline recent-workouts-timeline">
      <div className="section-heading">
        <h2>近期训练</h2>
        <span>已完成记录</span>
      </div>
      <div
        ref={viewportRef}
        className={`timeline-viewport${usesScrollViewport ? " is-scrollable" : ""}`}
        role="region"
        aria-label="近期训练记录"
        tabIndex={0}
      >
        {records.map((session, index) => {
          const date = new Date(session.started_at);
          const dateLabel = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
          const weekdayLabel =
            weekdays.find((weekday) => weekday.value === (date.getDay() || 7))
              ?.label ?? "周日";
          const newRecordIndex = newRecordIds.indexOf(session.id);
          const animateRecord = newRecordIndex >= 0 && !reduceMotion;
          const firstNewRecord = newRecordIndex === 0;
          return (
            <motion.div
              className={`session ${["lime", "orange", "blue"][index % 3]}`}
              data-session-id={session.id}
              key={session.id}
              initial={
                animateRecord
                  ? { opacity: 0, y: 10, filter: "blur(3px)" }
                  : false
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: animateRecord ? 0.24 : 0,
                delay: animateRecord ? newRecordIndex * 0.024 : 0,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {firstNewRecord && (
                <motion.span
                  className="history-join-segment"
                  aria-hidden="true"
                  initial={reduceMotion ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.22,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              )}
              <i aria-hidden="true" />
              <time className="session-date" dateTime={toDateKey(date)}>
                <strong>{dateLabel}</strong>
                <small>{weekdayLabel}</small>
              </time>
              <h3 className="session-name">{session.plan_name}</h3>
              <strong className="session-volume">
                {formatNumber(session.volume_kg)} <small>kg</small>
              </strong>
              <p className="session-meta">
                {session.set_count} 组 ·{" "}
                {formatDuration(session.duration_seconds)}
              </p>
              <span className="session-volume-label">训练容量</span>
            </motion.div>
          );
        })}

        <AnimatePresence initial={false} mode="wait">
          {hasLoadControl && (
            <motion.div
              className={`history-load-control is-${loadState}`}
              key={loadState}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              {loadState === "loading" ? (
                <button
                  type="button"
                  className="history-load-button"
                  disabled
                  aria-busy="true"
                >
                  <span className="history-loader-rail" aria-hidden="true">
                    <i />
                  </span>
                  <span>正在追溯更早记录…</span>
                </button>
              ) : loadState === "success" ? (
                <div className="history-status-copy" role="status">
                  {statusMessage || "已载入更早记录"}
                </div>
              ) : (
                <motion.button
                  type="button"
                  className={`history-load-button${loadState === "error" ? " is-error" : ""}`}
                  onClick={loadMoreHistory}
                  aria-busy="false"
                  whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.12, ease: [0.25, 1, 0.5, 1] }}
                >
                  <span className="history-load-node" aria-hidden="true" />
                  <span>
                    {loadState === "error"
                      ? "加载失败，点击重试"
                      : "加载更早记录"}
                  </span>
                </motion.button>
              )}
            </motion.div>
          )}
          {loadState === "exhausted" && (
            <motion.div
              className="history-end-state"
              key="history-end"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.16 }}
            >
              <motion.i
                aria-hidden="true"
                initial={
                  reduceMotion
                    ? false
                    : { scale: 0.72, filter: "brightness(1.8)" }
                }
                animate={{ scale: 1, filter: "brightness(1)" }}
                transition={{
                  duration: reduceMotion ? 0 : 0.16,
                  ease: [0.25, 1, 0.5, 1],
                }}
              />
              <span>已经追溯到最早一次训练</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span
        className="history-live-status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusMessage}
      </span>
    </section>
  );
}
