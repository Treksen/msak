import { useEffect, useSyncExternalStore } from "react";

/** Light / dark appearance for the member portal. Saved on this device. */
export type ThemeChoice = "light" | "dark" | "system";

const KEY = "msak-theme";
const listeners = new Set<() => void>();
const media = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

export function themeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage blocked */
  }
  return "light";
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* storage blocked: still applies for this visit */
  }
  current = choice;
  listeners.forEach((l) => l());
}

let current: ThemeChoice = themeChoice();

function isDark(choice: ThemeChoice) {
  return choice === "dark" || (choice === "system" && !!media?.matches);
}

/** Turn the dark look on or off for the page (the portal sets it while open; public pages stay light). */
export function applyPortalTheme(on: boolean) {
  const dark = on && isDark(current);
  document.documentElement.classList.toggle("msak-dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0a1124" : "#0b1f4d");
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  media?.addEventListener?.("change", cb);
  return () => {
    listeners.delete(cb);
    media?.removeEventListener?.("change", cb);
  };
}

/** Current choice, for the Settings page. */
export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribe, () => current, () => current);
  return [choice, setThemeChoice];
}

/** Keep the portal's appearance in step with the saved choice (and the phone's setting for "system"). */
export function usePortalTheme() {
  const [choice] = useThemeChoice();
  const systemDark = useSyncExternalStore(subscribe, () => !!media?.matches, () => false);
  useEffect(() => {
    applyPortalTheme(true);
    return () => applyPortalTheme(false);
  }, [choice, systemDark]);
}
