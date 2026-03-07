import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, Play, ClipboardPaste } from "lucide-react";
import toast from "react-hot-toast";

import { youtubeSearch } from "../../api/youtube";
import type { YouTubeSearchResponse } from "../../types/api";

const SEARCH_TEXT_KEY = "ct_home_search_text";
const SEARCH_SUBMITTED_KEY = "ct_home_search_submitted";
const SEARCH_RESULTS_KEY = "ct_home_search_results";
const SEARCH_DURATIONS_KEY = "ct_home_video_durations";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiReadyPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiReadyPromise) return ytApiReadyPromise;

  ytApiReadyPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    const prev = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };

    if (!existing) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  });

  return ytApiReadyPromise;
}

async function fetchVideoDurationSec(videoId: string): Promise<number | null> {
  try {
    await loadYouTubeIframeApi();
  } catch {
    return null;
  }

  if (!window.YT?.Player) return null;

  return new Promise<number | null>((resolve) => {
    const container = document.createElement("div");
    container.id = `ct-yt-duration-${videoId}-${Math.random().toString(36).slice(2, 8)}`;
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.width = "1px";
    container.style.height = "1px";
    document.body.appendChild(container);

    let player: any = null;
    let settled = false;
    let timeoutId = 0;

    const finalize = (value: number | null) => {
      if (settled) return;
      settled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      try {
        player?.destroy?.();
      } catch {
        // noop
      }
      container.remove();
      resolve(value);
    };

    const readDuration = (attempt = 0) => {
      try {
        const raw = Number(player?.getDuration?.() ?? 0);
        if (Number.isFinite(raw) && raw > 0) {
          finalize(Math.round(raw));
          return;
        }
      } catch {
        // noop
      }

      if (attempt >= 8) {
        finalize(null);
        return;
      }

      window.setTimeout(() => readDuration(attempt + 1), 250);
    };

    timeoutId = window.setTimeout(() => finalize(null), 6000);
    player = new window.YT.Player(container.id, {
      videoId,
      width: "1",
      height: "1",
      playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => readDuration(),
        onError: () => finalize(null),
      },
    });
  });
}

function readSessionStorage(key: string): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(key) || "";
}

