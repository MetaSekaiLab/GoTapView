import React, { useMemo, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, Pressable, View } from "react-native";
import { TapEvent } from "../../types";
import { useTheme, Theme } from "../../theme";
import { Viewport } from "./Timeline";

// Minimap draws event density over the list (one bin per few rows) as stacked
// colour segments — HTTP / C→S / S→C / control — with a translucent viewport
// indicator. Clicking scrolls the list to that point. Its vertical axis matches
// the list's scroll axis (row index), so the indicator lines up with the bins.
type Bucket = { http: number; c2s: number; s2c: number; ctrl: number };

function toneOf(t: Theme, e: TapEvent): keyof Bucket {
  if (e.kind === "http") return "http";
  if (e.udp?.data?.frame) return e.udp.dir === "c2s" ? "c2s" : "s2c";
  return "ctrl";
}

const BIN_PX = 4;

export function Minimap({
  flat,
  viewport,
  onSeek,
}: {
  flat: TapEvent[];
  viewport: Viewport;
  onSeek: (flatIndex: number) => void;
}) {
  const { theme } = useTheme();
  const [h, setH] = useState(0);
  // Measure THIS element (it stretches to the full pane height in the row), not
  // an inner content view whose height would collapse to the bins it holds.
  const onLayout = (e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height);
  const nBins = Math.max(1, Math.floor(h / BIN_PX));

  const bins = useMemo(() => {
    const arr: Bucket[] = Array.from({ length: nBins }, () => ({ http: 0, c2s: 0, s2c: 0, ctrl: 0 }));
    const n = flat.length;
    if (n === 0) return arr;
    flat.forEach((e, i) => {
      const b = Math.min(nBins - 1, Math.floor((i / n) * nBins));
      arr[b][toneOf(theme, e)]++;
    });
    return arr;
  }, [flat, nBins, theme]);

  const max = useMemo(() => Math.max(1, ...bins.map((b) => b.http + b.c2s + b.s2c + b.ctrl)), [bins]);

  const seek = (ev: GestureResponderEvent) => {
    if (h <= 0 || flat.length === 0) return;
    const y = ev.nativeEvent.locationY;
    const idx = Math.max(0, Math.min(flat.length - 1, Math.round((y / h) * flat.length)));
    onSeek(idx);
  };

  return (
    <Pressable
      onPress={seek}
      onLayout={onLayout}
      accessibilityRole="button"
      style={{
        width: 46,
        alignSelf: "stretch",
        backgroundColor: theme.surface,
        borderLeftWidth: 1,
        borderLeftColor: theme.border,
      }}
    >
      {h > 0 &&
        bins.map((b, i) => {
          const total = b.http + b.c2s + b.s2c + b.ctrl;
          const w = (n: number) => `${(n / max) * 100}%` as const;
          return (
            <View key={i} style={{ height: BIN_PX, flexDirection: "row", opacity: total ? 1 : 0 }}>
              <View style={{ width: w(b.http), backgroundColor: theme.lane.http }} />
              <View style={{ width: w(b.c2s), backgroundColor: theme.lane.udpC2S }} />
              <View style={{ width: w(b.s2c), backgroundColor: theme.lane.udpS2C }} />
              <View style={{ width: w(b.ctrl), backgroundColor: theme.lane.ctrl }} />
            </View>
          );
        })}
      {/* viewport indicator */}
      {h > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${Math.max(0, Math.min(1, viewport.offsetRatio)) * 100}%`,
            height: `${Math.max(0.03, Math.min(1, viewport.visibleRatio)) * 100}%`,
            backgroundColor: theme.text + "22",
            borderColor: theme.text + "66",
            borderTopWidth: 1,
            borderBottomWidth: 1,
          }}
        />
      )}
    </Pressable>
  );
}
