import { http } from "./http";
import type {
    AdminUser,
    AdminLearnerProfileResponse,
} from "../types/api";

export async function getAdminLearners(): Promise<AdminUser[]> {
    const res = await http.get<AdminUser[]>("/api/admin/learners");
    return res.data;
}

export async function getAdminLearnerProfile(learnerId: number): Promise<AdminLearnerProfileResponse> {
    const res = await http.get<AdminLearnerProfileResponse>(`/api/admin/learners/${learnerId}/profile`);
    return res.data;
}

export async function deleteCertificate(certId: string): Promise<void> {
    await http.delete(`/api/admin/certificates/${certId}`);
}

export async function revokeCertificate(certId: string): Promise<{ message: string; certificateId: string; status: string }> {
    const res = await http.post(`/api/admin/certificates/${certId}/revoke`);
    return res.data;
}

export async function activateCertificate(certId: string): Promise<{ message: string; certificateId: string; status: string }> {
    const res = await http.post(`/api/admin/certificates/${certId}/activate`);
    return res.data;
}
