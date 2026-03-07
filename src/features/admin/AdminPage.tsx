import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Users, Film, Award, ClipboardCheck, Trash2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import {
    getAdminStats,
    getAdminUsers,
    getAdminSessions,
    getAdminCertificates,
    getAdminQuizzes,
    deleteUser,
    updateUserRole,
    deleteSession,
    deleteCertificate,
    deleteQuiz,
} from "../../api/admin";

type Tab = "stats" | "users" | "sessions" | "certificates" | "quizzes";

export function AdminPage() {
    const [tab, setTab] = useState<Tab>("stats");
    const nav = useNavigate();
    const { user } = useAuthStore();
    const qc = useQueryClient();

    if (user?.role !== "ADMIN") {
        return (
            <div className="ct-empty" style={{ minHeight: 300 }}>
                <div className="ct-empty-icon">🔒</div>
                <p>Access denied. Admin role required.</p>
                <button className="ct-btn ct-btn-primary" onClick={() => nav("/my-learnings")} style={{ marginTop: 16 }}>
                    Go to My Learnings
                </button>
            </div>
        );
    }

    return (
        <div className="ct-slide-up">
            <h1 className="ct-page-title">
                <Shield size={28} style={{ verticalAlign: "middle", marginRight: 8, color: "var(--ct-accent-light)" }} />
                Admin Panel
            </h1>
            <p className="ct-page-subtitle">Manage users, sessions, certificates, and quizzes</p>

            <div className="ct-tabs">
                {([
                    { key: "stats", label: "Overview", icon: <RefreshCw size={14} /> },
                    { key: "users", label: "Users", icon: <Users size={14} /> },
                    { key: "sessions", label: "Sessions", icon: <Film size={14} /> },
                    { key: "certificates", label: "Certificates", icon: <Award size={14} /> },
                    { key: "quizzes", label: "Quizzes", icon: <ClipboardCheck size={14} /> },
                ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
                    <button
                        key={t.key}
                        className={`ct-tab ${tab === t.key ? "active" : ""}`}
                        onClick={() => setTab(t.key)}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {tab === "stats" && <StatsTab />}
            {tab === "users" && <UsersTab qc={qc} />}
            {tab === "sessions" && <SessionsTab qc={qc} />}
            {tab === "certificates" && <CertificatesTab qc={qc} />}
            {tab === "quizzes" && <QuizzesTab qc={qc} />}
        </div>
    );
}

function StatsTab() {
    const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: getAdminStats });

    if (isLoading) return <div className="ct-loading"><div className="ct-spinner" /></div>;
    if (!data) return null;

    const stats = [
        { label: "Users", value: data.totalUsers, icon: <Users size={20} /> },
        { label: "Sessions", value: data.totalSessions, icon: <Film size={20} /> },
        { label: "Certificates", value: data.totalCertificates, icon: <Award size={20} /> },
        { label: "Quizzes", value: data.totalQuizzes, icon: <ClipboardCheck size={20} /> },
    ];

    return (
        <div className="ct-stat-grid">
            {stats.map((s) => (
                <div key={s.label} className="ct-stat-card">
                    <div style={{ color: "var(--ct-accent-light)", marginBottom: 8 }}>{s.icon}</div>
                    <div className="ct-stat-value">{s.value}</div>
                    <div className="ct-stat-label">{s.label}</div>
                </div>
            ))}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function UsersTab({ qc }: { qc: any }) {
    const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: getAdminUsers });

    const delMut = useMutation({
        mutationFn: deleteUser,
        onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
        onError: (e: any) => toast.error(e?.message || "Delete failed"),
    });

    const roleMut = useMutation({
        mutationFn: ({ id, role }: { id: number; role: string }) => updateUserRole(id, role),
        onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
        onError: (e: any) => toast.error(e?.message || "Update failed"),
    });

    if (isLoading) return <div className="ct-loading"><div className="ct-spinner" /></div>;

    return (
        <div className="ct-table-wrap">
            <table className="ct-table">
                <thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
                <tbody>
                    {data?.map((u) => (
                        <tr key={u.userId}>
                            <td>{u.userId}</td>
                            <td>{u.email}</td>
                            <td>
                                <select
                                    className="ct-select"
                                    value={u.role}
                                    onChange={(e) => roleMut.mutate({ id: u.userId, role: e.target.value })}
                                    style={{ padding: "4px 8px", fontSize: 12 }}
                                >
                                    <option value="LEARNER">LEARNER</option>
                                    <option value="ADMIN">ADMIN</option>
                                </select>
                            </td>
                            <td>
                                <button className="ct-btn ct-btn-danger ct-btn-sm" onClick={() => { if (confirm("Delete user?")) delMut.mutate(u.userId) }}>
                                    <Trash2 size={12} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SessionsTab({ qc }: { qc: any }) {
    const { data, isLoading } = useQuery({ queryKey: ["admin-sessions"], queryFn: getAdminSessions });

    const delMut = useMutation({
        mutationFn: deleteSession,
        onSuccess: () => { toast.success("Session deleted"); qc.invalidateQueries({ queryKey: ["admin-sessions"] }); },
        onError: (e: any) => toast.error(e?.message || "Delete failed"),
    });

    if (isLoading) return <div className="ct-loading"><div className="ct-spinner" /></div>;

    return (
        <div className="ct-table-wrap">
            <table className="ct-table">
                <thead><tr><th>Record</th><th>User</th><th>Video</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                    {data?.map((s, idx) => (
                        <tr key={s.sessionId}>
                            <td style={{ fontSize: 12 }}>{idx + 1}</td>
                            <td>{s.userId}</td>
                            <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.videoTitle}</td>
                            <td><span className={`ct-badge ct-badge-${s.status.toLowerCase()}`}>{s.status}</span></td>
                            <td style={{ fontSize: 12 }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                            <td>
                                <button className="ct-btn ct-btn-danger ct-btn-sm" onClick={() => { if (confirm("Delete session?")) delMut.mutate(s.sessionId) }}>
                                    <Trash2 size={12} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CertificatesTab({ qc }: { qc: any }) {
    const { data, isLoading } = useQuery({ queryKey: ["admin-certs"], queryFn: getAdminCertificates });

    const delMut = useMutation({
        mutationFn: deleteCertificate,
        onSuccess: () => { toast.success("Certificate deleted"); qc.invalidateQueries({ queryKey: ["admin-certs"] }); },
        onError: (e: any) => toast.error(e?.message || "Delete failed"),
    });

    if (isLoading) return <div className="ct-loading"><div className="ct-spinner" /></div>;

    return (
        <div className="ct-table-wrap">
            <table className="ct-table">
                <thead><tr><th>Cert #</th><th>User</th><th>Score</th><th>Issued</th><th>Actions</th></tr></thead>
                <tbody>
                    {data?.map((c) => (
                        <tr key={c.certificateId}>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.certificateNumber}</td>
                            <td>{c.userId}</td>
                            <td>{c.scorePercent?.toFixed(0)}%</td>
                            <td style={{ fontSize: 12 }}>{new Date(c.createdAtUtc).toLocaleDateString()}</td>
                            <td>
                                <button className="ct-btn ct-btn-danger ct-btn-sm" onClick={() => { if (confirm("Delete certificate?")) delMut.mutate(c.certificateId) }}>
                                    <Trash2 size={12} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QuizzesTab({ qc }: { qc: any }) {
    const { data, isLoading } = useQuery({ queryKey: ["admin-quizzes"], queryFn: getAdminQuizzes });

    const delMut = useMutation({
        mutationFn: deleteQuiz,
        onSuccess: () => { toast.success("Quiz deleted"); qc.invalidateQueries({ queryKey: ["admin-quizzes"] }); },
        onError: (e: any) => toast.error(e?.message || "Delete failed"),
    });

    if (isLoading) return <div className="ct-loading"><div className="ct-spinner" /></div>;

    return (
        <div className="ct-table-wrap">
            <table className="ct-table">
                <thead><tr><th>Quiz ID</th><th>User</th><th>Video</th><th>Difficulty</th><th>Questions</th><th>Actions</th></tr></thead>
                <tbody>
                    {data?.map((q) => (
                        <tr key={q.quizId}>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{q.quizId.slice(0, 8)}…</td>
                            <td>{q.userId}</td>
                            <td style={{ fontFamily: "monospace", fontSize: 12 }}>{q.videoId.slice(0, 8)}…</td>
                            <td>{q.difficulty}</td>
                            <td>{q.totalQuestions}</td>
                            <td>
                                <button className="ct-btn ct-btn-danger ct-btn-sm" onClick={() => { if (confirm("Delete quiz?")) delMut.mutate(q.quizId) }}>
                                    <Trash2 size={12} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

