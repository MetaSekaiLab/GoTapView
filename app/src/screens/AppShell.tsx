import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { DEFAULT_BASE, fetchSession, isEmbedded, NoCapture, pickCapture } from "../api";
import { Session, TapEvent } from "../types";
import { useTheme } from "../theme";
import { KEYS, get, set } from "../storage";
import { emptyFilter, extractFacets, FilterState, makePredicate } from "../model/facets";
import { GroupMode, groupEvents } from "../model/group";
import { Header } from "../components/Header";
import { Toolbar } from "../components/toolbar/Toolbar";
import { Timeline, TimelineHandle, Viewport } from "../components/timeline/Timeline";
import { Minimap } from "../components/timeline/Minimap";
import { DetailPane } from "../components/detail/DetailPane";
import { Split } from "../components/primitives";

const WIDE_MIN = 760;

export function AppShell() {
  const { theme, resolved } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_MIN;

  const [base, setBase] = useState(DEFAULT_BASE);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsCapture, setNeedsCapture] = useState(false);

  const [filter, setFilter] = useState<FilterState>(emptyFilter);
  const [group, setGroup] = useState<GroupMode>(() => (get(KEYS.groupMode) as GroupMode) || "none");
  const [selected, setSelected] = useState<TapEvent | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ offsetRatio: 0, visibleRatio: 1 });
  const listRef = useRef<TimelineHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSession(await fetchSession(base));
      setNeedsCapture(false);
      setSelected(null);
    } catch (e: any) {
      if (e instanceof NoCapture) {
        setNeedsCapture(true);
        setSession(null);
      } else {
        setError(e?.message ?? String(e));
      }
    } finally {
      setLoading(false);
    }
  }, [base]);

  const choose = useCallback(async () => {
    try {
      const p = await pickCapture(base);
      if (p) await load();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [base, load]);

  useEffect(() => {
    load();
  }, [load]);

  const changeGroup = useCallback((g: GroupMode) => {
    setGroup(g);
    set(KEYS.groupMode, g);
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
  const filtered = useMemo(() => {
    const pred = makePredicate(filter);
    return events.filter(pred);
  }, [events, filter]);
  const sections = useMemo(() => groupEvents(filtered, group, session), [filtered, group, session]);
  const t0 = session?.meta.startedWall ?? 0;

  const onSelect = useCallback((e: TapEvent) => setSelected(e), []);

  // Keyboard navigation: ↑/↓ (or k/j) step the selection through the filtered
  // list and scroll it into view; Esc closes the detail. A single window
  // listener reads the latest filtered/selected via a ref so it never restages.
  const navRef = useRef({ filtered, selected });
  navRef.current = { filtered, selected };
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (ev: KeyboardEvent) => {
      const { filtered, selected } = navRef.current;
      // Don't hijack keys while typing in the filter box or address field.
      const el = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
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
      if ((!down && !up) || filtered.length === 0) return;
      ev.preventDefault();
      const cur = selected ? filtered.findIndex((e) => e.seq === selected.seq) : -1;
      let next: number;
      if (cur < 0) next = down ? 0 : filtered.length - 1;
      else next = down ? Math.min(filtered.length - 1, cur + 1) : Math.max(0, cur - 1);
      setSelected(filtered[next]);
      listRef.current?.scrollToFlatIndex(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const timeline = (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.bg }}>
      <View style={{ flex: 1 }}>
        <Timeline
          ref={listRef}
          flat={filtered}
          sections={sections}
          groupMode={group}
          t0={t0}
          selectedSeq={selected?.seq ?? null}
          query={filter.text}
          onSelect={onSelect}
          onViewport={setViewport}
        />
      </View>
      {filtered.length > 0 && (
        <Minimap flat={filtered} viewport={viewport} onSeek={(i) => listRef.current?.scrollToFlatIndex(i)} />
      )}
    </View>
  );

  const body = () => {
    if (error) {
      return (
        <Center>
          <Text style={{ color: theme.bad, textAlign: "center", fontSize: 13 }}>Could not load session:{"\n"}{error}</Text>
          <Text style={{ color: theme.dim, textAlign: "center", fontSize: 12, fontFamily: theme.monoFont }}>
            Run:  tapview -f capture.tap{"\n"}then set the address above.
          </Text>
        </Center>
      );
    }
    if (needsCapture) {
      return (
        <Center>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>No capture open</Text>
          <Text style={{ color: theme.dim, textAlign: "center", fontSize: 12, fontFamily: theme.monoFont }}>
            {isEmbedded ? "Choose a .tap file recorded by GoTapline." : "Start the decoder:  tapview -f capture.tap"}
          </Text>
          {isEmbedded && (
            <Pressable onPress={choose} style={{ backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}>
              <Text style={{ color: theme.accentText, fontWeight: "700" }}>Choose capture…</Text>
            </Pressable>
          )}
        </Center>
      );
    }
    if (loading && !session) {
      return (
        <Center>
          <ActivityIndicator color={theme.accent} />
        </Center>
      );
    }
    if (!session) return null;

    if (wide) {
      return <Split left={timeline} right={<DetailPane event={selected} session={session} onClear={() => setSelected(null)} />} />;
    }
    return (
      <>
        {timeline}
        <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
            <DetailPane event={selected} session={session} onClear={() => setSelected(null)} />
          </SafeAreaView>
        </Modal>
      </>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle={resolved === "dark" ? "light-content" : "dark-content"} />
      <Header session={session} counts={counts} base={base} setBase={setBase} onLoad={load} onChoose={choose} />
      {session && <Toolbar filter={filter} setFilter={setFilter} facets={facets} counts={counts} group={group} setGroup={changeGroup} />}
      {body()}
    </SafeAreaView>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12, backgroundColor: theme.bg }}>
      {children}
    </View>
  );
}
