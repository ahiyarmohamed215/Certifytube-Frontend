import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import YouTube from "react-youtube";
import type { YouTubeEvent } from "react-youtube";
import { AlertTriangle, StopCircle, BarChart3, X, Clock, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";

import { startSession, endSession } from "../../api/sessions";
import { getDashboard } from "../../api/dashboard";
import { useEventBatcher } from "./hooks/useEventBatcher";
import { getErrorMessage, readPlayerSnapshot, type WatchPlayer } from "./watchPlayer";
import type { DashboardResponse, DashboardVideo, EventPayload, SessionStatus, StartSessionResponse } from "../../types/api";
import {
  PLAYER_EVENT_STATE,
  getCheckpointEventType,
  getPlayerStateForEvent,
  getStateChangeEventType,
  normalizeObservedPlayerState,
  shouldEmitSeekEvent,
  toLocalIsoWithoutTz,
} from "./playerEvents";

type LearningStatusTab = "active" | "completed" | "quiz";

type LocationState = {
  videoTitle?: string;
  fromStatus?: LearningStatusTab;
  fromPath?: string;
  sessionId?: string;
  stemEligible?: boolean;
  stemMessage?: string | null;
  lastPositionSec?: number | null;
};

type PersistedWatchContext = {
  videoId: string;
  videoTitle?: string;
  fromStatus: LearningStatusTab;
  fromPath: string;
  sessionId?: string;
  lastPositionSec?: number;
  showBanner?: boolean;
};

type CheckpointSnapshot = {
  sessionId: string;
  eventType: string;
  playerState: number;
  currentTimeSec: number;
  atMs: number;
};

const WATCH_RESUME_KEY = "ct_watch_resume_context";
const WATCH_CONTEXT_EVENT = "ct-watch-context-change";
const NEAR_END_RECOVERY_WINDOW_SEC = 1.25;
const NEAR_END_RECOVERY_COOLDOWN_MS = 1200;

function normalizeLearningStatus(value: unknown): LearningStatusTab | null {
  if (value === "active" || value === "completed" || value === "quiz") return value;
  return null;
}

function readPersistedWatchContext(): PersistedWatchContext | null {
  let raw = "";
  try {
    raw = sessionStorage.getItem(WATCH_RESUME_KEY) || "";
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedWatchContext;
    if (!parsed?.videoId) return null;
    return parsed;
  } catch {
    return null;
  }
}

const inflightStartSessionByKey = new Map<string, Promise<StartSessionResponse>>();

function startSessionDeduped(
  key: string,
  req: { videoId: string; videoTitle: string },
): Promise<StartSessionResponse> {
  const existing = inflightStartSessionByKey.get(key);
  if (existing) return existing;

  const promise = startSession(req).finally(() => {
    inflightStartSessionByKey.delete(key);
  });
  inflightStartSessionByKey.set(key, promise);
  return promise;
}

const STATUS_PRIORITY: Record<SessionStatus, number> = {
  ACTIVE: 1,
  COMPLETED: 2,
  QUIZ_PENDING: 3,
  CERTIFIED: 4,
};

function pickLatestByVideo(data?: DashboardResponse) {
  const all = [
    ...(data?.activeVideos || []),
    ...(data?.completedVideos || []),
    ...(data?.quizPendingVideos || []),
    ...(data?.certifiedVideos || []),
  ];

  const map = new Map<string, DashboardVideo>();
  for (const video of all) {
    const existing = map.get(video.videoId);
    if (!existing) {
      map.set(video.videoId, video);
      continue;
    }
    const nextTs = Date.parse(video.createdAt) || 0;
    const existingTs = Date.parse(existing.createdAt) || 0;
    if (nextTs > existingTs) {
      map.set(video.videoId, video);
      continue;
    }
    if (nextTs === existingTs && STATUS_PRIORITY[video.status] > STATUS_PRIORITY[existing.status]) {
      map.set(video.videoId, video);
    }
  }
  return [...map.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}

function pickLatestActiveSessionByVideo(data: DashboardResponse | undefined, targetVideoId: string): DashboardVideo | null {
  const activeMatches = (data?.activeVideos || [])
    .filter((video) => video.videoId === targetVideoId)
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return activeMatches[0] || null;
}

function formatDuration(sec: number) {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusBadge(status: SessionStatus) {
  const map: Record<SessionStatus, { cls: string; label: string }> = {
    ACTIVE: { cls: "ct-badge-active", label: "Active" },
    COMPLETED: { cls: "ct-badge-completed", label: "Completed" },
    QUIZ_PENDING: { cls: "ct-badge-quiz", label: "Quiz Pending" },
    CERTIFIED: { cls: "ct-badge-certified", label: "Certified" },
  };
  const b = map[status] || { cls: "", label: status };
  return <span className={`ct-badge ${b.cls}`}>{b.label}</span>;
}

export function WatchPage() {
  const { videoId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locState = (location.state || {}) as LocationState;
  const routeEntryKey = location.key || "watch-entry";
  const queryTitle = (searchParams.get("title") || "").trim();
  const fromStatus = normalizeLearningStatus(locState.fromStatus) || "active";
  const fromPath = (locState.fromPath || `/my-learnings?status=${fromStatus}`).trim();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState(locState.videoTitle || queryTitle || "");
  const [stemEligible, setStemEligible] = useState<boolean | null>(null);
  const [stemMessage, setStemMessage] = useState<string | null>(null);
  const [lastPos, setLastPos] = useState<number | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [closingPlayer, setClosingPlayer] = useState(false);
  const [showWatchIntro, setShowWatchIntro] = useState(true);
  const [playerReadyTick, setPlayerReadyTick] = useState(0);
  const [watchFinishedHint, setWatchFinishedHint] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<WatchPlayer | null>(null);
  const playerStateRef = useRef<number>(PLAYER_EVENT_STATE.unstarted);
  const sessionIdRef = useRef<string | null>(null);
  const sessionEndedRef = useRef(false);
  const endingSessionRef = useRef(false);
  const mountedRef = useRef(true);
  const lastObservedTimeRef = useRef<number | null>(null);
  const lastObservedAtMsRef = useRef<number | null>(null);
  const lastSeekSentAtRef = useRef(0);
  const suppressSeekUntilMsRef = useRef(0);
  const resumeSeekKeyRef = useRef<string | null>(null);
  const lastCheckpointRef = useRef<CheckpointSnapshot | null>(null);
  const lastNearEndRecoveryAtRef = useRef(0);
  const shouldShowPersistedBannerRef = useRef(true);
  const canLog = Boolean(sessionId && !sessionEnded);
  const canLogRef = useRef(false);
  const shouldPersistWatchContextRef = useRef(true);
  const makeEventRef = useRef<(type: string, extras?: Partial<EventPayload>, observedPlayerState?: number | null) => EventPayload>(() => {
    throw new Error("watch event builder is not ready");
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard", "watch-suggestions"],
    queryFn: () => getDashboard(),
  });

  const suggestedVideos = useMemo(
    () => pickLatestByVideo(dashboardData)
      .filter((v) => v.videoId !== videoId && v.status === "ACTIVE")
      .slice(0, 12),
    [dashboardData, videoId],
  );

  const { enqueue, flush, flushSession, startTimer, stopTimer, getPendingCount } = useEventBatcher({
    enabled: canLog,
    flushIntervalMs: 5000,
    prioritySessionId: sessionId,
  });

  const flushCurrentSession = useCallback(() => {
    const activeSessionId = sessionIdRef.current;
    if (activeSessionId) {
      return flushSession(activeSessionId);
    }
    return flush();
  }, [flush, flushSession]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    sessionEndedRef.current = sessionEnded;
  }, [sessionEnded]);

  useEffect(() => {
    canLogRef.current = canLog;
  }, [canLog]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    setPlayerReadyTick(0);
    setWatchFinishedHint(false);
    lastObservedTimeRef.current = null;
    lastObservedAtMsRef.current = null;
    lastSeekSentAtRef.current = 0;
    suppressSeekUntilMsRef.current = 0;
    resumeSeekKeyRef.current = null;
    playerStateRef.current = PLAYER_EVENT_STATE.unstarted;
    lastCheckpointRef.current = null;
    lastNearEndRecoveryAtRef.current = 0;
  }, [sessionId]);

  const readObservedPlayerState = useCallback((observedPlayerState?: number | null) => {
    if (typeof observedPlayerState === "number" && Number.isFinite(observedPlayerState)) {
      return observedPlayerState;
    }

    const liveState = readPlayerSnapshot(playerRef.current).playerState;
    if (liveState != null) {
      return liveState;
    }

    return playerStateRef.current;
  }, []);

  const makeEvent = useCallback((type: string, extras?: Partial<EventPayload>, observedPlayerState?: number | null): EventPayload => {
    const player = playerRef.current;
    const eventDate = new Date();
    const clientEventMs = performance.now();
    const resolvedObservedState = normalizeObservedPlayerState(readObservedPlayerState(observedPlayerState));
    const fallbackCurrentTime = lastObservedTimeRef.current ?? currentTime;
    const snapshot = readPlayerSnapshot(player);
    const playbackRate = snapshot.playbackRate != null && snapshot.playbackRate > 0 ? snapshot.playbackRate : 1;
    const resolvedCurrentTime = snapshot.currentTimeSec ?? fallbackCurrentTime;
    const resolvedDuration = snapshot.durationSec ?? duration;
    const restExtras = { ...(extras || {}) };
    delete restExtras.sessionId;
    delete restExtras.eventType;
    delete restExtras.playerState;
    delete restExtras.clientCreatedAtLocal;
    delete restExtras.clientTzOffsetMin;
    delete restExtras.clientEventMs;

    return {
      sessionId: sessionId!,
      eventType: type,
      playerState: getPlayerStateForEvent(type, resolvedObservedState),
      playbackRate,
      currentTimeSec: resolvedCurrentTime,
      videoDurationSec: resolvedDuration > 0 ? resolvedDuration : undefined,
      clientCreatedAtLocal: toLocalIsoWithoutTz(eventDate),
      clientTzOffsetMin: eventDate.getTimezoneOffset(),
      clientEventMs,
      ...restExtras,
    };
  }, [currentTime, duration, readObservedPlayerState, sessionId]);

  useEffect(() => {
    makeEventRef.current = makeEvent;
  }, [makeEvent]);

  const hasResumePosition = lastPos != null && lastPos > 0;

  const attemptResumePlayback = useCallback(
    (player?: WatchPlayer | null) => {
      if (!player || !hasResumePosition) return;

      const resumeKey = `${videoId || ""}:${routeEntryKey}:${sessionIdRef.current || "none"}`;
      if (resumeSeekKeyRef.current === resumeKey) return;

      resumeSeekKeyRef.current = resumeKey;
      const resumeAt = lastPos!;
      const applyResumePosition = () => {
        try {
          player.seekTo?.(resumeAt, true);
          player.playVideo?.();
        } catch {
          // noop
        }
      };

      applyResumePosition();
      window.setTimeout(applyResumePosition, 250);
      window.setTimeout(applyResumePosition, 900);
      window.setTimeout(applyResumePosition, 1600);
      window.setTimeout(applyResumePosition, 2400);
      suppressSeekUntilMsRef.current = Date.now() + 3200;
      lastObservedTimeRef.current = resumeAt;
      lastObservedAtMsRef.current = Date.now();
    },
    [hasResumePosition, lastPos, routeEntryKey, videoId],
  );

  const enqueueCheckpoint = useCallback((observedPlayerState?: number | null) => {
    if (!canLogRef.current || sessionEndedRef.current) return;

    const checkpointState = normalizeObservedPlayerState(readObservedPlayerState(observedPlayerState));
    const checkpointType = getCheckpointEventType(checkpointState);
    if (!checkpointType) return;

    const evt = makeEventRef.current(checkpointType, undefined, checkpointState);
    const nowMs = Date.now();
    const previous = lastCheckpointRef.current;

    if (
      previous
      && previous.sessionId === evt.sessionId
      && previous.eventType === evt.eventType
      && previous.playerState === evt.playerState
      && Math.abs(previous.currentTimeSec - evt.currentTimeSec) < 1
      && (nowMs - previous.atMs) < 1500
    ) {
      return;
    }

    lastCheckpointRef.current = {
      sessionId: evt.sessionId,
      eventType: evt.eventType,
      playerState: evt.playerState,
      currentTimeSec: evt.currentTimeSec,
      atMs: nowMs,
    };

    enqueue(evt);
  }, [enqueue, readObservedPlayerState]);

  useEffect(() => {
    attemptResumePlayback(playerRef.current);
  }, [attemptResumePlayback]);

  const recoverNearEndPlayback = useCallback((player?: WatchPlayer | null): boolean => {
    if (!player || sessionEndedRef.current || endingSessionRef.current) return false;
    if (document.visibilityState === "hidden") return false;

    const snapshot = readPlayerSnapshot(player);
    const current = snapshot.currentTimeSec;
    const total = snapshot.durationSec;
    if (current == null || total == null || total <= 0) return false;
    const remaining = total - current;
    if (remaining <= 0 || remaining > NEAR_END_RECOVERY_WINDOW_SEC) return false;

    const now = Date.now();
    if ((now - lastNearEndRecoveryAtRef.current) < NEAR_END_RECOVERY_COOLDOWN_MS) return false;
    lastNearEndRecoveryAtRef.current = now;

    try {
      player.playVideo?.();
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearPersistedWatchContext = useCallback(() => {
    try {
      sessionStorage.removeItem(WATCH_RESUME_KEY);
    } catch {
      // noop
    }
    window.dispatchEvent(new Event(WATCH_CONTEXT_EVENT));
  }, []);

  const savePersistedWatchContext = useCallback((options?: { showBanner?: boolean }) => {
    if (!shouldPersistWatchContextRef.current) return;
    if (!videoId || sessionEndedRef.current) return;
    let lastPositionSec: number | undefined;
    const position = readPlayerSnapshot(playerRef.current).currentTimeSec ?? lastObservedTimeRef.current ?? 0;
    if (Number.isFinite(position) && position > 0) {
      lastPositionSec = position;
    }
    const payload: PersistedWatchContext = {
      videoId,
      videoTitle: title,
      fromStatus,
      fromPath,
      sessionId: sessionIdRef.current || undefined,
      lastPositionSec,
      showBanner: options?.showBanner ?? shouldShowPersistedBannerRef.current,
    };
    try {
      sessionStorage.setItem(WATCH_RESUME_KEY, JSON.stringify(payload));
    } catch {
      // noop
    }
    window.dispatchEvent(new Event(WATCH_CONTEXT_EVENT));
  }, [videoId, title, fromStatus, fromPath]);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    window.scrollTo({ top: 0, behavior: "auto" });
    const mainEl = document.querySelector(".ct-main");
    if (mainEl instanceof HTMLElement) {
      mainEl.scrollTo({ top: 0, behavior: "auto" });
    }
    const preferredTitle = locState.videoTitle || queryTitle || `Video ${videoId}`;
    const tokenKey = localStorage.getItem("ct_token") || "anon";
    const dedupeKey = `${tokenKey}:${videoId}`;
    const shouldTryActiveResume = Boolean(locState.fromPath || locState.fromStatus || locState.sessionId);
    const persistedContext = readPersistedWatchContext();
    const existingSessionId = typeof locState.sessionId === "string" && locState.sessionId.trim()
      ? locState.sessionId.trim()
      : null;
    const existingStemEligible = typeof locState.stemEligible === "boolean" ? locState.stemEligible : null;
    const existingStemMessage = typeof locState.stemMessage === "string" || locState.stemMessage === null
      ? locState.stemMessage
      : null;
    const persistedLastPosition = persistedContext
      && persistedContext.videoId === videoId
      && typeof persistedContext.lastPositionSec === "number"
      && Number.isFinite(persistedContext.lastPositionSec)
      && persistedContext.lastPositionSec > 0
      && (
        !existingSessionId
        || !persistedContext.sessionId
        || persistedContext.sessionId === existingSessionId
      )
      ? persistedContext.lastPositionSec
      : null;
    const routeLastPosition = typeof locState.lastPositionSec === "number"
      && Number.isFinite(locState.lastPositionSec)
      && locState.lastPositionSec > 0
      ? locState.lastPositionSec
      : null;
    const existingLastPosition = persistedLastPosition ?? routeLastPosition;
    shouldPersistWatchContextRef.current = true;
    shouldShowPersistedBannerRef.current = true;
    setSessionId(null);
    setLastPos(null);
    setSessionEnded(false);
    setStemEligible(null);
    setStemMessage(null);
    setTitle(preferredTitle);
    setShowWatchIntro(true);
    playerRef.current = null;

    if (existingSessionId) {
      setSessionId(existingSessionId);
      setTitle(preferredTitle);
      setStemEligible(existingStemEligible ?? true);
      setStemMessage(existingStemMessage);
      setLastPos(existingLastPosition);
      setSessionEnded(false);
      setShowWatchIntro(false);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      if (shouldTryActiveResume && fromStatus === "active") {
        try {
          const latest = pickLatestActiveSessionByVideo(await getDashboard(), videoId);
          if (!cancelled && latest?.sessionId) {
            setSessionId(latest.sessionId);
            setTitle(preferredTitle);
            setStemEligible(latest.stemEligible);
            setStemMessage(null);
            setLastPos(latest.lastPositionSec ?? null);
            setSessionEnded(false);
            setShowWatchIntro(false);
            return;
          }
        } catch {
          // fall through and try start session
        }
      }

      try {
        const res = await startSessionDeduped(dedupeKey, {
          videoId,
          videoTitle: preferredTitle,
        });
        if (cancelled) return;

        const shouldResumePlayback = res.resumed || ((res.lastPositionSec ?? 0) > 0);
        setSessionId(res.sessionId);
        setTitle(preferredTitle);
        setStemEligible(res.stemEligible);
        setStemMessage(res.stemMessage);
        setLastPos(res.lastPositionSec);
        setSessionEnded(false);
        setShowWatchIntro(res.stemEligible && !shouldResumePlayback);
      } catch (e: unknown) {
        try {
          const latest = pickLatestActiveSessionByVideo(await getDashboard(), videoId);
          if (!cancelled && latest?.sessionId) {
            setSessionId(latest.sessionId);
            setTitle(preferredTitle);
            setStemEligible(latest.stemEligible);
            setStemMessage(null);
            setLastPos(latest.lastPositionSec ?? null);
            setSessionEnded(false);
            setShowWatchIntro(false);
            return;
          }
        } catch {
          // noop
        }
        if (!cancelled) {
          setStemEligible(false);
          setStemMessage("Playback started without session tracking. Please reopen from My Learnings if progress does not update.");
          setShowWatchIntro(false);
        }
        toast.error(getErrorMessage(e, "Failed to start session"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    videoId,
    queryTitle,
    locState.videoTitle,
    locState.sessionId,
    locState.stemEligible,
    locState.stemMessage,
    locState.lastPositionSec,
    locState.fromPath,
    locState.fromStatus,
    fromStatus,
    routeEntryKey,
  ]);

  useEffect(() => {
    if (!canLog || playerReadyTick === 0 || !playerRef.current) return;

    const t = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const snapshot = readPlayerSnapshot(p);
      if (snapshot.currentTimeSec != null) setCurrentTime(snapshot.currentTimeSec);
      if (snapshot.durationSec != null) setDuration(snapshot.durationSec);
    }, 3000);

    return () => window.clearInterval(t);
  }, [canLog, playerReadyTick]);

  useEffect(() => {
    if (!canLog || playerReadyTick === 0 || !playerRef.current) return;
    const state = normalizeObservedPlayerState(readPlayerSnapshot(playerRef.current).playerState ?? Number.NaN);
    const eventType = getStateChangeEventType(state);
    if (!eventType) return;

    if (eventType === "play") {
      startTimer();
    }
    enqueue(makeEventRef.current(eventType, undefined, state));
  }, [canLog, enqueue, playerReadyTick, startTimer]);

  const flushAndEndSession = useCallback(async (): Promise<string | null> => {
    const sid = sessionIdRef.current;
    if (!sid || sessionEndedRef.current || endingSessionRef.current) return null;

    endingSessionRef.current = true;
    if (mountedRef.current) {
      setEndingSession(true);
    }
    stopTimer();

    try {
      for (let i = 0; i < 3; i += 1) {
        await flushSession(sid);
        if (getPendingCount(sid) === 0) break;
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      if (getPendingCount(sid) > 0) {
        if (mountedRef.current) {
          toast.error("Could not sync watch events. Check network and try again.");
        }
        return null;
      }

      await endSession(sid);
      sessionEndedRef.current = true;
      if (mountedRef.current) {
        setSessionEnded(true);
        toast.success("Session completed");
      }
      return sid;
    } catch (e: unknown) {
      if (mountedRef.current) {
        toast.error(getErrorMessage(e, "Failed to end session"));
      }
      return null;
    } finally {
      endingSessionRef.current = false;
      if (mountedRef.current) {
        setEndingSession(false);
      }
    }
  }, [flushSession, getPendingCount, stopTimer]);

  useEffect(() => {
    const hasMatchMedia = typeof window.matchMedia === "function";
    const isTouchMobile = (hasMatchMedia && window.matchMedia("(max-width: 900px), (pointer: coarse)").matches)
      || navigator.maxTouchPoints > 0;

    const pauseIfPlaying = () => {
      const player = playerRef.current;
      if (!player || sessionEndedRef.current) return;
      const state = readPlayerSnapshot(player).playerState;
      if (state === PLAYER_EVENT_STATE.play) {
        player.pauseVideo?.();
        stopTimer();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!isTouchMobile) {
          pauseIfPlaying();
        }
        stopTimer();
        void flushCurrentSession();
        return;
      }

      if (canLogRef.current && !sessionEndedRef.current) {
        startTimer();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [flushCurrentSession, startTimer, stopTimer]);

  useEffect(() => {
    if (sessionEnded) {
      clearPersistedWatchContext();
      return;
    }
    if (!shouldPersistWatchContextRef.current) return;
    if (!videoId) return;
    savePersistedWatchContext();
  }, [sessionEnded, videoId, title, savePersistedWatchContext, clearPersistedWatchContext]);

  useEffect(() => {
    const handlePageHide = () => {
      enqueueCheckpoint();
      if (shouldPersistWatchContextRef.current) {
        savePersistedWatchContext();
      } else {
        clearPersistedWatchContext();
      }
      stopTimer();
      void flushCurrentSession();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      enqueueCheckpoint();
      if (shouldPersistWatchContextRef.current) {
        savePersistedWatchContext();
      } else {
        clearPersistedWatchContext();
      }
      stopTimer();
      void flushCurrentSession();
    };
  }, [enqueueCheckpoint, flushCurrentSession, stopTimer, savePersistedWatchContext, clearPersistedWatchContext]);

  const onReady = (e: YouTubeEvent) => {
    const player = e.target as WatchPlayer;
    playerRef.current = player;
    playerStateRef.current = PLAYER_EVENT_STATE.ready;
    setPlayerReadyTick((value) => value + 1);
    const snapshot = readPlayerSnapshot(player);
    if (snapshot.durationSec != null) {
      setDuration(snapshot.durationSec);
    }
    if (snapshot.currentTimeSec != null) {
      lastObservedTimeRef.current = snapshot.currentTimeSec;
      lastObservedAtMsRef.current = Date.now();
    }

    if (canLogRef.current) {
      startTimer();
      enqueue(makeEventRef.current("ready", undefined, PLAYER_EVENT_STATE.ready));
    }
    attemptResumePlayback(player);
  };

  const onStateChange = (e: YouTubeEvent<number>) => {
    const state = normalizeObservedPlayerState(e.data);
    playerStateRef.current = state;
    let observedDuration = Number.isFinite(duration) && duration > 0 ? duration : Number.NaN;

    const p = playerRef.current;
    if (p) {
      const snapshot = readPlayerSnapshot(p);
      if (snapshot.currentTimeSec != null) {
        setCurrentTime(snapshot.currentTimeSec);
        lastObservedTimeRef.current = snapshot.currentTimeSec;
        lastObservedAtMsRef.current = Date.now();
      }
      if (snapshot.durationSec != null) {
        observedDuration = snapshot.durationSec;
        setDuration(snapshot.durationSec);
      }
    }

    const eventType = getStateChangeEventType(state);
    if (!eventType) {
      return;
    }

    if (eventType === "play") {
      lastNearEndRecoveryAtRef.current = 0;
      setWatchFinishedHint(false);
      if (canLog) startTimer();
    } else if (eventType === "pause") {
      if (recoverNearEndPlayback(p)) {
        return;
      }
    } else if (eventType === "ended") {
      lastNearEndRecoveryAtRef.current = 0;
      setWatchFinishedHint(true);
      toast("Finished watching. Click Complete Session to get the engagement score.");
    }

    if (canLog) {
      const endedExtras = eventType === "ended" && Number.isFinite(observedDuration) && observedDuration > 0
        ? { currentTimeSec: observedDuration }
        : undefined;
      enqueue(makeEvent(eventType, endedExtras, state));
      if (eventType === "ended") {
        void flushCurrentSession();
      }
    }
  };

  const onPlaybackRateChange = (e: YouTubeEvent<number>) => {
    if (!canLog) return;
    const rate = Number(e?.data);
    enqueue(makeEvent("ratechange", { playbackRate: Number.isFinite(rate) && rate > 0 ? rate : 1 }));
  };

  useEffect(() => {
    if (!canLog || playerReadyTick === 0 || !playerRef.current) return;

    const t = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;

      const snapshot = readPlayerSnapshot(p);
      const current = snapshot.currentTimeSec;
      const state = normalizeObservedPlayerState(snapshot.playerState ?? Number.NaN);
      const playbackRate = snapshot.playbackRate != null && snapshot.playbackRate > 0 ? snapshot.playbackRate : 1;
      if (current == null) return;
      if (state === PLAYER_EVENT_STATE.pause && recoverNearEndPlayback(p)) {
        return;
      }
      const now = Date.now();

      if (lastObservedTimeRef.current == null || lastObservedAtMsRef.current == null) {
        lastObservedTimeRef.current = current;
        lastObservedAtMsRef.current = now;
        return;
      }

      const fromSec = lastObservedTimeRef.current;
      const elapsedMs = now - lastObservedAtMsRef.current;

      if (shouldEmitSeekEvent({
        previousTimeSec: fromSec,
        nextTimeSec: current,
        elapsedMs,
        playbackRate,
        playerState: state,
        nowMs: now,
        lastSeekAtMs: lastSeekSentAtRef.current,
        suppressUntilMs: suppressSeekUntilMsRef.current,
      })) {
        enqueue(makeEventRef.current("seek", {
          currentTimeSec: current,
          seekFromSec: fromSec,
          seekToSec: current,
        }, state));
        lastSeekSentAtRef.current = now;
      }

      lastObservedTimeRef.current = current;
      lastObservedAtMsRef.current = now;
    }, 150);

    return () => window.clearInterval(t);
  }, [canLog, enqueue, playerReadyTick, recoverNearEndPlayback]);

  const handleEndSession = async () => {
    if (!sessionId || sessionEnded) return;

    enqueueCheckpoint();

    const endedSid = await flushAndEndSession();
    if (endedSid) {
      shouldPersistWatchContextRef.current = false;
      clearPersistedWatchContext();
      if (stemEligible) {
        nav(`/analyze/${endedSid}`, {
          state: {
            videoId,
            videoTitle: title,
            fromStatus,
            fromPath,
          },
        });
        return;
      }
      nav("/my-learnings?status=completed", { state: { initialStatus: "completed" } });
    }
  };

  const handleClosePlayer = async () => {
    if (closingPlayer) return;
    setClosingPlayer(true);
    shouldPersistWatchContextRef.current = true;
    shouldShowPersistedBannerRef.current = false;
    let snapshotSec = 0;
    try {
      snapshotSec = Number(playerRef.current?.getCurrentTime?.() ?? currentTime ?? 0);
    } catch {
      snapshotSec = Number(currentTime || 0);
    }
    if (Number.isFinite(snapshotSec) && snapshotSec > 0) {
      lastObservedTimeRef.current = snapshotSec;
      lastObservedAtMsRef.current = Date.now();
    }
    try {
      if (canLogRef.current) {
        const activeSessionId = sessionIdRef.current;
        enqueueCheckpoint();
        stopTimer();
        for (let i = 0; i < 3; i += 1) {
          if (activeSessionId) {
            await flushSession(activeSessionId);
            if (getPendingCount(activeSessionId) === 0) break;
          } else {
            await flush();
            if (getPendingCount() === 0) break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 120));
        }
      }
    } finally {
      savePersistedWatchContext({ showBanner: false });
      nav(fromPath, { state: { initialStatus: fromStatus } });
    }
  };

  const goAnalyze = () => {
    if (!sessionId) return;
    nav(`/analyze/${sessionId}`, {
      state: {
        videoId,
        videoTitle: title,
        fromStatus,
        fromPath,
      },
    });
  };

  if (!videoId) return <div className="ct-empty">Missing video ID</div>;
  const shouldShowIntro = showWatchIntro && stemEligible === true;
  const isSessionReady = stemEligible !== null;

  return (
    <div className="ct-slide-up ct-watch-layout">
      <section className="ct-watch-main">
        <div className="ct-watch-title-row">
          <h1 className="ct-page-title ct-watch-video-title" style={{ fontSize: 22, marginBottom: 0 }}>
            {title || "Watching Video"}
          </h1>
          <div className="ct-watch-title-actions">
            {!sessionEnded ? (
              <button
                className="ct-btn ct-btn-primary ct-btn-sm"
                onClick={handleEndSession}
                disabled={!sessionId || endingSession}
                id="end-session-btn"
              >
                <StopCircle size={14} />
                {endingSession ? "Completing..." : "Complete Session"}
              </button>
            ) : (
              stemEligible ? (
                <button
                  className="ct-btn ct-btn-secondary ct-btn-sm"
                  onClick={goAnalyze}
                  id="analyze-btn"
                >
                  <BarChart3 size={14} />
                  Analyze Engagement
                </button>
              ) : (
                <button
                  className="ct-btn ct-btn-secondary ct-btn-sm"
                  onClick={() => window.location.reload()}
                  id="watch-again-btn"
                >
                  <RotateCcw size={14} /> Watch Again
                </button>
              )
            )}
            <button
              className="ct-btn ct-btn-sm ct-watch-close-btn"
              onClick={handleClosePlayer}
              disabled={closingPlayer}
            >
              <X size={14} />
              {closingPlayer ? "Closing..." : "Close Player"}
            </button>
          </div>
        </div>

        {stemEligible === false && stemMessage && (
          <div className="ct-banner ct-banner-warning" style={{ marginBottom: 16 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{stemMessage}</span>
          </div>
        )}

        <div className={`ct-watch-player-wrap${shouldShowIntro ? " ct-watch-player-wrap-intro" : ""}`}>
          {!isSessionReady ? (
            <div className="ct-watch-player-placeholder" aria-hidden="true">
              <img
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt="Video preview"
                className="ct-watch-player-placeholder-img"
              />
            </div>
          ) : !shouldShowIntro ? (
            <YouTube
              key={`${videoId}-${routeEntryKey}`}
              className="ct-watch-player"
              iframeClassName="ct-watch-player-frame"
              videoId={videoId}
              onReady={onReady}
              onStateChange={onStateChange}
              onPlaybackRateChange={onPlaybackRateChange}
              opts={{
                width: "100%",
                height: "500",
                playerVars: {
                  autoplay: 0,
                  controls: 1,
                  disablekb: 0,
                  fs: 1,
                  iv_load_policy: 3,
                  playsinline: 1,
                  rel: 0,
                  modestbranding: 1,
                },
              }}
              style={{ width: "100%", display: "block" }}
            />
          ) : (
            <div className="ct-watch-player-placeholder" aria-hidden="true">
              <img
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt="Video preview"
                className="ct-watch-player-placeholder-img"
              />
            </div>
          )}
          {shouldShowIntro && (
            <div className="ct-watch-frame-overlay">
              <div className="ct-watch-frame-popup">
                <h3 className="ct-watch-intro-title">Before You Start</h3>
                <div className="ct-watch-intro-top">
                  <span className="ct-badge ct-badge-stem">STEM Eligible</span>
                  <span className={`ct-badge ${sessionEnded ? "ct-badge-completed" : "ct-badge-active"}`}>
                    {sessionEnded ? "Session Completed" : "Session Active"}
                  </span>
                </div>
                <p className="ct-watch-intro-text">
                  Events are sent in background batches while you watch. Click Complete Session only when you are fully done.
                </p>
                <div className="ct-modal-actions" style={{ marginTop: 12 }}>
                  <button className="ct-btn ct-btn-primary" onClick={() => setShowWatchIntro(false)}>
                    Okay
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {watchFinishedHint && !sessionEnded && (
          <div className="ct-banner ct-banner-success" style={{ marginTop: 16 }}>
            <span>
              {stemEligible
                ? "Finished watching. Click Complete Session to get the engagement score."
                : "Finished watching. Click Complete Session to save this session."}
            </span>
          </div>
        )}

        {sessionEnded && stemEligible === false && (
          <div className="ct-banner ct-banner-warning" style={{ marginTop: 16 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Session ended. This video is not STEM-eligible, so engagement analysis is unavailable.</span>
          </div>
        )}
      </section>

      <aside className="ct-watch-side">
        <h2 className="ct-section-title" style={{ fontSize: 18, marginBottom: 12 }}>
          Suggested From My Learnings
        </h2>

        {suggestedVideos.length === 0 ? (
          <div className="ct-card" style={{ padding: 16, color: "var(--ct-text-muted)" }}>
            No suggested videos yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {suggestedVideos.map((v) => (
              <button
                key={v.sessionId}
                type="button"
                className="ct-watch-suggest-item"
                onClick={() => nav(`/watch/${v.videoId}`, {
                  state: {
                    videoTitle: v.videoTitle,
                    fromStatus,
                    fromPath,
                    sessionId: v.sessionId,
                    stemEligible: v.stemEligible,
                    lastPositionSec: v.lastPositionSec,
                  },
                })}
              >
                <img
                  src={v.thumbnailUrl || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                  alt={v.videoTitle}
                  className="ct-watch-suggest-thumb"
                />
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <div className="ct-watch-suggest-title">{v.videoTitle}</div>
                  <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ct-text-muted)" }}>
                    {statusBadge(v.status)}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Clock size={11} />
                      {v.videoDurationSec ? formatDuration(v.videoDurationSec) : "-"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
