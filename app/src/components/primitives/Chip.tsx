import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme";

// Chip is a compact label used for cmd / msgType tags on a row, and as an
// interactive toggle in the toolbar facet selectors. When `active` and
// `onPress` are provided it renders as a selectable pill.
export function Chip({
  label,
  tone,
  count,
  active,
  onPress,
}: {
  label: string;
  tone?: string;
  count?: number;
  active?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const color = tone ?? theme.dim;
  const body = (hovered: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: active ? color + "26" : hovered ? theme.surfaceAlt : "transparent",
        borderWidth: 1,
        borderColor: active ? color + "88" : theme.border,
      }}
    >
      <Text style={{ color: active ? color : theme.text, fontSize: 11.5, fontWeight: "600", fontFamily: theme.monoFont }}>
        {label}
      </Text>
      {count !== undefined && <Text style={{ color: theme.dim, fontSize: 10.5 }}>{count}</Text>}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ hovered }: any) => body(!!hovered)}
    </Pressable>
  );
}
