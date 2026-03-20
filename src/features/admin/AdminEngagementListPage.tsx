import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, ChevronRight, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAdminEngagementResult, getAdminSessions, getAdminUsers } from "../../api/admin";
import type { ApiClientError } from "../../api/http";
import { useAuthStore } from "../../store/useAuthStore";
import type { AdminEngagementResult, AdminSession, AdminUser } from "../../types/api";
import { formatIsoDate, formatPercent } from "./engagementReview";

type EngagementListRow = {
  session: AdminSession;
  result: AdminEngagementResult;
  learnerLabel: string;
  learnerEmail: string | null;
};

function AdminAccessDenied() {
  const nav = useNavigate();
  return (
    <div className="ct-empty" style={{ minHeight: 300 }}>
      <div className="ct-empty-icon">Admin</div>
      <p>Access denied. Admin role required.</p>
      <button className="ct-btn ct-btn-primary" onClick={() => nav(-1)} style={{ marginTop: 16 }}>
        Go Back
      </button>
    </div>
  );
}

function resolveLearner(session: AdminSession, users: AdminUser[]): { label: string; email: string | null } {
  const match = users.find((user) => String(user.userId) === String(session.userId));
  if (match) {
    return { label: match.email, email: match.email };
  }
  return {
    label: `Learner ${session.userId}`,
    email: null,
  };
}

