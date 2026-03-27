import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Shield, ChevronRight, Film, Award, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAdminLearners, getAdminOverview } from "../../api/admin";
import { getApiMessage } from "../../api/errors";
import { useAuthStore } from "../../store/useAuthStore";
import type { AdminUser } from "../../types/api";
import { formatIsoDate } from "./engagementReview";
import "./admin-helpers.css";

export function AdminPage() {
  const nav = useNavigate();
  const { user } = useAuthStore();

  if (user?.role !== "ADMIN") {
    return (
      <div className="ct-empty" style={{ minHeight: 300 }}>
        <div className="ct-empty-icon">LOCK</div>
        <p>Access denied. Admin role required.</p>
        <button className="ct-btn ct-btn-primary" onClick={() => nav(-1)} style={{ marginTop: 16 }}>
          Go Back
        </button>
      </div>
    );
  }

  return <MLDashboard />;
}

function MLDashboard() {
  const nav = useNavigate();
  const [draftSearch, setDraftSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const learnersQuery = useQuery({
    queryKey: ["admin-learners"],
    queryFn: getAdminLearners,
    staleTime: 60_000,
  });
  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: getAdminOverview,
    staleTime: 60_000,
  });

  const learners = learnersQuery.data || [];

  const filteredLearners = useMemo(() => {
    const search = appliedSearch.trim().toLowerCase();
    if (!search) return learners;
    return learners.filter((learner) => {
      const haystack = `${learner.name || ""} ${learner.email || ""} ${learner.userId}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [appliedSearch, learners]);

  const stats = useMemo(() => {
    if (overviewQuery.data) {
      return {
        total: overviewQuery.data.learnerCount ?? 0,
        sessions: overviewQuery.data.sessionCount ?? 0,
        certificates: overviewQuery.data.certificateCount ?? 0,
      };
    }

    const total = learners.length;
    const sessions = learners.reduce((sum, l) => sum + (l.sessionCount ?? 0), 0);
    const certificates = learners.reduce((sum, l) => sum + (l.certificateCount ?? 0), 0);
    return { total, sessions, certificates };
  }, [learners, overviewQuery.data]);

  const hasActiveSearch = appliedSearch.trim().length > 0;

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(draftSearch.trim());
  };

  const handleSearchReset = () => {
    setDraftSearch("");
    setAppliedSearch("");
  };

  return (
    <div className="ct-slide-up ct-admin-engagement-page">
      <div className="ct-admin-module-header">
        <div>
          <div className="ct-admin-module-kicker">Admin Only</div>
          <h1 className="ct-page-title">
            <Shield size={28} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--ct-accent-light)" }} />
            ML Model Dashboard
          </h1>
          <p className="ct-page-subtitle">
            Search a learner to inspect engagement scores, top positive and negative signals, quiz outcomes, and raw ML grading payloads.
          </p>
        </div>
      </div>

      <div className="ct-admin-metric-grid">
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Learners</span>
          <strong className="ct-admin-metric-value">{stats.total}</strong>
          <span className="ct-admin-metric-note">Total learner accounts</span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Sessions</span>
          <strong className="ct-admin-metric-value">{stats.sessions}</strong>
          <span className="ct-admin-metric-note">Tracked learning sessions</span>
        </div>
        <div className="ct-admin-metric-card">
          <span className="ct-admin-metric-label">Certificates</span>
          <strong className="ct-admin-metric-value">{stats.certificates}</strong>
          <span className="ct-admin-metric-note">Issued certificates</span>
        </div>
      </div>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-panel-head">
          <div>
            <h2 className="ct-admin-panel-title">
              <BarChart3 size={18} />
              Session Status Monitor
            </h2>
            <p className="ct-admin-panel-subtitle">
              Global distribution of session lifecycle states for admin model monitoring.
            </p>
          </div>
        </div>

        {overviewQuery.isLoading ? (
          <div className="ct-admin-skeleton-stack">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ct-admin-skeleton-row" />
            ))}
          </div>
        ) : overviewQuery.isError || !overviewQuery.data ? (
          <div className="ct-admin-muted-box">
            {getApiMessage(overviewQuery.error, "Failed to load admin overview counts.")}
          </div>
        ) : (
          <div className="ct-admin-metric-grid">
            <div className="ct-admin-metric-card">
              <span className="ct-admin-metric-label">Active</span>
              <strong className="ct-admin-metric-value">{overviewQuery.data.activeSessionCount}</strong>
              <span className="ct-admin-metric-note">In-progress learning sessions</span>
            </div>
            <div className="ct-admin-metric-card">
              <span className="ct-admin-metric-label">Completed</span>
              <strong className="ct-admin-metric-value">{overviewQuery.data.completedSessionCount}</strong>
              <span className="ct-admin-metric-note">Finished watch sessions</span>
            </div>
            <div className="ct-admin-metric-card">
              <span className="ct-admin-metric-label">Quiz Pending</span>
              <strong className="ct-admin-metric-value">{overviewQuery.data.quizPendingSessionCount}</strong>
              <span className="ct-admin-metric-note">Awaiting quiz attempts</span>
            </div>
            <div className="ct-admin-metric-card">
              <span className="ct-admin-metric-label">Certified</span>
              <strong className="ct-admin-metric-value">{overviewQuery.data.certifiedSessionCount}</strong>
              <span className="ct-admin-metric-note">Dual verification passed</span>
            </div>
          </div>
        )}
      </section>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-panel-head">
          <div>
            <h2 className="ct-admin-panel-title">
              <Search size={18} />
              Find a Learner
            </h2>
            <p className="ct-admin-panel-subtitle">
              Search by learner name, email, or user ID, then click Inspect ML Data to open full session-level ML analysis.
            </p>
          </div>
        </div>

        <form className="ct-admin-filter-row ct-admin-filter-form" onSubmit={handleSearchSubmit}>
          <label className="ct-admin-search">
            <Search size={15} />
            <input
              className="ct-input"
              type="search"
              placeholder="Search by name, email, or user ID..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              autoFocus
            />
          </label>
          <button type="submit" className="ct-btn ct-btn-primary ct-btn-sm">
            Search
          </button>
          <button type="button" className="ct-btn ct-btn-secondary ct-btn-sm" onClick={handleSearchReset}>
            Clear
          </button>
          <div className="ct-admin-filter-summary">
            {filteredLearners.length} learner{filteredLearners.length !== 1 ? "s" : ""}
          </div>
        </form>

        {learnersQuery.isLoading ? (
          <div className="ct-admin-skeleton-stack">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ct-admin-skeleton-row" />
            ))}
          </div>
        ) : learnersQuery.isError ? (
          <div className="ct-empty" style={{ minHeight: 180 }}>
            <div className="ct-empty-icon">!</div>
            <p>{getApiMessage(learnersQuery.error, "Failed to load learners.")}</p>
          </div>
        ) : filteredLearners.length === 0 ? (
          <div className="ct-empty" style={{ minHeight: 180 }}>
            <div className="ct-empty-icon">0</div>
            <p>{hasActiveSearch ? "No learners matched your search." : "No learners found."}</p>
          </div>
        ) : (
          <div className="ct-table-wrap">
            <table className="ct-table ct-admin-learners-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Sessions</th>
                  <th>Certificates</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredLearners.map((learner) => (
                  <LearnerRow
                    key={learner.userId}
                    learner={learner}
                    onOpen={() => nav(`/admin/learners/${learner.userId}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LearnerRow({ learner, onOpen }: { learner: AdminUser; onOpen: () => void }) {
  const canInspect = Number.isFinite(Number(learner.userId));

  return (
    <tr onClick={() => canInspect && onOpen()} style={{ cursor: canInspect ? "pointer" : "not-allowed" }} className="ct-admin-clickable-row">
      <td>
        <div className="ct-admin-table-primary">{learner.name?.trim() || "Unnamed learner"}</div>
        <div className="ct-admin-table-secondary">{learner.email}</div>
        <div className="ct-admin-table-secondary">ID {learner.userId}</div>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Film size={14} style={{ color: "var(--ct-text-muted)" }} />
          <span>{learner.sessionCount ?? 0}</span>
        </div>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Award size={14} style={{ color: "var(--ct-text-muted)" }} />
          <span>{learner.certificateCount ?? 0}</span>
        </div>
      </td>
      <td>{formatIsoDate(learner.createdAtUtc || null)}</td>
      <td>
        <button
          className="ct-btn ct-btn-secondary ct-btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (!canInspect) return;
            onOpen();
          }}
          disabled={!canInspect}
        >
          <BarChart3 size={14} />
          Inspect ML Data
          <ChevronRight size={14} />
        </button>
      </td>
    </tr>
  );
}
