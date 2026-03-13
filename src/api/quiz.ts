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
  const res = await http.post<QuizResponse>("/api/quiz/generate", req);
  return res.data;
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
