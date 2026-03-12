"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Laptop, Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/70 p-1 dark:border-slate-700 dark:bg-slate-900/80">
      <ThemeButton
        label="Light"
        active={mounted && theme === "light"}
        onClick={() => setTheme("light")}
        icon={Sun}
      />
      <ThemeButton
        label="System"
        active={mounted && theme === "system"}
        onClick={() => setTheme("system")}
        icon={Laptop}
      />
      <ThemeButton
        label="Dark"
        active={mounted && theme === "dark"}
        onClick={() => setTheme("dark")}
        icon={Moon}
      />
    </div>
  );
}

interface ThemeButtonProps {
  label: "Light" | "System" | "Dark";
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

function ThemeButton({ label, active, onClick, icon: Icon }: ThemeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
        active
          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      }`}
      aria-label={`Set ${label.toLowerCase()} theme`}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
