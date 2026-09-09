import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";
import { Chip } from "../primitives";
import { FacetValue } from "../../model/facets";

// FacetSelect renders a labelled row of toggle chips for one facet. Selecting a
// value adds it to the constraint set; an empty set means "no constraint".
export function FacetSelect<T extends string | number>({
  title,
  values,
  selected,
  tone,
  onToggle,
}: {
  title: string;
  values: FacetValue<T>[];
  selected: Set<T>;
  tone?: string;
  onToggle: (v: T) => void;
}) {
  const { theme } = useTheme();
  if (values.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 3 }}>
      <Text style={{ width: 62, color: theme.dim, fontSize: 11, fontWeight: "700", paddingTop: 4 }}>{title}</Text>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {values.map((v) => (
          <Chip
            key={String(v.value)}
            label={v.label}
            count={v.count}
            tone={tone}
            active={selected.has(v.value)}
            onPress={() => onToggle(v.value)}
          />
        ))}
      </View>
    </View>
  );
}
