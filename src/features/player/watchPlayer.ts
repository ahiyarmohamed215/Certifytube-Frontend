type PlayerNumberReader = () => unknown;

export type WatchPlayer = {
  getCurrentTime?: PlayerNumberReader;
  getDuration?: PlayerNumberReader;
  getPlaybackRate?: PlayerNumberReader;
  getPlayerState?: PlayerNumberReader;
  playVideo?: () => void;
  pauseVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
};

export type WatchPlayerSnapshot = {
  currentTimeSec: number | null;
  durationSec: number | null;
  playbackRate: number | null;
  playerState: number | null;
};

function toFiniteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function readPlayerNumber(reader?: PlayerNumberReader): number | null {
  if (!reader) return null;

  try {
    return toFiniteNumber(reader());
  } catch {
    return null;
  }
}

export function readPlayerSnapshot(player?: WatchPlayer | null): WatchPlayerSnapshot {
  return {
    currentTimeSec: readPlayerNumber(player?.getCurrentTime),
    durationSec: readPlayerNumber(player?.getDuration),
    playbackRate: readPlayerNumber(player?.getPlaybackRate),
    playerState: readPlayerNumber(player?.getPlayerState),
  };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return fallback;
  }

  const { message } = error as { message?: unknown };
  return typeof message === "string" && message.trim() ? message : fallback;
}
