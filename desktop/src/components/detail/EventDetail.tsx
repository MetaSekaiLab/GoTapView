import { ReactNode } from "react";
import { TapEvent } from "../../types";
import { Section, InlineKV, Badge } from "../primitives";
import { JsonNode } from "./JsonTree";
import { HexView } from "./HexView";
import { Headers } from "./Headers";
import { PropertyTable, isPropertyBag } from "./PropertyTable";
import { cmdLabel } from "../../model/analyze";
import { Tone } from "../../theme/ThemeProvider";

// Decoded renders a frame's decoded payload, swapping any property bag (at any
// depth) for a PropertyTable while keeping the rest as a compact JSON tree.
function Decoded({ name, value, depth = 0 }: { name?: string; value: unknown; depth?: number }) {
  if (isPropertyBag(value)) {
    return (
      <div className="mb-2">
        {name !== undefined && <div className="mb-1 font-mono text-xs text-syn-key">{name}</div>}
        <PropertyTable bag={value} />
      </div>
    );
  }
  const container = (value && typeof value === "object") || Array.isArray(value);
  if (container && containsBag(value)) {
    const entries: [string, unknown][] = Array.isArray(value)
      ? value.map((v, i) => [String(i), v])
      : Object.entries(value as object);
    return (
      <div>
        {name !== undefined && <div className="font-mono text-xs text-syn-key">{name}:</div>}
        <div className={`flex flex-col gap-0.5 ${name !== undefined ? "ml-2.5" : ""}`}>
          {entries.map(([k, v]) => (
            <Decoded key={k} name={k} value={v} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }
  return <JsonNode name={name} value={value} depth={depth} />;
}

function containsBag(v: unknown): boolean {
  if (isPropertyBag(v)) return true;
  if (Array.isArray(v)) return v.some(containsBag);
  if (v && typeof v === "object") return Object.values(v).some(containsBag);
  return false;
}

function statusTone(status: number): Tone {
  if (!status) return "dim";
  if (status >= 500) return "bad";
  if (status >= 400) return "warn";
  return "http";
}

export function EventDetail({ e }: { e: TapEvent }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-bg p-3.5 pb-12">
      <div className="mb-3 font-mono text-xs text-dim">
        seq {e.seq} · flow {e.flowId} · {new Date(e.wallMs).toLocaleTimeString()} · {e.remote}
      </div>

      {e.http && (
        <>
          <Section
            title="Request line"
            accessory={<Badge label={`HTTP ${e.http.status || "—"}`} tone={statusTone(e.http.status)} />}
          >
            <div className="font-mono text-sm font-bold text-text">
              {e.http.method} {e.http.path}
            </div>
            {e.http.note ? <div className="mt-0.5 text-xs text-dim">[{e.http.note}]</div> : null}
          </Section>
          <Section title="Request headers">
            <Headers h={e.http.reqHeaders} />
          </Section>
          {renderBody("Request body", e.http.reqJson, e.http.reqBodyText, e.http.reqBodyHex)}
          <Section title="Response headers">
            <Headers h={e.http.respHeaders} />
          </Section>
          {renderBody("Response body", e.http.respJson, e.http.respBodyText, e.http.respBodyHex)}
        </>
      )}

      {e.udp?.other && (
        <>
          <Section title="Non-Diarkis UDP">
            <InlineKV pairs={[["dir", e.udp.dir], ["bytes", String(e.udp.other.bytes)]]} />
            <div className="mt-1 text-[11.5px] leading-4 text-dim">
              This flow carries no Diarkis frames, so it is kept verbatim rather than force-fitted.
            </div>
          </Section>
          <Section title="Payload (raw)">
            <HexView hex={e.udp.other.hex} />
          </Section>
        </>
      )}

      {e.udp?.data && (
        <>
          <Section title="Datagram">
            <InlineKV
              pairs={[
                ["dir", <Badge key="d" label={e.udp.dir === "c2s" ? "C→S" : "S→C"} tone={e.udp.dir === "c2s" ? "c2s" : "s2c"} />],
                ["flag", e.udp.data.flag],
                ["wrapSeq", String(e.udp.data.wrapSeq)],
              ]}
            />
          </Section>

          {e.udp.data.split && (
            <Section title="Oversized payload">
              <div className="font-mono text-[12.5px] text-mono">
                fragment {e.udp.data.split.index + 1} of {e.udp.data.split.count} · id {e.udp.data.split.id} ·{" "}
                {e.udp.data.split.complete
                  ? `reassembled ${e.udp.data.split.bytes} bytes`
                  : `${e.udp.data.split.bytes} bytes buffered`}
              </div>
            </Section>
          )}

          {e.udp.data.frame && (
            <Section
              title="Frame"
              accessory={
                <Badge
                  label={e.udp.data.frame.recognized ? "decoded" : "raw"}
                  tone={e.udp.data.frame.recognized ? "s2c" : "dim"}
                />
              }
            >
              <InlineKV
                pairs={[
                  ["ver", String(e.udp.data.frame.ver)],
                  ["cmd", `${e.udp.data.frame.cmd} (${cmdLabel(e.udp.data.frame.ver, e.udp.data.frame.cmd)})`],
                  ...(e.udp.data.frame.status !== undefined
                    ? ([["status", String(e.udp.data.frame.status)]] as Array<[string, ReactNode]>)
                    : []),
                ]}
              />
            </Section>
          )}
          {e.udp.data.frame?.decoded !== undefined && (
            <Section title="Decoded payload">
              <Decoded value={e.udp.data.frame.decoded} />
            </Section>
          )}
          {e.udp.data.frame?.rawPayload && (
            <Section title="Undecoded payload (raw)">
              <HexView hex={e.udp.data.frame.rawPayload} />
            </Section>
          )}
          {!e.udp.data.frame && e.udp.data.raw && (
            <Section title="Control body (raw)">
              <HexView hex={e.udp.data.raw} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function renderBody(title: string, json?: unknown, text?: string, hex?: string) {
  if (json !== undefined && json !== null) {
    return (
      <Section title={`${title} · decrypted JSON`}>
        <Decoded value={json} />
      </Section>
    );
  }
  if (text) {
    return (
      <Section title={title}>
        <div className="whitespace-pre-wrap break-all font-mono text-xs text-mono">{text}</div>
      </Section>
    );
  }
  if (hex) {
    return (
      <Section title={`${title} · raw`}>
        <HexView hex={hex} />
      </Section>
    );
  }
  return null;
}
