import { ReactNode } from "react";

// InlineKV lays several small key/value pairs on one wrapping row.
export function InlineKV({ pairs }: { pairs: Array<[string, ReactNode]> }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-xs text-mono">
      {pairs.map(([k, v], i) => (
        <span key={i}>
          <span className="text-dim">{k} </span>
          {v}
        </span>
      ))}
    </div>
  );
}
