import type { ApiClientError } from "./http";

type ApiErrorPayload = {
  message?: unknown;
  error?: unknown;
  code?: unknown;
};

export function getApiStatus(error: unknown): number {
  const err = error as ApiClientError;
  return Number(err?.status || 0);
}

export function getApiMessage(error: unknown, fallback: string): string {
  const err = error as ApiClientError;
  const payload = (err?.data || {}) as ApiErrorPayload;

  const payloadMessage = typeof payload?.message === "string"
    ? payload.message
    : typeof payload?.error === "string"
      ? payload.error
      : "";

  if (payloadMessage.trim()) return payloadMessage.trim();
  if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  return fallback;
}

export function getApiCode(error: unknown): string {
  const err = error as ApiClientError;
  const payload = (err?.data || {}) as ApiErrorPayload;
  return typeof payload?.code === "string" ? payload.code.trim() : "";
}
