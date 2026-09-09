import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";

// Vite drives the renderer (React) and, via vite-plugin-electron, also builds
// the Electron main + preload into dist-electron. In dev it launches Electron
// against the Vite dev server; `vite build` produces the packaged renderer +
// electron bundles that electron-builder wraps into a .app.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: { entry: "electron/main.ts" },
      preload: { input: "electron/preload.ts" },
      renderer: {},
    }),
  ],
  build: { outDir: "dist" },
  clearScreen: false,
});
