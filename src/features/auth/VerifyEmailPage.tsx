import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, MailCheck, RefreshCw, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { resendVerification, verifyEmail } from "../../api/auth";
import { getApiCode, getApiMessage, getApiStatus } from "../../api/errors";

type VerifyState =
  | "loading"
  | "success"
  | "already_verified"
  | "invalid_or_expired"
  | "missing"
  | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const hasRequestedRef = useRef(false);
  const requestedTokenRef = useRef<string>("");

  const [state, setState] = useState<VerifyState>(token ? "loading" : "missing");
  const [message, setMessage] = useState(token ? "Verifying your email..." : "Invalid verification link");

  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  const verifyToken = useCallback(async () => {
    if (!token) {
      setState("missing");
      setMessage("Invalid verification link");
      return;
    }

    setState("loading");
    setMessage("Verifying your email...");
    setResendSuccess(null);
    setResendError(null);

    try {
      const response = await verifyEmail(token);
      setState("success");
      setMessage(response.message || "Email verified successfully");
      return;
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const code = getApiCode(error);

      if (status === 400 && code === "TOKEN_ALREADY_USED") {
        setState("already_verified");
        setMessage("Email already verified");
        return;
      }
      if (status === 400 && code === "TOKEN_INVALID_OR_EXPIRED") {
        setState("invalid_or_expired");
        setMessage("Link invalid or expired");
        return;
      }
      if (status === 400 && code === "TOKEN_MISSING") {
        setState("missing");
        setMessage("Invalid verification link");
        return;
      }

      setState("error");
      setMessage(getApiMessage(error, "Verification failed. Please try again."));
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setState("missing");
      setMessage("Invalid verification link");
      return;
    }

    // Prevent duplicate verification requests in React Strict Mode.
    if (hasRequestedRef.current && requestedTokenRef.current === token) return;

    hasRequestedRef.current = true;
    requestedTokenRef.current = token;
    void verifyToken();
  }, [token, verifyToken]);

  const handleResend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (resendLoading) return;

    const trimmedEmail = resendEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setResendError("Enter a valid email address");
      setResendSuccess(null);
      return;
    }

    setResendLoading(true);
    setResendError(null);
    setResendSuccess(null);
    try {
      const response = await resendVerification(trimmedEmail);
      setResendSuccess(response.message || "Verification email has been sent.");
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const fallback = status === 429 ? "Too many requests, try later" : "Failed to resend verification email";
      setResendError(getApiMessage(error, fallback));
    } finally {
      setResendLoading(false);
    }
  };

  const showLoginButton = state === "success" || state === "already_verified";
  const isFailureState = state === "missing" || state === "error" || state === "invalid_or_expired";
  const showRetry = state === "error" && Boolean(token);

  return (
    <div className="ct-auth-bg">
      <div className="ct-auth-card">
        <div className="ct-glass-card ct-slide-up" style={{ textAlign: "center" }}>
          <Link to="/" className="ct-logo" style={{ fontSize: 28 }}>
            CertifyTube
          </Link>

          <div style={{ marginTop: 18, marginBottom: 14 }}>
            {state === "loading" && (
              <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <div className="ct-spinner" />
                <strong>Verifying Email...</strong>
              </div>
            )}
            {(state === "success" || state === "already_verified") && (
              <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <CheckCircle2 size={34} style={{ color: "var(--ct-success)" }} />
                <strong>{state === "success" ? "Email Verified" : "Already Verified"}</strong>
              </div>
            )}
            {isFailureState && (
              <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <XCircle size={34} style={{ color: "var(--ct-error)" }} />
                <strong>Verification Failed</strong>
              </div>
            )}
          </div>

          <div className={(state === "success" || state === "already_verified") ? "ct-banner ct-banner-success" : "ct-banner ct-banner-error"}>
            {message}
          </div>

          {state === "invalid_or_expired" && (
            <form onSubmit={handleResend} style={{ marginTop: 14, textAlign: "left" }}>
              <div className="ct-form-group" style={{ marginBottom: 12 }}>
                <label className="ct-form-label" htmlFor="verify-resend-email">Email</label>
                <input
                  id="verify-resend-email"
                  className="ct-input"
                  type="email"
                  value={resendEmail}
                  onChange={(event) => setResendEmail(event.target.value)}
                  placeholder="you@example.com"
                  disabled={resendLoading}
                />
              </div>

              {resendError && (
                <div className="ct-banner ct-banner-error" style={{ marginBottom: 10 }}>
                  {resendError}
                </div>
              )}
              {resendSuccess && (
                <div className="ct-banner ct-banner-info" style={{ marginBottom: 10 }}>
                  {resendSuccess}
                </div>
              )}

              <button
                type="submit"
                className="ct-btn ct-btn-secondary"
                disabled={resendLoading}
                id="verify-email-resend-btn"
              >
                <MailCheck size={15} />
                {resendLoading ? "Sending..." : "Resend Verification"}
              </button>
            </form>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            {showRetry && (
              <button type="button" className="ct-btn ct-btn-secondary" onClick={verifyToken} id="verify-email-retry-btn">
                <RefreshCw size={15} />
                Retry
              </button>
            )}
            {showLoginButton && (
              <Link to="/login" className="ct-btn ct-btn-primary" id="verify-email-login-btn">
                <MailCheck size={15} />
                Go to Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
