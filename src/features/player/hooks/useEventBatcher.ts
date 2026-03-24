import { useRef, useCallback, useEffect } from "react";
import type { EventPayload } from "../../../types/api";
import { sendEventBatch } from "../../../api/events";

interface Options {
  enabled: boolean;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  prioritySessionId?: string | null;
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

function getPendingCountForSession(queue: EventPayload[], sessionId?: string | null) {
  if (!sessionId) return queue.length;
  let count = 0;
  for (const evt of queue) {
    if (evt.sessionId === sessionId) count += 1;
  }
  return count;
}

function pickBatch(queue: EventPayload[], maxBatchSize: number, sessionId?: string | null) {
  if (!sessionId) {
    if (queue.length === 0) return null;
    const batch = queue.slice(0, maxBatchSize);
    return {
      batch,
      indexes: batch.map((_, index) => index),
    };
  }

  const batch: EventPayload[] = [];
  const indexes: number[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const evt = queue[index];
    if (evt.sessionId !== sessionId) continue;
    batch.push(evt);
    indexes.push(index);
    if (batch.length >= maxBatchSize) break;
  }

  if (batch.length === 0) return null;
  return { batch, indexes };
}

function removeBatch(queue: EventPayload[], indexes: number[]) {
  for (let i = indexes.length - 1; i >= 0; i -= 1) {
    queue.splice(indexes[i], 1);
  }
}

export function useEventBatcher({ enabled, flushIntervalMs = 5000, maxBatchSize = 30, prioritySessionId = null }: Options) {
  const queueRef = useRef<EventPayload[]>([]);
  const storageKeyRef = useRef("");
  const hydratedRef = useRef(false);
  const flushingRef = useRef(false);
  const flushPromiseRef = useRef<Promise<boolean> | null>(null);
  const shouldFlushAgainRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const activeFlushScopeRef = useRef<string | null>(null);

  if (!storageKeyRef.current) {
    storageKeyRef.current = resolveQueueStorageKey();
  }

  if (!hydratedRef.current) {
    queueRef.current = readPersistedQueue(storageKeyRef.current);
    hydratedRef.current = true;
  }

  const getPendingCount = useCallback((sessionId?: string | null) => {
    return getPendingCountForSession(queueRef.current, sessionId);
  }, []);

  const flushInternal = useCallback(async (sessionId?: string | null): Promise<boolean> => {
    const scope = sessionId || null;
    if (getPendingCount(scope) === 0 && !flushingRef.current) return true;

    if (flushPromiseRef.current) {
      shouldFlushAgainRef.current = true;
      if (activeFlushScopeRef.current === scope) {
        return flushPromiseRef.current;
      }
      return flushPromiseRef.current.then(() => flushInternal(scope));
    }

    const run = (async (): Promise<boolean> => {
      flushingRef.current = true;
      activeFlushScopeRef.current = scope;
      try {
        do {
          shouldFlushAgainRef.current = false;

          while (getPendingCount(scope) > 0) {
            const next = pickBatch(queueRef.current, maxBatchSize, scope);
            if (!next) break;
            try {
              const res = await sendEventBatch(next.batch);
              if ((res.rejected || 0) > 0 || (res.saved || 0) < next.batch.length) {
                return false;
              }
              removeBatch(queueRef.current, next.indexes);
              persistQueue(storageKeyRef.current, queueRef.current);
            } catch {
              return false;
            }
          }
        } while (shouldFlushAgainRef.current && getPendingCount(scope) > 0);

        return getPendingCount(scope) === 0;
      } finally {
        flushingRef.current = false;
        flushPromiseRef.current = null;
        activeFlushScopeRef.current = null;
      }
    })();

    flushPromiseRef.current = run;
    return run;
  }, [getPendingCount, maxBatchSize]);

  const flush = useCallback(async (): Promise<boolean> => {
    return flushInternal();
  }, [flushInternal]);

  const flushSession = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!sessionId.trim()) return true;
    return flushInternal(sessionId);
  }, [flushInternal]);

  const flushPriority = useCallback(async (): Promise<boolean> => {
    if (prioritySessionId && getPendingCount(prioritySessionId) > 0) {
      return flushSession(prioritySessionId);
    }
    return flush();
  }, [flush, flushSession, getPendingCount, prioritySessionId]);

  const enqueue = useCallback(
    (evt: EventPayload) => {
      if (!enabled) return;
      queueRef.current.push(evt);
      persistQueue(storageKeyRef.current, queueRef.current);
      if (queueRef.current.length >= maxBatchSize || flushingRef.current) {
        void flushPriority();
      }
    },
    [enabled, maxBatchSize, flushPriority]
  );

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => void flushPriority(), flushIntervalMs);
  }, [flushIntervalMs, flushPriority]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || queueRef.current.length === 0) return;
    void flushPriority();
  }, [enabled, flushPriority]);

  useEffect(() => {
    const handleOnline = () => {
      if (queueRef.current.length === 0) return;
      void flushPriority();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flushPriority]);

  return { enqueue, flush, flushSession, startTimer, stopTimer, getPendingCount };
}
