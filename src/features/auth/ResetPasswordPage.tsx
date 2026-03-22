import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { resetPassword } from "../../api/auth";
import { getApiMessage, getApiStatus, isTimeoutError } from "../../api/errors";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromQuery = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);

  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const trimmedToken = token.trim();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedToken) {
      setErrorMessage("Reset token is required");
      return;
    }
    if (trimmedNewPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }
    if (trimmedNewPassword !== trimmedConfirm) {
      setErrorMessage("Password and confirm password must match");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await resetPassword(trimmedToken, trimmedNewPassword);
      toast.success(response.message || "Password reset successfully");
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const message = status === 429
        ? "Too many requests, try later"
        : isTimeoutError(error)
          ? "Reset request timed out. Backend may be waking up. Please retry."
          : getApiMessage(error, "Failed to reset password");
      setErrorMessage(message);
      toast.error(message);
    } finally {
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
              Set your new account password
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="ct-form-group">
              <label className="ct-form-label" htmlFor="reset-token">Reset Token</label>
              <input
                id="reset-token"
                className="ct-input"
                type="text"
                value={token}
                placeholder="Paste your reset token"
                onChange={(event) => setToken(event.target.value)}
                autoFocus={!tokenFromQuery}
                disabled={loading}
              />
            </div>

            <div className="ct-form-group">
              <label className="ct-form-label" htmlFor="reset-new-password">New Password</label>
              <input
                id="reset-new-password"
                className="ct-input"
                type="password"
                value={newPassword}
                placeholder="Minimum 8 characters"
                onChange={(event) => setNewPassword(event.target.value)}
                autoFocus={Boolean(tokenFromQuery)}
                disabled={loading}
              />
            </div>

            <div className="ct-form-group">
              <label className="ct-form-label" htmlFor="reset-confirm-password">Confirm Password</label>
              <input
                id="reset-confirm-password"
                className="ct-input"
                type="password"
                value={confirmPassword}
                placeholder="Re-enter your new password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading}
              />
            </div>

            {errorMessage && (
              <div className="ct-banner ct-banner-error" style={{ marginTop: 4, marginBottom: 12 }}>
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="ct-btn ct-btn-primary ct-btn-lg"
              style={{ width: "100%" }}
              disabled={loading}
              id="reset-password-submit"
            >
              <KeyRound size={18} />
              {loading ? "Updating..." : "Update Password"}
            </button>
          </form>

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
