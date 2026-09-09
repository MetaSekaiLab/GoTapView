import type { Session } from "../types";

// The renderer talks to the native side only through window.gotap (preload).
// When running in a plain browser (Vite preview for screenshots/tests, no
// Electron) that bridge is absent, so we fall back to fetching a pre-decoded
// session from /sess.json — the same JSON the Go sidecar produces.
const bridge = () => (typeof window !== "undefined" ? window.gotap : undefined);

export const isElectron = (): boolean => !!bridge();

export async function openCapture(): Promise<string | null> {
  const b = bridge();
  if (b) return b.openCapture();
  return "/sess.json"; // browser fallback path
}

export async function decode(file: string): Promise<Session> {
  const b = bridge();
  if (b) return b.decode(file);
  const res = await fetch(file || "/sess.json");
  if (!res.ok) throw new Error(`could not load ${file}: ${res.status}`);
  return (await res.json()) as Session;
}

export async function reload(): Promise<Session | null> {
  const b = bridge();
  if (b) return b.reload();
  return decode("/sess.json");
}

export async function argvPath(): Promise<string | null> {
  const b = bridge();
  if (b) return b.argvPath();
  // Auto-load the fallback session in the browser so the UI has data to show.
  return "/sess.json";
}

export function onMenuOpen(cb: () => void): () => void {
  return bridge()?.onMenuOpen(cb) ?? (() => {});
}
export function onMenuReload(cb: () => void): () => void {
  return bridge()?.onMenuReload(cb) ?? (() => {});
}
export function onOpenExternal(cb: (p: string) => void): () => void {
  return bridge()?.onOpenExternal(cb) ?? (() => {});
}
