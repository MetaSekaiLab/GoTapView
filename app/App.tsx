import React from "react";
import { ThemeProvider } from "./src/theme";
import { AppShell } from "./src/screens/AppShell";

// GoTapView UI root: install the theme, then hand off to the app shell which
// owns loading, filtering and the master-detail layout.
export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
