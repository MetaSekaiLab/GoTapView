import React from "react";
import { Text, TextStyle } from "react-native";
import { useTheme } from "../../theme";
import { matchRanges } from "../../model/search";

// Highlight renders text with case-insensitive matches of `query` visually
// emphasised. With no query it is a plain Text, so callers pay nothing when the
// filter box is empty.
export function Highlight({
  text,
  query,
  style,
  numberOfLines,
}: {
  text: string;
  query: string;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const { theme } = useTheme();
  const ranges = query ? matchRanges(text, query) : [];
  if (ranges.length === 0) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  const parts: React.ReactNode[] = [];
  let last = 0;
  ranges.forEach(([s, e], i) => {
    if (s > last) parts.push(text.slice(last, s));
    parts.push(
      <Text key={i} style={{ backgroundColor: theme.key + "55", color: theme.text }}>
        {text.slice(s, e)}
      </Text>,
    );
    last = e;
  });
  if (last < text.length) parts.push(text.slice(last));
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts}
    </Text>
  );
}
