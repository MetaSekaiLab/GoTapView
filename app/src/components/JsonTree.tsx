import React, { useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { C } from "../theme";

// JsonTree renders an arbitrary decoded value as a collapsible tree. It gives
// special, readable treatment to the two wrappers the decoder emits:
//   { __sync__, v }      a Diarkis SyncData typed value
//   { __msgpack__, __hex__ }  a bin blob that was itself MessagePack
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const Leaf = ({ k, v }: { k?: string; v: unknown }) => (
  <Text style={styles.line}>
    {k !== undefined && <Text style={styles.key}>{k}: </Text>}
    <Text style={valueStyle(v)}>{renderScalar(v)}</Text>
  </Text>
);

function renderScalar(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}
function valueStyle(v: unknown) {
  if (typeof v === "number") return styles.num;
  if (typeof v === "boolean") return styles.bool;
  if (v === null) return styles.null;
  return styles.str;
}

export function JsonNode({
  name,
  value,
  depth = 0,
  defaultOpen = true,
}: {
  name?: string;
  value: unknown;
  depth?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(depth < 2 ? defaultOpen : false);

  // SyncData typed value -> show inline as "type: value"
  if (isObj(value) && "__sync__" in value) {
    const t = value.__sync__ as string;
    const v = (value as any).v;
    if (t === "msgpack") {
      return <JsonNode name={name ? `${name} (sync/msgpack)` : "sync/msgpack"} value={v} depth={depth} />;
    }
    return (
      <Text style={styles.line}>
        {name !== undefined && <Text style={styles.key}>{name}: </Text>}
        <Text style={styles.tag}>{t} </Text>
        <Text style={valueStyle(v)}>{renderScalar(v)}</Text>
      </Text>
    );
  }
  // nested-msgpack bin blob -> show the decoded value, hex available on expand
  if (isObj(value) && "__msgpack__" in value) {
    return <JsonNode name={name ? `${name} (bin/msgpack)` : "bin/msgpack"} value={(value as any).__msgpack__} depth={depth} />;
  }

  if (!isObj(value) && !Array.isArray(value)) {
    return <Leaf k={name} v={value} />;
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const brace = Array.isArray(value) ? ["[", "]"] : ["{", "}"];

  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.rowPress}>
        <Text style={styles.line}>
          <Text style={styles.caret}>{open ? "▾ " : "▸ "}</Text>
          {name !== undefined && <Text style={styles.key}>{name}: </Text>}
          <Text style={styles.brace}>
            {brace[0]}
            {!open && <Text style={styles.count}>{entries.length}</Text>}
            {!open && brace[1]}
          </Text>
        </Text>
      </Pressable>
      {open && (
        <View style={[styles.children, { borderLeftColor: C.border }]}>
          {entries.map(([k, v]) => (
            <JsonNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <Text style={styles.braceClose}>{brace[1]}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rowPress: {},
  line: { fontFamily: mono(), fontSize: 12.5, color: C.mono, lineHeight: 18 },
  children: { marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1 },
  caret: { color: C.dim },
  key: { color: C.accent },
  brace: { color: C.dim },
  braceClose: { color: C.dim, fontFamily: mono(), fontSize: 12.5 },
  count: { color: C.dim },
  str: { color: C.udpS2C },
  num: { color: C.http },
  bool: { color: C.warn },
  null: { color: C.dim },
  tag: { color: C.key },
});

function mono() {
  return "ui-monospace, Menlo, Consolas, monospace";
}
