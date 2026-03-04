import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { signup as apiSignup } from "../../api/auth";
import { useAuthStore } from "../../store/useAuthStore";

export function SignupPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) {
            toast.error("All fields are required");
            return;
        }
        if (password !== confirm) {
            toast.error("Passwords do not match");
            return;
        }
        setLoading(true);
        try {
            const res = await apiSignup(email, password);
            setAuth(res.token, { userId: res.userId, email: res.email, role: res.role });
            toast.success("Account created!");
            navigate("/home");
        } catch (err: any) {
            toast.error(err.message || "Signup failed");
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
                            Create your account to start earning certificates
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
                                id="signup-email"
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
                                id="signup-password"
                            />
                        </div>

                        <div className="ct-form-group">
                            <label className="ct-form-label">Confirm Password</label>
                            <input
                                className="ct-input"
                                type="password"
                                placeholder="••••••••"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                id="signup-confirm"
                            />
                        </div>

                        <button
                            type="submit"
                            className="ct-btn ct-btn-primary ct-btn-lg"
                            style={{ width: "100%", marginTop: 8 }}
                            disabled={loading}
                            id="signup-submit"
                        >
                            <UserPlus size={18} />
                            {loading ? "Creating account…" : "Create Account"}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--ct-text-secondary)" }}>
                        Already have an account?{" "}
                        <Link to="/login" style={{ fontWeight: 600 }}>
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
