import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { User, Mail, Shield, Activity, Award, ClipboardCheck, BookOpen, Target, ChevronRight } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { getDashboard } from "../../api/dashboard";
import { getMe } from "../../api/auth";
import type { DashboardVideo } from "../../types/api";

const ENGAGEMENT_THRESHOLD = 0.85;

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

export function ProfilePage() {
  const nav = useNavigate();
  const { user, setUser } = useAuthStore();

  const { data: me } = useQuery({
    queryKey: ["auth", "me", "profile"],
    queryFn: getMe,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data } = useQuery({
    queryKey: ["dashboard", "profile-summary"],
    queryFn: () => getDashboard(),
  });

  const summary = useMemo(() => {
    const activeAll = sortByCreatedDesc(data?.activeVideos || []);
    const completedAll = sortByCreatedDesc(data?.completedVideos || []);
    const quizPendingAll = sortByCreatedDesc(data?.quizPendingVideos || []);
    const certifiedAll = sortByCreatedDesc(data?.certifiedVideos || []);
    const allSessions = [...activeAll, ...completedAll, ...quizPendingAll, ...certifiedAll];
    const absoluteLatest = latestSessionByVideo(allSessions);

    const quizPendingVideos = absoluteLatest.filter((v) => {
      if (!v.stemEligible) return false;
      if (v.status === "QUIZ_PENDING") return true;
      if (v.status === "COMPLETED" && v.engagementScore != null && v.engagementScore >= ENGAGEMENT_THRESHOLD) return true;
      if (v.status === "CERTIFIED" && !v.certificateId) return true;
      return false;
    });

    const activeStemVideos = absoluteLatest.filter((v) => v.stemEligible && v.status === "ACTIVE");
    const activeNonStemVideos = absoluteLatest.filter((v) => !v.stemEligible && v.status === "ACTIVE");

    const completedStemVideos = absoluteLatest.filter((v) => {
      if (!v.stemEligible) return false;
      if (v.status === "COMPLETED" && (v.engagementScore == null || v.engagementScore < ENGAGEMENT_THRESHOLD)) return true;
      return false;
    });
    const completedNonStemVideos = absoluteLatest.filter((v) => !v.stemEligible && v.status === "COMPLETED");
    // Count actual certificates earned (session-level), not unique videos.
    const certificatesEarned = certifiedAll.reduce((acc, v) => {
      if (v.certificateId) acc.add(v.certificateId);
      return acc;
    }, new Set<string>()).size;

    const active = activeStemVideos.length + activeNonStemVideos.length;
    const completed = completedStemVideos.length + completedNonStemVideos.length;
    const quizPending = quizPendingVideos.length;
    const certified = certificatesEarned;
    const total = active + completed + quizPending + certified;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const certificationRate = total > 0 ? Math.round((certified / total) * 100) : 0;
    return { active, completed, quizPending, certified, total, completionRate, certificationRate };
  }, [data]);

  useEffect(() => {
    if (!me) return;
    const incomingName = me.name?.trim() || "";
    const existingName = user?.name?.trim() || "";
    if (incomingName && incomingName !== existingName) {
      setUser({ ...me, name: incomingName });
    }
  }, [me, user?.name, setUser]);

  const identity = me || user;
  const displayName = identity?.name?.trim() || identity?.email?.split("@")[0] || "Learner";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="ct-slide-up" style={{ maxWidth: 980, margin: "0 auto" }}>
      <h1 className="ct-page-title">Profile</h1>
      <p className="ct-page-subtitle">Account, progress, and learning performance</p>

      <div className="ct-card ct-profile-hero">
        <div className="ct-profile-avatar">{initials}</div>
        <div>
          <div className="ct-profile-name">{displayName}</div>
          <div className="ct-profile-email">
            <Mail size={14} />
            {identity?.email || "-"}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="ct-badge ct-badge-active">
              <User size={11} />
              ID {identity?.userId ?? "-"}
            </span>
            <span className="ct-badge ct-badge-not-stem">
              <Shield size={11} />
              {identity?.role || "USER"}
            </span>
          </div>
        </div>
      </div>

      <div className="ct-profile-grid">
        <div className="ct-stat-card">
          <Activity size={20} style={{ color: "var(--ct-info)", marginBottom: 8 }} />
          <div className="ct-stat-value">{summary.active}</div>
          <div className="ct-stat-label">Active</div>
        </div>
        <div className="ct-stat-card">
          <BookOpen size={20} style={{ color: "var(--ct-accent-light)", marginBottom: 8 }} />
          <div className="ct-stat-value">{summary.completed}</div>
          <div className="ct-stat-label">Completed</div>
        </div>
        <div className="ct-stat-card">
          <ClipboardCheck size={20} style={{ color: "var(--ct-warning)", marginBottom: 8 }} />
          <div className="ct-stat-value">{summary.quizPending}</div>
          <div className="ct-stat-label">Quiz Pending</div>
        </div>
        <div className="ct-stat-card">
          <Award size={20} style={{ color: "var(--ct-success)", marginBottom: 8 }} />
          <div className="ct-stat-value">{summary.certified}</div>
          <div className="ct-stat-label">Certified</div>
        </div>
      </div>

      <div className="ct-profile-grid ct-profile-grid-split" style={{ marginTop: 16 }}>
        <div className="ct-card">
          <h2 className="ct-section-title" style={{ fontSize: 18, marginBottom: 12 }}>
            <Target size={18} style={{ color: "var(--ct-accent-light)" }} />
            Learning Progress
          </h2>
          <div style={{ display: "grid", gap: 10, fontSize: 14 }}>
            <div className="ct-profile-line">
              <span>Total videos</span>
              <strong>{summary.total}</strong>
            </div>
            <div className="ct-profile-line">
              <span>Completion rate</span>
              <strong>{summary.completionRate}%</strong>
            </div>
            <div className="ct-profile-line">
              <span>Certification rate</span>
              <strong>{summary.certificationRate}%</strong>
            </div>
          </div>
        </div>

        <div className="ct-card">
          <h2 className="ct-section-title" style={{ fontSize: 18, marginBottom: 12 }}>Quick Access</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <button className="ct-profile-nav-btn" onClick={() => nav("/my-learnings")}>
              My Learnings
              <ChevronRight size={14} />
            </button>
            <button className="ct-profile-nav-btn" onClick={() => nav("/certified")}>
              Certified
              <ChevronRight size={14} />
            </button>
            <button className="ct-profile-nav-btn" onClick={() => nav("/home")}>
              Search Videos
              <ChevronRight size={14} />
            </button>
            {identity?.role === "ADMIN" && (
              <button className="ct-profile-nav-btn" onClick={() => nav("/admin")}>
                Admin Panel
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