export function AdminEngagementListPage() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ENGAGED" | "NOT_ENGAGED">("all");
  const [modelFilter, setModelFilter] = useState<"all" | "xgboost" | "ebm">("all");

  const isAdmin = user?.role === "ADMIN";

  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: getAdminSessions,
    enabled: isAdmin,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: getAdminUsers,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const candidateSessions = useMemo(
    () => (sessionsQuery.data || []).filter((session) => session.status !== "ACTIVE"),
    [sessionsQuery.data],
  );

  const sessionIdsKey = useMemo(
    () => candidateSessions.map((session) => session.sessionId),
    [candidateSessions],
  );

  const engagementQuery = useQuery({
    queryKey: ["admin-engagement-list", sessionIdsKey],
    enabled: isAdmin && candidateSessions.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const rows = await Promise.all(
        candidateSessions.map(async (session) => {
          try {
            const result = await getAdminEngagementResult(session.sessionId);
            return { session, result };
          } catch (error) {
            const err = error as ApiClientError;
            if (err.status === 404 || err.status === 400) {
              return null;
            }
            throw error;
          }
        }),
      );

      return rows.filter((row): row is { session: AdminSession; result: AdminEngagementResult } => Boolean(row));
    },
  });

  const rows = useMemo<EngagementListRow[]>(() => {
    const users = usersQuery.data || [];
    return (engagementQuery.data || [])
      .map(({ session, result }) => {
        const learner = resolveLearner(session, users);
        return {
          session,
          result,
          learnerLabel: learner.label,
          learnerEmail: learner.email,
        };
      })
      .sort((left, right) => (
        new Date(right.result.createdAtUtc).getTime() - new Date(left.result.createdAtUtc).getTime()
      ));
  }, [engagementQuery.data, usersQuery.data]);

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter !== "all" && row.result.status !== statusFilter) return false;
      if (modelFilter !== "all" && row.result.model !== modelFilter) return false;
      if (!search) return true;

      const haystack = [
        row.learnerLabel,
        row.learnerEmail || "",
        row.session.videoTitle,
        row.session.sessionId,
        row.session.videoId,
      ].join(" ").toLowerCase();

      return haystack.includes(search);
    });
  }, [modelFilter, rows, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const engaged = rows.filter((row) => row.result.status === "ENGAGED").length;
    const avgScore = total > 0
      ? rows.reduce((sum, row) => sum + row.result.engagementScore, 0) / total
      : null;
    const xgboostCount = rows.filter((row) => row.result.model === "xgboost").length;
    return { total, engaged, avgScore, xgboostCount };
  }, [rows]);

  if (!isAdmin) {
    return <AdminAccessDenied />;
  }

  const isLoading = sessionsQuery.isLoading || usersQuery.isLoading || engagementQuery.isLoading;

  return (
    <div className="ct-slide-up ct-admin-engagement-page">
      <div className="ct-admin-module-header">
        <div>
          <div className="ct-admin-module-kicker">Admin Only</div>
          <h1 className="ct-page-title">Engagement Review</h1>
          <p className="ct-page-subtitle">
            Review analyzed engagement outcomes and inspect the model evidence behind each learner score.
          </p>
        </div>
        <div className="ct-admin-module-actions">
          <button className="ct-btn ct-btn-secondary" onClick={() => nav("/admin")}>
            <ArrowLeft size={14} />
            Back to Admin
          </button>
        </div>
      </div>

      <div className="ct-admin-metric-grid">
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Analyzed Sessions</span>
          <strong className="ct-admin-metric-value">{stats.total}</strong>
          <span className="ct-admin-metric-note">Sessions with saved engagement results</span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Engaged</span>
          <strong className="ct-admin-metric-value">{stats.engaged}</strong>
          <span className="ct-admin-metric-note">
            {stats.total > 0 ? `${Math.round((stats.engaged / stats.total) * 100)}% pass rate` : "No analyzed sessions yet"}
          </span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Average Score</span>
          <strong className="ct-admin-metric-value">{formatPercent(stats.avgScore)}</strong>
          <span className="ct-admin-metric-note">Across all analyzed sessions</span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Primary Model</span>
          <strong className="ct-admin-metric-value">{stats.xgboostCount > 0 ? "XGBoost" : "EBM"}</strong>
          <span className="ct-admin-metric-note">
            {stats.xgboostCount > 0
              ? `${stats.xgboostCount} XGBoost results loaded`
              : "No XGBoost results in the current list"}
          </span>
        </div>
      </div>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-panel-head">
          <div>
            <h2 className="ct-admin-panel-title">
              <BarChart3 size={18} />
              Engagement Results
            </h2>
            <p className="ct-admin-panel-subtitle">
              Filter by learner, model, or outcome to inspect why each score was assigned.
            </p>
          </div>
        </div>

        <div className="ct-admin-filter-row">
          <label className="ct-admin-search">
            <Search size={15} />
            <input
              className="ct-input"
              type="search"
              placeholder="Search learner, video, session, or video id"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <select
            className="ct-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "ENGAGED" | "NOT_ENGAGED")}
          >
            <option value="all">All outcomes</option>
            <option value="ENGAGED">Engaged</option>
            <option value="NOT_ENGAGED">Not engaged</option>
          </select>

          <select
            className="ct-select"
            value={modelFilter}
            onChange={(event) => setModelFilter(event.target.value as "all" | "xgboost" | "ebm")}
          >
            <option value="all">All models</option>
            <option value="xgboost">XGBoost</option>
            <option value="ebm">EBM</option>
          </select>
        </div>

        {isLoading ? (
          <div className="ct-loading" style={{ minHeight: 220 }}>
            <div className="ct-spinner" />
            <span>Loading engagement reviews...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="ct-empty" style={{ minHeight: 220 }}>
            <div className="ct-empty-icon">0</div>
            <p>No analyzed engagement results matched the current filters.</p>
          </div>
        ) : (
          <div className="ct-table-wrap">
            <table className="ct-table ct-admin-engagement-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Video</th>
                  <th>Score</th>
                  <th>Threshold</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Analyzed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.session.sessionId}>
                    <td>
                      <div className="ct-admin-table-primary">{row.learnerLabel}</div>
                      <div className="ct-admin-table-secondary">User {row.session.userId}</div>
                    </td>
                    <td>
                      <div className="ct-admin-table-primary">{row.session.videoTitle}</div>
                      <div className="ct-admin-table-secondary">{row.session.sessionId}</div>
                    </td>
                    <td>
                      <div className="ct-admin-score-cell">
                        <strong>{formatPercent(row.result.engagementScore)}</strong>
                        <div className="ct-admin-score-track">
                          <span
                            className="ct-admin-score-fill"
                            style={{ width: `${Math.max(0, Math.min(100, row.result.engagementScore * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>{formatPercent(row.result.threshold)}</td>
                    <td>
                      <span className={`ct-admin-chip ${row.result.status === "ENGAGED" ? "is-good" : "is-bad"}`}>
                        {row.result.status === "ENGAGED" ? "Passed" : "Below Threshold"}
                      </span>
                    </td>
                    <td>
                      <span className="ct-admin-chip is-neutral">{row.result.model.toUpperCase()}</span>
                    </td>
                    <td>{formatIsoDate(row.result.createdAtUtc)}</td>
                    <td>
                      <button
                        className="ct-btn ct-btn-secondary ct-btn-sm"
                        onClick={() => nav(`/admin/engagement/${row.session.sessionId}`, {
                          state: {
                            session: row.session,
                            learnerLabel: row.learnerLabel,
                            learnerEmail: row.learnerEmail,
                          },
                        })}
                      >
                        Details
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
