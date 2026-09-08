import React from "react";
import { Text, StyleSheet } from "react-native";
import { C } from "../theme";

// HexView renders a hex string as a classic offset/hex/ascii dump, capped so a
// huge blob does not lock up the list.
export function HexView({ hex, max = 512 }: { hex: string; max?: number }) {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length && bytes.length < max; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  const lines: string[] = [];
  for (let off = 0; off < bytes.length; off += 16) {
    const chunk = bytes.slice(off, off + 16);
    const hexPart = chunk.map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(16 * 3 - 1, " ");
    const ascii = chunk.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${off.toString(16).padStart(6, "0")}  ${hexPart}  ${ascii}`);
  }
  const truncated = hex.length / 2 > max;
  return (
    <Text style={styles.hex} selectable>
      {lines.join("\n")}
      {truncated ? `\n… ${hex.length / 2 - max} more bytes` : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  hex: {
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 11.5,
    color: C.dim,
    lineHeight: 16,
  },
});
