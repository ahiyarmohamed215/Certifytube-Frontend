import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowLeft, KeyRound } from "lucide-react";
import { changePassword } from "../../api/auth";
import { getApiMessage, getApiStatus } from "../../api/errors";
import { useAuthStore } from "../../store/useAuthStore";

function clearProtectedClientData() {
  if (typeof window === "undefined") return;

  const localKeys: string[] = [];
  for (let idx = 0; idx < window.localStorage.length; idx += 1) {
    const key = window.localStorage.key(idx);
    if (key && key.startsWith("ct_")) localKeys.push(key);
  }
  localKeys.forEach((key) => window.localStorage.removeItem(key));

  try {
    window.sessionStorage.clear();
  } catch {
    // ignore cleanup failures
  }
}

export function ChangePasswordPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (changingPassword) return;

    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmNewPassword.trim();

    if (!trimmedCurrent || !trimmedNew || !trimmedConfirm) {
      setErrorMessage("All password fields are required");
      setSuccessMessage(null);
      return;
    }
    if (trimmedNew.length < 8) {
      setErrorMessage("New password must be at least 8 characters");
      setSuccessMessage(null);
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      setErrorMessage("New password and confirm password must match");
      setSuccessMessage(null);
      return;
    }

    setChangingPassword(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const response = await changePassword(trimmedCurrent, trimmedNew);
      const message = response.message || "Password changed successfully";
      setSuccessMessage(message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      toast.success(message);
    } catch (error: unknown) {
      const status = getApiStatus(error);
      const backendMessage = getApiMessage(error, "Failed to change password");
      const message = status === 429 ? "Too many requests, try later" : backendMessage;
      setErrorMessage(message);
      setSuccessMessage(null);
      toast.error(message);
      if (status === 401) {
        qc.clear();
        clearAuth();
        clearProtectedClientData();
        nav("/login", { replace: true });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="ct-slide-up" style={{ maxWidth: 720, margin: "0 auto" }}>
      <button
        type="button"
        className="ct-btn ct-btn-secondary ct-btn-sm"
        onClick={() => nav("/profile")}
        style={{ marginBottom: 12 }}
      >
        <ArrowLeft size={14} />
        Back to Profile
      </button>

      <div className="ct-card">
        <h1 className="ct-page-title" style={{ marginBottom: 6 }}>Change Password</h1>
        <p className="ct-page-subtitle" style={{ marginBottom: 16 }}>
          Update your password to keep your account secure.
        </p>

        <form onSubmit={handleChangePassword} style={{ maxWidth: 460 }}>
          <div className="ct-form-group" style={{ marginBottom: 12 }}>
            <label className="ct-form-label" htmlFor="change-current-password">Current Password</label>
            <input
              id="change-current-password"
              className="ct-input"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              disabled={changingPassword}
            />
          </div>
          <div className="ct-form-group" style={{ marginBottom: 12 }}>
            <label className="ct-form-label" htmlFor="change-new-password">New Password</label>
            <input
              id="change-new-password"
              className="ct-input"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              disabled={changingPassword}
            />
          </div>
          <div className="ct-form-group" style={{ marginBottom: 12 }}>
            <label className="ct-form-label" htmlFor="change-confirm-password">Confirm New Password</label>
            <input
              id="change-confirm-password"
              className="ct-input"
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              autoComplete="new-password"
              disabled={changingPassword}
            />
          </div>

          {errorMessage && (
            <div className="ct-banner ct-banner-error" style={{ marginBottom: 12 }}>
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="ct-banner ct-banner-success" style={{ marginBottom: 12 }}>
              {successMessage}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="ct-btn ct-profile-change-submit-btn"
              id="change-password-submit-btn"
              disabled={changingPassword}
            >
              <KeyRound size={15} />
              {changingPassword ? "Updating..." : "Update Password"}
            </button>
            <button
              type="button"
              className="ct-btn ct-btn-secondary"
              onClick={() => nav("/profile")}
              disabled={changingPassword}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
