/* ===== Quiz Types — aligned to backend contract ===== */

export interface QuizQuestion {
  questionId: string;
  questionType: 'mcq' | 'true_false' | 'fill';
  questionText: string;
  options?: string[];
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
