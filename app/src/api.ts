import { Session } from "./types";

// Where the decoder API lives.
//
// In the packaged desktop app the UI is served by the same Go process, so a
// relative path works and is preferred. Standalone (Expo dev / device) it needs
// an absolute address, which the desktop build also passes as ?api=… .
function detectBase(): string {
  if (typeof window !== "undefined" && window.location) {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("api");
    if (fromQuery) return fromQuery;
    // Served from the Go binary itself: same origin.
    if (window.location.protocol.startsWith("http")) return window.location.origin;
  }
  return "http://127.0.0.1:8787";
}

export const DEFAULT_BASE = detectBase();

// isEmbedded reports whether the UI is being served by the Go app, in which
// case it can drive the native file picker.
export const isEmbedded =
  typeof window !== "undefined" &&
  !!window.location &&
  window.location.protocol.startsWith("http") &&
  !new URLSearchParams(window.location.search).get("standalone");

const trim = (b: string) => b.replace(/\/$/, "");

export class NoCapture extends Error {}

export async function fetchSession(base: string): Promise<Session> {
  const res = await fetch(`${trim(base)}/session`, { headers: { Accept: "application/json" } });
  if (res.status === 404) {
    let msg = "no capture loaded";
    try {
      msg = (await res.json())?.error ?? msg;
    } catch {}
    throw new NoCapture(msg);
  }
  if (!res.ok) throw new Error(`server returned ${res.status}`);
  return (await res.json()) as Session;
}

// pickCapture asks the Go side to show the native open dialog. Resolves to the
// chosen path, or null if the user cancelled.
export async function pickCapture(base: string): Promise<string | null> {
  const res = await fetch(`${trim(base)}/pick`, { method: "POST" });
  const j = await res.json();
  if (j.cancelled) return null;
  if (!j.ok) throw new Error(j.error ?? "could not open the file dialog");
  return j.path as string;
}

// reload re-decodes the currently loaded capture.
export async function reloadCapture(base: string): Promise<void> {
  const res = await fetch(`${trim(base)}/open`, { method: "POST" });
  const j = await res.json();
  if (!j.ok) throw new Error(j.error ?? "reload failed");
}
