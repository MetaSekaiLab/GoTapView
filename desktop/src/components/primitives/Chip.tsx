import { cssVar, Tone } from "../../theme/ThemeProvider";

// Chip is a compact label used for cmd/msgType tags and as an interactive
// toggle in the toolbar facet selectors.
export function Chip({
  label,
  tone,
  count,
  active,
  onClick,
}: {
  label: string;
  tone?: Tone;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const activeStyle =
    active && tone
      ? { color: cssVar(tone), backgroundColor: cssVar(tone, 0.15), borderColor: cssVar(tone, 0.53) }
      : undefined;
  const cls = [
    "inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] font-mono text-[11.5px] font-semibold transition-colors",
    active
      ? tone
        ? ""
        : "border-accent/60 bg-accent/15 text-accent"
      : "border-border text-text hover:bg-surface-alt",
  ].join(" ");
  const inner = (
    <>
      {label}
      {count !== undefined && <span className="text-[10.5px] text-dim">{count}</span>}
    </>
  );
  if (!onClick) {
    return (
      <span className={cls} style={activeStyle}>
        {inner}
      </span>
    );
  }
  return (
    <button className={cls} style={activeStyle} onClick={onClick}>
      {inner}
    </button>
  );
}
