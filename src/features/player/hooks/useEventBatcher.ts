import { useRef, useCallback, useEffect } from "react";
import type { EventPayload } from "../../../types/api";
import { sendEventBatch } from "../../../api/events";

interface Options {
  enabled: boolean;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

const EVENT_QUEUE_STORAGE_KEY_PREFIX = "ct_watch_event_queue_v2";

function resolveQueueStorageKey() {
  try {
    const raw = localStorage.getItem("ct_user");
    if (!raw) return `${EVENT_QUEUE_STORAGE_KEY_PREFIX}:anon`;
    const parsed = JSON.parse(raw) as { userId?: unknown } | null;
    const userId = parsed?.userId;
    if (typeof userId === "number" && Number.isFinite(userId)) {
      return `${EVENT_QUEUE_STORAGE_KEY_PREFIX}:${userId}`;
    }
    if (typeof userId === "string" && userId.trim()) {
      return `${EVENT_QUEUE_STORAGE_KEY_PREFIX}:${userId.trim()}`;
    }
  } catch {
    // noop
  }
  return `${EVENT_QUEUE_STORAGE_KEY_PREFIX}:anon`;
}

function isEventPayload(value: unknown): value is EventPayload {
  if (!value || typeof value !== "object") return false;
  const evt = value as Partial<EventPayload>;
  return (
    typeof evt.sessionId === "string"
    && evt.sessionId.trim().length > 0
    && typeof evt.eventType === "string"
    && evt.eventType.trim().length > 0
    && typeof evt.clientEventMs === "number"
    && Number.isFinite(evt.clientEventMs)
  );
}

function readPersistedQueue(storageKey: string): EventPayload[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEventPayload);
  } catch {
    return [];
  }
}

function persistQueue(storageKey: string, queue: EventPayload[]) {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(queue));
  } catch {
    // noop
  }
}

export function useEventBatcher({ enabled, flushIntervalMs = 5000, maxBatchSize = 30 }: Options) {
  const queueRef = useRef<EventPayload[]>([]);
  const storageKeyRef = useRef("");
  const hydratedRef = useRef(false);
  const flushingRef = useRef(false);
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const shouldFlushAgainRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  if (!storageKeyRef.current) {
    storageKeyRef.current = resolveQueueStorageKey();
  }

  if (!hydratedRef.current) {
    queueRef.current = readPersistedQueue(storageKeyRef.current);
    hydratedRef.current = true;
  }

  const flush = useCallback(async (): Promise<boolean> => {
    if (queueRef.current.length === 0 && !flushingRef.current) return true;

    if (flushPromiseRef.current) {
      shouldFlushAgainRef.current = true;
      return flushPromiseRef.current;
    }

    const run = (async (): Promise<boolean> => {
      let drainedAll = true;
      flushingRef.current = true;
      try {
        do {
          shouldFlushAgainRef.current = false;

          while (queueRef.current.length > 0) {
            const batch = queueRef.current.slice(0, maxBatchSize);
            try {
              const res = await sendEventBatch(batch);
              if ((res.rejected || 0) > 0 || (res.saved || 0) < batch.length) {
                drainedAll = false;
                return false;
              }
              queueRef.current.splice(0, batch.length);
              persistQueue(storageKeyRef.current, queueRef.current);
            } catch {
              drainedAll = false;
              return false;
            }
          }
        } while (shouldFlushAgainRef.current && queueRef.current.length > 0);

        return true;
      } finally {
        flushingRef.current = false;
        flushPromiseRef.current = null;
        if (drainedAll && queueRef.current.length > 0) {
          void flush();
        }
      }
    })();

    flushPromiseRef.current = run;
    return run;
  }, [maxBatchSize]);

  const enqueue = useCallback(
    (evt: EventPayload) => {
      if (!enabled) return;
      queueRef.current.push(evt);
      persistQueue(storageKeyRef.current, queueRef.current);
      if (queueRef.current.length >= maxBatchSize || flushingRef.current) {
        void flush();
      }
    },
    [enabled, maxBatchSize, flush]
  );

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => void flush(), flushIntervalMs);
  }, [flush, flushIntervalMs]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || queueRef.current.length === 0) return;
    void flush();
  }, [enabled, flush]);

  useEffect(() => {
    const handleOnline = () => {
      if (queueRef.current.length === 0) return;
      void flush();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flush]);

  const getPendingCount = useCallback(() => queueRef.current.length, []);

  return { enqueue, flush, startTimer, stopTimer, getPendingCount };
}
