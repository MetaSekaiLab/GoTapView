import { Chip } from "../primitives";
import { FacetValue } from "../../model/facets";
import { Tone } from "../../theme/ThemeProvider";

// FacetSelect renders a labelled row of toggle chips for one facet.
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
  tone?: Tone;
  onToggle: (v: T) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="w-[62px] pt-1 text-[11px] font-bold text-dim">{title}</span>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {values.map((v) => (
          <Chip
            key={String(v.value)}
            label={v.label}
            count={v.count}
            tone={tone}
            active={selected.has(v.value)}
            onClick={() => onToggle(v.value)}
          />
        ))}
      </div>
    </div>
  );
}
