import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { C } from "../theme";

export type KindFilter = "all" | "http" | "udp";

export function FilterBar({
  kind,
  onKind,
  query,
  onQuery,
  counts,
}: {
  kind: KindFilter;
  onKind: (k: KindFilter) => void;
  query: string;
  onQuery: (q: string) => void;
  counts: { all: number; http: number; udp: number };
}) {
  const tabs: KindFilter[] = ["all", "http", "udp"];
  return (
    <View style={styles.bar}>
      <View style={styles.tabs}>
        {tabs.map((t) => (
          <Pressable key={t} onPress={() => onKind(t)} style={[styles.tab, kind === t && styles.tabActive]}>
            <Text style={[styles.tabText, kind === t && styles.tabTextActive]}>
              {t.toUpperCase()} {counts[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={query}
        onChangeText={onQuery}
        placeholder="filter: path, host, cmd, msgId…"
        placeholderTextColor={C.dim}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { padding: 8, gap: 8, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border },
  tabs: { flexDirection: "row", gap: 6 },
  tab: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6, backgroundColor: C.panelAlt },
  tabActive: { backgroundColor: C.accent },
  tabText: { color: C.dim, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  input: {
    backgroundColor: C.panelAlt,
    color: C.text,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
  },
});
