import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, ClipboardCheck, RotateCcw, X } from "lucide-react";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

import { analyzeSession } from "../../api/sessions";
import { queryClient } from "../../app/queryClient";
import type { AnalyzeResponse } from "../../types/api";

import "./analyze.css";

type AnalyzeLocationState = {
  videoId?: string;
  videoTitle?: string;
  fromStatus?: "active" | "completed" | "quiz";
  fromPath?: string;
};

export function AnalyzePage() {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const locState = (location.state || {}) as AnalyzeLocationState;
  const fromStatus = locState.fromStatus === "active" || locState.fromStatus === "completed" || locState.fromStatus === "quiz"
    ? locState.fromStatus
    : "completed";
  const fromPath = (locState.fromPath || `/my-learnings?status=${fromStatus}`).trim();

  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalyze = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await analyzeSession(sessionId, "xgboost");
      setResult(res);
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (res.status === "ENGAGED") {
        toast.success("Engagement passed");
      } else {
        toast.error("Engagement threshold not met");
      }
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  if (!sessionId) return <div className="ct-empty">Missing analysis context</div>;

  const engaged = result?.status === "ENGAGED";
  const hasResult = Boolean(result);
  const scorePct = result ? result.engagementScore * 100 : 0;
  const scoreText = useMemo(() => `${scorePct.toFixed(0)}%`, [scorePct]);
  const title = locState.videoTitle?.trim() || "Video Session";
  const explanationText = useMemo(() => {
    if (!result) return "";
    const fromMl = result.explanation?.trim();
    if (fromMl) return fromMl;
    return engaged
      ? "You can now continue to quiz for the second verification step."
      : "Please watch again and retry analysis to pass the first step.";
  }, [engaged, result]);

  const goMyLearnings = () => nav(fromPath, { state: { initialStatus: fromStatus } });
  const goWatchAgain = () => {
    if (locState.videoId) {
      nav(`/watch/${locState.videoId}`, {
        state: {
          videoTitle: locState.videoTitle,
          fromStatus,
          fromPath,
        },
      });
      return;
    }
    nav(fromPath, { state: { initialStatus: fromStatus } });
  };
  const goQuiz = () => {
    nav(`/quiz/${sessionId}`, {
      state: {
        sessionId,
        videoId: locState.videoId,
        videoTitle: locState.videoTitle,
        fromStatus,
        fromPath,
      },
    });
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

      <div className="ct-card ct-analyze-compact-card">
        <p className="ct-analyze-compact-title">Dual Verification</p>
        <p className="ct-analyze-compact-text">
          Pass engagement analysis first, then pass quiz to get certificate eligibility.
        </p>
        <div className="ct-analyze-compact-cta">
          <button className="ct-btn ct-btn-primary ct-btn-lg" onClick={runAnalyze} disabled={loading} id="analyze-submit">
            <BarChart3 size={16} />
            {loading ? "Getting Score..." : "Get Engagement Score"}
          </button>
        </div>
      </div>

      {hasResult && createPortal(
        <div className="ct-modal-backdrop ct-analyze-compact-backdrop" onClick={goMyLearnings}>
          <div className="ct-analyze-compact-popup" onClick={(e) => e.stopPropagation()}>
            <div className="ct-analyze-compact-popup-head">
              <p className="ct-analyze-compact-kicker">Engagement Score</p>
              <button className="ct-analyze-compact-close" onClick={goMyLearnings} aria-label="Close popup">
                <X size={16} />
              </button>
            </div>

            <div className="ct-analyze-compact-score-wrap">
              <div className={`ct-analyze-compact-score ${engaged ? "good" : "bad"}`}>{scoreText}</div>
              <p className="ct-analyze-compact-meta">
                Required {((result?.threshold || 0) * 100).toFixed(0)}% | Model {result?.model?.toUpperCase()}
              </p>
            </div>
            <p className={`ct-analyze-compact-status ${engaged ? "good" : "bad"}`}>
              {engaged ? "Step 1 Passed" : "Step 1 Not Passed"}
            </p>
            <p className="ct-analyze-compact-popup-text">
              {explanationText}
            </p>

            <div className="ct-modal-actions ct-analyze-compact-actions">
              <button className="ct-btn ct-btn-secondary" onClick={goMyLearnings}>
                Close
              </button>
              {engaged ? (
                <button className="ct-btn ct-btn-primary" onClick={goQuiz} id="take-quiz-btn">
                  <ClipboardCheck size={16} /> Continue to Quiz
                </button>
              ) : (
                <button className="ct-btn ct-btn-primary" onClick={goWatchAgain} id="watch-again-btn">
                  <RotateCcw size={16} /> Watch Again
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
