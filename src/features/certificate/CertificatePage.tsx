import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, ExternalLink, Share2, Clock, Award, ShieldCheck, ShieldX } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

import { downloadCertificatePdf, getCertificate } from "../../api/certificate";

function fmtPct(v: number | undefined | null): string {
  if (v == null || v === 0) return "—";
  const n = v <= 1 ? v * 100 : v;
  return `${Math.round(n)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function CertificatePage() {
  const { certificateId } = useParams();
  const nav = useNavigate();
  const [downloading, setDownloading] = useState(false);

  const { data: cert, isLoading, isError } = useQuery({
    queryKey: ["certificate", certificateId],
    queryFn: () => getCertificate(certificateId!),
    enabled: Boolean(certificateId),
  });

  const handleDownload = async () => {
    if (!certificateId) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(certificateId);
      toast.success("Certificate PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    if (!cert?.verificationLink) return;
    navigator.clipboard.writeText(cert.verificationLink);
    toast.success("Verification link copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="ct-loading" style={{ minHeight: 300 }}>
        <div className="ct-spinner" />
        <span>Loading certificate...</span>
      </div>
    );
  }

  if (!cert || isError) {
    return <div className="ct-empty">Certificate not found</div>;
  }

  const isValid = cert.status !== "REVOKED";
  const videoUrl = cert.videoUrl || (cert.videoId ? `https://youtube.com/watch?v=${cert.videoId}` : "");

  // Score fallbacks: quizScore may be 0 if not populated, use scorePercent instead
  const engScore = cert.engagementScore && cert.engagementScore > 0 ? cert.engagementScore : null;
  const quizScore = cert.quizScore && cert.quizScore > 0 ? cert.quizScore : (cert.scorePercent ? cert.scorePercent / 100 : null);

  return (
    <div className="ct-slide-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Toolbar */}
      <div className="ct-cert-toolbar ct-print-hide">
        <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav("/my-learnings")}>
          <ArrowLeft size={14} /> My Learnings
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={handleDownload} disabled={downloading} id="cert-download-btn">
            <Download size={14} />
            {downloading ? "Downloading..." : "Download PDF"}
          </button>
          <button className="ct-btn ct-btn-secondary ct-btn-sm" onClick={handleShare} id="cert-share-btn">
            <Share2 size={14} /> Copy Verify Link
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`ct-cert-status-banner ${isValid ? "ct-cert-status-valid" : "ct-cert-status-revoked"}`}>
        {isValid ? <ShieldCheck size={22} /> : <ShieldX size={22} />}
        <div>
          <strong>{isValid ? "✅ Valid Certificate" : "❌ Certificate Revoked"}</strong>
          <p>{isValid ? "This certificate is active and verified by CertifyTube." : "This certificate has been revoked and is no longer valid."}</p>
        </div>
        <span className={`ct-badge ${isValid ? "ct-badge-certified" : "ct-badge-revoked"}`}>
          {cert.status || "ACTIVE"}
        </span>
      </div>

      {/* Main Certificate Card */}
      <div className="ct-card ct-cert-detail-card">
        {/* Learner & Certificate Info */}
        <div className="ct-cert-detail-header">
          <div className="ct-cert-detail-icon">
            <Award size={32} />
          </div>
          <div>
            <h1 className="ct-cert-detail-name">{cert.learnerName || "Certified Learner"}</h1>
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
            <span className="ct-cert-detail-label">Verification</span>
            <span className="ct-cert-detail-value">{cert.platformAttribution || "Verification Layer 1 & 2"}</span>
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
                <span className="ct-cert-detail-label">Source</span>
                <a href={videoUrl} target="_blank" rel="noreferrer" className="ct-cert-detail-link">
                  Open on YouTube <ExternalLink size={13} />
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

        {/* QR Code Section */}
        {cert.verificationLink && (
          <div className="ct-cert-qr-section">
            <div className="ct-cert-qr-box">
              <QRCodeSVG value={cert.verificationLink} size={140} level="M" />
            </div>
            <div className="ct-cert-qr-info">
              <p className="ct-cert-qr-label">Scan to Verify</p>
              <p className="ct-cert-qr-link">{cert.verificationLink}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
