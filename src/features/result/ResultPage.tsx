import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, CheckCircle, Download, RotateCcw, Share2, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import { downloadCertificatePdf } from "../../api/certificate";
import { getQuiz, getQuizEligibility, getQuizResult } from "../../api/quiz";
import type { QuizEligibility, QuizGenerateResponse, QuizQuestion, QuizReviewItem, QuizSubmitResponse } from "../../types/quiz";

type ResultLocationState = {
  result?: QuizSubmitResponse;
  quizQuestions?: QuizQuestion[];
  submittedAnswers?: Record<string, string>;
  submitError?: string;
  sessionId?: string;
  videoId?: string;
  videoTitle?: string;
  fromStatus?: "active" | "completed" | "quiz";
  fromPath?: string;
};

const QUIZ_ATTEMPT_TRACKER_STORAGE_KEY = "ct_quiz_attempt_tracker_v1";
const QUIZ_DEFAULT_MAX_ATTEMPTS = 2;

function getConsumedQuizAttempts(sessionId: string | null): number {
  if (!sessionId) return 0;
  try {
    const raw = localStorage.getItem(QUIZ_ATTEMPT_TRACKER_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entry = parsed?.[sessionId];
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return Math.max(0, Math.floor(entry));
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return 0;
    const consumed = (entry as { consumed?: unknown }).consumed;
    if (!Number.isFinite(consumed as number)) return 0;
    return Math.max(0, Math.floor(consumed as number));
  } catch {
    return 0;
  }
}

type ReviewRow = {
  questionId: string;
  questionText: string;
  yourAnswer: string;
  correctAnswer: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
};

function asText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function answerNorm(value: unknown): string {
  return asText(value).toLowerCase();
}

function questionKey(q: QuizQuestion, idx: number): string {
  const key = asText(q.questionId);
  return key.length > 0 ? key : `q${idx + 1}`;
}

function toRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = asText(v);
  }
  return out;
}

function reviewArraySource(raw: any): { key: string; items: any[] } | null {
  const keys = [
    "review",
    "questionResults",
    "answerReview",
    "evaluation",
    "wrongQuestions",
    "incorrectQuestions",
  ];
  for (const key of keys) {
    const val = raw?.[key];
    if (Array.isArray(val) && val.length > 0) {
      return { key, items: val };
    }
  }
  return null;
}

