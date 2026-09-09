// Tiny synchronous key/value store over localStorage, guarded so it is safe in
// any environment (SSR, a WebView with storage disabled). All GoTapView UI
// preferences live under the gtv.* namespace.
//
// Caveat: the embedded desktop app is served from 127.0.0.1:<port> and
// localStorage is partitioned by origin including the port. The app pins a
// stable port so these survive relaunches; if the port ever falls back to a
// random one, preferences are simply per-session.

export const KEYS = {
  themeMode: "gtv.theme.mode",
  splitRatio: "gtv.split.ratio",
  groupMode: "gtv.group.mode",
  overviewPinned: "gtv.overview.pinned",
} as const;

function ls(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // access can throw when storage is blocked
  }
  return null;
}

export function get(key: string): string | null {
  try {
    return ls()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function set(key: string, value: string): void {
  try {
    ls()?.setItem(key, value);
  } catch {
    // ignore quota / disabled storage
  }
}

// getNum reads a stored float, falling back when absent or unparseable.
export function getNum(key: string, fallback: number): number {
  const v = get(key);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