function readCachedResults(): YouTubeSearchResponse | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SEARCH_RESULTS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as YouTubeSearchResponse;
    if (!parsed || !Array.isArray(parsed.videos)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readDurationCache(): Record<string, number> {
  if (typeof window === "undefined") return {};
  const raw = sessionStorage.getItem(SEARCH_DURATIONS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;

  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function extractYouTubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const isVideoId = /^[a-zA-Z0-9_-]{11}$/.test(raw);
  if (isVideoId) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let id = "";

  if (host === "youtu.be") {
    id = url.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      id = url.searchParams.get("v") || "";
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
        id = parts[1] || "";
      }
    }
  }

  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

export function SearchPage() {
  const [q, setQ] = useState(() => readSessionStorage(SEARCH_TEXT_KEY));
  const [submitted, setSubmitted] = useState(() => readSessionStorage(SEARCH_SUBMITTED_KEY));
  const [cachedResults, setCachedResults] = useState<YouTubeSearchResponse | null>(() => readCachedResults());
  const [durationCache, setDurationCache] = useState<Record<string, number>>(() => readDurationCache());

  const nav = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["yt-search", submitted],
    queryFn: () => youtubeSearch(submitted, 20),
    enabled: submitted.trim().length > 0,
  });

  useEffect(() => {
    sessionStorage.setItem(SEARCH_TEXT_KEY, q);
  }, [q]);

  useEffect(() => {
    sessionStorage.setItem(SEARCH_SUBMITTED_KEY, submitted);
  }, [submitted]);

  useEffect(() => {
    if (!data) return;
    setCachedResults(data);
    sessionStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    sessionStorage.setItem(SEARCH_DURATIONS_KEY, JSON.stringify(durationCache));
  }, [durationCache]);

  const visibleResults = useMemo(() => {
    if (data) return data;
    if (cachedResults && cachedResults.query === submitted) return cachedResults;
    return null;
  }, [data, cachedResults, submitted]);

  useEffect(() => {
    if (!visibleResults?.videos?.length) return;

    const ids = visibleResults.videos
      .map((v) => v.videoId)
      .filter((id) => durationCache[id] == null);

    if (ids.length === 0) return;

    let cancelled = false;

    (async () => {
      for (const id of ids) {
        if (cancelled) return;
        const sec = await fetchVideoDurationSec(id);
        if (cancelled || sec == null) continue;

        setDurationCache((prev) => {
          if (prev[id] != null) return prev;
          return { ...prev, [id]: sec };
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleResults, durationCache]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();

    if (!text) {
      toast.error("Enter a search term");
      return;
    }

    const pastedVideoId = extractYouTubeVideoId(text);
    if (pastedVideoId) {
      setQ("");
      nav(`/watch/${pastedVideoId}`);
      return;
    }

    setSubmitted(text);
    setQ("");
  };

  const handlePasteUrl = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast.error("Clipboard is empty");
        return;
      }
      setQ(text);
    } catch {
      toast.error("Clipboard access blocked by browser");
    }
  };
  const showCenteredHero = !isLoading && !isError && !visibleResults;

  return (
    <div className="ct-slide-up">
      <div style={{ maxWidth: 980, margin: "0 auto", paddingTop: showCenteredHero ? "16vh" : 0 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 12, width: "100%", maxWidth: 760 }}
          >
            <div style={{ position: "relative", flex: 1 }}>
              <SearchIcon
                size={18}
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ct-text-muted)",
                }}
              />
              <input
                className="ct-input"
                style={{ paddingLeft: 42, paddingRight: 112, height: 46 }}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search topic or paste YouTube URL"
                id="search-input"
                autoFocus
              />
              <button
                type="button"
                onClick={handlePasteUrl}
                className="ct-btn ct-btn-ghost ct-btn-sm"
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: "5px 10px",
                }}
              >
                <ClipboardPaste size={13} />
                Paste URL
              </button>
            </div>

            <button type="submit" className="ct-btn ct-btn-primary" id="search-submit">
              <SearchIcon size={16} />
              Search
            </button>
          </form>
        </div>
      </div>

      {isLoading && (
        <div className="ct-loading">
          <div className="ct-spinner" />
          <span>Searching videos...</span>
        </div>
      )}

      {isError && (
        <div className="ct-banner ct-banner-error" style={{ maxWidth: 760 }}>
          Search failed. Please try again.
        </div>
      )}

      {!isLoading && visibleResults && visibleResults.videos?.length === 0 && (
        <div className="ct-empty">
          <div className="ct-empty-icon">Search</div>
          <p>No videos found for "{visibleResults.query}"</p>
        </div>
      )}

      {visibleResults && visibleResults.videos && visibleResults.videos.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: "var(--ct-text-muted)", marginBottom: 16 }}>
            {visibleResults.count} results for "{visibleResults.query}"
          </p>
          <div className="ct-video-grid">
            {visibleResults.videos.map((v) => {
              const durationSec = v.videoDurationSec ?? durationCache[v.videoId];

              return (
                <div
                  key={v.videoId}
                  className="ct-video-card"
                  onClick={() => nav(`/watch/${v.videoId}`, { state: { videoTitle: v.title } })}
                  id={`video-card-${v.videoId}`}
                >
                  <div className="ct-video-card-thumb-wrap">
                    <img
                      src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                      alt={v.title}
                      className="ct-video-card-thumb"
                    />
                    {durationSec != null && (
                      <span className="ct-video-duration">{formatDuration(durationSec)}</span>
                    )}
                  </div>
                  <div className="ct-video-card-body">
                    <div className="ct-video-card-title">{v.title}</div>
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <Play size={12} style={{ color: "var(--ct-accent-light)" }} />
                      <span style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>
                        Click to start watching
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
