import { Badge } from "../primitives";
import { JsonNode } from "./JsonTree";
import { PropKind, TYPE_NAME, lookup } from "../../model/props";
import { cssVar } from "../../theme/ThemeProvider";

// PropertyTable renders a Diarkis property bag ({ R, Values, __props__ }) as a
// labelled id · name · type · value table with a room/player badge. Keys the Go
// side left numeric (unknown) still render — nothing is hidden.
export function isPropertyBag(v: unknown): v is { R: unknown; Values: Record<string, unknown>; __props__: PropKind } {
  return (
    typeof v === "object" &&
    v !== null &&
    "__props__" in v &&
    ((v as any).__props__ === "room" || (v as any).__props__ === "player") &&
    typeof (v as any).Values === "object"
  );
}

export function PropertyTable({ bag }: { bag: { R: unknown; Values: Record<string, unknown>; __props__: PropKind } }) {
  const kind = bag.__props__;
  const tone = kind === "room" ? "room" : "player";
  const rows = Object.entries(bag.Values).sort((a, b) => idOf(kind, a[0]) - idOf(kind, b[0]));

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-surface-alt p-2">
        <Badge label={kind === "room" ? "RoomProperty" : "PlayerProperty"} tone={tone} />
        <span className="font-mono text-[11px] text-dim">
          R={renderR(bag.R)} · {rows.length} keys
        </span>
      </div>
      <div className="flex bg-surface px-2 py-1.5 text-[10.5px] font-bold tracking-wide text-dim">
        <div className="w-9">ID</div>
        <div className="flex-1">NAME</div>
        <div className="w-14">TYPE</div>
        <div className="flex-[1.4]">VALUE</div>
      </div>
      {rows.map(([name, val], i) => {
        const meta = lookup(kind, name);
        const type = syncType(val) ?? (meta ? TYPE_NAME[meta.type] : "?");
        return (
          <div
            key={name}
            className={`flex items-start border-t border-border px-2 py-1.5 ${i % 2 ? "bg-surface" : "bg-bg"}`}
          >
            <div className="w-9 font-mono text-xs text-dim">{meta ? meta.id : "·"}</div>
            <div className="flex-1 font-mono text-xs" style={{ color: meta ? cssVar(tone) : cssVar("text") }}>
              {name}
            </div>
            <div className="w-14 font-mono text-xs text-syn-tag">{type}</div>
            <div className="flex-[1.4]">
              <ValueCell val={val} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ValueCell({ val }: { val: unknown }) {
  const inner = val && typeof val === "object" && "__sync__" in (val as any) ? (val as any).v : val;
  if (inner !== null && typeof inner === "object") return <JsonNode value={inner} depth={1} />;
  const s =
    inner === null
      ? { t: "null", c: "text-syn-null" }
      : typeof inner === "number"
        ? { t: String(inner), c: "text-syn-num" }
        : typeof inner === "boolean"
          ? { t: String(inner), c: "text-syn-bool" }
          : { t: `"${inner}"`, c: "text-syn-str" };
  return <span className={`font-mono text-xs ${s.c}`}>{s.t}</span>;
}

function idOf(kind: PropKind, name: string): number {
  const m = lookup(kind, name);
  if (m) return m.id;
  const n = Number(name);
  return Number.isFinite(n) ? n : 9999;
}

function syncType(val: unknown): string | null {
  if (val && typeof val === "object" && "__sync__" in (val as any)) return String((val as any).__sync__);
  return null;
}

function renderR(r: unknown): string {
  if (r && typeof r === "object" && "v" in (r as any)) return String((r as any).v);
  return String(r);
}
