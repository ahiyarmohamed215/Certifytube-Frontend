import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Award, CheckCircle, Clock, ExternalLink, ShieldAlert, XCircle } from "lucide-react";

import { verifyCertificate } from "../../api/certificate";
import type { CertificateInfo } from "../../types/api";

function fmtPct(v: number | undefined | null): string {
  if (v == null || v === 0) return "—";
  const n = v <= 1 ? v * 100 : v;
  return `${Math.round(n)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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
        setError(e?.message || "Invalid certificate link");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  /* --- Loading --- */
  if (loading) {
    return (
      <div className="ct-loading" style={{ minHeight: 400 }}>
        <div className="ct-spinner" />
        <span>Verifying certificate...</span>
      </div>
    );
  }

  /* --- Certificate Not Found (400 error) --- */
  if (error || !cert) {
    return (
      <div className="ct-slide-up" style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
        <div className="ct-card" style={{ padding: "40px 24px" }}>
          <ShieldAlert size={52} style={{ color: "var(--ct-error)", marginBottom: 16 }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Certificate Not Found</h1>
          <p style={{ color: "var(--ct-text-secondary)", fontSize: 14, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            {error || "The verification link is invalid or the certificate does not exist. Please check the link and try again."}
          </p>
        </div>
      </div>
    );
  }

  /* --- Determine validity --- */
  const isValid = cert.status !== "REVOKED";
  const videoUrl = cert.videoUrl || (cert.videoId ? `https://youtube.com/watch?v=${cert.videoId}` : "");

  // Score fallbacks: quizScore may be 0 if not populated, use scorePercent instead
  const engScore = cert.engagementScore && cert.engagementScore > 0 ? cert.engagementScore : null;
  const quizScore = cert.quizScore && cert.quizScore > 0 ? cert.quizScore : (cert.scorePercent ? cert.scorePercent / 100 : null);

  return (
    <div className="ct-slide-up" style={{ maxWidth: 760, margin: "34px auto" }}>
      {/* Status Banner */}
      <div className={`ct-cert-status-banner ${isValid ? "ct-cert-status-valid" : "ct-cert-status-revoked"}`}>
        {isValid ? <CheckCircle size={24} /> : <XCircle size={24} />}
        <div>
          <strong>{isValid ? "✅ Valid Certificate" : "❌ Revoked Certificate"}</strong>
          <p>
            {isValid
              ? "This certificate is authentic and verified by CertifyTube."
              : "This certificate has been revoked and is no longer valid."}
          </p>
        </div>
        <span className={`ct-badge ${isValid ? "ct-badge-certified" : "ct-badge-revoked"}`}>
          {cert.status || "ACTIVE"}
        </span>
      </div>

      {/* Certificate Details Card */}
      <div className="ct-card ct-cert-detail-card">
        {/* Learner Header */}
        <div className="ct-cert-detail-header">
          <div className="ct-cert-detail-icon">
            <Award size={28} />
          </div>
          <div>
            <h2 className="ct-cert-detail-name" style={{ fontSize: 22 }}>{cert.learnerName || "Learner"}</h2>
            <p className="ct-cert-detail-subtitle">Certificate of Verified Informal Learning</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="ct-cert-detail-grid">
          <div className="ct-cert-detail-item">
            <span className="ct-cert-detail-label">Certificate Number</span>
            <span className="ct-cert-detail-value" style={{ fontFamily: "monospace" }}>{cert.certificateNumber || cert.certificateId}</span>
          </div>
          <div className="ct-cert-detail-item">
            <span className="ct-cert-detail-label">Issue Date</span>
            <span className="ct-cert-detail-value">{fmtDate(cert.createdAtUtc)}</span>
          </div>
          <div className="ct-cert-detail-item">
            <span className="ct-cert-detail-label">Platform</span>
            <span className="ct-cert-detail-value">{cert.platformName || "CertifyTube"}</span>
          </div>
          <div className="ct-cert-detail-item">
            <span className="ct-cert-detail-label">Status</span>
            <span className={`ct-badge ${isValid ? "ct-badge-certified" : "ct-badge-revoked"}`}>{cert.status || "ACTIVE"}</span>
          </div>
        </div>

        {/* Video Section */}
        <div className="ct-cert-detail-section">
          <h3 className="ct-cert-detail-section-title">Video Information</h3>
          <div className="ct-cert-detail-grid">
            <div className="ct-cert-detail-item ct-cert-detail-item-wide">
              <span className="ct-cert-detail-label">Video Title</span>
              <span className="ct-cert-detail-value">{cert.videoTitle || "YouTube Educational Content"}</span>
            </div>
            <div className="ct-cert-detail-item">
              <span className="ct-cert-detail-label">Duration</span>
              <span className="ct-cert-detail-value" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Clock size={14} /> {cert.videoDuration || "N/A"}
              </span>
            </div>
            {videoUrl && (
              <div className="ct-cert-detail-item">
                <span className="ct-cert-detail-label">YouTube Source</span>
                <a href={videoUrl} target="_blank" rel="noreferrer" className="ct-cert-detail-link">
                  Watch on YouTube <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Evidence Section */}
        <div className="ct-cert-detail-section">
          <h3 className="ct-cert-detail-section-title">Verification Evidence</h3>
          <div className="ct-cert-evidence-grid">
            <div className="ct-cert-evidence-card">
              <div className="ct-cert-evidence-score">{fmtPct(engScore)}</div>
              <div className="ct-cert-evidence-label">Engagement Score</div>
              <div className="ct-cert-evidence-threshold">Required: {fmtPct(cert.engagementThreshold ?? 0.85)}</div>
            </div>
            <div className="ct-cert-evidence-card">
              <div className="ct-cert-evidence-score">{fmtPct(quizScore)}</div>
              <div className="ct-cert-evidence-label">Quiz Score</div>
              <div className="ct-cert-evidence-threshold">Required: {fmtPct(cert.quizThreshold ?? 0.80)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 16, textAlign: "center", color: "var(--ct-text-muted)", fontSize: 13 }}>
        <Award size={16} style={{ verticalAlign: "text-bottom", marginRight: 5 }} />
        CertifyTube — Informal Learning Verification Platform
      </div>
    </div>
  );
}
