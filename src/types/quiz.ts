/* ===== Quiz Types — aligned to backend contract ===== */

export interface QuizQuestion {
  questionId: string;
  questionType:
    | 'mcq'
    | 'true_false'
    | 'fill'
    | 'fill_blank'
    | 'fill_in_the_blank'
    | 'short'
    | 'short_answer'
    | string;
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
}

export interface QuizGenerateRequest {
  sessionId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  numQuestions?: number;
  includeCoding?: boolean;
}

export interface QuizGenerateResponse {
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

export interface QuizSubmitResponse {
  quizId: string;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  passed: boolean;
  certificateId: string | null;
  verificationLink: string | null;
  explanation?: string | null;
  feedback?: string | null;
  review?: QuizReviewItem[];
  questionResults?: QuizReviewItem[];
  wrongQuestions?: QuizReviewItem[];
  incorrectQuestions?: QuizReviewItem[];
  answers?: Record<string, string>;
  userAnswers?: Record<string, string>;
  correctAnswers?: Record<string, string>;
  wrongQuestionIds?: string[];
  incorrectQuestionIds?: string[];
}

export interface QuizReviewItem {
  questionId?: string;
  questionText?: string;
  selectedAnswer?: string;
  submittedAnswer?: string;
  userAnswer?: string;
  answer?: string;
  correctAnswer?: string;
  expectedAnswer?: string;
  isCorrect?: boolean;
  correct?: boolean;
  explanation?: string;
  reason?: string;
  feedback?: string;
}

export interface QuizEligibility {
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
