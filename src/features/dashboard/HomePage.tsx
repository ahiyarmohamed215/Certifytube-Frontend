import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Play, BarChart3, ClipboardCheck, Award, BookOpen, Clock, RotateCcw, Sparkles, Trash2, AlertTriangle, Menu, X } from "lucide-react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import { getDashboard } from "../../api/dashboard";
import { deleteSessionRecord } from "../../api/sessions";
import type { DashboardVideo, SessionStatus } from "../../types/api";

const ENGAGEMENT_THRESHOLD = 0.85;

type VideoInsight = {
  sessions: number;
  rewatchAttempts: number;
  bestScore: number | null;
  lastScore: number | null;
  engagedAttempts: number;
};

type StemFilter = "all" | "stem" | "nonstem";
type LearningStatusTab = "active" | "completed" | "quiz";
type PersistedWatchContext = {
  videoId: string;
  videoTitle?: string;
  fromStatus?: LearningStatusTab;
  fromPath?: string;
  sessionId?: string;
  lastPositionSec?: number;
  showBanner?: boolean;
};

const WATCH_RESUME_KEY = "ct_watch_resume_context";
const WATCH_CONTEXT_EVENT = "ct-watch-context-change";

function readPersistedWatchContext(): PersistedWatchContext | null {
  let raw = "";
  try {
    raw = sessionStorage.getItem(WATCH_RESUME_KEY) || "";
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PersistedWatchContext;
    if (!parsed?.videoId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function applyStemFilter(videos: DashboardVideo[], filter: StemFilter) {
  if (filter === "stem") return videos.filter((v) => v.stemEligible);
  if (filter === "nonstem") return videos.filter((v) => !v.stemEligible);
  return videos;
}

function sortByCreatedDesc(videos: DashboardVideo[]) {
  return [...videos].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

function latestSessionByVideo(videos: DashboardVideo[]) {
  const sorted = sortByCreatedDesc(videos);
  const seen = new Set<string>();
  const out: DashboardVideo[] = [];
  for (const v of sorted) {
    if (seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    out.push(v);
  }
  return out;
}

function buildVideoInsight(videos: DashboardVideo[]) {
  const sorted = sortByCreatedDesc(videos);
  const map = new Map<string, VideoInsight>();
  for (const v of sorted) {
    const prev = map.get(v.videoId) || {
      sessions: 0,
      rewatchAttempts: 0,
      bestScore: null,
      lastScore: null,
      engagedAttempts: 0,
    };
    const score = v.engagementScore;
    const bestScore = score == null
      ? prev.bestScore
      : prev.bestScore == null
        ? score
        : Math.max(prev.bestScore, score);
    const lastScore = prev.lastScore == null && score != null ? score : prev.lastScore;
    // Rewatch attempts are counted by how many additional sessions were created
    // for the same video after the first watch session.
    const rewatchAttempts = prev.sessions;
    const engagedAttempts = score != null && score >= ENGAGEMENT_THRESHOLD
      ? prev.engagedAttempts + 1
      : prev.engagedAttempts;
    map.set(v.videoId, {
      sessions: prev.sessions + 1,
      rewatchAttempts,
      bestScore,
      lastScore,
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
    if (v.status === "ACTIVE") {
      return {
        icon: <Play size={14} />,
        text: "Continue",
        path: `/watch/${v.videoId}`,
        note: "Non-STEM video. Watch-only mode. No analysis, quiz, or certificate.",
      };
    }
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
        icon: <ClipboardCheck size={14} />,
        text: "Take Quiz",
        path: `/quiz/${v.sessionId}`,
        note: "Engagement passed. You can take the quiz now.",
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
  onDelete,
  onOpenAttempts,
  deleting,
  insight,
}: {
  v: DashboardVideo;
  onClick: () => void;
  onDelete: () => void;
  onOpenAttempts: () => void;
  deleting: boolean;
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
          {insight && <span>Sessions: {insight.sessions}</span>}
          {insight && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAttempts();
              }}
              style={{
                border: "none",
                background: "none",
                color: "var(--ct-accent-light)",
                cursor: "pointer",
                fontWeight: 700,
                padding: 0,
              }}
              title="View attempts for this video"
            >
              Rewatch Attempts: {insight.rewatchAttempts}
            </button>
          )}
          {insight?.bestScore != null && <span>Best: {(insight.bestScore * 100).toFixed(0)}%</span>}
          {v.engagementScore == null && insight?.lastScore != null && (
            <span>Last: {(insight.lastScore * 100).toFixed(0)}%</span>
          )}
          {insight && insight.engagedAttempts > 0 && <span>Engaged: {insight.engagedAttempts}</span>}
        </div>

        <p className="ct-learning-row-note">{action.note}</p>
      </div>

      <div className="ct-learning-row-action">
        <button
          className="ct-btn ct-btn-danger ct-btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          title="Delete this session"
          style={{ marginRight: 8 }}
        >
          <Trash2 size={14} />
          {deleting ? "Deleting..." : "Delete"}
        </button>
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
  onDelete,
  onOpenAttempts,
  deletingSessionId,
  insightByVideoId,
}: {
  title: string;
  icon: ReactNode;
  videos: DashboardVideo[];
  emptyText: string;
  onOpen: (v: DashboardVideo) => void;
  onDelete: (sessionId: string) => void;
  onOpenAttempts: (videoId: string) => void;
  deletingSessionId: string | null;
  insightByVideoId: Map<string, VideoInsight>;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
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
            onDelete={() => onDelete(v.sessionId)}
            onOpenAttempts={() => onOpenAttempts(v.videoId)}
            deleting={deletingSessionId === v.sessionId}
            insight={insightByVideoId.get(v.videoId)}
          />
        ))
      )}
    </section>
  );
}

