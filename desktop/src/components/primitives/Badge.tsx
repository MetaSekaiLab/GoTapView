import { cssVar, Tone } from "../../theme/ThemeProvider";

// Badge is a small tinted pill: a coloured dot of meaning next to a label.
export function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold"
      style={{ color: cssVar(tone), backgroundColor: cssVar(tone, 0.13), borderColor: cssVar(tone, 0.33) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cssVar(tone) }} />
      {label}
    </span>
  );
}
