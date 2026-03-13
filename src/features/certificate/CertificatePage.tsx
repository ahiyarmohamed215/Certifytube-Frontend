import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Download, ExternalLink, Printer, Share2, Trash2, X, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { deleteCertificate, getCertificate } from "../../api/certificate";
import { getMe } from "../../api/auth";
import { useAuthStore } from "../../store/useAuthStore";
import type { ApiClientError } from "../../api/http";

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
  const qc = useQueryClient();
  const location = useLocation();
  const locationState = (location.state as CertificateLocationState | null) || null;
  const fromStatus = locationState?.fromStatus === "active" || locationState?.fromStatus === "completed" || locationState?.fromStatus === "quiz"
    ? locationState.fromStatus
    : "quiz";
  const fromPath = (locationState?.fromPath || `/my-learnings?status=${fromStatus}`).trim();
  const [downloading, setDownloading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCertificate, setDeletingCertificate] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { user, clearAuth } = useAuthStore();
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
        // ignore font readiness failures and continue rendering
      }
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    return html2canvas(el, {
      scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)),
      useCORS: true,
      logging: false,
      backgroundColor: "#fdfcfb",
      windowWidth: Math.ceil(el.scrollWidth),
      windowHeight: Math.ceil(el.scrollHeight),
      scrollX: 0,
      scrollY: -window.scrollY,
    });
  };

  const buildCertificatePdf = (canvas: HTMLCanvasElement): jsPDF => {
    const pdf = new jsPDF("l", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageRatio = canvas.width / canvas.height;
    const pageRatio = pageWidth / pageHeight;

    let renderWidth = pageWidth;
    let renderHeight = pageHeight;
    if (imageRatio > pageRatio) {
      renderHeight = pageWidth / imageRatio;
    } else if (imageRatio < pageRatio) {
      renderWidth = pageHeight * imageRatio;
    }
    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    const imageData = canvas.toDataURL("image/png", 1.0);
    pdf.addImage(imageData, "PNG", x, y, renderWidth, renderHeight, undefined, "FAST");
    return pdf;
  };

  const handleDownload = async () => {
    const el = document.getElementById("printable-certificate");
    if (!el) { toast.error("Certificate not ready"); return; }
    setDownloading(true);
    try {
      const canvas = await captureCertificateCanvas(el);
      const pdf = buildCertificatePdf(canvas);
      pdf.save(`Certificate-${learnerName.replace(/\s+/g, "_")}.pdf`);
      toast.success("Certificate downloaded");
    } catch { toast.error("Failed to generate PDF"); }
    finally { setDownloading(false); }
  };

  const handlePrint = () => window.print();

  const handleShare = () => {
    const link = cert?.verificationToken
      ? `${window.location.origin}/verify/${cert.verificationToken}`
      : cert?.verificationLink;
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("Verification link copied");
  };

  const openDeleteModal = () => {
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deletingCertificate) return;
    setDeleteError(null);
    setDeleteModalOpen(false);
  };

  const handleDeleteCertificate = async () => {
    if (!certificateId || deletingCertificate) return;
    setDeletingCertificate(true);
    setDeleteError(null);

    try {
      await deleteCertificate(certificateId);
      qc.removeQueries({ queryKey: ["certificate", certificateId], exact: true });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["dashboard", "profile-summary"] });
      toast.success("Certificate deleted successfully");
      setDeleteModalOpen(false);
      nav("/certified", { replace: true });
    } catch (error: any) {
      const err = error as ApiClientError;
      const status = Number(err?.status || 0);

      if (status === 401) {
        qc.clear();
        clearAuth();
        toast.error("Session expired. Please log in again.");
        nav("/login", { replace: true });
        return;
      }

      if (status === 403) {
        const message = "You cannot delete this certificate";
        setDeleteError(message);
        toast.error(message);
        return;
      }

      const message = err?.message || "Failed to delete certificate";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeletingCertificate(false);
    }
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
      <div className="ct-cert-toolbar ct-no-print" style={{ justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ct-btn ct-btn-secondary ct-btn-sm" onClick={handlePrint}><Printer size={14} /> Print</button>
          <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={handleDownload} disabled={downloading} id="cert-download-btn">
            <Download size={14} /> {downloading ? "Generating..." : "Download PDF"}
          </button>
          <button className="ct-btn ct-btn-secondary ct-btn-sm" onClick={handleShare} id="cert-share-btn">
            <Share2 size={14} /> Share
          </button>
          <button
            className="ct-btn ct-btn-danger ct-btn-sm"
            onClick={openDeleteModal}
            disabled={deletingCertificate}
            id="delete-certificate-btn"
          >
            <Trash2 size={14} />
            {deletingCertificate ? "Deleting..." : "Delete Certificate"}
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

      {deleteModalOpen && createPortal(
        <div className="ct-modal-backdrop" onClick={closeDeleteModal}>
          <div className="ct-modal-card ct-delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ct-delete-modal-icon">
              <AlertTriangle size={22} />
            </div>
            <h3 className="ct-delete-modal-title">Delete Certificate?</h3>
            <p className="ct-delete-modal-text">
              This action permanently removes this certificate and cannot be undone.
            </p>
            <p className="ct-delete-modal-subtext">
              <strong>{cert.certificateNumber || cert.certificateId}</strong>
            </p>
            {deleteError && (
              <div className="ct-banner ct-banner-error" style={{ marginBottom: 12 }}>
                {deleteError}
              </div>
            )}
            <div className="ct-modal-actions">
              <button className="ct-btn ct-btn-secondary" onClick={closeDeleteModal} disabled={deletingCertificate}>
                Cancel
              </button>
              <button
                className="ct-btn ct-btn-danger"
                id="confirm-delete-certificate-btn"
                onClick={handleDeleteCertificate}
                disabled={deletingCertificate}
              >
                <Trash2 size={15} />
                {deletingCertificate ? "Deleting..." : "Delete Certificate"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
