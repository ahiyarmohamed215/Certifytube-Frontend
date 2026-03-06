import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ClipboardCheck, ArrowLeft, Send, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { generateQuiz, submitQuiz, getQuiz, getQuizEligibility } from "../../api/quiz";
import type { QuizGenerateResponse, QuizQuestion, QuizEligibility } from "../../types/quiz";

export function QuizPage() {
  const { quizId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const sessionIdFromState = (location.state as { sessionId?: string } | null)?.sessionId;

  const [quiz, setQuiz] = useState<QuizGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [needsGenerate, setNeedsGenerate] = useState(false);
  const [sessionIdForGenerate, setSessionIdForGenerate] = useState<string | null>(
    sessionIdFromState ?? null
  );
  const [eligibility, setEligibility] = useState<QuizEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // If we have a real quizId, load the quiz
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

    // Try to fetch existing quiz
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

  // Load eligibility before quiz generation flow
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
      toast.error("Missing session ID");
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
      setNeedsGenerate(false);
      setSessionIdForGenerate(q.sessionId);
      toast.success("Quiz generated!");
      // Update URL to reflect real quizId
      nav(`/quiz/${q.quizId}`, { replace: true, state: { sessionId: q.sessionId } });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  };

  const canSubmit = useMemo(() => {
    if (!quiz) return false;
    return quiz.questions.every((q) => (answers[q.questionId] ?? "").trim().length > 0);
  }, [quiz, answers]);

  const handleSubmit = async () => {
    if (!quiz || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await submitQuiz(quiz.quizId, { answers });
      if (res.passed) {
        toast.success(`Passed! Score: ${res.scorePercent.toFixed(0)}%`);
      } else {
        toast.error(`Failed: ${res.scorePercent.toFixed(0)}%`);
      }
      nav(`/result/${quiz.quizId}`, { state: { result: res } });
    } catch (e: any) {
      toast.error(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (qId: string, value: string) => {
    setAnswers((a) => ({ ...a, [qId]: value }));
  };

  if (!quizId) return <div className="ct-empty">Missing quiz/session ID</div>;

  return (
    <div className="ct-slide-up" style={{ maxWidth: 800, margin: "0 auto" }}>
      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav("/my-learnings")} style={{ marginBottom: 16 }}>
        <ArrowLeft size={14} /> My Learnings
      </button>

      <h1 className="ct-page-title">
        <ClipboardCheck size={28} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--ct-accent-light)" }} />
        Quiz
      </h1>

      {quiz && (
        <p className="ct-page-subtitle">
          {quiz.videoTitle} · {quiz.totalQuestions} questions · {quiz.difficulty}
        </p>
      )}

      {/* Generate section */}
      {needsGenerate && !quiz && (
        <div className="ct-glass-card" style={{ textAlign: "center" }}>
          <ClipboardCheck size={48} style={{ color: "var(--ct-accent-light)", marginBottom: 16 }} />
          <p style={{ marginBottom: 20, color: "var(--ct-text-secondary)" }}>
            Generate a quiz to test your knowledge of the video content
          </p>
          {eligibilityLoading && (
            <p style={{ marginBottom: 16, fontSize: 13, color: "var(--ct-text-muted)" }}>
              Checking eligibility…
            </p>
          )}
          {!eligibilityLoading && eligibility && !eligibility.eligible && (
            <div className="ct-banner ct-banner-warning" style={{ marginBottom: 16, textAlign: "left" }}>
              <span>{eligibility.reason}</span>
            </div>
          )}
          {!eligibilityLoading && eligibility?.eligible && (
            <p style={{ marginBottom: 16, fontSize: 13, color: "var(--ct-text-muted)" }}>
              Attempts remaining: {eligibility.remainingAttempts}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
            <label className="ct-form-label" style={{ margin: 0 }}>Difficulty:</label>
            <select className="ct-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)}>
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
            {generating ? "Generating…" : "Generate Quiz"}
          </button>
        </div>
      )}

      {/* Quiz questions */}
      {quiz && (
        <div className="ct-fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "var(--ct-text-muted)" }}>
              Answered: {Object.keys(answers).length} / {quiz.totalQuestions}
            </span>
            <button
              className="ct-btn ct-btn-ghost ct-btn-sm"
              onClick={() => setAnswers({})}
              disabled={submitting}
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>

          <div className="ct-progress" style={{ marginBottom: 24 }}>
            <div
              className="ct-progress-bar"
              style={{ width: `${(Object.keys(answers).length / quiz.totalQuestions) * 100}%` }}
            />
          </div>

          {quiz.questions.map((q: QuizQuestion, idx: number) => (
            <div key={q.questionId} className="ct-quiz-question">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
                <span style={{ color: "var(--ct-accent-light)" }}>Q{idx + 1}.</span> {q.questionText}
              </div>

              {q.questionType === "mcq" && q.options && (
                <div>
                  {q.options.map((opt) => (
                    <label
                      key={opt}
                      className={`ct-quiz-option ${answers[q.questionId] === opt ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name={q.questionId}
                        value={opt}
                        checked={answers[q.questionId] === opt}
                        onChange={() => setAnswer(q.questionId, opt)}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.questionType === "true_false" && (
                <div style={{ display: "flex", gap: 12 }}>
                  {["true", "false"].map((opt) => (
                    <label
                      key={opt}
                      className={`ct-quiz-option ${answers[q.questionId] === opt ? "selected" : ""}`}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <input
                        type="radio"
                        name={q.questionId}
                        value={opt}
                        checked={answers[q.questionId] === opt}
                        onChange={() => setAnswer(q.questionId, opt)}
                      />
                      <span style={{ textTransform: "capitalize" }}>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.questionType === "fill" && (
                <input
                  className="ct-input"
                  type="text"
                  placeholder="Type your answer…"
                  value={answers[q.questionId] || ""}
                  onChange={(e) => setAnswer(q.questionId, e.target.value)}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <button
              className="ct-btn ct-btn-primary ct-btn-lg"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              id="submit-quiz-btn"
            >
              <Send size={18} />
              {submitting ? "Submitting…" : "Submit Quiz"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
