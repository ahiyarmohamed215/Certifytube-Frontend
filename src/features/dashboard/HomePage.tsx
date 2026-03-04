import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Play,
    BarChart3,
    ClipboardCheck,
    Award,
    BookOpen,
    Clock,
} from "lucide-react";
import { getDashboard } from "../../api/dashboard";
import type { DashboardVideo, SessionStatus } from "../../types/api";

function statusBadge(status: SessionStatus) {
    const map: Record<SessionStatus, { cls: string; label: string }> = {
        ACTIVE: { cls: "ct-badge-active", label: "Watching" },
        COMPLETED: { cls: "ct-badge-completed", label: "Completed" },
        QUIZ_PENDING: { cls: "ct-badge-quiz", label: "Quiz Ready" },
        CERTIFIED: { cls: "ct-badge-certified", label: "Certified" },
    };
    const b = map[status] || { cls: "", label: status };
    return <span className={`ct-badge ${b.cls}`}>{b.label}</span>;
}

function actionLabel(status: SessionStatus) {
    switch (status) {
        case "ACTIVE": return { icon: <Play size={14} />, text: "Continue Watching" };
        case "COMPLETED": return { icon: <BarChart3 size={14} />, text: "Analyze Engagement" };
        case "QUIZ_PENDING": return { icon: <ClipboardCheck size={14} />, text: "Take Quiz" };
        case "CERTIFIED": return { icon: <Award size={14} />, text: "View Certificate" };
    }
}

function getActionPath(v: DashboardVideo) {
    switch (v.status) {
        case "ACTIVE": return `/watch/${v.videoId}`;
        case "COMPLETED": return `/analyze/${v.sessionId}`;
        case "QUIZ_PENDING": return `/analyze/${v.sessionId}`;
        case "CERTIFIED": return `/certificate/${v.certificateId}`;
    }
}

function formatDuration(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoRow({ v, onClick }: { v: DashboardVideo; onClick: () => void }) {
    const action = actionLabel(v.status);
    return (
        <div
            className="ct-card ct-card-hover"
            style={{ display: "flex", gap: 16, cursor: "pointer", padding: 16, marginBottom: 12 }}
            onClick={onClick}
        >
            <img
                src={v.thumbnailUrl || `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`}
                alt={v.videoTitle}
                style={{ width: 160, height: 90, borderRadius: "var(--ct-radius-sm)", objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    {statusBadge(v.status)}
                    {v.stemEligible && <span className="ct-badge ct-badge-stem">STEM</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {v.videoTitle}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--ct-text-muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} />
                        {v.videoDurationSec ? formatDuration(v.videoDurationSec) : "—"}
                    </span>
                    {v.progressPercent != null && (
                        <span>{v.progressPercent.toFixed(0)}% watched</span>
                    )}
                    {v.engagementScore != null && (
                        <span>Score: {(v.engagementScore * 100).toFixed(0)}%</span>
                    )}
                </div>
                {v.status === "ACTIVE" && v.progressPercent != null && (
                    <div className="ct-progress" style={{ marginTop: 8, maxWidth: 300 }}>
                        <div className="ct-progress-bar" style={{ width: `${Math.min(v.progressPercent, 100)}%` }} />
                    </div>
                )}
            </div>
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <span className="ct-btn ct-btn-primary ct-btn-sm">
                    {action.icon}
                    {action.text}
                </span>
            </div>
        </div>
    );
}

export function HomePage() {
    const nav = useNavigate();

    const { data: activeData, isLoading: loadingActive } = useQuery({
        queryKey: ["dashboard", "ACTIVE"],
        queryFn: () => getDashboard("ACTIVE"),
    });

    const { data: historyData, isLoading: loadingHistory } = useQuery({
        queryKey: ["dashboard", "history"],
        queryFn: () => getDashboard("COMPLETED,QUIZ_PENDING,CERTIFIED"),
    });

    const activeVideos = activeData?.activeVideos || [];
    const historyVideos = [
        ...(historyData?.completedVideos || []),
        ...(historyData?.quizPendingVideos || []),
        ...(historyData?.certifiedVideos || []),
    ];

    return (
        <div className="ct-slide-up">
            <h1 className="ct-page-title">Dashboard</h1>
            <p className="ct-page-subtitle">Track your progress and continue learning</p>

            {/* Continue Watching */}
            <div style={{ marginBottom: 40 }}>
                <h2 className="ct-section-title">
                    <Play size={20} style={{ color: "var(--ct-accent-light)" }} />
                    Continue Watching
                </h2>

                {loadingActive ? (
                    <div className="ct-loading"><div className="ct-spinner" /><span>Loading…</span></div>
                ) : activeVideos.length === 0 ? (
                    <div className="ct-card" style={{ textAlign: "center", padding: 32, color: "var(--ct-text-muted)" }}>
                        <BookOpen size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                        <p>No active sessions. Search for a video to start learning!</p>
                    </div>
                ) : (
                    activeVideos.map((v) => (
                        <VideoRow key={v.sessionId} v={v} onClick={() => nav(getActionPath(v))} />
                    ))
                )}
            </div>

            {/* My Learnings */}
            <div>
                <h2 className="ct-section-title">
                    <Award size={20} style={{ color: "var(--ct-success)" }} />
                    My Learnings
                </h2>

                {loadingHistory ? (
                    <div className="ct-loading"><div className="ct-spinner" /><span>Loading…</span></div>
                ) : historyVideos.length === 0 ? (
                    <div className="ct-card" style={{ textAlign: "center", padding: 32, color: "var(--ct-text-muted)" }}>
                        <Award size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                        <p>No completed sessions yet. Keep watching!</p>
                    </div>
                ) : (
                    historyVideos.map((v) => (
                        <VideoRow key={v.sessionId} v={v} onClick={() => nav(getActionPath(v))} />
                    ))
                )}
            </div>
        </div>
    );
}
