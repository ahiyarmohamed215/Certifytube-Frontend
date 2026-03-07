import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Award, CheckCircle, ExternalLink, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

import { verifyCertificate } from "../../api/certificate";
import type { CertificateInfo } from "../../types/api";

function normalizeScore01(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  return null;
}

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

  const engagement = normalizeScore01(cert?.engagementScore);
  const quiz = normalizeScore01(cert?.quizScore ?? cert?.scorePercent);
  const engagementThreshold = cert?.engagementThreshold ?? 0.85;
  const quizThreshold = cert?.quizThreshold ?? 0.8;
  const isVerified = useMemo(
    () => Boolean(quiz != null && quiz >= quizThreshold && (engagement == null || engagement >= engagementThreshold)),
    [engagement, engagementThreshold, quiz, quizThreshold],
  );
  const videoUrl = cert?.videoUrl || (cert?.videoId ? `https://youtube.com/watch?v=${cert.videoId}` : "");

  if (loading) {
    return (
      <div className="ct-loading" style={{ minHeight: 400 }}>
        <div className="ct-spinner" />
        <span>Verifying certificate...</span>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
        <div className="ct-card" style={{ padding: 24 }}>
          <ShieldAlert size={40} style={{ color: "var(--ct-error)", marginBottom: 10 }} />
          <h2 style={{ marginBottom: 8 }}>Verification Failed</h2>
          <p style={{ color: "var(--ct-text-secondary)" }}>{error || "Invalid verification token"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-slide-up" style={{ maxWidth: 760, margin: "34px auto" }}>
      <div className="ct-card" style={{ textAlign: "center", marginBottom: 12 }}>
        <CheckCircle size={44} style={{ color: "var(--ct-success)", marginBottom: 10 }} />
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Certificate Verified</h1>
        <p style={{ color: "var(--ct-text-muted)", fontSize: 13.5 }}>
          This certificate is authentic and issued by CertifyTube.
        </p>
      </div>

      <div className="ct-card">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <p><strong>Certificate ID:</strong> {cert.certificateNumber || cert.certificateId}</p>
            <p><strong>Issue Date:</strong> {new Date(cert.createdAtUtc).toLocaleDateString()}</p>
          </div>
          {cert.videoTitle && (
            <p><strong>Video:</strong> {cert.videoTitle}</p>
          )}
          {videoUrl && (
            <a href={videoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              Open YouTube Source <ExternalLink size={14} />
            </a>
          )}

          <div style={{ borderTop: "1px solid var(--ct-border)", paddingTop: 12 }}>
            <p style={{ marginBottom: 8, fontWeight: 700 }}>Verification Evidence</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <p><strong>Engagement:</strong> {engagement == null ? "-" : engagement.toFixed(2)}</p>
              <p><strong>Quiz:</strong> {quiz == null ? "-" : quiz.toFixed(2)}</p>
            </div>
            <p style={{ marginTop: 8, color: "var(--ct-text-secondary)" }}>
              Rule: Engagement &gt;= {engagementThreshold.toFixed(2)} AND Quiz &gt;= {quizThreshold.toFixed(2)}
            </p>
            <p style={{ marginTop: 4, fontWeight: 800, color: isVerified ? "var(--ct-success)" : "var(--ct-error)" }}>
              Result: {isVerified ? "VERIFIED" : "NOT VERIFIED"}
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, textAlign: "center", color: "var(--ct-text-muted)", fontSize: 13 }}>
        <Award size={16} style={{ verticalAlign: "text-bottom", marginRight: 5 }} />
        CertifyTube - Informal Learning Verification Platform
      </div>
    </div>
  );
}
