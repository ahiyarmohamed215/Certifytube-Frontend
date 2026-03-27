import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CircleOff,
  Film,
  Mail,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import {
  activateCertificate,
  deleteCertificate,
  getAdminLearnerProfile,
  revokeCertificate,
} from "../../api/admin";
import { getApiMessage } from "../../api/errors";
import { useAuthStore } from "../../store/useAuthStore";
import type {
  AdminLearnerCertificateInsight,
  AdminLearnerQuizInsight,
  AdminLearnerSessionInsight,
} from "../../types/api";
import { formatIsoDate } from "./engagementReview";
import { normalizeEngagementContributors } from "./engagementReview";
import {
  formatAdminDateTime,
  formatAdminPercent,
  formatAdminSeconds,
  humanizeAdminKey,
  normalizeUnknownArray,
  normalizeOptions,
  normalizeRecord,
  prettyPrintJson,
  stringifyPrimitive,
} from "./adminLearnerUtils";

type LearnerProfileTab = "sessions" | "quizzes" | "certificates";
type SessionStatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "QUIZ_PENDING" | "CERTIFIED";

const SESSION_STATUS_FILTERS: Array<{ key: SessionStatusFilter; label: string }> = [
  { key: "ALL", label: "All Sessions" },
  { key: "ACTIVE", label: "Active" },
  { key: "COMPLETED", label: "Completed" },
  { key: "QUIZ_PENDING", label: "Quiz Pending" },
  { key: "CERTIFIED", label: "Certified" },
];

type CertificateActionState = {
  action: "revoke" | "delete";
  certificate: AdminLearnerCertificateInsight;
} | null;

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

function JsonBlock({ title, value, defaultOpen = false }: { title: string; value: unknown; defaultOpen?: boolean }) {
  return (
    <details className="ct-admin-debug ct-admin-debug-light" open={defaultOpen}>
      <summary>{title}</summary>
      <pre>{prettyPrintJson(value)}</pre>
    </details>
  );
}

