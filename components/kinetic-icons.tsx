type KineticIconKind = "today" | "plan" | "ranking" | "profile" | "streak" | "friends" | "save" | "start" | "recovery";

type KineticIconProps = {
  kind: KineticIconKind;
  active?: boolean;
  size?: number;
  className?: string;
};

const paths: Record<KineticIconKind, React.ReactNode> = {
  today: <><path d="M4 9h3m10 0h3M7 6v6m10-6v6M7 9h3l2-3 2 6 3-3" /><path className="kinetic-icon-live" d="M10 17h4" /></>,
  plan: <><path d="M5 6v13m4-10v7m5-9v11m5-8v6" /><path className="kinetic-icon-live" d="M4 19h16M5 5h14" /></>,
  ranking: <><path d="M5 18V9l4 4 4-8 6 4v9" /><path className="kinetic-icon-live" d="M4 18h16" /></>,
  profile: <><circle cx="12" cy="9" r="3" /><path d="M5 19c1-4 3.2-6 7-6s6 2 7 6" /><path className="kinetic-icon-live" d="M3 12h3m12 0h3" /></>,
  streak: <><path d="M12 3c1 4-2 5-2 8 0 2 1 3 2 4 2-2 3-4 2-7 3 2 5 5 4 8-1 3-3 5-6 5s-6-2-6-6c0-3 2-6 6-12Z" /><path className="kinetic-icon-live" d="M9 18h6" /></>,
  friends: <><path d="M4 17c1-3 2.5-4.5 5-4.5S13 14 14 17M7 8a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" /><path className="kinetic-icon-live" d="M14 7h6m-3-3 3 3-3 3" /></>,
  save: <><path d="M5 4h11l3 3v13H5Z" /><path d="M8 4v6h7V4M8 20v-6h8v6" /><path className="kinetic-icon-live" d="m10 17 2 2 4-5" /></>,
  start: <><path d="M5 5v14l13-7Z" /><path className="kinetic-icon-live" d="M3 12h7" /></>,
  recovery: <><path d="M19 8a8 8 0 1 0 1 8" /><path className="kinetic-icon-live" d="M19 4v4h-4M7 13h3l2-3 2 5 3-3" /></>,
};

export function KineticIcon({ kind, active = false, size = 24, className = "" }: KineticIconProps) {
  return (
    <svg className={`kinetic-icon ${active ? "is-active" : ""} ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths[kind]}
      <circle className="kinetic-icon-node" cx="20" cy="7" r="1.45" />
    </svg>
  );
}
