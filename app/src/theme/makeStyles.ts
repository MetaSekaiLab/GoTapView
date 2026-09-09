import { StyleSheet } from "react-native";
import { Theme } from "./tokens";
import { useTheme } from "./useTheme";

// makeStyles builds a themed StyleSheet hook. Because the two palette objects
// are stable module-level identities, the WeakMap yields exactly one
// StyleSheet.create per theme for the app's lifetime — no per-render cost.
//
//   const useStyles = makeStyles((t) => ({ root: { backgroundColor: t.bg } }));
//   function C() { const s = useStyles(); return <View style={s.root} /> }
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(fn: (t: Theme) => T) {
  const cache = new WeakMap<Theme, T>();
  return function useStyles(): T {
    const { theme } = useTheme();
    let s = cache.get(theme);
    if (!s) {
      s = StyleSheet.create(fn(theme));
      cache.set(theme, s);
    }
    return s;
  };
}
