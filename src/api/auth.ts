import { http } from "./http";
import type { AuthResponse, UserInfo } from "../types/api";

function readName(payload: any): string | undefined {
    const direct =
        payload?.name
        || payload?.fullName
        || payload?.fullname
        || payload?.displayName
        || payload?.learnerName
        || payload?.userName
        || payload?.username;
    const trimmedDirect = typeof direct === "string" ? direct.trim() : "";
    if (trimmedDirect) return trimmedDirect;

    const first = typeof payload?.firstName === "string" ? payload.firstName.trim() : "";
    const last = typeof payload?.lastName === "string" ? payload.lastName.trim() : "";
    const combined = `${first} ${last}`.trim();
    return combined || undefined;
}

function normalizeAuthResponse(payload: any): AuthResponse {
    return {
        userId: Number(payload?.userId ?? payload?.id ?? 0),
        email: String(payload?.email ?? ""),
        name: readName(payload),
        role: String(payload?.role ?? "USER"),
        token: String(payload?.token ?? ""),
        tokenType: String(payload?.tokenType ?? "Bearer"),
        message: typeof payload?.message === "string" ? payload.message : undefined,
    };
}

function normalizeUserInfo(payload: any): UserInfo {
    return {
        userId: Number(payload?.userId ?? payload?.id ?? 0),
        email: String(payload?.email ?? ""),
        name: readName(payload),
        role: String(payload?.role ?? "USER"),
    };
}

export async function signup(email: string, password: string, name: string): Promise<AuthResponse> {
    const res = await http.post("/api/auth/signup", { email, password, name });
    return normalizeAuthResponse(res.data);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
    const res = await http.post("/api/auth/login", { email, password });
    return normalizeAuthResponse(res.data);
}

export async function getMe(): Promise<UserInfo> {
    const res = await http.get("/api/auth/me");
    return normalizeUserInfo(res.data);
}

export async function logout(): Promise<void> {
    await http.post("/api/auth/logout");
}

export async function deleteMyAccount(): Promise<void> {
    await http.delete("/api/auth/me");
}
