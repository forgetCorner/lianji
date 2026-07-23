"use client";

import { Check, Scan } from "lucide-react";
import type { CSSProperties } from "react";
import { buildWorkoutSetProgress } from "@/lib/workout-set-progress";

type Props = {
  minSets: number;
  maxSets: number;
  completedSets: number;
};

export function WorkoutSetProgress({ minSets, maxSets, completedSets }: Props) {
  const model = buildWorkoutSetProgress({ minSets, maxSets, completedSets });
  const progressStyle = {
    "--set-count": model.nodes.length,
    "--required-count": model.minSets,
  } as CSSProperties;
  const dense = model.maxSets >= 5;

  return (
    <section
      className={`workout-set-progress is-${model.mode}${dense ? " is-dense" : ""}`}
      aria-label={model.ariaLabel}
      style={progressStyle}
    >
      <div className="set-progress-header">
        <strong>组数进度</strong>
        <span className="set-progress-count">
          已完成 <b>{model.completedSets}</b><i>/</i><em>{model.maxSets}</em> 组
        </span>
      </div>

      <div className="set-progress-sequence" aria-hidden="true">
        {model.nodes.map((node) => (
          <span
            key={node.setNumber}
            className={[
              "set-progress-node",
              node.zone,
              node.state,
              node.startsOptionalZone ? "starts-optional-zone" : "",
            ].filter(Boolean).join(" ")}
          >
            <span className="set-progress-number">
              {String(node.setNumber).padStart(2, "0").split("").map((digit, digitIndex) => (
                <span className={`set-progress-digit${digitIndex === 1 ? " is-last" : ""}`} key={`${node.setNumber}-${digitIndex}`}>{digit}</span>
              ))}
              {node.state === "done" && (
                <span className="set-progress-check">
                  <Check className="set-progress-check-cutout" />
                  <Check className="set-progress-check-mark" />
                </span>
              )}
              {node.state === "current" && <Scan preserveAspectRatio="none" />}
            </span>
            {(!dense || node.state === "current") && (
              <small>
                {node.state === "done" ? "完成" : node.state === "current" ? node.zone === "optional" ? "加练中" : "进行中" : "待开始"}
              </small>
            )}
          </span>
        ))}
      </div>

      <div className="set-progress-zones" aria-hidden="true">
        <span className={`set-progress-required${model.reachedMinimum ? " is-reached" : ""}`} style={{ gridColumn: `1 / span ${model.minSets}` }}>
          <i />
          <b>{model.reachedMinimum ? "最低目标已达" : `最低目标 ${model.minSets} 组`}</b>
        </span>
      </div>
    </section>
  );
}
