import React from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useTheme } from "../theme";
import { ThemeMode } from "../theme";
import { Session } from "../types";
import { isEmbedded } from "../api";
import { Button } from "./primitives";

const MODE_ICON: Record<ThemeMode, string> = { system: "◐", light: "☀", dark: "☾" };
const MODE_LABEL: Record<ThemeMode, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

// Header is the top bar: a clickable brand (returns to the session overview),
// the session summary, the capture controls (Choose/Reload or a remote address),
// and the theme toggle.
export function Header({
  session,
  counts,
  base,
  setBase,
  onLoad,
  onChoose,
  onHome,
}: {
  session: Session | null;
  counts: { http: number; udp: number };
  base: string;
  setBase: (b: string) => void;
  onLoad: () => void;
  onChoose: () => void;
  onHome: () => void;
}) {
  const { theme, mode, cycleMode } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <Pressable onPress={onHome} accessibilityRole="button" accessibilityLabel="Home">
        {({ hovered }: any) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: hovered ? theme.surfaceAlt : "transparent",
            }}
          >
            <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: theme.accent }} />
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800", letterSpacing: 0.2 }}>GoTapView</Text>
          </View>
        )}
      </Pressable>

      {session && (
        <Text style={{ color: theme.dim, fontSize: 12, fontFamily: theme.monoFont, flexShrink: 1 }} numberOfLines={1}>
          {session.meta.file} · {counts.http} http · {counts.udp} udp · {session.meta.diarkisKeys} key
          {session.meta.diarkisKeys === 1 ? "" : "s"}
          {session.meta.truncated ? " · truncated" : ""}
        </Text>
      )}

      <View style={{ flex: 1 }} />

      {!isEmbedded && (
        <TextInput
          value={base}
          onChangeText={setBase}
          onSubmitEditing={onLoad}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://mac-ip:8787"
          placeholderTextColor={theme.dim}
          style={{
            width: 200,
            backgroundColor: theme.surfaceAlt,
            color: theme.text,
            borderRadius: 7,
            paddingHorizontal: 10,
            paddingVertical: 7,
            fontSize: 12,
            fontFamily: theme.monoFont,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        />
      )}
      {isEmbedded && <Button label="Choose capture…" onPress={onChoose} variant="subtle" />}
      <Button label={isEmbedded ? "Reload" : "Load"} onPress={onLoad} variant="primary" />
      <Pressable onPress={cycleMode} accessibilityRole="button" accessibilityLabel={MODE_LABEL[mode]}>
        {({ hovered }: any) => (
          <Text
            style={{
              color: theme.text,
              fontSize: 15,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 7,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: hovered ? theme.border : theme.surfaceAlt,
              overflow: "hidden",
            }}
          >
            {MODE_ICON[mode]}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
