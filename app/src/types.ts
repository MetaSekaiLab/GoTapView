// Types mirroring the JSON produced by the Go `tapview` decoder
// (internal/session). Kept in one place so the UI has a single contract.

export interface Session {
  meta: Meta;
  flows: Flow[];
  events: TapEvent[];
}

export interface Meta {
  file: string;
  startedWall: number; // unix millis of capture start
  records: number;
  flows: number;
  truncated: boolean;
  diarkisKeys: number;
  httpEvents: number;
  udpEvents: number;
}

export interface Flow {
  id: number;
  proto: string; // "tcp" | "udp"
  mode: string;  // "tls-plaintext" | "tls-opaque" | "raw"
  client: string;
  remote: string;
  sni: string;
  packets: number;
}

export interface TapEvent {
  seq: number;
  tRelNs: number;
  wallMs: number;
  kind: "http" | "udp";
  flowId: number;
  remote: string;
  http?: HttpEvent;
  udp?: UdpEvent;
}

export interface HttpEvent {
  method: string;
  path: string;
  status: number;
  note?: string;
  reqHeaders?: Record<string, string>;
  respHeaders?: Record<string, string>;
  reqJson?: unknown;
  respJson?: unknown;
  reqBodyHex?: string;
  respBodyHex?: string;
  reqBodyText?: string;
  respBodyText?: string;
}

export interface UdpEvent {
  dir: "c2s" | "s2c";
  data?: Datagram;
  /** A datagram from a flow that is not Diarkis (NTP, DNS…), kept verbatim. */
  other?: OtherUdp;
}

export interface OtherUdp {
  bytes: number;
  hex: string;
}

export interface Datagram {
  wrapSeq: number;
  flag: string; // UDP | SYN | DAT | ACK | RST | EACK | FIN
  isRudp: boolean;
  /** Present when this datagram is a fragment of an oversized payload. */
  split?: SplitInfo;
  frame?: Frame;
  raw?: string; // hex of a non-frame body (e.g. the sid on SYN/ACK/FIN)
}

export interface SplitInfo {
  id: number;
  index: number;
  count: number;
  bytes: number;
  complete: boolean;
}

export interface Frame {
  ver: number;
  cmd: number;
  status?: number;
  recognized: boolean;
  decoded?: unknown;
  rawPayload?: string; // hex of the part that could not be decoded
}
