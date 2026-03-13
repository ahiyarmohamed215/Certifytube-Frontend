import { http } from "./http";
import type { CertificateInfo } from "../types/api";

export async function getCertificate(certificateId: string): Promise<CertificateInfo> {
  const res = await http.get<CertificateInfo>(`/api/certificates/${certificateId}`);
  return res.data;
}

export function getCertificatePdfUrl(certificateId: string): string {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  return `${base}/api/certificates/${certificateId}/pdf`;
}

export async function downloadCertificatePdf(certificateId: string): Promise<void> {
  const res = await http.get(`/api/certificates/${certificateId}/pdf`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `certificate-${certificateId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function verifyCertificate(token: string): Promise<CertificateInfo> {
  const res = await http.get<CertificateInfo>(`/api/certificates/verify/${token}`);
  return res.data;
}

export async function deleteCertificate(certificateId: string): Promise<void> {
  await http.delete(`/api/certificates/${certificateId}`);
}
