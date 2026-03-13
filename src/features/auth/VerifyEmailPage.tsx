import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MailCheck, RefreshCw, XCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyEmail } from "../../api/auth";
import { getApiMessage, getApiStatus } from "../../api/errors";

type VerifyState = "loading" | "success" | "error" | "missing";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);
  const [state, setState] = useState<VerifyState>(token ? "loading" : "missing");
  const [message, setMessage] = useState(
    token ? "Verifying your email..." : "Verification token is missing from the link.",
  );

  const verifyToken = useCallback(async () => {
    if (!token) {
      setState("missing");
      setMessage("Verification token is missing from the link.");
      return;
    }

    setState("loading");
    setMessage("Verifying your email...");
    try {
      const response = await verifyEmail(token);
      setState("success");
      setMessage(response.message || "Your email has been verified. You can now sign in.");
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const fallback = status === 429 ? "Too many requests, try later" : "Email verification failed";
      setState("error");
      setMessage(getApiMessage(error, fallback));
    }
  }, [token]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

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
            {state === "success" && (
              <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <CheckCircle2 size={34} style={{ color: "var(--ct-success)" }} />
                <strong>Email Verified</strong>
              </div>
            )}
            {(state === "error" || state === "missing") && (
              <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
                <XCircle size={34} style={{ color: "var(--ct-error)" }} />
                <strong>Verification Failed</strong>
              </div>
            )}
          </div>

          <div className={state === "success" ? "ct-banner ct-banner-success" : "ct-banner ct-banner-error"}>
            {message}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
            {state === "error" && token && (
              <button type="button" className="ct-btn ct-btn-secondary" onClick={verifyToken} id="verify-email-retry-btn">
                <RefreshCw size={15} />
                Retry
              </button>
            )}
            <Link to="/login" className="ct-btn ct-btn-primary" id="verify-email-login-btn">
              <MailCheck size={15} />
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
