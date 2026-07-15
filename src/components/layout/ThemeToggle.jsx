import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "oc_theme";

function getInitial() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  return "dark"; // sombre par défaut : nouvelle direction design (refonte moderne)
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
      {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
