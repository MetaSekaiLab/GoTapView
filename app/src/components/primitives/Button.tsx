import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import { useTheme } from "../../theme";

type Variant = "primary" | "subtle" | "ghost";

// Button is the app's standard clickable control: a labelled pill with a
// pointer cursor (via role=button + global CSS), a hover tint and a pressed
// state. Variants: primary (accent fill), subtle (surface fill), ghost (bare).
export function Button({
  label,
  onPress,
  variant = "subtle",
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
}) {
  const { theme } = useTheme();

  const base = (hovered: boolean, pressed: boolean): ViewStyle => {
    const dim = pressed ? 0.85 : 1;
    if (variant === "primary") {
      return { backgroundColor: theme.accent, opacity: hovered ? 0.92 * dim : dim };
    }
    if (variant === "ghost") {
      return { backgroundColor: hovered ? theme.surfaceAlt : "transparent", opacity: dim };
    }
    return {
      backgroundColor: hovered ? theme.border : theme.surfaceAlt,
      opacity: dim,
      borderWidth: 1,
      borderColor: theme.border,
    };
  };

  const color = variant === "primary" ? theme.accentText : theme.text;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ hovered, pressed }: any) => (
        <Text
          style={[
            {
              color,
              fontWeight: "700",
              fontSize: 12,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 7,
              overflow: "hidden",
            },
            base(!!hovered, !!pressed),
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
