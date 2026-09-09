import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme";

// KeyValue renders a monospace "key: value" line; used for headers and frame
// metadata. Value can be a string or arbitrary node.
export function KeyValue({ k, v }: { k: string; v: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Text style={{ color: theme.mono, fontSize: 12, fontFamily: theme.monoFont, lineHeight: 18 }} selectable>
      <Text style={{ color: theme.dim }}>{k}: </Text>
      {v}
    </Text>
  );
}

// InlineKV lays several small key/value pairs on one wrapping row.
export function InlineKV({ pairs }: { pairs: Array<[string, React.ReactNode]> }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
      {pairs.map(([k, v], i) => (
        <Text key={i} style={{ color: theme.mono, fontSize: 12, fontFamily: theme.monoFont }} selectable>
          <Text style={{ color: theme.dim }}>{k} </Text>
          {v}
        </Text>
      ))}
    </View>
  );
}