function KeyValueGrid({ data }: { data: Record<string, unknown> | null | undefined }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) {
    return <div className="ct-admin-muted-box">No structured key-value data available.</div>;
  }

  return (
    <div className="ct-admin-kv-grid">
      {entries.map(([key, value]) => (
        <div key={key} className="ct-admin-kv-card">
          <span>{humanizeAdminKey(key)}</span>
          <strong>{stringifyPrimitive(value)}</strong>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="ct-admin-panel-head">
      <div>
        <h2 className="ct-admin-panel-title">
          {icon}
          {title}
        </h2>
        <p className="ct-admin-panel-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}

function EngagementSignalSection({
  title,
  tone,
  raw,
  model,
}: {
  title: string;
  tone: "positive" | "negative";
  raw: unknown;
  model: string;
}) {
  const items = normalizeEngagementContributors(raw, model, tone);

  if (items.length === 0) {
    return <JsonBlock title={title} value={raw ?? []} />;
  }

  return (
    <div className="ct-admin-subsection">
      <h4 className="ct-admin-subsection-title">{title}</h4>
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
                <span>Behavior</span>
                <strong>{item.behaviorLabel}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: AdminLearnerSessionInsight }) {
  const engagement = session.engagement;

  return (
    <article className="ct-admin-resource-card">
      <div className="ct-admin-resource-head">
        <div>
          <h3 className="ct-admin-resource-title">{session.videoTitle}</h3>
          <p className="ct-admin-resource-subtitle">
            Session {session.sessionId} • Video {session.videoId}
          </p>
        </div>
        <div className="ct-admin-badge-row">
          <span className="ct-admin-chip is-neutral">{session.status}</span>
        </div>
      </div>

      <div className="ct-admin-kv-grid">
        <div className="ct-admin-kv-card">
          <span>Created</span>
          <strong>{formatAdminDateTime(session.createdAtUtc)}</strong>
        </div>
        <div className="ct-admin-kv-card">
          <span>Ended</span>
          <strong>{formatAdminDateTime(session.endedAtUtc)}</strong>
        </div>
        <div className="ct-admin-kv-card">
          <span>Last Position</span>
          <strong>{formatAdminSeconds(session.lastPositionSec)}</strong>
        </div>
        <div className="ct-admin-kv-card">
          <span>Duration</span>
          <strong>{formatAdminSeconds(session.videoDurationSec)}</strong>
        </div>
      </div>

      <div className="ct-admin-subpanel">
        <h4 className="ct-admin-subsection-title">Engagement Insight</h4>
        {engagement ? (
          <>
            <div className="ct-admin-kv-grid">
              <div className="ct-admin-kv-card">
                <span>Score</span>
                <strong>{formatAdminPercent(engagement.engagementScore)}</strong>
              </div>
              <div className="ct-admin-kv-card">
                <span>Threshold</span>
                <strong>{formatAdminPercent(engagement.threshold)}</strong>
              </div>
              <div className="ct-admin-kv-card">
                <span>Status</span>
                <strong>{engagement.status}</strong>
              </div>
              <div className="ct-admin-kv-card">
                <span>Model</span>
                <strong>{engagement.model?.toUpperCase() || "-"}</strong>
              </div>
            </div>

            <div className="ct-admin-muted-box">{engagement.explanation || "No explanation available."}</div>

            <EngagementSignalSection
              title="Top Positive Signals"
              tone="positive"
              raw={engagement.topPositive}
              model={engagement.model}
            />
            <EngagementSignalSection
              title="Top Negative Signals"
              tone="negative"
              raw={engagement.topNegative}
              model={engagement.model}
            />
            <JsonBlock title="Raw Engagement Payload" value={engagement} />
          </>
        ) : (
          <div className="ct-admin-muted-box">No engagement result found for this session.</div>
        )}
      </div>

    </article>
  );
}

function QuizCard({ quiz }: { quiz: AdminLearnerQuizInsight }) {
  const reviewRows = useMemo(
    () =>
      normalizeUnknownArray(quiz.latestAttempt?.review)
        .map((row) => normalizeRecord(row))
        .filter((row): row is Record<string, unknown> => Boolean(row)),
    [quiz.latestAttempt?.review],
  );
  const mlResponseRecord = normalizeRecord(quiz.latestAttempt?.mlResponse);
  const mlSummary = mlResponseRecord
    ? {
        total_questions: mlResponseRecord.total_questions,
        answered_questions: mlResponseRecord.answered_questions,
        correct_answers: mlResponseRecord.correct_answers,
        incorrect_answers: mlResponseRecord.incorrect_answers,
        unanswered_questions: mlResponseRecord.unanswered_questions,
        quiz_score_percent: mlResponseRecord.quiz_score_percent,
      }
    : null;

  return (
    <article className="ct-admin-resource-card">
      <div className="ct-admin-resource-head">
        <div>
          <h3 className="ct-admin-resource-title">{quiz.videoTitle}</h3>
          <p className="ct-admin-resource-subtitle">
            Quiz {quiz.quizId} • Session {quiz.sessionId}
          </p>
        </div>
        <div className="ct-admin-badge-row">
          <span className="ct-admin-chip is-neutral">{quiz.difficulty || "UNKNOWN"}</span>
        </div>
      </div>

      <div className="ct-admin-kv-grid">
        <div className="ct-admin-kv-card">
          <span>Total Questions</span>
          <strong>{quiz.totalQuestions ?? quiz.questions.length}</strong>
        </div>
        <div className="ct-admin-kv-card">
          <span>Created</span>
          <strong>{formatAdminDateTime(quiz.createdAtUtc)}</strong>
        </div>
        <div className="ct-admin-kv-card">
          <span>Latest Score</span>
          <strong>{formatAdminPercent(quiz.latestAttempt?.scorePercent)}</strong>
        </div>
        <div className="ct-admin-kv-card">
          <span>Passed</span>
          <strong>{quiz.latestAttempt?.passedFlag ? "Yes" : "No"}</strong>
        </div>
      </div>

      {quiz.latestAttempt && (
        <div className="ct-admin-subpanel">
          <h4 className="ct-admin-subsection-title">Latest Attempt</h4>
          <div className="ct-admin-kv-grid">
            <div className="ct-admin-kv-card">
              <span>Attempt Id</span>
              <strong>{quiz.latestAttempt.attemptId}</strong>
            </div>
            <div className="ct-admin-kv-card">
              <span>Correct</span>
              <strong>{quiz.latestAttempt.correctCount ?? "-"} / {quiz.latestAttempt.totalCount ?? "-"}</strong>
            </div>
            <div className="ct-admin-kv-card">
              <span>Submitted</span>
              <strong>{formatAdminDateTime(quiz.latestAttempt.createdAtUtc)}</strong>
            </div>
          </div>
          <JsonBlock title="Raw Answers" value={quiz.latestAttempt.answers ?? {}} />
          <JsonBlock title="Raw Review Payload" value={quiz.latestAttempt.review ?? []} />
          <JsonBlock title="Raw ML Grade Response" value={quiz.latestAttempt.mlResponse ?? {}} />
        </div>
      )}

      {reviewRows.length > 0 && (
        <div className="ct-admin-subpanel">
          <h4 className="ct-admin-subsection-title">ML Grading Review</h4>
          <div className="ct-admin-question-list">
            {reviewRows.map((row, index) => {
              const questionId = stringifyPrimitive(
                row.question_id ?? row.questionId ?? row.id ?? `q${index + 1}`,
              );
              const submittedAnswer = stringifyPrimitive(
                row.submitted_answer ?? row.submittedAnswer ?? row.selectedAnswer,
              );
              const correctAnswer = stringifyPrimitive(row.correct_answer ?? row.correctAnswer);
              const explanation = stringifyPrimitive(row.explanation ?? row.reason ?? row.feedback);
              const isCorrect = row.is_correct ?? row.isCorrect;
              const correctnessLabel =
                typeof isCorrect === "boolean" ? (isCorrect ? "Correct" : "Incorrect") : "Unknown";

              return (
                <div key={`${quiz.quizId}-review-${index}`} className="ct-admin-question-card">
                  <div className="ct-admin-question-header">
                    <strong>{questionId}</strong>
                    <span className={`ct-admin-chip ${correctnessLabel === "Correct" ? "is-good" : "is-bad"}`}>
                      {correctnessLabel}
                    </span>
                  </div>
                  <div className="ct-admin-kv-grid">
                    <div className="ct-admin-kv-card">
                      <span>Submitted Answer</span>
                      <strong>{submittedAnswer}</strong>
                    </div>
                    <div className="ct-admin-kv-card">
                      <span>Correct Answer</span>
                      <strong>{correctAnswer}</strong>
                    </div>
                  </div>
                  <div className="ct-admin-muted-box">
                    <strong>Explanation:</strong> {explanation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mlSummary && (
        <div className="ct-admin-subpanel">
          <h4 className="ct-admin-subsection-title">ML Grade Summary</h4>
          <KeyValueGrid data={mlSummary} />
        </div>
      )}

      <div className="ct-admin-subpanel">
        <h4 className="ct-admin-subsection-title">Question Bank</h4>
        <div className="ct-admin-question-list">
          {quiz.questions.map((question, index) => {
            const options = normalizeOptions(question.options);
            return (
              <div key={`${quiz.quizId}-${question.id}`} className="ct-admin-question-card">
                <div className="ct-admin-question-header">
                  <strong>Q{index + 1}</strong>
                  <span>{question.questionType || "question"}</span>
                </div>
                <p className="ct-admin-question-text">{question.questionText || "-"}</p>

                {options.length > 0 && (
                  <div className="ct-admin-option-list">
                    {options.map((option) => (
                      <div key={option.key} className="ct-admin-option-row">
                        <span>{option.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="ct-admin-muted-box">
                  <strong>Question Explanation:</strong> {question.explanationText || "No explanation returned."}
                </div>

                <JsonBlock title="Raw Question Payload" value={question} />
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}

export function AdminLearnerProfilePage() {
  const { learnerId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<LearnerProfileTab>("sessions");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<SessionStatusFilter>("ALL");
  const [certificateAction, setCertificateAction] = useState<CertificateActionState>(null);

  const isAdmin = user?.role === "ADMIN";
  const learnerIdNum = Number(learnerId);
  const hasValidLearnerId = Number.isFinite(learnerIdNum) && learnerIdNum > 0;

  const profileQuery = useQuery({
    queryKey: ["admin-learner-profile", learnerIdNum],
    queryFn: () => getAdminLearnerProfile(learnerIdNum),
    enabled: isAdmin && hasValidLearnerId,
  });

  const refreshRelatedData = () => {
    qc.invalidateQueries({ queryKey: ["admin-learner-profile", learnerIdNum] });
    qc.invalidateQueries({ queryKey: ["admin-learners"] });
    qc.invalidateQueries({ queryKey: ["admin-certs"] });
  };

  const revokeMutation = useMutation({
    mutationFn: (certificateId: string) => revokeCertificate(certificateId),
    onSuccess: () => {
      toast.success("Certificate revoked successfully");
      setCertificateAction(null);
      refreshRelatedData();
    },
    onError: (error) => {
      toast.error(getApiMessage(error, "Failed to revoke certificate"));
    },
  });

  const activateMutation = useMutation({
    mutationFn: (certificateId: string) => activateCertificate(certificateId),
    onSuccess: () => {
      toast.success("Certificate activated successfully");
      refreshRelatedData();
    },
    onError: (error) => {
      toast.error(getApiMessage(error, "Failed to activate certificate"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (certificateId: string) => deleteCertificate(certificateId),
    onSuccess: () => {
      toast.success("Certificate deleted successfully");
      setCertificateAction(null);
      refreshRelatedData();
    },
    onError: (error) => {
      toast.error(getApiMessage(error, "Failed to delete certificate"));
    },
  });

  const modalOpen = Boolean(certificateAction);
  useEffect(() => {
    if (!modalOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [modalOpen]);

  const profile = profileQuery.data;

  const tabItems = useMemo(() => [
    { key: "sessions" as const, label: "Sessions + ML Insights", count: profile?.sessions.length || 0 },
    { key: "quizzes" as const, label: "Quizzes", count: profile?.quizzes.length || 0 },
    { key: "certificates" as const, label: "Certificates", count: profile?.certificates.length || 0 },
  ], [profile?.certificates.length, profile?.quizzes.length, profile?.sessions.length]);

  const sessionStatusCounts = useMemo(() => {
    const counts: Record<SessionStatusFilter, number> = {
      ALL: profile?.sessions.length || 0,
      ACTIVE: 0,
      COMPLETED: 0,
      QUIZ_PENDING: 0,
      CERTIFIED: 0,
    };

    (profile?.sessions || []).forEach((session) => {
      const status = (session.status || "").toUpperCase();
      if (status === "ACTIVE" || status === "COMPLETED" || status === "QUIZ_PENDING" || status === "CERTIFIED") {
        counts[status] += 1;
      }
    });

    return counts;
  }, [profile?.sessions]);

  const filteredSessions = useMemo(() => {
    const sessions = profile?.sessions || [];
    if (sessionStatusFilter === "ALL") {
      return sessions;
    }
    return sessions.filter((session) => (session.status || "").toUpperCase() === sessionStatusFilter);
  }, [profile?.sessions, sessionStatusFilter]);

  if (!isAdmin) {
    return <AdminAccessDenied />;
  }

  if (!hasValidLearnerId) {
    return (
      <div className="ct-empty" style={{ minHeight: 220 }}>
        <div className="ct-empty-icon">!</div>
        <p>Invalid learner id.</p>
        <button className="ct-btn ct-btn-secondary" onClick={() => nav("/admin")} style={{ marginTop: 16 }}>
          Back to ML Dashboard
        </button>
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="ct-slide-up ct-admin-engagement-page">
        <div className="ct-admin-skeleton-card" />
        <div className="ct-admin-skeleton-card" />
        <div className="ct-admin-skeleton-card" />
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="ct-empty" style={{ minHeight: 260 }}>
        <div className="ct-empty-icon">!</div>
        <p>{getApiMessage(profileQuery.error, "Failed to load learner profile.")}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="ct-btn ct-btn-secondary" onClick={() => nav("/admin")}>
            Back to ML Dashboard
          </button>
          <button className="ct-btn ct-btn-primary" onClick={() => profileQuery.refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="ct-empty" style={{ minHeight: 220 }}>
        <div className="ct-empty-icon">0</div>
        <p>Learner profile not found.</p>
      </div>
    );
  }

  const learner = profile.learner;

  const renderTabContent = () => {
    if (tab === "sessions") {
      return filteredSessions.length > 0
        ? filteredSessions.map((session) => <SessionCard key={session.sessionId} session={session} />)
        : (
          <div className="ct-admin-muted-box">
            {sessionStatusFilter === "ALL"
              ? "No sessions found for this learner."
              : `No ${SESSION_STATUS_FILTERS.find((s) => s.key === sessionStatusFilter)?.label.toLowerCase() || "matching"} found for this learner.`}
          </div>
        );
    }

    if (tab === "quizzes") {
      return profile.quizzes.length > 0
        ? profile.quizzes.map((quiz) => <QuizCard key={quiz.quizId} quiz={quiz} />)
        : <div className="ct-admin-muted-box">No quizzes found for this learner.</div>;
    }

    if (tab === "certificates") {
      return profile.certificates.length > 0
        ? (
          <div className="ct-admin-resource-grid">
            {profile.certificates.map((certificate) => {
              const status = (certificate.status || "").toUpperCase();
              const isRevoked = status === "REVOKED";
              const activating = activateMutation.isPending && activateMutation.variables === certificate.certificateId;
              const pendingAction = certificateAction?.certificate.certificateId === certificate.certificateId
                && (revokeMutation.isPending || deleteMutation.isPending);
              return (
                <article key={certificate.certificateId} className="ct-admin-resource-card">
                  <div className="ct-admin-resource-head">
                    <div>
                      <h3 className="ct-admin-resource-title">{certificate.videoTitle || certificate.certificateNumber}</h3>
                      <p className="ct-admin-resource-subtitle">{certificate.certificateNumber}</p>
                    </div>
                    <div className="ct-admin-badge-row">
                      <span className={`ct-admin-chip ${isRevoked ? "is-bad" : "is-good"}`}>{status || "ACTIVE"}</span>
                    </div>
                  </div>

                  <div className="ct-admin-kv-grid">
                    <div className="ct-admin-kv-card">
                      <span>Score</span>
                      <strong>{formatAdminPercent(certificate.scorePercent)}</strong>
                    </div>
                    <div className="ct-admin-kv-card">
                      <span>Engagement</span>
                      <strong>{formatAdminPercent(certificate.finalEngagementScore)}</strong>
                    </div>
                    <div className="ct-admin-kv-card">
                      <span>Quiz</span>
                      <strong>{formatAdminPercent(certificate.finalQuizScore)}</strong>
                    </div>
                    <div className="ct-admin-kv-card">
                      <span>Issued</span>
                      <strong>{formatAdminDateTime(certificate.createdAtUtc)}</strong>
                    </div>
                  </div>

                  <div className="ct-admin-inline-actions">
                    {isRevoked ? (
                      <button
                        className="ct-btn ct-btn-primary ct-btn-sm"
                        onClick={() => activateMutation.mutate(certificate.certificateId)}
                        disabled={activating}
                      >
                        {activating ? "Activating..." : "Activate"}
                      </button>
                    ) : (
                      <button
                        className="ct-btn ct-btn-warning ct-btn-sm"
                        onClick={() => setCertificateAction({ action: "revoke", certificate })}
                        disabled={pendingAction}
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      className="ct-btn ct-btn-danger ct-btn-sm"
                      onClick={() => setCertificateAction({ action: "delete", certificate })}
                      disabled={pendingAction}
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )
        : <div className="ct-admin-muted-box">No certificates found for this learner.</div>;
    }

    return null;
  };

  return (
    <div className="ct-slide-up ct-admin-engagement-page">
      <div className="ct-admin-module-header">
        <div>
          <div className="ct-admin-module-kicker">Admin Only</div>
          <h1 className="ct-page-title">Learner Profile</h1>
          <p className="ct-page-subtitle">Inspect one learner's sessions, ML insights, quizzes, and certificates.</p>
        </div>
        <div className="ct-admin-module-actions">
          <button className="ct-btn ct-btn-secondary" onClick={() => nav("/admin")}>
            <ArrowLeft size={14} />
            Back to ML Dashboard
          </button>
        </div>
      </div>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-engagement-hero">
          <div className="ct-admin-engagement-hero-copy">
            <div className="ct-admin-detail-eyebrow">Learner {learner.userId}</div>
            <h2 className="ct-admin-detail-title">{learner.name?.trim() || "Unnamed learner"}</h2>
            <p className="ct-admin-detail-subtitle">
              <Mail size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
              {learner.email}
            </p>
          </div>
          <div className="ct-admin-badge-row">
            <span className={`ct-admin-chip ${learner.active !== false ? "is-good" : "is-bad"}`}>
              {learner.active !== false ? "Active" : "Inactive"}
            </span>
            <span className={`ct-admin-chip ${learner.emailVerified ? "is-good" : "is-neutral"}`}>
              {learner.emailVerified ? "Email Verified" : "Email Unverified"}
            </span>
            <span className="ct-admin-chip is-neutral">{learner.role}</span>
          </div>
        </div>

        <div className="ct-admin-metric-grid ct-admin-metric-grid-compact">
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Created</span>
            <strong className="ct-admin-metric-value">{formatIsoDate(learner.createdAtUtc || null)}</strong>
            <span className="ct-admin-metric-note">Account created at</span>
          </div>
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Sessions</span>
            <strong className="ct-admin-metric-value">{learner.sessionCount ?? profile.sessions.length}</strong>
            <span className="ct-admin-metric-note">Tracked learner sessions</span>
          </div>
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Quizzes</span>
            <strong className="ct-admin-metric-value">{profile.quizzes.length}</strong>
            <span className="ct-admin-metric-note">Generated learner quizzes</span>
          </div>
          <div className="ct-admin-metric-card">
            <span className="ct-admin-metric-label">Certificates</span>
            <strong className="ct-admin-metric-value">{learner.certificateCount ?? profile.certificates.length}</strong>
            <span className="ct-admin-metric-note">Issued certificates</span>
          </div>
        </div>
      </section>

      <section className="ct-admin-panel-card">
        <div className="ct-admin-tab-strip">
          {tabItems.map((item) => (
            <button
              key={item.key}
              className={`ct-admin-tab-btn ${tab === item.key ? "active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              <span>{item.label}</span>
              <span className="ct-admin-tab-count">{item.count}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ct-admin-tab-panel">
        {tab === "sessions" && (
          <>
            <SectionHeader
              icon={<Film size={18} />}
              title="Sessions + ML Insights"
              subtitle="Review active, completed, quiz-pending, and certified sessions with engagement explanation/signals."
            />
            <div className="ct-admin-subpanel">
              <h4 className="ct-admin-subsection-title">Session Status Breakdown</h4>
              <div className="ct-admin-kv-grid">
                {SESSION_STATUS_FILTERS.map((statusFilter) => (
                  <div key={`status-summary-${statusFilter.key}`} className="ct-admin-kv-card">
                    <span>{statusFilter.label}</span>
                    <strong>{sessionStatusCounts[statusFilter.key]}</strong>
                  </div>
                ))}
              </div>
              <div className="ct-admin-filter-row">
                {SESSION_STATUS_FILTERS.map((statusFilter) => {
                  const selected = sessionStatusFilter === statusFilter.key;
                  return (
                    <button
                      key={`status-filter-${statusFilter.key}`}
                      type="button"
                      className={`ct-btn ct-btn-sm ${selected ? "ct-btn-primary" : "ct-btn-secondary"}`}
                      onClick={() => setSessionStatusFilter(statusFilter.key)}
                    >
                      {statusFilter.label} ({sessionStatusCounts[statusFilter.key]})
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        {tab === "quizzes" && (
          <SectionHeader
            icon={<BookOpen size={18} />}
            title="Quizzes"
            subtitle="Review quiz metadata, ML grading review, raw ML grade payload, and question content."
          />
        )}
        {tab === "certificates" && (
          <SectionHeader
            icon={<Award size={18} />}
            title="Certificates"
            subtitle="Manage certificate state and inspect final scoring evidence."
          />
        )}

        <div className="ct-admin-resource-stack">
          {renderTabContent()}
        </div>
      </section>

      {certificateAction && createPortal(
        <div className="ct-modal-backdrop" onClick={() => {
          if (revokeMutation.isPending || deleteMutation.isPending) return;
          setCertificateAction(null);
        }}>
          <div className="ct-modal-card ct-delete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ct-delete-modal-icon">
              {certificateAction.action === "revoke" ? <CircleOff size={22} /> : <Trash2 size={22} />}
            </div>
            <h3 className="ct-delete-modal-title">
              {certificateAction.action === "revoke" ? "Revoke Certificate?" : "Delete Certificate?"}
            </h3>
            <p className="ct-delete-modal-text">
              {certificateAction.action === "revoke"
                ? "This will mark the certificate as revoked and invalid for verification."
                : "This will permanently delete the certificate record from the platform."}
            </p>
            <p className="ct-delete-modal-subtext">
              <strong>{certificateAction.certificate.certificateNumber}</strong>
            </p>
            <div className="ct-modal-actions" style={{ marginTop: 16 }}>
              <button
                className="ct-btn ct-btn-secondary"
                onClick={() => setCertificateAction(null)}
                disabled={revokeMutation.isPending || deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                className={`ct-btn ${certificateAction.action === "revoke" ? "ct-btn-warning" : "ct-btn-danger"}`}
                onClick={() => {
                  if (certificateAction.action === "revoke") {
                    revokeMutation.mutate(certificateAction.certificate.certificateId);
                    return;
                  }
                  deleteMutation.mutate(certificateAction.certificate.certificateId);
                }}
                disabled={revokeMutation.isPending || deleteMutation.isPending}
              >
                {certificateAction.action === "revoke"
                  ? (revokeMutation.isPending ? "Revoking..." : "Revoke")
                  : (deleteMutation.isPending ? "Deleting..." : "Delete")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
