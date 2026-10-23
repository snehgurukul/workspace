// Light, dark or follow the device. Saved per browser.
export type Theme = "light" | "dark" | "system";
const KEY = "sneh.theme";

export function getTheme(): Theme {
  try {
    return (localStorage.getItem(KEY) as Theme | null) ?? "system";
  } catch {
    return "system";
  }
}

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function applyTheme(theme = getTheme()) {
  const dark = theme === "dark" || (theme === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: keep it for this visit only */
  }
  applyTheme(theme);
}

media().addEventListener?.("change", () => applyTheme());
