import { http } from "./http";
import type { YouTubeSearchResponse } from "../types/api";

export async function youtubeSearch(q: string, limit = 20): Promise<YouTubeSearchResponse> {
  const res = await http.get<YouTubeSearchResponse>("/api/youtube/search", {
    params: { q, limit },
  });
  return res.data;
}
