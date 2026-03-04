import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Award, Download, Share2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { getCertificate, downloadCertificatePdf } from "../../api/certificate";
import type { CertificateInfo } from "../../types/api";

export function CertificatePage() {
  const { certificateId } = useParams();
  const nav = useNavigate();

  const [cert, setCert] = useState<CertificateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!certificateId) return;
    (async () => {
      try {
        const c = await getCertificate(certificateId);
        setCert(c);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load certificate");
      } finally {
        setLoading(false);
      }
    })();
  }, [certificateId]);

  const handleDownload = async () => {
    if (!certificateId) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(certificateId);
      toast.success("Downloaded!");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    if (!cert?.verificationLink) return;
    navigator.clipboard.writeText(cert.verificationLink);
    toast.success("Verification link copied!");
  };

  if (loading) {
    return (
      <div className="ct-loading" style={{ minHeight: 300 }}>
        <div className="ct-spinner" />
        <span>Loading certificate…</span>
      </div>
    );
  }

  if (!cert) return <div className="ct-empty">Certificate not found</div>;

  return (
    <div className="ct-slide-up" style={{ maxWidth: 600, margin: "0 auto" }}>
      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav("/home")} style={{ marginBottom: 16 }}>
        <ArrowLeft size={14} /> Dashboard
      </button>

      <div className="ct-glass-card" style={{ textAlign: "center" }}>
        <Award size={64} style={{ color: "var(--ct-success)", marginBottom: 16 }} />
        <h1 className="ct-page-title" style={{ marginBottom: 4 }}>Certificate of Completion</h1>
        <p style={{ color: "var(--ct-text-muted)", fontSize: 13, marginBottom: 24 }}>
          CertifyTube Verified Certificate
        </p>

        <div className="ct-card" style={{ textAlign: "left", marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
            <div>
              <div style={{ fontSize: 11, color: "var(--ct-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Certificate ID</div>
              <div style={{ fontWeight: 600, fontFamily: "monospace", marginTop: 2, fontSize: 12 }}>{cert.certificateId.slice(0, 12)}…</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="ct-btn ct-btn-primary" onClick={handleDownload} disabled={downloading} id="cert-download-btn">
            <Download size={16} />
            {downloading ? "Downloading…" : "Download PDF"}
          </button>
          <button className="ct-btn ct-btn-secondary" onClick={handleShare} id="cert-share-btn">
            <Share2 size={16} /> Copy Verification Link
          </button>
        </div>
      </div>
    </div>
  );
}
