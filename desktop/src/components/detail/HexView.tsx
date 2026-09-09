// HexView renders a hex string as a classic offset / hex / ascii dump, capped so
// a huge blob does not lock up the view.
export function HexView({ hex, max = 512 }: { hex: string; max?: number }) {
  const bytes: number[] = [];
  for (let i = 0; i + 1 < hex.length && bytes.length < max; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  const lines: string[] = [];
  for (let off = 0; off < bytes.length; off += 16) {
    const chunk = bytes.slice(off, off + 16);
    const hexPart = chunk
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(16 * 3 - 1, " ");
    const ascii = chunk.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${off.toString(16).padStart(6, "0")}  ${hexPart}  ${ascii}`);
  }
  const truncated = hex.length / 2 > max;
  return (
    <pre className="whitespace-pre font-mono text-[11.5px] leading-4 text-dim">
      {lines.join("\n")}
      {truncated ? `\n… ${hex.length / 2 - max} more bytes` : ""}
    </pre>
  );
}
