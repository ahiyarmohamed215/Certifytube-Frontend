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
  try {
    await http.delete(`/api/sessions/${sessionId}`);
    return;
  } catch {
    try {
      await http.delete(`/api/admin/sessions/${sessionId}`);
      return;
    } catch {
      throw new Error("Delete API not available for learner. Add DELETE /api/sessions/{sessionId} in backend.");
    }
  }
}

export async function analyzeSession(
  sessionId: string,
  model?: string
): Promise<AnalyzeResponse> {
  const res = await http.post<AnalyzeResponse>(
    `/api/sessions/${sessionId}/analyze`,
    null,
    { params: model ? { model } : undefined }
  );
  return res.data;
}
