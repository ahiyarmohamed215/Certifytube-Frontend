import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, RotateCcw, Send } from "lucide-react";
import toast from "react-hot-toast";

import { generateQuiz, getQuiz, getQuizEligibility, getQuizResult, submitQuiz } from "../../api/quiz";
import type { QuizEligibility, QuizGenerateResponse, QuizQuestion } from "../../types/quiz";

type QuizLocationState = {
  sessionId?: string;
  videoId?: string;
  videoTitle?: string;
};

type NormalizedQuestionType = "mcq" | "true_false" | "fill_blank" | "short_answer";

function normalizeQuestionType(q: QuizQuestion): NormalizedQuestionType {
  const normalized = String(q.questionType || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "mcq" || normalized === "multiple_choice" || normalized === "single_choice") {
    return "mcq";
  }

  if (normalized === "true_false" || normalized === "truefalse" || normalized === "boolean" || normalized === "tf") {
    return "true_false";
  }

  if (
    normalized === "fill"
    || normalized === "fill_blank"
    || normalized === "fill_in_the_blank"
    || normalized === "blank"
  ) {
    return "fill_blank";
  }

  if (
    normalized === "short"
    || normalized === "short_answer"
    || normalized === "shortanswer"
    || normalized === "open_ended"
    || normalized === "openended"
    || normalized === "text"
    || normalized === "subjective"
  ) {
    return "short_answer";
  }

  if (Array.isArray(q.options) && q.options.length > 0) return "mcq";
  if ((q.questionText || "").includes("____")) return "fill_blank";
  return "short_answer";
}

function questionKey(q: QuizQuestion, idx: number): string {
  const key = (q.questionId || "").trim();
  return key.length > 0 ? key : `q${idx + 1}`;
}

