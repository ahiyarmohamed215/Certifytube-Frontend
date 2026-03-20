import { http } from "./http";
import type {
    AdminStats,
    AdminUser,
    AdminSession,
    AdminCertificate,
    AdminQuiz,
    AdminEngagementResult,
    AdminLearnerProfileResponse,
} from "../types/api";

export async function getAdminStats(): Promise<AdminStats> {
    const res = await http.get<AdminStats>("/api/admin/stats");
    return res.data;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
    const res = await http.get<AdminUser[]>("/api/admin/users");
    return res.data;
}

export async function getAdminLearners(): Promise<AdminUser[]> {
    const res = await http.get<AdminUser[]>("/api/admin/learners");
    return res.data;
}

export async function updateUserRole(userId: number, role: string): Promise<void> {
    await http.put(`/api/admin/users/${userId}/role`, { role });
}

export async function deleteUser(userId: number): Promise<void> {
    await http.delete(`/api/admin/users/${userId}`);
}

export async function updateAdminUser(
    userId: number,
    payload: { name: string; email: string; role: string; active: boolean; emailVerified: boolean },
): Promise<AdminUser> {
    const res = await http.put<AdminUser>(`/api/admin/users/${userId}`, payload);
    return res.data;
}

export async function setAdminUserActive(userId: number, active: boolean): Promise<AdminUser> {
    const res = await http.patch<AdminUser>(`/api/admin/users/${userId}/active`, { active });
    return res.data;
}

export async function getAdminSessions(): Promise<AdminSession[]> {
    const res = await http.get<AdminSession[]>("/api/admin/sessions");
    return res.data;
}

export async function getAdminLearnerProfile(learnerId: number, searchLimit = 30): Promise<AdminLearnerProfileResponse> {
    const res = await http.get<AdminLearnerProfileResponse>(`/api/admin/learners/${learnerId}/profile`, {
        params: { searchLimit },
    });
    return res.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
    await http.delete(`/api/admin/sessions/${sessionId}`);
}

export async function getAdminCertificates(): Promise<AdminCertificate[]> {
    const res = await http.get<AdminCertificate[]>("/api/admin/certificates");
    return res.data;
}

export async function deleteCertificate(certId: string): Promise<void> {
    await http.delete(`/api/admin/certificates/${certId}`);
}

export async function getAdminQuizzes(): Promise<AdminQuiz[]> {
    const res = await http.get<AdminQuiz[]>("/api/admin/quizzes");
    return res.data;
}

export async function deleteQuiz(quizId: string): Promise<void> {
    await http.delete(`/api/admin/quizzes/${quizId}`);
}

export async function revokeCertificate(certId: string): Promise<{ message: string; certificateId: string; status: string }> {
    const res = await http.post(`/api/admin/certificates/${certId}/revoke`);
    return res.data;
}

export async function activateCertificate(certId: string): Promise<{ message: string; certificateId: string; status: string }> {
    const res = await http.post(`/api/admin/certificates/${certId}/activate`);
    return res.data;
}

export async function getAdminEngagementResult(sessionId: string): Promise<AdminEngagementResult> {
    const res = await http.get<AdminEngagementResult>(`/api/admin/engagement-results/${sessionId}`);
    return res.data;
}
