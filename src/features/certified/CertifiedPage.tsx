import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Award, Eye, Clock, Trash2, AlertTriangle } from "lucide-react";
import { getDashboard } from "../../api/dashboard";
import { deleteCertificate } from "../../api/certificate";
import type { ApiClientError } from "../../api/http";
import type { DashboardVideo } from "../../types/api";
import { useAuthStore } from "../../store/useAuthStore";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CertifiedRow({
  video,
  onOpen,
  onDelete,
  deleting,
}: {
  video: DashboardVideo;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="ct-card ct-card-hover ct-certified-row">
      <img
        src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
        alt={video.videoTitle}
        className="ct-certified-thumb"
      />

      <div className="ct-certified-content">
        <div className="ct-certified-top">
          <span className="ct-badge ct-badge-certified">Certified</span>
          <span className="ct-badge ct-badge-stem">STEM</span>
        </div>

        <div className="ct-certified-title">
          {video.videoTitle}
        </div>

        <div className="ct-certified-meta">
          <span className="ct-certified-meta-item">
            <Clock size={12} />
            {video.videoDurationSec ? formatDuration(video.videoDurationSec) : "-"}
          </span>
          {video.engagementScore != null && <span>Engagement: {(video.engagementScore * 100).toFixed(0)}%</span>}
          <span>{new Date(video.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="ct-certified-action">
        <button
          className="ct-btn ct-btn-danger ct-btn-sm"
          onClick={onDelete}
          disabled={deleting || !video.certificateId}
          title="Delete this certificate"
        >
          <Trash2 size={14} />
          {deleting ? "Deleting..." : "Delete"}
        </button>
        <button
          className="ct-btn ct-btn-primary ct-certified-view-btn"
          onClick={onOpen}
          disabled={!video.certificateId}
        >
          <Eye size={14} />
          View Certificate
        </button>
      </div>
    </div>
  );
}

export function CertifiedPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const [deleteTarget, setDeleteTarget] = useState<DashboardVideo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "certified-only"],
    queryFn: () => getDashboard("CERTIFIED"),
  });

  const certifiedVideos = useMemo(
    () => [...(data?.certifiedVideos || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data],
  );
  const hasOpenModal = Boolean(deleteTarget);

  const deleteMutation = useMutation({
    mutationFn: (certificateId: string) => deleteCertificate(certificateId),
    onSuccess: () => {
      toast.success("Certificate deleted successfully");
      setDeleteTarget(null);
      setDeleteError(null);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: any) => {
      const err = error as ApiClientError;
      const status = Number(err?.status || 0);
      const fallback = "Failed to delete certificate";
      const message = status === 403
        ? "You cannot delete this certificate"
        : (err?.message || fallback);
      setDeleteError(message);
      toast.error(message);
      if (status === 401) {
        qc.clear();
        clearAuth();
        navigate("/login", { replace: true });
      }
    },
  });

  const requestDelete = (video: DashboardVideo) => {
    if (!video.certificateId) {
      toast.error("Certificate not found");
      return;
    }
    setDeleteError(null);
    setDeleteTarget(video);
  };

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const confirmDelete = () => {
    if (!deleteTarget?.certificateId || deleteMutation.isPending) return;
    deleteMutation.mutate(deleteTarget.certificateId);
  };

  useEffect(() => {
    if (!hasOpenModal) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [hasOpenModal]);

  return (
    <div className="ct-slide-up">
      <h1 className="ct-page-title">Certified</h1>
      <p className="ct-page-subtitle">All sessions that passed quiz and issued certificates.</p>

      {isLoading ? (
        <div className="ct-loading">
          <div className="ct-spinner" />
          <span>Loading certificates...</span>
        </div>
      ) : certifiedVideos.length === 0 ? (
        <div className="ct-card" style={{ textAlign: "center", padding: 28, color: "var(--ct-text-muted)" }}>
          <Award size={28} style={{ margin: "0 auto 10px", color: "var(--ct-text-muted)" }} />
          No certified sessions yet.
        </div>
      ) : (
        certifiedVideos.map((video) => (
          <CertifiedRow
            key={video.sessionId}
            video={video}
            onOpen={() => video.certificateId && navigate(`/certificate/${video.certificateId}`, {
              state: { fromPath: "/certified" },
            })}
            onDelete={() => requestDelete(video)}
            deleting={
              deleteMutation.isPending
              && Boolean(deleteMutation.variables)
              && deleteMutation.variables === video.certificateId
            }
          />
        ))
      )}

      {deleteTarget && createPortal(
        <div className="ct-modal-backdrop" onClick={closeDeleteModal}>
          <div className="ct-modal-card ct-delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ct-delete-modal-icon">
              <AlertTriangle size={22} />
            </div>
            <h3 className="ct-delete-modal-title">Delete Certificate?</h3>
            <p className="ct-delete-modal-text">
              This will permanently delete the certificate for this video.
            </p>
            <p className="ct-delete-modal-subtext">
              <strong>{deleteTarget.videoTitle}</strong>
            </p>
            {deleteError && (
              <div className="ct-banner ct-banner-error" style={{ marginTop: 12, marginBottom: 0 }}>
                {deleteError}
              </div>
            )}
            <div className="ct-modal-actions" style={{ marginTop: 16 }}>
              <button className="ct-btn ct-btn-secondary" onClick={closeDeleteModal} disabled={deleteMutation.isPending}>
                Cancel
              </button>
              <button className="ct-btn ct-btn-danger" onClick={confirmDelete} disabled={deleteMutation.isPending}>
                <Trash2 size={15} />
                {deleteMutation.isPending ? "Deleting..." : "Delete Certificate"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
