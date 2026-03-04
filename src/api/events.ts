import { http } from "./http";
import type { EventPayload, EventBatchResponse } from "../types/api";

export async function sendEventBatch(events: EventPayload[]): Promise<EventBatchResponse> {
  const res = await http.post<EventBatchResponse>("/api/events/batch", events);
  return res.data;
}
