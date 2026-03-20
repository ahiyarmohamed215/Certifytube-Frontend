import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBeforeUnload, useBlocker, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ClipboardCheck, RotateCcw, Send, X } from "lucide-react";
import toast from "react-hot-toast";

import { generateQuiz, getQuiz, getQuizEligibility, getQuizResult, submitQuiz } from "../../api/quiz";
import type { QuizEligibility, QuizGenerateResponse, QuizQuestion } from "../../types/quiz";

type QuizLocationState = {
  sessionId?: string;
  videoId?: string;
  videoTitle?: string;
  fromStatus?: "active" | "completed" | "quiz";
  fromPath?: string;
};

type NormalizedQuestionType = "mcq" | "true_false" | "fill_blank" | "short_answer";
const QUIZ_NAVIGATION_ATTEMPT_LIMIT = 3;
const QUIZ_ATTEMPT_TRACKER_STORAGE_KEY = "ct_quiz_attempt_tracker_v1";
const QUIZ_SUBMITTED_ANSWERS_STORAGE_KEY = "ct_quiz_submitted_answers_v1";
const QUIZ_DEFAULT_MAX_ATTEMPTS = 2;
const QUIZ_PENDING_PATH = "/my-learnings?status=quiz";

type QuizAttemptStore = Record<string, {
  consumed: number;
  quizIds: Record<string, true>;
}>;
type NormalizedAttemptEntry = {
  entry: {
    consumed: number;
    quizIds: Record<string, true>;
  };
  migrated: boolean;
};
type LockPopupTone = "warning" | "error";
type LockPopupState = {
  title: string;
  message: string;
  buttonText: string;
  tone: LockPopupTone;
  allowClose?: boolean;
  closeText?: string;
};
type GenerateConfirmState = {
  sessionId: string;
  remainingAttempts: number;
  maxAttempts: number;
};

function normalizeQuizAttemptEntry(raw: unknown): NormalizedAttemptEntry {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return {
      entry: { consumed: Math.max(0, Math.floor(raw)), quizIds: {} },
      migrated: false,
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      entry: { consumed: 0, quizIds: {} },
      migrated: false,
    };
  }

  const obj = raw as { consumed?: unknown; quizIds?: unknown };
  const storedConsumed = Number.isFinite(obj.consumed as number)
    ? Math.max(0, Math.floor(obj.consumed as number))
    : 0;
  const quizIds: Record<string, true> = {};
  let migrated = false;
  if (obj.quizIds && typeof obj.quizIds === "object" && !Array.isArray(obj.quizIds)) {
    for (const [quizId, flag] of Object.entries(obj.quizIds as Record<string, unknown>)) {
      if (!quizId || !flag) continue;
      if (quizId.startsWith("close:") || quizId.startsWith("misuse:")) {
        migrated = true;
        continue;
      }
      quizIds[quizId] = true;
    }
  }

  const dedupedConsumed = Object.keys(quizIds).length;
  const consumed = dedupedConsumed > 0 ? dedupedConsumed : storedConsumed;
  if (dedupedConsumed > 0 && storedConsumed !== dedupedConsumed) {
    migrated = true;
  }

  return {
    entry: { consumed, quizIds },
    migrated,
  };
}

function readQuizAttemptStore(): QuizAttemptStore {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(QUIZ_ATTEMPT_TRACKER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const normalized: QuizAttemptStore = {};
    let migrated = false;
    for (const [sessionId, entry] of Object.entries(parsed)) {
      if (!sessionId) continue;
      const normalizedEntry = normalizeQuizAttemptEntry(entry);
      normalized[sessionId] = normalizedEntry.entry;
      if (normalizedEntry.migrated) migrated = true;
    }
    if (migrated) {
      writeQuizAttemptStore(normalized);
    }
    return normalized;
  } catch {
    return {};
  }
}

function writeQuizAttemptStore(store: QuizAttemptStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUIZ_ATTEMPT_TRACKER_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // noop
  }
}

function getConsumedQuizAttempts(sessionId: string | null | undefined): number {
  if (!sessionId) return 0;
  const store = readQuizAttemptStore();
  const entry = store[sessionId];
  return entry?.consumed || 0;
}

function markQuizAttemptConsumed(sessionId: string, quizAttemptId: string): number {
  const store = readQuizAttemptStore();
  const entry = store[sessionId] || { consumed: 0, quizIds: {} };
  if (entry.quizIds[quizAttemptId]) {
    return entry.consumed;
  }

  entry.quizIds[quizAttemptId] = true;
  entry.consumed += 1;
  store[sessionId] = entry;
  writeQuizAttemptStore(store);
  return entry.consumed;
}

