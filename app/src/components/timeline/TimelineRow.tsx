import React from "react";
import { View, Text, Pressable } from "react-native";
import { TapEvent } from "../../types";
import { useTheme, Theme } from "../../theme";
import { Highlight } from "../primitives";
import { summarize } from "../../summary";
import { eventMsgType } from "../../model/facets";

export const ROW_HEIGHT = 30;

// laneTone picks the colour that identifies an event's transport/direction.
function laneTone(t: Theme, e: TapEvent): string {
  if (e.kind === "http") return t.lane.http;
  if (e.udp?.data?.frame) return e.udp.dir === "c2s" ? t.lane.udpC2S : t.lane.udpS2C;
  return t.lane.ctrl;
}

function RowImpl({
  e,
  t0,
  selected,
  query,
  onPress,
}: {
  e: TapEvent;
  t0: number;
  selected: boolean;
  query: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const tone = laneTone(theme, e);
  const rel = ((e.wallMs - t0) / 1000).toFixed(3);
  const isHttp = e.kind === "http";
  const arrow = e.udp ? (e.udp.dir === "c2s" ? "→" : "←") : "·";
  const msgType = e.udp ? eventMsgType(e) : null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ hovered }: any) => (
        <View
          style={{
            height: ROW_HEIGHT,
            flexDirection: "row",
            alignItems: "center",
            paddingRight: 10,
            backgroundColor: selected ? tone + "22" : hovered ? theme.surfaceAlt : "transparent",
          }}
        >
          <View style={{ width: 3, alignSelf: "stretch", backgroundColor: selected ? tone : tone + "88" }} />
          <Text style={{ width: 60, textAlign: "right", color: theme.dim, fontSize: 11, fontFamily: theme.monoFont }}>
            {rel}
          </Text>
          <Text style={{ width: 16, textAlign: "center", color: tone, fontSize: 13 }}>{arrow}</Text>
          <Text style={{ width: 38, color: tone, fontSize: 10.5, fontWeight: "800", fontFamily: theme.monoFont }}>
            {isHttp ? "HTTP" : "UDP"}
          </Text>
          {msgType ? (
            <View
              style={{
                marginRight: 6,
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 4,
                backgroundColor: theme.accent + "22",
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 10, fontFamily: theme.monoFont }}>{msgType}</Text>
            </View>
          ) : null}
          <Highlight
            text={summarize(e)}
            query={query}
            numberOfLines={1}
            style={{ flex: 1, color: theme.text, fontSize: 12.5, fontFamily: theme.monoFont }}
          />
        </View>
      )}
    </Pressable>
  );
}

// Memoized so scrolling 960+ rows stays cheap; only the changed rows re-render.
export const TimelineRow = React.memo(RowImpl);
