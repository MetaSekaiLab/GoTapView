import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";
import { Badge } from "../primitives";
import { JsonNode } from "./JsonTree";
import { PropKind, TYPE_NAME, lookup } from "../../model/props";

// PropertyTable renders a Diarkis property bag ({ R, Values, __props__ }) as a
// labelled id · name · type · value table with a room/player badge. The Go side
// already renamed the integer keys to names; the numeric id and (as a fallback)
// the type come from the static maps in model/props. Keys the Go side left
// numeric (unknown) still render — nothing is hidden.
export function isPropertyBag(v: unknown): v is { R: unknown; Values: Record<string, unknown>; __props__: PropKind } {
  return (
    typeof v === "object" &&
    v !== null &&
    "__props__" in v &&
    ((v as any).__props__ === "room" || (v as any).__props__ === "player") &&
    typeof (v as any).Values === "object"
  );
}

export function PropertyTable({ bag }: { bag: { R: unknown; Values: Record<string, unknown>; __props__: PropKind } }) {
  const { theme } = useTheme();
  const kind = bag.__props__;
  const tone = kind === "room" ? theme.prop.room : theme.prop.player;
  const rows = Object.entries(bag.Values).sort((a, b) => idOf(kind, a[0], a[1]) - idOf(kind, b[0], b[1]));
  const col = { color: theme.dim, fontSize: 10.5, fontWeight: "700" as const, letterSpacing: 0.4 };
  const cell = { fontFamily: theme.monoFont, fontSize: 12 };

  return (
    <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, overflow: "hidden" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          padding: 8,
          backgroundColor: theme.surfaceAlt,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Badge label={kind === "room" ? "RoomProperty" : "PlayerProperty"} tone={tone} />
        <Text style={{ color: theme.dim, fontSize: 11, fontFamily: theme.monoFont }}>
          R={renderR(bag.R)} · {rows.length} keys
        </Text>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 8, paddingVertical: 5, backgroundColor: theme.surface }}>
        <Text style={[col, { width: 34 }]}>ID</Text>
        <Text style={[col, { flex: 1 }]}>NAME</Text>
        <Text style={[col, { width: 56 }]}>TYPE</Text>
        <Text style={[col, { flex: 1.4 }]}>VALUE</Text>
      </View>

      {rows.map(([name, val], i) => {
        const meta = lookup(kind, name);
        const type = syncType(val) ?? (meta ? TYPE_NAME[meta.type] : "?");
        return (
          <View
            key={name}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              paddingHorizontal: 8,
              paddingVertical: 6,
              backgroundColor: i % 2 ? theme.surface : theme.bg,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            }}
          >
            <Text style={[cell, { width: 34, color: theme.dim }]}>{meta ? meta.id : "·"}</Text>
            <Text style={[cell, { flex: 1, color: meta ? tone : theme.text }]} selectable>
              {name}
            </Text>
            <Text style={[cell, { width: 56, color: theme.syntax.tag }]}>{type}</Text>
            <View style={{ flex: 1.4 }}>
              <ValueCell val={val} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ValueCell({ val }: { val: unknown }) {
  const { theme } = useTheme();
  // Unwrap the { __sync__, v } wrapper for a compact display; objects/msgpack
  // fall back to a mini JsonNode so nested structure stays inspectable.
  const inner = val && typeof val === "object" && "__sync__" in (val as any) ? (val as any).v : val;
  if (inner !== null && typeof inner === "object") {
    return <JsonNode value={inner} depth={1} />;
  }
  const text =
    inner === null ? "null" : typeof inner === "string" ? `"${inner}"` : String(inner);
  const color =
    typeof inner === "number"
      ? theme.syntax.num
      : typeof inner === "boolean"
        ? theme.syntax.bool
        : inner === null
          ? theme.syntax.null
          : theme.syntax.str;
  return (
    <Text style={{ fontFamily: theme.monoFont, fontSize: 12, color }} selectable>
      {text}
    </Text>
  );
}

function idOf(kind: PropKind, name: string, _val: unknown): number {
  const m = lookup(kind, name);
  if (m) return m.id;
  const n = Number(name);
  return Number.isFinite(n) ? n : 9999;
}

function syncType(val: unknown): string | null {
  if (val && typeof val === "object" && "__sync__" in (val as any)) return String((val as any).__sync__);
  return null;
}

function renderR(r: unknown): string {
  if (r && typeof r === "object" && "v" in (r as any)) return String((r as any).v);
  return String(r);
}
