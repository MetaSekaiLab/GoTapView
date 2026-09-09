import { useState } from "react";

// JsonTree renders a decoded value as a collapsible tree, giving readable
// treatment to the wrappers the decoder emits:
//   { __sync__, v }           a Diarkis SyncData typed value
//   { __msgpack__, __hex__ }  a bin blob that was itself MessagePack
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function scalar(v: unknown): { text: string; cls: string } {
  if (v === null) return { text: "null", cls: "text-syn-null" };
  if (typeof v === "number") return { text: String(v), cls: "text-syn-num" };
  if (typeof v === "boolean") return { text: String(v), cls: "text-syn-bool" };
  if (typeof v === "string") return { text: `"${v}"`, cls: "text-syn-str" };
  return { text: String(v), cls: "text-syn-str" };
}

export function JsonNode({ name, value, depth = 0 }: { name?: string; value: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (isObj(value) && "__sync__" in value) {
    const t = value.__sync__ as string;
    const v = (value as any).v;
    if (t === "msgpack") return <JsonNode name={name ? `${name} (msgpack)` : "msgpack"} value={v} depth={depth} />;
    const s = scalar(v);
    return (
      <div className="font-mono text-[12.5px] leading-[18px] text-mono">
        {name !== undefined && <span className="text-syn-key">{name}: </span>}
        <span className="text-syn-tag">{t} </span>
        <span className={s.cls}>{s.text}</span>
      </div>
    );
  }
  if (isObj(value) && "__msgpack__" in value) {
    return <JsonNode name={name ? `${name} (bin)` : "bin"} value={(value as any).__msgpack__} depth={depth} />;
  }
  if (!isObj(value) && !Array.isArray(value)) {
    const s = scalar(value);
    return (
      <div className="font-mono text-[12.5px] leading-[18px] text-mono">
        {name !== undefined && <span className="text-syn-key">{name}: </span>}
        <span className={s.cls}>{s.text}</span>
      </div>
    );
  }

  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const brace = Array.isArray(value) ? ["[", "]"] : ["{", "}"];

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="block text-left font-mono text-[12.5px] leading-[18px] text-dim"
      >
        <span>{open ? "▾ " : "▸ "}</span>
        {name !== undefined && <span className="text-syn-key">{name}: </span>}
        <span className="text-dim">
          {brace[0]}
          {!open && <span className="text-dim">{entries.length}</span>}
          {!open && brace[1]}
        </span>
      </button>
      {open && (
        <div className="ml-2.5 border-l border-border pl-2">
          {entries.map(([k, v]) => (
            <JsonNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <div className="font-mono text-[12.5px] text-dim">{brace[1]}</div>
        </div>
      )}
    </div>
  );
}