function buildReviewRows(
  result: QuizSubmitResponse | null,
  quizQuestions: QuizQuestion[],
  submittedAnswers: Record<string, string>,
): ReviewRow[] {
  if (!result) return [];
  const raw: any = result;

  const questionTextById = new Map<string, string>();
  for (let i = 0; i < quizQuestions.length; i += 1) {
    const q = quizQuestions[i];
    const key = questionKey(q, i);
    questionTextById.set(key, asText(q.questionText) || `Question ${i + 1}`);
    questionTextById.set(`q${i + 1}`, asText(q.questionText) || `Question ${i + 1}`);
    if (asText(q.questionId)) questionTextById.set(asText(q.questionId), asText(q.questionText) || `Question ${i + 1}`);
  }

  const answersFromResult = toRecord(raw?.answers) || toRecord(raw?.userAnswers) || {};
  const mergedAnswers: Record<string, string> = { ...answersFromResult, ...submittedAnswers };

  const source = reviewArraySource(raw);
  if (source) {
    const assumeWrong = source.key === "wrongQuestions" || source.key === "incorrectQuestions";

    return source.items.map((item: QuizReviewItem | any, idx: number) => {
      const sourceId =
        asText(item?.questionId)
        || asText(item?.id)
        || asText(item?.qid)
        || asText(item?.questionKey)
        || asText(item?.key)
        || `q${idx + 1}`;

      const text =
        asText(item?.questionText)
        || asText(item?.question)
        || asText(item?.text)
        || questionTextById.get(sourceId)
        || questionTextById.get(`q${idx + 1}`)
        || `Question ${idx + 1}`;

      const your =
        asText(item?.selectedAnswer)
        || asText(item?.submittedAnswer)
        || asText(item?.userAnswer)
        || asText(item?.answer)
        || asText(mergedAnswers[sourceId]);

      const correct = asText(item?.correctAnswer) || asText(item?.expectedAnswer) || "";

      let isCorrect: boolean | null = null;
      if (typeof item?.isCorrect === "boolean") {
        isCorrect = item.isCorrect;
      } else if (typeof item?.correct === "boolean") {
        isCorrect = item.correct;
      } else if (assumeWrong) {
        isCorrect = false;
      } else if (your && correct) {
        isCorrect = answerNorm(your) === answerNorm(correct);
      }

      const explanation = asText(item?.explanation) || asText(item?.reason) || asText(item?.feedback);

      return {
        questionId: sourceId,
        questionText: text,
        yourAnswer: your,
        correctAnswer: correct || null,
        isCorrect,
        explanation: explanation || null,
      };
    });
  }

  const correctAnswers = toRecord(raw?.correctAnswers);
  if (correctAnswers) {
    const keys = new Set<string>([
      ...Object.keys(correctAnswers),
      ...Object.keys(mergedAnswers),
      ...quizQuestions.map((q, idx) => questionKey(q, idx)),
    ]);

    return [...keys].map((id, idx) => {
      const your = asText(mergedAnswers[id]);
      const correct = asText(correctAnswers[id]);
      const text = questionTextById.get(id) || questionTextById.get(`q${idx + 1}`) || `Question ${idx + 1}`;

      let isCorrect: boolean | null = null;
      if (your && correct) {
        isCorrect = answerNorm(your) === answerNorm(correct);
      }

      return {
        questionId: id,
        questionText: text,
        yourAnswer: your,
        correctAnswer: correct || null,
        isCorrect,
        explanation: null,
      };
    });
  }

  const wrongIds = Array.isArray(raw?.wrongQuestionIds)
    ? raw.wrongQuestionIds
    : Array.isArray(raw?.incorrectQuestionIds)
      ? raw.incorrectQuestionIds
      : [];
  if (wrongIds.length > 0) {
    return wrongIds.map((id: string, idx: number) => ({
      questionId: id,
      questionText: questionTextById.get(id) || questionTextById.get(`q${idx + 1}`) || id,
      yourAnswer: asText(mergedAnswers[id]),
      correctAnswer: null,
      isCorrect: false,
      explanation: null,
    }));
  }

  if (quizQuestions.length > 0) {
    const fallbackRows = quizQuestions.map((q, idx) => {
      const id = questionKey(q, idx);
      const your =
        asText(mergedAnswers[id])
        || asText(mergedAnswers[asText(q.questionId)])
        || asText(mergedAnswers[`q${idx + 1}`]);
      const correct = asText(q.correctAnswer) || asText(q.answer);

      let isCorrect: boolean | null = null;
      if (your && correct) {
        isCorrect = answerNorm(your) === answerNorm(correct);
      }

      return {
        questionId: id,
        questionText: asText(q.questionText) || `Question ${idx + 1}`,
        yourAnswer: your,
        correctAnswer: correct || null,
        isCorrect,
        explanation: asText(q.explanation) || null,
      };
    }).filter((row) => row.yourAnswer || row.correctAnswer);

    if (fallbackRows.length > 0) {
      return fallbackRows;
    }
  }

  return [];
}

