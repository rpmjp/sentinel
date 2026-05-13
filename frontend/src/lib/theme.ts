/**
 * Theme management. Persists to localStorage, applies `light` class to <html>.
 */

export type Theme = "dark" | "light";

const STORAGE_KEY = "sentinel.theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored === "dark" || stored === "light") return stored;
  return "dark"; // default
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
  window.localStorage.setItem(STORAGE_KEY, theme);
}