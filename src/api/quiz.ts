import { http } from "./http";
import type {
  QuizGenerateRequest,
  QuizGenerateResponse,
  QuizSubmitRequest,
  QuizSubmitResponse,
  QuizEligibility,
} from "../types/quiz";

export async function getQuizEligibility(sessionId: string): Promise<QuizEligibility> {
  const res = await http.get<QuizEligibility>("/api/quiz/eligibility", {
    params: { sessionId },
  });
  return res.data;
}

export async function generateQuiz(req: QuizGenerateRequest): Promise<QuizGenerateResponse> {
  const res = await http.post<QuizGenerateResponse>("/api/quiz/generate", req);
  return res.data;
}

export async function getQuiz(quizId: string): Promise<QuizGenerateResponse> {
  const res = await http.get<QuizGenerateResponse>(`/api/quiz/${quizId}`);
  return res.data;
}

export async function submitQuiz(quizId: string, req: QuizSubmitRequest): Promise<QuizSubmitResponse> {
  const res = await http.post<QuizSubmitResponse>(`/api/quiz/${quizId}/submit`, req);
  return res.data;
}

export async function getQuizResult(quizId: string): Promise<QuizSubmitResponse> {
  const res = await http.get<QuizSubmitResponse>(`/api/quiz/${quizId}/result`);
  return res.data;
}
