"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved =
      (document.documentElement.dataset.theme as Theme) ||
      (localStorage.getItem("syncedin-theme") as Theme) ||
      "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("syncedin-theme", next);
    } catch {
      /* storage blocked */
    }
  }

  return (
    <button
      onClick={toggle}
      className="retro-dim hover:text-white"
      aria-label="Toggle light / dark mode"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "☀ light" : "☾ dark"}
    </button>
  );
}
