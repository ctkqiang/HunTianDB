import { useUserStore } from "@/store/userStore";
import { login as apiLogin, logout as apiLogout } from "@/api/auth";
import type { LoginRequest } from "@/types/api";

export function useAuth() {
  const { user, isAuthenticated, login: setUser, logout: clearUser } = useUserStore();

  const signIn = async (req: LoginRequest) => {
    const res = await apiLogin(req);
    setUser({ id: req.username, username: req.username, role: res.role as any, token: res.token });
  };

  const signOut = () => {
    apiLogout();
    clearUser();
  };

  return { user, isAuthenticated, signIn, signOut };
}
