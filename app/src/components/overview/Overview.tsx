import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { Session } from "../../types";
import { useTheme } from "../../theme";
import { Section, Badge } from "../primitives";
import { analyze, Count, Overview as OverviewData } from "../../model/analyze";

// Overview summarises the whole capture: timespan, protocol mix, command and
// message histograms, the Diarkis key issuance point, and who was in the room.
export function Overview({ session }: { session: Session }) {
  const { theme } = useTheme();
  const o = useMemo<OverviewData>(() => analyze(session), [session]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 48 }}>
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 2 }}>{session.meta.file}</Text>
      <Text style={{ color: theme.dim, fontSize: 12, fontFamily: theme.monoFont, marginBottom: 14 }}>
        {o.records} records · {o.flows} flows · {fmtDuration(o.span.durationMs)}
        {o.truncated ? " · truncated" : ""}
      </Text>

      <Section title="Protocol mix">
        <StatRow label="HTTP" value={o.protocol.http} tone={theme.lane.http} />
        <StatRow label="UDP frames" value={o.protocol.udpFrames} tone={theme.lane.udpC2S} />
        <StatRow label="UDP control" value={o.protocol.udpControl} tone={theme.lane.ctrl} />
        {o.protocol.nonDiarkis > 0 && <StatRow label="non-Diarkis" value={o.protocol.nonDiarkis} tone={theme.dim} />}
      </Section>

      <Section title="Diarkis session">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
          <Badge label={`${o.diarkisKeys} key${o.diarkisKeys === 1 ? "" : "s"}`} tone={theme.key} />
          {o.keyPoint && <Badge label={`key @ seq ${o.keyPoint.seq} · ${(o.keyPoint.relMs / 1000).toFixed(2)}s`} tone={theme.key} />}
        </View>
        {o.players.length > 0 && (
          <View>
            <Text style={{ color: theme.dim, fontSize: 11, marginTop: 4, marginBottom: 4 }}>
              players seen ({o.players.length})
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {o.players.map((p) => (
                <Text
                  key={p}
                  style={{
                    color: theme.text,
                    fontSize: 11.5,
                    fontFamily: theme.monoFont,
                    backgroundColor: theme.surfaceAlt,
                    borderRadius: 5,
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                  }}
                  selectable
                >
                  {p}
                </Text>
              ))}
            </View>
          </View>
        )}
      </Section>

      {o.cmds.length > 0 && (
        <Section title="Commands">
          <Histogram counts={o.cmds} tone={theme.lane.udpC2S} theme={theme} />
        </Section>
      )}

      {o.msgTypes.length > 0 && (
        <Section title="Broadcast messages">
          <Histogram counts={o.msgTypes} tone={theme.accent} theme={theme} />
        </Section>
      )}
    </ScrollView>
  );
}

function StatRow({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />
      <Text style={{ color: theme.text, fontSize: 12.5, flex: 1 }}>{label}</Text>
      <Text style={{ color: theme.mono, fontSize: 12.5, fontFamily: theme.monoFont }}>{value}</Text>
    </View>
  );
}

// Histogram draws horizontal bars scaled to the largest count.
function Histogram({ counts, tone, theme }: { counts: Count[]; tone: string; theme: ReturnType<typeof useTheme>["theme"] }) {
  const max = Math.max(...counts.map((c) => c.count), 1);
  return (
    <View style={{ gap: 5 }}>
      {counts.map((c) => (
        <View key={c.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ width: 118, color: theme.text, fontSize: 11.5, fontFamily: theme.monoFont }} numberOfLines={1}>
            {c.label}
          </Text>
          <View style={{ flex: 1, height: 12, backgroundColor: theme.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
            <View style={{ width: `${(c.count / max) * 100}%`, height: "100%", backgroundColor: tone + "cc" }} />
          </View>
          <Text style={{ width: 40, textAlign: "right", color: theme.dim, fontSize: 11, fontFamily: theme.monoFont }}>
            {c.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}
