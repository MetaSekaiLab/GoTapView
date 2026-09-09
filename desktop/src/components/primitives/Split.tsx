import { ReactNode, useCallback, useRef, useState } from "react";

// Split lays two panes side by side with a draggable divider whose ratio (left
// fraction) persists. Real DOM pointer events make this trivial compared with
// the React Native version.
const KEY = "gtv.split.ratio";

export function Split({
  left,
  right,
  minLeft = 320,
  minRight = 360,
}: {
  left: ReactNode;
  right: ReactNode;
  minLeft?: number;
  minRight?: number;
}) {
  const [ratio, setRatio] = useState(() => {
    const v = parseFloat(localStorage.getItem(KEY) ?? "");
    return Number.isFinite(v) ? v : 0.42;
  });
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const move = (ev: PointerEvent) => {
        const el = containerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0) return;
        let x = (ev.clientX - r.left) / r.width;
        x = Math.max(minLeft / r.width, Math.min(1 - minRight / r.width, x));
        setRatio(x);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.userSelect = "";
        try {
          localStorage.setItem(KEY, String(ratioRef.current));
        } catch {
          /* ignore */
        }
      };
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [minLeft, minRight],
  );

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1">
      <div className="flex min-w-0" style={{ flexBasis: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        onPointerDown={onPointerDown}
        className="flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-bg"
      >
        <div className="h-full w-px bg-border" />
      </div>
      <div className="flex min-w-0 flex-1">{right}</div>
    </div>
  );
}
