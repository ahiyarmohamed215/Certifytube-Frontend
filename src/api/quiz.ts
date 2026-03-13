import { http } from "./http";
import type {
  QuizGenerateRequest,
  QuizResponse,
  QuizSubmitRequest,
  QuizResultResponse,
  QuizEligibilityResponse,
} from "../types/quiz";

export async function getQuizEligibility(sessionId: string): Promise<QuizEligibilityResponse> {
  const res = await http.get<QuizEligibilityResponse>("/api/quiz/eligibility", {
    params: { sessionId },
  });
  return res.data;
}

export async function generateQuiz(req: QuizGenerateRequest): Promise<QuizResponse> {
  try {
    const res = await http.post<QuizResponse>("/api/quiz/generate", req, {
      // First quiz generation can be slow on cold backend AI paths.
      timeout: 120000,
    });
    return res.data;
  } catch (error: any) {
    const message = String(error?.message || "");
    if (/timeout|econnaborted/i.test(message)) {
      throw new Error("Quiz generation timed out. Please try once again.");
    }
    throw error;
  }
}

export async function getQuiz(quizId: string): Promise<QuizResponse> {
  const res = await http.get<QuizResponse>(`/api/quiz/${quizId}`);
  return res.data;
}

export async function submitQuiz(quizId: string, req: QuizSubmitRequest): Promise<QuizResultResponse> {
  const res = await http.post<QuizResultResponse>(`/api/quiz/${quizId}/submit`, req);
  return res.data;
}

export async function getQuizResult(quizId: string): Promise<QuizResultResponse> {
  const res = await http.get<QuizResultResponse>(`/api/quiz/${quizId}/result`);
  return res.data;
}
