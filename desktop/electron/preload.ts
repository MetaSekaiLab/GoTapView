import { contextBridge, ipcRenderer } from "electron";

// The only bridge between the sandboxed renderer and the native side. The
// renderer calls window.gotap.* and receives menu/open-with events; it has no
// direct Node/fs access.
const api = {
  openCapture: (): Promise<string | null> => ipcRenderer.invoke("capture:open"),
  decode: (file: string): Promise<unknown> => ipcRenderer.invoke("capture:decode", file),
  reload: (): Promise<unknown> => ipcRenderer.invoke("capture:reload"),
  argvPath: (): Promise<string | null> => ipcRenderer.invoke("capture:argv"),
  onMenuOpen: (cb: () => void) => sub("menu:open", cb),
  onMenuReload: (cb: () => void) => sub("menu:reload", cb),
  onOpenExternal: (cb: (path: string) => void) => sub("capture:openExternal", (_e, p) => cb(p)),
};

function sub(channel: string, cb: (...args: any[]) => void): () => void {
  const listener = (_e: unknown, ...args: any[]) => cb(_e, ...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("gotap", api);

export type GotapApi = typeof api;
