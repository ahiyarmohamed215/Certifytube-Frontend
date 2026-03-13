/* ===== Quiz Types - aligned to backend contract ===== */

export type QuizQuestionType =
  | "mcq"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | string;

export interface QuizQuestion {
  questionId: string;
  questionType: QuizQuestionType;
  questionText: string;
  options?: string[];
}

export interface QuizGenerateRequest {
  sessionId: string;
  difficulty?: "easy" | "medium" | "hard";
  numQuestions?: number;
  includeCoding?: boolean;
}

export interface QuizResponse {
  quizId: string;
  sessionId: string;
  videoId: string;
  videoTitle: string;
  difficulty: string;
  totalQuestions: number;
  questions: QuizQuestion[];
}

export interface QuizSubmitRequest {
  answers: Record<string, string>;
}

export interface QuizQuestionReview {
  questionId: string;
  questionType: QuizQuestionType;
  questionText: string;
  options?: string[];
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
  explanation: string;
  // legacy/compatibility fields from older payloads
  submittedAnswer?: string;
  userAnswer?: string;
  answer?: string;
  expectedAnswer?: string;
  isCorrect?: boolean;
  reason?: string;
  feedback?: string;
}

export interface QuizResultResponse {
  quizId: string;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  passed: boolean;
  certificateId: string | null;
  verificationLink: string | null;
  review?: QuizQuestionReview[];
  // legacy fallback fields still tolerated from older backend responses
  explanation?: string | null;
  feedback?: string | null;
  questionResults?: QuizQuestionReview[];
  wrongQuestions?: QuizQuestionReview[];
  incorrectQuestions?: QuizQuestionReview[];
  answers?: Record<string, string>;
  userAnswers?: Record<string, string>;
  correctAnswers?: Record<string, string>;
  wrongQuestionIds?: string[];
  incorrectQuestionIds?: string[];
}

// Backward compatible aliases used across existing pages.
export type QuizGenerateResponse = QuizResponse;
export type QuizSubmitResponse = QuizResultResponse;
export type QuizReviewItem = QuizQuestionReview;

export interface QuizEligibilityResponse {
  sessionId: string;
  eligible: boolean;
  reason: string;
  requiredEngagementScore: number;
  latestEngagementScore: number;
  engagementPassed: boolean;
  maxFailedAttempts: number;
  failedAttemptsUsed: number;
  remainingAttempts: number;
  stemEligible: boolean;
}

export type QuizEligibility = QuizEligibilityResponse;
