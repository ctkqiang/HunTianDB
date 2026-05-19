import { create } from "zustand";
import type { User, Role } from "@/types/user";

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: JSON.parse(localStorage.getItem("huntiandb_user") || "null"),
  isAuthenticated: !!localStorage.getItem("huntiandb_token"),

  login: (user) => {
    localStorage.setItem("huntiandb_token", user.token);
    localStorage.setItem("huntiandb_user", JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("huntiandb_token");
    localStorage.removeItem("huntiandb_user");
    set({ user: null, isAuthenticated: false });
  },
}));
