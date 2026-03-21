import type { PublicPlatformStatsResponse } from "../types/api";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export async function getPublicPlatformStats(): Promise<PublicPlatformStatsResponse> {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API is not available");
  }

  const response = await fetch(`${BASE_URL}/api/public/stats`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load platform stats (${response.status})`);
  }

  const payload = await response.json() as Partial<PublicPlatformStatsResponse>;

  return {
    learnerCount: Number(payload.learnerCount ?? 0),
    certificateCount: Number(payload.certificateCount ?? 0),
  };
}
