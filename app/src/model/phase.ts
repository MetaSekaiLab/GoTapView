import { TapEvent } from "./../types";
import { firstBroadcast } from "./search";

// A session unfolds in phases. classifyPhase assigns each event one, carrying
// the previous phase forward for bare control frames so a stray ACK mid-game
// does not reset the timeline. First match wins.
export type Phase = "handshake" | "auth" | "lobby" | "room" | "gameplay" | "teardown";

export const PHASE_ORDER: Phase[] = ["handshake", "auth", "lobby", "room", "gameplay", "teardown"];

export const PHASE_LABEL: Record<Phase, string> = {
  handshake: "Handshake",
  auth: "Auth / key",
  lobby: "Lobby / match",
  room: "Room",
  gameplay: "Gameplay",
  teardown: "Teardown",
};

const CONTROL_FLAGS = new Set(["SYN", "ACK", "EACK", "RST", "FIN", "UDP"]);
const AUTH_HINT = /auth|token|login|diarkis-auth/i;

export function classifyPhase(e: TapEvent, prev: Phase | null): Phase {
  // HTTP: auth endpoints vs everything-else-before-room (lobby/match).
  if (e.http) {
    if (AUTH_HINT.test(e.http.path) || (e.http.note && AUTH_HINT.test(e.http.note))) return "auth";
    return prev && PHASE_ORDER.indexOf(prev) >= PHASE_ORDER.indexOf("room") ? prev : "lobby";
  }

  const d = e.udp?.data;
  if (!d) return prev ?? "handshake";
  const f = d.frame;

  // Transport-level frames name themselves via the decoder's kind.
  const kind = f && (f.decoded as any)?.kind;
  if (kind === "clientKey") return "auth";
  if (kind === "migrate") return "room";

  if (!f) {
    // A bare control datagram (SYN/ACK/FIN…). FIN/RST after gameplay = teardown;
    // otherwise carry the phase forward, defaulting to handshake at the start.
    if (d.flag === "FIN" || d.flag === "RST") {
      return prev && PHASE_ORDER.indexOf(prev) >= PHASE_ORDER.indexOf("gameplay") ? "teardown" : prev ?? "handshake";
    }
    if (CONTROL_FLAGS.has(d.flag)) return prev ?? "handshake";
    return prev ?? "handshake";
  }

  // Room membership frames.
  if (f.ver === 1 && (f.cmd === 101 || f.cmd === 102)) return "room";
  // Broadcasts + property deltas + other ver2 game commands = gameplay.
  if (f.ver === 1 && f.cmd === 103) return "gameplay";
  if (firstBroadcast(f.decoded)) return "gameplay";
  if (f.ver === 2) return "gameplay";
  return prev ?? "handshake";
}

// assignPhases returns the phase for each event, in order.
export function assignPhases(events: TapEvent[]): Phase[] {
  let prev: Phase | null = null;
  return events.map((e) => {
    const p = classifyPhase(e, prev);
    prev = p;
    return p;
  });
}
