import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { forgotPassword } from "../../api/auth";
import { getApiMessage, getApiStatus, isTimeoutError } from "../../api/errors";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_SUCCESS = "If this email exists, password reset instructions have been sent.";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setErrorMessage("Enter a valid email address");
      return;
    }

    setLoading(true);
    setSubmitted(false);
    setRateLimitMessage(null);
    setErrorMessage(null);

    try {
      const response = await forgotPassword(trimmedEmail);
      setSuccessMessage(response.message || GENERIC_SUCCESS);
    } catch (error: unknown) {
      const status = getApiStatus(error);
      if (status === 429) {
        setRateLimitMessage("Too many requests, try later");
      } else if (isTimeoutError(error)) {
        setErrorMessage("Request timed out. Backend may be waking up. Please retry.");
      } else if (status === 400) {
        setErrorMessage(getApiMessage(error, "Request failed"));
      }
      // Keep this generic for account-enumeration safety.
      setSuccessMessage(GENERIC_SUCCESS);
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="ct-auth-bg">
      <div className="ct-auth-card">
        <div className="ct-glass-card ct-slide-up">
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <Link to="/" className="ct-logo" style={{ fontSize: 28 }}>
              CertifyTube
            </Link>
            <p style={{ color: "var(--ct-text-secondary)", marginTop: 8, fontSize: 14 }}>
              Recover your account password
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ct-form-group">
              <label className="ct-form-label" htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                className="ct-input"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>

            {errorMessage && (
              <div className="ct-banner ct-banner-error" style={{ marginBottom: 12 }}>
                {errorMessage}
              </div>
            )}
            {rateLimitMessage && (
              <div className="ct-banner ct-banner-warning" style={{ marginBottom: 12 }}>
                {rateLimitMessage}
              </div>
            )}

            <button
              type="submit"
              className="ct-btn ct-btn-primary ct-btn-lg"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
              id="forgot-password-submit"
            >
              <Mail size={18} />
              {loading ? "Sending..." : "Send Reset Instructions"}
            </button>
          </form>

          {submitted && (
            <div className="ct-banner ct-banner-success" style={{ marginTop: 14 }}>
              {successMessage || GENERIC_SUCCESS}
            </div>
          )}

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--ct-text-secondary)" }}>
            Back to{" "}
            <Link to="/login" style={{ fontWeight: 600 }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
