import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, Play } from "lucide-react";
import toast from "react-hot-toast";

import { youtubeSearch } from "../../api/youtube";
import type { YouTubeSearchResponse } from "../../types/api";

const SEARCH_TEXT_KEY = "ct_home_search_text";
const SEARCH_SUBMITTED_KEY = "ct_home_search_submitted";
const SEARCH_RESULTS_KEY = "ct_home_search_results";

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

export function SearchPage() {
  const [q, setQ] = useState(() => readSessionStorage(SEARCH_TEXT_KEY));
  const [submitted, setSubmitted] = useState(() => readSessionStorage(SEARCH_SUBMITTED_KEY));
  const [cachedResults, setCachedResults] = useState<YouTubeSearchResponse | null>(() => readCachedResults());

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

  const visibleResults = useMemo(() => {
    if (data) return data;
    if (cachedResults && cachedResults.query === submitted) return cachedResults;
    return null;
  }, [data, cachedResults, submitted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();

    if (!text) {
      toast.error("Enter a search term");
      return;
    }

    setSubmitted(text);
  };

  return (
    <div className="ct-slide-up">
      <h1 className="ct-page-title" style={{ marginBottom: 18 }}>Home</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, maxWidth: 760, marginBottom: 24 }}>
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
            style={{ paddingLeft: 42 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search videos... e.g. object oriented programming"
            id="search-input"
            autoFocus
          />
        </div>

        <button type="submit" className="ct-btn ct-btn-primary" id="search-submit">
          <SearchIcon size={16} />
          Search
        </button>
      </form>

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
            {visibleResults.videos.map((v) => (
              <div
                key={v.videoId}
                className="ct-video-card"
                onClick={() => nav(`/watch/${v.videoId}`, { state: { videoTitle: v.title } })}
                id={`video-card-${v.videoId}`}
              >
                <img
                  src={`https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                  alt={v.title}
                  className="ct-video-card-thumb"
                />
                <div className="ct-video-card-body">
                  <div className="ct-video-card-title">{v.title}</div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <Play size={12} style={{ color: "var(--ct-accent-light)" }} />
                    <span style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>Click to start watching</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
