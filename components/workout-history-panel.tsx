"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { WorkoutHistoryList } from "@/components/workout-history-list";
import {
  INITIAL_WORKOUT_HISTORY_LIMIT,
  WORKOUT_HISTORY_PAGE_SIZE,
  mergeWorkoutHistoryRecords,
  normalizeWorkoutHistoryPageResponse,
  type WorkoutHistoryPageInfo,
  type WorkoutSummary,
} from "@/lib/workout-history";

type HistoryLoadState =
  "idle" | "loading" | "connecting" | "error" | "exhausted";

type MinimumFeedback = {
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
};

type WorkoutHistoryPanelProps = {
  open: boolean;
  initialRecords: WorkoutSummary[];
  initialPageInfo: WorkoutHistoryPageInfo;
  snapshotKey: number;
  onRequestClose: () => void;
  onExited: () => void;
};

const MIN_LOADING_FEEDBACK_MS = 1360;
const CONNECTING_FEEDBACK_MS = 360;
const AUTO_LOAD_THRESHOLD_PX = 48;

async function requestWorkoutHistory(cursor: string | null) {
  const search = new URLSearchParams({
    limit: String(WORKOUT_HISTORY_PAGE_SIZE),
  });
  if (cursor) search.set("cursor", cursor);
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

export function WorkoutHistoryPanel({
  open,
  initialRecords,
  initialPageInfo,
  snapshotKey,
  onRequestClose,
  onExited,
}: WorkoutHistoryPanelProps) {
  const reduceMotion = useReducedMotion();
  const shouldRefreshInitialPage =
    initialRecords.length < INITIAL_WORKOUT_HISTORY_LIMIT &&
    initialPageInfo.hasMore;
  const [records, setRecords] = useState(
    shouldRefreshInitialPage ? [] : initialRecords,
  );
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [loadState, setLoadState] = useState<HistoryLoadState>(
    shouldRefreshInitialPage ? "loading" : "idle",
  );
  const [statusMessage, setStatusMessage] = useState(
    shouldRefreshInitialPage ? "正在读取最近的训练记录…" : "",
  );
  const [needsInitialPage, setNeedsInitialPage] = useState(
    shouldRefreshInitialPage,
  );
  const [newRecordIds, setNewRecordIds] = useState<string[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const requestGenerationRef = useRef(0);
  const snapshotKeyRef = useRef(snapshotKey);
  const requestInFlightRef = useRef(false);
  const initialRequestInFlightRef = useRef(false);
  const minimumFeedbackRef = useRef<MinimumFeedback | null>(null);
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMotionTimers = useCallback(() => {
    const minimumFeedback = minimumFeedbackRef.current;
    if (minimumFeedback) {
      clearTimeout(minimumFeedback.timer);
      minimumFeedbackRef.current = null;
      minimumFeedback.resolve();
    }
    if (connectingTimerRef.current) {
      clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
  }, []);

  const waitForMinimumFeedback = useCallback(() => {
    if (reduceMotion) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (minimumFeedbackRef.current?.timer === timer) {
          minimumFeedbackRef.current = null;
        }
        resolve();
      }, MIN_LOADING_FEEDBACK_MS);
      minimumFeedbackRef.current = { timer, resolve };
    });
  }, [reduceMotion]);

  useEffect(
    () => () => {
      requestGenerationRef.current += 1;
      requestInFlightRef.current = false;
      clearMotionTimers();
    },
    [clearMotionTimers],
  );

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      closeButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onRequestClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onRequestClose, open]);

  const loadInitialHistory = useCallback(async () => {
    if (initialRequestInFlightRef.current) return;
    initialRequestInFlightRef.current = true;
    const requestGeneration = requestGenerationRef.current;
    const requestSnapshot = snapshotKey;
    setLoadState("loading");
    setStatusMessage("正在读取最近的训练记录…");

    try {
      const firstPage = await requestWorkoutHistory(null);
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestSnapshot !== snapshotKeyRef.current
      ) {
        return;
      }
      setRecords(firstPage.records);
      setPageInfo({
        hasMore: firstPage.hasMore,
        nextCursor: firstPage.nextCursor,
      });
      setNeedsInitialPage(false);
      setLoadState(firstPage.hasMore ? "idle" : "exhausted");
      setStatusMessage(
        firstPage.hasMore ? "" : "已经追溯到最早一次训练",
      );
    } catch {
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestSnapshot !== snapshotKeyRef.current
      ) {
        return;
      }
      setRecords(initialRecords);
      setPageInfo(initialPageInfo);
      setLoadState("error");
      setStatusMessage("读取训练历史失败，请点击重试");
    } finally {
      initialRequestInFlightRef.current = false;
    }
  }, [initialPageInfo, initialRecords, snapshotKey]);

  useEffect(() => {
    if (!open || !needsInitialPage) return;
    const frame = requestAnimationFrame(() => {
      void loadInitialHistory();
    });
    return () => cancelAnimationFrame(frame);
  }, [loadInitialHistory, needsInitialPage, open]);

  const loadMoreHistory = useCallback(async () => {
    if (
      needsInitialPage ||
      requestInFlightRef.current ||
      loadState === "loading" ||
      loadState === "connecting" ||
      !pageInfo.hasMore ||
      !pageInfo.nextCursor
    ) {
      return;
    }

    clearMotionTimers();
    requestInFlightRef.current = true;
    const requestGeneration = requestGenerationRef.current;
    const requestSnapshot = snapshotKey;
    const cursor = pageInfo.nextCursor;
    setNewRecordIds([]);
    setLoadState("loading");
    setStatusMessage("正在追溯更早的训练记录…");

    try {
      const [nextPage] = await Promise.all([
        requestWorkoutHistory(cursor),
        waitForMinimumFeedback(),
      ]);
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestSnapshot !== snapshotKeyRef.current
      ) {
        return;
      }

      const merged = mergeWorkoutHistoryRecords(records, nextPage.records);
      if (nextPage.hasMore && merged.addedRecords.length === 0) {
        throw new Error("没有读到新的训练记录，请重试");
      }

      const addedRecords = merged.addedRecords.slice(
        0,
        WORKOUT_HISTORY_PAGE_SIZE,
      );
      setNewRecordIds(addedRecords.map((record) => record.id));
      setRecords(merged.records);
      setPageInfo({
        hasMore: nextPage.hasMore,
        nextCursor: nextPage.nextCursor,
      });

      if (!addedRecords.length) {
        setLoadState("exhausted");
        setStatusMessage("已经追溯到最早一次训练");
        return;
      }

      setLoadState("connecting");
      setStatusMessage("正在接入训练记录…");

      const finishConnection = () => {
        if (
          requestGeneration !== requestGenerationRef.current ||
          requestSnapshot !== snapshotKeyRef.current
        ) {
          return;
        }
        connectingTimerRef.current = null;
        setNewRecordIds([]);
        if (nextPage.hasMore) {
          setLoadState("idle");
          setStatusMessage("");
        } else {
          setLoadState("exhausted");
          setStatusMessage("已经追溯到最早一次训练");
        }
      };

      connectingTimerRef.current = setTimeout(
        finishConnection,
        reduceMotion ? 0 : CONNECTING_FEEDBACK_MS,
      );
    } catch (error) {
      if (
        requestGeneration !== requestGenerationRef.current ||
        requestSnapshot !== snapshotKeyRef.current
      ) {
        return;
      }
      clearMotionTimers();
      setLoadState("error");
      setNewRecordIds([]);
      setStatusMessage("加载失败，请点击重试");
      if (error instanceof Error && error.message.includes("没有读到")) {
        setStatusMessage(error.message);
      }
    } finally {
      requestInFlightRef.current = false;
    }
  }, [
    clearMotionTimers,
    loadState,
    pageInfo.hasMore,
    pageInfo.nextCursor,
    records,
    reduceMotion,
    snapshotKey,
    needsInitialPage,
    waitForMinimumFeedback,
  ]);

  const handleBodyScroll = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const distanceFromBottom =
      body.scrollHeight - body.scrollTop - body.clientHeight;
    if (distanceFromBottom <= AUTO_LOAD_THRESHOLD_PX) {
      void loadMoreHistory();
    }
  }, [loadMoreHistory]);

  useEffect(() => {
    if (
      !open ||
      needsInitialPage ||
      loadState !== "idle" ||
      !pageInfo.hasMore
    ) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (
        body &&
        body.scrollHeight - body.clientHeight <= AUTO_LOAD_THRESHOLD_PX
      ) {
        void loadMoreHistory();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    loadMoreHistory,
    loadState,
    needsInitialPage,
    open,
    pageInfo.hasMore,
    records.length,
  ]);

  const isBusy = loadState === "loading" || loadState === "connecting";
  const showEndState = !pageInfo.hasMore && loadState === "exhausted";

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onRequestClose();
  };

  return (
    <AnimatePresence initial={false} onExitComplete={onExited}>
      {open && (
        <motion.div
          className="workout-history-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reduceMotion ? 0.1 : 0.18,
            ease: [0.16, 1, 0.3, 1],
          }}
          onClick={handleBackdropClick}
        >
          <motion.section
            className="workout-history-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workout-history-panel-title"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{
              duration: reduceMotion ? 0.1 : 0.22,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <header className="workout-history-panel-header">
              <div className="workout-history-panel-header-inner">
                <h2 id="workout-history-panel-title">训练历史</h2>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="workout-history-panel-close"
                  onClick={onRequestClose}
                  aria-label="关闭训练历史"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </header>
            <div
              ref={bodyRef}
              className="workout-history-panel-body"
              role="region"
              aria-label="全部训练历史记录"
              tabIndex={0}
              onScroll={handleBodyScroll}
            >
              <div className="workout-history-panel-content timeline">
                <WorkoutHistoryList
                  records={records}
                  connecting={loadState === "connecting"}
                  newRecordIds={newRecordIds}
                />
                <AnimatePresence initial={false}>
                  {isBusy && (
                    <motion.div
                      className={`history-auto-load is-${loadState}`}
                      key="history-auto-load"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduceMotion ? undefined : { opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.16 }}
                      aria-hidden="true"
                    >
                      <span className="history-energy-track">
                        <i className="history-energy-point" />
                      </span>
                      <span className="history-loading-copy">
                        {statusMessage}
                      </span>
                    </motion.div>
                  )}
                  {loadState === "error" && (
                    <motion.div
                      className="history-auto-load is-error"
                      key="history-auto-error"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reduceMotion ? undefined : { opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.16 }}
                    >
                      <button
                        type="button"
                        className="history-auto-retry"
                        onClick={() =>
                          void (needsInitialPage
                            ? loadInitialHistory()
                            : loadMoreHistory())
                        }
                      >
                        <span
                          className="history-load-node"
                          aria-hidden="true"
                        />
                        加载失败，点击重试
                      </button>
                    </motion.div>
                  )}
                  {showEndState && (
                    <motion.div
                      className="history-end-state is-complete"
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
            </div>
            <span
              className="history-live-status"
              aria-live="polite"
              aria-atomic="true"
            >
              {statusMessage}
            </span>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
