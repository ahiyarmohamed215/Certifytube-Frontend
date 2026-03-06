import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { User, Mail, Shield, Activity, Award, ClipboardCheck, BookOpen, Target, ChevronRight } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { getDashboard } from "../../api/dashboard";
import type { DashboardResponse, DashboardVideo, SessionStatus } from "../../types/api";

const STATUS_PRIORITY: Record<SessionStatus, number> = {
  ACTIVE: 1,
  COMPLETED: 2,
  QUIZ_PENDING: 3,
  CERTIFIED: 4,
};

function pickLatestByVideo(data?: DashboardResponse) {
  const all = [
    ...(data?.activeVideos || []),
    ...(data?.completedVideos || []),
    ...(data?.quizPendingVideos || []),
    ...(data?.certifiedVideos || []),
  ];

  const map = new Map<string, DashboardVideo>();
  for (const video of all) {
    const existing = map.get(video.videoId);
    if (!existing) {
      map.set(video.videoId, video);
      continue;
    }
    const nextTs = Date.parse(video.createdAt) || 0;
    const existingTs = Date.parse(existing.createdAt) || 0;
    if (nextTs > existingTs) {
      map.set(video.videoId, video);
      continue;
    }
    if (nextTs === existingTs && STATUS_PRIORITY[video.status] > STATUS_PRIORITY[existing.status]) {
      map.set(video.videoId, video);
    }
  }
  return [...map.values()];
}

export function ProfilePage() {
  const nav = useNavigate();
  const { user } = useAuthStore();

  const { data } = useQuery({
    queryKey: ["dashboard", "profile-summary"],
    queryFn: () => getDashboard(),
  });

  const summary = useMemo(() => {
    const latest = pickLatestByVideo(data);
    const active = latest.filter((v) => v.status === "ACTIVE").length;
    const completed = latest.filter((v) => v.status === "COMPLETED").length;
    const quizPending = latest.filter((v) => v.status === "QUIZ_PENDING").length;
    const certified = latest.filter((v) => v.status === "CERTIFIED").length;
    const total = latest.length;
    const completionRate = total > 0 ? Math.round(((completed + quizPending + certified) / total) * 100) : 0;
    const certificationRate = total > 0 ? Math.round((certified / total) * 100) : 0;
    return { active, completed, quizPending, certified, total, completionRate, certificationRate };
  }, [data]);

  const displayName = user?.email?.split("@")[0] || "Learner";
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
            {user?.email || "-"}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="ct-badge ct-badge-active">
              <User size={11} />
              ID {user?.userId ?? "-"}
            </span>
            <span className="ct-badge ct-badge-not-stem">
              <Shield size={11} />
              {user?.role || "USER"}
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
              <span>Total unique videos</span>
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
            {user?.role === "ADMIN" && (
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