export function QuizPage() {
  const { quizId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const locationState = (location.state as QuizLocationState | null) || null;
  const sessionIdFromState = locationState?.sessionId;

  const [quiz, setQuiz] = useState<QuizGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [needsGenerate, setNeedsGenerate] = useState(false);
  const [sessionIdForGenerate, setSessionIdForGenerate] = useState<string | null>(sessionIdFromState ?? null);
  const [eligibility, setEligibility] = useState<QuizEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  useEffect(() => {
    if (!quizId) {
      setNeedsGenerate(false);
      setQuiz(null);
      return;
    }

    let cancelled = false;
    setSessionIdForGenerate(sessionIdFromState ?? quizId);

    if (sessionIdFromState && quizId === sessionIdFromState) {
      setNeedsGenerate(true);
      setQuiz(null);
      return;
    }

    (async () => {
      try {
        const q = await getQuiz(quizId);
        if (cancelled) return;
        setQuiz(q);
        setSessionIdForGenerate(q.sessionId);
        setNeedsGenerate(false);
      } catch {
        if (cancelled) return;
        setNeedsGenerate(true);
        setQuiz(null);
        setSessionIdForGenerate(sessionIdFromState ?? quizId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, sessionIdFromState]);

  useEffect(() => {
    if (!needsGenerate || quiz || !sessionIdForGenerate) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setEligibilityLoading(true);

    (async () => {
      try {
        const res = await getQuizEligibility(sessionIdForGenerate);
        if (cancelled) return;
        setEligibility(res);
      } catch (e: any) {
        if (cancelled) return;
        setEligibility(null);
        toast.error(e?.message || "Failed to check quiz eligibility");
      } finally {
        if (!cancelled) setEligibilityLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsGenerate, quiz, sessionIdForGenerate]);

  const handleGenerate = async () => {
    const sid = sessionIdForGenerate;
    if (!sid) {
      toast.error("Missing quiz context");
      return;
    }

    try {
      const check = await getQuizEligibility(sid);
      setEligibility(check);
      if (!check.eligible) {
        toast.error(check.reason || "Not eligible to generate quiz");
        return;
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to check quiz eligibility");
      return;
    }

    setGenerating(true);
    try {
      const q = await generateQuiz({ sessionId: sid, difficulty });
      setQuiz(q);
      setAnswers({});
      setActiveQuestionIndex(0);
      setNeedsGenerate(false);
      setSessionIdForGenerate(q.sessionId);
      toast.success("Quiz generated");
      nav(`/quiz/${q.quizId}`, { replace: true, state: { sessionId: q.sessionId } });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  };

  const answeredCount = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.reduce((count, q, idx) => {
      const key = questionKey(q, idx);
      return count + ((answers[key] ?? "").trim().length > 0 ? 1 : 0);
    }, 0);
  }, [quiz, answers]);

  const canSubmit = useMemo(() => {
    if (!quiz) return false;
    return answeredCount === quiz.totalQuestions;
  }, [quiz, answeredCount]);

  useEffect(() => {
    setActiveQuestionIndex(0);
  }, [quiz?.quizId]);

  const totalQuestions = quiz?.questions.length || 0;
  const clampedQuestionIndex = totalQuestions > 0
    ? Math.min(activeQuestionIndex, totalQuestions - 1)
    : 0;
  const currentQuestion = quiz?.questions[clampedQuestionIndex] || null;
  const currentQuestionKey = currentQuestion ? questionKey(currentQuestion, clampedQuestionIndex) : "";
  const currentQuestionType = currentQuestion ? normalizeQuestionType(currentQuestion) : null;
  const currentAnswered = currentQuestionKey
    ? (answers[currentQuestionKey] ?? "").trim().length > 0
    : false;
  const hasPrevQuestion = clampedQuestionIndex > 0;
  const hasNextQuestion = clampedQuestionIndex < totalQuestions - 1;

  const goPrevQuestion = () => {
    setActiveQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const goNextQuestion = () => {
    if (!currentAnswered) {
      toast.error("Answer this question first");
      return;
    }
    setActiveQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
  };

  const handleSubmit = async () => {
    if (!quiz || !canSubmit) return;
    setSubmitting(true);

    try {
      const res = await submitQuiz(quiz.quizId, { answers });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.passed) {
        toast.success(`Passed! Score: ${res.scorePercent.toFixed(0)}%`);
      } else {
        toast.error(`Failed: ${res.scorePercent.toFixed(0)}%`);
      }
      nav(`/result/${quiz.quizId}`, {
        state: {
          result: res,
          quizQuestions: quiz.questions,
          submittedAnswers: answers,
        },
      });
    } catch (e: any) {
      const msg = e?.message || "Submit failed";
      const isCertificateGenerationError = /certificate|pdf/i.test(msg);

      if (isCertificateGenerationError) {
        try {
          const fallbackResult = await getQuizResult(quiz.quizId);
          await qc.invalidateQueries({ queryKey: ["dashboard"] });
          toast.error("Quiz submitted, but certificate PDF generation failed on server. You can retry certificate download.");
          nav(`/result/${quiz.quizId}`, {
            state: {
              result: fallbackResult,
              quizQuestions: quiz.questions,
              submittedAnswers: answers,
              submitError: msg,
            },
          });
          return;
        } catch {
          // fall through to default error handling
        }
      }

      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (qId: string, value: string) => {
    setAnswers((a) => ({ ...a, [qId]: value }));
  };

  const goWatchAgain = () => {
    if (locationState?.videoId) {
      nav(`/watch/${locationState.videoId}`, { state: { videoTitle: locationState.videoTitle } });
      return;
    }
    nav(-1);
  };

  if (!quizId) return <div className="ct-empty">Missing quiz context</div>;

  return (
    <div className="ct-slide-up" style={{ maxWidth: 800, margin: "0 auto" }}>
      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={14} /> Go Back
      </button>

      <h1 className="ct-page-title">
        <ClipboardCheck size={28} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--ct-accent-light)" }} />
        Quiz
      </h1>

      {quiz && (
        <p className="ct-page-subtitle">
          {quiz.videoTitle} | {quiz.totalQuestions} questions | {quiz.difficulty}
        </p>
      )}

      {needsGenerate && !quiz && (
        <div className="ct-glass-card" style={{ textAlign: "center" }}>
          <ClipboardCheck size={48} style={{ color: "var(--ct-accent-light)", marginBottom: 16 }} />
          <p style={{ marginBottom: 20, color: "var(--ct-text-secondary)" }}>
            Generate a quiz to test your knowledge of the video content
          </p>

          {eligibilityLoading && (
            <p style={{ marginBottom: 16, fontSize: 13, color: "var(--ct-text-muted)" }}>
              Checking eligibility...
            </p>
          )}

          {!eligibilityLoading && eligibility && !eligibility.eligible && (
            <div className="ct-banner ct-banner-warning" style={{ marginBottom: 16, textAlign: "left" }}>
              <span>{eligibility.reason}</span>
            </div>
          )}

          {!eligibilityLoading && eligibility && !eligibility.eligible && (
            <button className="ct-btn ct-btn-secondary" onClick={goWatchAgain} style={{ marginBottom: 16 }}>
              Watch Again
            </button>
          )}

          {!eligibilityLoading && eligibility?.eligible && (
            <p style={{ marginBottom: 16, fontSize: 13, color: "var(--ct-text-muted)" }}>
              Attempts remaining: {eligibility.remainingAttempts}
            </p>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
            <label className="ct-form-label" style={{ margin: 0 }}>Difficulty:</label>
            <select className="ct-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <button
            className="ct-btn ct-btn-primary ct-btn-lg"
            onClick={handleGenerate}
            disabled={generating || eligibilityLoading || (eligibility ? !eligibility.eligible : true)}
            id="generate-quiz-btn"
          >
            {generating ? "Generating..." : "Generate Quiz"}
          </button>
        </div>
      )}

      {quiz && (
        <div className="ct-fade-in">
          <div className="ct-card" style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Question {clampedQuestionIndex + 1} of {totalQuestions}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ct-text-muted)" }}>
                Answered {answeredCount}/{totalQuestions}
              </div>
            </div>
            <div className="ct-progress">
              <div
                className="ct-progress-bar"
                style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
              />
            </div>
          </div>

          {currentQuestion && (
            <div key={currentQuestionKey} className="ct-quiz-question">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                <span style={{ color: "var(--ct-accent-light)" }}>Q{clampedQuestionIndex + 1}.</span> {currentQuestion.questionText}
              </div>

              {Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? (
                <div style={(currentQuestion.options || []).length <= 2 ? { display: "flex", gap: 12 } : {}}>
                  {(currentQuestion.options || []).map((opt) => (
                    <label
                      key={opt}
                      className={`ct-quiz-option ${answers[currentQuestionKey] === opt ? "selected" : ""}`}
                      style={(currentQuestion.options || []).length <= 2 ? { flex: 1, justifyContent: "center" } : {}}
                    >
                      <input
                        type="radio"
                        name={currentQuestionKey}
                        value={opt}
                        checked={answers[currentQuestionKey] === opt}
                        onChange={() => setAnswer(currentQuestionKey, opt)}
                      />
                      <span style={{ textTransform: currentQuestionType === "true_false" ? "capitalize" : "none" }}>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : currentQuestionType === "true_false" ? (
                <div style={{ display: "flex", gap: 12 }}>
                  {["true", "false"].map((opt) => (
                    <label
                      key={opt}
                      className={`ct-quiz-option ${answers[currentQuestionKey] === opt ? "selected" : ""}`}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <input
                        type="radio"
                        name={currentQuestionKey}
                        value={opt}
                        checked={answers[currentQuestionKey] === opt}
                        onChange={() => setAnswer(currentQuestionKey, opt)}
                      />
                      <span style={{ textTransform: "capitalize" }}>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : currentQuestionType === "fill_blank" ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--ct-text-muted)", marginBottom: 8 }}>
                    Fill in the missing word or phrase.
                  </div>
                  <input
                    className="ct-input ct-quiz-answer-input"
                    type="text"
                    placeholder="Type the missing answer..."
                    value={answers[currentQuestionKey] || ""}
                    onChange={(e) => setAnswer(currentQuestionKey, e.target.value)}
                  />
                </div>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--ct-text-muted)", marginBottom: 8 }}>
                    Write a short answer based on the video.
                  </div>
                  <textarea
                    className="ct-input ct-quiz-answer-input"
                    placeholder="Write your short answer..."
                    value={answers[currentQuestionKey] || ""}
                    onChange={(e) => setAnswer(currentQuestionKey, e.target.value)}
                    rows={4}
                    style={{ resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              className="ct-btn ct-btn-secondary"
              onClick={goPrevQuestion}
              disabled={!hasPrevQuestion || submitting}
            >
              Previous
            </button>

            <button
              className="ct-btn ct-btn-ghost"
              onClick={() => {
                setAnswers({});
                setActiveQuestionIndex(0);
              }}
              disabled={submitting}
            >
              <RotateCcw size={14} /> Reset
            </button>

            {hasNextQuestion ? (
              <button
                className="ct-btn ct-btn-primary"
                onClick={goNextQuestion}
                disabled={submitting || !currentAnswered}
              >
                Next
              </button>
            ) : (
              <button
                className="ct-btn ct-btn-primary"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                id="submit-quiz-btn"
              >
                <Send size={18} />
                {submitting ? "Submitting..." : "Submit Quiz"}
              </button>
            )}
          </div>

          {!currentAnswered && hasNextQuestion && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--ct-text-muted)" }}>
              Select or type an answer to continue to the next question.
            </p>
          )}

          {!hasNextQuestion && !canSubmit && (
            <p style={{ marginTop: 8, fontSize: 12, color: "var(--ct-text-muted)" }}>
              Answer all questions before submitting.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
