import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, Eye, Clock } from "lucide-react";
import { getDashboard } from "../../api/dashboard";
import type { DashboardVideo } from "../../types/api";

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CertifiedRow({ video, onOpen }: { video: DashboardVideo; onOpen: () => void }) {
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
        <button className="ct-btn ct-btn-primary ct-btn-sm" onClick={onOpen} disabled={!video.certificateId}>
          <Eye size={14} />
          View Certificate
        </button>
      </div>
    </div>
  );
}

export function CertifiedPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "certified-only"],
    queryFn: () => getDashboard("CERTIFIED"),
  });

  const certifiedVideos = useMemo(
    () => [...(data?.certifiedVideos || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data],
  );

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
            onOpen={() => video.certificateId && navigate(`/certificate/${video.certificateId}`)}
          />
        ))
      )}
    </div>
  );
}
