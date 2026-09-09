import { memo } from "react";
import { TapEvent } from "../../types";
import { Highlight } from "../primitives";
import { summarize } from "../../summary";
import { eventMsgType } from "../../model/facets";
import { cssVar, Tone } from "../../theme/ThemeProvider";

export const ROW_HEIGHT = 30;

export function laneTone(e: TapEvent): Tone {
  if (e.kind === "http") return "http";
  if (e.udp?.data?.frame) return e.udp.dir === "c2s" ? "c2s" : "s2c";
  return "ctrl";
}

function RowImpl({
  e,
  t0,
  selected,
  query,
  onClick,
}: {
  e: TapEvent;
  t0: number;
  selected: boolean;
  query: string;
  onClick: () => void;
}) {
  const tone = laneTone(e);
  const color = cssVar(tone);
  const rel = ((e.wallMs - t0) / 1000).toFixed(3);
  const isHttp = e.kind === "http";
  const arrow = e.udp ? (e.udp.dir === "c2s" ? "→" : "←") : "·";
  const msgType = e.udp ? eventMsgType(e) : null;

  return (
    <button
      onClick={onClick}
      style={{ height: ROW_HEIGHT, backgroundColor: selected ? cssVar(tone, 0.13) : undefined }}
      className="flex w-full items-center pr-2.5 text-left hover:bg-surface-alt"
    >
      <div className="h-full w-[3px]" style={{ backgroundColor: selected ? color : cssVar(tone, 0.53) }} />
      <span className="w-[60px] pr-1 text-right font-mono text-[11px] text-dim">{rel}</span>
      <span className="w-4 text-center text-[13px]" style={{ color }}>
        {arrow}
      </span>
      <span className="w-[38px] font-mono text-[10.5px] font-extrabold" style={{ color }}>
        {isHttp ? "HTTP" : "UDP"}
      </span>
      {msgType && (
        <span className="mr-1.5 rounded bg-accent/15 px-1.5 py-px font-mono text-[10px] text-accent">{msgType}</span>
      )}
      <Highlight text={summarize(e)} query={query} className="flex-1 truncate font-mono text-[12.5px] text-text" />
    </button>
  );
}

// Memoized so scrolling stays cheap; only changed rows re-render.
export const TimelineRow = memo(RowImpl);
