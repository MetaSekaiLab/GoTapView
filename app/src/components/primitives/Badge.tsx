import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme";

// Badge is a small tinted pill: a coloured dot of meaning next to a label.
export function Badge({ label, tone }: { label: string; tone: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: tone + "22",
        borderWidth: 1,
        borderColor: tone + "55",
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
      <Text style={{ color: tone, fontSize: 11, fontWeight: "700", fontFamily: theme.monoFont }}>{label}</Text>
    </View>
  );
}
