import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { TapEvent } from "../types";
import { C } from "../theme";
import { JsonNode } from "./JsonTree";
import { HexView } from "./HexView";

// Section is a labelled block in the detail pane.
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Headers = ({ h }: { h?: Record<string, string> }) => {
  if (!h) return null;
  return (
    <View>
      {Object.entries(h).map(([k, v]) => (
        <Text key={k} style={styles.header} selectable>
          <Text style={styles.headerKey}>{k}: </Text>
          {v}
        </Text>
      ))}
    </View>
  );
};

export function EventDetail({ e }: { e: TapEvent }) {
  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
      <Text style={styles.meta}>
        seq {e.seq} · flow {e.flowId} · {new Date(e.wallMs).toLocaleTimeString()} · {e.remote}
      </Text>

      {e.http && (
        <>
          <Section title={`${e.http.method} ${e.http.path}`}>
            <Text style={styles.status}>HTTP {e.http.status || "—"}{e.http.note ? `   [${e.http.note}]` : ""}</Text>
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
            <Text style={styles.kv}>
              dir: {e.udp.dir}   {e.udp.other.bytes} bytes
            </Text>
            <Text style={styles.hintText}>
              This flow carries no Diarkis frames, so it is kept verbatim rather than
              force-fitted to the Diarkis layout.
            </Text>
          </Section>
          <Section title="Payload (raw)">
            <HexView hex={e.udp.other.hex} />
          </Section>
        </>
      )}

      {e.udp?.data && (
        <>
          <Section title="Datagram">
            <Text style={styles.kv}>
              dir: {e.udp.dir}   flag: {e.udp.data.flag}   wrapSeq: {e.udp.data.wrapSeq}
            </Text>
          </Section>

          {e.udp.data.split && (
            <Section title="Oversized payload">
              <Text style={styles.kv}>
                fragment {e.udp.data.split.index + 1} of {e.udp.data.split.count}
                {"   "}id: {e.udp.data.split.id}
                {"   "}
                {e.udp.data.split.complete
                  ? `reassembled ${e.udp.data.split.bytes} bytes`
                  : `${e.udp.data.split.bytes} bytes buffered`}
              </Text>
              {!e.udp.data.split.complete && (
                <Text style={styles.hintText}>
                  Waiting for the rest of this set; the frame is decoded once the final
                  fragment arrives.
                </Text>
              )}
            </Section>
          )}

          {e.udp.data.frame && (
            <Section title="Frame">
              <Text style={styles.kv}>
                ver: {e.udp.data.frame.ver}   cmd: {e.udp.data.frame.cmd}
                {e.udp.data.frame.status !== undefined ? `   status: ${e.udp.data.frame.status}` : ""}
                {e.udp.data.frame.recognized ? "   ✓ decoded" : "   · not fully decoded"}
              </Text>
            </Section>
          )}
          {e.udp.data.frame?.decoded !== undefined && (
            <Section title="Decoded payload">
              <JsonNode value={e.udp.data.frame.decoded} />
            </Section>
          )}
          {e.udp.data.frame?.rawPayload && (
            <Section title="Undecoded payload (raw)">
              <HexView hex={e.udp.data.frame.rawPayload} />
            </Section>
          )}
          {!e.udp.data.frame && e.udp.data.raw && (
            <Section title="Control body (raw)">
              <HexView hex={e.udp.data.raw} />
            </Section>
          )}
        </>
      )}

    </ScrollView>
  );
}

function renderBody(title: string, json?: unknown, text?: string, hex?: string) {
  if (json !== undefined && json !== null) {
    return (
      <Section title={`${title} (decrypted JSON)`}>
        <JsonNode value={json} />
      </Section>
    );
  }
  if (text) {
    return (
      <Section title={title}>
        <Text style={styles.body} selectable>{text}</Text>
      </Section>
    );
  }
  if (hex) {
    return (
      <Section title={`${title} (raw)`}>
        <HexView hex={hex} />
      </Section>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  meta: { color: C.dim, fontSize: 12, marginBottom: 10, fontFamily: "ui-monospace, Menlo, monospace" },
  section: { marginBottom: 14 },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  status: { color: C.http, fontSize: 13, fontWeight: "600" },
  kv: { color: C.mono, fontSize: 12.5, fontFamily: "ui-monospace, Menlo, monospace" },
  header: { color: C.mono, fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace", lineHeight: 17 },
  headerKey: { color: C.dim },
  body: { color: C.mono, fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace" },
  hintText: { color: C.dim, fontSize: 11.5, marginTop: 4, lineHeight: 16 },
});
