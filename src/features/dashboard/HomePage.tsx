import { type ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play, BarChart3, ClipboardCheck, Award, BookOpen, Clock, RotateCcw, Sparkles } from "lucide-react";

import { getDashboard } from "../../api/dashboard";
import type { DashboardVideo, SessionStatus } from "../../types/api";

const ENGAGEMENT_THRESHOLD = 0.85;

function statusBadge(status: SessionStatus) {
  const map: Record<SessionStatus, { cls: string; label: string }> = {
    ACTIVE: { cls: "ct-badge-active", label: "Active" },
    COMPLETED: { cls: "ct-badge-completed", label: "Completed" },
    QUIZ_PENDING: { cls: "ct-badge-quiz", label: "Quiz Pending" },
    CERTIFIED: { cls: "ct-badge-certified", label: "Certified" },
  };
  const b = map[status] || { cls: "", label: status };
  return <span className={`ct-badge ${b.cls}`}>{b.label}</span>;
}

function completedAction(v: DashboardVideo) {
  if (!v.stemEligible) {
    return {
      icon: <RotateCcw size={14} />,
      text: "Watch Again",
      path: `/watch/${v.videoId}`,
      note: "Non-STEM video. Certificate flow unavailable for this session.",
    };
  }

  if (v.engagementScore == null) {
    return {
      icon: <BarChart3 size={14} />,
      text: "Analyze Engagement",
      path: `/analyze/${v.sessionId}`,
      note: "Session ended. Analyze engagement to unlock quiz.",
    };
  }

  if (v.engagementScore < ENGAGEMENT_THRESHOLD) {
    return {
      icon: <RotateCcw size={14} />,
      text: "Watch Again",
      path: `/watch/${v.videoId}`,
      note: "Not engaged yet. Rewatch and analyze again.",
    };
  }

  return {
    icon: <ClipboardCheck size={14} />,
    text: "Take Quiz",
    path: `/quiz/${v.sessionId}`,
    note: "Engagement passed. Quiz is ready.",
  };
}

function actionFor(v: DashboardVideo) {
  switch (v.status) {
    case "ACTIVE":
      return {
        icon: <Play size={14} />,
        text: "Continue",
        path: `/watch/${v.videoId}`,
        note: "Session in progress. End session before analysis.",
      };
    case "COMPLETED":
      return completedAction(v);
    case "QUIZ_PENDING":
      return {
        icon: <ClipboardCheck size={14} />,
        text: "Take Quiz",
        path: `/quiz/${v.sessionId}`,
        note: "You are eligible. Complete quiz within 2 attempts.",
      };
    case "CERTIFIED":
      return {
        icon: <Award size={14} />,
        text: "View Certificate",
        path: `/certificate/${v.certificateId}`,
        note: "Quiz passed. Certificate issued for this session.",
      };
  }
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoRow({ v, onClick }: { v: DashboardVideo; onClick: () => void }) {
  const action = actionFor(v);

  return (
    <div
      className="ct-card ct-card-hover"
      style={{ display: "flex", gap: 16, cursor: "pointer", padding: 16, marginBottom: 12 }}
      onClick={onClick}
    >
      <img
        src={v.thumbnailUrl || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
        alt={v.videoTitle}
        style={{ width: 160, height: 90, borderRadius: "var(--ct-radius-sm)", objectFit: "cover", flexShrink: 0 }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {statusBadge(v.status)}
          {v.stemEligible ? (
            <span className="ct-badge ct-badge-stem">STEM</span>
          ) : (
            <span className="ct-badge ct-badge-not-stem">Non-STEM</span>
          )}
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
          {v.videoTitle}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--ct-text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} />
            {v.videoDurationSec ? formatDuration(v.videoDurationSec) : "-"}
          </span>
          {v.progressPercent != null && <span>{v.progressPercent.toFixed(0)}% watched</span>}
          {v.engagementScore != null && <span>Score: {(v.engagementScore * 100).toFixed(0)}%</span>}
        </div>

        <p style={{ marginTop: 8, fontSize: 12, color: "var(--ct-text-secondary)" }}>{action.note}</p>

        {v.status === "ACTIVE" && v.progressPercent != null && (
          <div className="ct-progress" style={{ marginTop: 8, maxWidth: 320 }}>
            <div className="ct-progress-bar" style={{ width: `${Math.min(v.progressPercent, 100)}%` }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <span className="ct-btn ct-btn-primary ct-btn-sm">
          {action.icon}
          {action.text}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  videos,
  emptyText,
  onOpen,
}: {
  title: string;
  icon: ReactNode;
  videos: DashboardVideo[];
  emptyText: string;
  onOpen: (v: DashboardVideo) => void;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 className="ct-section-title">
        {icon}
        {title}
      </h2>

      {videos.length === 0 ? (
        <div className="ct-card" style={{ textAlign: "center", padding: 26, color: "var(--ct-text-muted)" }}>
          {emptyText}
        </div>
      ) : (
        videos.map((v) => <VideoRow key={v.sessionId} v={v} onClick={() => onOpen(v)} />)
      )}
    </div>
  );
}

export function MyLearningsPage() {
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "all-statuses"],
    queryFn: () => getDashboard(),
  });

  const activeVideos = useMemo(() => data?.activeVideos || [], [data]);
  const completedVideos = useMemo(() => data?.completedVideos || [], [data]);
  const quizPendingVideos = useMemo(() => data?.quizPendingVideos || [], [data]);

  const openVideo = (v: DashboardVideo) => {
    const action = actionFor(v);
    nav(action.path, v.status === "QUIZ_PENDING" ? { state: { sessionId: v.sessionId } } : undefined);
  };

  return (
    <div className="ct-slide-up">
      <h1 className="ct-page-title">My Learnings</h1>
      <p className="ct-page-subtitle">Track status for every video: active, completed, and quiz pending.</p>

      <div className="ct-stat-grid" style={{ marginBottom: 24 }}>
        <div className="ct-stat-card"><div className="ct-stat-value">{activeVideos.length}</div><div className="ct-stat-label">Active</div></div>
        <div className="ct-stat-card"><div className="ct-stat-value">{completedVideos.length}</div><div className="ct-stat-label">Completed</div></div>
        <div className="ct-stat-card"><div className="ct-stat-value">{quizPendingVideos.length}</div><div className="ct-stat-label">Quiz Pending</div></div>
      </div>

      {isLoading ? (
        <div className="ct-loading"><div className="ct-spinner" /><span>Loading statuses...</span></div>
      ) : (
        <>
          <Section
            title="Active Sessions"
            icon={<Play size={20} style={{ color: "var(--ct-info)" }} />}
            videos={activeVideos}
            emptyText="No active sessions right now."
            onOpen={openVideo}
          />

          <Section
            title="Quiz Pending"
            icon={<Sparkles size={20} style={{ color: "var(--ct-warning)" }} />}
            videos={quizPendingVideos}
            emptyText="No quiz-pending videos yet."
            onOpen={openVideo}
          />

          <Section
            title="Completed"
            icon={<BookOpen size={20} style={{ color: "var(--ct-accent-light)" }} />}
            videos={completedVideos}
            emptyText="No completed sessions yet."
            onOpen={openVideo}
          />
        </>
      )}
    </div>
  );
}
