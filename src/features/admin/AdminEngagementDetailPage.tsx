import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getAdminEngagementResult, getAdminSessions, getAdminUsers } from "../../api/admin";
import { useAuthStore } from "../../store/useAuthStore";
import type { AdminSession } from "../../types/api";
import {
  formatIsoDate,
  formatPercent,
  normalizeEngagementContributors,
  type EngagementSignalCard,
} from "./engagementReview";

type AdminEngagementDetailLocationState = {
  session?: AdminSession;
  learnerLabel?: string;
  learnerEmail?: string | null;
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

function SignalSection({
  title,
  subtitle,
  icon,
  tone,
  items,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: "positive" | "negative";
  items: EngagementSignalCard[];
}) {
  return (
    <section className="ct-admin-panel-card">
      <div className="ct-admin-panel-head">
        <div>
          <h2 className="ct-admin-panel-title">
            {icon}
            {title}
          </h2>
          <p className="ct-admin-panel-subtitle">{subtitle}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="ct-empty" style={{ minHeight: 160 }}>
          <div className="ct-empty-icon">-</div>
          <p>No signal data available for this section.</p>
        </div>
      ) : (
        <div className="ct-admin-signal-grid">
          {items.map((item) => (
            <article key={item.id} className={`ct-admin-signal-card ${tone === "positive" ? "is-positive" : "is-negative"}`}>
              <div className="ct-admin-signal-head">
                <div>
                  <h3 className="ct-admin-signal-title">{item.featureLabel}</h3>
                  <p className="ct-admin-signal-key">{item.rawFeatureKey}</p>
                </div>
                <span className={`ct-admin-signal-impact ${tone === "positive" ? "is-positive" : "is-negative"}`}>
                  {item.impactDisplay}
                </span>
              </div>

              <p className="ct-admin-signal-reason">{item.reason}</p>

              <div className="ct-admin-signal-meta">
                <div className="ct-admin-signal-meta-item">
                  <span>{item.impactLabel}</span>
                  <strong>{item.impactDisplay}</strong>
                </div>
                <div className="ct-admin-signal-meta-item">
                  <span>Feature Value</span>
                  <strong>{item.featureValueDisplay}</strong>
                </div>
                <div className="ct-admin-signal-meta-item">
                  <span>Behavior Category</span>
                  <strong>{item.behaviorLabel}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function AdminEngagementDetailPage() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const locationState = (location.state as AdminEngagementDetailLocationState | null) || null;

  const isAdmin = user?.role === "ADMIN";

  const resultQuery = useQuery({
    queryKey: ["admin-engagement-result", sessionId],
    queryFn: () => getAdminEngagementResult(sessionId!),
    enabled: isAdmin && Boolean(sessionId),
  });

  const sessionsQuery = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: getAdminSessions,
    enabled: isAdmin && Boolean(sessionId) && !locationState?.session,
    staleTime: 60_000,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: getAdminUsers,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const session = useMemo(() => {
    if (locationState?.session) return locationState.session;
    return (sessionsQuery.data || []).find((item) => item.sessionId === sessionId) || null;
  }, [locationState?.session, sessionId, sessionsQuery.data]);

  const learner = useMemo(() => {
    if (locationState?.learnerLabel) {
      return {
        label: locationState.learnerLabel,
        email: locationState.learnerEmail || null,
      };
    }

    if (!session) {
      return {
        label: "Unknown learner",
        email: null,
      };
    }

    const match = (usersQuery.data || []).find((item) => String(item.userId) === String(session.userId));
    if (match) {
      return {
        label: match.email,
        email: match.email,
      };
    }

    return {
      label: `Learner ${session.userId}`,
      email: null,
    };
  }, [locationState?.learnerEmail, locationState?.learnerLabel, session, usersQuery.data]);

  const positiveSignals = useMemo(
    () => normalizeEngagementContributors(resultQuery.data?.topPositive, resultQuery.data?.model || "xgboost", "positive"),
    [resultQuery.data?.model, resultQuery.data?.topPositive],
  );

  const negativeSignals = useMemo(
    () => normalizeEngagementContributors(resultQuery.data?.topNegative, resultQuery.data?.model || "xgboost", "negative"),
    [resultQuery.data?.model, resultQuery.data?.topNegative],
  );

  const margin = resultQuery.data
    ? resultQuery.data.engagementScore - resultQuery.data.threshold
    : null;

  if (!isAdmin) {
    return <AdminAccessDenied />;
  }

  if (resultQuery.isLoading || (sessionsQuery.isLoading && !locationState?.session)) {
    return (
      <div className="ct-loading" style={{ minHeight: 320 }}>
        <div className="ct-spinner" />
        <span>Loading engagement review...</span>
      </div>
    );
  }

  if (!resultQuery.data) {
    return <div className="ct-empty">Engagement review not found.</div>;
  }

  return (
    <div className="ct-slide-up ct-admin-engagement-page">
      <div className="ct-admin-module-header">
        <div>
          <div className="ct-admin-module-kicker">Admin Only</div>
          <h1 className="ct-page-title">Engagement Detail</h1>
          <p className="ct-page-subtitle">
            Explain why this learner received the final engagement score and what signals pushed the model up or down.
          </p>
        </div>
        <div className="ct-admin-module-actions">
          <button className="ct-btn ct-btn-secondary" onClick={() => nav("/admin/engagement")}>
            <ArrowLeft size={14} />
            Back to Reviews
          </button>
        </div>
      </div>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-engagement-hero">
          <div className="ct-admin-engagement-hero-copy">
            <div className="ct-admin-detail-eyebrow">Session {resultQuery.data.sessionId}</div>
            <h2 className="ct-admin-detail-title">{session?.videoTitle || "Learning Session"}</h2>
            <p className="ct-admin-detail-subtitle">
              Reviewed for {learner.label}
              {learner.email && learner.email !== learner.label ? ` • ${learner.email}` : ""}
            </p>
          </div>

          <div className="ct-admin-badge-row">
            <span className={`ct-admin-chip ${resultQuery.data.status === "ENGAGED" ? "is-good" : "is-bad"}`}>
              {resultQuery.data.status}
            </span>
            <span className="ct-admin-chip is-neutral">{resultQuery.data.model.toUpperCase()}</span>
          </div>
        </div>

        <div className="ct-admin-metric-grid ct-admin-metric-grid-compact">
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Engagement Score</span>
            <strong className="ct-admin-metric-value">{formatPercent(resultQuery.data.engagementScore)}</strong>
            <span className="ct-admin-metric-note">Model output</span>
          </div>
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Threshold</span>
            <strong className="ct-admin-metric-value">{formatPercent(resultQuery.data.threshold)}</strong>
            <span className="ct-admin-metric-note">Required to unlock quiz</span>
          </div>
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Score Margin</span>
            <strong className="ct-admin-metric-value">
              {margin == null ? "-" : `${margin >= 0 ? "+" : ""}${(margin * 100).toFixed(1)} pts`}
            </strong>
            <span className="ct-admin-metric-note">
              {margin != null && margin >= 0 ? "Above threshold" : "Below threshold"}
            </span>
          </div>
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Analyzed At</span>
            <strong className="ct-admin-metric-value">{formatIsoDate(resultQuery.data.createdAtUtc)}</strong>
            <span className="ct-admin-metric-note">Saved engagement snapshot</span>
          </div>
        </div>
      </section>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-panel-head">
          <div>
            <h2 className="ct-admin-panel-title">
              <CircleAlert size={18} />
              Why This Score Was Assigned
            </h2>
            <p className="ct-admin-panel-subtitle">
              Human-readable explanation generated from the engagement model output.
            </p>
          </div>
        </div>

        <div className="ct-admin-explanation-card">
          <p>{resultQuery.data.explanation || "No explanation was returned by the backend for this result."}</p>
        </div>
      </section>

      <SignalSection
        title="Top Positive Signals"
        subtitle="These behaviors pushed the learner toward a higher engagement score."
        icon={<ThumbsUp size={18} />}
        tone="positive"
        items={positiveSignals}
      />

      <SignalSection
        title="Top Negative Signals"
        subtitle="These behaviors pulled the learner down or weakened confidence in the score."
        icon={<ThumbsDown size={18} />}
        tone="negative"
        items={negativeSignals}
      />

      <section className="ct-admin-panel-card">
        <details className="ct-admin-debug">
          <summary>Raw model payload</summary>
          <pre>{JSON.stringify(resultQuery.data, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
