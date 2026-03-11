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
        const existingUser = (() => {
            try {
                const raw = localStorage.getItem("ct_user");
                return raw ? (JSON.parse(raw) as UserInfo) : null;
            } catch {
                return null;
            }
        })();
        const normalizedName = user.name?.trim() || existingUser?.name?.trim();
        const mergedUser: UserInfo = { ...user, ...(normalizedName ? { name: normalizedName } : {}) };
        localStorage.setItem("ct_token", token);
        localStorage.setItem("ct_user", JSON.stringify(mergedUser));
        set({ token, user: mergedUser, isLoggedIn: true });
    },

    setUser: (user) => {
        const normalizedName = user.name?.trim();
        const mergedUser: UserInfo = { ...user, ...(normalizedName ? { name: normalizedName } : {}) };
        localStorage.setItem("ct_user", JSON.stringify(mergedUser));
        set({ user: mergedUser });
    },

    clearAuth: () => {
        localStorage.removeItem("ct_token");
        localStorage.removeItem("ct_user");
        set({ token: null, user: null, isLoggedIn: false });
    },
}));
