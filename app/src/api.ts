import { Session } from "./types";

// Default endpoint. On the iOS simulator localhost reaches the Mac; on a real
// device set this to the Mac's LAN IP via the in-app settings field.
export const DEFAULT_BASE = "http://127.0.0.1:8787";

export async function fetchSession(base: string): Promise<Session> {
  const res = await fetch(`${base.replace(/\/$/, "")}/session`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`server returned ${res.status}`);
  return (await res.json()) as Session;
}
