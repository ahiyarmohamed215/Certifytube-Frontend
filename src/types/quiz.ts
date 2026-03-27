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
