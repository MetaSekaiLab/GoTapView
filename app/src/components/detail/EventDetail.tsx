import React from "react";
import { View, Text, ScrollView } from "react-native";
import { TapEvent } from "../../types";
import { useTheme } from "../../theme";
import { Section, InlineKV, Badge } from "../primitives";
import { JsonNode } from "./JsonTree";
import { HexView } from "./HexView";
import { Headers } from "./Headers";
import { PropertyTable, isPropertyBag } from "./PropertyTable";
import { cmdLabel } from "../../model/analyze";

// Decoded renders a frame's decoded payload, swapping any property bag (at any
// depth) for a PropertyTable while keeping the rest as a compact JSON tree.
// Containers are only "opened" along the path to a bag; bag-free subtrees stay
// as a single JsonNode.
function Decoded({ name, value, depth = 0 }: { name?: string; value: unknown; depth?: number }) {
  const { theme } = useTheme();
  if (isPropertyBag(value)) {
    return (
      <View style={{ marginBottom: 8 }}>
        {name !== undefined && (
          <Text style={{ color: theme.syntax.key, fontFamily: theme.monoFont, fontSize: 12, marginBottom: 4 }}>
            {name}
          </Text>
        )}
        <PropertyTable bag={value} />
      </View>
    );
  }
  const container = (value && typeof value === "object") || Array.isArray(value);
  if (container && containsBag(value)) {
    const entries: [string, unknown][] = Array.isArray(value)
      ? value.map((v, i) => [String(i), v])
      : Object.entries(value as object);
    return (
      <View>
        {name !== undefined && (
          <Text style={{ color: theme.syntax.key, fontFamily: theme.monoFont, fontSize: 12 }}>{name}:</Text>
        )}
        <View style={{ marginLeft: name !== undefined ? 10 : 0, gap: 2 }}>
          {entries.map(([k, v]) => (
            <Decoded key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </View>
      </View>
    );
  }
  return <JsonNode name={name} value={value} depth={depth} />;
}

function containsBag(v: unknown): boolean {
  if (isPropertyBag(v)) return true;
  if (Array.isArray(v)) return v.some(containsBag);
  if (v && typeof v === "object") return Object.values(v).some(containsBag);
  return false;
}

export function EventDetail({ e }: { e: TapEvent }) {
  const { theme } = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 14, paddingBottom: 48 }}>
      <Text style={{ color: theme.dim, fontSize: 12, marginBottom: 12, fontFamily: theme.monoFont }} selectable>
        seq {e.seq} · flow {e.flowId} · {new Date(e.wallMs).toLocaleTimeString()} · {e.remote}
      </Text>

      {e.http && (
        <>
          <Section
            title="Request line"
            accessory={<Badge label={`HTTP ${e.http.status || "—"}`} tone={statusTone(theme, e.http.status)} />}
          >
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: "700", fontFamily: theme.monoFont }} selectable>
              {e.http.method} {e.http.path}
            </Text>
            {e.http.note ? <Text style={{ color: theme.dim, fontSize: 12, marginTop: 3 }}>[{e.http.note}]</Text> : null}
          </Section>
          <Section title="Request headers"><Headers h={e.http.reqHeaders} /></Section>
          {renderBody("Request body", e.http.reqJson, e.http.reqBodyText, e.http.reqBodyHex)}
          <Section title="Response headers"><Headers h={e.http.respHeaders} /></Section>
          {renderBody("Response body", e.http.respJson, e.http.respBodyText, e.http.respBodyHex)}
        </>
      )}

      {e.udp?.other && (
        <>
          <Section title="Non-Diarkis UDP">
            <InlineKV pairs={[["dir", e.udp.dir], ["bytes", String(e.udp.other.bytes)]]} />
            <Text style={{ color: theme.dim, fontSize: 11.5, marginTop: 4, lineHeight: 16 }}>
              This flow carries no Diarkis frames, so it is kept verbatim rather than force-fitted.
            </Text>
          </Section>
          <Section title="Payload (raw)"><HexView hex={e.udp.other.hex} /></Section>
        </>
      )}

      {e.udp?.data && (
        <>
          <Section title="Datagram">
            <InlineKV
              pairs={[
                ["dir", <Badge key="d" label={e.udp.dir === "c2s" ? "C→S" : "S→C"} tone={e.udp.dir === "c2s" ? theme.lane.udpC2S : theme.lane.udpS2C} />],
                ["flag", e.udp.data.flag],
                ["wrapSeq", String(e.udp.data.wrapSeq)],
              ]}
            />
          </Section>

          {e.udp.data.split && (
            <Section title="Oversized payload">
              <Text style={{ color: theme.mono, fontSize: 12.5, fontFamily: theme.monoFont }}>
                fragment {e.udp.data.split.index + 1} of {e.udp.data.split.count} · id {e.udp.data.split.id} ·{" "}
                {e.udp.data.split.complete
                  ? `reassembled ${e.udp.data.split.bytes} bytes`
                  : `${e.udp.data.split.bytes} bytes buffered`}
              </Text>
            </Section>
          )}

          {e.udp.data.frame && (
            <Section
              title="Frame"
              accessory={
                <Badge
                  label={e.udp.data.frame.recognized ? "decoded" : "raw"}
                  tone={e.udp.data.frame.recognized ? theme.lane.udpS2C : theme.dim}
                />
              }
            >
              <InlineKV
                pairs={[
                  ["ver", String(e.udp.data.frame.ver)],
                  ["cmd", `${e.udp.data.frame.cmd} (${cmdLabel(e.udp.data.frame.ver, e.udp.data.frame.cmd)})`],
                  ...(e.udp.data.frame.status !== undefined ? ([["status", String(e.udp.data.frame.status)]] as Array<[string, React.ReactNode]>) : []),
                ]}
              />
            </Section>
          )}
          {e.udp.data.frame?.decoded !== undefined && (
            <Section title="Decoded payload"><Decoded value={e.udp.data.frame.decoded} /></Section>
          )}
          {e.udp.data.frame?.rawPayload && (
            <Section title="Undecoded payload (raw)"><HexView hex={e.udp.data.frame.rawPayload} /></Section>
          )}
          {!e.udp.data.frame && e.udp.data.raw && (
            <Section title="Control body (raw)"><HexView hex={e.udp.data.raw} /></Section>
          )}
        </>
      )}
    </ScrollView>
  );
}

function renderBody(title: string, json?: unknown, text?: string, hex?: string) {
  if (json !== undefined && json !== null) {
    return (
      <Section title={`${title} · decrypted JSON`}>
        <Decoded value={json} />
      </Section>
    );
  }
  if (text) return <BodyText title={title} text={text} />;
  if (hex) return <Section title={`${title} · raw`}><HexView hex={hex} /></Section>;
  return null;
}

function BodyText({ title, text }: { title: string; text: string }) {
  const { theme } = useTheme();
  return (
    <Section title={title}>
      <Text style={{ color: theme.mono, fontSize: 12, fontFamily: theme.monoFont }} selectable>
        {text}
      </Text>
    </Section>
  );
}

function statusTone(theme: ReturnType<typeof useTheme>["theme"], status: number): string {
  if (!status) return theme.dim;
  if (status >= 500) return theme.bad;
  if (status >= 400) return theme.warn;
  return theme.lane.http;
}
