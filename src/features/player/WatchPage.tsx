import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import YouTube from "react-youtube";
import { AlertTriangle, StopCircle, BarChart3, X, Clock } from "lucide-react";
import toast from "react-hot-toast";

import { startSession, endSession } from "../../api/sessions";
import { getDashboard } from "../../api/dashboard";
import { useEventBatcher } from "./hooks/useEventBatcher";
import type { DashboardResponse, DashboardVideo, EventPayload, SessionStatus } from "../../types/api";

type LocationState = { videoTitle?: string };

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
  const queryTitle = (searchParams.get("title") || "").trim();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState(locState.videoTitle || queryTitle || "");
  const [stemEligible, setStemEligible] = useState(true);
  const [stemMessage, setStemMessage] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const [lastPos, setLastPos] = useState<number | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  const [playerState, setPlayerState] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionEndedRef = useRef(false);
  const endingSessionRef = useRef(false);
  const mountedRef = useRef(true);
  const lastObservedTimeRef = useRef<number | null>(null);
  const lastSeekSentAtRef = useRef(0);
  const suppressSeekUntilMsRef = useRef(0);
  const canLog = Boolean(sessionId && !sessionEnded);

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard", "watch-suggestions"],
    queryFn: () => getDashboard(),
  });

  const suggestedVideos = useMemo(
    () => pickLatestByVideo(dashboardData).filter((v) => v.videoId !== videoId).slice(0, 12),
    [dashboardData, videoId],
  );

  const toLocalIsoWithoutTz = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const { enqueue, flush, startTimer, stopTimer, getPendingCount } = useEventBatcher({
    enabled: canLog,
    flushIntervalMs: 5000,
  });

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    sessionEndedRef.current = sessionEnded;
  }, [sessionEnded]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    lastObservedTimeRef.current = null;
    lastSeekSentAtRef.current = 0;
    suppressSeekUntilMsRef.current = 0;
  }, [sessionId]);

  const makeEvent = useCallback((type: string, extras?: Partial<EventPayload>): EventPayload => ({
    sessionId: sessionId!,
    eventType: type,
    playerState,
    playbackRate: playerRef.current?.getPlaybackRate?.() || 1,
    currentTimeSec: playerRef.current?.getCurrentTime?.() || currentTime,
    videoDurationSec: (playerRef.current?.getDuration?.() || duration) > 0
      ? (playerRef.current?.getDuration?.() || duration)
      : undefined,
    clientCreatedAtLocal: toLocalIsoWithoutTz(new Date()),
    clientTzOffsetMin: new Date().getTimezoneOffset(),
    clientEventMs: performance.now(),
    ...extras,
  }), [sessionId, playerState, currentTime, duration]);

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const preferredTitle = locState.videoTitle || queryTitle || `Video ${videoId}`;

    (async () => {
      try {
        const res = await startSession({
          videoId,
          videoTitle: preferredTitle,
        });
        if (cancelled) return;

        setSessionId(res.sessionId);
        setTitle(preferredTitle);
        setStemEligible(res.stemEligible);
        setStemMessage(res.stemMessage);
        setResumed(res.resumed);
        setLastPos(res.lastPositionSec);
        setSessionEnded(false);
      } catch (e: any) {
        toast.error(e?.message || "Failed to start session");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, queryTitle]);

  useEffect(() => {
    if (!canLog || !playerRef.current) return;

    const t = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime());
        setDuration(p.getDuration());
      } catch {
        // noop
      }
    }, 3000);

    return () => window.clearInterval(t);
  }, [canLog]);

  useEffect(() => {
    if (!canLog || !playerRef.current) return;
    try {
      const state = Number(playerRef.current.getPlayerState?.() ?? -1);
      if (state === 1) {
        enqueue(makeEvent("play"));
        startTimer();
      } else if (state === 2) {
        enqueue(makeEvent("pause"));
      } else if (state === 3) {
        enqueue(makeEvent("buffering"));
      }
    } catch {
      // noop
    }
  }, [canLog, enqueue, makeEvent, startTimer]);

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
        await flush();
        if (getPendingCount() === 0) break;
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }

      if (getPendingCount() > 0) {
        if (mountedRef.current) {
          toast.error("Could not sync watch events. Check network and try again.");
        }
        return null;
      }

      await endSession(sid);
      sessionEndedRef.current = true;
      if (mountedRef.current) {
        setSessionEnded(true);
        toast.success("Session ended");
      }
      return sid;
    } catch (e: any) {
      if (mountedRef.current) {
        toast.error(e?.message || "Failed to end session");
      }
      return null;
    } finally {
      endingSessionRef.current = false;
      if (mountedRef.current) {
        setEndingSession(false);
      }
    }
  }, [flush, getPendingCount, stopTimer]);

  useEffect(() => {
    const handlePageHide = () => {
      stopTimer();
      void flush();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      stopTimer();
      void flush();
    };
  }, [flush, stopTimer]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onReady = (e: any) => {
    playerRef.current = e.target;
    try {
      setDuration(e.target.getDuration());
      lastObservedTimeRef.current = e.target.getCurrentTime();
    } catch {
      // noop
    }

    if (resumed && lastPos != null && lastPos > 0) {
      e.target.seekTo(lastPos, true);
      suppressSeekUntilMsRef.current = Date.now() + 1500;
      lastObservedTimeRef.current = lastPos;
      toast.success(`Resumed at ${Math.floor(lastPos / 60)}:${Math.floor(lastPos % 60).toString().padStart(2, "0")}`);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onStateChange = (e: any) => {
    const state = e.data as number;
    setPlayerState(state);

    const p = playerRef.current;
    if (p) {
      try {
        setCurrentTime(p.getCurrentTime());
        setDuration(p.getDuration());
      } catch {
        // noop
      }
    }

    let eventType = "play";
    if (state === 1) {
      eventType = "play";
      if (canLog) startTimer();
    } else if (state === 2) {
      eventType = "pause";
      stopTimer();
    } else if (state === 3) {
      eventType = "buffering";
    } else if (state === 0) {
      eventType = "ended";
      stopTimer();
      toast("Video finished. Click End Session to continue.");
    } else {
      return;
    }

    if (canLog) {
      enqueue(makeEvent(eventType));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onPlaybackRateChange = (e: any) => {
    if (!canLog) return;
    const rate = Number(e?.data);
    enqueue(makeEvent("ratechange", { playbackRate: Number.isFinite(rate) ? rate : 1 }));
  };

  useEffect(() => {
    if (!canLog || !playerRef.current) return;

    const t = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;

      let current = 0;
      let state = -1;
      try {
        current = Number(p.getCurrentTime?.() ?? 0);
        state = Number(p.getPlayerState?.() ?? -1);
      } catch {
        return;
      }

      if (!Number.isFinite(current)) return;
      if (lastObservedTimeRef.current == null) {
        lastObservedTimeRef.current = current;
        return;
      }

      const isBuffering = state === 3;
      const now = Date.now();

      if (!isBuffering && now >= suppressSeekUntilMsRef.current) {
        const fromSec = lastObservedTimeRef.current;
        const delta = current - fromSec;

        if (Math.abs(delta) >= 2 && (now - lastSeekSentAtRef.current) > 400) {
          enqueue(makeEvent("seek", {
            seekFromSec: fromSec,
            seekToSec: current,
          }));
          lastSeekSentAtRef.current = now;
        }
      }

      if (!isBuffering) {
        lastObservedTimeRef.current = current;
      }
    }, 500);

    return () => window.clearInterval(t);
  }, [canLog, enqueue, makeEvent]);

  const handleEndSession = async () => {
    if (!sessionId || sessionEnded) return;

    if (canLog) {
      try {
        const state = Number(playerRef.current?.getPlayerState?.() ?? -1);
        const checkpointType = state === 1 ? "play" : state === 3 ? "buffering" : "pause";
        enqueue(makeEvent(checkpointType));
      } catch {
        // noop
      }
    }

    const endedSid = await flushAndEndSession();
    if (endedSid) {
      nav(`/analyze/${endedSid}`, {
        state: {
          videoId,
          videoTitle: title,
        },
      });
    }
  };

  const goAnalyze = () => {
    if (!sessionId) return;
    nav(`/analyze/${sessionId}`);
  };

  if (!videoId) return <div className="ct-empty">Missing video ID</div>;

  return (
    <div className="ct-slide-up ct-watch-layout">
      <section className="ct-watch-main">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
          <h1 className="ct-page-title" style={{ fontSize: 22, marginBottom: 0 }}>
            {title || "Watching Video"}
          </h1>
          <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav("/my-learnings")}>
            <X size={14} />
            Close Player
          </button>
        </div>

        {!stemEligible && stemMessage && (
          <div className="ct-banner ct-banner-warning" style={{ marginBottom: 16 }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{stemMessage}</span>
          </div>
        )}

        <div style={{ borderRadius: "var(--ct-radius-lg)", overflow: "hidden", border: "1px solid var(--ct-border)", marginBottom: 18 }}>
          <YouTube
            videoId={videoId}
            onReady={onReady}
            onStateChange={onStateChange}
            onPlaybackRateChange={onPlaybackRateChange}
            opts={{
              width: "100%",
              height: "500",
              playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
            }}
            style={{ width: "100%", display: "block" }}
          />
        </div>

        <div className="ct-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className={`ct-badge ${stemEligible ? "ct-badge-stem" : "ct-badge-not-stem"}`}>
              {stemEligible ? "STEM Eligible" : "Non-STEM"}
            </span>
            <span className={`ct-badge ${sessionEnded ? "ct-badge-completed" : "ct-badge-active"}`}>
              {sessionEnded ? "Session Completed" : "Session Active"}
            </span>
          </div>

          <p style={{ fontSize: 13, color: "var(--ct-text-secondary)", marginBottom: 12 }}>
            Events are sent in background batches while you watch. Click End Session only when you are fully done.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!sessionEnded ? (
              <button
                className="ct-btn ct-btn-primary ct-btn-sm"
                onClick={handleEndSession}
                disabled={!sessionId || endingSession}
                id="end-session-btn"
              >
                <StopCircle size={14} />
                {endingSession ? "Ending..." : "End Session"}
              </button>
            ) : (
              stemEligible && (
                <button
                  className="ct-btn ct-btn-secondary ct-btn-sm"
                  onClick={goAnalyze}
                  id="analyze-btn"
                >
                  <BarChart3 size={14} />
                  Analyze Engagement
                </button>
              )
            )}
          </div>
        </div>

        {sessionEnded && !stemEligible && (
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
                onClick={() => nav(`/watch/${v.videoId}`, { state: { videoTitle: v.videoTitle } })}
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
