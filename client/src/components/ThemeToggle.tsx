import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "light" ? "Включить тёмную тему" : "Включить светлую тему";
  return (
    <button type="button" className="atelier-theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  );
}
