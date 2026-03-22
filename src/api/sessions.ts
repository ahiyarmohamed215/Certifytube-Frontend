import { http } from "./http";
import type {
  StartSessionRequest,
  StartSessionResponse,
  AnalyzeResponse,
} from "../types/api";

export async function startSession(req: StartSessionRequest): Promise<StartSessionResponse> {
  const res = await http.post<StartSessionResponse>("/api/sessions/start", req);
  return res.data;
}

export async function endSession(sessionId: string): Promise<void> {
  await http.post("/api/sessions/end", null, { params: { sessionId } });
}

export async function deleteSessionRecord(sessionId: string): Promise<void> {
  await http.delete(`/api/sessions/${sessionId}`);
}

export async function analyzeSession(
  sessionId: string,
  model?: string
): Promise<AnalyzeResponse> {
  const analyzeTimeoutMs = 120000;
  try {
    const res = await http.post<AnalyzeResponse>(
      `/api/sessions/${sessionId}/analyze`,
      null,
      {
        params: model ? { model } : undefined,
        timeout: analyzeTimeoutMs,
      }
    );
    return res.data;
  } catch (error: any) {
    const message = String(error?.message || "");
    if (/timeout|econnaborted/i.test(message)) {
      throw new Error(
        `Engagement analysis timed out after ${Math.round(
          analyzeTimeoutMs / 1000
        )}s. The model service may be cold-starting, so please try once again.`
      );
    }
    throw error;
  }
}
