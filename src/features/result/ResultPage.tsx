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
    const obj = entry as { consumed?: unknown; quizIds?: unknown };
    const storedConsumed = Number.isFinite(obj.consumed as number)
      ? Math.max(0, Math.floor(obj.consumed as number))
      : 0;

    const validQuizIds: Record<string, true> = {};
    let migrated = false;
    if (obj.quizIds && typeof obj.quizIds === "object" && !Array.isArray(obj.quizIds)) {
      for (const [quizId, flag] of Object.entries(obj.quizIds as Record<string, unknown>)) {
        if (!quizId || !flag) continue;
        if (quizId.startsWith("close:") || quizId.startsWith("misuse:")) {
          migrated = true;
          continue;
        }
        validQuizIds[quizId] = true;
      }
    }

    const dedupedConsumed = Object.keys(validQuizIds).length;
    const consumed = dedupedConsumed > 0 ? dedupedConsumed : storedConsumed;
    if (dedupedConsumed > 0 && storedConsumed !== dedupedConsumed) {
      migrated = true;
    }

    if (migrated) {
      parsed[sessionId] = { consumed, quizIds: validQuizIds };
      localStorage.setItem(QUIZ_ATTEMPT_TRACKER_STORAGE_KEY, JSON.stringify(parsed));
    }

    return consumed;
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

const QUIZ_SUBMITTED_ANSWERS_STORAGE_KEY = "ct_quiz_submitted_answers_v1";

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