export function ResultPage() {
  const { quizId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const locationState = (location.state as ResultLocationState | null) || null;
  const fromStatus = locationState?.fromStatus === "active" || locationState?.fromStatus === "completed" || locationState?.fromStatus === "quiz"
    ? locationState.fromStatus
    : "quiz";
  const fromPath = (locationState?.fromPath || `/my-learnings?status=${fromStatus}`).trim();

  const stateResult = locationState?.result;
  const [result, setResult] = useState<QuizSubmitResponse | null>(stateResult || null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(locationState?.quizQuestions || []);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string>>(locationState?.submittedAnswers || {});
  const [quizMeta, setQuizMeta] = useState<Pick<QuizGenerateResponse, "sessionId" | "videoId" | "videoTitle"> | null>(
    locationState?.sessionId
      ? {
        sessionId: locationState.sessionId,
        videoId: locationState.videoId || "",
        videoTitle: locationState.videoTitle || "",
      }
      : null,
  );
  const [eligibility, setEligibility] = useState<QuizEligibility | null>(null);
  const submitError = locationState?.submitError || "";

  const [loading, setLoading] = useState(!stateResult);
  const [downloading, setDownloading] = useState(false);
  const [resolvingCertificate, setResolvingCertificate] = useState(false);

  useEffect(() => {
    if (stateResult || !quizId) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await getQuizResult(quizId);
        if (cancelled) return;
        setResult(r);
      } catch (e: any) {
        if (cancelled) return;
        toast.error(e?.message || "Failed to load result");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, stateResult]);

  useEffect(() => {
    if (!quizId || (quizQuestions.length > 0 && quizMeta?.sessionId)) return;

    let cancelled = false;
    (async () => {
      try {
        const q = await getQuiz(quizId);
        if (cancelled) return;
        setQuizQuestions(q.questions || []);
        setQuizMeta({
          sessionId: q.sessionId,
          videoId: q.videoId,
          videoTitle: q.videoTitle,
        });
      } catch {
        // quiz detail not critical for result header
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, quizMeta?.sessionId, quizQuestions.length]);

  useEffect(() => {
    if (Object.keys(submittedAnswers).length > 0 || !result) return;
    const fromResult = toRecord((result as any)?.answers) || toRecord((result as any)?.userAnswers);
    if (fromResult) setSubmittedAnswers(fromResult);
  }, [result, submittedAnswers]);

  useEffect(() => {
    if (!quizId || !result?.passed || result.certificateId) return;
    const timer = window.setTimeout(async () => {
      try {
        const latest = await getQuizResult(quizId);
        setResult(latest);
      } catch {
        // ignore silent refresh failures
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [quizId, result?.passed, result?.certificateId]);

  useEffect(() => {
    if (!quizMeta?.sessionId || !result || result.passed) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await getQuizEligibility(quizMeta.sessionId);
        if (cancelled) return;
        setEligibility(res);
      } catch {
        if (cancelled) return;
        setEligibility(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizMeta?.sessionId, result, result?.passed]);

  const explanation = useMemo(() => {
    const raw: any = result;
    const fromBackend = asText(raw?.explanation) || asText(raw?.feedback);
    if (fromBackend) return fromBackend;
    if (!result) return "";
    if (result.passed) {
      return "You passed the quiz based on your score and correct answer count. You can now open your certificate.";
    }
    return "You did not reach the passing score. Review incorrect answers, watch again, and retry the quiz.";
  }, [result]);

  const reviewRows = useMemo(
    () => buildReviewRows(result, quizQuestions, submittedAnswers),
    [result, quizQuestions, submittedAnswers],
  );

  const wrongRows = useMemo(
    () => reviewRows.filter((row) => row.isCorrect === false),
    [reviewRows],
  );

  const canShowWrongRows = useMemo(
    () => wrongRows.length > 0,
    [wrongRows],
  );

  const consumedAttemptsUsed = useMemo(
    () => getConsumedQuizAttempts(quizMeta?.sessionId || null),
    [quizMeta?.sessionId],
  );

  const maxFailedAttempts = eligibility?.maxFailedAttempts || QUIZ_DEFAULT_MAX_ATTEMPTS;
  const backendRemainingAttempts = useMemo(() => {
    if (!eligibility) return maxFailedAttempts;
    if (typeof eligibility.remainingAttempts === "number") return Math.max(0, eligibility.remainingAttempts);
    return Math.max(0, maxFailedAttempts - (eligibility.failedAttemptsUsed || 0));
  }, [eligibility, maxFailedAttempts]);
  const remainingQuizAttempts = Math.max(
    0,
    Math.min(backendRemainingAttempts, maxFailedAttempts - consumedAttemptsUsed),
  );

  const refreshResultOnce = async (): Promise<QuizSubmitResponse | null> => {
    if (!quizId) return result;
    try {
      const latest = await getQuizResult(quizId);
      setResult(latest);
      return latest;
    } catch (e: any) {
      toast.error(e?.message || "Failed to refresh quiz result");
      return null;
    }
  };

  const handleGetCertificate = async () => {
    if (!result?.passed) return;

    let latest = result;
    if (!latest.certificateId) {
      setResolvingCertificate(true);
      const refreshed = await refreshResultOnce();
      setResolvingCertificate(false);
      latest = refreshed || latest;
    }

    if (!latest?.certificateId) {
      toast.error("Certificate is not ready yet. Please try again.");
      return;
    }

    nav(`/certificate/${latest.certificateId}`, {
      state: {
        fromStatus,
        fromPath,
      },
    });
  };

  const handleDownload = async () => {
    if (!result?.passed) return;

    let certificateId = result.certificateId;
    if (!certificateId) {
      const refreshed = await refreshResultOnce();
      certificateId = refreshed?.certificateId || null;
    }
    if (!certificateId) {
      toast.error("Certificate is not ready yet. Please try again.");
      return;
    }

    setDownloading(true);
    try {
      await downloadCertificatePdf(certificateId);
      toast.success("Certificate downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    let verificationLink = result?.verificationLink || null;
    if (!verificationLink) {
      const refreshed = await refreshResultOnce();
      verificationLink = refreshed?.verificationLink || null;
    }

    if (!verificationLink) {
      toast.error("Verification link is not available yet.");
      return;
    }
    await navigator.clipboard.writeText(verificationLink);
    toast.success("Verification link copied");
  };

  const goMyLearnings = () => nav(fromPath, { state: { initialStatus: fromStatus } });

  const goBack = () => {
    if (window.history.length > 1) {
      nav(-1);
      return;
    }
    goMyLearnings();
  };

  const handleRetryQuiz = () => {
    if (!quizMeta?.sessionId) {
      toast.error("Quiz session not found");
      return;
    }

    nav(`/quiz/${quizMeta.sessionId}`, {
      state: {
        sessionId: quizMeta.sessionId,
        videoId: quizMeta.videoId,
        videoTitle: quizMeta.videoTitle,
        fromStatus,
        fromPath,
      },
    });
  };

  const handleWatchAgain = () => {
    if (!quizMeta?.videoId) {
      goMyLearnings();
      return;
    }
    nav(`/watch/${quizMeta.videoId}`, {
      state: {
        videoTitle: quizMeta.videoTitle,
        fromStatus,
        fromPath,
      },
    });
  };

  if (loading) {
    return (
      <div className="ct-loading" style={{ minHeight: 300 }}>
        <div className="ct-spinner" />
        <span>Loading result...</span>
      </div>
    );
  }

  if (!result) return <div className="ct-empty">Result not found</div>;

  return (
    <div className="ct-slide-up" style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="ct-analyze-topbar">
        <button className="ct-btn ct-btn-secondary ct-btn-sm ct-analyze-back-btn" onClick={goBack}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="ct-btn ct-btn-sm ct-analyze-close-btn" onClick={goMyLearnings}>
          <X size={14} /> Close
        </button>
      </div>

      <div className="ct-glass-card" style={{ marginBottom: 18, textAlign: "center" }}>
        {result.passed ? (
          <>
            <Award size={62} style={{ color: "var(--ct-success)", marginBottom: 12 }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ct-success)", marginBottom: 8 }}>
              <CheckCircle size={26} style={{ verticalAlign: "middle", marginRight: 8 }} />
              Quiz Passed
            </h1>
          </>
        ) : (
          <>
            <XCircle size={62} style={{ color: "var(--ct-error)", marginBottom: 12 }} />
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ct-error)", marginBottom: 8 }}>
              Quiz Not Passed
            </h1>
          </>
        )}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 30 }}>
          <div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                background: result.passed ? "var(--ct-gradient-success)" : "var(--ct-gradient-warm)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {result.scorePercent.toFixed(0)}%
            </div>
            <div style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>Score</div>
          </div>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, color: "var(--ct-text)" }}>
              {result.correctCount}/{result.totalCount}
            </div>
            <div style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>Correct</div>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="ct-banner ct-banner-warning" style={{ marginBottom: 18 }}>
          {submitError}
        </div>
      )}

      <div className="ct-card" style={{ marginBottom: 18 }}>
        <h2 className="ct-section-title" style={{ fontSize: 18, marginBottom: 10 }}>Result Explanation</h2>
        <p style={{ color: "var(--ct-text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
          {explanation}
        </p>
      </div>

      {!result.passed && (
        <div className="ct-banner ct-banner-info" style={{ marginBottom: 18 }}>
          Remaining quiz attempts: {remainingQuizAttempts} / {maxFailedAttempts}
        </div>
      )}

      {!result.passed && (
        <div className="ct-card" style={{ marginBottom: 18 }}>
          <h2 className="ct-section-title" style={{ fontSize: 18, marginBottom: 10 }}>Incorrect Questions</h2>

          {canShowWrongRows ? (
            <div style={{ display: "grid", gap: 10 }}>
              {wrongRows.map((row, idx) => (
                <div
                  key={`${row.questionId}-${idx}`}
                  style={{
                    border: "1px solid rgba(239, 68, 68, 0.24)",
                    background: "rgba(239, 68, 68, 0.06)",
                    borderRadius: "var(--ct-radius-sm)",
                    padding: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    Q{idx + 1}. {row.questionText}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ct-text-secondary)" }}>
                    Your answer: <strong>{row.yourAnswer || "-"}</strong>
                  </div>
                  {row.correctAnswer && (
                    <div style={{ fontSize: 13, color: "var(--ct-text-secondary)" }}>
                      Correct answer: <strong>{row.correctAnswer}</strong>
                    </div>
                  )}
                  {row.explanation && (
                    <div style={{ fontSize: 12, color: "var(--ct-text-muted)", marginTop: 6 }}>
                      {row.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="ct-banner ct-banner-warning">
              Detailed question-level review is unavailable for this attempt.
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {!result.passed && remainingQuizAttempts > 0 && (
          <button className="ct-btn ct-btn-primary" onClick={handleRetryQuiz} id="retry-quiz-btn">
            <RotateCcw size={16} /> Re-Take Quiz
          </button>
        )}

        {!result.passed && remainingQuizAttempts <= 0 && (
          <button className="ct-btn ct-btn-secondary" onClick={handleWatchAgain} id="watch-again-btn">
            <RotateCcw size={16} /> Watch Again
          </button>
        )}

        {result.passed && (
          <button
            className="ct-btn ct-btn-primary"
            onClick={handleGetCertificate}
            disabled={resolvingCertificate}
            id="get-certificate-btn"
          >
            <Award size={16} />
            {resolvingCertificate ? "Checking certificate..." : "Get Certificate"}
          </button>
        )}

        {result.passed && (
          <button className="ct-btn ct-btn-secondary" onClick={handleDownload} disabled={downloading} id="download-cert-btn">
            <Download size={16} />
            {downloading ? "Downloading..." : "Download Certificate PDF"}
          </button>
        )}

        {result.verificationLink && (
          <button className="ct-btn ct-btn-secondary" onClick={handleShare} id="share-link-btn">
            <Share2 size={16} /> Copy Verification Link
          </button>
        )}
      </div>
    </div>
  );
}
