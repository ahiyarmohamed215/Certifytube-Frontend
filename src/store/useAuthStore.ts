import { create } from "zustand";
import type { UserInfo } from "../types/api";

interface AuthState {
    token: string | null;
    user: UserInfo | null;
    isLoggedIn: boolean;
    setAuth: (token: string, user: UserInfo) => void;
    setUser: (user: UserInfo) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    token: localStorage.getItem("ct_token"),
    user: (() => {
        try {
            const u = localStorage.getItem("ct_user");
            return u ? JSON.parse(u) : null;
        } catch {
            return null;
        }
    })(),
    isLoggedIn: !!localStorage.getItem("ct_token"),

    setAuth: (token, user) => {
        localStorage.setItem("ct_token", token);
        localStorage.setItem("ct_user", JSON.stringify(user));
        set({ token, user, isLoggedIn: true });
    },

    setUser: (user) => {
        localStorage.setItem("ct_user", JSON.stringify(user));
        set({ user });
    },

    clearAuth: () => {
        localStorage.removeItem("ct_token");
        localStorage.removeItem("ct_user");
        set({ token: null, user: null, isLoggedIn: false });
    },
}));
