import React, { useCallback, useRef, useState } from "react";
import { LayoutChangeEvent, Platform, View } from "react-native";
import { useTheme } from "../../theme";
import { KEYS, getNum, set } from "../../storage";

// Split lays two panes side by side with a draggable divider. The ratio (left
// pane fraction) persists. Dragging uses DOM pointer events on the window
// (web/WKWebView) rather than PanResponder, so it does not fight text selection
// in the panes; on native it is a fixed split (native is not a shipping target).
export function Split({
  left,
  right,
  minLeft = 320,
  minRight = 360,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  minLeft?: number;
  minRight?: number;
}) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(() => getNum(KEYS.splitRatio, 0.42));
  const drag = useRef<{ startX: number; startRatio: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const clamp = useCallback(
    (r: number) => {
      if (width <= 0) return r;
      const min = minLeft / width;
      const max = 1 - minRight / width;
      return Math.max(min, Math.min(max, r));
    },
    [width, minLeft, minRight],
  );

  const onPointerDown = useCallback(
    (e: any) => {
      if (Platform.OS !== "web") return;
      const clientX = e?.nativeEvent?.clientX ?? e?.clientX ?? 0;
      drag.current = { startX: clientX, startRatio: ratio };
      try {
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
      } catch {}
      const move = (ev: any) => {
        if (!drag.current || width <= 0) return;
        const dx = ev.clientX - drag.current.startX;
        setRatio(clamp(drag.current.startRatio + dx / width));
      };
      const up = () => {
        drag.current = null;
        try {
          document.body.style.userSelect = "";
          document.body.style.cursor = "";
        } catch {}
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        setRatio((r) => {
          set(KEYS.splitRatio, String(r));
          return r;
        });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [ratio, width, clamp],
  );

  const r = clamp(ratio);
  const webDivider = Platform.OS === "web" ? ({ onPointerDown, style: { cursor: "col-resize" } } as any) : {};

  return (
    <View style={{ flex: 1, flexDirection: "row" }} onLayout={onLayout}>
      <View style={{ width: width > 0 ? width * r : undefined, flex: width > 0 ? undefined : r }}>{left}</View>
      <View
        {...webDivider}
        style={[
          { width: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
          webDivider.style,
        ]}
      >
        <View style={{ width: 1, alignSelf: "stretch", backgroundColor: theme.border }} />
      </View>
      <View style={{ flex: 1 }}>{right}</View>
    </View>
  );
}