function markQuizAttemptGenerated(sessionId: string, quizAttemptId: string): number {
  const store = readQuizAttemptStore();
  const entry = store[sessionId] || { consumed: 0, quizIds: {} };

  if (entry.quizIds[quizAttemptId]) {
    // Backend may return the same quizId for a regenerated/reopened quiz.
    // Count the user's explicit generate action as a fresh consumed attempt.
    let retryIndex = 1;
    let retryMarker = `retry:${quizAttemptId}:${retryIndex}`;
    while (entry.quizIds[retryMarker]) {
      retryIndex += 1;
      retryMarker = `retry:${quizAttemptId}:${retryIndex}`;
    }
    entry.quizIds[retryMarker] = true;
  } else {
    entry.quizIds[quizAttemptId] = true;
  }

  entry.consumed += 1;
  store[sessionId] = entry;
  writeQuizAttemptStore(store);
  return entry.consumed;
}

function cacheSubmittedAnswers(quizId: string, answers: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(QUIZ_SUBMITTED_ANSWERS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {};
    parsed[quizId] = answers;
    window.sessionStorage.setItem(QUIZ_SUBMITTED_ANSWERS_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // noop
  }
}

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

function isMaxAttemptsSubmitError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("attempt")
    && (
      normalized.includes("max")
      || normalized.includes("no")
      || normalized.includes("used")
      || normalized.includes("exhaust")
      || normalized.includes("failed")
      || normalized.includes("remaining")
    )
  );
}

