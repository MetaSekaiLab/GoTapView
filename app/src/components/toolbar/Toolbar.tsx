import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useTheme } from "../../theme";
import { Facets, FilterState, KindFilter, activeCount } from "../../model/facets";
import { GroupMode } from "../../model/group";
import { FacetSelect } from "./FacetSelect";

// Toolbar owns all filtering and grouping controls: kind tabs, text search, a
// group-by segmented control, and an expandable panel of facet selectors.
export function Toolbar({
  filter,
  setFilter,
  facets,
  counts,
  group,
  setGroup,
}: {
  filter: FilterState;
  setFilter: (f: FilterState) => void;
  facets: Facets;
  counts: { all: number; http: number; udp: number };
  group: GroupMode;
  setGroup: (g: GroupMode) => void;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const active = activeCount(filter);

  const setKind = (kind: KindFilter) => setFilter({ ...filter, kind });
  const toggle = <T,>(key: keyof FilterState, v: T) => {
    const next = new Set(filter[key] as Set<T>);
    next.has(v) ? next.delete(v) : next.add(v);
    setFilter({ ...filter, [key]: next });
  };

  const tabs: KindFilter[] = ["all", "http", "udp"];

  return (
    <View style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {tabs.map((t) => {
            const on = filter.kind === t;
            return (
              <Pressable
                key={t}
                onPress={() => setKind(t)}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  backgroundColor: on ? theme.accent : theme.surfaceAlt,
                }}
              >
                <Text style={{ color: on ? theme.accentText : theme.dim, fontSize: 12, fontWeight: "600" }}>
                  {t.toUpperCase()} {counts[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={filter.text}
          onChangeText={(text) => setFilter({ ...filter, text })}
          placeholder="filter: path, host, cmd, msgId…"
          placeholderTextColor={theme.dim}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            flex: 1,
            backgroundColor: theme.surfaceAlt,
            color: theme.text,
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 7,
            fontSize: 13,
          }}
        />

        <Segmented
          value={group}
          options={[
            ["none", "Flat"],
            ["flow", "Flow"],
            ["phase", "Phase"],
          ]}
          onChange={(g) => setGroup(g as GroupMode)}
        />

        <Pressable
          onPress={() => setExpanded((x) => !x)}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 6,
            backgroundColor: active ? theme.accent + "22" : theme.surfaceAlt,
            borderWidth: 1,
            borderColor: active ? theme.accent + "88" : theme.border,
          }}
        >
          <Text style={{ color: active ? theme.accent : theme.dim, fontSize: 12, fontWeight: "600" }}>
            {expanded ? "▾" : "▸"} Filters{active ? ` (${active})` : ""}
          </Text>
        </Pressable>
      </View>

      {expanded && (
        <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 2, borderTopWidth: 1, borderTopColor: theme.border }}>
          <FacetSelect title="Direction" values={facets.dirs} selected={filter.dirs} onToggle={(v) => toggle("dirs", v)} />
          <FacetSelect title="Flow" values={facets.flows} selected={filter.flows} onToggle={(v) => toggle("flows", v)} />
          <FacetSelect title="Command" values={facets.cmds} selected={filter.cmds} tone={theme.lane.udpC2S} onToggle={(v) => toggle("cmds", v)} />
          <FacetSelect title="Message" values={facets.msgTypes} selected={filter.msgTypes} tone={theme.accent} onToggle={(v) => toggle("msgTypes", v)} />
          {active > 0 && (
            <Pressable onPress={() => setFilter({ ...filter, flows: new Set(), dirs: new Set(), cmds: new Set(), msgTypes: new Set(), kind: "all", text: "" })} style={{ alignSelf: "flex-start", marginTop: 4 }}>
              <Text style={{ color: theme.accent, fontSize: 12 }}>Clear all filters</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}>
      {options.map(([v, label], i) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: on ? theme.accent : theme.surfaceAlt,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: theme.border,
            }}
          >
            <Text style={{ color: on ? theme.accentText : theme.dim, fontSize: 12, fontWeight: "600" }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
