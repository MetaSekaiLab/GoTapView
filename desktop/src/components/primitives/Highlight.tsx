import { matchRanges } from "../../model/search";

// Highlight renders text with case-insensitive matches of `query` emphasised.
// With no query it is plain text, so callers pay nothing when the filter is empty.
export function Highlight({ text, query, className }: { text: string; query: string; className?: string }) {
  const ranges = query ? matchRanges(text, query) : [];
  if (ranges.length === 0) return <span className={className}>{text}</span>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  ranges.forEach(([s, e], i) => {
    if (s > last) parts.push(text.slice(last, s));
    parts.push(
      <mark key={i} className="rounded-[2px] bg-key/40 text-text">
        {text.slice(s, e)}
      </mark>,
    );
    last = e;
  });
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}