export function QuizPage() {
  const { quizId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const locationState = (location.state as QuizLocationState | null) || null;
  const sessionIdFromState = locationState?.sessionId;
  const fromStatus = locationState?.fromStatus === "active" || locationState?.fromStatus === "completed" || locationState?.fromStatus === "quiz"
    ? locationState.fromStatus
    : "quiz";
  const fromPath = (locationState?.fromPath || `/my-learnings?status=${fromStatus}`).trim();
  const initialSessionId = sessionIdFromState ?? quizId ?? null;

  const [quiz, setQuiz] = useState<QuizGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [needsGenerate, setNeedsGenerate] = useState(false);
  const [sessionIdForGenerate, setSessionIdForGenerate] = useState<string | null>(initialSessionId);
  const [eligibility, setEligibility] = useState<QuizEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [quizLockEnabled, setQuizLockEnabled] = useState(true);
  const [consumedAttemptsUsed, setConsumedAttemptsUsed] = useState(0);
  const [submitBlockedMessage, setSubmitBlockedMessage] = useState<string | null>(null);
  const [lockPopup, setLockPopup] = useState<LockPopupState | null>(null);
  const [generateConfirm, setGenerateConfirm] = useState<GenerateConfirmState | null>(null);
  const violationCountRef = useRef(0);
  const quizLockEnabledRef = useRef(true);
  const forceClosingRef = useRef(false);
  const lastViolationAtRef = useRef(0);
  const lockPopupActionRef = useRef<(() => void) | null>(null);
  const currentSessionId = quiz?.sessionId || sessionIdForGenerate || sessionIdFromState || null;

  const showLockPopup = useCallback((popup: LockPopupState, onOk?: () => void) => {
    lockPopupActionRef.current = onOk || null;
    setLockPopup(popup);
  }, []);

  const closeLockPopup = useCallback(() => {
    lockPopupActionRef.current = null;
    setLockPopup(null);
  }, []);

  const acknowledgeLockPopup = useCallback(() => {
    const action = lockPopupActionRef.current;
    lockPopupActionRef.current = null;
    setLockPopup(null);
    action?.();
  }, []);

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
        const consumed = markQuizAttemptConsumed(q.sessionId, q.quizId);
        setConsumedAttemptsUsed(consumed);
        setSubmitBlockedMessage(null);
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

  useEffect(() => {
    if (!currentSessionId) {
      setConsumedAttemptsUsed(0);
      return;
    }
    setConsumedAttemptsUsed(getConsumedQuizAttempts(currentSessionId));
  }, [currentSessionId]);

  const generateQuizAfterConfirmation = useCallback(async (sid: string) => {
    setGenerating(true);
    try {
      const q = await generateQuiz({
        sessionId: sid,
        difficulty: "medium",
        numQuestions: 10,
        includeCoding: false,
      });
      const consumed = markQuizAttemptGenerated(q.sessionId, q.quizId);
      setConsumedAttemptsUsed(consumed);
      setQuiz(q);
      setSubmitBlockedMessage(null);
      setAnswers({});
      setActiveQuestionIndex(0);
      setNeedsGenerate(false);
      setSessionIdForGenerate(q.sessionId);
      toast.success("Quiz generated. One quiz attempt is now used.");
      nav(`/quiz/${q.quizId}`, {
        replace: true,
        state: {
          sessionId: q.sessionId,
          videoId: q.videoId,
          videoTitle: q.videoTitle,
          fromStatus,
          fromPath,
        },
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate quiz");
    } finally {
      setGenerating(false);
    }
  }, [fromPath, fromStatus, nav]);

  const closeGenerateConfirm = useCallback(() => {
    if (generating) return;
    setGenerateConfirm(null);
  }, [generating]);

  const confirmGenerateQuiz = useCallback(async () => {
    if (!generateConfirm || generating) return;
    const sid = generateConfirm.sessionId;
    setGenerateConfirm(null);
    await generateQuizAfterConfirmation(sid);
  }, [generateConfirm, generateQuizAfterConfirmation, generating]);

  const handleGenerate = async () => {
    if (generating) return;
    const sid = sessionIdForGenerate;
    if (!sid) {
      toast.error("Missing quiz context");
      return;
    }

    try {
      const check = await getQuizEligibility(sid);
      setEligibility(check);
      const consumed = getConsumedQuizAttempts(sid);
      setConsumedAttemptsUsed(consumed);
      const maxAllowed = check.maxFailedAttempts || QUIZ_DEFAULT_MAX_ATTEMPTS;
      const backendRemaining = typeof check.remainingAttempts === "number"
        ? Math.max(0, check.remainingAttempts)
        : Math.max(0, maxAllowed - (check.failedAttemptsUsed || 0));
      const effectiveRemaining = Math.max(0, Math.min(backendRemaining, maxAllowed - consumed));

      if (!check.eligible) {
        toast.error(check.reason || "Not eligible to generate quiz");
        return;
      }
      if (effectiveRemaining <= 0) {
        showLockPopup(
          {
            tone: "error",
            title: "No quiz attempts left",
            message: "All quiz attempts are already used. Watch the video again to unlock a new quiz attempt.",
            buttonText: "Watch Again",
          },
          () => {
            const fallbackVideoId = locationState?.videoId || quiz?.videoId || null;
            if (fallbackVideoId) {
              nav(`/watch/${fallbackVideoId}`, {
                state: {
                  videoTitle: locationState?.videoTitle || quiz?.videoTitle,
                  fromStatus,
                  fromPath: QUIZ_PENDING_PATH,
                },
              });
              return;
            }
            nav(QUIZ_PENDING_PATH, { state: { initialStatus: "quiz" } });
          },
        );
        return;
      }

      setGenerateConfirm({
        sessionId: sid,
        remainingAttempts: effectiveRemaining,
        maxAttempts: maxAllowed,
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to check quiz eligibility");
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
  const watchAgainVideoId = locationState?.videoId || quiz?.videoId || null;

  useEffect(() => {
    if (!quiz?.quizId) return;
    quizLockEnabledRef.current = true;
    setQuizLockEnabled(true);
    violationCountRef.current = 0;
    forceClosingRef.current = false;
    showLockPopup({
      tone: "warning",
      title: "Quiz is locked while active",
      message: `Do not open another page or browser tab while doing this quiz. Attempts left before this quiz is canceled: ${QUIZ_NAVIGATION_ATTEMPT_LIMIT}.`,
      buttonText: "OK",
    });
  }, [quiz?.quizId, showLockPopup]);

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
  const isQuizLockActive = Boolean(quiz && quizLockEnabled);

  const updateQuizLockEnabled = useCallback((value: boolean) => {
    quizLockEnabledRef.current = value;
    setQuizLockEnabled(value);
  }, []);

  const resetToQuizPendingView = useCallback(() => {
    updateQuizLockEnabled(false);
    setQuiz(null);
    setAnswers({});
    setActiveQuestionIndex(0);
    setNeedsGenerate(true);
    setEligibility(null);
    violationCountRef.current = 0;
    lastViolationAtRef.current = 0;
  }, [updateQuizLockEnabled]);

  const forceCloseQuizDueToViolation = useCallback(async () => {
    if (forceClosingRef.current) return;
    forceClosingRef.current = true;

    const sid = quiz?.sessionId || sessionIdForGenerate || sessionIdFromState || null;
    const fallbackVideoId = locationState?.videoId || quiz?.videoId || null;
    const fallbackVideoTitle = locationState?.videoTitle || quiz?.videoTitle;
    resetToQuizPendingView();

    if (!sid) {
      showLockPopup(
        {
          tone: "error",
          title: "Quiz closed",
          message: "Quiz was closed due to repeated navigation attempts. This quiz attempt remains used.",
          buttonText: "Go to Quiz Pending",
        },
        () => nav(QUIZ_PENDING_PATH, { replace: true, state: { initialStatus: "quiz" } }),
      );
      return;
    }

    const consumed = getConsumedQuizAttempts(sid);
    setConsumedAttemptsUsed(consumed);

    let effectiveRemainingAfterClose = Math.max(0, QUIZ_DEFAULT_MAX_ATTEMPTS - consumed);
    try {
      const latestEligibility = await getQuizEligibility(sid);
      setEligibility(latestEligibility);
      const maxAllowed = latestEligibility.maxFailedAttempts || QUIZ_DEFAULT_MAX_ATTEMPTS;
      const backendRemaining = typeof latestEligibility.remainingAttempts === "number"
        ? Math.max(0, latestEligibility.remainingAttempts)
        : Math.max(0, maxAllowed - (latestEligibility.failedAttemptsUsed || 0));
      effectiveRemainingAfterClose = Math.max(0, Math.min(backendRemaining, maxAllowed - consumed));
    } catch {
      // fallback keeps default remaining calculation
    }

    if (effectiveRemainingAfterClose <= 0) {
      showLockPopup(
        {
          tone: "error",
          title: "All quiz attempts used",
          message: "Quiz closed after navigation misuse. No attempts left. Watch the video again to unlock a new quiz.",
          buttonText: "Watch Again",
        },
        () => {
          if (fallbackVideoId) {
            nav(`/watch/${fallbackVideoId}`, {
              replace: true,
              state: {
                videoTitle: fallbackVideoTitle,
                fromStatus,
                fromPath: QUIZ_PENDING_PATH,
              },
            });
            return;
          }
          nav(QUIZ_PENDING_PATH, { replace: true, state: { initialStatus: "quiz" } });
        },
      );
      return;
    }

    showLockPopup(
      {
        tone: "warning",
        title: "Quiz closed",
        message: `Quiz closed after navigation misuse. This attempt remains used. Remaining attempts: ${effectiveRemainingAfterClose}.`,
        buttonText: "Go to Quiz Pending",
      },
      () => nav(QUIZ_PENDING_PATH, { replace: true, state: { initialStatus: "quiz" } }),
    );
  }, [
    fromStatus,
    locationState?.videoId,
    locationState?.videoTitle,
    nav,
    quiz?.videoId,
    quiz?.videoTitle,
    quiz?.sessionId,
    resetToQuizPendingView,
    showLockPopup,
    sessionIdForGenerate,
    sessionIdFromState,
  ]);

  const registerViolation = useCallback(() => {
    if (!isQuizLockActive) return;
    const now = Date.now();
    if (now - lastViolationAtRef.current < 300) return;
    lastViolationAtRef.current = now;

    const next = violationCountRef.current + 1;
    violationCountRef.current = next;

    const remaining = Math.max(0, QUIZ_NAVIGATION_ATTEMPT_LIMIT - next);
    if (next >= QUIZ_NAVIGATION_ATTEMPT_LIMIT) {
      void forceCloseQuizDueToViolation();
      return;
    }

    showLockPopup({
      tone: "warning",
      title: "Quiz is locked while active",
      message: `Navigation attempt detected. Stay in this quiz tab. Attempts left before quiz cancel: ${remaining}.`,
      buttonText: "Stay in Quiz",
    });
  }, [forceCloseQuizDueToViolation, isQuizLockActive, showLockPopup]);

  const blocker = useBlocker(() => Boolean(quiz) && quizLockEnabledRef.current);

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    blocker.reset();
    registerViolation();
  }, [blocker, registerViolation]);

  useEffect(() => {
    if (!isQuizLockActive) return undefined;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        registerViolation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isQuizLockActive, registerViolation]);

  useEffect(() => {
    if (!isQuizLockActive) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isReload = key === "f5" || ((event.ctrlKey || event.metaKey) && key === "r");
      const isCloseTab = (event.ctrlKey || event.metaKey) && key === "w";
      const isHistoryNav = event.altKey && (key === "arrowleft" || key === "arrowright");
      if (!isReload && !isCloseTab && !isHistoryNav) return;

      event.preventDefault();
      registerViolation();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuizLockActive, registerViolation]);

  useBeforeUnload(
    useCallback((event) => {
      if (!isQuizLockActive) return;
      registerViolation();
      event.preventDefault();
      event.returnValue = "";
    }, [isQuizLockActive, registerViolation]),
  );

  useEffect(() => {
    if (!lockPopup && !generateConfirm) return undefined;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [lockPopup, generateConfirm]);

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
    if (!quiz || !canSubmit || submitBlockedMessage) return;
    setSubmitting(true);

    try {
      const res = await submitQuiz(quiz.quizId, { answers });
      cacheSubmittedAnswers(quiz.quizId, answers);
      setSubmitBlockedMessage(null);
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.passed) {
        toast.success(`Passed! Score: ${res.scorePercent.toFixed(0)}%`);
      } else {
        toast.error(`Failed: ${res.scorePercent.toFixed(0)}%`);
      }
      updateQuizLockEnabled(false);
      nav(`/result/${quiz.quizId}`, {
        state: {
          result: res,
          quizQuestions: quiz.questions,
          submittedAnswers: answers,
          sessionId: quiz.sessionId,
          videoId: quiz.videoId,
          videoTitle: quiz.videoTitle,
          fromStatus,
          fromPath,
        },
      });
    } catch (e: any) {
      const msg = e?.message || "Submit failed";
      const isCertificateGenerationError = /certificate|pdf/i.test(msg);

      if (isCertificateGenerationError) {
        try {
          const fallbackResult = await getQuizResult(quiz.quizId);
          cacheSubmittedAnswers(quiz.quizId, answers);
          await qc.invalidateQueries({ queryKey: ["dashboard"] });
          toast.error("Quiz submitted, but certificate PDF generation failed on server. You can retry certificate download.");
          updateQuizLockEnabled(false);
          nav(`/result/${quiz.quizId}`, {
            state: {
              result: fallbackResult,
              quizQuestions: quiz.questions,
              submittedAnswers: answers,
              submitError: msg,
              sessionId: quiz.sessionId,
              videoId: quiz.videoId,
              videoTitle: quiz.videoTitle,
              fromStatus,
              fromPath,
            },
          });
          return;
        } catch {
          // fall through to default error handling
        }
      }

      toast.error(msg);
      if (isMaxAttemptsSubmitError(msg)) {
        setSubmitBlockedMessage("No attempts left for this session. Watch the video again and pass engagement to unlock a new quiz.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const setAnswer = (qId: string, value: string) => {
    setAnswers((a) => ({ ...a, [qId]: value }));
  };

  const goWatchAgain = () => {
    if (watchAgainVideoId) {
      nav(`/watch/${watchAgainVideoId}`, {
        state: {
          videoTitle: locationState?.videoTitle || quiz?.videoTitle,
          fromStatus,
          fromPath,
        },
      });
      return;
    }
    nav(fromPath, { state: { initialStatus: fromStatus } });
  };
  const closeActiveQuizFromUi = () => {
    if (!quiz || !isQuizLockActive) return false;
    showLockPopup(
      {
        tone: "warning",
        title: "Close Quiz?",
        message: "Closing now will end this quiz screen. This generated attempt is already used.",
        buttonText: "Close Quiz",
        allowClose: true,
        closeText: "Keep Quiz",
      },
      () => {
        resetToQuizPendingView();
        nav(QUIZ_PENDING_PATH, { replace: true, state: { initialStatus: "quiz" } });
      },
    );
    return true;
  };

  const goMyLearnings = () => {
    if (closeActiveQuizFromUi()) return;
    nav(fromPath, { state: { initialStatus: fromStatus } });
  };

  const goBack = () => {
    if (closeActiveQuizFromUi()) return;
    if (locationState?.fromPath || locationState?.fromStatus) {
      goMyLearnings();
      return;
    }
    nav(-1);
  };
  const attemptsExhausted = !eligibilityLoading && Boolean(eligibility?.eligible) && remainingQuizAttempts <= 0;
  const generateDisabled = generating
    || eligibilityLoading
    || Boolean(eligibility && (!eligibility.eligible || attemptsExhausted));

  if (!quizId) return <div className="ct-empty">Missing quiz context</div>;

  return (
    <div className="ct-slide-up" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="ct-analyze-topbar">
        <button className="ct-btn ct-btn-secondary ct-btn-sm ct-analyze-back-btn" onClick={goBack}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="ct-btn ct-btn-sm ct-analyze-close-btn" onClick={goMyLearnings}>
          <X size={14} /> Close
        </button>
      </div>

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
              Attempts remaining: {remainingQuizAttempts} / {maxFailedAttempts}
            </p>
          )}

          {attemptsExhausted && (
            <div className="ct-banner ct-banner-error" style={{ marginBottom: 12, textAlign: "left" }}>
              All quiz attempts are used. Watch the video again to unlock a new quiz.
            </div>
          )}

          {attemptsExhausted && (
            <button className="ct-btn ct-btn-secondary" onClick={goWatchAgain} style={{ marginBottom: 16 }}>
              Watch Again
            </button>
          )}

          <button
            className="ct-btn ct-btn-primary ct-btn-lg"
            onClick={handleGenerate}
            disabled={generateDisabled}
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
                disabled={!canSubmit || submitting || Boolean(submitBlockedMessage)}
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

          {submitBlockedMessage && (
            <div className="ct-banner ct-banner-error" style={{ marginTop: 10 }}>
              {submitBlockedMessage}
            </div>
          )}

          {submitBlockedMessage && (
            <div style={{ marginTop: 10 }}>
              <button className="ct-btn ct-btn-secondary" onClick={goWatchAgain}>
                <RotateCcw size={14} /> Watch Again
              </button>
            </div>
          )}
        </div>
      )}

      {generateConfirm && createPortal(
        <div className="ct-modal-backdrop" onClick={closeGenerateConfirm}>
          <div
            className="ct-modal-card ct-quiz-lock-modal ct-quiz-generate-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Generate quiz confirmation"
          >
            <div className="ct-quiz-lock-icon">
              <ClipboardCheck size={20} />
            </div>
            <p className="ct-quiz-generate-kicker">Quiz Attempt Confirmation</p>
            <h3 className="ct-quiz-lock-title">Generate quiz now?</h3>
            <p className="ct-quiz-lock-text">
              Generating this quiz uses 1 attempt immediately. Continue only when the learner is ready to start the quiz now.
            </p>
            <div className="ct-quiz-generate-stats">
              <div className="ct-quiz-generate-stat">
                <span className="ct-quiz-generate-stat-label">Attempts Left Now</span>
                <strong className="ct-quiz-generate-stat-value">{generateConfirm.remainingAttempts}</strong>
              </div>
              <div className="ct-quiz-generate-stat">
                <span className="ct-quiz-generate-stat-label">After Generate</span>
                <strong className="ct-quiz-generate-stat-value">{Math.max(0, generateConfirm.remainingAttempts - 1)}</strong>
              </div>
              <div className="ct-quiz-generate-stat">
                <span className="ct-quiz-generate-stat-label">Max Attempts</span>
                <strong className="ct-quiz-generate-stat-value">{generateConfirm.maxAttempts}</strong>
              </div>
            </div>
            <div className="ct-modal-actions">
              <button className="ct-btn ct-btn-secondary" onClick={closeGenerateConfirm} disabled={generating}>
                Cancel
              </button>
              <button className="ct-btn ct-btn-primary" onClick={() => void confirmGenerateQuiz()} disabled={generating}>
                {generating ? "Generating..." : "Generate Quiz"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {lockPopup && createPortal(
        <div className="ct-modal-backdrop">
          <div
            className={`ct-modal-card ct-quiz-lock-modal ${lockPopup.tone === "error" ? "danger" : ""}`}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={lockPopup.title}
          >
            {lockPopup.allowClose && (
              <button
                type="button"
                className="ct-attempts-modal-close"
                onClick={closeLockPopup}
                aria-label="Close popup"
                style={{ position: "absolute", top: 12, right: 12 }}
              >
                <X size={16} />
              </button>
            )}
            <div className={`ct-quiz-lock-icon ${lockPopup.tone === "error" ? "danger" : ""}`}>
              <AlertTriangle size={20} />
            </div>
            <h3 className="ct-quiz-lock-title">{lockPopup.title}</h3>
            <p className="ct-quiz-lock-text">{lockPopup.message}</p>
            <div className="ct-modal-actions">
              <button
                className={lockPopup.tone === "error" ? "ct-btn ct-btn-danger" : "ct-btn ct-btn-primary"}
                onClick={acknowledgeLockPopup}
              >
                {lockPopup.buttonText}
              </button>
              {lockPopup.allowClose && (
                <button className="ct-btn ct-btn-secondary" onClick={closeLockPopup}>
                  {lockPopup.closeText || "Close"}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
