import { http } from "./http";
import type { AuthResponse, UserInfo } from "../types/api";

export async function signup(email: string, password: string): Promise<AuthResponse> {
    const res = await http.post<AuthResponse>("/api/auth/signup", { email, password });
    return res.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
    const res = await http.post<AuthResponse>("/api/auth/login", { email, password });
    return res.data;
}

export async function getMe(): Promise<UserInfo> {
    const res = await http.get<UserInfo>("/api/auth/me");
    return res.data;
}

export async function logout(): Promise<void> {
    await http.post("/api/auth/logout");
}
