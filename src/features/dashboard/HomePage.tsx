import { type ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play, BarChart3, ClipboardCheck, Award, BookOpen, Clock, RotateCcw, Sparkles } from "lucide-react";

import { getDashboard } from "../../api/dashboard";
import type { DashboardVideo, SessionStatus } from "../../types/api";

const ENGAGEMENT_THRESHOLD = 0.85;

type VideoInsight = {
  attempts: number;
  bestScore: number | null;
  engagedAttempts: number;
};

function sortByCreatedDesc(videos: DashboardVideo[]) {
  return [...videos].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

function buildVideoInsight(videos: DashboardVideo[]) {
  const map = new Map<string, VideoInsight>();
  for (const v of videos) {
    const prev = map.get(v.videoId) || { attempts: 0, bestScore: null, engagedAttempts: 0 };
    const score = v.engagementScore;
    const bestScore = score == null
      ? prev.bestScore
      : prev.bestScore == null
        ? score
        : Math.max(prev.bestScore, score);
    const engagedAttempts = score != null && score >= ENGAGEMENT_THRESHOLD
      ? prev.engagedAttempts + 1
      : prev.engagedAttempts;
    map.set(v.videoId, {
      attempts: prev.attempts + 1,
      bestScore,
      engagedAttempts,
    });
  }
  return map;
}

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

function actionFor(v: DashboardVideo) {
  if (!v.stemEligible) {
    return {
      icon: <RotateCcw size={14} />,
      text: "Watch Again",
      path: `/watch/${v.videoId}`,
      note: "Non-STEM video. Watch-only mode. No analysis, quiz, or certificate.",
    };
  }

  switch (v.status) {
    case "ACTIVE":
      return {
        icon: <Play size={14} />,
        text: "Continue",
        path: `/watch/${v.videoId}`,
        note: "Session in progress. End session before analysis.",
      };
    case "COMPLETED":
      if (v.engagementScore == null) {
        return {
          icon: <BarChart3 size={14} />,
          text: "Analyze Engagement",
          path: `/analyze/${v.sessionId}`,
          note: "Session ended. Analyze engagement to check quiz eligibility.",
        };
      }
      if (v.engagementScore < ENGAGEMENT_THRESHOLD) {
        return {
          icon: <RotateCcw size={14} />,
          text: "Watch Again",
          path: `/watch/${v.videoId}`,
          note: "Not engaged yet. Rewatch this video with a new session.",
        };
      }
      return {
        icon: <BarChart3 size={14} />,
        text: "Recheck Status",
        path: `/analyze/${v.sessionId}`,
        note: "Engagement passed. This session should appear under Quiz Pending.",
      };
    case "QUIZ_PENDING":
      return {
        icon: <ClipboardCheck size={14} />,
        text: "Take Quiz",
        path: `/quiz/${v.sessionId}`,
        note: "Eligible for quiz. Status remains quiz pending until you submit and pass.",
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

function VideoRow({
  v,
  onClick,
  insight,
}: {
  v: DashboardVideo;
  onClick: () => void;
  insight?: VideoInsight;
}) {
  const action = actionFor(v);

  return (
    <div className="ct-card ct-card-hover ct-learning-row" onClick={onClick}>
      <img
        src={v.thumbnailUrl || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
        alt={v.videoTitle}
        className="ct-learning-row-thumb"
      />

      <div className="ct-learning-row-content">
        <div className="ct-learning-row-top">
          {statusBadge(v.status)}
          {v.stemEligible ? (
            <span className="ct-badge ct-badge-stem">STEM</span>
          ) : (
            <span className="ct-badge ct-badge-not-stem">Non-STEM</span>
          )}
        </div>

        <div className="ct-learning-row-title">{v.videoTitle}</div>

        <div className="ct-learning-row-meta">
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} />
            {v.videoDurationSec ? formatDuration(v.videoDurationSec) : "-"}
          </span>
          {v.engagementScore != null && <span>Score: {(v.engagementScore * 100).toFixed(0)}%</span>}
        </div>

        <div className="ct-learning-row-meta" style={{ marginTop: 6 }}>
          <span>Session: {v.sessionId.slice(0, 8)}</span>
          {insight && <span>Attempts: {insight.attempts}</span>}
          {insight?.bestScore != null && <span>Best: {(insight.bestScore * 100).toFixed(0)}%</span>}
          {insight && insight.engagedAttempts > 0 && <span>Engaged: {insight.engagedAttempts}</span>}
        </div>

        <p className="ct-learning-row-note">{action.note}</p>
      </div>

      <div className="ct-learning-row-action">
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
  insightByVideoId,
}: {
  title: string;
  icon: ReactNode;
  videos: DashboardVideo[];
  emptyText: string;
  onOpen: (v: DashboardVideo) => void;
  insightByVideoId: Map<string, VideoInsight>;
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
        videos.map((v) => (
          <VideoRow
            key={v.sessionId}
            v={v}
            onClick={() => onOpen(v)}
            insight={insightByVideoId.get(v.videoId)}
          />
        ))
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

  const activeAll = useMemo(() => sortByCreatedDesc(data?.activeVideos || []), [data]);
  const completedAll = useMemo(() => sortByCreatedDesc(data?.completedVideos || []), [data]);
  const quizPendingAll = useMemo(() => sortByCreatedDesc(data?.quizPendingVideos || []), [data]);
  const certifiedAll = useMemo(() => sortByCreatedDesc(data?.certifiedVideos || []), [data]);
  const allSessions = useMemo(
    () => [...activeAll, ...completedAll, ...quizPendingAll, ...certifiedAll],
    [activeAll, completedAll, quizPendingAll, certifiedAll],
  );
  const insightByVideoId = useMemo(() => buildVideoInsight(allSessions), [allSessions]);

  const activeVideos = useMemo(() => activeAll.filter((v) => v.stemEligible), [activeAll]);
  const completedVideos = useMemo(() => completedAll.filter((v) => v.stemEligible), [completedAll]);
  const quizPendingVideos = useMemo(() => quizPendingAll.filter((v) => v.stemEligible), [quizPendingAll]);
  const nonStemVideos = useMemo(
    () => sortByCreatedDesc(allSessions.filter((v) => !v.stemEligible)),
    [allSessions],
  );

  const openVideo = (v: DashboardVideo) => {
    const action = actionFor(v);
    if (action.path.startsWith("/watch/")) {
      nav(action.path, { state: { videoTitle: v.videoTitle } });
      return;
    }
    if (action.path.startsWith("/analyze/")) {
      nav(action.path, { state: { videoId: v.videoId, videoTitle: v.videoTitle } });
      return;
    }
    if (action.path.startsWith("/quiz/")) {
      nav(action.path, { state: { sessionId: v.sessionId } });
      return;
    }
    nav(action.path);
  };

  return (
    <div className="ct-slide-up">
      <h1 className="ct-page-title">My Learnings</h1>
      <p className="ct-page-subtitle">Session history by status with scores, attempts, and session IDs.</p>

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
            insightByVideoId={insightByVideoId}
          />

          <Section
            title="Completed"
            icon={<BookOpen size={20} style={{ color: "var(--ct-accent-light)" }} />}
            videos={completedVideos}
            emptyText="No completed sessions yet."
            onOpen={openVideo}
            insightByVideoId={insightByVideoId}
          />

          <Section
            title="Quiz Pending"
            icon={<Sparkles size={20} style={{ color: "var(--ct-warning)" }} />}
            videos={quizPendingVideos}
            emptyText="No quiz-pending videos yet."
            onOpen={openVideo}
            insightByVideoId={insightByVideoId}
          />

          <Section
            title="Non-STEM Watch-Only"
            icon={<RotateCcw size={20} style={{ color: "var(--ct-text-muted)" }} />}
            videos={nonStemVideos}
            emptyText="No non-STEM sessions yet."
            onOpen={openVideo}
            insightByVideoId={insightByVideoId}
          />
        </>
      )}
    </div>
  );
}
