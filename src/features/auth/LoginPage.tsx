import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import toast from "react-hot-toast";
import { login as apiLogin, getMe } from "../../api/auth";
import { useAuthStore } from "../../store/useAuthStore";

export function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const { setAuth, setUser } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) {
            toast.error("Email and password required");
            return;
        }
        setLoading(true);
        try {
            const res = await apiLogin(email, password);
            setAuth(res.token, {
                userId: res.userId,
                email: res.email,
                name: res.name,
                role: res.role,
            });
            try {
                const me = await getMe();
                setUser(me);
            } catch {
                // fallback to auth response payload already stored above
            }
            toast.success("Welcome back!");
            navigate("/home");
        } catch (err: any) {
            toast.error(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ct-auth-bg">
            <div className="ct-auth-card">
                <div className="ct-glass-card ct-slide-up">
                    <div style={{ textAlign: "center", marginBottom: 32 }}>
                        <Link to="/" className="ct-logo" style={{ fontSize: 28 }}>
                            CertifyTube
                        </Link>
                        <p style={{ color: "var(--ct-text-secondary)", marginTop: 8, fontSize: 14 }}>
                            Sign in to continue learning
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="ct-form-group">
                            <label className="ct-form-label">Email</label>
                            <input
                                className="ct-input"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoFocus
                                id="login-email"
                            />
                        </div>

                        <div className="ct-form-group">
                            <label className="ct-form-label">Password</label>
                            <input
                                className="ct-input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                id="login-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="ct-btn ct-btn-primary ct-btn-lg"
                            style={{ width: "100%", marginTop: 8 }}
                            disabled={loading}
                            id="login-submit"
                        >
                            <LogIn size={18} />
                            {loading ? "Signing in…" : "Sign In"}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--ct-text-secondary)" }}>
                        Don't have an account?{" "}
                        <Link to="/signup" style={{ fontWeight: 600 }}>
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
