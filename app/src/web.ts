import { Platform } from "react-native";

// Web-only global styling that react-native-web does not provide, to make the
// app feel like a standard web app: a pointer cursor and a smooth hover
// transition on buttons, tidy thin scrollbars, an accent text-selection colour,
// antialiased text, and no tap-highlight / overscroll bounce. Injected once.
const CSS = `
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
    -webkit-tap-highlight-color: transparent;
  }
  /* Interactive elements get the standard pointer + a gentle transition. */
  [role="button"], [role="tab"], [role="switch"], [data-pressable="true"] {
    cursor: pointer;
    transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease;
    user-select: none;
    -webkit-user-select: none;
  }
  [role="button"]:focus-visible, [role="tab"]:focus-visible {
    outline: 2px solid rgba(124, 92, 255, 0.7);
    outline-offset: 2px;
  }
  /* Thin, unobtrusive scrollbars. */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb {
    background: rgba(128, 138, 152, 0.4);
    border-radius: 6px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  ::-webkit-scrollbar-thumb:hover { background: rgba(128, 138, 152, 0.65); background-clip: padding-box; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::selection { background: rgba(124, 92, 255, 0.35); }
`;

export function injectGlobalStyles(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("gtv-global")) return;
  const el = document.createElement("style");
  el.id = "gtv-global";
  el.textContent = CSS;
  document.head.appendChild(el);
}