function readSubmittedAnswersCache(quizId: string | null | undefined): Record<string, string> | null {
  if (!quizId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(QUIZ_SUBMITTED_ANSWERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entry = parsed?.[quizId];
    return toRecord(entry);
  } catch {
    return null;
  }
}

function writeSubmittedAnswersCache(quizId: string | null | undefined, answers: Record<string, string>) {
  if (!quizId || typeof window === "undefined" || Object.keys(answers).length === 0) return;
  try {
    const raw = window.sessionStorage.getItem(QUIZ_SUBMITTED_ANSWERS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    parsed[quizId] = answers;
    window.sessionStorage.setItem(QUIZ_SUBMITTED_ANSWERS_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // noop
  }
}

function reviewItemId(item: QuizReviewItem, idx: number): string {
  return (
    asText(item.questionId)
    || `q${idx + 1}`
  );
}

function collectReviewItems(result: QuizSubmitResponse): QuizReviewItem[] {
  if (Array.isArray(result.review) && result.review.length > 0) {
    return result.review;
  }

  const fallbackArrays: Array<QuizReviewItem[] | undefined> = [
    result.questionResults,
    result.wrongQuestions,
    result.incorrectQuestions,
  ];

  const merged: QuizReviewItem[] = [];
  for (const arr of fallbackArrays) {
    if (!Array.isArray(arr)) continue;
    merged.push(...arr);
  }
  return merged;
}

function buildReviewRows(
  result: QuizSubmitResponse | null,
  quizQuestions: QuizQuestion[],
  submittedAnswers: Record<string, string>,
): ReviewRow[] {
  if (!result) return [];
  const answersFromResult = toRecord(result.answers) || toRecord(result.userAnswers) || {};
  const mergedAnswers: Record<string, string> = { ...answersFromResult, ...submittedAnswers };

  const reviewByQuestionId = new Map<string, QuizReviewItem>();
  const reviewItems = collectReviewItems(result);
  reviewItems.forEach((item, idx) => {
    const id = reviewItemId(item, idx);
    reviewByQuestionId.set(id, item);
  });

  const rows: ReviewRow[] = [];
  const seenQuestionIds = new Set<string>();

  for (let idx = 0; idx < quizQuestions.length; idx += 1) {
    const q = quizQuestions[idx];
    const id = questionKey(q, idx);
    const fallbackId = `q${idx + 1}`;
    const reviewItem = reviewByQuestionId.get(id) || reviewByQuestionId.get(fallbackId);

    const yourAnswer =
      asText(reviewItem?.selectedAnswer)
      || asText(reviewItem?.submittedAnswer)
      || asText(reviewItem?.userAnswer)
      || asText(reviewItem?.answer)
      || asText(mergedAnswers[id])
      || asText(mergedAnswers[fallbackId]);

    const correctAnswer =
      asText(reviewItem?.correctAnswer)
      || asText(reviewItem?.expectedAnswer);

    let isCorrect: boolean | null = null;
    if (typeof reviewItem?.correct === "boolean") {
      isCorrect = reviewItem.correct;
    } else if (typeof reviewItem?.isCorrect === "boolean") {
      isCorrect = reviewItem.isCorrect;
    } else if (yourAnswer && correctAnswer) {
      isCorrect = answerNorm(yourAnswer) === answerNorm(correctAnswer);
    }

    const row: ReviewRow = {
      questionId: id,
      questionText: asText(reviewItem?.questionText) || asText(q.questionText) || `Question ${idx + 1}`,
      yourAnswer,
      correctAnswer: correctAnswer || null,
      isCorrect,
      explanation:
        asText(reviewItem?.explanation)
        || asText(reviewItem?.reason)
        || asText(reviewItem?.feedback)
        || null,
    };

    rows.push(row);
    seenQuestionIds.add(id);
    seenQuestionIds.add(fallbackId);
  }

  for (let idx = 0; idx < reviewItems.length; idx += 1) {
    const item = reviewItems[idx];
    const id = reviewItemId(item, idx);
    if (seenQuestionIds.has(id)) continue;

    const yourAnswer =
      asText(item.selectedAnswer)
      || asText(item.submittedAnswer)
      || asText(item.userAnswer)
      || asText(item.answer)
      || asText(mergedAnswers[id]);
    const correctAnswer =
      asText(item.correctAnswer)
      || asText(item.expectedAnswer);

    let isCorrect: boolean | null = null;
    if (typeof item.correct === "boolean") {
      isCorrect = item.correct;
    } else if (typeof item.isCorrect === "boolean") {
      isCorrect = item.isCorrect;
    } else if (yourAnswer && correctAnswer) {
      isCorrect = answerNorm(yourAnswer) === answerNorm(correctAnswer);
    }

    rows.push({
      questionId: id,
      questionText: asText(item.questionText) || id,
      yourAnswer,
      correctAnswer: correctAnswer || null,
      isCorrect,
      explanation: asText(item.explanation) || asText(item.reason) || asText(item.feedback) || null,
    });
    seenQuestionIds.add(id);
  }

  if (rows.length === 0) {
    for (const [id, ans] of Object.entries(mergedAnswers)) {
      rows.push({
        questionId: id,
        questionText: id,
        yourAnswer: ans,
        correctAnswer: null,
        isCorrect: null,
        explanation: null,
      });
    }
  }

  return rows;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewLoadError, setReviewLoadError] = useState<string | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
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
        setLoadError(null);
      } catch (e: any) {
        if (cancelled) return;
        setLoadError(e?.message || "Failed to load result");
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
        setReviewLoadError(null);
      } catch {
        if (cancelled) return;
        setReviewLoadError("Question details could not be loaded for this result.");
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
    if (!quizId || Object.keys(submittedAnswers).length > 0) return;
    const cached = readSubmittedAnswersCache(quizId);
    if (cached) setSubmittedAnswers(cached);
  }, [quizId, submittedAnswers]);

  useEffect(() => {
    if (!quizId || Object.keys(submittedAnswers).length === 0) return;
    writeSubmittedAnswersCache(quizId, submittedAnswers);
  }, [quizId, submittedAnswers]);

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
    setEligibilityLoading(true);
    (async () => {
      try {
        const res = await getQuizEligibility(quizMeta.sessionId);
        if (cancelled) return;
        setEligibility(res);
      } catch {
        if (cancelled) return;
        setEligibility(null);
      } finally {
        if (!cancelled) setEligibilityLoading(false);
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
  const canRevealReview = Boolean(result?.passed) || (!eligibilityLoading && remainingQuizAttempts <= 0);

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
    <div className="ct-slide-up ct-result-page">
      <div className="ct-analyze-topbar">
        <button className="ct-btn ct-btn-secondary ct-btn-sm ct-analyze-back-btn" onClick={goBack}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="ct-btn ct-btn-sm ct-analyze-close-btn" onClick={goMyLearnings}>
          <X size={14} /> Close
        </button>
      </div>

      <div className={`ct-glass-card ct-result-hero ${result.passed ? "passed" : "failed"}`}>
        {result.passed ? (
          <>
            <Award size={62} className="ct-result-hero-icon" />
            <h1 className="ct-result-hero-title passed">
              <CheckCircle size={24} className="ct-result-hero-title-icon" />
              Quiz Passed
            </h1>
          </>
        ) : (
          <>
            <XCircle size={62} className="ct-result-hero-icon" />
            <h1 className="ct-result-hero-title failed">
              <XCircle size={24} className="ct-result-hero-title-icon" />
              Quiz Not Passed
            </h1>
          </>
        )}

        <div className="ct-result-score-grid">
          <div className="ct-result-score-card">
            <div className={`ct-result-score-value ${result.passed ? "passed" : "failed"}`}>
              {result.scorePercent.toFixed(0)}%
            </div>
            <div className="ct-result-score-label">Score</div>
          </div>
          <div className="ct-result-score-card">
            <div className="ct-result-score-value neutral">
              {result.correctCount}/{result.totalCount}
            </div>
            <div className="ct-result-score-label">Correct</div>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="ct-banner ct-banner-warning ct-result-banner">
          {submitError}
        </div>
      )}

      {loadError && (
        <div className="ct-banner ct-banner-error ct-result-banner">
          {loadError}
        </div>
      )}

      <div className="ct-card ct-result-section">
        <h2 className="ct-section-title ct-result-section-title">Result Explanation</h2>
        <p className="ct-result-explanation-text">
          {explanation}
        </p>
      </div>

      {!result.passed && (
        <div className="ct-banner ct-banner-info ct-result-banner">
          Remaining quiz attempts: {remainingQuizAttempts} / {maxFailedAttempts}
        </div>
      )}

      <div className="ct-card ct-result-section">
        <h2 className="ct-section-title ct-result-section-title">Question Review</h2>

        {!canRevealReview && (
          <div className="ct-banner ct-banner-info ct-result-banner-inline">
            Question review is locked until you pass the quiz or use all attempts.
          </div>
        )}

        {canRevealReview && reviewLoadError && (
          <div className="ct-banner ct-banner-warning ct-result-banner-inline">
            {reviewLoadError}
          </div>
        )}

        {canRevealReview && reviewRows.length > 0 ? (
          <div className="ct-result-review-grid">
            {reviewRows.map((row, idx) => {
              const statusText = row.isCorrect === true ? "Correct" : row.isCorrect === false ? "Incorrect" : "Submitted";
              const toneClass = row.isCorrect === true
                ? "is-correct"
                : row.isCorrect === false
                  ? "is-incorrect"
                  : "is-submitted";

              return (
                <div
                  key={`${row.questionId}-${idx}`}
                  className={`ct-result-review-item ${toneClass}`}
                >
                  <div className="ct-result-review-top">
                    <div className="ct-result-review-question">
                      Q{idx + 1}. {row.questionText}
                    </div>
                    <span className={`ct-badge ct-result-review-status ${toneClass}`}>{statusText}</span>
                  </div>
                  <div className="ct-result-review-answer">
                    Your answer: <strong>{row.yourAnswer || "-"}</strong>
                  </div>
                  {row.correctAnswer && (
                    <div className="ct-result-review-answer">
                      Correct answer: <strong>{row.correctAnswer}</strong>
                    </div>
                  )}
                  {row.explanation && (
                    <details className="ct-result-review-details">
                      <summary className="ct-result-review-summary">
                        Explanation
                      </summary>
                      <p className="ct-result-review-explanation">
                        {row.explanation}
                      </p>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {canRevealReview && reviewRows.length === 0 ? (
          <div className="ct-banner ct-banner-warning">
            Question-level review is unavailable for this result.
          </div>
        ) : null}
      </div>

      <div className="ct-result-actions">
        {!result.passed && remainingQuizAttempts > 0 && (
          <button className="ct-btn ct-btn-primary" onClick={handleRetryQuiz} id="retry-quiz-btn">
            <RotateCcw size={16} /> Re-Take Quiz
          </button>
        )}

        {!result.passed && remainingQuizAttempts <= 0 && (
          <button className="ct-btn ct-btn-secondary ct-result-watchagain-btn" onClick={handleWatchAgain} id="watch-again-btn">
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
