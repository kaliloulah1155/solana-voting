"use client";

import { useTheme } from "./theme-provider";

export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      className="relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border border-border-low bg-cream transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
    >
      <span className="sr-only">
        {isDark ? "Mode sombre actif" : "Mode clair actif"}
      </span>
      <span
        className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-foreground shadow-sm transition-transform duration-200 ${
          isDark ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
