import { http } from "./http";
import type { YouTubeSearchResponse, TranscriptResponse } from "../types/api";

export async function youtubeSearch(q: string, limit = 20): Promise<YouTubeSearchResponse> {
  const res = await http.get<YouTubeSearchResponse>("/api/youtube/search", {
    params: { q, limit },
  });
  return res.data;
}

export async function youtubeTranscript(videoId: string): Promise<TranscriptResponse> {
  const res = await http.get<TranscriptResponse>("/api/youtube/transcript", {
    params: { videoId },
  });
  return res.data;
}
