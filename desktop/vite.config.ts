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
      preload: {
        input: "electron/preload.ts",
        // The plugin emits CommonJS (require) content; give it a .cjs name so
        // Electron loads it as CJS. A .mjs name makes Electron treat require as
        // ESM → "require is not defined" → the bridge never installs.
        vite: {
          build: {
            rollupOptions: {
              output: { format: "cjs", entryFileNames: "preload.cjs" },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  build: { outDir: "dist" },
  clearScreen: false,
});
