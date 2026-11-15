import React, { createContext, useContext, useEffect, useState } from "react";
import { applyTheme, initialTheme, type ColorTheme } from "../utils/theme";
const ThemeContext = createContext<{
  theme: ColorTheme;
  toggleTheme: () => void;
} | null>(null);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ColorTheme>(initialTheme);
  useEffect(() => applyTheme(theme), [theme]);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () =>
          setTheme((current) => (current === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is missing.");
  return context;
}
