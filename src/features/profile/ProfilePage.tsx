import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { User, Mail, Shield, Activity, Award, ClipboardCheck } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { getDashboard } from "../../api/dashboard";

export function ProfilePage() {
  const nav = useNavigate();
  const { user } = useAuthStore();

  const { data } = useQuery({
    queryKey: ["dashboard", "profile-summary"],
    queryFn: () => getDashboard(),
  });

  const summary = useMemo(() => {
    const active = data?.activeVideos?.length ?? 0;
    const completed = data?.completedVideos?.length ?? 0;
    const quizPending = data?.quizPendingVideos?.length ?? 0;
    const certified = data?.certifiedVideos?.length ?? 0;
    return { active, completed, quizPending, certified };
  }, [data]);

  return (
    <div className="ct-slide-up" style={{ maxWidth: 820, margin: "0 auto" }}>
      <h1 className="ct-page-title">Profile</h1>
      <p className="ct-page-subtitle">Account details and learning summary</p>

      <div className="ct-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ct-text-muted)", marginBottom: 6 }}>Name</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <User size={16} />
              {user?.email?.split("@")[0] || "Learner"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ct-text-muted)", marginBottom: 6 }}>Email</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <Mail size={16} />
              {user?.email || "-"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ct-text-muted)", marginBottom: 6 }}>Role</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
              <Shield size={16} />
              {user?.role || "USER"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--ct-text-muted)", marginBottom: 6 }}>User ID</div>
            <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{user?.userId ?? "-"}</div>
          </div>
        </div>
      </div>

      <div className="ct-stat-grid" style={{ marginBottom: 20 }}>
        <div className="ct-stat-card">
          <Activity size={20} style={{ color: "var(--ct-info)", marginBottom: 8 }} />
          <div className="ct-stat-value">{summary.active}</div>
          <div className="ct-stat-label">Active</div>
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

      {user?.role === "ADMIN" && (
        <button className="ct-btn ct-btn-secondary" onClick={() => nav("/admin")}>
          <Shield size={16} /> Open Admin Panel
        </button>
      )}
    </div>
  );
}
