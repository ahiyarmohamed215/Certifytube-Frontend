import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BarChart3, CheckCircle, XCircle, ClipboardCheck, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { analyzeSession } from "../../api/sessions";
import type { AnalyzeResponse } from "../../types/api";

export function AnalyzePage() {
    const { sessionId } = useParams();
    const nav = useNavigate();

    const [result, setResult] = useState<AnalyzeResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [model, setModel] = useState("xgboost");

    const handleAnalyze = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const res = await analyzeSession(sessionId, model);
            setResult(res);
            if (res.status === "ENGAGED") {
                toast.success("Engagement verified!");
            } else {
                toast.error("Engagement score below threshold");
            }
        } catch (e: any) {
            toast.error(e?.message || "Analysis failed");
        } finally {
            setLoading(false);
        }
    };

    if (!sessionId) return <div className="ct-empty">Missing session ID</div>;

    const engaged = result?.status === "ENGAGED";
    const scorePct = result ? result.engagementScore * 100 : 0;

    return (
        <div className="ct-slide-up" style={{ maxWidth: 700, margin: "0 auto" }}>
            <button className="ct-btn ct-btn-ghost ct-btn-sm" onClick={() => nav("/my-learnings")} style={{ marginBottom: 16 }}>
                <ArrowLeft size={14} /> Back to My Learnings
            </button>

            <h1 className="ct-page-title">Engagement Analysis</h1>
            <p className="ct-page-subtitle">Session: <code style={{ color: "var(--ct-accent-light)" }}>{sessionId.slice(0, 12)}…</code></p>

            {!result && (
                <div className="ct-glass-card" style={{ textAlign: "center" }}>
                    <BarChart3 size={48} style={{ color: "var(--ct-accent-light)", marginBottom: 16 }} />
                    <p style={{ marginBottom: 20, color: "var(--ct-text-secondary)" }}>
                        Analyze your viewing engagement to check if you qualify for the quiz and certification.
                    </p>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
                        <label className="ct-form-label" style={{ margin: 0 }}>Model:</label>
                        <select
                            className="ct-select"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                        >
                            <option value="xgboost">XGBoost</option>
                            <option value="ebm">EBM</option>
                        </select>
                    </div>

                    <button
                        className="ct-btn ct-btn-primary ct-btn-lg"
                        onClick={handleAnalyze}
                        disabled={loading}
                        id="analyze-submit"
                    >
                        <BarChart3 size={18} />
                        {loading ? "Analyzing…" : "Analyze Engagement"}
                    </button>
                </div>
            )}

            {result && (
                <div className="ct-fade-in">
                    {/* Score Gauge */}
                    <div className="ct-glass-card" style={{ textAlign: "center", marginBottom: 24 }}>
                        <div
                            className="ct-gauge"
                            style={{ ["--gauge-pct" as string]: `${scorePct}%` }}
                        >
                            <div className="ct-gauge-inner">
                                <div className="ct-gauge-value">{scorePct.toFixed(0)}%</div>
                                <div className="ct-gauge-label">Engagement</div>
                            </div>
                        </div>

                        <div style={{ marginTop: 20 }}>
                            {engaged ? (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--ct-success)", fontSize: 18, fontWeight: 700 }}>
                                    <CheckCircle size={22} /> ENGAGED
                                </div>
                            ) : (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--ct-error)", fontSize: 18, fontWeight: 700 }}>
                                    <XCircle size={22} /> NOT ENGAGED
                                </div>
                            )}
                            <p style={{ fontSize: 13, color: "var(--ct-text-muted)", marginTop: 6 }}>
                                Threshold: {(result.threshold * 100).toFixed(0)}% · Model: {result.model}
                            </p>
                        </div>
                    </div>

                    {/* Explanation */}
                    <div className="ct-card" style={{ marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Analysis Explanation</h3>
                        <p style={{ color: "var(--ct-text-secondary)", fontSize: 14, lineHeight: 1.7 }}>
                            {result.explanation}
                        </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        {engaged && (
                            <button
                                className="ct-btn ct-btn-primary ct-btn-lg"
                                onClick={() => nav(`/quiz/${sessionId}`, { state: { sessionId } })}
                                id="take-quiz-btn"
                            >
                                <ClipboardCheck size={18} /> Take Quiz
                            </button>
                        )}
                        <button className="ct-btn ct-btn-secondary" onClick={() => nav("/my-learnings")}>
                            Back to My Learnings
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
