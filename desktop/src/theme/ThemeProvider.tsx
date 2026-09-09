import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type Scheme = "light" | "dark";

interface ThemeCtx {
  mode: ThemeMode;
  resolved: Scheme;
  setMode: (m: ThemeMode) => void;
  cycleMode: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const KEY = "gtv.theme.mode";
const CYCLE: ThemeMode[] = ["system", "light", "dark"];

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage blocked */
  }
  return "system";
}

function systemScheme(): Scheme {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [sys, setSys] = useState<Scheme>(systemScheme);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSys(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Scheme = mode === "system" ? sys : mode;

  // Reflect the resolved scheme onto <html> so the CSS variables switch.
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((cur) => {
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ mode, resolved, setMode, cycleMode }), [mode, resolved, setMode, cycleMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme outside ThemeProvider");
  return c;
}

// Semantic colour names that map to the CSS variables in index.css.
export type Tone =
  | "http" | "c2s" | "s2c" | "ctrl" | "accent" | "warn" | "bad" | "key"
  | "room" | "player" | "text" | "dim" | "border" | "surface" | "surfaceAlt";

const VAR: Record<Tone, string> = {
  http: "--http", c2s: "--c2s", s2c: "--s2c", ctrl: "--ctrl", accent: "--accent",
  warn: "--warn", bad: "--bad", key: "--key", room: "--room", player: "--player",
  text: "--text", dim: "--dim", border: "--border", surface: "--surface", surfaceAlt: "--surface-alt",
};

// cssVar returns an rgb() string for inline styles, optionally with alpha.
export function cssVar(tone: Tone, alpha?: number): string {
  const v = `var(${VAR[tone]})`;
  return alpha === undefined ? `rgb(${v})` : `rgb(${v} / ${alpha})`;
}
