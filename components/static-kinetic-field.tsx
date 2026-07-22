import type { KineticMode } from "@/lib/visual/kinetic-scene";

export function StaticKineticField({ mode }: { mode: KineticMode }) {
  const modeOffset = { boot: 0, today: 0, plan: 46, ranking: 92, profile: 138, workout: 184, rest: 230 }[mode];
  return (
    <svg className="static-kinetic-field" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="kinetic-field-vignette" cx="50%" cy="46%" r="72%">
          <stop offset="0" stopColor="#17231b" stopOpacity=".58" />
          <stop offset="1" stopColor="#080b09" stopOpacity=".96" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#kinetic-field-vignette)" />
      <g transform={`translate(0 ${modeOffset % 88})`} fill="none" strokeLinecap="round">
        <path className="static-field-track is-back" d="M-80 312C172 130 384 520 636 306s442-130 914 40" />
        <path className="static-field-track is-live" d="M-80 312C172 130 384 520 636 306s442-130 914 40" pathLength="100" />
        <path className="static-field-track is-ghost" d="M-100 610c300-228 486 32 702-84s476-54 944-208" />
        <circle className="static-field-core" cx="636" cy="306" r="92" />
        <circle className="static-field-core is-inner" cx="636" cy="306" r="54" />
        <circle className="static-field-node" cx="636" cy="306" r="5" />
      </g>
    </svg>
  );
}
