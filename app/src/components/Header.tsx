import React from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useTheme } from "../theme";
import { ThemeMode } from "../theme";
import { Session } from "../types";
import { isEmbedded } from "../api";

const MODE_ICON: Record<ThemeMode, string> = { system: "◐", light: "☀", dark: "☾" };

// Header is the top bar: app identity + session summary, the capture controls
// (Choose/Reload or the remote address box), and the theme toggle.
export function Header({
  session,
  counts,
  base,
  setBase,
  onLoad,
  onChoose,
}: {
  session: Session | null;
  counts: { http: number; udp: number };
  base: string;
  setBase: (b: string) => void;
  onLoad: () => void;
  onChoose: () => void;
}) {
  const { theme, mode, cycleMode } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: "800" }}>GoTapView</Text>
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
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
            fontSize: 12,
            fontFamily: theme.monoFont,
          }}
        />
      )}
      {isEmbedded && (
        <Pressable onPress={onChoose} style={btn(theme.surfaceAlt)}>
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 12 }}>Choose capture…</Text>
        </Pressable>
      )}
      <Pressable onPress={onLoad} style={btn(theme.accent)}>
        <Text style={{ color: theme.accentText, fontWeight: "700", fontSize: 12 }}>{isEmbedded ? "Reload" : "Load"}</Text>
      </Pressable>
      <Pressable onPress={cycleMode} style={[btn(theme.surfaceAlt), { paddingHorizontal: 10 }]} accessibilityLabel={`theme: ${mode}`}>
        <Text style={{ color: theme.text, fontSize: 14 }}>{MODE_ICON[mode]}</Text>
      </Pressable>
    </View>
  );
}

const btn = (bg: string) => ({
  backgroundColor: bg,
  borderRadius: 6,
  paddingHorizontal: 12,
  paddingVertical: 7,
  justifyContent: "center" as const,
});
