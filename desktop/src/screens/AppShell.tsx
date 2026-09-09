import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Session, TapEvent } from "../types";
import { argvPath, decode, openCapture, reload, onMenuOpen, onMenuReload, onOpenExternal, isElectron } from "../lib/ipc";
import { emptyFilter, extractFacets, FilterState, makePredicate } from "../model/facets";
import { GroupMode, groupEvents } from "../model/group";
import { Header } from "../components/Header";
import { Toolbar } from "../components/toolbar/Toolbar";
import { Timeline, TimelineHandle, Viewport } from "../components/timeline/Timeline";
import { Minimap } from "../components/timeline/Minimap";
import { DetailPane } from "../components/detail/DetailPane";
import { Split } from "../components/primitives";

const WIDE_MIN = 760;
const GROUP_KEY = "gtv.group.mode";

export function AppShell() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsCapture, setNeedsCapture] = useState(false);

  const [filter, setFilter] = useState<FilterState>(emptyFilter);
  const [group, setGroupState] = useState<GroupMode>(() => (localStorage.getItem(GROUP_KEY) as GroupMode) || "none");
  const [selected, setSelected] = useState<TapEvent | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ offsetRatio: 0, visibleRatio: 1 });
  const [wide, setWide] = useState(() => window.innerWidth >= WIDE_MIN);
  const listRef = useRef<TimelineHandle>(null);

  useEffect(() => {
    const on = () => setWide(window.innerWidth >= WIDE_MIN);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  const runDecode = useCallback(async (file: string | null) => {
    if (!file) {
      setNeedsCapture(true);
      setSession(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await decode(file);
      setSession(s);
      setNeedsCapture(false);
      setSelected(null);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const open = useCallback(async () => {
    const p = await openCapture();
    if (p) await runDecode(p);
  }, [runDecode]);

  const reloadCapture = useCallback(async () => {
    setLoading(true);
    try {
      const s = await reload();
      if (s) {
        setSession(s);
        setSelected(null);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + native menu / open-with wiring.
  useEffect(() => {
    (async () => runDecode(await argvPath()))();
    const offOpen = onMenuOpen(() => void open());
    const offReload = onMenuReload(() => void reloadCapture());
    const offExt = onOpenExternal((p) => void runDecode(p));
    return () => {
      offOpen();
      offReload();
      offExt();
    };
  }, [runDecode, open, reloadCapture]);

  const setGroup = useCallback((g: GroupMode) => {
    setGroupState(g);
    try {
      localStorage.setItem(GROUP_KEY, g);
    } catch {
      /* ignore */
    }
  }, []);

  const events = session?.events ?? [];
  const counts = useMemo(
    () => ({
      all: events.length,
      http: events.filter((e) => e.kind === "http").length,
      udp: events.filter((e) => e.kind === "udp").length,
    }),
    [events],
  );
  const facets = useMemo(() => extractFacets(events), [events]);
  const filtered = useMemo(() => events.filter(makePredicate(filter)), [events, filter]);
  const sections = useMemo(() => groupEvents(filtered, group, session), [filtered, group, session]);
  const displayed = useMemo(() => sections.flatMap((s) => s.data), [sections]);
  const t0 = session?.meta.startedWall ?? 0;

  const onSelect = useCallback((e: TapEvent) => setSelected(e), []);
  const onHome = useCallback(() => {
    setSelected(null);
    listRef.current?.scrollToDisplayIndex(0);
  }, []);

  // Keyboard: ↑/↓ (k/j) step selection through the displayed order; Esc closes.
  const navRef = useRef({ displayed, selected });
  navRef.current = { displayed, selected };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const { displayed, selected } = navRef.current;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (ev.key === "Escape") {
        if (selected) {
          setSelected(null);
          ev.preventDefault();
        }
        return;
      }
      const down = ev.key === "ArrowDown" || ev.key === "j";
      const up = ev.key === "ArrowUp" || ev.key === "k";
      if ((!down && !up) || displayed.length === 0) return;
      ev.preventDefault();
      const cur = selected ? displayed.findIndex((e) => e.seq === selected.seq) : -1;
      const next = cur < 0 ? (down ? 0 : displayed.length - 1) : down ? Math.min(displayed.length - 1, cur + 1) : Math.max(0, cur - 1);
      setSelected(displayed[next]);
      listRef.current?.scrollToDisplayIndex(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const timeline = (
    <div className="flex min-h-0 flex-1 bg-bg">
      <div className="flex min-w-0 flex-1 flex-col">
        <Timeline
          ref={listRef}
          sections={sections}
          groupMode={group}
          t0={t0}
          selectedSeq={selected?.seq ?? null}
          query={filter.text}
          onSelect={onSelect}
          onViewport={setViewport}
        />
      </div>
      {displayed.length > 0 && (
        <Minimap displayed={displayed} viewport={viewport} onSeek={(i) => listRef.current?.scrollToDisplayIndex(i)} />
      )}
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <Header session={session} counts={counts} onOpen={open} onReload={reloadCapture} onHome={onHome} />
      {session && <Toolbar filter={filter} setFilter={setFilter} facets={facets} counts={counts} group={group} setGroup={setGroup} />}

      {error && (
        <Center>
          <div className="text-center text-sm text-bad">Could not load capture:<br />{error}</div>
        </Center>
      )}
      {!error && needsCapture && (
        <Center>
          <div className="text-base font-bold text-text">No capture open</div>
          <div className="text-center font-mono text-xs text-dim">
            {isElectron() ? "Choose a .tap file recorded by GoTapline." : "No sess.json found."}
          </div>
          <button onClick={open} className="rounded-lg bg-accent px-5 py-2.5 font-bold text-accent-text">
            Open capture…
          </button>
        </Center>
      )}
      {!error && loading && !session && (
        <Center>
          <div className="text-sm text-dim">Decoding…</div>
        </Center>
      )}

      {!error && session && wide && (
        <Split left={timeline} right={<DetailPane event={selected} session={session} onClear={() => setSelected(null)} />} />
      )}
      {!error && session && !wide && (
        <>
          {timeline}
          {selected && (
            <div className="absolute inset-0 z-10 bg-bg">
              <DetailPane event={selected} session={session} onClear={() => setSelected(null)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-bg p-5">{children}</div>;
}
