import { useState } from "react";
import { CheckCircle2, Mail, Send, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { resendVerification, signup as apiSignup } from "../../api/auth";
import { getApiMessage, getApiStatus } from "../../api/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupMessage, setSignupMessage] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password.trim() || !confirmPassword.trim()) {
      setFormError("All fields are required");
      return;
    }
    if (trimmedName.length < 2 || trimmedName.length > 255) {
      setFormError("Name must be between 2 and 255 characters");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFormError("Enter a valid email address");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setFormError("Password must be between 8 and 128 characters");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    setLoading(true);
    setFormError(null);
    setResendMessage(null);
    setResendError(null);
    try {
      const response = await apiSignup(trimmedEmail, password, trimmedName);
      setSignupSuccess(true);
      setSignupMessage(response.message || "Check your email to verify account");
      toast.success("Check your email to verify account");
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const message = status === 429
        ? "Too many requests, try later"
        : getApiMessage(error, "Signup failed");
      setFormError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resending) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setResendError("Enter a valid email address");
      return;
    }

    setResending(true);
    setResendMessage(null);
    setResendError(null);
    try {
      const response = await resendVerification(trimmedEmail);
      const message = response.message || "Verification email sent again";
      setResendMessage(message);
      toast.success(message);
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const message = status === 429
        ? "Too many requests, try later"
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
              Create your account to start earning certificates
            </p>
          </div>

          {!signupSuccess ? (
            <form onSubmit={handleSubmit}>
              <div className="ct-form-group">
                <label className="ct-form-label" htmlFor="signup-name">Full Name</label>
                <input
                  id="signup-name"
                  className="ct-input"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                  disabled={loading}
                  maxLength={255}
                />
              </div>

              <div className="ct-form-group">
                <label className="ct-form-label" htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  className="ct-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="ct-form-group">
                <label className="ct-form-label" htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  className="ct-input"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="ct-form-group">
                <label className="ct-form-label" htmlFor="signup-confirm-password">Confirm Password</label>
                <input
                  id="signup-confirm-password"
                  className="ct-input"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={loading}
                />
              </div>

              {formError && (
                <div className="ct-banner ct-banner-error" style={{ marginBottom: 12 }}>
                  {formError}
                </div>
              )}

              <button
                type="submit"
                className="ct-btn ct-btn-primary ct-btn-lg"
                style={{ width: "100%", marginTop: 6 }}
                disabled={loading}
                id="signup-submit"
              >
                <UserPlus size={18} />
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div className="ct-banner ct-banner-success">
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <CheckCircle2 size={16} style={{ marginTop: 2 }} />
                  <div>
                    <strong style={{ display: "block", marginBottom: 4 }}>Check your email to verify account</strong>
                    <span>{signupMessage}</span>
                  </div>
                </div>
              </div>

              <div className="ct-banner ct-banner-info">
                Verification was sent to <strong>{email.trim().toLowerCase()}</strong>.
              </div>

              {resendError && (
                <div className="ct-banner ct-banner-error">
                  {resendError}
                </div>
              )}
              {resendMessage && (
                <div className="ct-banner ct-banner-success">
                  {resendMessage}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="ct-btn ct-btn-secondary"
                  onClick={handleResendVerification}
                  disabled={resending}
                  id="signup-resend-verification-btn"
                >
                  <Send size={15} />
                  {resending ? "Sending..." : "Resend Verification"}
                </button>
                <Link to="/login" className="ct-btn ct-btn-primary">
                  <Mail size={15} />
                  Go to Login
                </Link>
              </div>
            </div>
          )}

          <p style={{ textAlign: "center", marginTop: 22, fontSize: 14, color: "var(--ct-text-secondary)" }}>
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
