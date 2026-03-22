import { http } from "./http";
import type { ApiClientError } from "./http";
import type {
    LoginResponse,
    SignupResponse,
    UserInfo,
    AuthMessageResponse,
} from "../types/api";

const AUTH_REQUEST_TIMEOUT_MS = 90_000;
const AUTH_RETRY_DELAY_MS = 1_500;

function shouldRetryAuthRequest(error: unknown): boolean {
    const err = error as ApiClientError;
    if (err?.status) return false;
    const code = String((err as { code?: unknown })?.code || "").toLowerCase();
    const message = String(err?.message || "").toLowerCase();
    return code === "econnaborted"
        || /timeout|econnaborted|network error|failed to fetch|load failed/i.test(message);
}

async function withColdStartRetry<T>(request: () => Promise<T>): Promise<T> {
    try {
        return await request();
    } catch (error) {
        if (!shouldRetryAuthRequest(error)) {
            throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, AUTH_RETRY_DELAY_MS));
        return request();
    }
}

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
    const res = await withColdStartRetry(() => http.post("/api/auth/signup", { email, password, name }, {
        // Signup can be slower due cold-start + verification email dispatch.
        timeout: AUTH_REQUEST_TIMEOUT_MS,
    }));
    return normalizeSignupResponse(res.data);
}

export async function login(email: string, password: string): Promise<LoginResponse> {
    const res = await withColdStartRetry(() => http.post("/api/auth/login", { email, password }, {
        timeout: AUTH_REQUEST_TIMEOUT_MS,
    }));
    return normalizeLoginResponse(res.data);
}

export async function getMe(): Promise<UserInfo> {
    const res = await withColdStartRetry(() => http.get("/api/auth/me", {
        timeout: AUTH_REQUEST_TIMEOUT_MS,
    }));
    return normalizeUserInfo(res.data);
}

export async function logout(): Promise<void> {
    await http.post("/api/auth/logout");
}

export async function deleteMyAccount(): Promise<void> {
    await http.delete("/api/auth/me");
}

export async function forgotPassword(email: string): Promise<AuthMessageResponse> {
    const res = await withColdStartRetry(() => http.post("/api/auth/forgot-password", { email }, {
        timeout: AUTH_REQUEST_TIMEOUT_MS,
    }));
    return normalizeMessageResponse(res.data);
}

export async function resendVerification(email: string): Promise<AuthMessageResponse> {
    const res = await withColdStartRetry(() => http.post("/api/auth/resend-verification", { email }, {
        timeout: AUTH_REQUEST_TIMEOUT_MS,
    }));
    return normalizeMessageResponse(res.data);
}

export async function verifyEmail(token: string): Promise<AuthMessageResponse> {
    const res = await withColdStartRetry(() => http.get("/api/auth/verify-email", {
        params: { token },
        timeout: AUTH_REQUEST_TIMEOUT_MS,
    }));
    return normalizeMessageResponse(res.data);
}

export async function resetPassword(token: string, newPassword: string): Promise<AuthMessageResponse> {
    const res = await withColdStartRetry(() => http.post("/api/auth/reset-password", { token, newPassword }, {
        timeout: AUTH_REQUEST_TIMEOUT_MS,
    }));
    return normalizeMessageResponse(res.data);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthMessageResponse> {
    const res = await http.post("/api/auth/change-password", { currentPassword, newPassword });
    return normalizeMessageResponse(res.data);
}
