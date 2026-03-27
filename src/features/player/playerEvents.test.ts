import { describe, expect, it } from "vitest";

import {
  PLAYER_EVENT_STATE,
  getCheckpointEventType,
  getPlayerStateForEvent,
  getStateChangeEventType,
  shouldEmitSeekEvent,
  toLocalIsoWithoutTz,
} from "./playerEvents";

describe("playerEvents", () => {
  it("maps canonical event types to stable player state codes", () => {
    expect(getPlayerStateForEvent("play", PLAYER_EVENT_STATE.buffering)).toBe(PLAYER_EVENT_STATE.play);
    expect(getPlayerStateForEvent("pause", PLAYER_EVENT_STATE.play)).toBe(PLAYER_EVENT_STATE.pause);
    expect(getPlayerStateForEvent("buffering", PLAYER_EVENT_STATE.play)).toBe(PLAYER_EVENT_STATE.buffering);
    expect(getPlayerStateForEvent("seek", PLAYER_EVENT_STATE.play)).toBe(PLAYER_EVENT_STATE.seek);
    expect(getPlayerStateForEvent("ready", PLAYER_EVENT_STATE.unstarted)).toBe(PLAYER_EVENT_STATE.ready);
    expect(getPlayerStateForEvent("ended", PLAYER_EVENT_STATE.play)).toBe(PLAYER_EVENT_STATE.ended);
    expect(getPlayerStateForEvent("ratechange", PLAYER_EVENT_STATE.pause)).toBe(PLAYER_EVENT_STATE.pause);
    expect(getPlayerStateForEvent("ratechange")).toBe(PLAYER_EVENT_STATE.unstarted);
  });

  it("only emits checkpoint event types for play, pause, and buffering", () => {
    expect(getCheckpointEventType(PLAYER_EVENT_STATE.play)).toBe("play");
    expect(getCheckpointEventType(PLAYER_EVENT_STATE.pause)).toBe("pause");
    expect(getCheckpointEventType(PLAYER_EVENT_STATE.buffering)).toBe("buffering");
    expect(getCheckpointEventType(PLAYER_EVENT_STATE.ended)).toBeNull();
    expect(getCheckpointEventType(PLAYER_EVENT_STATE.ready)).toBeNull();
    expect(getCheckpointEventType(PLAYER_EVENT_STATE.unstarted)).toBeNull();
  });

  it("maps watched player states to state-change event types", () => {
    expect(getStateChangeEventType(PLAYER_EVENT_STATE.play)).toBe("play");
    expect(getStateChangeEventType(PLAYER_EVENT_STATE.pause)).toBe("pause");
    expect(getStateChangeEventType(PLAYER_EVENT_STATE.buffering)).toBe("buffering");
    expect(getStateChangeEventType(PLAYER_EVENT_STATE.ended)).toBe("ended");
    expect(getStateChangeEventType(PLAYER_EVENT_STATE.ready)).toBeNull();
    expect(getStateChangeEventType(PLAYER_EVENT_STATE.unstarted)).toBeNull();
  });

  it("does not flag normal elapsed playback as a seek", () => {
    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 12.5,
      elapsedMs: 2500,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.play,
      nowMs: 5000,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(false);

    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 12,
      elapsedMs: 500,
      playbackRate: 4,
      playerState: PLAYER_EVENT_STATE.play,
      nowMs: 5000,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(false);

    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 10.6,
      elapsedMs: 250,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.play,
      nowMs: 5000,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(false);
  });

  it("flags real jumps as seeks, including paused or buffering jumps", () => {
    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 45,
      elapsedMs: 500,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.play,
      nowMs: 5000,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(true);

    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 10.75,
      elapsedMs: 250,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.play,
      nowMs: 5000,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(true);

    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 45,
      elapsedMs: 500,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.buffering,
      nowMs: 5000,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(true);

    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 10.5,
      elapsedMs: 200,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.pause,
      nowMs: 5000,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(true);
  });

  it("still suppresses cooldown and seek suppression windows", () => {
    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 45,
      elapsedMs: 500,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.pause,
      nowMs: 100,
      lastSeekAtMs: 0,
      suppressUntilMs: 0,
    })).toBe(false);

    expect(shouldEmitSeekEvent({
      previousTimeSec: 10,
      nextTimeSec: 45,
      elapsedMs: 500,
      playbackRate: 1,
      playerState: PLAYER_EVENT_STATE.pause,
      nowMs: 300,
      lastSeekAtMs: 0,
      suppressUntilMs: 500,
    })).toBe(false);
  });

  it("formats local timestamps without embedding the timezone suffix", () => {
    const date = new Date(2026, 2, 27, 16, 5, 9);
    expect(toLocalIsoWithoutTz(date)).toBe("2026-03-27T16:05:09");
  });
});
