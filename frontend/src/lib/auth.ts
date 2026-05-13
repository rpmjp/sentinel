import { create } from "zustand";
import { api, clearToken, getToken, setToken } from "./api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "analyst" | "senior_analyst" | "admin";
  tenant_id: string;
  tenant_slug: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  async login(email, password) {
    set({ isLoading: true });
    try {
      const { data } = await api.post<{ access_token: string }>("/auth/login", {
        email,
        password,
      });
      setToken(data.access_token);
      const me = await api.get<User>("/auth/me");
      set({ user: me.data, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout() {
    clearToken();
    set({ user: null, isAuthenticated: false });
  },

  async fetchMe() {
    if (!getToken()) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    set({ isLoading: true });
    try {
      const { data } = await api.get<User>("/auth/me");
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      clearToken();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));