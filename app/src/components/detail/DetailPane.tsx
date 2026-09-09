import React from "react";
import { View, Text, Pressable } from "react-native";
import { Session, TapEvent } from "../../types";
import { useTheme } from "../../theme";
import { EventDetail } from "./EventDetail";
import { Overview } from "../overview/Overview";

// DetailPane is the docked right column. It shows the selected event, or the
// session Overview when nothing is selected (or when the overview is pinned).
export function DetailPane({
  event,
  session,
  onClear,
  showClose,
}: {
  event: TapEvent | null;
  session: Session | null;
  onClear?: () => void;
  showClose?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 14,
          paddingVertical: 9,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: "700" }}>
          {event ? "Event detail" : "Session overview"}
        </Text>
        {event && (showClose ?? true) && onClear && (
          <Pressable onPress={onClear}>
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "700" }}>✕</Text>
          </Pressable>
        )}
      </View>
      {event ? <EventDetail e={event} /> : session ? <Overview session={session} /> : null}
    </View>
  );
}
