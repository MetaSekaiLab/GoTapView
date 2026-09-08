import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Modal, Pressable, RefreshControl,
  SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { DEFAULT_BASE, fetchSession } from "./src/api";
import { Session, TapEvent } from "./src/types";
import { C } from "./src/theme";
import { FilterBar, KindFilter } from "./src/components/FilterBar";
import { EventDetail } from "./src/components/EventDetail";
import { summarize, searchText } from "./src/summary";

export default function App() {
  const [base, setBase] = useState(DEFAULT_BASE);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TapEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSession(await fetchSession(base));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => { load(); }, [load]);

  const events = session?.events ?? [];
  const counts = useMemo(() => ({
    all: events.length,
    http: events.filter((e) => e.kind === "http").length,
    udp: events.filter((e) => e.kind === "udp").length,
  }), [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (q && !searchText(e).includes(q)) return false;
      return true;
    });
  }, [events, kind, query]);

  const t0 = session?.meta.startedWall ?? 0;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>GoTapView</Text>
        {session && (
          <Text style={styles.sub}>
            {session.meta.file} · {counts.http} http · {counts.udp} udp · {session.meta.diarkisKeys} key
            {session.meta.diarkisKeys === 1 ? "" : "s"}
            {session.meta.truncated ? " · truncated" : ""}
          </Text>
        )}
        <View style={styles.baseRow}>
          <TextInput
            value={base}
            onChangeText={setBase}
            onSubmitEditing={load}
            style={styles.baseInput}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://mac-ip:8787"
            placeholderTextColor={C.dim}
          />
          <Pressable style={styles.reload} onPress={load}>
            <Text style={styles.reloadText}>Load</Text>
          </Pressable>
        </View>
      </View>

      <FilterBar kind={kind} onKind={setKind} query={query} onQuery={setQuery} counts={counts} />

      {error && (
        <View style={styles.center}>
          <Text style={styles.error}>Could not load session:{"\n"}{error}</Text>
          <Text style={styles.hint}>Run:  tapview -f capture.tap{"\n"}then set the address above.</Text>
        </View>
      )}

      {!error && loading && !session && (
        <View style={styles.center}><ActivityIndicator color={C.accent} /></View>
      )}

      {!error && session && (
        <FlatList
          data={filtered}
          keyExtractor={(e, i) => `${e.seq}-${e.kind}-${i}`}
          initialNumToRender={40}
          windowSize={11}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
          renderItem={({ item }) => <Row e={item} t0={t0} onPress={() => setSelected(item)} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.root}>
          <View style={styles.modalBar}>
            <Pressable onPress={() => setSelected(null)}><Text style={styles.close}>✕ Close</Text></Pressable>
          </View>
          {selected && <EventDetail e={selected} />}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ e, t0, onPress }: { e: TapEvent; t0: number; onPress: () => void }) {
  const rel = ((e.wallMs - t0) / 1000).toFixed(3);
  const isHttp = e.kind === "http";
  const dotColor = isHttp
    ? C.http
    : e.udp?.data.frame
      ? e.udp.dir === "c2s" ? C.udpC2S : C.udpS2C
      : C.ctrl;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.time}>{rel}s</Text>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.badge, { color: dotColor }]}>{isHttp ? "HTTP" : "UDP "}</Text>
      <Text style={styles.summary} numberOfLines={1}>{summarize(e)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { padding: 10, paddingTop: 14, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { color: C.text, fontSize: 18, fontWeight: "800" },
  sub: { color: C.dim, fontSize: 12, marginTop: 2, fontFamily: "ui-monospace, Menlo, monospace" },
  baseRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  baseInput: {
    flex: 1, backgroundColor: C.panelAlt, color: C.text, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 12,
    fontFamily: "ui-monospace, Menlo, monospace",
  },
  reload: { backgroundColor: C.accent, borderRadius: 6, paddingHorizontal: 14, justifyContent: "center" },
  reloadText: { color: "#fff", fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, gap: 8 },
  sep: { height: 1, backgroundColor: C.border, opacity: 0.4 },
  time: { color: C.dim, fontSize: 11, width: 62, fontFamily: "ui-monospace, Menlo, monospace" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: { fontSize: 11, fontWeight: "700", fontFamily: "ui-monospace, Menlo, monospace" },
  summary: { color: C.text, fontSize: 12.5, flex: 1, fontFamily: "ui-monospace, Menlo, monospace" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 12 },
  error: { color: C.bad, textAlign: "center", fontSize: 13 },
  hint: { color: C.dim, textAlign: "center", fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace" },
  modalBar: { padding: 10, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border },
  close: { color: C.accent, fontSize: 15, fontWeight: "700" },
});
