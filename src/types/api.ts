/* ===== API Types - aligned to backend contract ===== */

// ---- Auth ----
export interface SignupResponse {
  userId: number;
  email: string;
  role: string;
  emailVerified: boolean;
  message?: string;
}

export interface LoginResponse {
  userId: number;
  email: string;
  name?: string;
  role: string;
  emailVerified: boolean;
  token: string;
  tokenType: string;
}

export interface UserInfo {
  userId: number;
  email: string;
  name?: string;
  role: string;
}

export interface AuthMessageResponse {
  message: string;
}

// ---- YouTube ----
export interface YouTubeVideo {
  videoId: string;
  title: string;
  iframeUrl: string;
  videoDurationSec?: number | null;
}

export interface YouTubeSearchResponse {
  query: string;
  count: number;
  videos: YouTubeVideo[];
}

// ---- Dashboard ----
export interface DashboardVideo {
  sessionId: string;
  videoId: string;
  videoTitle: string;
  thumbnailUrl: string;
  lastPositionSec: number;
  videoDurationSec: number;
  progressPercent: number;
  status: SessionStatus;
  stemEligible: boolean;
  engagementScore: number | null;
  certificateId: string | null;
  createdAt: string;
}

export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'QUIZ_PENDING' | 'CERTIFIED';

export interface DashboardResponse {
  activeVideos: DashboardVideo[];
  completedVideos: DashboardVideo[];
  quizPendingVideos: DashboardVideo[];
  certifiedVideos: DashboardVideo[];
}

// ---- Session ----
export interface StartSessionRequest {
  videoId: string;
  videoTitle: string;
}

export interface StartSessionResponse {
  sessionId: string;
  resumed: boolean;
  lastPositionSec: number | null;
  videoDurationSec: number | null;
  stemEligible: boolean;
  stemMessage: string | null;
}

export interface EndSessionResponse {
  ended: boolean;
}

// ---- Events ----
export interface EventPayload {
  sessionId: string;
  eventType: 'play' | 'pause' | 'seek' | 'buffering' | 'ratechange' | 'ended' | string;
  playerState: number; // 1=playing, 2=paused, 3=buffering, 0=ended
  playbackRate: number;
  currentTimeSec: number;
  videoDurationSec?: number;
  clientCreatedAtLocal?: string;
  clientTzOffsetMin?: number;
  clientEventMs: number; // performance.now()
  seekFromSec?: number | null;
  seekToSec?: number | null;
}

export interface EventBatchResponse {
  saved: number;
  rejected: number;
  errors: Array<{ index: number; message: string }>;
}

// ---- Analyze ----
export interface AnalyzeResponse {
  sessionId: string;
  model: string;
  engagementScore: number;
  threshold: number;
  status: 'ENGAGED' | 'NOT_ENGAGED';
  explanation: string;
}

// ---- Certificate ----
export interface CertificateInfo {
  certificateId: string;
  certificateNumber: string;
  sessionId: string;
  userId: number | null;
  scorePercent: number;
  verificationToken: string;
  verificationLink: string;
  createdAtUtc: string;
  status: 'ACTIVE' | 'REVOKED';
  valid: boolean;
  learnerName?: string;
  videoId?: string;
  videoTitle?: string;
  videoUrl?: string;
  videoDuration?: string;
  engagementScore?: number;
  quizScore?: number;
  engagementThreshold?: number;
  quizThreshold?: number;
  platformName?: string;
  platformAttribution?: string;
  sealUrl?: string;
}

// ---- Admin ----
export interface AdminUser {
  userId: number;
  name?: string | null;
  email: string;
  role: string;
  active?: boolean;
  emailVerified?: boolean;
  emailVerifiedAtUtc?: string | null;
  createdAtUtc?: string;
  sessionCount?: number;
  certificateCount?: number;
}

export interface AdminEngagementContributor {
  feature: string;
  shap_value?: number;
  contribution?: number;
  feature_value?: number | string | boolean | null;
  behavior_category?: string;
  [key: string]: unknown;
}

export interface AdminEngagementResult {
  sessionId: string;
  model: string;
  engagementScore: number;
  threshold: number;
  status: "ENGAGED" | "NOT_ENGAGED" | string;
  explanation: string;
  topPositive: AdminEngagementContributor[] | string | null;
  topNegative: AdminEngagementContributor[] | string | null;
  createdAtUtc: string;
}

export interface AdminLearnerSessionInsight {
  sessionId: string;
  userId: string;
  videoId: string;
  videoTitle: string;
  status: string;
  createdAtUtc: string;
  endedAtUtc?: string | null;
  lastPositionSec?: number | null;
  videoDurationSec?: number | null;
  features?: Record<string, unknown> | null;
  engagement?: AdminEngagementResult | null;
}

export interface AdminLearnerQuizAttemptInsight {
  attemptId: number;
  correctCount?: number | null;
  totalCount?: number | null;
  scorePercent?: number | null;
  passedFlag?: boolean | null;
  answers?: unknown;
  createdAtUtc?: string | null;
}

export interface AdminLearnerQuizQuestionInsight {
  id: number;
  questionUid?: string | null;
  positionIndex?: number | null;
  questionType?: string | null;
  questionText?: string | null;
  options?: unknown;
  correctAnswer?: string | null;
  explanationText?: string | null;
}

export interface AdminLearnerQuizInsight {
  quizId: string;
  sessionId: string;
  videoId: string;
  videoTitle: string;
  difficulty?: string | null;
  totalQuestions?: number | null;
  createdAtUtc?: string | null;
  latestAttempt?: AdminLearnerQuizAttemptInsight | null;
  questions: AdminLearnerQuizQuestionInsight[];
}

export interface AdminLearnerCertificateInsight {
  certificateId: string;
  certificateNumber: string;
  sessionId: string;
  quizAttemptId?: number | null;
  scorePercent?: number | null;
  finalEngagementScore?: number | null;
  finalQuizScore?: number | null;
  learnerName?: string | null;
  videoTitle?: string | null;
  videoId?: string | null;
  status?: string | null;
  createdAtUtc?: string | null;
}

export interface AdminLearnerProfileResponse {
  learner: AdminUser;
  sessions: AdminLearnerSessionInsight[];
  quizzes: AdminLearnerQuizInsight[];
  certificates: AdminLearnerCertificateInsight[];
}

