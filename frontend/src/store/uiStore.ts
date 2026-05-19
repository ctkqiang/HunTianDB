import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "auto";

interface UIState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  setTheme: (t: ThemeMode) => void;
  toggleSidebar: () => void;
}

function getInitialTheme(): ThemeMode {
  return (localStorage.getItem("huntiandb_theme") as ThemeMode) || "auto";
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export const useUIStore = create<UIState>((set) => ({
  theme: getInitialTheme(),
  sidebarCollapsed: false,
  setTheme: (t) => {
    localStorage.setItem("huntiandb_theme", t);
    const resolved = resolveTheme(t);
    document.documentElement.setAttribute("theme-mode", resolved);
    set({ theme: t });
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

// 初始化主题
const saved = getInitialTheme();
document.documentElement.setAttribute("theme-mode", resolveTheme(saved));
