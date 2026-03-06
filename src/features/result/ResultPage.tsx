import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Award, Download, Share2, Home, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getQuizResult } from "../../api/quiz";
import { downloadCertificatePdf } from "../../api/certificate";
import type { QuizSubmitResponse } from "../../types/quiz";

export function ResultPage() {
    const { quizId } = useParams();
    const nav = useNavigate();
    const location = useLocation();
    const stateResult = (location.state as any)?.result as QuizSubmitResponse | undefined;

    const [result, setResult] = useState<QuizSubmitResponse | null>(stateResult || null);
    const [loading, setLoading] = useState(!stateResult);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (stateResult || !quizId) return;
        (async () => {
            try {
                const r = await getQuizResult(quizId);
                setResult(r);
            } catch (e: any) {
                toast.error(e?.message || "Failed to load result");
            } finally {
                setLoading(false);
            }
        })();
    }, [quizId, stateResult]);

    const handleDownload = async () => {
        if (!result?.certificateId) return;
        setDownloading(true);
        try {
            await downloadCertificatePdf(result.certificateId);
            toast.success("Certificate downloaded!");
        } catch (e: any) {
            toast.error(e?.message || "Download failed");
        } finally {
            setDownloading(false);
        }
    };

    const handleShare = () => {
        if (!result?.verificationLink) return;
        navigator.clipboard.writeText(result.verificationLink);
        toast.success("Verification link copied to clipboard!");
    };

    if (loading) {
        return (
            <div className="ct-loading" style={{ minHeight: 300 }}>
                <div className="ct-spinner" />
                <span>Loading result…</span>
            </div>
        );
    }

    if (!result) {
        return <div className="ct-empty">Result not found</div>;
    }

    return (
        <div className="ct-slide-up" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
            {/* Result hero */}
            <div className="ct-glass-card" style={{ marginBottom: 24 }}>
                {result.passed ? (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <Award size={64} style={{ color: "var(--ct-success)" }} />
                        </div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ct-success)", marginBottom: 8 }}>
                            <CheckCircle size={28} style={{ verticalAlign: "middle", marginRight: 8 }} />
                            Quiz Passed!
                        </h1>
                        <p style={{ color: "var(--ct-text-secondary)" }}>
                            Congratulations! You've earned your certificate.
                        </p>
                    </>
                ) : (
                    <>
                        <div style={{ marginBottom: 16 }}>
                            <XCircle size={64} style={{ color: "var(--ct-error)" }} />
                        </div>
                        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--ct-error)", marginBottom: 8 }}>
                            Quiz Not Passed
                        </h1>
                        <p style={{ color: "var(--ct-text-secondary)" }}>
                            Keep trying! Review the video and attempt again.
                        </p>
                    </>
                )}

                <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 32 }}>
                    <div>
                        <div style={{ fontSize: 36, fontWeight: 800, background: result.passed ? "var(--ct-gradient-success)" : "var(--ct-gradient-warm)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            {result.scorePercent.toFixed(0)}%
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>Score</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 36, fontWeight: 800, color: "var(--ct-text)" }}>
                            {result.correctCount}/{result.totalCount}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ct-text-muted)" }}>Correct</div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {result.passed && result.certificateId && (
                    <>
                        <button className="ct-btn ct-btn-primary" onClick={handleDownload} disabled={downloading} id="download-cert-btn">
                            <Download size={16} />
                            {downloading ? "Downloading…" : "Download Certificate"}
                        </button>
                        <button
                            className="ct-btn ct-btn-secondary"
                            onClick={() => nav(`/certificate/${result.certificateId}`)}
                        >
                            <Award size={16} /> View Certificate
                        </button>
                    </>
                )}
                {result.verificationLink && (
                    <button className="ct-btn ct-btn-secondary" onClick={handleShare} id="share-link-btn">
                        <Share2 size={16} /> Copy Verification Link
                    </button>
                )}
                <button className="ct-btn ct-btn-ghost" onClick={() => nav("/my-learnings")}>
                    <Home size={16} /> My Learnings
                </button>
            </div>
        </div>
    );
}
