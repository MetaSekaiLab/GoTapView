import type { Session } from "./types";

// The preload bridge (electron/preload.ts). In a browser dev context (no
// Electron) window.gotap is undefined and the app falls back to a fetch.
export interface GotapApi {
  openCapture(): Promise<string | null>;
  decode(file: string): Promise<Session>;
  reload(): Promise<Session | null>;
  argvPath(): Promise<string | null>;
  onMenuOpen(cb: () => void): () => void;
  onMenuReload(cb: () => void): () => void;
  onOpenExternal(cb: (path: string) => void): () => void;
}

declare global {
  interface Window {
    gotap?: GotapApi;
  }
}
