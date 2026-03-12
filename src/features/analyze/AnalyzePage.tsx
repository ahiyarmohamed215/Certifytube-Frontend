import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, ClipboardCheck, RotateCcw, X } from "lucide-react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

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
  const [model, setModel] = useState<"xgboost" | "ebm">("xgboost");

  const runAnalyze = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await analyzeSession(sessionId, model);
      setResult(res);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.status === "ENGAGED") {
        toast.success("Engagement passed");
      } else {
        toast.error("Not engaged yet. Watch again.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [model, sessionId]);

  if (!sessionId) return <div className="ct-empty">Missing analysis context</div>;

  const engaged = result?.status === "ENGAGED";
  const notEngaged = result?.status === "NOT_ENGAGED";
  const scorePct = result ? result.engagementScore * 100 : 0;
  const scoreText = useMemo(() => `${scorePct.toFixed(0)}%`, [scorePct]);
  const title = locState.videoTitle?.trim() || "Video Engagement";
  const goMyLearnings = () => nav("/my-learnings");
  const goWatchAgain = () => {
    if (locState.videoId) {
      nav(`/watch/${locState.videoId}`, { state: { videoTitle: locState.videoTitle } });
      return;
    }
    nav("/my-learnings");
  };

  return (
    <div className="ct-slide-up" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="ct-analyze-topbar">
        <button className="ct-btn ct-btn-secondary ct-btn-sm ct-analyze-back-btn" onClick={() => nav(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <button className="ct-btn ct-btn-sm ct-analyze-close-btn" onClick={goMyLearnings}>
          <X size={14} /> Close
        </button>
      </div>

      <h1 className="ct-page-title">Engagement Analysis</h1>
      <p className="ct-page-subtitle">{title}</p>

      <div className="ct-card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label className="ct-form-label" style={{ margin: 0 }}>Model</label>
            <select className="ct-select" value={model} onChange={(e) => setModel(e.target.value as "xgboost" | "ebm")} disabled={loading}>
              <option value="xgboost">XGBoost</option>
              <option value="ebm">EBM</option>
            </select>
          </div>
          <button className="ct-btn ct-btn-primary" onClick={runAnalyze} disabled={loading} id="analyze-submit">
            <BarChart3 size={16} />
            {loading ? "Getting score..." : "Get Engagement Score"}
          </button>
        </div>
        <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ct-text-muted)" }}>
          Select a model, then run analysis for this completed session.
        </p>
      </div>

      {result && engaged && (
        <div className="ct-fade-in">
          <div className="ct-card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.45, color: "var(--ct-text-muted)", marginBottom: 6 }}>
              Engagement Score
            </p>
            <div style={{ fontSize: 46, fontWeight: 800, color: engaged ? "var(--ct-success)" : "var(--ct-error)", lineHeight: 1 }}>
              {scoreText}
            </div>
            <p style={{ marginTop: 8, fontSize: 13, color: "var(--ct-text-secondary)" }}>
              Required {(result.threshold * 100).toFixed(0)}% | Model {result.model.toUpperCase()}
            </p>
            <p style={{ marginTop: 10, fontSize: 13, color: engaged ? "var(--ct-success)" : "var(--ct-error)", fontWeight: 700 }}>
              {engaged ? "ENGAGED" : "NOT ENGAGED"}
            </p>

            <h3 style={{ marginTop: 14, marginBottom: 6, fontSize: 15, fontWeight: 700 }}>Explanation</h3>
            <p style={{ fontSize: 14, color: "var(--ct-text-secondary)", lineHeight: 1.65 }}>
              {result.explanation}
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              className="ct-btn ct-btn-primary ct-btn-lg"
              onClick={() => nav(`/quiz/${sessionId}`, {
                state: {
                  sessionId,
                  videoId: locState.videoId,
                  videoTitle: locState.videoTitle,
                },
              })}
              id="take-quiz-btn"
            >
              <ClipboardCheck size={18} /> Take Quiz
            </button>
          </div>
        </div>
      )}

      {notEngaged && createPortal(
        <div className="ct-modal-backdrop" onClick={goMyLearnings}>
          <div className="ct-modal-card ct-analyze-popup" onClick={(e) => e.stopPropagation()}>
            <div className="ct-analyze-popup-top">
              <div>
                <p className="ct-analyze-popup-kicker">Engagement Score</p>
                <div className="ct-analyze-popup-score">{scoreText}</div>
              </div>
              <button className="ct-analyze-popup-close" onClick={goMyLearnings} aria-label="Close popup">
                <X size={16} />
              </button>
            </div>
            <p className="ct-analyze-popup-status">NOT ENGAGED</p>
            <p className="ct-analyze-popup-text">
              {result?.explanation}
            </p>
            <div className="ct-modal-actions">
              <button className="ct-btn ct-btn-secondary" onClick={goMyLearnings}>
                Close
              </button>
              <button className="ct-btn ct-btn-primary" onClick={goWatchAgain} id="watch-again-btn">
                <RotateCcw size={16} /> Watch Again
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
