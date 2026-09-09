import { useMemo } from "react";
import { Session } from "../../types";
import { Section, Badge } from "../primitives";
import { analyze, Count, Overview as OverviewData } from "../../model/analyze";
import { cssVar, Tone } from "../../theme/ThemeProvider";

// Overview summarises the whole capture: timespan, protocol mix, command and
// message histograms, the Diarkis key issuance point, and who was in the room
// (nickname paired with uid).
export function Overview({ session }: { session: Session }) {
  const o = useMemo<OverviewData>(() => analyze(session), [session]);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-bg p-3.5 pb-12">
      <div className="mb-0.5 text-[15px] font-extrabold text-text">{session.meta.file}</div>
      <div className="mb-3.5 font-mono text-xs text-dim">
        {o.records} records · {o.flows} flows · {fmtDuration(o.span.durationMs)}
        {o.truncated ? " · truncated" : ""}
      </div>

      <Section title="Protocol mix">
        <StatRow label="HTTP" value={o.protocol.http} tone="http" />
        <StatRow label="UDP frames" value={o.protocol.udpFrames} tone="c2s" />
        <StatRow label="UDP control" value={o.protocol.udpControl} tone="ctrl" />
        {o.protocol.nonDiarkis > 0 && <StatRow label="non-Diarkis" value={o.protocol.nonDiarkis} tone="dim" />}
      </Section>

      <Section title="Diarkis session">
        <div className="mb-1.5 flex flex-wrap gap-2">
          <Badge label={`${o.diarkisKeys} key${o.diarkisKeys === 1 ? "" : "s"}`} tone="key" />
          {o.keyPoint && <Badge label={`key @ seq ${o.keyPoint.seq} · ${(o.keyPoint.relMs / 1000).toFixed(2)}s`} tone="key" />}
        </div>
        {o.players.length > 0 && (
          <div>
            <div className="mb-1.5 mt-1 text-[11px] text-dim">players seen ({o.players.length})</div>
            <div className="flex flex-col gap-1">
              {o.players.map((p) => (
                <div key={p.uid} className="flex items-center gap-2 rounded-md bg-surface-alt px-2 py-1">
                  <span className={`min-w-0 flex-shrink truncate text-xs ${p.name ? "font-semibold text-text" : "text-dim"}`}>
                    {p.name ?? "(unknown)"}
                  </span>
                  <div className="flex-1" />
                  <span className="select-text font-mono text-[11px] text-dim">{p.uid}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {o.cmds.length > 0 && (
        <Section title="Commands">
          <Histogram counts={o.cmds} tone="c2s" />
        </Section>
      )}
      {o.msgTypes.length > 0 && (
        <Section title="Broadcast messages">
          <Histogram counts={o.msgTypes} tone="accent" />
        </Section>
      )}
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cssVar(tone) }} />
      <span className="flex-1 text-[12.5px] text-text">{label}</span>
      <span className="font-mono text-[12.5px] text-mono">{value}</span>
    </div>
  );
}

function Histogram({ counts, tone }: { counts: Count[]; tone: Tone }) {
  const max = Math.max(...counts.map((c) => c.count), 1);
  return (
    <div className="flex flex-col gap-1.5">
      {counts.map((c) => (
        <div key={c.key} className="flex items-center gap-2">
          <span className="w-[118px] truncate font-mono text-[11.5px] text-text">{c.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-surface-alt">
            <div className="h-full" style={{ width: `${(c.count / max) * 100}%`, backgroundColor: cssVar(tone, 0.8) }} />
          </div>
          <span className="w-10 text-right font-mono text-[11px] text-dim">{c.count}</span>
        </div>
      ))}
    </div>
  );
}

function fmtDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}
