import { http } from "./http";
import type {
    LoginResponse,
    SignupResponse,
    UserInfo,
    AuthMessageResponse,
} from "../types/api";

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

function normalizeSignupResponse(payload: any): SignupResponse {
    return {
        userId: Number(payload?.userId ?? payload?.id ?? 0),
        email: String(payload?.email ?? ""),
        role: String(payload?.role ?? "USER"),
        emailVerified: Boolean(payload?.emailVerified),
        message: typeof payload?.message === "string" ? payload.message : undefined,
    };
}

function normalizeLoginResponse(payload: any): LoginResponse {
    return {
        userId: Number(payload?.userId ?? payload?.id ?? 0),
        email: String(payload?.email ?? ""),
        name: readName(payload),
        role: String(payload?.role ?? "USER"),
        emailVerified: Boolean(payload?.emailVerified),
        token: String(payload?.token ?? ""),
        tokenType: String(payload?.tokenType ?? "Bearer"),
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

function normalizeMessageResponse(payload: any): AuthMessageResponse {
    return {
        message: typeof payload?.message === "string" ? payload.message : "Success",
    };
}

export async function signup(email: string, password: string, name: string): Promise<SignupResponse> {
    const res = await http.post("/api/auth/signup", { email, password, name });
    return normalizeSignupResponse(res.data);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
    const res = await http.post("/api/auth/login", { email, password });
    return normalizeLoginResponse(res.data);
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

export async function forgotPassword(email: string): Promise<AuthMessageResponse> {
    const res = await http.post("/api/auth/forgot-password", { email });
    return normalizeMessageResponse(res.data);
}

export async function resendVerification(email: string): Promise<AuthMessageResponse> {
    const res = await http.post("/api/auth/resend-verification", { email });
    return normalizeMessageResponse(res.data);
}

export async function verifyEmail(token: string): Promise<AuthMessageResponse> {
    const res = await http.get("/api/auth/verify-email", {
        params: { token },
    });
    return normalizeMessageResponse(res.data);
}

export async function resetPassword(token: string, newPassword: string): Promise<AuthMessageResponse> {
    const res = await http.post("/api/auth/reset-password", { token, newPassword });
    return normalizeMessageResponse(res.data);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthMessageResponse> {
    const res = await http.post("/api/auth/change-password", { currentPassword, newPassword });
    return normalizeMessageResponse(res.data);
}
