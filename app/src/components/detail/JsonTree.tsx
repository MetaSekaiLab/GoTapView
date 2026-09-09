import React, { useState } from "react";
import { Text, View, Pressable } from "react-native";
import { useTheme, Theme } from "../../theme";

// JsonTree renders an arbitrary decoded value as a collapsible tree, giving
// readable treatment to the wrappers the decoder emits:
//   { __sync__, v }           a Diarkis SyncData typed value
//   { __msgpack__, __hex__ }  a bin blob that was itself MessagePack
// Property bags ({ __props__, Values }) are handled one level up by EventDetail
// (routed to PropertyTable); everything else lands here.
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function renderScalar(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function scalarColor(t: Theme, v: unknown): string {
  if (typeof v === "number") return t.syntax.num;
  if (typeof v === "boolean") return t.syntax.bool;
  if (v === null) return t.syntax.null;
  return t.syntax.str;
}

export function JsonNode({
  name,
  value,
  depth = 0,
}: {
  name?: string;
  value: unknown;
  depth?: number;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(depth < 2);
  const mono = { fontFamily: theme.monoFont, fontSize: 12.5, lineHeight: 18 } as const;

  // SyncData typed value -> "type: value" inline (msgpack recurses).
  if (isObj(value) && "__sync__" in value) {
    const t = value.__sync__ as string;
    const v = (value as any).v;
    if (t === "msgpack") {
      return <JsonNode name={name ? `${name} (msgpack)` : "msgpack"} value={v} depth={depth} />;
    }
    return (
      <Text style={[mono, { color: theme.mono }]} selectable>
        {name !== undefined && <Text style={{ color: theme.syntax.key }}>{name}: </Text>}
        <Text style={{ color: theme.syntax.tag }}>{t} </Text>
        <Text style={{ color: scalarColor(theme, v) }}>{renderScalar(v)}</Text>
      </Text>
    );
  }
  // nested-msgpack bin blob -> show decoded value.
  if (isObj(value) && "__msgpack__" in value) {
    return <JsonNode name={name ? `${name} (bin)` : "bin"} value={(value as any).__msgpack__} depth={depth} />;
  }

  if (!isObj(value) && !Array.isArray(value)) {
    return (
      <Text style={[mono, { color: theme.mono }]} selectable>
        {name !== undefined && <Text style={{ color: theme.syntax.key }}>{name}: </Text>}
        <Text style={{ color: scalarColor(theme, value) }}>{renderScalar(value)}</Text>
      </Text>
    );
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const brace = Array.isArray(value) ? ["[", "]"] : ["{", "}"];

  return (
    <View>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Text style={[mono, { color: theme.dim }]}>
          <Text style={{ color: theme.dim }}>{open ? "▾ " : "▸ "}</Text>
          {name !== undefined && <Text style={{ color: theme.syntax.key }}>{name}: </Text>}
          <Text style={{ color: theme.dim }}>
            {brace[0]}
            {!open && <Text style={{ color: theme.dim }}>{entries.length}</Text>}
            {!open && brace[1]}
          </Text>
        </Text>
      </Pressable>
      {open && (
        <View style={{ marginLeft: 10, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: theme.border }}>
          {entries.map(([k, v]) => (
            <JsonNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <Text style={[mono, { color: theme.dim }]}>{brace[1]}</Text>
        </View>
      )}
    </View>
  );
}
