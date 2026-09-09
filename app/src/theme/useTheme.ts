import { useContext } from "react";
import { ThemeContext, ThemeCtx } from "./ThemeProvider";

// useTheme returns the active theme and mode controls. It throws if used
// outside a ThemeProvider, which only happens through a wiring mistake.
export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
