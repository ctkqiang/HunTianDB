import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "auto";

function resolveTheme(m: ThemeMode): "light" | "dark" {
  if (m === "auto") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return m;
}

const initial: ThemeMode = (localStorage.getItem("app_theme") as ThemeMode) || "dark";

interface UIState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  setTheme: (t: ThemeMode) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: initial,
  sidebarCollapsed: false,
  setTheme: (t) => {
    localStorage.setItem("app_theme", t);
    document.documentElement.setAttribute("theme-mode", resolveTheme(t));
    set({ theme: t });
  },
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

document.documentElement.setAttribute("theme-mode", resolveTheme(initial));
