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
      try { setCert(await verifyCertificate(token)); }
      catch (e: any) { setError(e?.message || "Invalid certificate link"); }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) {
    return (<div className="ct-loading" style={{ minHeight: 400 }}><div className="ct-spinner" /><span>Verifying certificate...</span></div>);
  }

  /* Not Found */
  if (error || !cert) {
    return (
      <div className="ct-slide-up" style={{ maxWidth: 520, margin: "80px auto", textAlign: "center" }}>
        <div className="ct-card" style={{ padding: "48px 32px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <ShieldAlert size={32} style={{ color: "var(--ct-error)" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Certificate Not Found</h1>
          <p style={{ color: "var(--ct-text-secondary)", fontSize: 14, lineHeight: 1.65, maxWidth: 340, margin: "0 auto" }}>
            {error || "The verification link is invalid or the certificate does not exist."}
          </p>
        </div>
      </div>
    );
  }

  const isValid = cert.status !== "REVOKED";
  const videoUrl = cert.videoUrl || (cert.videoId ? `https://www.youtube.com/watch?v=${cert.videoId}` : "");
  const engScore = cert.engagementScore && cert.engagementScore > 0 ? cert.engagementScore : null;
  const quizScore = cert.quizScore && cert.quizScore > 0 ? cert.quizScore : (cert.scorePercent ? cert.scorePercent / 100 : null);

  return (
    <div className="ct-slide-up" style={{ maxWidth: 680, margin: "40px auto" }}>
      {/* Status banner */}
      <div className={`ct-vbanner ${isValid ? "ct-vbanner-ok" : "ct-vbanner-err"}`}>
        {isValid ? <CheckCircle size={18} /> : <XCircle size={18} />}
        <div className="ct-vbanner-copy">
          <strong className="ct-vbanner-title">{isValid ? "Certificate Verified" : "Certificate Revoked"}</strong>
          <p className="ct-vbanner-desc">
            {isValid ? "This certificate is authentic and issued by CertifyTube." : "This certificate has been revoked and is no longer valid."}
          </p>
        </div>
        <span className={`ct-badge ct-vbanner-status ${isValid ? "ct-badge-certified" : "ct-badge-revoked"}`}>
          {cert.status || "ACTIVE"}
        </span>
      </div>

      {/* Main card */}
      <div className="ct-card ct-verify-card">
        {/* Header */}
        <div className="ct-verify-header">
          <div className="ct-verify-icon"><Award size={26} /></div>
          <div>
            <h2 className="ct-verify-name">{cert.learnerName || "Learner"}</h2>
            <p className="ct-verify-sub">Certificate of Verified Informal Learning</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="ct-verify-grid">
          <div className="ct-verify-row">
            <span className="ct-verify-lbl">Certificate No.</span>
            <span className="ct-verify-val" style={{ fontFamily: "monospace" }}>{cert.certificateNumber || cert.certificateId}</span>
          </div>
          <div className="ct-verify-row">
            <span className="ct-verify-lbl">Issue Date</span>
            <span className="ct-verify-val">{fmtDate(cert.createdAtUtc)}</span>
          </div>
          <div className="ct-verify-row">
            <span className="ct-verify-lbl">Platform</span>
            <span className="ct-verify-val">{cert.platformName || "CertifyTube"}</span>
          </div>
          <div className="ct-verify-row">
            <span className="ct-verify-lbl">Status</span>
            <span className={`ct-badge ${isValid ? "ct-badge-certified" : "ct-badge-revoked"}`}>{cert.status || "ACTIVE"}</span>
          </div>
        </div>

        {/* Video */}
        <div className="ct-verify-section">
          <h3 className="ct-verify-section-title">Video Information</h3>
          <div className="ct-verify-grid">
            <div className="ct-verify-row ct-verify-row-wide">
              <span className="ct-verify-lbl">Title</span>
              <span className="ct-verify-val">{cert.videoTitle || "YouTube Educational Content"}</span>
            </div>
            {cert.videoDuration && (
              <div className="ct-verify-row">
                <span className="ct-verify-lbl">Duration</span>
                <span className="ct-verify-val" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Clock size={13} /> {cert.videoDuration}
                </span>
              </div>
            )}
            {videoUrl && (
              <div className="ct-verify-row">
                <span className="ct-verify-lbl">Source</span>
                <a href={videoUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600, fontSize: 13, color: "var(--ct-primary)" }}>
                  YouTube <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Evidence */}
        <div className="ct-verify-section">
          <h3 className="ct-verify-section-title">Verification Evidence</h3>
          <div className="ct-verify-scores">
            <div className="ct-verify-score-card">
              <div className="ct-verify-score-num">{fmtPct(engScore)}</div>
              <div className="ct-verify-score-label">Engagement</div>
              <div className="ct-verify-score-req">Required: {fmtPct(cert.engagementThreshold ?? 0.85)}</div>
            </div>
            <div className="ct-verify-score-card">
              <div className="ct-verify-score-num">{fmtPct(quizScore)}</div>
              <div className="ct-verify-score-label">Quiz Score</div>
              <div className="ct-verify-score-req">Required: {fmtPct(cert.quizThreshold ?? 0.80)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p style={{ textAlign: "center", color: "var(--ct-text-muted)", fontSize: 12.5, marginTop: 20 }}>
        <Award size={14} style={{ verticalAlign: "text-bottom", marginRight: 4 }} />
        CertifyTube — Informal Learning Verification Platform
      </p>
    </div>
  );
}
