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
    <div className="ct-card ct-card-hover" style={{ display: "flex", gap: 16, padding: 16, marginBottom: 12 }}>
      <img
        src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
        alt={video.videoTitle}
        style={{ width: 160, height: 90, borderRadius: "var(--ct-radius-sm)", objectFit: "cover", flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="ct-badge ct-badge-certified">Certified</span>
          <span className="ct-badge ct-badge-stem">STEM</span>
        </div>

        <div
          style={{
            fontWeight: 650,
            fontSize: 15,
            marginBottom: 4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {video.videoTitle}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--ct-text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} />
            {video.videoDurationSec ? formatDuration(video.videoDurationSec) : "-"}
          </span>
          {video.engagementScore != null && <span>Engagement: {(video.engagementScore * 100).toFixed(0)}%</span>}
          <span>{new Date(video.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
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
