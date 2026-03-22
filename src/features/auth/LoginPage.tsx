import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, Send } from "lucide-react";
import toast from "react-hot-toast";
import { getMe, login as apiLogin, resendVerification } from "../../api/auth";
import { getApiMessage, getApiStatus, isTimeoutError } from "../../api/errors";
import { useAuthStore } from "../../store/useAuthStore";
import { getDefaultAppPath } from "../../app/defaultAppPath";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isUnverifiedMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("not verified")
    || normalized.includes("unverified")
    || (normalized.includes("verify") && normalized.includes("email"));
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const { setAuth, setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmedEmail) || !password.trim()) {
      setLoginError("Email and password are required");
      return;
    }

    setLoading(true);
    setLoginError(null);
    setResendError(null);
    setResendMessage(null);
    setUnverifiedEmail(null);

    try {
      const response = await apiLogin(trimmedEmail, password);
      setAuth(response.token, {
        userId: response.userId,
        email: response.email,
        name: response.name,
        role: response.role,
      });
      try {
        const me = await getMe();
        setUser(me);
      } catch {
        // keep user data from login response if /me fails transiently
      }
      toast.success("Welcome back!");
      navigate(getDefaultAppPath(response.role));
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const backendMessage = getApiMessage(error, "Login failed");
      const timeoutMessage = "Login request timed out. Backend may be waking up. Please try again in a few seconds.";
      if (isUnverifiedMessage(backendMessage)) {
        setLoginError("Your email is not verified. Please verify your account before logging in.");
        setUnverifiedEmail(trimmedEmail);
      } else {
        const message = status === 429
          ? "Too many requests, try later"
          : isTimeoutError(error)
            ? timeoutMessage
            : backendMessage;
        setLoginError(message);
      }
      toast.error(
        status === 429
          ? "Too many requests, try later"
          : isTimeoutError(error)
            ? timeoutMessage
            : backendMessage,
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resending) return;
    const targetEmail = (unverifiedEmail || email).trim().toLowerCase();
    if (!EMAIL_PATTERN.test(targetEmail)) {
      setResendError("Enter a valid email address");
      return;
    }

    setResending(true);
    setResendError(null);
    setResendMessage(null);
    try {
      const response = await resendVerification(targetEmail);
      const message = response.message || "Verification email sent";
      setResendMessage(message);
      toast.success(message);
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const message = status === 429
        ? "Too many requests, try later"
        : isTimeoutError(error)
          ? "Email resend timed out. Backend may be waking up. Please try again."
          : getApiMessage(error, "Failed to resend verification email");
      setResendError(message);
      toast.error(message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="ct-auth-bg">
      <div className="ct-auth-card">
        <div className="ct-glass-card ct-slide-up">
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <Link to="/" className="ct-logo" style={{ fontSize: 28 }}>
              CertifyTube
            </Link>
            <p style={{ color: "var(--ct-text-secondary)", marginTop: 8, fontSize: 14 }}>
              Sign in to continue learning
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ct-form-group">
              <label className="ct-form-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="ct-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="ct-form-group">
              <label className="ct-form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="ct-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
              />
              <div style={{ textAlign: "right", marginTop: 8 }}>
                <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 600 }}>
                  Forgot password?
                </Link>
              </div>
            </div>

            {loginError && (
              <div className="ct-banner ct-banner-error" style={{ marginBottom: 12 }}>
                {loginError}
              </div>
            )}
            {unverifiedEmail && (
              <div className="ct-banner ct-banner-warning" style={{ marginBottom: 12 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <span>Need a new verification link for <strong>{unverifiedEmail}</strong>?</span>
                  <button
                    type="button"
                    className="ct-btn ct-btn-secondary ct-btn-sm"
                    onClick={handleResendVerification}
                    disabled={resending}
                    style={{ width: "fit-content" }}
                    id="login-resend-verification-btn"
                  >
                    <Send size={14} />
                    {resending ? "Sending..." : "Resend Verification"}
                  </button>
                </div>
              </div>
            )}
            {resendError && (
              <div className="ct-banner ct-banner-error" style={{ marginBottom: 12 }}>
                {resendError}
              </div>
            )}
            {resendMessage && (
              <div className="ct-banner ct-banner-success" style={{ marginBottom: 12 }}>
                {resendMessage}
              </div>
            )}

            <button
              type="submit"
              className="ct-btn ct-btn-primary ct-btn-lg"
              style={{ width: "100%", marginTop: 6 }}
              disabled={loading}
              id="login-submit"
            >
              <LogIn size={18} />
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 22, fontSize: 14, color: "var(--ct-text-secondary)" }}>
            Don&apos;t have an account?{" "}
            <Link to="/signup" style={{ fontWeight: 600 }}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
