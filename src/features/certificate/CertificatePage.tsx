import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, Download, ExternalLink, Share2, X, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { getCertificate } from "../../api/certificate";
import { getMe } from "../../api/auth";
import { useAuthStore } from "../../store/useAuthStore";

function fmtPct(v: number | undefined | null): string {
  if (v == null || v === 0) return "-";
  const n = v <= 1 ? v * 100 : v;
  return `${Math.round(n)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type CertificateLocationState = {
  fromStatus?: "active" | "completed" | "quiz";
  fromPath?: string;
};

export function CertificatePage() {
  const { certificateId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const locationState = (location.state as CertificateLocationState | null) || null;
  const fromStatus = locationState?.fromStatus === "active" || locationState?.fromStatus === "completed" || locationState?.fromStatus === "quiz"
    ? locationState.fromStatus
    : "quiz";
  const fromPath = (locationState?.fromPath || `/my-learnings?status=${fromStatus}`).trim();
  const [downloading, setDownloading] = useState(false);
  const { user } = useAuthStore();
  const { data: me } = useQuery({
    queryKey: ["auth", "me", "certificate"],
    queryFn: getMe,
    staleTime: 30_000,
  });

  const { data: cert, isLoading, isError } = useQuery({
    queryKey: ["certificate", certificateId],
    queryFn: () => getCertificate(certificateId!),
    enabled: Boolean(certificateId),
  });

  const captureCertificateCanvas = async (el: HTMLElement): Promise<HTMLCanvasElement> => {
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore and continue to capture
      }
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    return html2canvas(el, {
      scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)),
      useCORS: true,
      logging: false,
      backgroundColor: null,
      windowWidth: Math.ceil(el.scrollWidth),
      windowHeight: Math.ceil(el.scrollHeight),
      scrollX: 0,
      scrollY: -window.scrollY,
    });
  };

  const handleDownload = async () => {
    const el = document.getElementById("printable-certificate") as HTMLElement | null;
    if (!el) {
      toast.error("Certificate not ready");
      return;
    }

    setDownloading(true);
    try {
      const canvas = await captureCertificateCanvas(el);
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`Certificate-${learnerName.replace(/\s+/g, "_")}.pdf`);
      toast.success("Certificate downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate certificate PDF");
    }
    finally { setDownloading(false); }
  };

  const handleShare = () => {
    const link = cert?.verificationToken
      ? `${window.location.origin}/verify/${cert.verificationToken}`
      : cert?.verificationLink;
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("Verification link copied");
  };

  if (isLoading) {
    return (<div className="ct-loading" style={{ minHeight: 300 }}><div className="ct-spinner" /><span>Loading certificate...</span></div>);
  }
  if (!cert || isError) {
    return <div className="ct-empty">Certificate not found</div>;
  }

  const isValid = cert.status !== "REVOKED";
  const verifyUrl = cert.verificationToken ? `${window.location.origin}/verify/${cert.verificationToken}` : cert.verificationLink;
  const videoUrl = cert.videoUrl || (cert.videoId ? `https://www.youtube.com/watch?v=${cert.videoId}` : "");
  const engScore = cert.engagementScore && cert.engagementScore > 0 ? cert.engagementScore : null;
  const quizScore = cert.quizScore && cert.quizScore > 0 ? cert.quizScore : (cert.scorePercent ? cert.scorePercent / 100 : null);
  const issuedYear = new Date(cert.createdAtUtc).getFullYear();
  const certLearnerName = cert.learnerName?.trim() || "";
  const profileName = me?.name?.trim() || user?.name?.trim() || "";
  const learnerName = certLearnerName && !looksLikeEmail(certLearnerName)
    ? certLearnerName
    : profileName || certLearnerName || "Certified Learner";
  const platformName = cert.platformName || "CertifyTube";
  const goMyLearnings = () => nav(fromPath, { state: { initialStatus: fromStatus } });
  const goBack = () => {
    if (window.history.length > 1) {
      nav(-1);
      return;
    }
    goMyLearnings();
  };

  return (
    <div className="ct-slide-up" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div className="ct-analyze-topbar ct-no-print">
        <button className="ct-btn ct-btn-secondary ct-btn-sm ct-analyze-back-btn" onClick={goBack}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="ct-btn ct-btn-sm ct-analyze-close-btn" onClick={goMyLearnings}>
          <X size={14} /> Close
        </button>
      </div>

      {/* Toolbar */}
      <div className="ct-cert-toolbar ct-no-print">
        <div className="ct-cert-toolbar-left">
          <button
            className="ct-btn ct-btn-primary ct-btn-sm ct-cert-icon-btn"
            onClick={handleDownload}
            disabled={downloading}
            id="cert-download-btn"
            title={downloading ? "Downloading..." : "Download PDF"}
            aria-label={downloading ? "Downloading certificate" : "Download certificate PDF"}
          >
            <Download size={15} />
          </button>
          <button
            className="ct-btn ct-btn-secondary ct-btn-sm ct-cert-icon-btn"
            onClick={handleShare}
            id="cert-share-btn"
            title="Copy verification link"
            aria-label="Copy verification link"
          >
            <Share2 size={15} />
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`ct-vbanner ct-vbanner-cert ct-no-print ${isValid ? "ct-vbanner-ok" : "ct-vbanner-err"}`}>
        <span className="ct-vbanner-icon">
          {isValid ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
        </span>
        <div className="ct-vbanner-copy">
          <strong className="ct-vbanner-title">
            {isValid ? "Certificate Verified" : "Certificate Revoked"}
          </strong>
          <p className="ct-vbanner-desc">
            {isValid ? "This certificate is active and verified." : "This certificate has been revoked."}
          </p>
        </div>
        <span className={`ct-badge ct-vbanner-status ${isValid ? "ct-badge-certified" : "ct-badge-revoked"}`}>
          {cert.status || "ACTIVE"}
        </span>
      </div>

      {/* ===== CERTIFICATE ===== */}
      <article className="ct-pc" id="printable-certificate">
        {/* Gold border frame */}
        <div className="ct-pc-frame">
          {/* Top row: brand + seal */}
          <div className="ct-pc-topbar">
            <div className="ct-pc-brand">
              <div className="ct-pc-brand-dot" />
              <span>{platformName}</span>
            </div>
            <div className="ct-pc-seal">
              <span className="ct-pc-seal-label">CERTIFIED</span>
              <strong className="ct-pc-seal-year">{issuedYear}</strong>
            </div>
          </div>

          {/* Title */}
          <h1 className="ct-pc-heading">Certificate of Achievement</h1>
          <p className="ct-pc-subheading">Verified Informal Learning - {platformName}</p>

          {/* Recipient */}
          <p className="ct-pc-presented">This certificate is proudly presented to</p>
          <h2 className="ct-pc-name">{learnerName}</h2>
          <div className="ct-pc-divider" />

          {/* Description */}
          <p className="ct-pc-desc">
            For successfully completing and demonstrating verified learning engagement with the
            educational content below, meeting all certification requirements under the {platformName} dual-verification framework.
          </p>

          {/* Video Card */}
          <div className="ct-pc-vidcard">
            <div className="ct-pc-vidcard-left">
              <span className="ct-pc-lbl">VIDEO</span>
              <span className="ct-pc-vidtitle">{cert.videoTitle || "YouTube Educational Content"}</span>
              {videoUrl && (
                <a href={videoUrl} target="_blank" rel="noreferrer" className="ct-pc-vidlink">
                  Watch source video <ExternalLink size={10} />
                </a>
              )}
            </div>
            {cert.videoDuration && (
              <div className="ct-pc-viddur"><Clock size={13} /> {cert.videoDuration}</div>
            )}
          </div>

          {/* Evidence + Meta row */}
          <div className="ct-pc-evidence">
            <div className="ct-pc-score-box">
              <span className="ct-pc-score-num">{fmtPct(engScore)}</span>
              <span className="ct-pc-score-name">Engagement</span>
              <span className="ct-pc-score-req">Required: {fmtPct(cert.engagementThreshold ?? 0.85)}</span>
            </div>
            <div className="ct-pc-score-box">
              <span className="ct-pc-score-num">{fmtPct(quizScore)}</span>
              <span className="ct-pc-score-name">Quiz Score</span>
              <span className="ct-pc-score-req">Required: {fmtPct(cert.quizThreshold ?? 0.80)}</span>
            </div>
            <div className="ct-pc-meta-box">
              <div className="ct-pc-meta-item">
                <span className="ct-pc-lbl">CERTIFICATE NO.</span>
                <span className="ct-pc-metaval">{cert.certificateNumber || cert.certificateId}</span>
              </div>
              <div className="ct-pc-meta-item">
                <span className="ct-pc-lbl">ISSUED ON</span>
                <span className="ct-pc-metaval">{fmtDate(cert.createdAtUtc)}</span>
              </div>
            </div>
          </div>

          {/* Bottom Footer: Disclaimer + Seal/QR */}
          <div className="ct-pc-footer">
            <div className="ct-pc-footer-left">
              <p className="ct-pc-footnote">Digitally issued certificate - no physical signature required</p>
            </div>
            <div className="ct-pc-footer-right">
              {cert.sealUrl && (
                <img src={cert.sealUrl} alt="Official Seal" className="ct-pc-sealimg" />
              )}
              {verifyUrl && (
                <div className="ct-pc-qrwrap">
                  <QRCodeSVG value={verifyUrl} size={64} level="M" bgColor="transparent" />
                  <span className="ct-pc-qrtxt">SCAN TO VERIFY</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </article>

    </div>
  );
}
