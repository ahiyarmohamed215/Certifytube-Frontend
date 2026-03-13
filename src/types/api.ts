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

export interface TranscriptResponse {
  videoId: string;
  transcript: string;
  transcriptLength: number;
  fromCache: boolean;
  cachedAtUtc: string;
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
export interface AdminStats {
  totalUsers: number;
  totalSessions: number;
  totalCertificates: number;
  totalQuizzes: number;
}

export interface AdminUser {
  userId: number;
  email: string;
  role: string;
}

export interface AdminSession {
  sessionId: string;
  userId: number;
  videoId: string;
  videoTitle: string;
  status: string;
  createdAt: string;
}

export interface AdminCertificate {
  certificateId: string;
  certificateNumber: string;
  userId: number;
  sessionId: string;
  scorePercent: number;
  createdAtUtc: string;
  status?: 'ACTIVE' | 'REVOKED';
  valid?: boolean;
  learnerName?: string;
  videoTitle?: string;
}

export interface AdminQuiz {
  quizId: string;
  sessionId: string;
  userId: number;
  videoId: string;
  difficulty: string;
  totalQuestions: number;
}

