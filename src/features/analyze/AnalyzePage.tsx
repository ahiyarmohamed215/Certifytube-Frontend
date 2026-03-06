import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BarChart3, CheckCircle, XCircle, ClipboardCheck, ArrowLeft, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import { analyzeSession } from "../../api/sessions";
import { queryClient } from "../../app/queryClient";
import type { AnalyzeResponse } from "../../types/api";

type AnalyzeLocationState = {
  videoId?: string;
  videoTitle?: string;
};

export function AnalyzePage() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const locState = (location.state || {}) as AnalyzeLocationState;

  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("xgboost");
  const [attemptedOnce, setAttemptedOnce] = useState(false);
  const autoTriggeredRef = useRef(false);

  const runAnalyze = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await analyzeSession(sessionId, model);
      setResult(res);
      setAttemptedOnce(true);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.status === "ENGAGED") {
        toast.success("Engagement verified");
      } else {
        toast.error("Not engaged yet. Please watch again.");
      }
    } catch (e: any) {
      setAttemptedOnce(true);
      toast.error(e?.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [model, sessionId]);

  useEffect(() => {
    if (!sessionId || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    void runAnalyze();
  }, [runAnalyze, sessionId]);

  if (!sessionId) return <div className="ct-empty">Missing session ID</div>;

  const engaged = result?.status === "ENGAGED";
  const scorePct = result ? result.engagementScore * 100 : 0;
  const scoreText = useMemo(() => `${scorePct.toFixed(0)}%`, [scorePct]);

  return (
    <div className="ct-slide-up" style={{ maxWidth: 760, margin: "0 auto" }}>
      <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav("/my-learnings")} style={{ marginBottom: 16 }}>
        <ArrowLeft size={14} /> Back to My Learnings
      </button>

      <h1 className="ct-page-title">Engagement Analysis</h1>
      <p className="ct-page-subtitle">Session {sessionId.slice(0, 12)}...</p>

      {!result && (
        <div className="ct-glass-card" style={{ textAlign: "center" }}>
          <BarChart3 size={44} style={{ color: "var(--ct-accent-light)", marginBottom: 16 }} />
          <p style={{ marginBottom: 18, color: "var(--ct-text-secondary)" }}>
            {loading ? "Running analysis..." : "Preparing analysis"}
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginBottom: 18 }}>
            <label className="ct-form-label" style={{ margin: 0 }}>Model:</label>
            <select
              className="ct-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
            >
              <option value="xgboost">XGBoost</option>
              <option value="ebm">EBM</option>
            </select>
          </div>

          <button
            className="ct-btn ct-btn-primary ct-btn-lg"
            onClick={runAnalyze}
            disabled={loading}
            id="analyze-submit"
          >
            <BarChart3 size={18} />
            {loading ? "Analyzing..." : attemptedOnce ? "Analyze Again" : "Analyze Engagement"}
          </button>
        </div>
      )}

      {result && (
        <div className="ct-fade-in">
          <div className="ct-glass-card" style={{ textAlign: "center", marginBottom: 20 }}>
            <div
              className="ct-gauge"
              style={{ ["--gauge-pct" as string]: `${scorePct}%` }}
            >
              <div className="ct-gauge-inner">
                <div className="ct-gauge-value">{scoreText}</div>
                <div className="ct-gauge-label">Engagement Score</div>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              {engaged ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ct-success)", fontSize: 19, fontWeight: 800 }}>
                  <CheckCircle size={22} /> ENGAGED
                </div>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ct-error)", fontSize: 19, fontWeight: 800 }}>
                  <XCircle size={22} /> NOT ENGAGED
                </div>
              )}
              <p style={{ fontSize: 13, color: "var(--ct-text-muted)", marginTop: 6 }}>
                Threshold {(result.threshold * 100).toFixed(0)}% | Model {result.model}
              </p>
            </div>
          </div>

          <div className="ct-card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Why this score</h3>
            <p style={{ color: "var(--ct-text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
              {result.explanation}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {engaged ? (
              <button
                className="ct-btn ct-btn-primary ct-btn-lg"
                onClick={() => nav(`/quiz/${sessionId}`, { state: { sessionId } })}
                id="take-quiz-btn"
              >
                <ClipboardCheck size={18} /> Take Quiz
              </button>
            ) : (
              <button
                className="ct-btn ct-btn-primary ct-btn-lg"
                onClick={() => {
                  if (locState.videoId) {
                    nav(`/watch/${locState.videoId}`, { state: { videoTitle: locState.videoTitle } });
                  } else {
                    nav("/my-learnings");
                  }
                }}
                id="watch-again-btn"
              >
                <RotateCcw size={18} /> Watch Again
              </button>
            )}

            <button className="ct-btn ct-btn-secondary" onClick={runAnalyze} disabled={loading}>
              <BarChart3 size={16} /> Re-Analyze
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
