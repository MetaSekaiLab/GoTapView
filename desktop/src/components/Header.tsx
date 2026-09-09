import { Session } from "../types";
import { Button } from "./primitives";
import { useTheme, ThemeMode } from "../theme/ThemeProvider";

const ICON: Record<ThemeMode, string> = { system: "◐", light: "☀", dark: "☾" };
const LABEL: Record<ThemeMode, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

// Header: a clickable brand (returns to the overview), the session summary, the
// capture controls, and the theme toggle. In Electron the left inset holds the
// window traffic lights, so the bar is padded on the left.
export function Header({
  session,
  counts,
  onOpen,
  onReload,
  onHome,
}: {
  session: Session | null;
  counts: { http: number; udp: number };
  onOpen: () => void;
  onReload: () => void;
  onHome: () => void;
}) {
  const { mode, cycleMode } = useTheme();
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2">
      <button
        onClick={onHome}
        aria-label="Home"
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-surface-alt"
      >
        <span className="h-2.5 w-2.5 rounded-[3px] bg-accent" />
        <span className="text-base font-extrabold tracking-tight text-text">GoTapView</span>
      </button>
      {session && (
        <span className="min-w-0 flex-shrink truncate font-mono text-xs text-dim">
          {session.meta.file} · {counts.http} http · {counts.udp} udp · {session.meta.diarkisKeys} key
          {session.meta.diarkisKeys === 1 ? "" : "s"}
          {session.meta.truncated ? " · truncated" : ""}
        </span>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <Button label="Open capture…" onClick={onOpen} variant="subtle" />
        <Button label="Reload" onClick={onReload} variant="primary" />
        <button
          onClick={cycleMode}
          aria-label={LABEL[mode]}
          title={LABEL[mode]}
          className="rounded-md border border-border bg-surface-alt px-2.5 py-1.5 text-[15px] text-text hover:bg-border"
        >
          {ICON[mode]}
        </button>
      </div>
    </div>
  );
}
