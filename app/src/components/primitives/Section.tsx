import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../theme";

// Section is a labelled block in the detail pane and overview: a small heading
// with optional right-aligned accessory, and its content below.
export function Section({
  title,
  accessory,
  children,
}: {
  title: string;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <Text style={{ color: theme.dim, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" }}>
          {title}
        </Text>
        {accessory}
      </View>
      {children}
    </View>
  );
}
