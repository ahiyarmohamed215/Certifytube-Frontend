import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, Play } from "lucide-react";
import toast from "react-hot-toast";
import { youtubeSearch } from "../../api/youtube";

export function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const nav = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["yt-search", submitted],
    queryFn: () => youtubeSearch(submitted, 20),
    enabled: submitted.trim().length > 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = q.trim();
    if (!t) {
      toast.error("Enter a search term");
      return;
    }
    setSubmitted(t);
  };

  return (
    <div className="ct-slide-up">
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h1 className="ct-page-title">
          Learn. Watch. Get{" "}
          <span style={{ background: "var(--ct-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Certified
          </span>
        </h1>
        <p className="ct-page-subtitle">
          Search for STEM videos, prove your engagement, and earn verifiable certificates
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: 12, maxWidth: 640, margin: "0 auto 40px" }}
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
            style={{ paddingLeft: 42 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for videos… e.g. 'Machine Learning', 'React Hooks'"
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
          <span>Searching videos…</span>
        </div>
      )}

      {isError && (
        <div className="ct-banner ct-banner-error" style={{ maxWidth: 640, margin: "0 auto" }}>
          Search failed. Please try again.
        </div>
      )}

      {!isLoading && data && data.videos?.length === 0 && (
        <div className="ct-empty">
          <div className="ct-empty-icon">🔍</div>
          <p>No videos found for "{submitted}"</p>
        </div>
      )}

      {data && data.videos && data.videos.length > 0 && (
        <>
          <p style={{ fontSize: 13, color: "var(--ct-text-muted)", marginBottom: 16 }}>
            {data.count} results for "{data.query}"
          </p>
          <div className="ct-video-grid">
            {data.videos.map((v) => (
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