export function MyLearningsPage() {
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [attemptsVideoId, setAttemptsVideoId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardVideo | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<LearningStatusTab>(() => {
    const stateStatus = (location.state as { initialStatus?: LearningStatusTab } | null)?.initialStatus;
    if (stateStatus === "active" || stateStatus === "completed" || stateStatus === "quiz") {
      return stateStatus;
    }
    const status = searchParams.get("status");
    if (status === "completed" || status === "quiz" || status === "active") {
      return status;
    }
    return "active";
  });
  const [stemFilter, setStemFilter] = useState<StemFilter>("all");
  const [resumeContext, setResumeContext] = useState<PersistedWatchContext | null>(() => readPersistedWatchContext());
  const hasOpenModal = Boolean(deleteTarget || attemptsVideoId);
  const showResumeBanner = Boolean(resumeContext && resumeContext.showBanner !== false);

  useEffect(() => {
    if (location.pathname !== "/my-learnings") return;
    const next = readPersistedWatchContext();
    setResumeContext(next);
    if (!next) {
      try {
        sessionStorage.removeItem(WATCH_RESUME_KEY);
      } catch {
        // noop
      }
    }
  }, [location.pathname, location.key]);

  const toggleStemFilter = (next: StemFilter) => {
    setStemFilter((prev) => {
      if (next === "all") return "all";
      return prev === next ? "all" : next;
    });
  };

  const closeResumeContext = () => {
    try {
      sessionStorage.removeItem(WATCH_RESUME_KEY);
    } catch {
      // noop
    }
    setResumeContext(null);
    window.dispatchEvent(new Event(WATCH_CONTEXT_EVENT));
  };

  const continueResumeContext = () => {
    if (!resumeContext?.videoId) {
      closeResumeContext();
      return;
    }
    const resumeStatus: LearningStatusTab = resumeContext.fromStatus === "active" || resumeContext.fromStatus === "completed" || resumeContext.fromStatus === "quiz"
      ? resumeContext.fromStatus
      : "active";
    const resumePath = (resumeContext.fromPath || `/my-learnings?status=${resumeStatus}`).trim();
    nav(`/watch/${resumeContext.videoId}`, {
      state: {
        videoTitle: resumeContext.videoTitle,
        fromStatus: resumeStatus,
        fromPath: resumePath,
        sessionId: resumeContext.sessionId,
        lastPositionSec: resumeContext.lastPositionSec,
      },
    });
  };

  const resumeFromLabel = resumeContext?.fromStatus === "completed"
    ? "Completed"
    : resumeContext?.fromStatus === "quiz"
      ? "Quiz Pending"
      : "Active";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "all-statuses"],
    queryFn: () => getDashboard(),
  });

  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteSessionRecord(sessionId),
    onSuccess: () => {
      toast.success("Session deleted");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Delete failed");
    },
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
  const attemptsSessions = useMemo(
    () => attemptsVideoId ? sortByCreatedDesc(allSessions.filter((s) => s.videoId === attemptsVideoId)) : [],
    [allSessions, attemptsVideoId],
  );
  const attemptsTitle = attemptsSessions[0]?.videoTitle || "";

  const absoluteLatest = useMemo(() => latestSessionByVideo(allSessions), [allSessions]);

  const quizPendingVideos = useMemo(() => {
    return absoluteLatest.filter((v) => {
      if (!v.stemEligible) return false;
      if (v.status === "QUIZ_PENDING") return true;
      if (v.status === "COMPLETED" && v.engagementScore != null && v.engagementScore >= ENGAGEMENT_THRESHOLD) return true;
      if (v.status === "CERTIFIED" && !v.certificateId) return true;
      return false;
    }).map((v) => ({ ...v, status: "QUIZ_PENDING" as const }));
  }, [absoluteLatest]);

  const activeVideos = useMemo(() => {
    return absoluteLatest.filter((v) => v.status === "ACTIVE");
  }, [absoluteLatest]);

  const completedVideos = useMemo(() => {
    return absoluteLatest.filter((v) => {
      if (!v.stemEligible && v.status === "COMPLETED") return true;
      if (v.stemEligible && v.status === "COMPLETED" && (v.engagementScore == null || v.engagementScore < ENGAGEMENT_THRESHOLD)) return true;
      return false;
    });
  }, [absoluteLatest]);

  const activeFilteredVideos = useMemo(
    () => applyStemFilter(activeVideos, stemFilter),
    [activeVideos, stemFilter],
  );
  const completedFilteredVideos = useMemo(
    () => applyStemFilter(completedVideos, stemFilter),
    [completedVideos, stemFilter],
  );
  const quizPendingFilteredVideos = useMemo(
    () => applyStemFilter(quizPendingVideos, stemFilter),
    [quizPendingVideos, stemFilter],
  );

  const sideNavItems = [
    {
      key: "active" as const,
      label: "Active",
      count: activeFilteredVideos.length,
      navIcon: <Play size={14} />,
    },
    {
      key: "completed" as const,
      label: "Completed",
      count: completedFilteredVideos.length,
      navIcon: <BookOpen size={14} />,
    },
    {
      key: "quiz" as const,
      label: "Quiz Pending",
      count: quizPendingFilteredVideos.length,
      navIcon: <Sparkles size={14} />,
    },
  ];

  const openVideo = (v: DashboardVideo) => {
    const action = actionFor(v);
    const fromStatus: LearningStatusTab = selectedStatus;
    const fromPath = `/my-learnings?status=${fromStatus}`;
    const latestResumeContext = readPersistedWatchContext();
    const resumeLastPosition = latestResumeContext
      && latestResumeContext.videoId === v.videoId
      && (!latestResumeContext.sessionId || latestResumeContext.sessionId === v.sessionId)
      && typeof latestResumeContext.lastPositionSec === "number"
      && Number.isFinite(latestResumeContext.lastPositionSec)
      && latestResumeContext.lastPositionSec > 0
      ? latestResumeContext.lastPositionSec
      : v.lastPositionSec;
    if (action.path.startsWith("/watch/")) {
      nav(action.path, {
        state: {
          videoTitle: v.videoTitle,
          fromStatus,
          fromPath,
          ...(v.status === "ACTIVE"
            ? {
              sessionId: v.sessionId,
              stemEligible: v.stemEligible,
              lastPositionSec: resumeLastPosition,
            }
            : {}),
        },
      });
      return;
    }
    if (action.path.startsWith("/analyze/")) {
      nav(action.path, { state: { videoId: v.videoId, videoTitle: v.videoTitle, fromStatus, fromPath } });
      return;
    }
    if (action.path.startsWith("/quiz/")) {
      nav(action.path, {
        state: {
          sessionId: v.sessionId,
          videoId: v.videoId,
          videoTitle: v.videoTitle,
          fromStatus,
          fromPath,
        },
      });
      return;
    }
    nav(action.path, { state: { fromStatus, fromPath } });
  };

  const requestDeleteSession = (sessionId: string) => {
    const target = allSessions.find((s) => s.sessionId === sessionId);
    if (!target) {
      toast.error("Session not found");
      return;
    }
    setDeleteTarget(target);
  };

  const confirmDeleteSession = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.sessionId);
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

  useEffect(() => {
    const current = searchParams.get("status");
    if (current === selectedStatus) return;
    const next = new URLSearchParams(searchParams);
    next.set("status", selectedStatus);
    setSearchParams(next, { replace: true });
  }, [selectedStatus, searchParams, setSearchParams]);

  return (
    <div className="ct-slide-up">
      <h1 className="ct-page-title">My Learnings</h1>
      <p className="ct-page-subtitle">Track learning progress, scores, and rewatch attempts by status.</p>
      {showResumeBanner && resumeContext && (
        <div className="ct-card ct-card-hover ct-learning-row ct-paused-session">
          <img
            src={`https://img.youtube.com/vi/${resumeContext.videoId}/mqdefault.jpg`}
            alt={resumeContext.videoTitle || "Paused video"}
            className="ct-learning-row-thumb ct-paused-session-thumb"
          />

          <div className="ct-learning-row-content ct-paused-session-body">
            <div className="ct-learning-row-top ct-paused-session-top">
              <span className="ct-badge ct-badge-active">Paused Video Session</span>
              {typeof resumeContext.lastPositionSec === "number" && resumeContext.lastPositionSec > 0 && (
                <span className="ct-paused-session-time">
                  <Clock size={12} />
                  Paused at {formatDuration(resumeContext.lastPositionSec)}
                </span>
              )}
            </div>
            <div className="ct-learning-row-title ct-paused-session-title">
              {resumeContext.videoTitle || "Resume your active watch session whenever you are ready."}
            </div>
            <div className="ct-paused-session-meta">
              <span>Return tab: {resumeFromLabel}</span>
              <span>Session saved until you close it</span>
            </div>
          </div>

          <div className="ct-learning-row-action ct-paused-session-actions">
            <button className="ct-btn ct-btn-primary ct-btn-sm ct-paused-session-continue" onClick={continueResumeContext}>
              <Play size={14} />
              Continue
            </button>
          </div>

          <button className="ct-paused-session-close" onClick={closeResumeContext} aria-label="Cancel paused session">
            <X size={14} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="ct-loading"><div className="ct-spinner" /><span>Loading statuses...</span></div>
      ) : (
        <div className="ct-learning-layout">
          <aside className="ct-learning-side">
            <div className="ct-learning-side-nav">
              <div className="ct-learning-side-filter">
                <button
                  type="button"
                  className={`ct-learning-side-filter-icon ${stemFilter !== "all" ? "active" : ""}`}
                  title="Reset filter"
                  onClick={() => setStemFilter("all")}
                >
                  <Menu size={14} />
                </button>
                <button
                  type="button"
                  className={`ct-learning-side-filter-btn ${stemFilter === "stem" ? "active" : ""}`}
                  onClick={() => toggleStemFilter("stem")}
                >
                  STEM
                </button>
                <button
                  type="button"
                  className={`ct-learning-side-filter-btn ${stemFilter === "nonstem" ? "active" : ""}`}
                  onClick={() => toggleStemFilter("nonstem")}
                >
                  Non-STEM
                </button>
              </div>

              {sideNavItems.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={`ct-learning-side-btn ${selectedStatus === item.key ? "active" : ""}`}
                  onClick={() => setSelectedStatus(item.key)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {item.navIcon}
                    {item.label}
                  </span>
                  <span className="ct-learning-side-pill">{item.count}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="ct-learning-content">
            <div key={selectedStatus} className="ct-learning-panel-anim">
              {selectedStatus === "active" && (
                <Section
                  title={
                    stemFilter === "all"
                      ? "Active Sessions"
                      : stemFilter === "stem"
                        ? "Active - STEM"
                        : "Active - Non-STEM"
                  }
                  icon={<Play size={20} style={{ color: "var(--ct-info)" }} />}
                  videos={activeFilteredVideos}
                  emptyText={
                    stemFilter === "all"
                      ? "No active sessions right now."
                      : stemFilter === "stem"
                        ? "No active STEM sessions right now."
                        : "No active non-STEM sessions right now."
                  }
                  onOpen={openVideo}
                  onDelete={requestDeleteSession}
                  onOpenAttempts={setAttemptsVideoId}
                  deletingSessionId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
                  insightByVideoId={insightByVideoId}
                />
              )}

              {selectedStatus === "completed" && (
                <Section
                  title={
                    stemFilter === "all"
                      ? "Completed Sessions"
                      : stemFilter === "stem"
                        ? "Completed - STEM"
                        : "Completed - Non-STEM"
                  }
                  icon={<BookOpen size={20} style={{ color: "var(--ct-accent-light)" }} />}
                  videos={completedFilteredVideos}
                  emptyText={
                    stemFilter === "all"
                      ? "No completed sessions yet."
                      : stemFilter === "stem"
                        ? "No completed STEM sessions yet."
                        : "No completed non-STEM sessions yet."
                  }
                  onOpen={openVideo}
                  onDelete={requestDeleteSession}
                  onOpenAttempts={setAttemptsVideoId}
                  deletingSessionId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
                  insightByVideoId={insightByVideoId}
                />
              )}

              {selectedStatus === "quiz" && (
                <Section
                  title={
                    stemFilter === "all"
                      ? "Quiz Pending"
                      : stemFilter === "stem"
                        ? "Quiz Pending - STEM"
                        : "Quiz Pending - Non-STEM"
                  }
                  icon={<Sparkles size={20} style={{ color: "var(--ct-warning)" }} />}
                  videos={quizPendingFilteredVideos}
                  emptyText={
                    stemFilter === "all"
                      ? "No quiz-pending videos yet."
                      : stemFilter === "stem"
                        ? "No STEM quiz-pending videos yet."
                        : "No non-STEM quiz-pending videos yet."
                  }
                  onOpen={openVideo}
                  onDelete={requestDeleteSession}
                  onOpenAttempts={setAttemptsVideoId}
                  deletingSessionId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
                  insightByVideoId={insightByVideoId}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        createPortal(
          <div
            className="ct-modal-backdrop"
            onClick={() => {
              if (!deleteMutation.isPending) setDeleteTarget(null);
            }}
          >
            <div
              className="ct-modal-card ct-delete-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ct-delete-modal-icon">
                <AlertTriangle size={22} />
              </div>
              <h3 className="ct-delete-modal-title">Delete Session?</h3>
              <p className="ct-delete-modal-text">
                This will remove the session from My Learnings.
              </p>
              <p className="ct-delete-modal-subtext">
                <strong>{deleteTarget.videoTitle}</strong>
              </p>
              <div className="ct-modal-actions">
                <button
                  className="ct-btn ct-btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  className="ct-btn ct-btn-danger"
                  onClick={confirmDeleteSession}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={15} />
                  {deleteMutation.isPending ? "Deleting..." : "Delete Session"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      )}

      {attemptsVideoId && (
        createPortal(
          <div
            className="ct-modal-backdrop"
            onClick={() => setAttemptsVideoId(null)}
          >
            <div
              className="ct-modal-card ct-attempts-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ct-attempts-modal-header">
                <div>
                  <h3 className="ct-attempts-modal-title">
                    {attemptsTitle || "Video Attempts"}
                  </h3>
                  <p className="ct-attempts-modal-subtitle">
                    History of your watch sessions and engagement scores
                  </p>
                </div>
                <button
                  className="ct-attempts-modal-close"
                  onClick={() => setAttemptsVideoId(null)}
                  aria-label="Close attempts modal"
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>&times;</span>
                </button>
              </div>

              <div className="ct-attempts-modal-list">
                {attemptsSessions.map((s, idx) => (
                  <div
                    key={s.sessionId}
                    className="ct-attempt-item"
                  >
                    <div>
                      <div className="ct-attempt-item-top">
                        <span className="ct-attempt-item-label">
                          Attempt {attemptsSessions.length - idx}
                        </span>
                        {statusBadge(s.status)}
                      </div>
                      <div className="ct-attempt-item-meta">
                        <span className="ct-attempt-item-time">
                          <Clock size={12} />
                          {new Date(s.createdAt).toLocaleString(undefined, {
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="ct-attempt-score">
                      <div
                        className={`ct-attempt-score-value ${s.engagementScore != null && s.engagementScore >= ENGAGEMENT_THRESHOLD ? "good" : ""}`}
                      >
                        {s.engagementScore == null ? "-" : `${(s.engagementScore * 100).toFixed(0)}%`}
                      </div>
                      <div className="ct-attempt-score-label">
                        Score
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ct-attempts-modal-actions">
                <button className="ct-btn ct-btn-secondary" onClick={() => setAttemptsVideoId(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      )}
    </div>
  );
}
