import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In dev the renderer is served by Vite; in production it is the built bundle.
const DEV_URL = process.env.VITE_DEV_SERVER_URL;
// dist-electron/ (main) sits next to dist/ (renderer) in the build output.
const RENDERER_HTML = path.join(__dirname, "../dist/index.html");

// The Go decoder binary is bundled as an extra resource in production and lives
// under desktop/resources during development.
function sidecarPath(): string {
  const name = "tapview";
  if (app.isPackaged) return path.join(process.resourcesPath, name);
  return path.join(__dirname, "../resources", name);
}

let lastPath: string | null = null;
let win: BrowserWindow | null = null;

// decodeCapture runs the Go sidecar and parses its stdout JSON into a Session.
async function decodeCapture(file: string): Promise<unknown> {
  const bin = sidecarPath();
  try {
    chmodSync(bin, 0o755);
  } catch {
    // best effort; packaged resources are already executable
  }
  const { stdout } = await execFileP(bin, ["-f", file, "-json", "-", "-no-serve"], {
    maxBuffer: 256 * 1024 * 1024, // sessions can be tens of MB
  });
  lastPath = file;
  return JSON.parse(stdout);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    title: "GoTapView",
    backgroundColor: "#0f1216",
    // Immersive title bar: no native title strip, the web content reaches the
    // top, and the traffic lights are placed to sit centred in the custom
    // header (HEADER_H = 52 → (52-16)/2 = 18).
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(RENDERER_HTML);
  }
}

// --- IPC: the entire renderer↔native surface, exposed via preload ---

ipcMain.handle("capture:open", async () => {
  const res = await dialog.showOpenDialog(win!, {
    title: "Open capture",
    filters: [{ name: "GoTapline capture", extensions: ["tap"] }],
    properties: ["openFile"],
  });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

ipcMain.handle("capture:decode", async (_e, file: string) => decodeCapture(file));

ipcMain.handle("capture:reload", async () => {
  if (!lastPath) return null;
  return decodeCapture(lastPath);
});

// A file passed on the command line or via macOS "open with".
let openWithPath: string | null = null;
ipcMain.handle("capture:argv", async () => openWithPath);

app.on("open-file", (e, p) => {
  e.preventDefault();
  openWithPath = p;
  if (win) win.webContents.send("capture:openExternal", p);
});

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: "appMenu" as const }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "Open Capture…",
          accelerator: "CmdOrCtrl+O",
          click: () => win?.webContents.send("menu:open"),
        },
        {
          label: "Reload Capture",
          accelerator: "CmdOrCtrl+R",
          click: () => win?.webContents.send("menu:reload"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  const argPath = process.argv.find((a) => a.endsWith(".tap"));
  if (argPath) openWithPath = argPath;
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
