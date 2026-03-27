export const PLAYER_EVENT_STATE = {
  unstarted: -1,
  ended: 0,
  play: 1,
  pause: 2,
  buffering: 3,
  seek: 4,
  ready: 5,
} as const;

export function normalizeObservedPlayerState(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : PLAYER_EVENT_STATE.unstarted;
}

export function getPlayerStateForEvent(eventType: string, observedPlayerState?: number | null): number {
  switch (eventType) {
    case "play":
      return PLAYER_EVENT_STATE.play;
    case "pause":
      return PLAYER_EVENT_STATE.pause;
    case "buffering":
      return PLAYER_EVENT_STATE.buffering;
    case "seek":
      return PLAYER_EVENT_STATE.seek;
    case "ready":
      return PLAYER_EVENT_STATE.ready;
    case "ended":
      return PLAYER_EVENT_STATE.ended;
    default:
      return normalizeObservedPlayerState(observedPlayerState);
  }
}

export function getCheckpointEventType(playerState: number): "play" | "pause" | "buffering" | null {
  switch (normalizeObservedPlayerState(playerState)) {
    case PLAYER_EVENT_STATE.play:
      return "play";
    case PLAYER_EVENT_STATE.pause:
      return "pause";
    case PLAYER_EVENT_STATE.buffering:
      return "buffering";
    default:
      return null;
  }
}

export function getStateChangeEventType(playerState: number): "play" | "pause" | "buffering" | "ended" | "unstarted" | null {
  switch (normalizeObservedPlayerState(playerState)) {
    case PLAYER_EVENT_STATE.unstarted:
      return "unstarted";
    case PLAYER_EVENT_STATE.play:
      return "play";
    case PLAYER_EVENT_STATE.pause:
      return "pause";
    case PLAYER_EVENT_STATE.buffering:
      return "buffering";
    case PLAYER_EVENT_STATE.ended:
      return "ended";
    default:
      return null;
  }
}

export function toLocalIsoWithoutTz(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

interface SeekEventCheck {
  previousTimeSec: number;
  nextTimeSec: number;
  elapsedMs: number;
  playbackRate: number;
  playerState: number;
  nowMs: number;
  lastSeekAtMs: number;
  suppressUntilMs: number;
}

export function shouldEmitSeekEvent({
  previousTimeSec,
  nextTimeSec,
  elapsedMs,
  playbackRate,
  playerState,
  nowMs,
  lastSeekAtMs,
  suppressUntilMs,
}: SeekEventCheck): boolean {
  if (!Number.isFinite(previousTimeSec) || !Number.isFinite(nextTimeSec)) return false;
  if (nowMs < suppressUntilMs) return false;
  if ((nowMs - lastSeekAtMs) <= 150) return false;

  const normalizedState = normalizeObservedPlayerState(playerState);
  const actualDelta = nextTimeSec - previousTimeSec;
  const absoluteDelta = Math.abs(actualDelta);
  if (absoluteDelta < 0.25) return false;

  if (normalizedState !== PLAYER_EVENT_STATE.play) {
    return true;
  }

  const normalizedRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  const expectedDelta = Math.max(0, elapsedMs) / 1000 * normalizedRate;
  const drift = Math.abs(actualDelta - expectedDelta);

  return drift >= 0.45;
}
