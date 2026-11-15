export type ColorTheme = "light" | "dark";
export const THEME_STORAGE_KEY = "tcf_color_mode_v1";
export function preferredTheme(
  saved: string | null,
  systemDark: boolean,
): ColorTheme {
  return saved === "light" || saved === "dark"
    ? saved
    : systemDark
      ? "dark"
      : "light";
}
export function initialTheme(): ColorTheme {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    /* Storage is optional. */
  }
  return preferredTheme(
    saved,
    typeof matchMedia === "function" &&
      matchMedia("(prefers-color-scheme: dark)").matches,
  );
}
export function applyTheme(theme: ColorTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#111827" : "#f3f5fa");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Keep the selected mode in memory. */
  }
}
