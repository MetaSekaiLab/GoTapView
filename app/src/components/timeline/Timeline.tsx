import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SectionList,
  Text,
  View,
} from "react-native";
import { TapEvent } from "../../types";
import { useTheme } from "../../theme";
import { Section } from "../../model/group";
import { GroupMode } from "../../model/group";
import { TimelineRow, ROW_HEIGHT } from "./TimelineRow";

// Report of the current scroll position, for the minimap viewport indicator.
export interface Viewport {
  offsetRatio: number; // top of viewport / total content
  visibleRatio: number; // viewport height / total content
}

export interface TimelineHandle {
  scrollToFlatIndex: (i: number) => void;
}

interface Props {
  flat: TapEvent[]; // ordered events currently shown (for minimap mapping)
  sections: Section[];
  groupMode: GroupMode;
  t0: number;
  selectedSeq: number | null;
  query: string;
  onSelect: (e: TapEvent) => void;
  onViewport: (v: Viewport) => void;
}

const STICKY = true; // RN-Web 0.21 sticky headers can be flaky; flip to disable.

export const Timeline = forwardRef<TimelineHandle, Props>(function Timeline(
  { flat, sections, groupMode, t0, selectedSeq, query, onSelect, onViewport },
  ref,
) {
  const { theme } = useTheme();
  const flatRef = useRef<FlatList<TapEvent>>(null);
  const sectionRef = useRef<SectionList<TapEvent, Section>>(null);
  const grouped = groupMode !== "none";

  // Map a flat event index to its (section, item) position for grouped scroll.
  const locate = useMemo(() => {
    const map: Array<{ s: number; i: number }> = [];
    sections.forEach((sec, s) => sec.data.forEach((_, i) => map.push({ s, i })));
    return map;
  }, [sections]);

  useImperativeHandle(ref, () => ({
    scrollToFlatIndex(i: number) {
      const idx = Math.max(0, Math.min(i, flat.length - 1));
      if (!grouped) {
        flatRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      } else {
        const loc = locate[idx];
        if (loc) sectionRef.current?.scrollToLocation({ sectionIndex: loc.s, itemIndex: loc.i, animated: false, viewOffset: 40 });
      }
    },
  }));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const total = Math.max(contentSize.height, 1);
    onViewport({ offsetRatio: contentOffset.y / total, visibleRatio: layoutMeasurement.height / total });
  };

  const renderRow = (item: TapEvent) => (
    <TimelineRow
      e={item}
      t0={t0}
      selected={item.seq === selectedSeq}
      query={query}
      onPress={() => onSelect(item)}
    />
  );

  const SectionHeader = ({ section }: { section: Section }) => {
    if (!section.title) return null;
    return (
      <View style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: "700" }}>
          {section.title}
          <Text style={{ color: theme.dim, fontWeight: "400" }}>  {section.data.length}</Text>
        </Text>
        {section.subtitle ? <Text style={{ color: theme.dim, fontSize: 10.5, fontFamily: theme.monoFont }}>{section.subtitle}</Text> : null}
      </View>
    );
  };

  if (!grouped) {
    return (
      <FlatList
        ref={flatRef}
        data={flat}
        keyExtractor={(e, i) => `${e.seq}-${i}`}
        renderItem={({ item }) => renderRow(item)}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        initialNumToRender={40}
        windowSize={11}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.35 }} />}
      />
    );
  }

  return (
    <SectionList
      ref={sectionRef}
      sections={sections}
      keyExtractor={(e, i) => `${e.seq}-${i}`}
      renderItem={({ item }) => renderRow(item)}
      renderSectionHeader={SectionHeader}
      stickySectionHeadersEnabled={STICKY}
      initialNumToRender={40}
      windowSize={11}
      onScroll={onScroll}
      scrollEventThrottle={16}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.35 }} />}
    />
  );
});
