import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, ExternalLink, Printer, Share2 } from "lucide-react";
import toast from "react-hot-toast";

import { getDashboard } from "../../api/dashboard";
import { downloadCertificatePdf, getCertificate } from "../../api/certificate";
import { useAuthStore } from "../../store/useAuthStore";
import type { DashboardVideo } from "../../types/api";

function formatNameFromEmail(email?: string): string {
  if (!email) return "Certified Learner";
  const local = email.split("@")[0] || "learner";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findContextVideo(all: DashboardVideo[], sessionId: string, certificateId: string): DashboardVideo | null {
  const bySession = all.find((v) => v.sessionId === sessionId);
  if (bySession) return bySession;
  const byCert = all.find((v) => v.certificateId === certificateId);
  return byCert || null;
}

export function CertificatePage() {
  const { certificateId } = useParams();
  const nav = useNavigate();
  const { user } = useAuthStore();

  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const certQuery = useQuery({
    queryKey: ["certificate", certificateId],
    queryFn: () => getCertificate(certificateId!),
    enabled: Boolean(certificateId),
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "certificate-context", certificateId],
    queryFn: () => getDashboard(),
    enabled: Boolean(certificateId),
  });

  const cert = certQuery.data || null;

  const contextVideo = useMemo(() => {
    if (!cert) return null;
    const data = dashboardQuery.data;
    const all = [
      ...(data?.activeVideos || []),
      ...(data?.completedVideos || []),
      ...(data?.quizPendingVideos || []),
      ...(data?.certifiedVideos || []),
    ];
    return findContextVideo(all, cert.sessionId, cert.certificateId);
  }, [cert, dashboardQuery.data]);

  const learnerName = cert?.learnerName?.trim() || formatNameFromEmail(user?.email);
  const platformName = cert?.platformName?.trim() || "CertifyTube";
  const attribution = cert?.platformAttribution?.trim() || "CertifyTube Digital Verification Framework";

  const videoTitle = cert?.videoTitle?.trim() || contextVideo?.videoTitle || "YouTube Educational Content";
  const videoId = cert?.videoId?.trim() || contextVideo?.videoId || "";
  const videoUrl = cert?.videoUrl?.trim() || (videoId ? `https://youtube.com/watch?v=${videoId}` : "");

  const engagementThreshold = cert?.engagementThreshold ?? 0.85;
  const quizThreshold = cert?.quizThreshold ?? 0.8;

  const qrUrl = cert?.verificationLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cert.verificationLink)}`
    : "";

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

  const handlePrint = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrinting(false), 300);
    }, 60);
  };

  const handleShare = () => {
    if (!cert?.verificationLink) return;
    navigator.clipboard.writeText(cert.verificationLink);
    toast.success("Verification link copied");
  };

  if (certQuery.isLoading) {
    return (
      <div className="ct-loading" style={{ minHeight: 300 }}>
        <div className="ct-spinner" />
        <span>Loading certificate...</span>
      </div>
    );
  }

  if (!cert || certQuery.isError) {
    return <div className="ct-empty">Certificate not found</div>;
  }
  const issuedYear = new Date(cert.createdAtUtc).getFullYear();

  return (
    <div className="ct-slide-up ct-cert-page-wrap">
      <div className="ct-cert-toolbar ct-print-hide">
        <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav("/my-learnings")}>
          <ArrowLeft size={14} /> My Learnings
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="ct-btn ct-btn-secondary ct-btn-sm" onClick={handlePrint} disabled={printing}>
            <Printer size={14} />
            {printing ? "Preparing..." : "Save Styled PDF"}
          </button>
          <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={handleDownload} disabled={downloading} id="cert-download-btn">
            <Download size={14} />
            {downloading ? "Downloading..." : "Download Backend PDF"}
          </button>
          <button className="ct-btn ct-btn-secondary ct-btn-sm" onClick={handleShare} id="cert-share-btn">
            <Share2 size={14} /> Copy Verify Link
          </button>
        </div>
      </div>

      <article className="ct-certificate ct-certificate-template" id="certificate-view">
        <div className="ct-certificate-inner">
          <header className="ct-cert-top">
            <section className="ct-cert-top-main">
              <h1 className="ct-certificate-title">Certificate of Verified Informal Learning</h1>
              <p className="ct-cert-presented">Proudly presented to</p>
              <h2 className="ct-cert-learner">{learnerName}</h2>

              <p className="ct-cert-description">
                Successfully demonstrated verified learning from YouTube educational content under CertifyTube dual-verification criteria.
              </p>

              <div className="ct-cert-source">
                <p className="ct-cert-block-title">Video</p>
                <p className="ct-cert-video-title">{videoTitle}</p>
                {videoUrl ? (
                  <a className="ct-cert-video-link" href={videoUrl} target="_blank" rel="noreferrer">
                    {videoUrl} <ExternalLink size={14} />
                  </a>
                ) : (
                  <p className="ct-cert-muted">Video link unavailable in current API response</p>
                )}
              </div>

              <div className="ct-cert-meta-inline">
                <span className="ct-cert-chip">Certificate Nr: {cert.certificateNumber || cert.certificateId}</span>
                <span className="ct-cert-chip chip-light">Certified on: {new Date(cert.createdAtUtc).toLocaleDateString()}</span>
              </div>
            </section>

            <aside className="ct-cert-top-side">
              <div className="ct-cert-brand-panel">
                <div className="ct-cert-brand-mark">
                  <span className="ct-cert-brand-dot" />
                  <span>{platformName}</span>
                </div>
                <p className="ct-cert-brand-sub">Learning Verification Platform</p>
              </div>
              <div className="ct-cert-seal">
                <span>CERTIFIED</span>
                <strong>{issuedYear}</strong>
              </div>
            </aside>
          </header>

          <section className="ct-cert-evidence-row">
            <div className="ct-cert-rule compact">
              <p className="ct-cert-rule-title">Certification Rule</p>
              <p className="ct-cert-rule-text">
                Engagement &gt;= {engagementThreshold.toFixed(2)} AND Quiz &gt;= {quizThreshold.toFixed(2)}
              </p>
            </div>
          </section>

          <footer className="ct-certificate-foot">
            <div className="ct-cert-sign-wrap">
              <p className="ct-cert-attribution">
                Issued by <strong>{attribution}</strong>
              </p>
              <p className="ct-cert-attribution-sub">Digitally issued certificate (no physical signature required)</p>
            </div>

            <div className="ct-cert-foot-right">
              {qrUrl ? (
                <>
                  <img src={qrUrl} alt="Certificate verification QR" className="ct-cert-qr" />
                  <p className="ct-cert-qr-text">Scan to verify certificate</p>
                </>
              ) : (
                <p className="ct-cert-muted">Verification link unavailable</p>
              )}
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
