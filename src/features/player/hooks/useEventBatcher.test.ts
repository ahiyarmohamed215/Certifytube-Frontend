import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendEventBatch } from "../../../api/events";
import { useEventBatcher } from "./useEventBatcher";
import type { EventPayload } from "../../../types/api";

vi.mock("../../../api/events", () => ({
  sendEventBatch: vi.fn(),
}));

const mockedSendEventBatch = vi.mocked(sendEventBatch);
const QUEUE_STORAGE_KEY = "ct_watch_event_queue_v2:42";

function makeEvent(sessionId: string, eventType: string, clientEventMs: number): EventPayload {
  return {
    sessionId,
    eventType,
    playerState: 1,
    playbackRate: 1,
    currentTimeSec: clientEventMs,
    clientEventMs,
  };
}

describe("useEventBatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("ct_user", JSON.stringify({ userId: 42 }));
  });

  it("flushes the active session without being blocked by stale events from another session", async () => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([
      makeEvent("stale-session", "play", 1),
      makeEvent("current-session", "play", 2),
      makeEvent("current-session", "pause", 3),
    ]));

    mockedSendEventBatch.mockImplementation(async (batch) => {
      if (batch.some((evt) => evt.sessionId === "stale-session")) {
        throw new Error("stale event still failing");
      }
      return { saved: batch.length, rejected: 0, errors: [] };
    });

    const { result } = renderHook(() => useEventBatcher({
      enabled: false,
      prioritySessionId: "current-session",
    }));

    await act(async () => {
      const ok = await result.current.flushSession("current-session");
      expect(ok).toBe(true);
    });

    expect(mockedSendEventBatch).toHaveBeenCalledWith([
      expect.objectContaining({ sessionId: "current-session", eventType: "play" }),
      expect.objectContaining({ sessionId: "current-session", eventType: "pause" }),
    ]);
    expect(result.current.getPendingCount("current-session")).toBe(0);
    expect(result.current.getPendingCount()).toBe(1);
    expect(JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || "[]")).toEqual([
      expect.objectContaining({ sessionId: "stale-session", eventType: "play" }),
    ]);
  });

  it("keeps stale events persisted and allows them to flush later", async () => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([
      makeEvent("stale-session", "play", 1),
      makeEvent("current-session", "play", 2),
    ]));

    let staleAccepted = false;
    mockedSendEventBatch.mockImplementation(async (batch) => {
      if (batch.some((evt) => evt.sessionId === "stale-session") && !staleAccepted) {
        throw new Error("temporary failure");
      }
      return { saved: batch.length, rejected: 0, errors: [] };
    });

    const { result } = renderHook(() => useEventBatcher({
      enabled: false,
      prioritySessionId: "current-session",
    }));

    await act(async () => {
      const ok = await result.current.flushSession("current-session");
      expect(ok).toBe(true);
    });

    staleAccepted = true;

    await act(async () => {
      const ok = await result.current.flush();
      expect(ok).toBe(true);
    });

    expect(result.current.getPendingCount()).toBe(0);
    expect(localStorage.getItem(QUEUE_STORAGE_KEY)).toBeNull();
  });
});
