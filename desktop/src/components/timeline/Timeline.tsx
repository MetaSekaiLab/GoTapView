import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TapEvent } from "../../types";
import { Section as GroupSection, GroupMode } from "../../model/group";
import { TimelineRow, ROW_HEIGHT } from "./TimelineRow";

export interface Viewport {
  offsetRatio: number;
  visibleRatio: number;
}
export interface TimelineHandle {
  scrollToDisplayIndex: (i: number) => void;
}

const HEADER_H = 44;

type Item =
  | { kind: "header"; section: GroupSection }
  | { kind: "row"; e: TapEvent; display: number };

interface Props {
  sections: GroupSection[];
  groupMode: GroupMode;
  t0: number;
  selected: TapEvent | null;
  query: string;
  onSelect: (e: TapEvent) => void;
  onViewport: (v: Viewport) => void;
}

export const Timeline = forwardRef<TimelineHandle, Props>(function Timeline(
  { sections, groupMode, t0, selected, query, onSelect, onViewport },
  ref,
) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten sections into a virtualizable list of headers + rows. displayToItem
  // maps a row's display index to its position in the item list (for scroll).
  const { items, displayToItem } = useMemo(() => {
    const items: Item[] = [];
    const displayToItem: number[] = [];
    let display = 0;
    for (const sec of sections) {
      if (groupMode !== "none" && sec.title) items.push({ kind: "header", section: sec });
      for (const e of sec.data) {
        displayToItem[display] = items.length;
        items.push({ kind: "row", e, display });
        display++;
      }
    }
    return { items, displayToItem };
  }, [sections, groupMode]);

  const virt = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (items[i].kind === "header" ? HEADER_H : ROW_HEIGHT),
    overscan: 14,
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollToDisplayIndex(i: number) {
        const it = displayToItem[Math.max(0, Math.min(i, displayToItem.length - 1))];
        if (it != null) virt.scrollToIndex(it, { align: "center" });
      },
    }),
    [displayToItem, virt],
  );

  const report = () => {
    const el = parentRef.current;
    if (!el) return;
    const total = Math.max(el.scrollHeight, 1);
    onViewport({ offsetRatio: el.scrollTop / total, visibleRatio: el.clientHeight / total });
  };
  useEffect(report, [items.length]);

  return (
    <div ref={parentRef} onScroll={report} className="min-h-0 flex-1 overflow-auto">
      <div style={{ height: virt.getTotalSize(), position: "relative", width: "100%" }}>
        {virt.getVirtualItems().map((vi) => {
          const item = items[vi.index];
          return (
            <div
              key={vi.key}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: vi.size, transform: `translateY(${vi.start}px)` }}
            >
              {item.kind === "header" ? (
                <SectionHeader section={item.section} />
              ) : (
                <div className="border-b border-border/30">
                  <TimelineRow
                    e={item.e}
                    t0={t0}
                    selected={item.e === selected}
                    query={query}
                    onClick={() => onSelect(item.e)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function SectionHeader({ section }: { section: GroupSection }) {
  return (
    <div className="flex h-full flex-col justify-center border-b border-border bg-surface px-2.5">
      <div className="text-xs font-bold text-text">
        {section.title}
        <span className="ml-2 font-normal text-dim">{section.data.length}</span>
      </div>
      {section.subtitle && <div className="font-mono text-[10.5px] text-dim">{section.subtitle}</div>}
    </div>
  );
}
