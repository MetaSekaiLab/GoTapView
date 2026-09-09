import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import { Scheme, Theme, ThemeMode, themeFor } from "./tokens";
import { KEYS, get, set } from "../storage";

// The theme context exposes the resolved Theme plus the user's mode choice and
// a setter. mode is "system" | "light" | "dark"; when "system" we follow the OS
// appearance live via the Appearance API (which react-native-web bridges to
// prefers-color-scheme, so it also works inside the WKWebView).

export interface ThemeCtx {
  theme: Theme;
  mode: ThemeMode;
  resolved: Scheme;
  setMode: (m: ThemeMode) => void;
  cycleMode: () => void;
}

export const ThemeContext = createContext<ThemeCtx | null>(null);

function readMode(): ThemeMode {
  const v = get(KEYS.themeMode);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function systemScheme(): Scheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

const CYCLE: ThemeMode[] = ["system", "light", "dark"];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read the persisted mode synchronously so the very first paint is correct.
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [sysScheme, setSysScheme] = useState<Scheme>(systemScheme);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSysScheme(colorScheme === "dark" ? "dark" : "light"),
    );
    return () => sub.remove();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    set(KEYS.themeMode, m);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((cur) => {
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      set(KEYS.themeMode, next);
      return next;
    });
  }, []);

  const resolved: Scheme = mode === "system" ? sysScheme : mode;
  const value = useMemo<ThemeCtx>(
    () => ({ theme: themeFor(resolved), mode, resolved, setMode, cycleMode }),
    [resolved, mode, setMode, cycleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
