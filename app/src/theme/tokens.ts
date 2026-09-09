// Semantic design tokens for GoTapView, in a light and a dark palette. Every
// component reads colours through these tokens (via useTheme / makeStyles) so
// the app renders correctly in both macOS appearances. There is no static
// colour object any more — the two palettes below are the single source.
//
// The two palette objects are module-level and stable, which lets makeStyles
// cache a StyleSheet per theme identity (two StyleSheet.create calls total).

export type Scheme = "light" | "dark";
export type ThemeMode = "system" | "light" | "dark";

export interface Theme {
  scheme: Scheme;
  // structure
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  dim: string;
  accent: string;
  accentText: string; // text on top of an accent fill
  // transport lanes (HTTP / UDP direction / control)
  lane: { http: string; udpC2S: string; udpS2C: string; ctrl: string };
  // status
  warn: string;
  bad: string;
  key: string;
  // property-bag kinds
  prop: { room: string; player: string };
  // JSON / value syntax
  syntax: { str: string; num: string; bool: string; null: string; tag: string; key: string };
  mono: string;
  // one place for the monospace font stack
  monoFont: string;
}

const MONO = "ui-monospace, Menlo, Consolas, monospace";

export const dark: Theme = {
  scheme: "dark",
  bg: "#0f1216",
  surface: "#171b21",
  surfaceAlt: "#1d222a",
  border: "#2a313b",
  text: "#e6e9ee",
  dim: "#8b95a3",
  accent: "#a371f7",
  accentText: "#ffffff",
  lane: { http: "#4aa3ff", udpC2S: "#43c59e", udpS2C: "#7ee787", ctrl: "#6b7482" },
  warn: "#f0a04b",
  bad: "#ff6b6b",
  key: "#e3b341",
  prop: { room: "#4aa3ff", player: "#43c59e" },
  syntax: { str: "#7ee787", num: "#4aa3ff", bool: "#f0a04b", null: "#8b95a3", tag: "#e3b341", key: "#a371f7" },
  mono: "#c9d1d9",
  monoFont: MONO,
};

export const light: Theme = {
  scheme: "light",
  bg: "#f6f7f9",
  surface: "#ffffff",
  surfaceAlt: "#eef0f3",
  border: "#d8dce1",
  text: "#1b1f24",
  dim: "#616b78",
  accent: "#7c3aed",
  accentText: "#ffffff",
  lane: { http: "#1d6fe0", udpC2S: "#0f9d78", udpS2C: "#2e8b4f", ctrl: "#8a929e" },
  warn: "#b5710f",
  bad: "#d13b3b",
  key: "#9a6f00",
  prop: { room: "#1d6fe0", player: "#0f9d78" },
  syntax: { str: "#0a7d33", num: "#1d6fe0", bool: "#b5710f", null: "#8a929e", tag: "#9a6f00", key: "#7c3aed" },
  mono: "#2b2f36",
  monoFont: MONO,
};

export const themeFor = (s: Scheme): Theme => (s === "dark" ? dark : light);
