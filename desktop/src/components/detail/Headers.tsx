// Headers renders an HTTP header map as monospace key: value lines.
export function Headers({ h }: { h?: Record<string, string> }) {
  if (!h) return null;
  return (
    <div>
      {Object.entries(h).map(([k, v]) => (
        <div key={k} className="break-all font-mono text-xs leading-[17px] text-mono">
          <span className="text-dim">{k}: </span>
          {v}
        </div>
      ))}
    </div>
  );
}
