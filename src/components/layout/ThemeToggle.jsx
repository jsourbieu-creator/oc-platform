import { useEffect, useState } from "react";

const THEME_KEY = "oc_theme";

function getInitial() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <button
      className="theme-toggle"
      aria-label="Changer de thème"
      onClick={() => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        localStorage.setItem(THEME_KEY, next);
      }}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
