import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import YouTube from "react-youtube";
import { AlertTriangle, StopCircle, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";

import { startSession, endSession } from "../../api/sessions";
import { useEventBatcher } from "./hooks/useEventBatcher";
import type { EventPayload } from "../../types/api";

type LocationState = { videoTitle?: string };

export function WatchPage() {
  const { videoId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const locState = (location.state || {}) as LocationState;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState(locState.videoTitle || "");
  const [stemEligible, setStemEligible] = useState(true);
  const [stemMessage, setStemMessage] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  const [lastPos, setLastPos] = useState<number | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  const [playerState, setPlayerState] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const canLog = Boolean(sessionId && !sessionEnded);

  const { enqueue, flush, startTimer, stopTimer } = useEventBatcher({
    enabled: canLog,
    flushIntervalMs: 5000,
  });

  // Helper: create event payload
  const makeEvent = (type: string, extras?: Partial<EventPayload>): EventPayload => ({
    sessionId: sessionId!,
    eventType: type,
    playerState,
    playbackRate: playerRef.current?.getPlaybackRate?.() || 1,
    currentTimeSec: playerRef.current?.getCurrentTime?.() || currentTime,
    videoDurationSec: playerRef.current?.getDuration?.() || duration,
    clientEventMs: performance.now(),
    ...extras,
  });

  // --- Start session ---
  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await startSession({
          videoId,
          videoTitle: locState.videoTitle || videoId,
        });
        if (cancelled) return;

        setSessionId(res.sessionId);
        setTitle(locState.videoTitle || videoId);
        setStemEligible(res.stemEligible);
        setStemMessage(res.stemMessage);
        setResumed(res.resumed);
        setLastPos(res.lastPositionSec);
      } catch (e: any) {
        toast.error(e?.message || "Failed to start session");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // --- Time tick (every 3s for update) ---
  useEffect(() => {
    if (!canLog || !playerRef.current) return;

    const t = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime());
        setDuration(p.getDuration());
      } catch { /* noop */ }
    }, 3000);

    return () => window.clearInterval(t);
  }, [canLog]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Player callbacks ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onReady = (e: any) => {
    playerRef.current = e.target;
    try {
      setDuration(e.target.getDuration());
    } catch { /* noop */ }

    // If resumed, seek to last position
    if (resumed && lastPos != null && lastPos > 0) {
      e.target.seekTo(lastPos, true);
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
      } catch { /* noop */ }
    }

    let eventType = "play";
    if (state === 1) { eventType = "play"; startTimer(); }
    else if (state === 2) { eventType = "pause"; }
    else if (state === 3) { eventType = "buffering"; }
    else if (state === 0) { eventType = "ended"; }
    else return;

    if (canLog) {
      enqueue(makeEvent(eventType));
    }

    // Auto-end when video finishes
    if (state === 0 && sessionId && !sessionEnded) {
      handleEndSession();
    }
  };

  const handleEndSession = async () => {
    if (!sessionId || sessionEnded) return;
    stopTimer();
    try {
      await flush();
      await endSession(sessionId);
      setSessionEnded(true);
      toast.success("Session ended");
    } catch (e: any) {
      toast.error(e?.message || "Failed to end session");
    }
  };

  const goAnalyze = () => {
    if (!sessionId) return;
    nav(`/analyze/${sessionId}`);
  };

  if (!videoId) return <div className="ct-empty">Missing video ID</div>;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="ct-slide-up">
      <h1 className="ct-page-title" style={{ fontSize: 22, marginBottom: 16 }}>
        {title || videoId}
      </h1>

      {/* STEM warning banner */}
      {!stemEligible && stemMessage && (
        <div className="ct-banner ct-banner-warning" style={{ marginBottom: 16 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{stemMessage}</span>
        </div>
      )}

      {/* Video Player */}
      <div style={{ borderRadius: "var(--ct-radius-lg)", overflow: "hidden", border: "1px solid var(--ct-border)", marginBottom: 20 }}>
        <YouTube
          videoId={videoId}
          onReady={onReady}
          onStateChange={onStateChange}
          opts={{
            width: "100%",
            height: "500",
            playerVars: { autoplay: 0, rel: 0, modestbranding: 1 },
          }}
          style={{ width: "100%", display: "block" }}
        />
      </div>

      {/* Progress bar */}
      <div className="ct-progress" style={{ marginBottom: 16 }}>
        <div className="ct-progress-bar" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>

      {/* Status info */}
      <div className="ct-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--ct-text-secondary)" }}>
          <span>Session: <span style={{ color: "var(--ct-text)", fontFamily: "monospace" }}>{sessionId?.slice(0, 8) || "…"}</span></span>
          <span>Time: {Math.floor(currentTime)}s / {Math.floor(duration)}s</span>
          <span>Progress: {progress.toFixed(1)}%</span>
          {stemEligible ? (
            <span className="ct-badge ct-badge-stem">STEM</span>
          ) : (
            <span className="ct-badge ct-badge-not-stem">Non-STEM</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {!sessionEnded ? (
            <button
              className="ct-btn ct-btn-secondary ct-btn-sm"
              onClick={handleEndSession}
              disabled={!sessionId}
              id="end-session-btn"
            >
              <StopCircle size={14} />
              End Session
            </button>
          ) : (
            stemEligible && (
              <button
                className="ct-btn ct-btn-primary ct-btn-sm"
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
    </div>
  );
}
