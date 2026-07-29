"use client";

import { History } from "lucide-react";
import type { RefObject } from "react";
import { WorkoutHistoryList } from "@/components/workout-history-list";
import {
  WORKOUT_HISTORY_PREVIEW_SIZE,
  type WorkoutHistoryPageInfo,
  type WorkoutSummary,
} from "@/lib/workout-history";

type RecentWorkoutsTimelineProps = {
  initialRecords: WorkoutSummary[];
  initialPageInfo: WorkoutHistoryPageInfo;
  onOpenHistory: () => void;
  openTriggerRef: RefObject<HTMLButtonElement | null>;
};

export function RecentWorkoutsTimeline({
  initialRecords,
  initialPageInfo,
  onOpenHistory,
  openTriggerRef,
}: RecentWorkoutsTimelineProps) {
  if (!initialRecords.length) {
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

  const previewRecords = initialRecords.slice(0, WORKOUT_HISTORY_PREVIEW_SIZE);
  const hasMoreHistory =
    initialRecords.length > WORKOUT_HISTORY_PREVIEW_SIZE ||
    initialPageInfo.hasMore;

  return (
    <section className="timeline recent-workouts-timeline">
      <div className="section-heading">
        <h2>近期训练</h2>
        <span>已完成记录</span>
      </div>
      <div
        className="timeline-viewport"
        role="region"
        aria-label="近期训练记录"
      >
        <WorkoutHistoryList records={previewRecords} />
        {hasMoreHistory && (
          <div className="history-load-control history-preview-control">
            <button
              ref={openTriggerRef}
              type="button"
              className="history-load-button"
              onClick={onOpenHistory}
              aria-haspopup="dialog"
            >
              <span className="history-load-node" aria-hidden="true" />
              <span>查看全部训练</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
