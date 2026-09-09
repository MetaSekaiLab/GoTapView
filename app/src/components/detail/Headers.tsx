import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";

// Headers renders an HTTP header map as monospace key: value lines.
export function Headers({ h }: { h?: Record<string, string> }) {
  const { theme } = useTheme();
  if (!h) return null;
  return (
    <View>
      {Object.entries(h).map(([k, v]) => (
        <Text
          key={k}
          style={{ color: theme.mono, fontSize: 12, fontFamily: theme.monoFont, lineHeight: 17 }}
          selectable
        >
          <Text style={{ color: theme.dim }}>{k}: </Text>
          {v}
        </Text>
      ))}
    </View>
  );
}
