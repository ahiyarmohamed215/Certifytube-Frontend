import { useRef, useCallback } from "react";
import type { EventPayload } from "../../../types/api";
import { sendEventBatch } from "../../../api/events";

interface Options {
  enabled: boolean;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

export function useEventBatcher({ enabled, flushIntervalMs = 5000, maxBatchSize = 30 }: Options) {
  const queueRef = useRef<EventPayload[]>([]);
  const flushingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    if (!enabled || flushingRef.current || queueRef.current.length === 0) return;

    flushingRef.current = true;
    const batch = queueRef.current.splice(0, queueRef.current.length);

    try {
      await sendEventBatch(batch);
    } catch {
      // re-queue on failure
      queueRef.current = [...batch, ...queueRef.current];
    } finally {
      flushingRef.current = false;
    }
  }, [enabled]);

  const enqueue = useCallback(
    (evt: EventPayload) => {
      if (!enabled) return;
      queueRef.current.push(evt);
      if (queueRef.current.length >= maxBatchSize) {
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

  return { enqueue, flush, startTimer, stopTimer };
}
