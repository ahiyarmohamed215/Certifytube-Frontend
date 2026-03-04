import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Award, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { verifyCertificate } from "../../api/certificate";
import type { CertificateInfo } from "../../types/api";

export function VerifyPage() {
    const { token } = useParams();

    const [cert, setCert] = useState<CertificateInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;
        (async () => {
            try {
                const c = await verifyCertificate(token);
                setCert(c);
            } catch (e: any) {
                setError(e?.message || "Verification failed");
                toast.error(e?.message || "Certificate not found");
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    if (loading) {
        return (
            <div className="ct-loading" style={{ minHeight: 400 }}>
                <div className="ct-spinner" />
                <span>Verifying certificate…</span>
            </div>
        );
    }

    if (error || !cert) {
        return (
            <div style={{ maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
                <div className="ct-glass-card">
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>❌</div>
                    <h2 style={{ marginBottom: 8 }}>Verification Failed</h2>
                    <p style={{ color: "var(--ct-text-secondary)" }}>{error || "Invalid verification token"}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="ct-slide-up" style={{ maxWidth: 500, margin: "40px auto" }}>
            <div className="ct-glass-card" style={{ textAlign: "center" }}>
                <CheckCircle size={48} style={{ color: "var(--ct-success)", marginBottom: 12 }} />
                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Certificate Verified</h1>
                <p style={{ color: "var(--ct-text-muted)", fontSize: 13, marginBottom: 24 }}>
                    This certificate is authentic and issued by CertifyTube
                </p>

                <div className="ct-card" style={{ textAlign: "left" }}>
                    <div style={{ display: "grid", gap: 16 }}>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--ct-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Certificate Number</div>
                            <div style={{ fontWeight: 600, fontFamily: "monospace", marginTop: 2 }}>{cert.certificateNumber}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--ct-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Score</div>
                            <div style={{ fontWeight: 600, marginTop: 2 }}>{cert.scorePercent?.toFixed(0)}%</div>
                        </div>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--ct-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Issued</div>
                            <div style={{ fontWeight: 600, marginTop: 2 }}>{new Date(cert.createdAtUtc).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 20 }}>
                    <Award size={20} style={{ color: "var(--ct-accent-light)", verticalAlign: "middle" }} />
                    <span style={{ fontSize: 13, color: "var(--ct-text-secondary)", marginLeft: 6 }}>
                        CertifyTube Authenticated
                    </span>
                </div>
            </div>
        </div>
    );
}
