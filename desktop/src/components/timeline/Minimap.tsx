import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { TapEvent } from "../../types";
import { Viewport } from "./Timeline";
import { laneTone } from "./TimelineRow";
import { cssVar } from "../../theme/ThemeProvider";

// Minimap draws event density over the displayed rows as stacked colour bins
// (HTTP / C→S / S→C / control) with a translucent viewport indicator; clicking
// scrolls the list there. Its vertical axis matches the list's scroll axis.
type Bucket = { http: number; c2s: number; s2c: number; ctrl: number };
const BIN_PX = 4;

export function Minimap({
  displayed,
  viewport,
  onSeek,
}: {
  displayed: TapEvent[];
  viewport: Viewport;
  onSeek: (displayIndex: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const nBins = Math.max(1, Math.floor(h / BIN_PX));
  const bins = useMemo(() => {
    const arr: Bucket[] = Array.from({ length: nBins }, () => ({ http: 0, c2s: 0, s2c: 0, ctrl: 0 }));
    const n = displayed.length;
    if (n === 0) return arr;
    displayed.forEach((e, i) => {
      const b = Math.min(nBins - 1, Math.floor((i / n) * nBins));
      const t = laneTone(e);
      arr[b][t === "http" ? "http" : t === "c2s" ? "c2s" : t === "s2c" ? "s2c" : "ctrl"]++;
    });
    return arr;
  }, [displayed, nBins]);

  const max = useMemo(() => Math.max(1, ...bins.map((b) => b.http + b.c2s + b.s2c + b.ctrl)), [bins]);

  const seek = (ev: React.MouseEvent) => {
    const el = ref.current;
    if (!el || displayed.length === 0) return;
    const y = ev.clientY - el.getBoundingClientRect().top;
    const idx = Math.max(0, Math.min(displayed.length - 1, Math.round((y / el.clientHeight) * displayed.length)));
    onSeek(idx);
  };

  const w = (n: number) => `${(n / max) * 100}%`;
  return (
    <div
      ref={ref}
      onClick={seek}
      className="relative w-[46px] cursor-pointer self-stretch border-l border-border bg-surface"
    >
      {h > 0 &&
        bins.map((b, i) => {
          const total = b.http + b.c2s + b.s2c + b.ctrl;
          return (
            <div key={i} className="flex" style={{ height: BIN_PX, opacity: total ? 1 : 0 }}>
              <div style={{ width: w(b.http), backgroundColor: cssVar("http") }} />
              <div style={{ width: w(b.c2s), backgroundColor: cssVar("c2s") }} />
              <div style={{ width: w(b.s2c), backgroundColor: cssVar("s2c") }} />
              <div style={{ width: w(b.ctrl), backgroundColor: cssVar("ctrl") }} />
            </div>
          );
        })}
      <div
        className="pointer-events-none absolute inset-x-0 border-y"
        style={{
          top: `${Math.max(0, Math.min(1, viewport.offsetRatio)) * 100}%`,
          height: `${Math.max(0.03, Math.min(1, viewport.visibleRatio)) * 100}%`,
          backgroundColor: cssVar("text", 0.13),
          borderColor: cssVar("text", 0.4),
        }}
      />
    </div>
  );
}
