import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { User, Mail, Shield, Activity, Award, ClipboardCheck, BookOpen, Target, ChevronRight, AlertTriangle, Trash2 } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { getDashboard } from "../../api/dashboard";
import { deleteMyAccount, getMe } from "../../api/auth";
import type { ApiClientError } from "../../api/http";
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

function clearProtectedClientData() {
  if (typeof window === "undefined") return;

  const localKeys: string[] = [];
  for (let idx = 0; idx < window.localStorage.length; idx += 1) {
    const key = window.localStorage.key(idx);
    if (key && key.startsWith("ct_")) localKeys.push(key);
  }
  localKeys.forEach((key) => window.localStorage.removeItem(key));

  try {
    window.sessionStorage.clear();
  } catch {
    // ignore cleanup failures
  }
}

export function ProfilePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user, setUser, clearAuth } = useAuthStore();
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  const confirmDeleteEnabled = deleteConfirmText.trim().toUpperCase() === "DELETE";

  const openDeleteAccountModal = () => {
    setDeleteError(null);
    setDeleteConfirmText("");
    setDeleteAccountOpen(true);
  };

  const closeDeleteAccountModal = () => {
    if (deletingAccount) return;
    setDeleteAccountOpen(false);
    setDeleteConfirmText("");
    setDeleteError(null);
  };

  const confirmDeleteAccount = async () => {
    if (deletingAccount || !confirmDeleteEnabled) return;
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      qc.clear();
      clearAuth();
      clearProtectedClientData();
      toast.success("Account deleted successfully");
      setDeleteAccountOpen(false);
      nav("/login", { replace: true });
    } catch (error: any) {
      const err = error as ApiClientError;
      const status = Number(err?.status || 0);
      const message = err?.message || "Failed to delete account";
      setDeleteError(message);
      toast.error(message);
      if (status === 401) {
        qc.clear();
        clearAuth();
        clearProtectedClientData();
        nav("/login", { replace: true });
      }
    } finally {
      setDeletingAccount(false);
    }
  };

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

      <div className="ct-card" style={{ marginTop: 16, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
        <h2 className="ct-section-title" style={{ fontSize: 18, marginBottom: 8 }}>
          <AlertTriangle size={18} style={{ color: "var(--ct-error)" }} />
          Danger Zone
        </h2>
        <p style={{ color: "var(--ct-text-secondary)", fontSize: 13.5, marginBottom: 12 }}>
          Delete your account and all learner data permanently. This action cannot be undone.
        </p>
        <button
          className="ct-btn ct-btn-danger"
          id="delete-account-btn"
          onClick={openDeleteAccountModal}
          disabled={deletingAccount}
        >
          <Trash2 size={15} />
          Delete Account
        </button>
      </div>

      {deleteAccountOpen && createPortal(
        <div className="ct-modal-backdrop" onClick={closeDeleteAccountModal}>
          <div className="ct-modal-card ct-delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ct-delete-modal-icon">
              <AlertTriangle size={22} />
            </div>
            <h3 className="ct-delete-modal-title">Delete Account?</h3>
            <p className="ct-delete-modal-text">
              This will permanently remove your account, sessions, quizzes, and certificates.
            </p>
            <p className="ct-delete-modal-subtext">
              Type <span className="ct-modal-code">DELETE</span> to confirm.
            </p>
            <input
              className="ct-input"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Type DELETE to confirm"
              autoFocus
              disabled={deletingAccount}
            />
            {deleteError && (
              <div className="ct-banner ct-banner-error" style={{ marginTop: 12, marginBottom: 0 }}>
                {deleteError}
              </div>
            )}
            <div className="ct-modal-actions" style={{ marginTop: 16 }}>
              <button className="ct-btn ct-btn-secondary" onClick={closeDeleteAccountModal} disabled={deletingAccount}>
                Cancel
              </button>
              <button
                className="ct-btn ct-btn-danger"
                id="confirm-delete-account-btn"
                onClick={confirmDeleteAccount}
                disabled={deletingAccount || !confirmDeleteEnabled}
              >
                <Trash2 size={15} />
                {deletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
