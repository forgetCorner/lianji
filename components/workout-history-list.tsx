"use client";

import { motion, useReducedMotion } from "motion/react";
import { weekdays } from "@/lib/training";
import type { WorkoutSummary } from "@/lib/workout-history";

type WorkoutHistoryListProps = {
  records: WorkoutSummary[];
  connecting?: boolean;
  newRecordIds?: string[];
};

function formatDuration(seconds: number): string {
  if (!seconds) return "不足 1 分钟";
  return `${Math.max(1, Math.round(seconds / 60))} 分钟`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function WorkoutHistoryList({
  records,
  connecting = false,
  newRecordIds = [],
}: WorkoutHistoryListProps) {
  const reduceMotion = useReducedMotion();

  return records.map((session, index) => {
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
        className={`session ${["lime", "orange", "blue"][index % 3]}${connecting && animateRecord ? " is-entering" : ""}${connecting && firstNewRecord ? " is-first-new" : ""}`}
        data-session-id={session.id}
        data-new-record-index={
          newRecordIndex >= 0 ? newRecordIndex : undefined
        }
        key={session.id}
        initial={
          animateRecord
            ? { opacity: 0.35, y: 6, filter: "blur(2px)" }
            : false
        }
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{
          duration: animateRecord ? 0.2 : 0,
          delay: animateRecord ? newRecordIndex * 0.032 : 0,
          ease: [0.16, 1, 0.3, 1],
        }}
      >
        {firstNewRecord && connecting && (
          <motion.span
            className="history-join-segment"
            aria-hidden="true"
            initial={reduceMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{
              duration: reduceMotion ? 0 : 0.2,
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
          {session.set_count} 组 · {formatDuration(session.duration_seconds)}
        </p>
        <span className="session-volume-label">训练容量</span>
      </motion.div>
    );
  });
}
