"use client";

import { useSyncExternalStore } from "react";
import {
  ALL_THEME_CLASSES,
  DEFAULT_THEME,
  parseTheme,
  serializeTheme,
  THEME_COOKIE,
  themeClassName,
  type Theme,
} from "@/lib/theme";

/*
  The applied theme lives on <html> (set before paint by themeScript()). This
  hook reads it and applies a new one. Saving is a cookie for now; once accounts
  exist (Phase 3) applyTheme() also saves to the user's preferences row.
*/

const listeners = new Set<() => void>();
let current: Theme | null = null;

function read(): Theme {
  if (current) return current;
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]+)`));
  current = parseTheme(match ? decodeURIComponent(match[1]) : null) ?? DEFAULT_THEME;
  return current;
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  ALL_THEME_CLASSES.forEach((c) => root.classList.remove(c));
  themeClassName(theme)
    .split(" ")
    .forEach((c) => root.classList.add(c));
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(serializeTheme(theme))}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  current = theme;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The applied theme. Server render and hydration use the default, then the saved theme. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_THEME);
}
